"""Document processing service: text extraction, file validation, and recursive chunking."""

import io
import logging
from typing import Any, Dict, List, Optional
from fastapi import HTTPException, UploadFile, status
from pypdf import PdfReader

logger = logging.getLogger("taskpilot.document_service")

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
ALLOWED_EXTENSIONS = {".pdf", ".txt", ".md", ".json", ".csv"}
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "text/plain",
    "text/markdown",
    "application/json",
    "text/csv",
    "application/octet-stream",  # Fallback for some OS/browser uploads of .md
}


class DocumentService:
    """Handles file validation, text extraction via PyPDF, and recursive text chunking."""

    def validate_file(self, file: UploadFile, file_bytes: bytes) -> None:
        """Enforces file size and type boundaries."""
        if len(file_bytes) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File exceeds maximum allowed size of {MAX_FILE_SIZE // (1024 * 1024)}MB.",
            )

        filename = (file.filename or "").lower()
        has_allowed_ext = any(filename.endswith(ext) for ext in ALLOWED_EXTENSIONS)
        if not has_allowed_ext:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unsupported file extension. Allowed formats: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
            )

    def extract_text(self, file_bytes: bytes, filename: str) -> List[Dict[str, Any]]:
        """Extracts text from PDF or text-based documents, preserving page numbers where available.

        Returns:
            List[Dict[str, Any]]: List of records: [{"page_number": int, "text": str}]
        """
        lower_name = filename.lower()
        extracted_pages: List[Dict[str, Any]] = []

        if lower_name.endswith(".pdf"):
            try:
                reader = PdfReader(io.BytesIO(file_bytes))
                for idx, page in enumerate(reader.pages, start=1):
                    page_text = page.extract_text() or ""
                    clean_text = page_text.strip()
                    if clean_text:
                        extracted_pages.append({"page_number": idx, "text": clean_text})
            except Exception as exc:
                logger.error("Failed to extract text from PDF %s: %s", filename, exc)
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Could not parse PDF content: {exc}",
                )

        else:
            # Plaintext / Markdown
            decoded_text = ""
            for encoding in ("utf-8", "utf-8-sig", "latin-1", "cp1252"):
                try:
                    decoded_text = file_bytes.decode(encoding)
                    break
                except UnicodeDecodeError:
                    continue

            if decoded_text.strip():
                extracted_pages.append({"page_number": 1, "text": decoded_text.strip()})

        if not extracted_pages:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="No readable text could be extracted from the document.",
            )

        return extracted_pages

    def recursive_split_text(
        self,
        text_pages: List[Dict[str, Any]],
        chunk_size: int = 800,
        chunk_overlap: int = 150,
    ) -> List[Dict[str, Any]]:
        """Chunks extracted document text using recursive boundary splitting with overlap.

        Returns:
            List[Dict[str, Any]]: List of chunks with text, chunk_index, and page_number.
        """
        separators = ["\n\n", "\n", ". ", "? ", "! ", "; ", " ", ""]
        final_chunks: List[Dict[str, Any]] = []
        chunk_counter = 0

        for page in text_pages:
            page_num = page.get("page_number", 1)
            raw_page_text = page.get("text", "")

            page_chunks = self._split_text_recursively(
                text=raw_page_text,
                chunk_size=chunk_size,
                chunk_overlap=chunk_overlap,
                separators=separators,
            )

            for chunk_str in page_chunks:
                clean_chunk = chunk_str.strip()
                if len(clean_chunk) > 20:  # Ignore micro fragments
                    final_chunks.append({
                        "chunk_index": chunk_counter,
                        "page_number": page_num,
                        "text": clean_chunk,
                        "character_count": len(clean_chunk),
                    })
                    chunk_counter += 1

        return final_chunks

    def _split_text_recursively(
        self,
        text: str,
        chunk_size: int,
        chunk_overlap: int,
        separators: List[str],
    ) -> List[str]:
        """Internal helper implementing recursive character splitting."""
        if len(text) <= chunk_size or not separators:
            return [text] if text else []

        separator = separators[0]
        splits = text.split(separator) if separator else list(text)

        chunks: List[str] = []
        current_chunk: List[str] = []
        current_length = 0

        for split in splits:
            item = split + separator if separator else split
            item_len = len(item)

            if current_length + item_len > chunk_size and current_chunk:
                merged = "".join(current_chunk).strip()
                if merged:
                    chunks.append(merged)

                # Overlap retention
                overlap_chunks = []
                overlap_len = 0
                for prev in reversed(current_chunk):
                    if overlap_len + len(prev) <= chunk_overlap:
                        overlap_chunks.insert(0, prev)
                        overlap_len += len(prev)
                    else:
                        break

                current_chunk = overlap_chunks
                current_length = overlap_len

            current_chunk.append(item)
            current_length += item_len

        if current_chunk:
            remaining = "".join(current_chunk).strip()
            if remaining:
                chunks.append(remaining)

        # Recursively split any chunk that still exceeds chunk_size
        refined_chunks: List[str] = []
        for c in chunks:
            if len(c) > chunk_size and len(separators) > 1:
                refined_chunks.extend(
                    self._split_text_recursively(
                        text=c,
                        chunk_size=chunk_size,
                        chunk_overlap=chunk_overlap,
                        separators=separators[1:],
                    )
                )
            else:
                refined_chunks.append(c)

        return refined_chunks


# Singleton instance
document_service = DocumentService()
