import re
import json
import math
import logging
import hashlib
from typing import List, Dict, Any, Optional, Union
import numpy as np
from sqlalchemy.orm import Session

from app.config import settings
from app.models.activity import Activity
from app.models.project import Project

logger = logging.getLogger("embedding_service")

# Global singleton cache for the SentenceTransformer model
_model_instance = None
EMBEDDING_DIM = 384

def get_sentence_transformer_model():
    """
    Lazy loader for SentenceTransformer model.
    Caches the instance in memory for fast repeated inference.
    """
    global _model_instance
    if _model_instance is not None:
        return _model_instance

    try:
        from sentence_transformers import SentenceTransformer
        model_name = settings.EMBEDDING_MODEL_NAME or "all-MiniLM-L6-v2"
        logger.info(f"Loading SentenceTransformer model: {model_name}...")
        _model_instance = SentenceTransformer(model_name)
        logger.info("SentenceTransformer model loaded successfully.")
        return _model_instance
    except Exception as e:
        logger.warning(f"Could not load SentenceTransformer ({str(e)}). Using dense deterministic fallback.")
        return None

def _dense_fallback_embedding(text: str, dim: int = EMBEDDING_DIM) -> List[float]:
    """
    Deterministic 384-dimensional dense semantic feature projection fallback.
    Used when torch / SentenceTransformer is downloading or offline.
    Uses multi-scale token, subword n-gram, and phrase hashing with L2 normalization.
    """
    cleaned = re.sub(r'[^\w\s\-]', ' ', text.lower()).strip()
    tokens = [t for t in cleaned.split() if t]
    if not tokens:
        return [0.0] * dim
    
    vec = np.zeros(dim, dtype=np.float32)
    
    # 1. Token hashing with length weighting
    for token in tokens:
        h = int(hashlib.sha256(token.encode('utf-8')).hexdigest(), 16)
        idx = h % dim
        sign = 1.0 if ((h >> 8) % 2 == 0) else -1.0
        weight = 3.0 + len(token) * 0.3
        vec[idx] += sign * weight

        # 2. Character subword n-grams (3 to 6 chars) for morphological similarity
        for n in range(3, min(7, len(token) + 1)):
            for i in range(len(token) - n + 1):
                sub = token[i:i+n]
                sub_h = int(hashlib.sha256(sub.encode('utf-8')).hexdigest(), 16)
                sub_idx = sub_h % dim
                sub_sign = 1.0 if ((sub_h >> 8) % 2 == 0) else -1.0
                vec[sub_idx] += sub_sign * 1.0

    # 3. Bigram token hashing for phrase semantics
    for i in range(len(tokens) - 1):
        bigram = f"{tokens[i]}_{tokens[i+1]}"
        h = int(hashlib.sha256(bigram.encode('utf-8')).hexdigest(), 16)
        idx = h % dim
        sign = 1.0 if ((h >> 8) % 2 == 0) else -1.0
        vec[idx] += sign * 4.0

    norm = np.linalg.norm(vec)
    if norm > 0:
        vec = vec / norm
    else:
        vec[0] = 1.0

    return [round(float(x), 6) for x in vec]

def generate_embedding(text: str) -> List[float]:
    """
    Generates a 384-dimensional dense embedding vector for a given text.
    L2-normalized for fast dot-product cosine similarity.
    """
    if not text or not text.strip():
        return [0.0] * EMBEDDING_DIM

    model = get_sentence_transformer_model()
    if model is not None:
        try:
            emb = model.encode(text.strip(), normalize_embeddings=True)
            return [round(float(x), 6) for x in emb]
        except Exception as e:
            logger.warning(f"Error encoding with SentenceTransformer: {str(e)}. Using fallback.")
            return _dense_fallback_embedding(text)
    
    return _dense_fallback_embedding(text)

def generate_embeddings_batch(texts: List[str]) -> List[List[float]]:
    """
    Batch generation of 384-dimensional embeddings for a list of texts.
    """
    if not texts:
        return []

    model = get_sentence_transformer_model()
    if model is not None:
        try:
            embeddings = model.encode(
                [t.strip() if t and t.strip() else " " for t in texts],
                batch_size=32,
                show_progress_bar=False,
                normalize_embeddings=True
            )
            return [[round(float(x), 6) for x in emb] for emb in embeddings]
        except Exception as e:
            logger.warning(f"Error batch encoding with SentenceTransformer: {str(e)}. Using fallback.")
            return [_dense_fallback_embedding(t) for t in texts]

    return [_dense_fallback_embedding(t) for t in texts]

def compute_cosine_similarity(vec_a: List[float], vec_b: List[float]) -> float:
    """
    Computes cosine similarity between two dense vectors.
    Since generated embeddings are L2-normalized, cosine similarity equals dot product.
    Returns a score clamped to [0.0, 1.0].
    """
    if not vec_a or not vec_b:
        return 0.0
    if len(vec_a) != len(vec_b):
        return 0.0

    dot = sum(a * b for a, b in zip(vec_a, vec_b))
    # Clamp between 0.0 and 1.0
    return max(0.0, min(1.0, float(dot)))

def search_top_k_activities(
    query_text: str,
    project_id: str,
    schedule_version: Optional[str] = None,
    top_k: int = 5,
    discipline_filter: Optional[str] = None,
    db: Optional[Session] = None
) -> List[Dict[str, Any]]:
    """
    Performs Top-K dense semantic similarity retrieval over ingested schedule activities.
    """
    if db is None:
        return []

    # 1. Generate query embedding
    query_embedding = generate_embedding(query_text)

    # 2. Query project activities from database
    query = db.query(Activity).filter(Activity.project_id == project_id)
    if schedule_version:
        query = query.filter(Activity.schedule_version == schedule_version)
    else:
        proj = db.query(Project).filter(Project.id == project_id).first()
        if proj and proj.active_schedule_version:
            query = query.filter(Activity.schedule_version == proj.active_schedule_version)

    if discipline_filter and discipline_filter != "ALL":
        query = query.filter(Activity.discipline == discipline_filter)

    activities = query.all()
    if not activities:
        return []

    # 3. Compute cosine similarity for each candidate activity
    scored_candidates = []
    for act in activities:
        act_embedding = None
        if act.embedding_json:
            try:
                act_embedding = json.loads(act.embedding_json)
            except Exception:
                act_embedding = None

        if not act_embedding:
            # Generate dynamically if not yet stored
            act_text = act.searchable_text or f"{act.activity_name} {act.discipline or ''} {act.location or ''}"
            act_embedding = generate_embedding(act_text)
            act.embedding_json = json.dumps(act_embedding)

        similarity = compute_cosine_similarity(query_embedding, act_embedding)

        scored_candidates.append({
            "activity_id": act.activity_id,
            "id": act.id,
            "activity_name": act.activity_name,
            "discipline": act.discipline,
            "location": act.location,
            "asset_id": act.asset_id,
            "line_id": act.line_id,
            "wbs_name": act.wbs_name,
            "wbs_code": act.wbs_code,
            "level": act.level,
            "planned_start": act.planned_start.isoformat() if act.planned_start else None,
            "planned_finish": act.planned_finish.isoformat() if act.planned_finish else None,
            "planned_progress": act.planned_progress,
            "semantic_score": round(similarity, 4),
            "searchable_text": act.searchable_text
        })

    # 4. Sort descending by semantic score and return Top-K
    scored_candidates.sort(key=lambda x: x["semantic_score"], reverse=True)
    top_candidates = scored_candidates[:top_k]

    # Assign ranks
    for rank, cand in enumerate(top_candidates, 1):
        cand["rank"] = rank

    return top_candidates
