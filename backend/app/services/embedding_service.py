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
_torch_configured = False
EMBEDDING_DIM = 384

def _configure_torch_env():
    """
    Safely configure PyTorch runtime for CPU-only, low-memory inference on 512 MB instances.
    Prevents thread multiplication and unnecessary memory allocations.
    """
    global _torch_configured
    if not _torch_configured:
        try:
            import torch
            # Limit PyTorch CPU thread count to 1 to eliminate multi-thread memory overhead on multi-core host nodes
            torch.set_num_threads(1)
            try:
                torch.set_num_interop_threads(1)
            except Exception:
                pass
            # Disable autograd gradients for pure inference workload
            torch.set_grad_enabled(False)
            _torch_configured = True
        except Exception as e:
            logger.debug(f"Could not configure torch environment: {e}")

def get_sentence_transformer_model():
    """
    Lazy loader for SentenceTransformer model with CPU memory optimization.
    Caches the single instance in memory for fast repeated inference without
    allocating unnecessary threads or autograd graphs.
    """
    global _model_instance
    if _model_instance is not None:
        return _model_instance

    _configure_torch_env()

    try:
        import torch
        from sentence_transformers import SentenceTransformer
        model_name = settings.EMBEDDING_MODEL_NAME or "all-MiniLM-L6-v2"
        logger.info(f"Loading SentenceTransformer model ({model_name}) on CPU (memory-optimized)...")
        
        with torch.inference_mode():
            model = SentenceTransformer(model_name, device="cpu")
            model.eval()
        
        _model_instance = model
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
    Uses torch.inference_mode() and converts directly to numpy floats.
    """
    if not text or not text.strip():
        return [0.0] * EMBEDDING_DIM

    model = get_sentence_transformer_model()
    if model is not None:
        try:
            import torch
            with torch.inference_mode():
                emb = model.encode(
                    text.strip(),
                    normalize_embeddings=True,
                    convert_to_numpy=True,
                    show_progress_bar=False
                )
            return [round(float(x), 6) for x in emb]
        except Exception as e:
            logger.warning(f"Error encoding with SentenceTransformer: {str(e)}. Using fallback.")
            return _dense_fallback_embedding(text)
    
    return _dense_fallback_embedding(text)

def generate_embeddings_batch(texts: List[str], chunk_size: int = 16) -> List[List[float]]:
    """
    Batch generation of 384-dimensional embeddings for a list of texts in small,
    memory-efficient chunks to maintain low resident memory on 512 MB instances.
    """
    if not texts:
        return []

    model = get_sentence_transformer_model()
    if model is not None:
        try:
            import torch
            import gc
            results: List[List[float]] = []
            clean_texts = [t.strip() if t and t.strip() else " " for t in texts]
            
            # Process in small chunks to prevent peak memory spikes
            for i in range(0, len(clean_texts), chunk_size):
                chunk = clean_texts[i:i + chunk_size]
                with torch.inference_mode():
                    chunk_embs = model.encode(
                        chunk,
                        batch_size=len(chunk),
                        show_progress_bar=False,
                        normalize_embeddings=True,
                        convert_to_numpy=True
                    )
                for emb in chunk_embs:
                    results.append([round(float(x), 6) for x in emb])
                del chunk_embs

            # Perform garbage collection after processing substantial batches
            if len(texts) >= 30:
                gc.collect()

            return results
        except Exception as e:
            logger.warning(f"Error batch encoding with SentenceTransformer: {str(e)}. Using fallback.")
            return [_dense_fallback_embedding(t) for t in texts]

    return [_dense_fallback_embedding(t) for t in texts]

from app.database import is_postgresql

def compute_cosine_similarity(vec_a: Optional[Union[List[float], np.ndarray]], vec_b: Optional[Union[List[float], np.ndarray]]) -> float:
    """
    Computes cosine similarity between two dense vectors using NumPy.
    Since generated embeddings are L2-normalized, cosine similarity equals dot product.
    Returns a score clamped to [0.0, 1.0].
    """
    if vec_a is None or vec_b is None:
        return 0.0
    
    try:
        a = np.asarray(vec_a, dtype=np.float32)
        b = np.asarray(vec_b, dtype=np.float32)
        if a.shape != b.shape or a.size == 0:
            return 0.0
        
        dot = float(np.dot(a, b))
        return max(0.0, min(1.0, dot))
    except Exception:
        return 0.0

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
    Uses native PostgreSQL + pgvector vector distance as primary, with seamless SQLite + NumPy fallback.
    """
    if db is None:
        return []

    # 1. Generate query embedding
    query_embedding = generate_embedding(query_text)

    # 2. Determine target schedule version
    target_version = schedule_version
    if not target_version:
        proj = db.query(Project).filter(Project.id == project_id).first()
        if proj and proj.active_schedule_version:
            target_version = proj.active_schedule_version

    # 3. Primary: Native PostgreSQL + pgvector cosine distance search
    if is_postgresql():
        try:
            vec_query = db.query(
                Activity,
                Activity.embedding.cosine_distance(query_embedding).label("distance")
            ).filter(
                Activity.project_id == project_id,
                Activity.embedding.isnot(None)
            )
            if target_version:
                vec_query = vec_query.filter(Activity.schedule_version == target_version)
            if discipline_filter and discipline_filter != "ALL":
                vec_query = vec_query.filter(Activity.discipline == discipline_filter)

            results = vec_query.order_by("distance").limit(top_k).all()
            if results:
                scored_candidates = []
                for rank, (act, dist) in enumerate(results, 1):
                    sim = max(0.0, min(1.0, 1.0 - float(dist) if dist is not None else 0.0))
                    scored_candidates.append({
                        "rank": rank,
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
                        "semantic_score": round(sim, 4),
                        "searchable_text": act.searchable_text
                    })
                return scored_candidates
        except Exception as e:
            logger.warning(f"Native pgvector search failed ({str(e)}). Falling back to in-memory NumPy cosine similarity.")

    # 4. Fallback: SQLite + in-memory NumPy cosine similarity
    query = db.query(Activity).filter(Activity.project_id == project_id)
    if target_version:
        query = query.filter(Activity.schedule_version == target_version)

    if discipline_filter and discipline_filter != "ALL":
        query = query.filter(Activity.discipline == discipline_filter)

    activities = query.all()
    if not activities:
        return []

    scored_candidates = []
    for act in activities:
        act_embedding = None
        if act.embedding is not None:
            act_embedding = act.embedding if isinstance(act.embedding, (list, np.ndarray)) else list(act.embedding)
        elif act.embedding_json:
            try:
                act_embedding = json.loads(act.embedding_json)
            except Exception:
                act_embedding = None

        if not act_embedding:
            act_text = act.searchable_text or f"{act.activity_name} {act.discipline or ''} {act.location or ''}"
            act_embedding = generate_embedding(act_text)
            act.embedding = act_embedding
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

    scored_candidates.sort(key=lambda x: x["semantic_score"], reverse=True)
    top_candidates = scored_candidates[:top_k]

    for rank, cand in enumerate(top_candidates, 1):
        cand["rank"] = rank

    return top_candidates
