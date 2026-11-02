import fs from "fs"
import { PORCENTAJE_TEST, SEMILLA } from "./config"

export type Sexo = "F" | "M"
export type EstadoMental = "alerta" | "responde a la voz" | "responde al dolor" | "no responde"

// Un caso de triage. Los signos vitales pueden faltar (null), tanto en el
// dataset como en la guardia real.
export interface CasoTriage {
  id: string
  edad: number | null
  sexo: Sexo | null
  motivo: string
  trauma: boolean | null
  estadoMental: EstadoMental | null
  dolor: number | null // escala NRS 0-10
  tas: number | null // mmHg
  tad: number | null // mmHg
  fc: number | null // lpm
  fr: number | null // rpm
  temperatura: number | null // °C
  saturacion: number | null // %
  nivel?: number // KTAS_expert (1 = más grave, 5 = menos grave)
}

const ESTADOS_MENTALES: EstadoMental[] = [
  "alerta",
  "responde a la voz",
  "responde al dolor",
  "no responde",
]

// Convierte a número; "??", "#BOÞ!" o vacío pasan a null. Acepta coma decimal.
function numero(valor: string | undefined): number | null {
  if (!valor) return null
  const n = Number(valor.trim().replace(",", "."))
  return Number.isFinite(n) ? n : null
}

// Columnas usadas: datos disponibles AL MOMENTO del triage.
// Se excluyen KTAS_RN, Diagnosis in ED, Disposition, mistriage, Error_group y
// los tiempos de estadía porque son posteriores al triage (fuga de información).
function filaACaso(fila: Record<string, string>, i: number): CasoTriage {
  const mental = numero(fila["Mental"])
  const tieneDolor = fila["Pain"] === "1"
  return {
    id: `ktas-${i}`,
    edad: numero(fila["Age"]),
    sexo: fila["Sex"] === "1" ? "F" : fila["Sex"] === "2" ? "M" : null,
    motivo: fila["Chief_complain"].trim(),
    trauma: fila["Injury"] === "2" ? true : fila["Injury"] === "1" ? false : null,
    estadoMental: mental ? ESTADOS_MENTALES[mental - 1] ?? null : null,
    // Sin dolor el dataset trae "#BOÞ!" en NRS_pain: lo tomamos como 0
    dolor: tieneDolor ? numero(fila["NRS_pain"]) : 0,
    tas: numero(fila["SBP"]),
    tad: numero(fila["DBP"]),
    fc: numero(fila["HR"]),
    fr: numero(fila["RR"]),
    temperatura: numero(fila["BT"]),
    saturacion: numero(fila["Saturation"]),
    nivel: numero(fila["KTAS_expert"]) ?? undefined,
  }
}

export function leerCsv(ruta: string): CasoTriage[] {
  // El CSV de Kaggle viene en latin-1, separado por ";"
  const lineas = fs.readFileSync(ruta, "latin1").split(/\r?\n/).filter((l) => l.trim())
  const columnas = lineas[0].split(";")
  return (
    lineas
      .slice(1)
      .map((linea, i) => {
        const valores = linea.split(";")
        const fila: Record<string, string> = {}
        columnas.forEach((c, j) => (fila[c] = valores[j] ?? ""))
        return filaACaso(fila, i)
      })
      // 21 filas tienen el motivo como "???" (era texto en coreano que se perdió
      // en el CSV). Sin motivo el caso no sirve para buscar parecidos.
      .filter((c) => !/^[?\s]*$/.test(c.motivo))
  )
}

// Generador pseudoaleatorio con semilla (mulberry32), para que el split
// sea siempre el mismo y los resultados se puedan reproducir.
function aleatorio(semilla: number) {
  return () => {
    semilla |= 0
    semilla = (semilla + 0x6d2b79f5) | 0
    let t = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Split estratificado: cada nivel KTAS mantiene la misma proporción en train y test
export function dividirTrainTest(casos: CasoTriage[]) {
  const azar = aleatorio(SEMILLA)
  const mezclar = (lista: CasoTriage[]) => {
    for (let i = lista.length - 1; i > 0; i--) {
      const j = Math.floor(azar() * (i + 1))
      ;[lista[i], lista[j]] = [lista[j], lista[i]]
    }
    return lista
  }
  const train: CasoTriage[] = []
  const test: CasoTriage[] = []
  for (const nivel of [1, 2, 3, 4, 5]) {
    const grupo = mezclar(casos.filter((c) => c.nivel === nivel))
    const nTest = Math.round(grupo.length * PORCENTAJE_TEST)
    test.push(...grupo.slice(0, nTest))
    train.push(...grupo.slice(nTest))
  }
  // Se mezcla al final para que tomar "los primeros N" del test no traiga un solo nivel
  return { train: mezclar(train), test: mezclar(test) }
}

function valor(n: number | null, unidad: string) {
  return n === null ? "no registrado" : `${n} ${unidad}`
}

// Texto del caso: es lo que se convierte en embedding y lo que ve el LLM.
// Los datos faltantes se escriben como "no registrado", nunca se inventan.
export function textoDelCaso(c: CasoTriage): string {
  const sexo = c.sexo === "F" ? "femenino" : c.sexo === "M" ? "masculino" : "no registrado"
  const trauma = c.trauma === null ? "no registrado" : c.trauma ? "sí" : "no"
  const ta = c.tas !== null && c.tad !== null ? `${c.tas}/${c.tad} mmHg` : "no registrado"
  const dolor = c.dolor === null ? "no registrado" : `${c.dolor}/10`
  return [
    `Motivo de consulta: ${c.motivo}`,
    `Edad: ${valor(c.edad, "años")}. Sexo: ${sexo}. Trauma: ${trauma}.`,
    `Estado mental: ${c.estadoMental ?? "no registrado"}. Dolor: ${dolor}.`,
    `TA: ${ta}. FC: ${valor(c.fc, "lpm")}. FR: ${valor(c.fr, "rpm")}.`,
    `Temperatura: ${valor(c.temperatura, "°C")}. SatO2: ${valor(c.saturacion, "%")}.`,
  ].join("\n")
}

export function leerJson(ruta: string): CasoTriage[] {
  return JSON.parse(fs.readFileSync(ruta, "utf8"))
}
