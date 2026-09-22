"""Vector Embedding & Cosine Similarity Search Service for Document RAG."""

import asyncio
import hashlib
import logging
import math
from typing import Any, Dict, List, Optional
from bson import ObjectId

from app.config import get_settings
from app.database.mongodb import db_manager
from app.schemas.ai import TokenUsage
from app.schemas.document import RAGCitation, RAGQueryResponse
from app.services.ai_service import ai_service

logger = logging.getLogger("taskpilot.vector_service")
settings = get_settings()

EMBEDDING_DIMENSION = 768
MODEL_NAME = "text-embedding-004"


class VectorService:
    """Manages dense vector generation using Google Gemini text-embedding-004 and cosine similarity retrieval."""

    def __init__(self) -> None:
        pass

    def generate_embedding(self, text: str) -> List[float]:
        """Encodes text into a normalized 768-dimensional dense vector using Gemini embedding models with automatic failover."""
        if ai_service.client and text.strip():
            candidate_models = [
                settings.GEMINI_EMBEDDING_MODEL or "gemini-embedding-001",
                "gemini-embedding-001",
                "gemini-embedding-2",
                "text-embedding-004",
            ]
            seen = set()
            for model_name in candidate_models:
                clean_name = model_name.replace("models/", "").strip()
                if clean_name in seen:
                    continue
                seen.add(clean_name)
                try:
                    from google.genai import types
                    config = types.EmbedContentConfig(output_dimensionality=EMBEDDING_DIMENSION)
                    res = ai_service.client.models.embed_content(
                        model=clean_name,
                        contents=text,
                        config=config,
                    )
                    if res.embeddings and len(res.embeddings) > 0:
                        return res.embeddings[0].values
                except Exception as exc:
                    logger.debug("Gemini embedding model [%s] failed: %s. Trying next embedding model...", clean_name, exc)

        return self._deterministic_fallback_vector(text)

    def generate_embeddings_batch(self, texts: List[str]) -> List[List[float]]:
        """Batch embedding generation across candidate Gemini embedding models with failover."""
        if ai_service.client and texts:
            candidate_models = [
                settings.GEMINI_EMBEDDING_MODEL or "gemini-embedding-001",
                "gemini-embedding-001",
                "gemini-embedding-2",
                "text-embedding-004",
            ]
            seen = set()
            for model_name in candidate_models:
                clean_name = model_name.replace("models/", "").strip()
                if clean_name in seen:
                    continue
                seen.add(clean_name)
                try:
                    from google.genai import types
                    config = types.EmbedContentConfig(output_dimensionality=EMBEDDING_DIMENSION)
                    res = ai_service.client.models.embed_content(
                        model=clean_name,
                        contents=texts,
                        config=config,
                    )
                    if res.embeddings and len(res.embeddings) == len(texts):
                        return [e.values for e in res.embeddings]
                except Exception as exc:
                    logger.debug("Gemini batch embedding model [%s] failed: %s. Trying next model...", clean_name, exc)

        return [self._deterministic_fallback_vector(t) for t in texts]

    def _deterministic_fallback_vector(self, text: str) -> List[float]:
        """High-entropy normalized pseudo-embedding generator ensuring 100% offline uptime."""
        clean = text.lower().strip()
        vec = [0.0] * EMBEDDING_DIMENSION

        # Extract words & n-grams to seed dimensions
        words = clean.split()
        for idx, word in enumerate(words):
            h = int(hashlib.md5(word.encode("utf-8")).hexdigest(), 16)
            dim = h % EMBEDDING_DIMENSION
            weight = 1.0 / (1.0 + math.log(idx + 2))
            vec[dim] += weight

        # Normalize vector to unit length
        norm = math.sqrt(sum(x * x for x in vec))
        if norm > 0:
            return [x / norm for x in vec]

        # Uniform vector for edge cases
        uniform_val = 1.0 / math.sqrt(EMBEDDING_DIMENSION)
        return [uniform_val] * EMBEDDING_DIMENSION

    def cosine_similarity(self, vec_a: List[float], vec_b: List[float]) -> float:
        """Calculates cosine similarity between two dense vectors."""
        if not vec_a or not vec_b or len(vec_a) != len(vec_b):
            return 0.0

        dot_product = sum(a * b for a, b in zip(vec_a, vec_b))
        norm_a = math.sqrt(sum(a * a for a in vec_a))
        norm_b = math.sqrt(sum(b * b for b in vec_b))

        if norm_a == 0.0 or norm_b == 0.0:
            return 0.0

        return max(0.0, min(1.0, dot_product / (norm_a * norm_b)))

    # ==========================================================================
    # Vector Search & RAG Retrieval
    # ==========================================================================

    async def search_relevant_chunks(
        self,
        project_id: str,
        query: str,
        top_k: int = 4,
    ) -> List[RAGCitation]:
        """Retrieves top-k most relevant document chunks for a project using cosine similarity."""
        try:
            db = db_manager.get_database()
            query_vec = self.generate_embedding(query)

            # 1. Fetch document chunks belonging to this project
            p_query = {"project_id": ObjectId(project_id) if ObjectId.is_valid(project_id) else project_id}
            cursor = db.document_chunks.find(p_query)
            chunks = await cursor.to_list(length=1000)

            if not chunks:
                return []
        except Exception as err:
            logger.warning("Database unavailable for chunk retrieval: %s. Returning empty citations.", err)
            return []

        # 2. Cache document filenames to populate citations
        doc_ids = list({c["document_id"] for c in chunks})
        docs_cursor = db.documents.find({"_id": {"$in": doc_ids}})
        doc_map = {d["_id"]: d.get("filename", "Document") async for d in docs_cursor}

        # 3. Calculate similarity score for each chunk
        scored_chunks: List[Dict[str, Any]] = []
        for chunk in chunks:
            c_vec = chunk.get("embedding", [])
            score = self.cosine_similarity(query_vec, c_vec)
            scored_chunks.append({
                "chunk": chunk,
                "score": score,
            })

        # 4. Sort descending by similarity score
        scored_chunks.sort(key=lambda x: x["score"], reverse=True)
        top_hits = scored_chunks[:top_k]

        citations: List[RAGCitation] = []
        for item in top_hits:
            c = item["chunk"]
            d_id = c["document_id"]
            citations.append(
                RAGCitation(
                    document_id=str(d_id),
                    filename=doc_map.get(d_id, "Document"),
                    page_number=c.get("page_number"),
                    chunk_index=c.get("chunk_index", 0),
                    excerpt=c.get("text", "")[:350] + ("..." if len(c.get("text", "")) > 350 else ""),
                    similarity_score=round(float(item["score"]), 4),
                )
            )

        return citations

    # ==========================================================================
    # RAG Answer Synthesis via Google Gemini
    # ==========================================================================

    async def answer_rag_query(
        self,
        project_id: str,
        question: str,
        top_k: int = 4,
        user_id: Optional[str] = None,
    ) -> RAGQueryResponse:
        """Executes full RAG pipeline: embedding, vector retrieval, and LLM context synthesis."""
        citations = await self.search_relevant_chunks(project_id, question, top_k)

        if not citations:
            return RAGQueryResponse(
                question=question,
                project_id=project_id,
                answer=(
                    "No project documentation found. Please upload project specifications, architecture RFCs, "
                    "or SRS documents to enable context-grounded RAG answers."
                ),
                citations=[],
                chunks_evaluated=0,
            )

        # Build context excerpts string
        context_blocks = []
        for idx, cit in enumerate(citations, start=1):
            source_label = f"[Source {idx}: {cit.filename}"
            if cit.page_number:
                source_label += f", Page {cit.page_number}"
            source_label += "]"

            context_blocks.append(f"{source_label}\n{cit.excerpt}")

        joined_context = "\n\n".join(context_blocks)

        system_prompt = (
            "You are TaskPilot RAG Assistant, an expert Technical Architecture and Project Documentation specialist. "
            "Your task is to answer the user's question accurately using ONLY the provided source document excerpts. "
            "Guidelines:\n"
            "1. Ground all facts in the provided excerpts.\n"
            "2. Cite your sources using inline tags like [Source 1], [Source 2] corresponding to the excerpts.\n"
            "3. Format your response in clean, professional Markdown with bullet points or sections where appropriate.\n"
            "4. If the excerpts do not contain the answer, explicitly state that the uploaded documents do not specify it."
        )

        user_prompt = (
            f"Question: {question}\n\n"
            f"Retrieved Documentation Excerpts:\n{joined_context}\n\n"
            "Synthesize an answer with citations."
        )

        token_usage = None
        answer_text = ""

        try:
            if ai_service.client:
                models_to_try = ai_service.get_all_candidate_models()
                contents = f"{system_prompt}\n\n{user_prompt}"

                for m in models_to_try:
                    try:
                        response = await asyncio.wait_for(
                            ai_service.client.aio.models.generate_content(
                                model=m,
                                contents=contents,
                            ),
                            timeout=25.0,
                        )
                        answer_text = response.text or ""
                        prompt_tokens = 0
                        completion_tokens = 0
                        if response.usage_metadata:
                            prompt_tokens = response.usage_metadata.prompt_token_count or 0
                            completion_tokens = response.usage_metadata.candidates_token_count or 0

                        token_usage = TokenUsage(
                            prompt_tokens=prompt_tokens,
                            completion_tokens=completion_tokens,
                            total_tokens=prompt_tokens + completion_tokens,
                            model=m,
                        )
                        await ai_service._log_token_usage(
                            endpoint="rag-query",
                            user_id=user_id,
                            model=m,
                            prompt_tokens=prompt_tokens,
                            completion_tokens=completion_tokens,
                        )
                        break
                    except Exception as err:
                        logger.warning("Gemini model [%s] RAG query failed: %s. Trying next Gemini model from pool...", m, err)
        except Exception as exc:
            logger.warning("Gemini RAG completion failed: %s. Using synthesized RAG answer.", exc)

        if not answer_text:
            # Fallback synthesis
            answer_text = (
                f"Based on the project documentation in **{citations[0].filename}**:\n\n"
                f"{citations[0].excerpt[:200]}...\n\n"
                f"*Referenced from [Source 1: {citations[0].filename}].*"
            )

        return RAGQueryResponse(
            question=question,
            project_id=project_id,
            answer=answer_text,
            citations=citations,
            chunks_evaluated=len(citations),
            token_usage=token_usage,
        )


# Singleton instance
vector_service = VectorService()
