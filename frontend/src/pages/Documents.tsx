import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  UploadCloud,
  Sparkles,
  Trash2,
  Layers,
  Search,
  Database,
  AlertCircle,
  CheckCircle2,
  Loader2,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  BookOpen,
  Send,
  File,
  Cpu,
  HelpCircle,
} from "lucide-react";
import {
  documentService,
  type DocumentItem,
  type DocumentChunkItem,
  type RAGQueryResponse,
  type RAGCitation,
} from "../services/documentService";
import { projectService, type Project } from "../services/projectService";
import { Button, Modal } from "../components/ui";
import { cn } from "../lib/utils";

const SAMPLE_QUESTIONS = [
  "What are the core functional requirements of the system?",
  "What are the system architecture constraints and dependencies?",
  "What are the release milestones and delivery deadlines?",
  "Are there specific security, authentication, or compliance guidelines?",
];

export const Documents: React.FC = () => {
  // Projects state
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);

  // Documents state
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoadingDocs, setIsLoadingDocs] = useState(false);
  const [docError, setDocError] = useState<string | null>(null);

  // Upload state
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Chunk Inspector Modal state
  const [inspectorOpen, setInspectorOpen] = useState(false);
  const [inspectingDoc, setInspectingDoc] = useState<DocumentItem | null>(null);
  const [chunks, setChunks] = useState<DocumentChunkItem[]>([]);
  const [isLoadingChunks, setIsLoadingChunks] = useState(false);

  // RAG Query state
  const [ragQuestion, setRagQuestion] = useState("");
  const [isQueryingRAG, setIsQueryingRAG] = useState(false);
  const [ragResult, setRagResult] = useState<RAGQueryResponse | null>(null);
  const [ragError, setRagError] = useState<string | null>(null);
  const [expandedCitationIndex, setExpandedCitationIndex] = useState<number | null>(0);

  // Delete document state
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null);

  // Load all projects on mount
  useEffect(() => {
    setIsLoadingProjects(true);
    projectService
      .getProjects({ limit: 50 })
      .then((res) => {
        setProjects(res.projects);
        if (res.projects.length > 0) {
          setSelectedProjectId(res.projects[0].id);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch projects:", err);
      })
      .finally(() => {
        setIsLoadingProjects(false);
      });
  }, []);

  // Fetch documents when selected project changes
  useEffect(() => {
    if (!selectedProjectId) return;
    loadDocuments(selectedProjectId);
  }, [selectedProjectId]);

  const loadDocuments = async (projectId: string) => {
    setIsLoadingDocs(true);
    setDocError(null);
    try {
      const res = await documentService.getDocuments(projectId);
      setDocuments(res.documents);
    } catch (err: any) {
      console.error("Failed to load documents:", err);
      setDocError(
        err?.response?.data?.error?.message || "Failed to load project documents."
      );
    } finally {
      setIsLoadingDocs(false);
    }
  };

  // Upload handler
  const handleFileUpload = async (file: File) => {
    if (!selectedProjectId) {
      setUploadError("Please select a target project first.");
      return;
    }

    // Quick size validation: 10MB
    if (file.size > 10 * 1024 * 1024) {
      setUploadError("File exceeds 10MB limit. Please upload a smaller document.");
      return;
    }

    setIsUploading(true);
    setUploadError(null);
    setUploadSuccess(null);

    try {
      const newDoc = await documentService.uploadDocument(selectedProjectId, file);
      setDocuments((prev) => [newDoc, ...prev]);
      setUploadSuccess(`"${file.name}" indexed successfully into ${newDoc.chunk_count} vector chunks.`);
      setTimeout(() => setUploadSuccess(null), 4000);
    } catch (err: any) {
      console.error("Upload failed:", err);
      setUploadError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.detail ||
          "Document upload and vector indexing failed."
      );
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      handleFileUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  // Inspect chunks modal trigger
  const handleOpenInspector = async (doc: DocumentItem) => {
    setInspectingDoc(doc);
    setInspectorOpen(true);
    setIsLoadingChunks(true);
    try {
      const res = await documentService.getDocumentChunks(doc.id);
      setChunks(res.chunks);
    } catch (err) {
      console.error("Failed to load chunks:", err);
    } finally {
      setIsLoadingChunks(false);
    }
  };

  // Delete document
  const handleDeleteDoc = async (docId: string) => {
    setDeletingDocId(docId);
    try {
      await documentService.deleteDocument(docId);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (err: any) {
      console.error("Failed to delete document:", err);
      alert(err?.response?.data?.error?.message || "Failed to delete document.");
    } finally {
      setDeletingDocId(null);
    }
  };

  // Submit RAG question
  const handleAskRAG = async (questionToAsk?: string) => {
    const query = questionToAsk || ragQuestion;
    if (!query.trim() || !selectedProjectId) return;

    setIsQueryingRAG(true);
    setRagError(null);
    try {
      const res = await documentService.queryRAG(selectedProjectId, query.trim(), 4);
      setRagResult(res);
      setExpandedCitationIndex(0);
    } catch (err: any) {
      console.error("RAG Query failed:", err);
      setRagError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.detail ||
          "Failed to retrieve documentation answer."
      );
    } finally {
      setIsQueryingRAG(false);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  return (
    <div className="space-y-8 pb-16">
      {/* Header Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-indigo-500/20 to-cyan-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
                Knowledge Base & Document RAG
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  Gemini Embeddings + Flash RAG
                </span>
              </h1>
              <p className="text-sm text-slate-400">
                Upload architecture specs, RFCs, and requirements to enable grounded AI Q&amp;A with citations.
              </p>
            </div>
          </div>
        </div>

        {/* Project Selector & Actions */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              disabled={isLoadingProjects || projects.length === 0}
              className="bg-slate-900/80 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none pr-10 cursor-pointer disabled:opacity-50"
            >
              {projects.length === 0 ? (
                <option value="">No projects found</option>
              ) : (
                projects.map((p) => (
                  <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                    {p.name}
                  </option>
                ))
              )}
            </select>
            <ChevronDown className="h-4 w-4 text-slate-400 absolute right-3 top-3.5 pointer-events-none" />
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => selectedProjectId && loadDocuments(selectedProjectId)}
            disabled={isLoadingDocs || !selectedProjectId}
            className="text-slate-400 hover:text-white"
          >
            <RefreshCw className={cn("h-4 w-4", isLoadingDocs && "animate-spin")} />
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={!selectedProjectId || isUploading}
            className="flex items-center gap-2 shadow-glow-indigo"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Indexing...
              </>
            ) : (
              <>
                <UploadCloud className="h-4 w-4" />
                Upload Spec
              </>
            )}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.md,application/pdf,text/plain,text/markdown"
            className="hidden"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFileUpload(e.target.files[0]);
              }
            }}
          />
        </div>
      </div>

      {/* Main Dual-Pane Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ============================================================ */}
        {/* Left Column: Ingestion & Document Repository (5 cols)         */}
        {/* ============================================================ */}
        <div className="lg:col-span-5 space-y-6">
          {/* Drag & Drop Upload Zone */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onClick={() => fileInputRef.current?.click()}
            className={cn(
              "relative rounded-2xl border-2 border-dashed transition-all p-6 text-center cursor-pointer flex flex-col items-center justify-center gap-3",
              isDragging
                ? "border-indigo-500 bg-indigo-500/10 scale-[1.01]"
                : "border-white/10 hover:border-white/20 bg-slate-900/40 hover:bg-slate-900/60"
            )}
          >
            <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform">
              <UploadCloud className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                Drag &amp; drop architecture specifications or click to browse
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Supports PDF, TXT, or Markdown documents (max 10MB)
              </p>
            </div>
            <span className="text-[11px] font-mono uppercase tracking-wider text-indigo-400/80 bg-indigo-500/5 px-2.5 py-1 rounded-md border border-indigo-500/10">
              Auto-Split &amp; 384-Dim Vector Embeddings
            </span>
          </div>

          {/* Upload Status Alerts */}
          <AnimatePresence>
            {uploadError && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2"
              >
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{uploadError}</span>
              </motion.div>
            )}
            {uploadSuccess && (
              <motion.div
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{uploadSuccess}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Document List Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Database className="h-4 w-4 text-indigo-400" />
              Indexed Documents
              <span className="text-xs text-slate-400 font-normal">
                ({documents.length})
              </span>
            </h2>
            {selectedProject && (
              <span className="text-xs text-slate-400 truncate max-w-[180px]">
                Project: <span className="text-indigo-300">{selectedProject.name}</span>
              </span>
            )}
          </div>

          {/* Document Cards */}
          {isLoadingDocs ? (
            <div className="p-8 text-center text-slate-400 glass-card rounded-2xl flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
              <p className="text-xs">Fetching indexed project documents...</p>
            </div>
          ) : docError ? (
            <div className="p-6 text-center text-rose-300 glass-card rounded-2xl border-rose-500/20 text-xs">
              {docError}
            </div>
          ) : documents.length === 0 ? (
            <div className="p-8 text-center glass-card rounded-2xl border-white/10 space-y-3">
              <div className="h-10 w-10 mx-auto rounded-xl bg-white/5 flex items-center justify-center text-slate-400">
                <BookOpen className="h-5 w-5" />
              </div>
              <p className="text-sm font-medium text-slate-300">No documents indexed yet</p>
              <p className="text-xs text-slate-400 leading-relaxed max-w-sm mx-auto">
                Upload your product requirements document (PRD), architecture RFC, or technical spec to enable RAG-based AI context search.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="group relative p-4 rounded-2xl glass-card border-white/10 hover:border-white/20 transition-all space-y-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="h-9 w-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                        {doc.filename.endsWith(".pdf") ? (
                          <FileText className="h-4 w-4" />
                        ) : (
                          <File className="h-4 w-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-white truncate group-hover:text-indigo-300 transition-colors">
                          {doc.filename}
                        </h3>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-slate-400">
                          <span>{formatBytes(doc.file_size)}</span>
                          <span>•</span>
                          <span>{new Date(doc.created_at).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Status badge */}
                    <div className="flex items-center gap-2 shrink-0">
                      {doc.status === "INDEXED" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          Indexed
                        </span>
                      ) : doc.status === "PROCESSING" ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <Loader2 className="h-3 w-3 animate-spin" />
                          Processing
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                          Failed
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Footer stats & actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-white/5 text-xs">
                    <span className="text-slate-400 flex items-center gap-1.5">
                      <Layers className="h-3.5 w-3.5 text-indigo-400" />
                      <strong className="text-slate-200">{doc.chunk_count}</strong> vector chunks
                    </span>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenInspector(doc)}
                        className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors flex items-center gap-1 text-[11px] font-medium"
                      >
                        <Layers className="h-3 w-3" />
                        Inspect Chunks
                      </button>

                      <button
                        type="button"
                        onClick={() => handleDeleteDoc(doc.id)}
                        disabled={deletingDocId === doc.id}
                        className="p-1.5 rounded-lg hover:bg-rose-500/10 text-slate-400 hover:text-rose-400 transition-colors"
                        title="Delete document and vector embeddings"
                      >
                        {deletingDocId === doc.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin text-rose-400" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ============================================================ */}
        {/* Right Column: Interactive RAG Q&A Interface (7 cols)         */}
        {/* ============================================================ */}
        <div className="lg:col-span-7 space-y-6">
          <div className="p-6 rounded-3xl glass-panel border border-white/10 shadow-2xl space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                  <Cpu className="h-4 w-4" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white tracking-tight">
                    Project RAG Query Engine
                  </h2>
                  <p className="text-xs text-slate-400">
                    Ask questions grounded in uploaded architecture and specifications
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] bg-white/5 border border-white/10 text-slate-300 font-mono">
                <Sparkles className="h-3 w-3 text-cyan-400" />
                Llama 3.3 70B
              </div>
            </div>

            {/* Prompt suggestions pills */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                <HelpCircle className="h-3.5 w-3.5 text-indigo-400" />
                Suggested Inquiries
              </label>
              <div className="flex flex-wrap gap-2">
                {SAMPLE_QUESTIONS.map((q, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      setRagQuestion(q);
                      handleAskRAG(q);
                    }}
                    className="text-xs px-3 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/5 hover:border-white/15 transition-all text-left"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* Search / Ask Box */}
            <div className="space-y-3">
              <div className="relative">
                <textarea
                  value={ragQuestion}
                  onChange={(e) => setRagQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleAskRAG();
                    }
                  }}
                  rows={3}
                  placeholder={
                    documents.length === 0
                      ? "Upload a document on the left first to enable RAG..."
                      : "Ask anything about the architecture, tech stack, APIs, or delivery requirements... (Press Enter to ask)"
                  }
                  disabled={documents.length === 0 || isQueryingRAG}
                  className="w-full bg-slate-900/90 border border-white/10 rounded-2xl p-4 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 resize-none transition-all disabled:opacity-50"
                />

                <div className="absolute right-3 bottom-3 flex items-center gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleAskRAG()}
                    disabled={
                      !ragQuestion.trim() ||
                      documents.length === 0 ||
                      isQueryingRAG
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs shadow-glow-indigo"
                  >
                    {isQueryingRAG ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Searching...
                      </>
                    ) : (
                      <>
                        <Send className="h-3.5 w-3.5" />
                        Ask RAG
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </div>

            {/* Error message */}
            {ragError && (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{ragError}</span>
              </div>
            )}

            {/* Loading Indicator */}
            {isQueryingRAG && (
              <div className="p-6 rounded-2xl bg-indigo-500/5 border border-indigo-500/20 space-y-3 animate-pulse">
                <div className="flex items-center gap-2.5 text-indigo-400 text-xs font-semibold">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Computing cosine vector similarity over document chunks...</span>
                </div>
                <div className="h-3 bg-white/10 rounded-full w-3/4" />
                <div className="h-3 bg-white/10 rounded-full w-5/6" />
                <div className="h-3 bg-white/10 rounded-full w-2/3" />
              </div>
            )}

            {/* Response Display */}
            {ragResult && !isQueryingRAG && (
              <div className="space-y-6 pt-2">
                {/* Answer Box */}
                <div className="p-5 rounded-2xl bg-slate-900/60 border border-white/10 space-y-3">
                  <div className="flex items-center justify-between text-xs text-slate-400 border-b border-white/5 pb-2">
                    <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                      Synthesized Knowledge Answer
                    </span>
                    <span className="font-mono text-[11px]">
                      {ragResult.chunks_evaluated} source chunks retrieved
                    </span>
                  </div>

                  <div className="prose prose-invert prose-sm max-w-none text-slate-200 leading-relaxed text-sm whitespace-pre-line">
                    {ragResult.answer}
                  </div>

                  {ragResult.token_usage && (
                    <div className="flex items-center gap-3 pt-2 text-[11px] text-slate-400 border-t border-white/5 font-mono">
                      <span>Model: {ragResult.token_usage.model}</span>
                      <span>•</span>
                      <span>Total Tokens: {ragResult.token_usage.total_tokens}</span>
                    </div>
                  )}
                </div>

                {/* Collapsible Source Citations */}
                {ragResult.citations && ragResult.citations.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <Search className="h-3.5 w-3.5 text-cyan-400" />
                      Source Document Citations ({ragResult.citations.length})
                    </h3>

                    <div className="space-y-2">
                      {ragResult.citations.map((citation: RAGCitation, idx: number) => {
                        const isExpanded = expandedCitationIndex === idx;
                        const matchPct = Math.round(citation.similarity_score * 100);

                        return (
                          <div
                            key={idx}
                            className="rounded-xl border border-white/10 bg-slate-900/40 overflow-hidden transition-colors"
                          >
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedCitationIndex(isExpanded ? null : idx)
                              }
                              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-white/5 transition-colors"
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <span className="h-5 w-5 rounded-full bg-indigo-500/20 text-indigo-300 text-[10px] font-bold flex items-center justify-center shrink-0 border border-indigo-500/30">
                                  {idx + 1}
                                </span>
                                <span className="text-xs font-semibold text-white truncate">
                                  {citation.filename}
                                </span>
                                {citation.page_number && (
                                  <span className="text-[11px] text-slate-400">
                                    • Page {citation.page_number}
                                  </span>
                                )}
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-medium bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                                  {matchPct}% Match
                                </span>
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-slate-400" />
                                ) : (
                                  <ChevronRight className="h-4 w-4 text-slate-400" />
                                )}
                              </div>
                            </button>

                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="border-t border-white/5 px-4 py-3 bg-slate-950/40"
                                >
                                  <p className="text-xs text-slate-300 font-mono leading-relaxed bg-black/30 p-3 rounded-lg border border-white/5 whitespace-pre-wrap">
                                    "{citation.excerpt}"
                                  </p>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* Chunk Inspector Modal                                        */}
      {/* ============================================================ */}
      <Modal
        isOpen={inspectorOpen}
        onClose={() => setInspectorOpen(false)}
        size="xl"
        title={
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-indigo-400" />
            <span>Vector Chunks Inspector</span>
          </div>
        }
        description={
          inspectingDoc ? (
            <span>
              Document: <strong>{inspectingDoc.filename}</strong> • Total Chunks:{" "}
              {inspectingDoc.chunk_count}
            </span>
          ) : undefined
        }
      >
        <div className="max-h-[60vh] overflow-y-auto space-y-4 pr-1">
          {isLoadingChunks ? (
            <div className="py-12 text-center text-slate-400 flex flex-col items-center justify-center gap-3">
              <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
              <p className="text-xs">Loading extracted vector chunks...</p>
            </div>
          ) : chunks.length === 0 ? (
            <p className="text-center text-xs text-slate-400 py-8">
              No vector chunks found for this document.
            </p>
          ) : (
            chunks.map((c) => (
              <div
                key={c.id}
                className="p-4 rounded-xl bg-slate-900/80 border border-white/10 space-y-2"
              >
                <div className="flex items-center justify-between text-xs text-slate-400 pb-1.5 border-b border-white/5 font-mono">
                  <span className="font-semibold text-indigo-300">
                    Chunk #{c.chunk_index + 1}
                  </span>
                  <div className="flex items-center gap-3">
                    {c.page_number && <span>Page: {c.page_number}</span>}
                    <span>{c.character_count} chars</span>
                  </div>
                </div>
                <p className="text-xs text-slate-300 font-mono leading-relaxed whitespace-pre-wrap bg-slate-950/60 p-3 rounded-lg border border-white/5">
                  {c.text}
                </p>
              </div>
            ))
          )}
        </div>
      </Modal>
    </div>
  );
};
