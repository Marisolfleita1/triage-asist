// Etapa 4: clasifica un caso del test por consola y muestra los casos parecidos
// que se recuperaron de Chroma.
// Uso: npm run rag:clasificar -- [número de caso del test, por defecto 0]
import { RUTA_TEST } from "@/lib/rag/config"
import { leerJson, textoDelCaso } from "@/lib/rag/preparar"
import { buscarSimilares, clasificarCaso } from "@/lib/rag/clasificar"

async function main() {
  const caso = leerJson(RUTA_TEST)[Number(process.argv[2]) || 0]
  console.log("Caso a clasificar:\n" + textoDelCaso(caso))
  console.log(`(nivel real KTAS_expert: ${caso.nivel})\n`)

  const similares = await buscarSimilares(caso)
  console.log("Casos parecidos recuperados:")
  similares.forEach((s) => console.log(`  KTAS ${s.nivel} | ${s.texto.split("\n")[0]}`))

  const inicio = Date.now()
  const resultado = await clasificarCaso(caso)
  console.log(`\nResultado (${((Date.now() - inicio) / 1000).toFixed(1)} s):`)
  console.log(JSON.stringify(resultado, null, 2))
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
