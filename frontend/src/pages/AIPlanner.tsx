import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sparkles,
  Bot,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Trash2,
  Zap,
} from "lucide-react";
import {
  aiService,
  type PlanMilestone,
  type PlanTask,
  type ProjectPlanResponse,
} from "../services/aiService";
import { projectService, type Project } from "../services/projectService";
import { Button } from "../components/ui";
import { cn } from "../lib/utils";

const DOMAIN_OPTIONS = [
  "SaaS Platform",
  "FinTech & Payments",
  "E-Commerce & Retail",
  "AI & Data Science",
  "Healthcare & MedTech",
  "Developer Tools",
  "Mobile Application",
];

const SAMPLE_PROMPTS = [
  {
    title: "AI Customer Support Co-pilot",
    domain: "AI & Data Science",
    weeks: 4,
    prompt:
      "Enterprise support co-pilot with Google Gemini integration, ticket auto-triage, vector RAG over knowledge base, and Zendesk webhook synchronization.",
  },
  {
    title: "Global Multi-Vendor Marketplace",
    domain: "E-Commerce & Retail",
    weeks: 6,
    prompt:
      "Multi-tenant marketplace with Stripe Connect payouts, real-time inventory tracking, vendor analytics dashboard, and automated invoice PDF generation.",
  },
  {
    title: "HIPAA Telemedicine Portal",
    domain: "Healthcare & MedTech",
    weeks: 8,
    prompt:
      "Encrypted patient consultation platform with WebRTC video calling, appointment calendar scheduling, doctor prescription signing, and audit logging.",
  },
];

const GENERATION_STEPS = [
  "Analyzing technical domain & architectural requirements...",
  "Synthesizing phased delivery milestones & release gates...",
  "Decomposing workstreams into granular sprint tasks...",
  "Mapping dependency graphs & resource estimations...",
  "Validating pure RFC 8259 JSON output via Pydantic...",
];

