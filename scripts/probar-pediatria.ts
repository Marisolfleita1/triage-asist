// Prueba de funcionamiento de los ejemplos pediátricos: indexa la primera pregunta de cada
// regla en una colección temporal y consulta con la segunda. NO es precisión clínica:
// las preguntas salen del mismo protocolo y no hay casos reales de menores.
// Requiere Chroma corriendo (npm run chroma).
// Uso: npm run rag:probar-pediatria -- [cantidad de casos con gemma2, por defecto 10]
import { RUTA_PEDIATRIA } from "@/lib/rag/config"
import { buscarEjemplos, clasificarPediatrico, indexarEjemplos, leerEjemplos } from "@/lib/rag/pediatria"
import { calcularMetricas, imprimirMetricas } from "@/lib/rag/evaluar"
import { borrarColeccion } from "@/lib/rag/servicios"

const COLECCION_PRUEBA = "ctas_pediatria_prueba"

async function main() {
  const cantidad = Number(process.argv[2]) || 10
  const ejemplos = leerEjemplos(RUTA_PEDIATRIA)
  const indexados = ejemplos.filter((e) => e.id.endsWith("-1"))
  const consultas = ejemplos.filter((e) => e.id.endsWith("-2"))
  await indexarEjemplos(indexados, COLECCION_PRUEBA)

  try {
    let primera = 0
    let entreLasCinco = 0
    for (const c of consultas) {
      const encontrados = await buscarEjemplos(c.pregunta, COLECCION_PRUEBA)
      if (encontrados[0]?.regla === c.regla) primera++
      if (encontrados.some((e) => e.regla === c.regla)) entreLasCinco++
    }
    console.log(`Búsqueda (${consultas.length} consultas):`)
    console.log(`  Regla correcta en primer lugar: ${primera}`)
    console.log(`  Regla correcta entre las 5 primeras: ${entreLasCinco}`)

    // Toma casos repartidos en todo el CSV, que está ordenado por tema
    const salto = Math.max(1, Math.floor(consultas.length / cantidad))
    const muestra = consultas.filter((_, i) => i % salto === 0).slice(0, cantidad)
    const reales: number[] = []
    const predichos: number[] = []
    for (let i = 0; i < muestra.length; i++) {
      const c = muestra[i]
      const r = await clasificarPediatrico(
        {
          id: c.id,
          edad: null,
          sexo: null,
          motivo: c.pregunta,
          trauma: null,
          estadoMental: null,
          dolor: null,
          tas: null,
          tad: null,
          fc: null,
          fr: null,
          temperatura: null,
          saturacion: null,
        },
        { coleccion: COLECCION_PRUEBA }
      )
      reales.push(c.nivel)
      predichos.push(r.nivel)
      console.log(`[${i + 1}/${muestra.length}] esperado ${c.nivel} - RAG ${r.nivel} - ${c.pregunta}`)
    }
    imprimirMetricas("Ejemplos CTAS + gemma2 (prueba de funcionamiento)", calcularMetricas(reales, predichos))
  } finally {
    await borrarColeccion(COLECCION_PRUEBA)
  }
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
