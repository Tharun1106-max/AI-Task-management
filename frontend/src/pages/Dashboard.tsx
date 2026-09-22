import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import {
  LayoutDashboard,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
  Layers,
  Kanban,
  RefreshCw,
  Sparkles,
  Plus,
  Bot,
  Calendar as CalendarIcon,
  Activity,
} from "lucide-react";
import { analyticsService, type DashboardAnalyticsResponse } from "../services/analyticsService";
import { RiskAnalysisWidget } from "../components/risk/RiskAnalysisWidget";
import { Button } from "../components/ui/Button";
import { cn } from "../lib/utils";

// Palette for Recharts
const PRIORITY_COLORS: Record<string, string> = {
  LOW: "#10B981", // Emerald
  MEDIUM: "#06B6D4", // Cyan
  HIGH: "#F59E0B", // Amber
  CRITICAL: "#F43F5E", // Rose
};

const DEFAULT_ANALYTICS: DashboardAnalyticsResponse = {
  summary: {
    total_projects: 0,
    total_tasks: 0,
    completed_tasks: 0,
    in_progress_tasks: 0,
    overdue_tasks: 0,
    overall_completion_rate: 0,
  },
  project_progress: [],
  status_distribution: [],
  priority_distribution: [
    { name: "LOW", count: 0, percentage: 0 },
    { name: "MEDIUM", count: 0, percentage: 0 },
    { name: "HIGH", count: 0, percentage: 0 },
    { name: "CRITICAL", count: 0, percentage: 0 },
  ],
  upcoming_deadlines: [],
  recent_activities: [],
  weekly_trends: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => ({
    day: d,
    completed: 0,
    created: 0,
  })),
};

// Custom Glassmorphic Tooltip for Recharts
const CustomGlassTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="rounded-xl glass-panel p-3 shadow-2xl border border-white/10 text-xs space-y-1">
        <p className="font-semibold text-slate-200">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={`item-${index}`} className="flex items-center gap-2" style={{ color: entry.color }}>
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="capitalize">{entry.name}:</span>
            <span className="font-mono font-bold text-white">{entry.value}</span>
          </p>
        ))}
      </div>
    );
  }
  return null;
};

