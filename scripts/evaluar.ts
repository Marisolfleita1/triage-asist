// Etapa 6: evalúa el RAG sobre el test (casos que NO están indexados).
// Requiere Chroma corriendo (npm run chroma) y la base ya indexada.
// Uso: npm run rag:evaluar -- [cantidad de casos, por defecto todos]
import fs from "fs"
import path from "path"
import { RUTA_TEST } from "@/lib/rag/config"
import { leerJson } from "@/lib/rag/preparar"
import { buscarSimilares, clasificarCaso } from "@/lib/rag/clasificar"
import { calcularMetricas, imprimirMetricas } from "@/lib/rag/evaluar"

async function main() {
  const limite = Number(process.argv[2]) || undefined
  const test = leerJson(RUTA_TEST).slice(0, limite)
  const reales: number[] = []
  const predichosRag: number[] = []
  const predichosVoto: number[] = []
  const detalle = []
  const inicio = Date.now()

  for (let i = 0; i < test.length; i++) {
    const caso = test[i]
    const similares = await buscarSimilares(caso)
    const votos = [1, 2, 3, 4, 5].map((n) => similares.filter((s) => s.nivel === n).length)
    const voto = votos.indexOf(Math.max(...votos)) + 1
    const r = await clasificarCaso(caso)

    reales.push(caso.nivel!)
    predichosRag.push(r.nivel)
    predichosVoto.push(voto)
    detalle.push({ id: caso.id, motivo: caso.motivo, real: caso.nivel, voto, ...r })
    console.log(
      `[${i + 1}/${test.length}] real ${caso.nivel} - RAG ${r.nivel} - voto ${voto} - ${caso.motivo}`
    )
  }

  imprimirMetricas("Solo voto de los casos parecidos (sin LLM)", calcularMetricas(reales, predichosVoto))
  const metricas = calcularMetricas(reales, predichosRag)
  imprimirMetricas("RAG (casos parecidos + gemma2)", metricas)
  console.log(`\nTiempo total: ${((Date.now() - inicio) / 60000).toFixed(1)} min`)

  const salida = path.join(process.cwd(), "data", "ktas", `resultados-${test.length}.json`)
  fs.writeFileSync(salida, JSON.stringify({ metricas, detalle }, null, 2))
  console.log(`Detalle guardado en ${salida}`)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
