# TriageAsist — RAG para triage en guardia

Asistente de apoyo a la clasificación de triage. A partir de los síntomas, la edad y
los signos vitales del paciente, sugiere un nivel de urgencia de 1 (más grave) a 5
(menos grave). Para eso busca ejemplos parecidos ya clasificados y se los pasa a
`gemma2` como referencia (RAG). **Es una sugerencia para el profesional, no un
diagnóstico.**

La edad decide qué base se usa:

| Paciente | Base | Escala |
|---|---|---|
| 16 años o más | Casos reales del dataset KTAS de Kaggle, clasificados por expertos | KTAS |
| Menores de 16 | Ejemplos armados a partir del protocolo CTAS | CTAS |

Las dos bases están en colecciones separadas de Chroma y nunca se mezclan. Sin edad
no se clasifica.

### Cómo funciona

**Preparación (una sola vez, con scripts):**

```text
16 años o más:  data/ktas/data.csv → limpieza → train (996) / test (250)
                train → embeddings → Chroma (ktas_casos)
                test  → no se indexa, se usa para evaluar

Menores de 16:  data/pediatria/qa_pediatria_ctas.csv → embeddings → Chroma (ctas_pediatria)
```

**Cada consulta:**

1. El profesional busca al paciente por DNI (si no está, carga edad, sexo y
   antecedentes a mano) y escribe los síntomas. Los signos vitales son opcionales:
   lo que no se midió se envía como "no registrado".
2. El frontend llama a `POST /api/clasificar`, que mira la edad y elige la ruta:
   - **16 años o más:** `gemma2` resume los síntomas a un motivo de consulta en
     inglés (el dataset está en inglés). Se busca con ese motivo, la edad, el sexo y
     los signos vitales, y se recuperan los 5 casos más parecidos de `ktas_casos`.
   - **Menores de 16:** se busca con los síntomas en español y se recuperan 5 reglas
     distintas de `ctas_pediatria` (una pregunta por regla).
3. Se arma el prompt con las instrucciones de la escala, los ejemplos recuperados y
   los datos del paciente. `gemma2` responde en JSON y el backend lo valida.
4. La pantalla muestra el nivel, el tiempo de espera, la justificación y los signos de
   alarma. En menores agrega "Basado en ejemplos del protocolo CTAS".

Los embeddings se generan con `nomic-embed-text`. Ambos modelos corren en local con
Ollama.

### Endpoints

| Endpoint | Qué hace |
|---|---|
| `GET /api/pacientes/[dni]` | Busca un paciente de prueba. Responde `{ encontrado, paciente }` |
| `POST /api/clasificar` | Clasifica al paciente. Responde `{ nivel, justificacion, signos_de_alarma, confianza, fuente }` |

`fuente` es `"ktas"` o `"ctas"` según la base usada. `confianza` es la proporción de
ejemplos recuperados que tienen el mismo nivel que eligió el modelo (ej: 4 de 5 =
0,8). No se muestra en pantalla porque no indica la probabilidad de acierto.

Errores: 400 si faltan los síntomas o la edad, 503 si Ollama o Chroma no responden
(el mensaje dice qué levantar) y 500 ante otros errores.

### Estructura

| Archivo | Qué hace |
|---|---|
| `public/` | Frontend (HTML + CSS + JS): login, ingreso y resultado |
| `app/api/pacientes/[dni]/route.ts` | Endpoint de búsqueda por DNI |
| `app/api/clasificar/route.ts` | Endpoint de clasificación: valida y elige la ruta según la edad |
| `app/page.tsx` | Redirige a `/index.html` |
| `lib/pacientes.ts` | Pacientes de prueba |
| `lib/rag/config.ts` | Rutas, modelos, k, edad de corte y timeouts |
| `lib/rag/servicios.ts` | Conexión a Ollama y Chroma, con errores claros si no están |
| `lib/rag/preparar.ts` | Lee y limpia el CSV de Kaggle, split train/test, texto de cada caso |
| `lib/rag/indexar.ts` | Embeddings de los casos de Kaggle y carga en Chroma |
| `lib/rag/clasificar.ts` | Ruta de 16 años o más, y la llamada a `gemma2` que usan las dos rutas |
| `lib/rag/pediatria.ts` | Ruta de menores de 16: lectura, indexación, búsqueda y prompt CTAS |
| `lib/rag/evaluar.ts` | Métricas: accuracy, F1 macro, kappa ponderado, sub y sobre-triage |
| `scripts/*.ts` | Scripts de consola de cada etapa |
| `data/` | Datasets, train/test, resultados y base de Chroma |

