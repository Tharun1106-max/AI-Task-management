"""FastAPI router for document management, chunk extraction, vector indexing, and RAG Q&A."""

from datetime import datetime, timezone
import logging
from typing import Any, Dict, List, Optional
from bson import ObjectId
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status

from app.database.mongodb import db_manager
from app.models.user import User, UserRole
from app.routes.notifications import log_activity
from app.schemas.document import (
    DocumentChunkItem,
    DocumentChunkListResponse,
    DocumentListResponse,
    DocumentResponse,
    RAGQueryRequest,
    RAGQueryResponse,
)
from app.services.document_service import document_service
from app.services.vector_service import vector_service
from app.utils.security import get_current_user

logger = logging.getLogger("taskpilot.documents_router")

router = APIRouter(tags=["Documents & RAG Knowledge Base"])


# ==============================================================================
# Helper Functions
# ==============================================================================

def _serialize_document(doc: Dict[str, Any]) -> DocumentResponse:
    """Serializes a raw MongoDB document record into DocumentResponse."""
    return DocumentResponse(
        id=str(doc["_id"]),
        project_id=str(doc.get("project_id", "")),
        filename=doc.get("filename", "unknown"),
        file_size=doc.get("file_size", 0),
        mime_type=doc.get("mime_type", "application/octet-stream"),
        chunk_count=doc.get("chunk_count", 0),
        status=doc.get("status", "INDEXED"),
        created_at=doc.get("created_at", datetime.now(timezone.utc)),
    )


async def _verify_project_access(project_id: str, current_user: User) -> Dict[str, Any]:
    """Ensures the project exists and the current user is an authorized member or owner."""
    if not ObjectId.is_valid(project_id):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid project ID format: '{project_id}'",
        )

    db = db_manager.get_database()
    project = await db.projects.find_one({"_id": ObjectId(project_id)})
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Project with ID '{project_id}' was not found.",
        )

    user_id_str = str(current_user.id)
    is_owner = str(project.get("owner_id")) == user_id_str
    is_member = user_id_str in [str(m) for m in project.get("member_ids", [])]
    is_admin = current_user.role in [UserRole.OWNER, UserRole.ADMIN]

    if not (is_owner or is_member or is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to access documentation for this project.",
        )

    return project


# ==============================================================================
# Document Ingestion & Management Endpoints
# ==============================================================================

