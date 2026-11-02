import fs from "fs"
import { COLECCION_PEDIATRIA, K_VECINOS } from "./config"
import { calcularConfianza, pedirClasificacion, type ResultadoTriage } from "./clasificar"
import { textoDelCaso, type CasoTriage } from "./preparar"
import { abrirColeccion, embeddings, recrearColeccion } from "./servicios"

const TAMANIO_LOTE = 50

// Una pregunta del CSV. Cada regla del protocolo tiene varias preguntas, con el mismo nivel.
export interface EjemploPediatrico {
  id: string
  regla: string
  pregunta: string
  respuesta: string // incluye el nivel y el criterio del protocolo
  nivel: number
  grupoEdad: string
}

const INSTRUCCIONES = `Sos un asistente de apoyo al triage de guardia de pacientes menores de 16 años, según la escala CTAS (Canadian Triage and Acuity Scale). Tu respuesta es una sugerencia que revisa un profesional de salud, no un diagnóstico.

Niveles CTAS:
1 - Resucitación: riesgo vital inmediato.
2 - Emergencia: riesgo potencial para la vida o una extremidad.
3 - Urgencia: cuadro que puede agravarse.
4 - Menos urgente: cuadro estable con posibilidad de complicarse.
5 - No urgente: cuadro menor o crónico.

Vas a recibir ejemplos armados a partir del protocolo CTAS, cada uno con su criterio y su grupo de edad.

Reglas:
- Buscá el ejemplo cuyo criterio y grupo de edad coincidan con ESTE paciente y usá ese nivel. No cuentes cuántos ejemplos tienen cada nivel.
- Si coincide más de un criterio, usá el nivel más grave.
- Si ningún criterio coincide, decilo en la justificación.
- Si un dato dice "no registrado", NO asumas que es normal.
- En signos_de_alarma poné solo hallazgos concretos del paciente que preocupan (puede quedar vacía).

Respondé SOLO con un JSON con esta forma:
{"nivel": <1 a 5>, "justificacion": "<2 o 3 oraciones en español>", "signos_de_alarma": ["..."]}`

// Separa el CSV en filas y campos. Los campos con comas vienen entre comillas.
function separarCsv(texto: string) {
  const filas: string[][] = []
  let fila: string[] = []
  let campo = ""
  let entreComillas = false
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i]
    if (entreComillas) {
      if (c === '"' && texto[i + 1] === '"') {
        campo += '"'
        i++
      } else if (c === '"') entreComillas = false
      else campo += c
    } else if (c === '"') entreComillas = true
    else if (c === ",") {
      fila.push(campo)
      campo = ""
    } else if (c === "\n") {
      fila.push(campo)
      filas.push(fila)
      fila = []
      campo = ""
    } else if (c !== "\r") campo += c
  }
  if (campo || fila.length) filas.push([...fila, campo])
  return filas
}

export function leerEjemplos(ruta: string): EjemploPediatrico[] {
  // El CSV viene en UTF-8 con BOM (la marca invisible del principio del archivo)
  const [columnas, ...filas] = separarCsv(fs.readFileSync(ruta, "utf8").replace(/^﻿/, ""))
  return filas.map((valores) => {
    const fila: Record<string, string> = {}
    columnas.forEach((c, j) => (fila[c] = valores[j] ?? ""))
    const nivel = Number(fila["nivel_ctas"])
    if (![1, 2, 3, 4, 5].includes(nivel)) {
      throw new Error(`Nivel inválido en la fila ${fila["id"]}: ${fila["nivel_ctas"]}`)
    }
    return {
      id: fila["id"],
      regla: fila["id_regla"],
      pregunta: fila["pregunta"],
      respuesta: fila["respuesta"],
      nivel,
      grupoEdad: fila["grupo_edad"],
    }
  })
}

// Texto que se convierte en embedding: la pregunta (lenguaje de la familia) + la
// descripción del criterio en español (lenguaje clínico, como escribe el profesional).
// El nivel se saca para que no influya en la búsqueda.
function textoParaBuscar(e: EjemploPediatrico) {
  const descripcion = e.respuesta
    .replace(/^Nivel CTAS \d \([^)]*\)\.\s*/, "")
    .replace(/Criterio:.*$/, "")
    .trim()
  return `${e.pregunta} ${descripcion}`
}

export async function indexarEjemplos(
  ejemplos: EjemploPediatrico[],
  nombre = COLECCION_PEDIATRIA,
  alAvanzar?: (hechos: number) => void
) {
  const coleccion = await recrearColeccion(nombre)
  for (let i = 0; i < ejemplos.length; i += TAMANIO_LOTE) {
    const lote = ejemplos.slice(i, i + TAMANIO_LOTE)
    const textos = lote.map(textoParaBuscar)
    await coleccion.add({
      ids: lote.map((e) => e.id),
      documents: textos,
      embeddings: await embeddings(textos, "documento"),
      metadatas: lote.map((e) => ({
        regla: e.regla,
        pregunta: e.pregunta,
        respuesta: e.respuesta,
        nivel: e.nivel,
        grupoEdad: e.grupoEdad,
      })),
    })
    alAvanzar?.(i + lote.length)
  }
  return coleccion.count()
}

// Busca el doble de lo necesario y se queda con una pregunta por regla: dos preguntas
// de la misma regla no son dos opiniones distintas y si no inflarían la confianza.
export async function buscarEjemplos(
  sintomas: string,
  nombre = COLECCION_PEDIATRIA,
  k = K_VECINOS
) {
  const coleccion = await abrirColeccion(nombre)
  const [vector] = await embeddings([sintomas], "consulta")
  const res = await coleccion.query({ queryEmbeddings: [vector], nResults: k * 2 })
  const vistas: Record<string, boolean> = {}
  const ejemplos: EjemploPediatrico[] = []
  res.metadatas[0].forEach((meta, i) => {
    const regla = String(meta?.regla)
    if (vistas[regla] || ejemplos.length === k) return
    vistas[regla] = true
    ejemplos.push({
      id: res.ids[0][i],
      regla,
      pregunta: String(meta?.pregunta),
      respuesta: String(meta?.respuesta),
      nivel: Number(meta?.nivel),
      grupoEdad: String(meta?.grupoEdad),
    })
  })
  return ejemplos
}

function armarPrompt(caso: CasoTriage, ejemplos: EjemploPediatrico[], contexto?: string) {
  const lista = ejemplos
    .map(
      (e, i) =>
        `Ejemplo ${i + 1} (grupo de edad: ${e.grupoEdad})\nConsulta: ${e.pregunta}\n${e.respuesta}`
    )
    .join("\n\n")
  const extra = contexto ? `Información adicional: ${contexto}\n` : ""
  return `Ejemplos del protocolo CTAS:\n\n${lista}\n\nPaciente a clasificar:\n${textoDelCaso(caso)}\n${extra}`
}

// `caso.motivo` son los síntomas en español, igual que las preguntas del CSV
export async function clasificarPediatrico(
  caso: CasoTriage,
  { contexto, coleccion }: { contexto?: string; coleccion?: string } = {}
): Promise<ResultadoTriage> {
  const ejemplos = await buscarEjemplos(caso.motivo, coleccion)
  const r = await pedirClasificacion(INSTRUCCIONES, armarPrompt(caso, ejemplos, contexto))
  return { ...r, confianza: calcularConfianza(r.nivel, ejemplos), fuente: "ctas" }
}
