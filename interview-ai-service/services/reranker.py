import logging
import os
from sentence_transformers import CrossEncoder

logger = logging.getLogger("reranker")

# Global variables for the model
_reranker = None
MODEL_NAME = "BAAI/bge-reranker-base"

def _get_reranker():
    global _reranker
    if _reranker is None:
        try:
            logger.info(f"Loading reranker model {MODEL_NAME}...")
            # We use max_length=512 as standard for cross-encoder models
            _reranker = CrossEncoder(MODEL_NAME, max_length=512)
            logger.info(f"Reranker model {MODEL_NAME} loaded successfully.")
        except Exception as e:
            logger.error(f"Failed to load reranker {MODEL_NAME}: {e}")
            _reranker = "MOCK" # Fallback
    return _reranker

def rerank_results(query: str, documents: list, top_k: int = 5) -> list:
    """
    Takes a query and a list of candidate documents, scores them using a CrossEncoder,
    and returns the top_k most relevant documents.
    """
    if not documents:
        return []

    model = _get_reranker()
    
    if model == "MOCK":
        logger.warning("Reranker is not available. Returning original documents.")
        return documents[:top_k]

    try:
        # CrossEncoder expects pairs of (query, document)
        pairs = [[query, doc] for doc in documents]
        
        # Predict scores
        scores = model.predict(pairs)
        
        # Sort documents by score in descending order
        scored_docs = list(zip(scores, documents))
        scored_docs.sort(key=lambda x: x[0], reverse=True)
        
        # Return only the documents
        reranked_docs = [doc for score, doc in scored_docs]
        return reranked_docs[:top_k]
    except Exception as e:
        logger.error(f"Error during reranking: {e}")
        # In case of error, just return the original list
        return documents[:top_k]
