// Métricas para comparar el nivel real (KTAS_expert) con el predicho
const NIVELES = [1, 2, 3, 4, 5]

export interface Metricas {
  n: number
  accuracy: number
  f1Macro: number
  kappaPonderado: number
  subTriage: number // predijo MENOS grave que el real (el error peligroso)
  sobreTriage: number // predijo MÁS grave que el real
  matriz: number[][] // filas = real, columnas = predicho
}

export function calcularMetricas(reales: number[], predichos: number[]): Metricas {
  const n = reales.length
  const matriz = NIVELES.map(() => NIVELES.map(() => 0))
  reales.forEach((r, i) => matriz[r - 1][predichos[i] - 1]++)

  const aciertos = NIVELES.reduce((s, _, i) => s + matriz[i][i], 0)

  const f1s = NIVELES.map((_, i) => {
    const vp = matriz[i][i]
    const predTotal = matriz.reduce((s, fila) => s + fila[i], 0)
    const realTotal = matriz[i].reduce((s, v) => s + v, 0)
    const precision = predTotal ? vp / predTotal : 0
    const recall = realTotal ? vp / realTotal : 0
    return precision + recall ? (2 * precision * recall) / (precision + recall) : 0
  })

  // Kappa de Cohen con pesos cuadráticos: penaliza más los errores de varios niveles
  let observado = 0
  let esperado = 0
  NIVELES.forEach((_, i) => {
    const realTotal = matriz[i].reduce((s, v) => s + v, 0)
    NIVELES.forEach((_, j) => {
      const predTotal = matriz.reduce((s, fila) => s + fila[j], 0)
      const peso = (i - j) ** 2 / 16
      observado += peso * matriz[i][j]
      esperado += (peso * realTotal * predTotal) / n
    })
  })

  return {
    n,
    accuracy: aciertos / n,
    f1Macro: f1s.reduce((a, b) => a + b, 0) / NIVELES.length,
    kappaPonderado: esperado ? 1 - observado / esperado : 0,
    subTriage: predichos.filter((p, i) => p > reales[i]).length / n,
    sobreTriage: predichos.filter((p, i) => p < reales[i]).length / n,
    matriz,
  }
}

export function imprimirMetricas(titulo: string, m: Metricas) {
  const pct = (x: number) => (x * 100).toFixed(1) + "%"
  console.log(`\n=== ${titulo} (n = ${m.n}) ===`)
  console.log(`Accuracy:          ${pct(m.accuracy)}`)
  console.log(`F1 macro:          ${m.f1Macro.toFixed(3)}`)
  console.log(`Kappa ponderado:   ${m.kappaPonderado.toFixed(3)}`)
  console.log(`Sub-triage:        ${pct(m.subTriage)}  (más leve que el real)`)
  console.log(`Sobre-triage:      ${pct(m.sobreTriage)}  (más grave que el real)`)
  console.log("Matriz de confusión (filas = real, columnas = predicho):")
  console.log("        " + NIVELES.map((n) => `K${n}`.padStart(5)).join(""))
  m.matriz.forEach((fila, i) =>
    console.log(`  K${i + 1}   ` + fila.map((v) => String(v).padStart(5)).join(""))
  )
}
