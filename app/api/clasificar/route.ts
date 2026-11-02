import { NextRequest, NextResponse } from "next/server"
import { clasificarCaso, motivoEnIngles } from "@/lib/rag/clasificar"
import { EDAD_PEDIATRICA } from "@/lib/rag/config"
import { clasificarPediatrico } from "@/lib/rag/pediatria"
import { ServicioNoDisponible } from "@/lib/rag/servicios"
import type { CasoTriage } from "@/lib/rag/preparar"
import type { Paciente } from "@/lib/pacientes"

interface DatosFormulario {
  sintomas: string
  tiempoInicio?: "minutos" | "horas" | "dias"
  paciente: Paciente | null
  // Solo cuando el paciente no se encontró por DNI
  manual: {
    edad: number | null
    sexo: "F" | "M" | null
    alergias: string
    medicacion: string
    enfermedades: string
  } | null
  signos: {
    tas: number | null
    tad: number | null
    fc: number | null
    fr: number | null
    temperatura: number | null
    saturacion: number | null
    dolor: number | null
    estadoMental: CasoTriage["estadoMental"]
    trauma: boolean
  }
}

// Datos que no están en KTAS pero que el profesional cargó: van como contexto al LLM
function armarContexto(datos: DatosFormulario) {
  const partes = [`síntomas referidos por el paciente: "${datos.sintomas}"`]
  if (datos.tiempoInicio) partes.push(`inicio de los síntomas hace ${datos.tiempoInicio}`)
  const antecedentes = datos.paciente
    ? datos.paciente.antecedentes.map((a) => a.texto)
    : [datos.manual?.enfermedades, datos.manual?.medicacion, datos.manual?.alergias].filter(
        (t): t is string => !!t
      )
  if (antecedentes.length) partes.push(`antecedentes: ${antecedentes.join(", ")}`)
  return partes.join("; ")
}

export async function POST(req: NextRequest) {
  try {
    const datos: DatosFormulario = await req.json()
    if (!datos.sintomas?.trim()) {
      return NextResponse.json({ error: "Faltan los síntomas del paciente" }, { status: 400 })
    }

    // La edad decide qué base se usa, así que sin ella no se puede clasificar
    const edad = datos.paciente?.edad ?? datos.manual?.edad ?? null
    if (edad === null) {
      return NextResponse.json(
        { error: "Falta la edad del paciente: buscá el DNI o cargala a mano" },
        { status: 400 }
      )
    }
    const esPediatrico = edad < EDAD_PEDIATRICA

    const caso: CasoTriage = {
      id: "consulta",
      edad,
      sexo: datos.paciente?.sexo ?? datos.manual?.sexo ?? null,
      // El índice de adultos está en inglés: se busca con el motivo traducido.
      // Los ejemplos pediátricos están en español: se busca con los síntomas tal cual.
      motivo: esPediatrico ? datos.sintomas : await motivoEnIngles(datos.sintomas),
      trauma: datos.signos.trauma,
      estadoMental: datos.signos.estadoMental,
      dolor: datos.signos.dolor,
      tas: datos.signos.tas,
      tad: datos.signos.tad,
      fc: datos.signos.fc,
      fr: datos.signos.fr,
      temperatura: datos.signos.temperatura,
      saturacion: datos.signos.saturacion,
    }

    const contexto = armarContexto(datos)
    let resultado
    if (esPediatrico) {
      resultado = await clasificarPediatrico(caso, { contexto })
    } else {
      resultado = await clasificarCaso(caso, { contexto })
    }
    return NextResponse.json(resultado)
  } catch (err: any) {
    console.error("Error clasificando paciente:", err)
    if (err instanceof ServicioNoDisponible) {
      return NextResponse.json({ error: err.message }, { status: 503 })
    }
    return NextResponse.json({ error: err.message ?? "Error interno" }, { status: 500 })
  }
}
