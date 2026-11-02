// Etapa 1: lee el CSV de KTAS, lo limpia y genera train.json / test.json
// Uso: npm run rag:preparar
import fs from "fs"
import { RUTA_CSV, RUTA_TEST, RUTA_TRAIN } from "@/lib/rag/config"
import { dividirTrainTest, leerCsv, textoDelCaso } from "@/lib/rag/preparar"

const casos = leerCsv(RUTA_CSV)
const { train, test } = dividirTrainTest(casos)

fs.writeFileSync(RUTA_TRAIN, JSON.stringify(train, null, 2))
fs.writeFileSync(RUTA_TEST, JSON.stringify(test, null, 2))

const contar = (lista: typeof casos) =>
  [1, 2, 3, 4, 5].map((n) => `${n}: ${lista.filter((c) => c.nivel === n).length}`).join("  ")

const campos = ["edad", "dolor", "tas", "fc", "fr", "temperatura", "saturacion"] as const
console.log(`Casos leídos: ${casos.length}`)
console.log("Faltantes por campo:")
for (const campo of campos) {
  console.log(`  ${campo}: ${casos.filter((c) => c[campo] === null).length}`)
}
console.log(`Train (${train.length}) -> ${contar(train)}`)
console.log(`Test  (${test.length}) -> ${contar(test)}`)
console.log("\nEjemplo de texto indexado:\n" + textoDelCaso(train[0]))