export const AIPlanner: React.FC = () => {
  const navigate = useNavigate();

  // Wizard state: 'prompt' | 'generating' | 'review'
  const [wizardStep, setWizardStep] = useState<"prompt" | "generating" | "review">("prompt");

  // Input states
  const [ideaPrompt, setIdeaPrompt] = useState("");
  const [domain, setDomain] = useState("SaaS Platform");
  const [durationWeeks, setDurationWeeks] = useState(4);

  // Generation status ticker
  const [currentStatusIndex, setCurrentStatusIndex] = useState(0);

  // Synthesized plan state
  const [plan, setPlan] = useState<ProjectPlanResponse | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [collapsedMilestones, setCollapsedMilestones] = useState<Set<string>>(new Set());

  // Existing projects for target selection
  const [existingProjects, setExistingProjects] = useState<Project[]>([]);
  const [targetProjectId, setTargetProjectId] = useState<string>("new");
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load existing projects for attach option
  useEffect(() => {
    projectService
      .getProjects({ limit: 50 })
      .then((res) => setExistingProjects(res.projects))
      .catch(() => {});
  }, []);

  // Cycle status ticker during generation
  useEffect(() => {
    let timer: any;
    if (wizardStep === "generating") {
      timer = setInterval(() => {
        setCurrentStatusIndex((prev) => (prev + 1) % GENERATION_STEPS.length);
      }, 1500);
    }
    return () => clearInterval(timer);
  }, [wizardStep]);

  const handleStartGeneration = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!ideaPrompt.trim()) {
      setError("Please describe your project idea or functional requirements.");
      return;
    }

    setError(null);
    setWizardStep("generating");
    setCurrentStatusIndex(0);

    try {
      const res = await aiService.generateProjectPlan({
        idea_prompt: ideaPrompt.trim(),
        domain,
        estimated_duration_weeks: durationWeeks,
      });

      setPlan(res);
      // Select all tasks by default
      setSelectedTaskIds(new Set(res.tasks.map((t) => t.id)));
      setWizardStep("review");
    } catch (err: any) {
      console.error("Failed to generate plan:", err);
      const errorMsg =
        err?.response?.data?.error?.message ||
        err?.response?.data?.detail ||
        (err?.code === "ECONNABORTED" ? "Generation timed out. Please try again." : null) ||
        (err?.message === "Network Error"
          ? "Cannot connect to backend server. Please verify backend is running on http://localhost:8000."
          : null) ||
        err?.message ||
        "Failed to generate AI plan. Please retry.";
      setError(errorMsg);
      setWizardStep("prompt");
    }
  };

  const toggleMilestoneCollapse = (milestoneId: string) => {
    setCollapsedMilestones((prev) => {
      const next = new Set(prev);
      if (next.has(milestoneId)) next.delete(milestoneId);
      else next.add(milestoneId);
      return next;
    });
  };

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      if (next.has(taskId)) next.delete(taskId);
      else next.add(taskId);
      return next;
    });
  };

  const handleTaskTitleChange = (taskId: string, newTitle: string) => {
    if (!plan) return;
    setPlan({
      ...plan,
      tasks: plan.tasks.map((t) => (t.id === taskId ? { ...t, title: newTitle } : t)),
    });
  };

  const handleTaskPriorityChange = (taskId: string, newPriority: any) => {
    if (!plan) return;
    setPlan({
      ...plan,
      tasks: plan.tasks.map((t) => (t.id === taskId ? { ...t, priority: newPriority } : t)),
    });
  };

  const handleRemoveTask = (taskId: string) => {
    if (!plan) return;
    setPlan({
      ...plan,
      tasks: plan.tasks.filter((t) => t.id !== taskId),
    });
    setSelectedTaskIds((prev) => {
      const next = new Set(prev);
      next.delete(taskId);
      return next;
    });
  };

  const handleApplyPlan = async () => {
    if (!plan) return;
    const chosenTasks = plan.tasks.filter((t) => selectedTaskIds.has(t.id));

    if (chosenTasks.length === 0) {
      setError("Please select at least one task to create.");
      return;
    }

    setIsApplying(true);
    setError(null);
    try {
      const payload = {
        project_id: targetProjectId === "new" ? undefined : targetProjectId,
        project_name: plan.title,
        project_description: plan.description,
        tags: plan.suggested_tags,
        tasks: chosenTasks.map((t) => ({
          title: t.title,
          description: t.description,
          priority: t.priority,
          tags: t.tags,
        })),
      };

      const res = await aiService.applyPlan(payload);
      setSuccessMessage(res.message);

      setTimeout(() => {
        navigate(`/tasks?project_id=${res.project_id}`);
      }, 1200);
    } catch (err: any) {
      console.error("Failed to apply plan:", err);
      setError(err?.response?.data?.error?.message || "Failed to persist plan to database.");
      setIsApplying(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-950/40 px-3.5 py-1 text-xs font-medium text-indigo-300 mb-2 shadow-glow-indigo">
            <Sparkles className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />
            <span>Google Gemini Acceleration</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white">
            AI Project Planner
          </h1>
          <p className="text-sm text-slate-400">
            Synthesize full-lifecycle software roadmaps, milestones, and sprint backlogs in seconds.
          </p>
        </div>

        {wizardStep === "review" && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setWizardStep("prompt")}
            className="self-start sm:self-auto"
          >
            ← Plan Another Project
          </Button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-2xl bg-rose-500/10 border border-rose-500/30 p-4 text-xs text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="flex items-center gap-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 p-4 text-xs text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{successMessage}</span>
        </div>
      )}

      {/* ==================================================================== */}
      {/* STEP 1: PROMPT WIZARD STAGE */}
      {/* ==================================================================== */}
      {wizardStep === "prompt" && (
        <div className="space-y-8">
          {/* Main Prompt Card */}
          <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-indigo-500/20 shadow-glow-indigo space-y-6">
            <form onSubmit={handleStartGeneration} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-semibold text-white flex items-center gap-2">
                  <Bot className="h-4 w-4 text-indigo-400" />
                  What product or system do you want to build?
                </label>
                <div className="relative rounded-2xl glow-border p-0.5">
                  <textarea
                    rows={4}
                    value={ideaPrompt}
                    onChange={(e) => setIdeaPrompt(e.target.value)}
                    placeholder="Describe your vision, key user stories, technical architecture needs, or business objectives..."
                    className="w-full rounded-2xl bg-slate-950/80 p-4 text-sm text-white focus:outline-none placeholder:text-slate-500 resize-none"
                    required
                  />
                </div>
              </div>

              {/* Domain and Duration Selectors */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-2">
                {/* Domain Selector */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
                    Target Domain / Industry
                  </label>
                  <select
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    className="w-full rounded-xl px-3 py-2.5 text-xs text-white glass-input focus:outline-none cursor-pointer"
                  >
                    {DOMAIN_OPTIONS.map((d) => (
                      <option key={d} value={d} className="bg-slate-900 text-white">
                        {d}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Duration Slider */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs font-semibold text-slate-300">
                    <span className="uppercase tracking-wider">Estimated Timeline</span>
                    <span className="text-indigo-400 font-mono font-bold">
                      {durationWeeks} {durationWeeks === 1 ? "Week" : "Weeks"}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={16}
                    value={durationWeeks}
                    onChange={(e) => setDurationWeeks(Number(e.target.value))}
                    className="w-full accent-indigo-500 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>1 week (Sprint MVP)</span>
                    <span>8 weeks</span>
                    <span>16 weeks (Enterprise)</span>
                  </div>
                </div>
              </div>

              {/* Submit CTA */}
              <div className="flex items-center justify-end pt-4 border-t border-white/10">
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  glow
                  leftIcon={<Sparkles className="h-4 w-4" />}
                >
                  Generate Project Plan
                </Button>
              </div>
            </form>
          </div>

          {/* Quick Inspiration Sample Cards */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-slate-300 uppercase tracking-wider">
              Or Try A Sample Project Concept
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {SAMPLE_PROMPTS.map((sample, idx) => (
                <div
                  key={idx}
                  onClick={() => {
                    setIdeaPrompt(sample.prompt);
                    setDomain(sample.domain);
                    setDurationWeeks(sample.weeks);
                  }}
                  className="rounded-2xl glass-card p-5 border border-white/10 hover:border-indigo-500/40 hover:bg-slate-900/60 transition-all cursor-pointer space-y-3 group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md border border-indigo-500/20">
                      {sample.domain}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {sample.weeks} wks
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-white group-hover:text-indigo-300 transition-colors">
                    {sample.title}
                  </h4>

                  <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                    {sample.prompt}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* STEP 2: GENERATION STREAMING STATE */}
      {/* ==================================================================== */}
      {wizardStep === "generating" && (
        <div className="glass-panel rounded-3xl p-8 sm:p-12 border border-indigo-500/20 shadow-glow-indigo text-center space-y-8">
          <div className="relative mx-auto flex h-20 w-20 items-center justify-center">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-500/30 opacity-75" />
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-cyan-400 p-0.5 shadow-glow-indigo flex items-center justify-center">
              <div className="h-full w-full rounded-[14px] bg-slate-950 flex items-center justify-center">
                <Bot className="h-8 w-8 text-indigo-400 animate-pulse" />
              </div>
            </div>
          </div>

          <div className="space-y-2 max-w-md mx-auto">
            <h2 className="text-xl font-bold text-white tracking-tight">
              Synthesizing Architecture with Google Gemini
            </h2>
            <p className="text-xs text-indigo-400 font-mono transition-all duration-300 h-6">
              {GENERATION_STEPS[currentStatusIndex]}
            </p>
          </div>

          {/* Shimmering Skeleton Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto pt-4">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-32 rounded-2xl glass-card border border-white/5 animate-pulse bg-slate-900/40 p-4 space-y-3"
              >
                <div className="h-4 w-2/3 rounded bg-white/10" />
                <div className="h-3 w-full rounded bg-white/5" />
                <div className="h-3 w-4/5 rounded bg-white/5" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* STEP 3: REVIEW & APPROVAL STAGE */}
      {/* ==================================================================== */}
      {wizardStep === "review" && plan && (
        <div className="space-y-8">
          {/* Plan Executive Overview Card */}
          <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-white/10 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <h2 className="text-2xl font-bold text-white tracking-tight">{plan.title}</h2>

              {plan.token_usage && (
                <span className="text-[10px] text-slate-400 font-mono bg-white/5 px-2.5 py-1 rounded-full border border-white/10 self-start sm:self-auto">
                  Gemini Model: {plan.token_usage.model} • {plan.token_usage.total_tokens} tokens
                </span>
              )}
            </div>

            <p className="text-sm text-slate-300 leading-relaxed max-w-4xl">
              {plan.description}
            </p>

            {plan.suggested_tags && plan.suggested_tags.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {plan.suggested_tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="rounded-full bg-indigo-500/10 border border-indigo-500/20 px-3 py-0.5 text-xs text-indigo-300 font-medium"
                  >
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Action Toolbar: Project Target Selector & Apply Button */}
          <div className="glass-panel rounded-2xl p-4 sm:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <span className="text-xs text-slate-300 font-semibold uppercase tracking-wider shrink-0">
                Destination:
              </span>
              <select
                value={targetProjectId}
                onChange={(e) => setTargetProjectId(e.target.value)}
                className="w-full sm:w-64 rounded-xl px-3 py-2 text-xs text-white glass-input focus:outline-none cursor-pointer"
              >
                <option value="new">Create Brand New Project</option>
                {existingProjects.map((p) => (
                  <option key={p.id} value={p.id}>
                    Attach to: {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
              <span className="text-xs text-slate-400 font-mono">
                {selectedTaskIds.size} of {plan.tasks.length} tasks selected
              </span>

              <Button
                variant="primary"
                size="md"
                glow
                isLoading={isApplying}
                onClick={handleApplyPlan}
                leftIcon={<Zap className="h-4 w-4" />}
              >
                Apply Plan to Workspace
              </Button>
            </div>
          </div>

          {/* Milestone Tree-View & Tasks */}
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Phased Milestones & Backlog Tasks
            </h3>

            <div className="space-y-4">
              {plan.milestones.map((m: PlanMilestone) => {
                const isCollapsed = collapsedMilestones.has(m.id);
                const milestoneTasks = plan.tasks.filter((t) => t.milestone_id === m.id);

                return (
                  <div
                    key={m.id}
                    className="rounded-3xl glass-panel border border-white/10 overflow-hidden"
                  >
                    {/* Milestone Header Banner */}
                    <div
                      onClick={() => toggleMilestoneCollapse(m.id)}
                      className="p-4 sm:p-5 flex items-center justify-between cursor-pointer hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          className="h-7 w-7 rounded-lg bg-white/5 flex items-center justify-center text-slate-400"
                        >
                          {isCollapsed ? (
                            <ChevronRight className="h-4 w-4" />
                          ) : (
                            <ChevronDown className="h-4 w-4" />
                          )}
                        </button>

                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-base font-bold text-white">{m.title}</h4>
                            <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20 font-mono">
                              Target: Week {m.target_week}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400">{m.description}</p>
                        </div>
                      </div>

                      <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                        {milestoneTasks.length} tasks
                      </span>
                    </div>

                    {/* Milestone Task List */}
                    {!isCollapsed && (
                      <div className="p-4 sm:p-6 pt-0 space-y-3">
                        {milestoneTasks.map((task: PlanTask) => {
                          const isSelected = selectedTaskIds.has(task.id);

                          return (
                            <div
                              key={task.id}
                              className={cn(
                                "rounded-2xl p-4 border transition-all space-y-2",
                                isSelected
                                  ? "glass-card border-indigo-500/30 bg-slate-900/60"
                                  : "border-white/5 bg-slate-950/20 opacity-50"
                              )}
                            >
                              <div className="flex items-start justify-between gap-3">
                                <div className="flex items-center gap-3 flex-1">
                                  {/* Checkbox */}
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleTaskSelection(task.id)}
                                    className="h-4 w-4 rounded bg-slate-800 border-white/20 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                  />

                                  {/* Editable Title */}
                                  <input
                                    type="text"
                                    value={task.title}
                                    onChange={(e) =>
                                      handleTaskTitleChange(task.id, e.target.value)
                                    }
                                    className="bg-transparent text-sm font-semibold text-white focus:outline-none focus:border-b border-indigo-400 flex-1"
                                  />
                                </div>

                                <div className="flex items-center gap-2">
                                  {/* Priority Dropdown */}
                                  <select
                                    value={task.priority}
                                    onChange={(e) =>
                                      handleTaskPriorityChange(task.id, e.target.value)
                                    }
                                    className="rounded-md border border-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider bg-slate-900 text-white cursor-pointer"
                                  >
                                    <option value="CRITICAL">Critical</option>
                                    <option value="HIGH">High</option>
                                    <option value="MEDIUM">Medium</option>
                                    <option value="LOW">Low</option>
                                  </select>

                                  <button
                                    type="button"
                                    onClick={() => handleRemoveTask(task.id)}
                                    className="text-slate-500 hover:text-rose-400 p-1 transition-colors cursor-pointer"
                                    title="Delete task"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              </div>

                              <p className="text-xs text-slate-400 pl-7">{task.description}</p>

                              <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono pl-7 pt-1">
                                <span>Effort: ~{task.estimated_days} business days</span>

                                {task.dependencies && task.dependencies.length > 0 && (
                                  <span>Prerequisites: {task.dependencies.join(", ")}</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