// Animated Rolling Number Ticker
const NumberTicker: React.FC<{ value: number; suffix?: string }> = ({ value, suffix = "" }) => {
  return (
    <motion.span
      initial={{ opacity: 0, y: 5 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="font-bold font-mono"
    >
      {value.toLocaleString()}
      {suffix}
    </motion.span>
  );
};

export const Dashboard: React.FC = () => {
  const [data, setData] = useState<DashboardAnalyticsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      const response = await analyticsService.getDashboardAnalytics();
      setData(response || DEFAULT_ANALYTICS);
    } catch (err) {
      console.error("Failed to load dashboard analytics:", err);
      setData(DEFAULT_ANALYTICS);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  if (isLoading && !data) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8 animate-pulse">
        <div className="h-24 rounded-2xl glass-card bg-slate-900/40" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-32 rounded-2xl glass-card bg-slate-900/40" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="h-80 rounded-2xl glass-card bg-slate-900/40 lg:col-span-2" />
          <div className="h-80 rounded-2xl glass-card bg-slate-900/40" />
        </div>
      </div>
    );
  }

  const activeData = data || DEFAULT_ANALYTICS;
  const { summary, project_progress, priority_distribution, upcoming_deadlines, recent_activities, weekly_trends } = activeData;

  const statCards = [
    {
      label: "Active Projects",
      value: summary.total_projects,
      icon: Layers,
      delta: "+2 this month",
      gradient: "from-indigo-500/20 to-violet-500/10",
      accent: "text-indigo-400",
      border: "border-indigo-500/20",
    },
    {
      label: "Total Tasks Backlog",
      value: summary.total_tasks,
      icon: Kanban,
      delta: `${summary.in_progress_tasks} active in sprint`,
      gradient: "from-cyan-500/20 to-blue-500/10",
      accent: "text-cyan-400",
      border: "border-cyan-500/20",
    },
    {
      label: "Completion Rate",
      value: Math.round(summary.overall_completion_rate),
      suffix: "%",
      icon: CheckCircle2,
      delta: `${summary.completed_tasks} completed`,
      gradient: "from-emerald-500/20 to-teal-500/10",
      accent: "text-emerald-400",
      border: "border-emerald-500/20",
    },
    {
      label: "Overdue Items",
      value: summary.overdue_tasks,
      icon: AlertTriangle,
      delta: summary.overdue_tasks > 0 ? "Requires attention" : "All deadlines on track",
      gradient: "from-rose-500/20 to-pink-500/10",
      accent: "text-rose-400",
      border: "border-rose-500/20",
      isWarning: summary.overdue_tasks > 0,
    },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Welcome Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-950/40 px-3 py-1 text-xs font-medium text-indigo-300 mb-2">
            <LayoutDashboard className="h-3.5 w-3.5 text-indigo-400" />
            <span>Executive Command Center</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Engineering Analytics</h1>
          <p className="text-sm text-slate-400">
            Real-time pipeline aggregations, velocity trends, and team delivery telemetry.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={fetchAnalytics}
            disabled={isLoading}
            leftIcon={<RefreshCw className={cn("h-4 w-4 text-slate-400", isLoading && "animate-spin")} />}
            className="border border-white/10 text-slate-300 hover:text-white"
          >
            Refresh
          </Button>
          <Link to="/projects">
            <Button variant="glass" size="sm" leftIcon={<Layers className="h-4 w-4" />}>
              Projects
            </Button>
          </Link>
          <Link to="/tasks">
            <Button variant="primary" size="sm" glow leftIcon={<Kanban className="h-4 w-4" />}>
              Task Board
            </Button>
          </Link>
        </div>
      </div>

      {/* Zero Projects Welcome Banner */}
      {summary.total_projects === 0 && (
        <div className="rounded-3xl p-6 glass-panel border border-indigo-500/20 bg-gradient-to-r from-indigo-950/40 via-slate-900/50 to-slate-950/60 shadow-xl">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 mb-2">
                <Sparkles className="h-3.5 w-3.5 text-indigo-400" />
                Quick Onboarding
              </span>
              <h2 className="text-xl font-bold text-white">Welcome to TaskPilot!</h2>
              <p className="text-xs text-slate-400 mt-1 max-w-xl">
                Get started by creating your first project, using the AI Planner to synthesize a roadmap, or scheduling milestone deadlines in your Calendar.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <Link to="/projects">
                <Button variant="primary" size="sm" glow leftIcon={<Plus className="h-4 w-4" />}>
                  Create Project
                </Button>
              </Link>
              <Link to="/ai-planner">
                <Button variant="glass" size="sm" leftIcon={<Bot className="h-4 w-4 text-indigo-400" />}>
                  AI Planner
                </Button>
              </Link>
              <Link to="/calendar">
                <Button variant="glass" size="sm" leftIcon={<CalendarIcon className="h-4 w-4 text-cyan-400" />}>
                  Calendar
                </Button>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* 4 KPI Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.08 }}
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
              className={cn(
                "relative overflow-hidden rounded-2xl glass-card p-5 border transition-all duration-300",
                stat.border
              )}
            >
              {/* Background gradient blur */}
              <div
                className={cn(
                  "pointer-events-none absolute -right-6 -top-6 h-28 w-28 rounded-full blur-2xl opacity-40 bg-gradient-to-br",
                  stat.gradient
                )}
              />

              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">{stat.label}</span>
                <div className={cn("p-2 rounded-xl bg-white/5", stat.accent)}>
                  <Icon className="h-4 w-4" />
                </div>
              </div>

              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-3xl font-extrabold tracking-tight text-white">
                  <NumberTicker value={stat.value} suffix={stat.suffix} />
                </span>
                {stat.isWarning && (
                  <span className="relative flex h-2.5 w-2.5 mb-1">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500" />
                  </span>
                )}
              </div>

              <div className="mt-2 text-[11px] text-slate-400 flex items-center gap-1.5">
                <TrendingUp className="h-3 w-3 text-emerald-400" />
                <span>{stat.delta}</span>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Main Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Weekly Completion Velocity AreaChart (Span 2) */}
        <div className="lg:col-span-2 glass-panel rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Weekly Task Velocity</h3>
              <p className="text-xs text-slate-400">Created vs. completed tasks over the past 7 days.</p>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="h-2.5 w-2.5 rounded-full bg-indigo-500" /> Completed
              </span>
              <span className="flex items-center gap-1.5 text-slate-300">
                <span className="h-2.5 w-2.5 rounded-full bg-cyan-400" /> Created
              </span>
            </div>
          </div>

          <div className="h-64 w-full pt-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weekly_trends}>
                <defs>
                  <linearGradient id="completedGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#6366F1" stopOpacity={0.0} />
                  </linearGradient>
                  <linearGradient id="createdGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#06B6D4" stopOpacity={0.0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" stroke="#64748B" fontSize={11} tickLine={false} />
                <YAxis stroke="#64748B" fontSize={11} tickLine={false} allowDecimals={false} />
                <Tooltip content={<CustomGlassTooltip />} />
                <Area
                  type="monotone"
                  dataKey="completed"
                  name="Completed"
                  stroke="#6366F1"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#completedGrad)"
                />
                <Area
                  type="monotone"
                  dataKey="created"
                  name="Created"
                  stroke="#06B6D4"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#createdGrad)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Priority Breakdown Donut Chart */}
        <div className="glass-panel rounded-3xl p-6 space-y-4">
          <h3 className="text-base font-bold text-white tracking-tight">Priority Distribution</h3>
          <p className="text-xs text-slate-400">Task breakdown categorized by urgency level.</p>

          <div className="h-44 w-full relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip content={<CustomGlassTooltip />} />
                <Pie
                  data={priority_distribution}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={72}
                  paddingAngle={4}
                  dataKey="count"
                >
                  {priority_distribution.map((entry) => (
                    <Cell
                      key={`cell-${entry.name}`}
                      fill={PRIORITY_COLORS[entry.name] || "#6366F1"}
                      stroke="rgba(11, 15, 25, 0.6)"
                      strokeWidth={2}
                    />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute text-center">
              <span className="text-lg font-bold text-white">{summary.total_tasks}</span>
              <span className="text-[10px] text-slate-400 block">Total Tasks</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/5">
            {priority_distribution.map((item) => (
              <div key={item.name} className="flex items-center gap-2 text-xs">
                <span
                  className="h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: PRIORITY_COLORS[item.name] || "#6366F1" }}
                />
                <span className="text-slate-400 truncate">{item.name}</span>
                <span className="font-mono text-white ml-auto">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* AI Project Risk Monitor Widget */}
      <RiskAnalysisWidget />

      {/* Bottom Grid: Project Progress, Upcoming Deadlines, Activity Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Projects Progress (1 col) */}
        <div className="glass-panel rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white tracking-tight">Top Active Projects</h3>
            <Link to="/projects" className="text-xs text-indigo-400 hover:text-indigo-300">
              View All
            </Link>
          </div>

          <div className="space-y-4">
            {project_progress.length > 0 ? (
              project_progress.map((proj) => (
                <div key={proj.id} className="space-y-2 rounded-xl bg-slate-950/40 p-3 border border-white/5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-white truncate max-w-[170px]">
                      {proj.name}
                    </span>
                    <span className="font-mono text-indigo-300 font-bold">
                      {Math.round(proj.progress)}%
                    </span>
                  </div>

                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-900">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400"
                      style={{ width: `${proj.progress}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-500">
                    <span>{proj.status}</span>
                    <span>
                      {proj.completed_tasks} / {proj.total_tasks} done
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 italic">No active projects yet.</p>
            )}
          </div>
        </div>

        {/* Upcoming Deadlines Widget (1 col) */}
        <div className="glass-panel rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white tracking-tight">Upcoming Deadlines</h3>
            <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
              Target Dates
            </span>
          </div>

          <div className="space-y-3">
            {upcoming_deadlines.length > 0 ? (
              upcoming_deadlines.map((task) => (
                <div
                  key={task.id}
                  className={cn(
                    "flex items-start justify-between rounded-xl p-3 border text-xs transition-colors",
                    task.is_overdue
                      ? "bg-rose-500/10 border-rose-500/30"
                      : "bg-slate-950/40 border-white/5 hover:border-white/10"
                  )}
                >
                  <div className="space-y-1 truncate pr-2">
                    <div className="flex items-center gap-1.5 font-semibold text-white truncate">
                      {task.is_overdue && (
                        <span className="relative flex h-2 w-2 shrink-0">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                        </span>
                      )}
                      <span className="truncate">{task.title}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 block truncate">
                      {task.project_name}
                    </span>
                  </div>

                  <span
                    className={cn(
                      "text-[10px] font-mono shrink-0 px-2 py-0.5 rounded",
                      task.is_overdue
                        ? "text-rose-300 font-bold bg-rose-500/20"
                        : "text-slate-400 bg-white/5"
                    )}
                  >
                    {new Date(task.due_date).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 italic">No pending deadlines scheduled.</p>
            )}
          </div>
        </div>

        {/* Recent Activity Stream (1 col) */}
        <div className="glass-panel rounded-3xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-white tracking-tight">Recent Activity</h3>
            <Activity className="h-4 w-4 text-indigo-400" />
          </div>

          <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
            {recent_activities.length > 0 ? (
              recent_activities.map((act) => (
                <div
                  key={act.id}
                  className="flex items-start gap-2.5 rounded-xl bg-slate-950/40 p-2.5 border border-white/5 text-xs"
                >
                  <div className="h-6 w-6 rounded-full bg-indigo-600/30 text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                    <Activity className="h-3 w-3" />
                  </div>
                  <div className="truncate">
                    <p className="font-medium text-slate-200 truncate">{act.title}</p>
                    <p className="text-[10px] text-slate-400">
                      by <span className="text-slate-300">{act.user_name}</span> •{" "}
                      {new Date(act.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-500 italic">No logged activity yet.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
