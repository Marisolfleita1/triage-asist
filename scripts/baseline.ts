// Etapa 2: baselines para tener contra qué comparar el RAG
//   a) clase mayoritaria: siempre predice el nivel más frecuente del train
//   b) LLM sin RAG (zero-shot): gemma2 con las mismas instrucciones pero sin casos parecidos
// Uso: npm run rag:baseline -- [cantidad de casos del test, por defecto todos]
import { RUTA_TEST, RUTA_TRAIN } from "@/lib/rag/config"
import { leerJson } from "@/lib/rag/preparar"
import { clasificarCaso } from "@/lib/rag/clasificar"
import { calcularMetricas, imprimirMetricas } from "@/lib/rag/evaluar"

async function main() {
  const train = leerJson(RUTA_TRAIN)
  const limite = Number(process.argv[2]) || undefined
  const test = leerJson(RUTA_TEST).slice(0, limite)
  const reales = test.map((c) => c.nivel!)

  const conteo = [1, 2, 3, 4, 5].map((n) => train.filter((c) => c.nivel === n).length)
  const mayoritaria = conteo.indexOf(Math.max(...conteo)) + 1
  imprimirMetricas(
    `Baseline clase mayoritaria (siempre KTAS ${mayoritaria})`,
    calcularMetricas(reales, reales.map(() => mayoritaria))
  )

  const predichos: number[] = []
  for (let i = 0; i < test.length; i++) {
    const caso = test[i]
    const r = await clasificarCaso(caso, { usarRag: false })
    predichos.push(r.nivel)
    console.log(`[${i + 1}/${test.length}] real ${caso.nivel} - predicho ${r.nivel} - ${caso.motivo}`)
  }
  imprimirMetricas("Baseline LLM sin RAG (zero-shot)", calcularMetricas(reales, predichos))
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
