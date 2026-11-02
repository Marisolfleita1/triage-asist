import { K_VECINOS, MODELO_LLM } from "./config"
import { textoDelCaso, type CasoTriage } from "./preparar"
import { abrirColeccion, conOllama, embeddings, ollama } from "./servicios"

export interface ResultadoTriage {
  nivel: number // KTAS 1 (más grave) a 5 (menos grave)
  justificacion: string
  signos_de_alarma: string[]
  confianza: number // 0 a 1
  fuente: "ktas" | "ctas" // casos de Kaggle (16 años o más) o ejemplos del protocolo (menores)
}

export interface CasoSimilar {
  texto: string
  nivel: number
}

const INSTRUCCIONES = `Sos un asistente de apoyo al triage de guardia según la escala KTAS (Korean Triage and Acuity Scale). Tu respuesta es una sugerencia que revisa un profesional de salud, no un diagnóstico.

Niveles KTAS:
1 - Reanimación: riesgo vital inmediato (paro, inconsciente, shock, insuficiencia respiratoria grave).
2 - Emergencia: riesgo vital potencial (dolor torácico típico, alteración de conciencia, signos vitales muy alterados).
3 - Urgente: cuadro que puede agravarse, signos vitales levemente alterados o dolor intenso.
4 - Menos urgente: cuadro estable, dolor leve a moderado, signos vitales normales.
5 - No urgente: consulta crónica o menor, sin alteración de signos vitales.

Reglas:
- Si un dato dice "no registrado", NO asumas que es normal.
- Si falta un dato importante para el cuadro (por ejemplo SatO2 en un paciente con disnea), mencionalo en signos_de_alarma.
- En signos_de_alarma poné solo hallazgos concretos del paciente que preocupan (puede quedar vacía).

Respondé SOLO con un JSON con esta forma:
{"nivel": <1 a 5>, "justificacion": "<2 o 3 oraciones en español>", "signos_de_alarma": ["..."]}`

// Nivel más votado entre los casos parecidos (en empate gana el más grave)
function nivelMasVotado(similares: CasoSimilar[]) {
  const votos = [1, 2, 3, 4, 5].map((n) => similares.filter((s) => s.nivel === n).length)
  return votos.indexOf(Math.max(...votos)) + 1
}

function armarPrompt(caso: CasoTriage, similares: CasoSimilar[], contexto?: string) {
  let ejemplos = ""
  if (similares.length) {
    const sugerido = nivelMasVotado(similares)
    const votos = similares.filter((s) => s.nivel === sugerido).length
    ejemplos =
      "Casos parecidos ya clasificados por expertos:\n\n" +
      similares.map((s, i) => `Caso ${i + 1} -> KTAS ${s.nivel}\n${s.texto}`).join("\n\n") +
      `\n\n${votos} de ${similares.length} casos parecidos son KTAS ${sugerido}. ` +
      `Usá ese nivel salvo que los datos de ESTE paciente justifiquen claramente otro, ` +
      `y en ese caso explicá por qué en la justificación.\n\n`
  }
  const extra = contexto ? `Información adicional: ${contexto}\n` : ""
  return `${ejemplos}Paciente a clasificar:\n${textoDelCaso(caso)}\n${extra}`
}

// Los motivos del dataset KTAS están en inglés y son cortos ("abd pain", "dyspnea").
// Si buscamos con el texto en español los vecinos salen mal, así que primero
// se resume el texto libre a un motivo de consulta en inglés.
export async function motivoEnIngles(sintomas: string): Promise<string> {
  const res = await conOllama(() =>
    ollama.chat({
      model: MODELO_LLM,
      messages: [
        {
          role: "user",
          content: `Resumí estos síntomas como un "chief complaint" de guardia en inglés, de 2 a 6 palabras, estilo "chest pain", "dyspnea", "ankle injury". Respondé solo con eso, sin comillas.\n\nSíntomas: ${sintomas}`,
        },
      ],
      stream: false,
      options: { temperature: 0, num_predict: 20 },
      keep_alive: "30m",
    })
  )
  return res.message.content.trim().split("\n")[0].replace(/["']/g, "")
}

export async function buscarSimilares(caso: CasoTriage, k = K_VECINOS): Promise<CasoSimilar[]> {
  const coleccion = await abrirColeccion()
  const [vector] = await embeddings([textoDelCaso(caso)], "consulta")
  const res = await coleccion.query({ queryEmbeddings: [vector], nResults: k })
  return res.documents[0].map((texto, i) => ({
    texto: texto ?? "",
    nivel: Number(res.metadatas[0][i]?.nivel),
  }))
}

// Le pide el nivel al LLM y valida el JSON que devuelve
export async function pedirClasificacion(instrucciones: string, prompt: string) {
  const res = await conOllama(() =>
    ollama.chat({
      model: MODELO_LLM,
      messages: [
        { role: "system", content: instrucciones },
        { role: "user", content: prompt },
      ],
      format: "json",
      stream: false,
      options: { temperature: 0 },
      keep_alive: "30m", // deja el modelo cargado entre consultas (en CPU cargarlo es lento)
    })
  )

  let json: any
  try {
    json = JSON.parse(res.message.content)
  } catch {
    throw new Error("El modelo no devolvió JSON válido: " + res.message.content)
  }
  const nivel = Number(json.nivel)
  if (![1, 2, 3, 4, 5].includes(nivel)) {
    throw new Error("El modelo devolvió un nivel inválido: " + json.nivel)
  }

  return {
    nivel,
    justificacion: String(json.justificacion ?? ""),
    signos_de_alarma: (Array.isArray(json.signos_de_alarma)
      ? json.signos_de_alarma.map(String)
      : []) as string[],
  }
}

// Clasifica un caso. Con usarRag = false es la baseline "zero-shot" (solo el LLM).
// `contexto` sirve para pasar datos que no están en KTAS (antecedentes, tiempo de inicio).
export async function clasificarCaso(
  caso: CasoTriage,
  { usarRag = true, contexto }: { usarRag?: boolean; contexto?: string } = {}
): Promise<ResultadoTriage> {
  const similares = usarRag ? await buscarSimilares(caso) : []
  const r = await pedirClasificacion(INSTRUCCIONES, armarPrompt(caso, similares, contexto))
  return { ...r, confianza: calcularConfianza(r.nivel, similares), fuente: "ktas" }
}

// Confianza = proporción de casos parecidos que tienen el mismo nivel sugerido
// (ej: 4 de 5 coinciden -> 0.8). Sin RAG no hay con qué comparar, así que queda en 0.
export function calcularConfianza(nivel: number, similares: { nivel: number }[]) {
  if (!similares.length) return 0
  return similares.filter((s) => s.nivel === nivel).length / similares.length
}
