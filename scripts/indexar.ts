// Etapa 3: genera los embeddings de los casos de train y los guarda en Chroma.
// Requiere Chroma corriendo (npm run chroma) y Ollama con nomic-embed-text.
// Uso: npm run rag:indexar
import { RUTA_TRAIN } from "@/lib/rag/config"
import { leerJson } from "@/lib/rag/preparar"
import { indexarCasos } from "@/lib/rag/indexar"

async function main() {
  const train = leerJson(RUTA_TRAIN)
  console.log(`Indexando ${train.length} casos de train...`)
  const total = await indexarCasos(train, (hechos) => console.log(`  ${hechos}/${train.length}`))
  console.log(`Listo: la colección tiene ${total} casos.`)
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
