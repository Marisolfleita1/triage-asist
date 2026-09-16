import { NextRequest, NextResponse } from "next/server"
import { clasificarPaciente } from "@/lib/triage"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const resultado = await clasificarPaciente(body)
    return NextResponse.json(resultado)
  } catch (err: any) {
    console.error("Error clasificando paciente:", err)
    return NextResponse.json(
      { error: err.message ?? "Error interno" },
      { status: 500 }
    )
  }
}
