import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap,
  X,
  Flame,
  Clock,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import {
  aiService,
  type PrioritizedTaskItem,
  type PrioritizeResponse,
} from "../../services/aiService";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";

interface AIPriorityDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  projectId?: string;
  taskIds?: string[];
}

export const AIPriorityDrawer: React.FC<AIPriorityDrawerProps> = ({
  isOpen,
  onClose,
  projectId,
  taskIds,
}) => {
  const [data, setData] = useState<PrioritizeResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [bottlenecks, setBottlenecks] = useState("");
  const [error, setError] = useState<string | null>(null);

  const fetchPrioritization = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await aiService.prioritizeTasks({
        project_id: projectId,
        task_ids: taskIds,
        current_bottlenecks: bottlenecks || undefined,
      });
      setData(res);
    } catch (err: any) {
      console.error("AI Prioritization failed:", err);
      setError(err?.response?.data?.error?.message || "Failed to analyze task priorities.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchPrioritization();
    }
  }, [isOpen, projectId]);

  const getCategoryBadge = (category: string) => {
    switch (category) {
      case "Urgent Blocker":
        return {
          icon: <Flame className="h-3 w-3 text-rose-400" />,
          style: "bg-rose-500/20 text-rose-300 border-rose-500/30",
        };
      case "Approaching Deadline":
        return {
          icon: <Clock className="h-3 w-3 text-amber-400" />,
          style: "bg-amber-500/20 text-amber-300 border-amber-500/30",
        };
      default:
        return {
          icon: <TrendingUp className="h-3 w-3 text-indigo-400" />,
          style: "bg-indigo-500/20 text-indigo-300 border-indigo-500/30",
        };
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
            onClick={onClose}
          />

          {/* Slide-over Drawer */}
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 350, damping: 32 }}
              className="w-screen max-w-lg glass-panel border-l border-white/10 shadow-2xl flex flex-col h-full overflow-hidden"
            >
              {/* Header */}
              <div className="p-4 sm:p-6 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-amber-600/20 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-glow-amber">
                    <Zap className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white tracking-tight">
                      AI Priority & Bottleneck Engine
                    </h3>
                    <p className="text-xs text-slate-400">
                      Gemini analysis ranking tasks by urgency & blockers
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={fetchPrioritization}
                    disabled={isLoading}
                    className="h-8 px-2"
                    title="Refresh analysis"
                  >
                    <RefreshCw className={cn("h-4 w-4 text-slate-300", isLoading && "animate-spin")} />
                  </Button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Main Content Area */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
                {/* Bottleneck Input Bar */}
                <div className="rounded-2xl glass-card p-3 border border-white/10 space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                      Known Team Bottlenecks or Context
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="e.g. Waiting on API spec, QA tester out this week..."
                      value={bottlenecks}
                      onChange={(e) => setBottlenecks(e.target.value)}
                      className="flex-1 rounded-xl px-3 py-1.5 text-xs text-white glass-input focus:outline-none"
                    />
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={fetchPrioritization}
                      isLoading={isLoading}
                      className="text-xs px-3"
                    >
                      Analyze
                    </Button>
                  </div>
                </div>

                {error && (
                  <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-300">
                    <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                    <span>{error}</span>
                  </div>
                )}

                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3, 4].map((n) => (
                      <div key={n} className="h-24 rounded-2xl glass-card animate-pulse bg-slate-900/40" />
                    ))}
                  </div>
                ) : data ? (
                  <>
                    {/* Strategic Advice Card */}
                    <div className="rounded-2xl bg-gradient-to-tr from-indigo-950/60 to-violet-950/40 p-4 border border-indigo-500/30 space-y-2 shadow-glow-indigo">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-indigo-300 flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        Strategic Execution Guidance
                      </span>
                      <p className="text-xs text-slate-200 leading-relaxed">
                        {data.strategic_advice}
                      </p>
                    </div>

                    {/* Ranked Tasks List */}
                    <div className="space-y-3">
                      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                        Ranked Priority Order ({data.ranked_tasks.length} items)
                      </h4>

                      {data.ranked_tasks.length === 0 ? (
                        <div className="text-center py-8 text-xs text-slate-400">
                          No uncompleted tasks found to prioritize in this project.
                        </div>
                      ) : (
                        data.ranked_tasks.map((task: PrioritizedTaskItem) => {
                          const badge = getCategoryBadge(task.category_tag);

                          return (
                            <div
                              key={task.task_id}
                              className="rounded-2xl glass-card p-4 border border-white/10 space-y-2.5 hover:border-indigo-500/30 transition-all group"
                            >
                              {/* Top Bar */}
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="flex h-6 w-6 rounded-full bg-slate-800 text-[11px] font-bold text-white items-center justify-center font-mono border border-white/10">
                                    #{task.urgency_rank}
                                  </span>

                                  <span
                                    className={cn(
                                      "rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1",
                                      badge.style
                                    )}
                                  >
                                    {badge.icon}
                                    <span>{task.category_tag}</span>
                                  </span>
                                </div>

                                <span
                                  className={cn(
                                    "text-[10px] font-bold px-2 py-0.5 rounded border uppercase",
                                    task.recommended_priority === "CRITICAL"
                                      ? "text-rose-400 border-rose-500/30 bg-rose-500/10"
                                      : task.recommended_priority === "HIGH"
                                      ? "text-amber-400 border-amber-500/30 bg-amber-500/10"
                                      : "text-indigo-400 border-indigo-500/30 bg-indigo-500/10"
                                  )}
                                >
                                  {task.recommended_priority}
                                </span>
                              </div>

                              {/* Title */}
                              <h5 className="text-sm font-bold text-white tracking-tight">
                                {task.title}
                              </h5>

                              {/* AI Reasoning Rationale */}
                              <div className="rounded-xl bg-slate-950/60 p-2.5 border border-white/5 text-xs text-slate-300 leading-relaxed space-y-1">
                                <span className="text-[10px] font-semibold text-indigo-400 block uppercase tracking-wider">
                                  AI Rationale:
                                </span>
                                <p className="text-[11px] text-slate-300">{task.rationale}</p>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </>
                ) : null}
              </div>

              {/* Footer */}
              {data?.token_usage && (
                <div className="p-3 border-t border-white/10 bg-slate-950/40 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                  <span>Engine: {data.token_usage.model}</span>
                  <span>Total Tokens: {data.token_usage.total_tokens}</span>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};
