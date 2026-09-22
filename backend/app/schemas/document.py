"""Pydantic schemas for document management, chunk inspection, and RAG query pipeline."""

from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field

from app.schemas.ai import TokenUsage


# ==============================================================================
# Document Metadata Schemas
# ==============================================================================

class DocumentResponse(BaseModel):
    """Schema representing an uploaded project specification or document."""
    id: str = Field(..., description="Unique document ID")
    project_id: str = Field(..., description="Parent project ID")
    filename: str = Field(..., description="Original filename")
    file_size: int = Field(..., description="File size in bytes")
    mime_type: str = Field(..., description="MIME content type")
    chunk_count: int = Field(default=0, description="Total vector chunks generated")
    status: str = Field(default="INDEXED", description="Status: PROCESSING, INDEXED, FAILED")
    created_at: datetime = Field(..., description="Upload timestamp")


class DocumentListResponse(BaseModel):
    """List of documents for a project."""
    documents: List[DocumentResponse] = Field(default_factory=list)
    total: int = Field(default=0)


class DocumentChunkItem(BaseModel):
    """Single extracted text chunk with vector metadata."""
    id: str = Field(..., description="Chunk ID")
    document_id: str = Field(..., description="Parent document ID")
    project_id: str = Field(..., description="Parent project ID")
    chunk_index: int = Field(..., description="Sequential position in document")
    page_number: Optional[int] = Field(default=None, description="Source page number")
    text: str = Field(..., description="Chunk text content")
    character_count: int = Field(default=0)


class DocumentChunkListResponse(BaseModel):
    """List of chunks for document preview."""
    document_id: str
    filename: str
    chunks: List[DocumentChunkItem] = Field(default_factory=list)
    total_chunks: int = Field(default=0)


# ==============================================================================
# RAG Query Pipeline Schemas
# ==============================================================================

class RAGQueryRequest(BaseModel):
    """User query sent to the document RAG engine."""
    project_id: str = Field(..., description="Target project ID to search documentation within")
    question: str = Field(..., min_length=2, max_length=1500, description="User question or inquiry")
    top_k: Optional[int] = Field(default=4, ge=1, le=10, description="Number of source chunks to retrieve")


class RAGCitation(BaseModel):
    """Referenced source citation supporting the generated answer."""
    document_id: str
    filename: str
    page_number: Optional[int] = None
    chunk_index: int
    excerpt: str = Field(..., description="Relevant text snippet from source document")
    similarity_score: float = Field(..., description="Cosine similarity score (0.0 to 1.0)")


class RAGQueryResponse(BaseModel):
    """Synthesized RAG answer with source citations."""
    question: str
    project_id: str
    answer: str = Field(..., description="Markdown-formatted synthesized answer citing facts from sources")
    citations: List[RAGCitation] = Field(default_factory=list, description="Collapsible source reference cards")
    chunks_evaluated: int = Field(default=0)
    token_usage: Optional[TokenUsage] = Field(default=None, description="LLM execution telemetry")
