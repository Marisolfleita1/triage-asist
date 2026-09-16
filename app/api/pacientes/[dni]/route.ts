import { NextRequest, NextResponse } from "next/server"
import { buscarPacientePorDni } from "@/lib/pacientes"

export async function GET(
  _req: NextRequest,
  { params }: { params: { dni: string } }
) {
  const paciente = buscarPacientePorDni(params.dni)
  if (!paciente) {
    return NextResponse.json({ encontrado: false })
  }
  return NextResponse.json({ encontrado: true, paciente })
}