@router.post(
    "/documents/upload",
    response_model=DocumentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Upload & Index Project Document",
    description="Accepts PDF, TXT, or MD specification documents, chunks text, creates vector embeddings, and stores them in MongoDB.",
)
async def upload_document(
    project_id: str = Form(..., description="Parent project ID"),
    file: UploadFile = File(..., description="PDF or text document to parse"),
    current_user: User = Depends(get_current_user),
) -> DocumentResponse:
    """Uploads document, chunks it, and indexes dense vectors for RAG."""
    await _verify_project_access(project_id, current_user)

    if not file.filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file must have a valid filename.",
        )

    # Read binary content
    content = await file.read()
    file_size = len(content)

    # Validate file format and size limits
    document_service.validate_file(
        filename=file.filename,
        content_type=file.content_type or "application/octet-stream",
        file_size=file_size,
    )

    db = db_manager.get_database()

    # Create initial document record with PROCESSING status
    doc_record = {
        "project_id": project_id,
        "filename": file.filename,
        "file_size": file_size,
        "mime_type": file.content_type or "application/octet-stream",
        "chunk_count": 0,
        "status": "PROCESSING",
        "created_at": datetime.now(timezone.utc),
        "uploaded_by": str(current_user.id),
    }

    insert_result = await db.documents.insert_one(doc_record)
    doc_id = str(insert_result.inserted_id)

    try:
        # 1. Extract text (PDF page-by-page or plaintext)
        pages = document_service.extract_text(content, file.filename)

        # 2. Split into overlapping semantic chunks
        chunks = document_service.recursive_split_text(pages)

        # 3. Generate dense vector embeddings for all chunks in batch
        chunk_texts = [c["text"] for c in chunks]
        embeddings = vector_service.generate_embeddings_batch(chunk_texts)

        # 4. Insert chunks into document_chunks collection
        chunk_docs = []
        for idx, chunk in enumerate(chunks):
            chunk_docs.append({
                "document_id": doc_id,
                "project_id": project_id,
                "chunk_index": chunk["chunk_index"],
                "page_number": chunk["page_number"],
                "text": chunk["text"],
                "character_count": chunk["character_count"],
                "embedding": embeddings[idx] if idx < len(embeddings) else [],
                "created_at": datetime.now(timezone.utc),
            })

        if chunk_docs:
            await db.document_chunks.insert_many(chunk_docs)

        # 5. Mark document as INDEXED
        await db.documents.update_one(
            {"_id": ObjectId(doc_id)},
            {
                "$set": {
                    "status": "INDEXED",
                    "chunk_count": len(chunks),
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )

        doc_record["_id"] = ObjectId(doc_id)
        doc_record["status"] = "INDEXED"
        doc_record["chunk_count"] = len(chunks)

        # Log system activity
        await log_activity(
            user_id=str(current_user.id),
            action="DOCUMENT_UPLOADED",
            entity_type="document",
            entity_id=doc_id,
            details={
                "filename": file.filename,
                "project_id": project_id,
                "chunk_count": len(chunks),
                "file_size": file_size,
            },
        )

        logger.info(
            "Document [%s] uploaded and indexed successfully into %d chunks for project [%s].",
            file.filename,
            len(chunks),
            project_id,
        )
        return _serialize_document(doc_record)

    except Exception as exc:
        logger.exception("Failed to process and index document [%s]: %s", file.filename, exc)
        await db.documents.update_one(
            {"_id": ObjectId(doc_id)},
            {
                "$set": {
                    "status": "FAILED",
                    "error": str(exc),
                    "updated_at": datetime.now(timezone.utc),
                }
            },
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Document parsing failed: {str(exc)}",
        )


@router.get(
    "/documents",
    response_model=DocumentListResponse,
    summary="List Project Documents",
    description="Retrieves all indexed documents belonging to a project.",
)
async def list_documents(
    project_id: str,
    current_user: User = Depends(get_current_user),
) -> DocumentListResponse:
    """Lists indexed documents for a specific project."""
    await _verify_project_access(project_id, current_user)

    db = db_manager.get_database()
    cursor = db.documents.find({"project_id": project_id}).sort("created_at", -1)
    doc_records = await cursor.to_list(length=100)

    serialized = [_serialize_document(d) for d in doc_records]
    return DocumentListResponse(documents=serialized, total=len(serialized))


@router.get(
    "/documents/{document_id}",
    response_model=DocumentResponse,
    summary="Get Document Metadata",
    description="Retrieves document metadata by ID.",
)
async def get_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
) -> DocumentResponse:
    """Fetches a single document record."""
    if not ObjectId.is_valid(document_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid document ID format.")

    db = db_manager.get_database()
    doc = await db.documents.find_one({"_id": ObjectId(document_id)})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    await _verify_project_access(str(doc.get("project_id")), current_user)
    return _serialize_document(doc)


@router.get(
    "/documents/{document_id}/chunks",
    response_model=DocumentChunkListResponse,
    summary="Inspect Document Vector Chunks",
    description="Retrieves all extracted text chunks and chunk positions for previewing in the document inspector modal.",
)
async def get_document_chunks(
    document_id: str,
    current_user: User = Depends(get_current_user),
) -> DocumentChunkListResponse:
    """Returns chunk contents for previewing."""
    if not ObjectId.is_valid(document_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid document ID format.")

    db = db_manager.get_database()
    doc = await db.documents.find_one({"_id": ObjectId(document_id)})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    await _verify_project_access(str(doc.get("project_id")), current_user)

    cursor = db.document_chunks.find(
        {"document_id": document_id},
        {"embedding": 0},  # Exclude raw vector floats to save bandwidth
    ).sort("chunk_index", 1)

    raw_chunks = await cursor.to_list(length=500)

    chunk_items: List[DocumentChunkItem] = []
    for rc in raw_chunks:
        chunk_items.append(
            DocumentChunkItem(
                id=str(rc["_id"]),
                document_id=document_id,
                project_id=str(rc.get("project_id", "")),
                chunk_index=rc.get("chunk_index", 0),
                page_number=rc.get("page_number"),
                text=rc.get("text", ""),
                character_count=rc.get("character_count", len(rc.get("text", ""))),
            )
        )

    return DocumentChunkListResponse(
        document_id=document_id,
        filename=doc.get("filename", "unknown"),
        chunks=chunk_items,
        total_chunks=len(chunk_items),
    )


@router.delete(
    "/documents/{document_id}",
    summary="Delete Document & Vector Embeddings",
    description="Deletes a document and cascades deletion across all indexed vector chunks in MongoDB.",
)
async def delete_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
) -> Dict[str, Any]:
    """Deletes document record and all associated vector chunks."""
    if not ObjectId.is_valid(document_id):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid document ID format.")

    db = db_manager.get_database()
    doc = await db.documents.find_one({"_id": ObjectId(document_id)})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Document not found.")

    project = await _verify_project_access(str(doc.get("project_id")), current_user)

    # Permission check: project owner, admin, or document uploader
    user_id_str = str(current_user.id)
    is_owner = str(project.get("owner_id")) == user_id_str
    is_uploader = str(doc.get("uploaded_by")) == user_id_str
    is_admin = current_user.role in [UserRole.OWNER, UserRole.ADMIN]

    if not (is_owner or is_uploader or is_admin):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to delete this document.",
        )

    # Cascade delete from chunks collection
    chunk_del_res = await db.document_chunks.delete_many({"document_id": document_id})
    await db.documents.delete_one({"_id": ObjectId(document_id)})

    # Log activity
    await log_activity(
        user_id=str(current_user.id),
        action="DOCUMENT_DELETED",
        entity_type="document",
        entity_id=document_id,
        details={
            "filename": doc.get("filename"),
            "project_id": str(doc.get("project_id")),
            "chunks_purged": chunk_del_res.deleted_count,
        },
    )

    logger.info(
        "Document [%s] and %d vector chunks deleted by user [%s].",
        document_id,
        chunk_del_res.deleted_count,
        user_id_str,
    )

    return {
        "success": True,
        "message": f"Document and {chunk_del_res.deleted_count} associated vector chunks were successfully removed.",
    }


# ==============================================================================
# RAG Query Pipeline Endpoint
# ==============================================================================

@router.post(
    "/rag/query",
    response_model=RAGQueryResponse,
    summary="Query Project Knowledge Base via RAG",
    description="Vector search retrieval augmented generation: embeds question with text-embedding-004, retrieves top-k relevant chunks, and prompts Google Gemini with source citations.",
)
async def query_rag(
    payload: RAGQueryRequest,
    current_user: User = Depends(get_current_user),
) -> RAGQueryResponse:
    """Executes dense vector search and synthesizes context-grounded answer with source citations."""
    await _verify_project_access(payload.project_id, current_user)

    response = await vector_service.answer_rag_query(
        project_id=payload.project_id,
        question=payload.question,
        top_k=payload.top_k or 4,
        user_id=str(current_user.id),
    )

    return response
