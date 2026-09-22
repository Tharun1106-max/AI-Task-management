import React, { useState, useEffect } from "react";
import {
  ShieldAlert,
  ShieldCheck,
  Flame,
  Clock,
  Users,
  Wrench,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import {
  aiService,
  type IdentifiedRiskItem,
  type RiskAnalysisResponse,
} from "../../services/aiService";
import { projectService, type Project } from "../../services/projectService";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";

interface RiskAnalysisWidgetProps {
  projectId?: string;
  className?: string;
}

export const RiskAnalysisWidget: React.FC<RiskAnalysisWidgetProps> = ({
  projectId: propProjectId,
  className,
}) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(propProjectId || "");
  const [data, setData] = useState<RiskAnalysisResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [fixingRiskId, setFixingRiskId] = useState<string | null>(null);
  const [fixSuccessMessage, setFixSuccessMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Fetch projects if not provided
  useEffect(() => {
    if (!propProjectId) {
      projectService
        .getProjects({ limit: 50 })
        .then((res) => {
          setProjects(res.projects);
          if (res.projects.length > 0 && !selectedProjectId) {
            setSelectedProjectId(res.projects[0].id);
          }
        })
        .catch(() => {});
    }
  }, [propProjectId]);

  const fetchRiskReport = async (pid: string) => {
    if (!pid) return;
    setIsLoading(true);
    setError(null);
    setFixSuccessMessage(null);
    try {
      const res = await aiService.analyzeRisks(pid);
      setData(res);
    } catch (err: any) {
      console.error("Failed to load risk analysis:", err);
      setError(err?.response?.data?.error?.message || "Failed to analyze risks.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedProjectId) {
      fetchRiskReport(selectedProjectId);
    }
  }, [selectedProjectId]);

  const handleApplyFix = async (risk: IdentifiedRiskItem) => {
    if (!risk.one_click_fix_type || !selectedProjectId) return;
    setFixingRiskId(risk.id);
    setFixSuccessMessage(null);
    try {
      const res = await aiService.applyRiskFix({
        project_id: selectedProjectId,
        risk_id: risk.id,
        fix_type: risk.one_click_fix_type,
        task_ids: risk.affected_task_ids,
      });
      setFixSuccessMessage(res.message);
      // Refresh report after remediation
      setTimeout(() => {
        fetchRiskReport(selectedProjectId);
      }, 800);
    } catch (err: any) {
      console.error("Failed to apply risk fix:", err);
      setError(err?.response?.data?.error?.message || "Failed to execute remediation.");
    } finally {
      setFixingRiskId(null);
    }
  };

  const getRiskColor = (score: number) => {
    if (score >= 80) return { text: "text-rose-400", border: "border-rose-500/40", bg: "bg-rose-500/10", stroke: "#F43F5E" };
    if (score >= 60) return { text: "text-orange-400", border: "border-orange-500/40", bg: "bg-orange-500/10", stroke: "#FB923C" };
    if (score >= 35) return { text: "text-amber-400", border: "border-amber-500/40", bg: "bg-amber-500/10", stroke: "#F59E0B" };
    return { text: "text-emerald-400", border: "border-emerald-500/40", bg: "bg-emerald-500/10", stroke: "#10B981" };
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "BOTTLENECK":
        return <Flame className="h-4 w-4 text-rose-400" />;
      case "DEADLINE_SLIPPAGE":
        return <Clock className="h-4 w-4 text-amber-400" />;
      default:
        return <Users className="h-4 w-4 text-indigo-400" />;
    }
  };

  const score = data?.overall_risk_score ?? 20;
  const colors = getRiskColor(score);

  // SVG Gauge calculations
  const radius = 48;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius;
  // Use half-circle gauge (arc from -180 deg to 0 deg)
  const arcLength = circumference * 0.75;
  const strokeDashoffset = arcLength - (arcLength * score) / 100;

  return (
    <div className={cn("glass-panel rounded-3xl p-6 border border-white/10 space-y-6", className)}>
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-rose-600/20 to-amber-600/20 border border-rose-500/30 flex items-center justify-center text-rose-400 shadow-glow-rose">
            <ShieldAlert className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white tracking-tight">
                AI Risk Detection Engine
              </h3>
              <span className="text-[10px] text-indigo-300 bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20 font-mono">
                Gemini Telemetry
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Live automated analysis across blockers, deadlines, and workload balance
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {projects.length > 0 && !propProjectId && (
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="rounded-xl px-3 py-1.5 text-xs text-white glass-input focus:outline-none cursor-pointer"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchRiskReport(selectedProjectId)}
            disabled={isLoading || !selectedProjectId}
            className="h-8 px-2"
            title="Re-analyze risks"
          >
            <RefreshCw className={cn("h-4 w-4 text-slate-300", isLoading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-300">
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {fixSuccessMessage && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs text-emerald-300">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{fixSuccessMessage}</span>
        </div>
      )}

      {/* Main Gauge & Overview Section */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
        {/* Radial Health / Risk Gauge */}
        <div className="flex flex-col items-center justify-center p-4 rounded-2xl glass-card border border-white/5 space-y-2">
          <div className="relative flex items-center justify-center w-36 h-36">
            <svg className="w-36 h-36 -rotate-90 transform" viewBox="0 0 120 120">
              {/* Background circle track */}
              <circle
                cx="60"
                cy="60"
                r={radius}
                stroke="currentColor"
                strokeWidth={strokeWidth}
                className="text-slate-800"
                fill="none"
              />
              {/* Animated risk arc */}
              <circle
                cx="60"
                cy="60"
                r={radius}
                stroke={colors.stroke}
                strokeWidth={strokeWidth}
                strokeDasharray={arcLength}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                fill="none"
                className="transition-all duration-1000 ease-out"
              />
            </svg>

            {/* Inner Gauge Text */}
            <div className="absolute flex flex-col items-center justify-center">
              <span className={cn("text-3xl font-extrabold font-mono tracking-tight", colors.text)}>
                {score}
              </span>
              <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Risk Index
              </span>
            </div>
          </div>

          <div className="text-center">
            <span
              className={cn(
                "rounded-full px-3 py-0.5 text-xs font-bold uppercase tracking-wider border",
                colors.border,
                colors.bg,
                colors.text
              )}
            >
              {data?.risk_level || "EVALUATING"} RISK
            </span>
          </div>
        </div>

        {/* Narrative Assessment */}
        <div className="md:col-span-2 space-y-3">
          <div className="rounded-2xl glass-card p-4 border border-white/5 space-y-2">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-300">
              <Sparkles className="h-4 w-4 text-indigo-400" />
              <span>Executive Risk Summary</span>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {data?.summary_assessment || "Gathering project performance telemetry..."}
            </p>
          </div>

          {/* Metrics Telemetry Row */}
          {data?.metrics_snapshot && (
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="rounded-xl bg-slate-950/40 p-2 border border-white/5">
                <span className="text-[10px] text-slate-500 block uppercase">Blocked</span>
                <span className="font-bold font-mono text-rose-400">
                  {data.metrics_snapshot.blocked_tasks || 0}
                </span>
              </div>
              <div className="rounded-xl bg-slate-950/40 p-2 border border-white/5">
                <span className="text-[10px] text-slate-500 block uppercase">Overdue</span>
                <span className="font-bold font-mono text-amber-400">
                  {data.metrics_snapshot.overdue_tasks || 0}
                </span>
              </div>
              <div className="rounded-xl bg-slate-950/40 p-2 border border-white/5">
                <span className="text-[10px] text-slate-500 block uppercase">Unassigned</span>
                <span className="font-bold font-mono text-indigo-300">
                  {data.metrics_snapshot.unassigned_critical || 0}
                </span>
              </div>
              <div className="rounded-xl bg-slate-950/40 p-2 border border-white/5">
                <span className="text-[10px] text-slate-500 block uppercase">Done</span>
                <span className="font-bold font-mono text-emerald-400">
                  {data.metrics_snapshot.completed_tasks || 0}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Identified Risk Cards */}
      <div className="space-y-3 pt-2">
        <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
          Detected Threat Vectors ({data?.identified_risks.length || 0})
        </h4>

        {data?.identified_risks.length === 0 ? (
          <div className="rounded-2xl glass-card p-6 border border-emerald-500/20 text-center space-y-2">
            <ShieldCheck className="h-8 w-8 text-emerald-400 mx-auto" />
            <p className="text-sm font-semibold text-white">Project In Healthy State</p>
            <p className="text-xs text-slate-400">
              Zero critical bottlenecks or slippages detected. Velocity is consistent with target deadlines.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data?.identified_risks.map((risk) => {
              const isFixing = fixingRiskId === risk.id;

              return (
                <div
                  key={risk.id}
                  className={cn(
                    "rounded-2xl glass-card p-4 border space-y-3 transition-all relative group",
                    risk.severity === "CRITICAL"
                      ? "border-rose-500/40 hover:border-rose-400 shadow-glow-rose"
                      : risk.severity === "HIGH"
                      ? "border-amber-500/40 hover:border-amber-400"
                      : "border-white/10 hover:border-indigo-500/30"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {getCategoryIcon(risk.risk_category)}
                      <h5 className="text-sm font-bold text-white tracking-tight">{risk.title}</h5>
                    </div>

                    <span
                      className={cn(
                        "rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border",
                        risk.severity === "CRITICAL"
                          ? "bg-rose-500/20 text-rose-300 border-rose-500/30"
                          : risk.severity === "HIGH"
                          ? "bg-amber-500/20 text-amber-300 border-amber-500/30"
                          : "bg-indigo-500/20 text-indigo-300 border-indigo-500/30"
                      )}
                    >
                      {risk.severity}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">{risk.description}</p>

                  {/* Affected Tasks Pills */}
                  {risk.affected_task_titles && risk.affected_task_titles.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] text-slate-500 uppercase font-semibold">
                        Affected Tasks:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {risk.affected_task_titles.map((title, i) => (
                          <span
                            key={i}
                            className="rounded-md bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] text-slate-300 truncate max-w-xs"
                          >
                            {title}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Suggested Action & One-Click Fix */}
                  <div className="pt-2 border-t border-white/5 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-indigo-300 flex-1 truncate" title={risk.suggested_action}>
                      Action: {risk.suggested_action}
                    </span>

                    {risk.one_click_fix_type && (
                      <Button
                        variant="primary"
                        size="sm"
                        glow
                        isLoading={isFixing}
                        onClick={() => handleApplyFix(risk)}
                        leftIcon={<Wrench className="h-3.5 w-3.5" />}
                        className="text-xs h-7 px-2.5 shrink-0"
                      >
                        Fix with One-Click
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
