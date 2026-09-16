import { Ollama } from "ollama"
import type { Paciente } from "./pacientes"

const ollama = new Ollama()
const MODEL = "triage-assistant"

export type ColorTriage = "ROJO" | "NARANJA" | "AMARILLO" | "VERDE" | "AZUL"

export interface ClasificacionTriage {
  clasificacion: string
  color: ColorTriage
  tiempoEsperaMin: number
  sintomasDetectados: string[]
  factoresAgravantes: string[]
  justificacion: string
}

export interface DatosClasificacion {
  sintomas: string
  intensidad: "leve" | "moderada" | "severa"
  tiempoInicio: "minutos" | "horas" | "dias"
  paciente: Paciente | null
}

function armarPrompt(datos: DatosClasificacion): string {
  const antecedentesTxt = datos.paciente?.antecedentes.length
    ? datos.paciente.antecedentes.map((a) => `- (${a.tipo}) ${a.texto}`).join("\n")
    : "Sin antecedentes registrados."
  const edadTxt = datos.paciente ? `${datos.paciente.edad} años` : "Edad desconocida"

  return `Paciente: ${edadTxt}
Antecedentes:
${antecedentesTxt}

Síntomas referidos por el paciente (texto libre):
"${datos.sintomas}"

Intensidad percibida: ${datos.intensidad}
Tiempo desde el inicio de los síntomas: ${datos.tiempoInicio}

Clasificá este caso según Triage Manchester y respondé solo con el JSON pedido.`
}

export async function clasificarPaciente(
  datos: DatosClasificacion
): Promise<ClasificacionTriage> {
  if (!datos.sintomas?.trim()) throw new Error("Faltan síntomas")

  const res = await ollama.chat({
    model: MODEL,
    messages: [{ role: "user", content: armarPrompt(datos) }],
    format: "json",
    stream: false,
    options: { temperature: 0 },
  })

  let parsed: ClasificacionTriage
  try {
    parsed = JSON.parse(res.message.content)
  } catch {
    throw new Error("El modelo no devolvió JSON válido: " + res.message.content)
  }
  if (!parsed.color || !parsed.clasificacion) {
    throw new Error("Respuesta del modelo incompleta")
  }
  return parsed
}
