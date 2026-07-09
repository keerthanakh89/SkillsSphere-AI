# RAG Vector Database Setup Guide

This guide explains how to properly format, ingest, and manage your Retrieval-Augmented Generation (RAG) knowledge base for the AI Mock Interview system.

## 🧠 What is RAG in SkillSphere AI?

SkillSphere's AI Mock Interview engine uses RAG to fetch contextually relevant, highly accurate documentation when evaluating answers or generating specialized questions. By seeding the database with custom `.md` files, you can extend the AI's knowledge beyond its base training data, providing up-to-date and tailored feedback to students.

---

## 📂 1. Knowledge Base Folder Structure

To ensure topic-specific isolation (so React questions don't accidentally retrieve Python answers), you **must** structure your knowledge base logically inside the `interview-ai-service/knowledge/` directory.

### Example Structure:
```text
interview-ai-service/
└── knowledge/
    ├── react/
    │   ├── components.md
    │   ├── hooks.md
    │   └── virtual_dom.md
    ├── nodejs/
    │   ├── event_loop.md
    │   └── streams.md
    └── system_design/
        ├── load_balancing.md
        └── caching.md
```

**Rules:**
1. The `knowledge/` folder MUST be at the root of the `interview-ai-service`.
2. Each topic MUST have its own dedicated subdirectory (e.g., `react/`, `nodejs/`). This folder name acts as the exact metadata label used for filtering.
3. All documentation files MUST use the `.md` extension.

---

## 📝 2. Formatting Your Markdown Files

The ingestion script (`rag/ingestion.py`) automatically parses and chunks Markdown files. For the best retrieval performance, adhere to these formatting guidelines:

### Use Clear Heading Hierarchies
The chunker respects markdown headers (`#`, `##`, `###`). Structure your documents so that each header encapsulates a single, clear concept.

```markdown
## The Virtual DOM

The Virtual DOM is a lightweight JavaScript representation of the actual DOM. It allows React to perform efficient updates...

### Reconciliation Process

Reconciliation is the process by which React compares the new Virtual DOM with the old one (Diffing) and determines the minimal set of changes...
```

### Keep Paragraphs Focused
Avoid massive walls of text. Smaller, focused paragraphs ensure that the embedding model (`BAAI/bge-small-en-v1.5`) captures the semantic meaning of that specific concept accurately.

---

## 🚀 3. Seeding the Qdrant Database

Once your knowledge folders are populated, you must ingest them into your Qdrant vector database.

### Prerequisites:
- Ensure your Docker containers are running (specifically the `qdrant` container).
  ```bash
  docker-compose up -d
  ```

### Running the Ingestion Script:

**Option A: Using Docker (Recommended)**
Run the ingestion script directly inside the AI service container:
```bash
docker-compose exec interview-ai-service python rag/ingestion.py
```

**Option B: Running Locally (Without Docker)**
If you are developing the Python service locally on your host machine:
```bash
cd interview-ai-service
# Ensure your virtual environment is activated
source venv/bin/activate
python rag/ingestion.py
```

### What Happens During Ingestion?
1. **Reading**: The script dynamically discovers all topic subdirectories in `knowledge/`.
2. **Chunking**: Markdown files are parsed and split into logical chunks.
3. **Embedding**: Text chunks are passed through the `BAAI/bge-small-en-v1.5` sentence-transformer model to generate `384-dimensional` vector embeddings.
4. **Upserting**: Embeddings and payload metadata (including the `topic`) are pushed into the `skillssphere_docs` collection in Qdrant.

---

## 🛠️ 4. Verification & Troubleshooting

### Check Qdrant Dashboard
If you're running the standard `docker-compose` setup, you can typically access the Qdrant Web UI at:
- **http://localhost:6333/dashboard**

### Common Issues

**No topic directories found in `knowledge`:**
Ensure you created subdirectories inside `knowledge/`. The script ignores files placed directly in the `knowledge/` root.

**Vector mismatch error:**
If you change the embedding model dimensions in the future, you must delete the existing Qdrant collection and re-ingest. The collection is configured tightly to `384` dimensions for `bge-small-en-v1.5`.

**Service Timeout during Ingestion:**
If you are processing hundreds of large Markdown files at once on a slower CPU, the ingestion may take some time. Wait for the terminal to output:
`Ingestion complete. Total chunks processed: [X]`
