import React, { useState, useEffect } from "react";
import {
  Activity,
  AlertTriangle,
  Clock,
  GitCommit,
  ShieldCheck,
  TrendingUp,
  Users,
  ChevronDown,
  RefreshCw,
  Maximize2,
  Minimize2,
  Calendar,
  Layers,
  Zap,
  Info,
} from "lucide-react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  Legend,
} from "recharts";
import {
  dependencyService,
  type AdvancedAnalyticsResponse,
  type HealthFactorDetail,
  type MemberWorkloadItem,
  type MilestoneTimelineItem,
} from "../services/dependencyService";
import { projectService, type Project } from "../services/projectService";
import { DependencyGraph } from "../components/graph/DependencyGraph";
import { Button } from "../components/ui";
import { cn } from "../lib/utils";

export const Analytics: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);

  const [analyticsData, setAnalyticsData] = useState<AdvancedAnalyticsResponse | null>(null);
  const [isLoadingAnalytics, setIsLoadingAnalytics] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [isGraphExpanded, setIsGraphExpanded] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "flow" | "workload" | "graph">("overview");

  // Load projects
  useEffect(() => {
    setIsLoadingProjects(true);
    projectService
      .getProjects({ limit: 50 })
      .then((res: { projects: Project[]; total: number }) => {
        setProjects(res.projects);
        if (res.projects.length > 0) {
          setSelectedProjectId(res.projects[0].id);
        }
      })
      .catch((err: any) => console.error("Failed to load projects:", err))
      .finally(() => setIsLoadingProjects(false));
  }, []);

  // Fetch advanced analytics when selected project changes
  const loadAnalytics = async (projectId: string) => {
    if (!projectId) return;
    setIsLoadingAnalytics(true);
    setError(null);
    try {
      const data = await dependencyService.getAdvancedMetrics(projectId);
      setAnalyticsData(data);
    } catch (err: any) {
      console.error("Failed to load advanced metrics:", err);
      setError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.detail ||
          "Failed to load project advanced analytics."
      );
    } finally {
      setIsLoadingAnalytics(false);
    }
  };

  useEffect(() => {
    if (selectedProjectId) {
      loadAnalytics(selectedProjectId);
    }
  }, [selectedProjectId]);

  const health = analyticsData?.health;

  // Project Health Dial color helpers
  const getHealthDialColor = (score: number) => {
    if (score >= 80) return { stroke: "#10b981", text: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" };
    if (score >= 60) return { stroke: "#06b6d4", text: "text-cyan-400", bg: "bg-cyan-500/10", border: "border-cyan-500/20" };
    if (score >= 40) return { stroke: "#f59e0b", text: "text-amber-400", bg: "bg-amber-500/10", border: "border-amber-500/20" };
    return { stroke: "#f43f5e", text: "text-rose-400", bg: "bg-rose-500/10", border: "border-rose-500/20" };
  };

  const dialStyle = health ? getHealthDialColor(health.total_health_score) : getHealthDialColor(0);

  // SVG Circular Gauge calculations
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = health
    ? circumference - (health.total_health_score / 100) * circumference
    : circumference;

  return (
    <div className="space-y-8 pb-16">
      {/* Header Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              Advanced Analytics &amp; Health Engine
              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-cyan-500/10 text-cyan-400 border border-cyan-500/20">
                Topological CPM + Health Dial
              </span>
            </h1>
            <p className="text-sm text-slate-400">
              Continuous delivery governance, composite health metrics, cumulative flow, and DAG dependency graph.
            </p>
          </div>
        </div>

        {/* Project Selector & Actions */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              disabled={isLoadingProjects || projects.length === 0}
              className="bg-slate-900/80 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50 appearance-none pr-10 cursor-pointer disabled:opacity-50"
            >
              {projects.length === 0 ? (
                <option value="">No projects available</option>
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
            onClick={() => selectedProjectId && loadAnalytics(selectedProjectId)}
            disabled={isLoadingAnalytics || !selectedProjectId}
            className="text-slate-400 hover:text-white"
          >
            <RefreshCw className={cn("h-4 w-4", isLoadingAnalytics && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="flex items-center gap-2 border-b border-white/10 pb-3">
        {[
          { id: "overview", label: "Health Overview", icon: ShieldCheck },
          { id: "graph", label: "DAG Dependency Graph", icon: GitCommit },
          { id: "flow", label: "Cumulative Flow & Velocity", icon: TrendingUp },
          { id: "workload", label: "Team Workload & Capacity", icon: Users },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as any)}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer",
                isActive
                  ? "bg-cyan-500/10 text-cyan-300 border border-cyan-500/20 shadow-glow-cyan"
                  : "text-slate-400 hover:text-white hover:bg-white/5"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Error state */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ============================================================ */}
      {/* Tab 1: Project Health Dial & Contributing Breakdown           */}
      {/* ============================================================ */}
      {activeTab === "overview" && (
        <div className="space-y-8">
          {health && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Left Column: Project Health Dial (4 cols) */}
              <div className="lg:col-span-4 p-6 rounded-3xl glass-panel border border-white/10 shadow-2xl flex flex-col items-center text-center space-y-6">
                <div className="w-full flex items-center justify-between text-xs text-slate-400 border-b border-white/5 pb-3">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <ShieldCheck className="h-4 w-4 text-cyan-400" />
                    Composite Health Metric
                  </span>
                  <span className={cn("px-2 py-0.5 rounded-full text-[10px] font-bold border", dialStyle.border, dialStyle.text, dialStyle.bg)}>
                    {health.health_status}
                  </span>
                </div>

                {/* Circular Gauge */}
                <div className="relative flex items-center justify-center">
                  <svg className="w-44 h-44 transform -rotate-90">
                    <circle
                      cx="88"
                      cy="88"
                      r={radius}
                      stroke="rgba(255,255,255,0.08)"
                      strokeWidth="12"
                      fill="transparent"
                    />
                    <circle
                      cx="88"
                      cy="88"
                      r={radius}
                      stroke={dialStyle.stroke}
                      strokeWidth="12"
                      fill="transparent"
                      strokeDasharray={circumference}
                      strokeDashoffset={strokeDashoffset}
                      strokeLinecap="round"
                      className="transition-all duration-1000 ease-out"
                    />
                  </svg>
                  <div className="absolute flex flex-col items-center">
                    <span className={cn("text-4xl font-extrabold tracking-tight font-mono", dialStyle.text)}>
                      {health.total_health_score}
                    </span>
                    <span className="text-xs text-slate-400 uppercase tracking-wider mt-0.5">
                      / 100 Index
                    </span>
                  </div>
                </div>

                {/* Health Formula Footnote */}
                <div className="w-full p-3 rounded-xl bg-slate-900/60 border border-white/5 text-[11px] text-slate-400 text-left font-mono space-y-1">
                  <p className="text-slate-300 font-semibold">Governance Formula:</p>
                  <p className="text-slate-400 leading-relaxed text-[10px]">
                    (Comp% × 0.4) + (OnTime% × 0.3) + (Unblocked% × 0.2) + (Activity × 0.1)
                  </p>
                </div>

                {/* Actionable Suggestions */}
                {health.suggestions && health.suggestions.length > 0 && (
                  <div className="w-full space-y-2 text-left">
                    <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5 text-amber-400" />
                      Governance Recommendations
                    </span>
                    <div className="space-y-1.5">
                      {health.suggestions.map((sug: string, i: number) => (
                        <div
                          key={i}
                          className="p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/15 text-amber-300/90 text-xs flex items-start gap-2"
                        >
                          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-400" />
                          <span>{sug}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right Column: Contributing Factor Breakdown Cards (8 cols) */}
              <div className="lg:col-span-8 space-y-6">
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                  <Layers className="h-4 w-4 text-cyan-400" />
                  Contributing Factor Breakdown
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {health.factors.map((fac: HealthFactorDetail, idx: number) => (
                    <div
                      key={idx}
                      className="p-5 rounded-2xl glass-card border border-white/10 hover:border-white/20 transition-all space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold text-white">{fac.name}</h3>
                        <span className="text-[11px] font-mono text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                          Weight: {Math.round(fac.weight * 100)}%
                        </span>
                      </div>

                      <div className="flex items-baseline justify-between">
                        <span className="text-2xl font-bold text-white font-mono">
                          {fac.raw_percentage}%
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          +{fac.weighted_score} pts
                        </span>
                      </div>

                      {/* Progress bar */}
                      <div className="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full transition-all duration-700"
                          style={{ width: `${Math.min(100, Math.max(0, fac.raw_percentage))}%` }}
                        />
                      </div>

                      <p className="text-xs text-slate-400">{fac.description}</p>
                    </div>
                  ))}
                </div>

                {/* Milestone Delivery Horizons */}
                {analyticsData?.milestones && (
                  <div className="p-6 rounded-3xl glass-panel border border-white/10 space-y-4">
                    <div className="flex items-center justify-between border-b border-white/10 pb-3">
                      <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-indigo-400" />
                        Milestone Delivery Horizons
                      </h3>
                      <span className="text-xs text-slate-400 font-mono">
                        {analyticsData.milestones.length} Tracked Gates
                      </span>
                    </div>

                    <div className="space-y-3">
                      {analyticsData.milestones.map((m: MilestoneTimelineItem) => (
                        <div
                          key={m.id}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-900/60 border border-white/5"
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-semibold text-white">{m.title}</span>
                              <span
                                className={cn(
                                  "text-[10px] px-2 py-0.5 rounded font-mono font-bold",
                                  m.status === "COMPLETED"
                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                    : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                )}
                              >
                                {m.status}
                              </span>
                            </div>
                            {m.target_date && (
                              <p className="text-[11px] text-slate-400 flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                Target Delivery: {new Date(m.target_date).toLocaleDateString()}
                              </p>
                            )}
                          </div>

                          <div className="flex items-center gap-3 w-full sm:w-48">
                            <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-indigo-500 rounded-full"
                                style={{ width: `${Math.min(100, Math.round(m.progress))}%` }}
                              />
                            </div>
                            <span className="text-xs font-mono text-slate-300 shrink-0">
                              {Math.round(m.progress)}%
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* Tab 2: Interactive DAG Dependency Graph                       */}
      {/* ============================================================ */}
      {activeTab === "graph" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <GitCommit className="h-4 w-4 text-cyan-400" />
                Interactive DAG Dependency Visualizer
              </h2>
              <p className="text-xs text-slate-400">
                Topological levels left-to-right, animated critical path edges, and cycle prevention.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsGraphExpanded((prev) => !prev)}
              className="p-2 rounded-xl glass-card border border-white/10 text-slate-300 hover:text-white transition-colors cursor-pointer"
              title={isGraphExpanded ? "Collapse View" : "Full Canvas"}
            >
              {isGraphExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>

          {selectedProjectId ? (
            <DependencyGraph
              projectId={selectedProjectId}
              className={isGraphExpanded ? "h-[800px]" : "h-[620px]"}
            />
          ) : (
            <div className="p-12 text-center text-slate-400 glass-card rounded-2xl">
              Select a project above to inspect its dependency graph.
            </div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* Tab 3: Cumulative Flow & Velocity                             */}
      {/* ============================================================ */}
      {activeTab === "flow" && (
        <div className="p-6 rounded-3xl glass-panel border border-white/10 space-y-6 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-indigo-400" />
                Cumulative Flow Diagram (CFD)
              </h2>
              <p className="text-xs text-slate-400">
                State transitions across sprint horizons spotlighting work-in-progress (WIP) bottlenecks.
              </p>
            </div>
            <span className="text-xs text-slate-400 font-mono">Past 7 Days Timeline</span>
          </div>

          {analyticsData?.cumulative_flow && analyticsData.cumulative_flow.length > 0 ? (
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={analyticsData.cumulative_flow}>
                  <defs>
                    <linearGradient id="colorCompleted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="colorInProgress" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.1} />
                    </linearGradient>
                    <linearGradient id="colorBlocked" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#f43f5e" stopOpacity={0.1} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                  <XAxis dataKey="date" stroke="#94a3b8" fontSize={11} />
                  <YAxis stroke="#94a3b8" fontSize={11} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "rgba(15, 23, 42, 0.95)",
                      borderColor: "rgba(255, 255, 255, 0.1)",
                      borderRadius: "16px",
                      fontSize: "12px",
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }} />
                  <Area
                    type="monotone"
                    dataKey="completed"
                    name="Completed"
                    stroke="#10b981"
                    fillOpacity={1}
                    fill="url(#colorCompleted)"
                    stackId="1"
                  />
                  <Area
                    type="monotone"
                    dataKey="in_progress"
                    name="In Progress"
                    stroke="#3b82f6"
                    fillOpacity={1}
                    fill="url(#colorInProgress)"
                    stackId="1"
                  />
                  <Area
                    type="monotone"
                    dataKey="blocked"
                    name="Blocked"
                    stroke="#f43f5e"
                    fillOpacity={1}
                    fill="url(#colorBlocked)"
                    stackId="1"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-400">No cumulative flow metrics recorded yet.</div>
          )}
        </div>
      )}

      {/* ============================================================ */}
      {/* Tab 4: Team Workload & Imbalance Heatmap                      */}
      {/* ============================================================ */}
      {activeTab === "workload" && (
        <div className="p-6 rounded-3xl glass-panel border border-white/10 space-y-6 shadow-2xl">
          <div className="flex items-center justify-between border-b border-white/10 pb-4">
            <div>
              <h2 className="text-base font-bold text-white tracking-tight flex items-center gap-2">
                <Users className="h-4 w-4 text-cyan-400" />
                Team Workload &amp; Capacity Distribution
              </h2>
              <p className="text-xs text-slate-400">
                Task distribution across team members spotlighting workload strain and critical tasks.
              </p>
            </div>
          </div>

          {analyticsData?.team_workload && analyticsData.team_workload.length > 0 ? (
            <div className="space-y-6">
              {/* Workload Bar Chart */}
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analyticsData.team_workload}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="user_name" stroke="#94a3b8" fontSize={11} />
                    <YAxis stroke="#94a3b8" fontSize={11} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "rgba(15, 23, 42, 0.95)",
                        borderColor: "rgba(255, 255, 255, 0.1)",
                        borderRadius: "16px",
                        fontSize: "12px",
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: "12px" }} />
                    <Bar dataKey="in_progress_tasks" name="In Progress" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="completed_tasks" name="Completed" fill="#10b981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="critical_priority_tasks" name="Critical Priority" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Workload Status Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                {analyticsData.team_workload.map((m: MemberWorkloadItem) => (
                  <div
                    key={m.user_id}
                    className="p-4 rounded-2xl glass-card border border-white/10 space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-white truncate">
                        {m.user_name}
                      </span>
                      <span
                        className={cn(
                          "text-[10px] px-2 py-0.5 rounded font-mono font-bold",
                          m.workload_status === "OVERLOADED"
                            ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                            : m.workload_status === "OPTIMAL"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                            : "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                        )}
                      >
                        {m.workload_status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
                      <span>Total: {m.total_tasks}</span>
                      <span>Active: {m.in_progress_tasks}</span>
                      <span className="text-rose-400">Critical: {m.critical_priority_tasks}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="p-12 text-center text-slate-400">No member workload data available.</div>
          )}
        </div>
      )}
    </div>
  );
};
