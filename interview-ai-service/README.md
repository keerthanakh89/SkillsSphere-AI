# Interview AI Service

Python AI microservice for the SkillsSphere AI Interview Engine. Handles speech-to-text transcription and answer evaluation using NLP and semantic similarity.

## Tech Stack

- **Python 3.10+**
- **FastAPI** — API framework
- **faster-whisper** — Speech-to-text (CTranslate2-based Whisper)
- **spaCy** — NLP for concept detection and communication analysis
- **sentence-transformers** — Semantic similarity scoring (all-MiniLM-L6-v2)

## Setup

### Knowledge Base Setup (RAG)

To seed the local Qdrant vector database with RAG content:

1. **Folder Structure**: Create a `knowledge/` directory in the `interview-ai-service` root folder. Inside `knowledge/`, create subdirectories for each topic (e.g., `knowledge/react/`, `knowledge/node/`).
2. **File Format**: Place Markdown (`.md`) files containing learning material or documentation into their respective topic folders.
3. **Chunking Rules**: The ingestion script (`rag/ingestion.py`) will automatically parse these Markdown files, chunk them based on headers and paragraphs, and attach the topic folder name as metadata to ensure topic-specific isolation during retrieval.
4. **Ingestion**: Once the Qdrant container is running, execute `python rag/ingestion.py` from the `interview-ai-service` directory to generate embeddings using the BAAI/bge-small-en-v1.5 model and store the chunks in Qdrant.

### API Setup


```bash
# Navigate to the service directory
cd interview-ai-service

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# venv\Scripts\activate   # Windows

# Install dependencies
pip install -r requirements.txt

# Download spaCy English model
python -m spacy download en_core_web_sm
```

> If you see `No module named spacy`, ensure your virtual environment is activated and re-run `pip install -r requirements.txt` (Windows: `venv\Scripts\activate`).

## Running

```bash
# Start the server (default port 8000)
python -m uvicorn main:app --reload --port 8000
```

The service will be available at `http://localhost:8000`.

## API Endpoints

### Health Check

```http
GET /health
Response: { "status": "ok", "service": "interview-ai-service" }
```

### Transcribe Audio

```http
POST /api/transcribe
Content-Type: multipart/form-data
Body: audio file (webm, wav, mp3, ogg, m4a)

Response:
{
  "transcript": "The virtual DOM is a lightweight..."
}
```

### Evaluate Answer

```http
POST /api/evaluate
Content-Type: application/json
Body:
{
  "transcript": "The virtual DOM is a lightweight copy of the real DOM...",
  "expectedAnswer": "The Virtual DOM is a JavaScript representation...",
  "expectedConcepts": ["virtual-dom", "reconciliation", "diffing"]
}

Response:
{
  "technical": 75,
  "communication": 82,
  "relevance": 68,
  "concepts": {
    "detected": ["virtual-dom", "diffing"],
    "missed": ["reconciliation"]
  },
  "details": {
    "semanticSimilarity": 0.78,
    "fillerWordCount": 2,
    "avgSentenceLength": 14.5,
    "vocabularyDiversity": 0.72,
    "wordCount": 85,
    "sentenceCount": 6
  }
}
```

## Services

| Service          | File                           | Purpose                                                                 |
| ---------------- | ------------------------------ | ----------------------------------------------------------------------- |
| Whisper STT      | `services/whisper_service.py`  | Transcribes audio files to text using faster-whisper                    |
| Semantic Scoring | `services/semantic_service.py` | Calculates cosine similarity between student answer and expected answer |
| NLP Analysis     | `services/nlp_service.py`      | Detects expected concepts in transcript using spaCy + keyword matching  |
| Communication    | `services/nlp_service.py`      | Analyzes filler words, sentence structure, vocabulary diversity         |

## Environment Variables

| Variable             | Default | Description                                                       |
| -------------------- | ------- | ----------------------------------------------------------------- |
| `WHISPER_MODEL_SIZE` | `base`  | Whisper model size: `tiny`, `base`, `small`, `medium`, `large-v3` |

Use `tiny` for fast development, `base` or `small` for production.

## Scoring Breakdown

| Score             | Weight              | How it's calculated                                                     |
| ----------------- | ------------------- | ----------------------------------------------------------------------- |
| **Technical**     | Semantic similarity | Cosine similarity between student answer and expected answer embeddings |
| **Communication** | NLP analysis        | Based on filler word count, sentence structure, vocabulary diversity    |
| **Relevance**     | Concept detection   | Percentage of expected concepts found in the student's answer           |

## Integration

The Node.js backend calls this service via HTTP. Configure the URL in the server `.env`:

```env
INTERVIEW_AI_URL=http://localhost:8000
INTERVIEW_AI_TIMEOUT=10000
INTERVIEW_AI_TRANSCRIBE_TIMEOUT=30000
```

When the Python service is unreachable, the Node backend falls back to mock scores automatically.

## Related

- Discussion: #237 (AI interview plan)
- Node.js integration: `server/src/integrations/aiInterviewService.js`
- Backend API: `server/src/modules/interviews/`
- Frontend UI: `client/src/modules/mock-interview/`
