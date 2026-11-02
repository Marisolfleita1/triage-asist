export type TipoAntecedente = "condicion" | "alergia" | "medicacion"

export interface Antecedente {
  tipo: TipoAntecedente
  texto: string
}

export interface Paciente {
  dni: string
  nombre: string
  edad: number
  sexo: "F" | "M"
  antecedentes: Antecedente[]
}

const PACIENTES: Paciente[] = [
  {
    dni: "28904771",
    nombre: "García, María Elena",
    edad: 67,
    sexo: "F",
    antecedentes: [
      { tipo: "condicion", texto: "HTA" },
      { tipo: "condicion", texto: "Diabetes tipo 2" },
      { tipo: "condicion", texto: "Cardiopatía isquémica" },
      { tipo: "alergia", texto: "Alergia: Penicilina" },
      { tipo: "medicacion", texto: "Metformina" },
      { tipo: "medicacion", texto: "Enalapril" },
      { tipo: "medicacion", texto: "AAS" },
    ],
  },
  {
    dni: "30111222",
    nombre: "Pérez, Juan Ignacio",
    edad: 34,
    sexo: "M",
    antecedentes: [{ tipo: "condicion", texto: "Asma" }],
  },
  {
    dni: "40555666",
    nombre: "Fernández, Lucía",
    edad: 8,
    sexo: "F",
    antecedentes: [],
  },
]

export function buscarPacientePorDni(dni: string): Paciente | undefined {
  const normalizado = dni.replace(/\D/g, "")
  return PACIENTES.find((p) => p.dni === normalizado)
}
