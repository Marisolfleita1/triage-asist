import { Ollama } from "ollama"
import { ChromaClient } from "chromadb"
import {
  CHROMA_HOST,
  CHROMA_PORT,
  COLECCION,
  COLECCION_PEDIATRIA,
  MODELO_EMBEDDINGS,
  OLLAMA_HOST,
  TIMEOUT_OLLAMA_MS,
} from "./config"

// Error que el endpoint traduce a un 503 con un mensaje claro
export class ServicioNoDisponible extends Error {}

// fetch con timeout, para que una request a Ollama nunca quede colgada
const fetchConTimeout: typeof fetch = (url, init) =>
  fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_OLLAMA_MS) })

export const ollama = new Ollama({ host: OLLAMA_HOST, fetch: fetchConTimeout })

// Ejecuta una llamada a Ollama y convierte los errores de conexión/timeout
// en ServicioNoDisponible
export async function conOllama<T>(llamada: () => Promise<T>): Promise<T> {
  try {
    return await llamada()
  } catch (err: any) {
    if (err?.name === "TimeoutError") {
      throw new ServicioNoDisponible("Ollama tardó demasiado en responder. Probá de nuevo.")
    }
    if (err?.cause?.code === "ECONNREFUSED" || err?.message === "fetch failed") {
      throw new ServicioNoDisponible(
        "No se pudo conectar con Ollama. Verificá que esté corriendo (ollama serve)."
      )
    }
    throw err
  }
}

// nomic-embed-text recomienda prefijos distintos para documentos y consultas
export async function embeddings(textos: string[], tipo: "documento" | "consulta") {
  const prefijo = tipo === "documento" ? "search_document: " : "search_query: "
  const res = await conOllama(() =>
    ollama.embed({ model: MODELO_EMBEDDINGS, input: textos.map((t) => prefijo + t) })
  )
  return res.embeddings
}

const chroma = new ChromaClient({ host: CHROMA_HOST, port: CHROMA_PORT })

// La colección se crea en el script de indexación; acá solo se abre
export async function abrirColeccion(nombre = COLECCION) {
  try {
    return await chroma.getCollection({ name: nombre, embeddingFunction: undefined })
  } catch (err: any) {
    if (err?.name === "ChromaNotFoundError") {
      const comando = nombre === COLECCION_PEDIATRIA ? "rag:indexar-pediatria" : "rag:indexar"
      throw new ServicioNoDisponible(
        `La base "${nombre}" no está indexada. Corré primero: npm run ${comando}`
      )
    }
    throw new ServicioNoDisponible(
      "No se pudo conectar con Chroma. Verificá que esté corriendo (npm run chroma)."
    )
  }
}

export async function borrarColeccion(nombre: string) {
  await chroma.deleteCollection({ name: nombre }).catch(() => {})
}

export async function recrearColeccion(nombre = COLECCION) {
  await borrarColeccion(nombre)
  return chroma.createCollection({
    name: nombre,
    embeddingFunction: null,
    configuration: { hnsw: { space: "cosine" } },
  })
}