### Datos

**`data/ktas/data.csv`:** dataset de Kaggle *Emergency Service - Triage Application*.

- Etiqueta: `KTAS_expert`.
- Se usan solo datos disponibles al momento del triage: edad, sexo, motivo,
  trauma, estado mental, dolor (NRS), TA, FC, FR, temperatura, SatO2.
- Se excluyen `KTAS_RN`, diagnóstico, disposición, `mistriage` y tiempos de
  estadía porque son posteriores al triage (fuga de información).
- Valores `??`, `#BOÞ!` o vacíos se guardan como "no registrado" (nunca se
  inventan). Se descartan 21 filas con el motivo ilegible (`???`).
- Split 80/20 estratificado por nivel, semilla fija. **Solo el train se indexa.**

**`data/pediatria/qa_pediatria_ctas.csv`:** 218 preguntas y respuestas (109 reglas,
dos formas de preguntar cada una) armadas a partir del *CTAS Interactive Quick Look
Booklet 2023* (Shared Health Manitoba). El PDF tiene copyright y no se sube al
repositorio.

Estos ejemplos son sintéticos: los niveles salen del protocolo, pero no los clasificó
ni validó un profesional, y no hay casos reales de menores para evaluarlos. Las edades
de la ficha están en años: si importan los días o meses (por ejemplo, en un bebé),
hay que escribirlos en los síntomas.

### Requisitos

- Node 18+ y `npm install`
- [Ollama](https://ollama.com/) con los modelos:
  ```bash
  ollama pull gemma2
  ollama pull nomic-embed-text
  ```
- Python 3 con Chroma (servidor de la base vectorial):
  ```bash
  pip install chromadb
  ```

### Cómo correrlo

Se necesitan dos terminales abiertas además de Ollama:

```bash
# Terminal 1: base vectorial (guarda los datos en data/chroma/)
npm run chroma

# Terminal 2: solo la primera vez (o si cambian los datos)
npm run rag:preparar            # limpia el CSV y genera data/ktas/train.json y test.json
npm run rag:indexar             # embeddings del train -> Chroma (~6 min en CPU)
npm run rag:indexar-pediatria   # embeddings de los ejemplos CTAS -> Chroma

# Terminal 2: backend + frontend
npm run dev                     # http://localhost:3000  (usuario admin / 1234)
```

Pacientes de prueba: DNI `40555666` (8 años, ruta CTAS) y `28904771` (67 años, ruta
KTAS). Con otro DNI se cargan los datos a mano.

El backend solo **lee** la base de Chroma ya creada.

### Scripts de consola y evaluación

```bash
npm run rag:clasificar -- 7          # clasifica el caso 7 del test y muestra los vecinos
npm run rag:baseline -- 10           # baselines: clase mayoritaria y LLM sin RAG
npm run rag:evaluar -- 10            # evalúa el RAG con 10 casos del test
npm run rag:evaluar                  # evaluación completa (250 casos)
npm run rag:probar-pediatria -- 10   # prueba de funcionamiento de los ejemplos CTAS
```

La evaluación guarda cada predicción en `data/ktas/resultados-<n>.json`, donde `<n>`
es la cantidad de casos evaluados. En CPU cada caso tarda ~1 minuto, así que la
evaluación completa lleva varias horas.

`rag:probar-pediatria` indexa una pregunta de cada regla en una colección temporal,
consulta con la otra y después la borra. Comprueba que la ruta funciona, pero no mide
precisión clínica.

### Limitaciones

- Por ahora la evaluación se corrió con 10 casos por ruta, que no alcanzan para
  sacar conclusiones.
- El CSV pediátrico no cubre todos los motivos del protocolo (por ejemplo, paro
  respiratorio o cardíaco).
- El login (`admin / 1234`) y los pacientes son de prueba, y "Enviar a Triage" no
  guarda ni envía datos.
