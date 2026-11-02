import path from "path"

// Configuración del RAG de triage (KTAS). Todo en un solo lugar para no
// tener valores repetidos entre los scripts y el endpoint.
export const RUTA_CSV = path.join(process.cwd(), "data", "ktas", "data.csv")
export const RUTA_TRAIN = path.join(process.cwd(), "data", "ktas", "train.json")
export const RUTA_TEST = path.join(process.cwd(), "data", "ktas", "test.json")

export const PORCENTAJE_TEST = 0.2
export const SEMILLA = 42

export const OLLAMA_HOST = process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434"
export const MODELO_LLM = "gemma2"
export const MODELO_EMBEDDINGS = "nomic-embed-text"
// Si Ollama no responde en este tiempo se corta la request (no se cuelga)
export const TIMEOUT_OLLAMA_MS = 120_000

export const CHROMA_HOST = "localhost"
export const CHROMA_PORT = Number(process.env.CHROMA_PORT ?? 8000)
export const COLECCION = "ktas_casos"

// Cantidad de casos parecidos que se recuperan para cada consulta
export const K_VECINOS = 5

// Menores de esta edad usan los ejemplos del protocolo CTAS (el dataset KTAS
// solo tiene pacientes de 16 años o más)
export const EDAD_PEDIATRICA = 16
export const RUTA_PEDIATRIA = path.join(process.cwd(), "data", "pediatria", "qa_pediatria_ctas.csv")
export const COLECCION_PEDIATRIA = "ctas_pediatria"
