import React, { useState } from "react";
import {
  Sparkles,
  Layers,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Zap,
} from "lucide-react";
import {
  aiService,
  type GeneratedTaskItem,
} from "../../services/aiService";
import { Button, Input, Modal, Textarea } from "../ui";
import { cn } from "../../lib/utils";

interface TaskQuickGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
  onTasksAdded?: () => void;
}

const PRIORITY_OPTIONS: Array<"LOW" | "MEDIUM" | "HIGH" | "CRITICAL"> = [
  "LOW",
  "MEDIUM",
  "HIGH",
  "CRITICAL",
];

export const TaskQuickGeneratorModal: React.FC<TaskQuickGeneratorModalProps> = ({
  isOpen,
  onClose,
  projectId,
  onTasksAdded,
}) => {
  const [prompt, setPrompt] = useState("");
  const [context, setContext] = useState("");
  const [count, setCount] = useState(5);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [generatedTasks, setGeneratedTasks] = useState<GeneratedTaskItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleGenerate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!prompt.trim()) {
      setError("Please describe the feature or user story to generate tasks.");
      return;
    }

    setError(null);
    setIsGenerating(true);
    try {
      const res = await aiService.generateTasks({
        prompt: prompt.trim(),
        project_context: context.trim() || undefined,
        count,
        project_id: projectId,
      });
      setGeneratedTasks(res.tasks);
    } catch (err: any) {
      console.error("AI Task Generation failed:", err);
      const errorMsg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.detail ||
        (err?.code === "ECONNABORTED" ? "Task generation timed out. Please try again." : null) ||
        (err?.message === "Network Error"
          ? "Cannot connect to backend server. Please verify backend is running on http://localhost:8000."
          : null) ||
        err?.message ||
        "Failed to generate tasks. Please try again.";
      setError(errorMsg);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleTaskChange = (
    index: number,
    field: keyof GeneratedTaskItem,
    value: any
  ) => {
    setGeneratedTasks((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  const handleRemoveTask = (index: number) => {
    setGeneratedTasks((prev) => prev.filter((_, i) => i !== index));
  };

  const handleBatchAdd = async () => {
    if (!projectId) {
      setError("No target project selected. Please select a project first.");
      return;
    }
    if (generatedTasks.length === 0) {
      setError("No tasks to add.");
      return;
    }

    setIsApplying(true);
    setError(null);
    try {
      await aiService.applyPlan({
        project_id: projectId,
        tasks: generatedTasks.map((t) => ({
          title: t.title,
          description: t.description,
          priority: t.priority,
          tags: t.tags,
        })),
      });

      setSuccessMsg(`Successfully added ${generatedTasks.length} tasks to your board!`);
      setTimeout(() => {
        setSuccessMsg(null);
        setGeneratedTasks([]);
        setPrompt("");
        setContext("");
        onTasksAdded?.();
        onClose();
      }, 1000);
    } catch (err: any) {
      console.error("Failed to batch add tasks:", err);
      setError(err?.response?.data?.error?.message || "Failed to batch add tasks.");
    } finally {
      setIsApplying(false);
    }
  };

  const handleReset = () => {
    setGeneratedTasks([]);
    setError(null);
    setSuccessMsg(null);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-indigo-400" />
          AI Task Quick-Generator
        </span>
      }
      description="Deconstruct any feature topic or user story into granular sprint tasks powered by Google Gemini."
      className="max-w-2xl"
    >
      <div className="space-y-4 pt-2">
        {error && (
          <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {successMsg && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs text-emerald-300">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
            <span>{successMsg}</span>
          </div>
        )}

        {generatedTasks.length === 0 ? (
          /* Step 1: Input prompt */
          <form onSubmit={handleGenerate} className="space-y-4">
            <Input
              label="Feature Name or Goal"
              placeholder="e.g. OAuth2 Social Authentication (Google, GitHub)"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              leftIcon={<Sparkles className="h-4 w-4 text-indigo-400" />}
              required
            />

            <Textarea
              label="Technical Scope or Context (Optional)"
              placeholder="e.g. React frontend, FastAPI backend with JWT tokens, rate limiting required..."
              rows={3}
              value={context}
              onChange={(e) => setContext(e.target.value)}
              helperText="Provide architecture parameters, dependencies, or constraints for finer precision."
            />

            <div className="flex items-center justify-between pt-2">
              <div className="flex items-center gap-2 text-xs text-slate-300">
                <Layers className="h-4 w-4 text-indigo-400" />
                <span>Task count:</span>
                <select
                  value={count}
                  onChange={(e) => setCount(Number(e.target.value))}
                  className="rounded-lg px-2.5 py-1 text-xs text-white glass-input focus:outline-none cursor-pointer"
                >
                  <option value={4}>4 tasks</option>
                  <option value={6}>6 tasks</option>
                  <option value={8}>8 tasks</option>
                  <option value={10}>10 tasks</option>
                </select>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="sm"
                glow
                isLoading={isGenerating}
                leftIcon={<Zap className="h-4 w-4 text-cyan-300" />}
              >
                Synthesize Tasks
              </Button>
            </div>
          </form>
        ) : (
          /* Step 2: Review, edit & batch-insert */
          <div className="space-y-4">
            <div className="flex items-center justify-between text-xs text-slate-400 pb-1 border-b border-white/10">
              <span className="font-semibold text-white">
                Generated {generatedTasks.length} Tasks
              </span>
              <button
                type="button"
                onClick={handleReset}
                className="text-indigo-400 hover:text-indigo-300 cursor-pointer font-medium"
              >
                Regenerate
              </button>
            </div>

            <div className="max-h-96 overflow-y-auto space-y-3 pr-1">
              {generatedTasks.map((t, idx) => (
                <div
                  key={idx}
                  className="rounded-xl glass-card p-3.5 border border-white/10 space-y-2 relative group hover:border-indigo-500/30 transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <input
                      type="text"
                      value={t.title}
                      onChange={(e) => handleTaskChange(idx, "title", e.target.value)}
                      className="bg-transparent text-sm font-semibold text-white focus:outline-none focus:border-b border-indigo-400 flex-1"
                    />

                    <select
                      value={t.priority}
                      onChange={(e) =>
                        handleTaskChange(idx, "priority", e.target.value as any)
                      }
                      className={cn(
                        "rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider focus:outline-none cursor-pointer",
                        t.priority === "CRITICAL"
                          ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                          : t.priority === "HIGH"
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                          : t.priority === "MEDIUM"
                          ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
                          : "bg-slate-500/20 text-slate-300 border-slate-500/30"
                      )}
                    >
                      {PRIORITY_OPTIONS.map((p) => (
                        <option key={p} value={p} className="bg-slate-900 text-white">
                          {p}
                        </option>
                      ))}
                    </select>

                    <button
                      type="button"
                      onClick={() => handleRemoveTask(idx)}
                      className="text-slate-500 hover:text-rose-400 p-1 rounded transition-colors cursor-pointer"
                      title="Remove task"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <textarea
                    value={t.description}
                    onChange={(e) => handleTaskChange(idx, "description", e.target.value)}
                    rows={2}
                    className="w-full bg-transparent text-xs text-slate-300 focus:outline-none resize-none"
                  />

                  {t.tags && t.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {t.tags.map((tag, tagIdx) => (
                        <span
                          key={tagIdx}
                          className="rounded-full bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] text-slate-400 font-mono"
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-white/10">
              <span className="text-xs text-slate-400">
                Ready to commit {generatedTasks.length} tasks to current board
              </span>

              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={onClose} disabled={isApplying}>
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  glow
                  isLoading={isApplying}
                  onClick={handleBatchAdd}
                  leftIcon={<Plus className="h-4 w-4" />}
                >
                  Batch Add to Board
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
