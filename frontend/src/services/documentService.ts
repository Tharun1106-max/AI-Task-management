import { api } from "./api";
import { type TokenUsage } from "./aiService";

export interface DocumentItem {
  id: string;
  project_id: string;
  filename: string;
  file_size: number;
  mime_type: string;
  chunk_count: number;
  status: "PROCESSING" | "INDEXED" | "FAILED";
  created_at: string;
}

export interface DocumentListResponse {
  documents: DocumentItem[];
  total: number;
}

export interface DocumentChunkItem {
  id: string;
  document_id: string;
  project_id: string;
  chunk_index: number;
  page_number?: number | null;
  text: string;
  character_count: number;
}

export interface DocumentChunkListResponse {
  document_id: string;
  filename: string;
  chunks: DocumentChunkItem[];
  total_chunks: number;
}

export interface RAGCitation {
  document_id: string;
  filename: string;
  page_number?: number | null;
  chunk_index: number;
  excerpt: string;
  similarity_score: number;
}

export interface RAGQueryResponse {
  question: string;
  project_id: string;
  answer: string;
  citations: RAGCitation[];
  chunks_evaluated: number;
  token_usage?: TokenUsage | null;
}

export const documentService = {
  /**
   * List all documents indexed for a specific project.
   */
  async getDocuments(projectId: string): Promise<DocumentListResponse> {
    const res = await api.get<DocumentListResponse>("/api/documents", {
      params: { project_id: projectId },
    });
    return res.data;
  },

  /**
   * Upload a document (PDF, TXT, MD) and trigger background vector indexing.
   */
  async uploadDocument(projectId: string, file: File): Promise<DocumentItem> {
    const formData = new FormData();
    formData.append("project_id", projectId);
    formData.append("file", file);

    const res = await api.post<DocumentItem>("/api/documents/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });
    return res.data;
  },

  /**
   * Get all extracted vector chunks for previewing in the document inspector modal.
   */
  async getDocumentChunks(documentId: string): Promise<DocumentChunkListResponse> {
    const res = await api.get<DocumentChunkListResponse>(`/api/documents/${documentId}/chunks`);
    return res.data;
  },

  /**
   * Delete a document and purge all associated vector embeddings.
   */
  async deleteDocument(documentId: string): Promise<{ success: boolean; message: string }> {
    const res = await api.delete<{ success: boolean; message: string }>(`/api/documents/${documentId}`);
    return res.data;
  },

  /**
   * Query the project knowledge base using Retrieval-Augmented Generation.
   */
  async queryRAG(projectId: string, question: string, topK: number = 4): Promise<RAGQueryResponse> {
    const res = await api.post<RAGQueryResponse>("/api/rag/query", {
      project_id: projectId,
      question,
      top_k: topK,
    });
    return res.data;
  },
};
