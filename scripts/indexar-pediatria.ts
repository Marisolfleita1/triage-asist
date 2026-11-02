// Genera los embeddings de los ejemplos del protocolo CTAS (menores de 16) y los guarda en Chroma.
// Requiere Chroma corriendo (npm run chroma) y Ollama con nomic-embed-text.
// Uso: npm run rag:indexar-pediatria
import { COLECCION_PEDIATRIA, RUTA_PEDIATRIA } from "@/lib/rag/config"
import { indexarEjemplos, leerEjemplos } from "@/lib/rag/pediatria"

async function main() {
  const ejemplos = leerEjemplos(RUTA_PEDIATRIA)
  console.log(`Indexando ${ejemplos.length} ejemplos pediátricos...`)
  const total = await indexarEjemplos(ejemplos, COLECCION_PEDIATRIA, (hechos) =>
    console.log(`  ${hechos}/${ejemplos.length}`)
  )
  console.log(`Listo: la colección tiene ${total} ejemplos.`)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
