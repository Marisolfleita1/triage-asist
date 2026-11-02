import { textoDelCaso, type CasoTriage } from "./preparar"
import { embeddings, recrearColeccion } from "./servicios"

const TAMANIO_LOTE = 50

// Borra la colección y la vuelve a crear con los casos de TRAIN.
// El test nunca se indexa: si no, la evaluación se "copiaría" la respuesta.
export async function indexarCasos(casos: CasoTriage[], alAvanzar?: (hechos: number) => void) {
  const coleccion = await recrearColeccion()
  for (let i = 0; i < casos.length; i += TAMANIO_LOTE) {
    const lote = casos.slice(i, i + TAMANIO_LOTE)
    const textos = lote.map(textoDelCaso)
    await coleccion.add({
      ids: lote.map((c) => c.id),
      documents: textos,
      embeddings: await embeddings(textos, "documento"),
      metadatas: lote.map((c) => ({ nivel: c.nivel ?? 0 })),
    })
    alAvanzar?.(i + lote.length)
  }
  return coleccion.count()
}
