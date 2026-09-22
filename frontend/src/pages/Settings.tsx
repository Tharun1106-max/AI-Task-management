import React, { useState, useEffect } from "react";
import {
  Shield,
  Lock,
  Key,
  Download,
  Laptop,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Database,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { projectService, type Project } from "../services/projectService";
import { securityService } from "../services/securityService";
import { Button } from "../components/ui";
import { cn } from "../lib/utils";

export const Settings: React.FC = () => {
  const { user } = useAuth();

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Project Export State
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedExportProjectId, setSelectedExportProjectId] = useState<string>("");
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  // Password strength validation criteria
  const hasMinLength = newPassword.length >= 8;
  const hasMixedCase = /[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword);
  const hasNumberOrSymbol = /[\d\W]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const isPasswordValid = hasMinLength && hasMixedCase && hasNumberOrSymbol && passwordsMatch;

  // Load user projects for export selector
  useEffect(() => {
    projectService
      .getProjects({ limit: 50 })
      .then((res: { projects: Project[]; total: number }) => {
        setProjects(res.projects);
        if (res.projects.length > 0) {
          setSelectedExportProjectId(res.projects[0].id);
        }
      })
      .catch((err: any) => console.error("Failed to load projects for export:", err));
  }, []);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isPasswordValid) return;

    setIsChangingPassword(true);
    setPasswordError(null);
    setPasswordSuccess(null);

    try {
      await securityService.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPasswordSuccess("Password updated successfully. Please use your new password next time you log in.");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      console.error("Password change failed:", err);
      setPasswordError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.detail ||
          "Failed to change password. Please ensure your current password is correct."
      );
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleExportProject = async () => {
    if (!selectedExportProjectId) return;
    setIsExporting(true);
    setExportError(null);

    try {
      const data = await securityService.exportProject(selectedExportProjectId);
      const jsonStr = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);

      const targetProject = projects.find((p) => p.id === selectedExportProjectId);
      const safeName = targetProject ? targetProject.name.toLowerCase().replace(/[^a-z0-9]/g, "-") : "project";

      const a = document.createElement("a");
      a.href = url;
      a.download = `taskpilot-export-${safeName}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error("Project export failed:", err);
      setExportError(
        err?.response?.data?.error?.message ||
          err?.response?.data?.detail ||
          "Failed to export project archive."
      );
    } finally {
      setIsExporting(false);
    }
  };

  // Browser / Device Detection
  const userAgent = typeof navigator !== "undefined" ? navigator.userAgent : "Web Client";
  const isWindows = /Windows/i.test(userAgent);
  const isMac = /Macintosh/i.test(userAgent);
  const isLinux = /Linux/i.test(userAgent);
  const osName = isWindows ? "Windows" : isMac ? "macOS" : isLinux ? "Linux" : "Desktop Browser";

  return (
    <div className="space-y-8 pb-16 max-w-5xl mx-auto">
      {/* Header Toolbar */}
      <div className="border-b border-white/10 pb-6">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-tr from-indigo-500/20 to-cyan-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              Security &amp; Account Settings
            </h1>
            <p className="text-sm text-slate-400">
              Manage authentication credentials, active sessions, and project data backups.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Password Management (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          <div className="p-6 sm:p-8 rounded-3xl glass-panel border border-white/10 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5">
                <Lock className="h-5 w-5 text-cyan-400" />
                <h2 className="text-base font-bold text-white tracking-tight">
                  Change Password
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setShowPassword((prev) => !prev)}
                className="text-xs text-slate-400 hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                {showPassword ? "Hide" : "Show"} Passwords
              </button>
            </div>

            {/* Status alerts */}
            {passwordSuccess && (
              <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{passwordSuccess}</span>
              </div>
            )}
            {passwordError && (
              <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{passwordError}</span>
              </div>
            )}

            <form onSubmit={handlePasswordSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-slate-300">
                  Current Password
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                  placeholder="••••••••••••"
                  className="mt-1.5 w-full bg-slate-900/90 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">
                  New Password
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  placeholder="Minimum 8 characters"
                  className="mt-1.5 w-full bg-slate-900/90 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-300">
                  Confirm New Password
                </label>
                <input
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  placeholder="Repeat new password"
                  className="mt-1.5 w-full bg-slate-900/90 border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
                />
              </div>

              {/* Password Strength Checklist */}
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-white/5 space-y-2 text-xs">
                <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">
                  Password Requirements
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-400 text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2
                      className={cn("h-3.5 w-3.5", hasMinLength ? "text-emerald-400" : "text-slate-600")}
                    />
                    <span className={cn(hasMinLength && "text-slate-200")}>At least 8 characters</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2
                      className={cn("h-3.5 w-3.5", hasMixedCase ? "text-emerald-400" : "text-slate-600")}
                    />
                    <span className={cn(hasMixedCase && "text-slate-200")}>Uppercase &amp; lowercase</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2
                      className={cn("h-3.5 w-3.5", hasNumberOrSymbol ? "text-emerald-400" : "text-slate-600")}
                    />
                    <span className={cn(hasNumberOrSymbol && "text-slate-200")}>Number or symbol</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CheckCircle2
                      className={cn("h-3.5 w-3.5", passwordsMatch ? "text-emerald-400" : "text-slate-600")}
                    />
                    <span className={cn(passwordsMatch && "text-slate-200")}>Passwords match</span>
                  </div>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <Button
                  variant="primary"
                  type="submit"
                  disabled={!isPasswordValid || isChangingPassword || !currentPassword}
                  className="flex items-center gap-2 text-xs"
                >
                  {isChangingPassword ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Key className="h-4 w-4" />
                      Update Password
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>

        {/* Right Column: Session Info & Project Export (5 cols) */}
        <div className="lg:col-span-5 space-y-6">
          {/* Active Session Info Card */}
          <div className="p-6 rounded-3xl glass-panel border border-white/10 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Laptop className="h-4 w-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">Active Session Info</h3>
              </div>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Active
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                <span className="text-slate-400">Authenticated User</span>
                <span className="font-semibold text-white">{user?.email}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                <span className="text-slate-400">Role Privilege</span>
                <span className="font-mono text-cyan-300 font-semibold">{user?.role}</span>
              </div>
              <div className="flex items-center justify-between py-1.5 border-b border-white/5">
                <span className="text-slate-400">Client Platform</span>
                <span className="text-slate-200">{osName}</span>
              </div>
              <div className="flex items-center justify-between py-1.5">
                <span className="text-slate-400">Token Lifespan</span>
                <span className="text-slate-200 font-mono">24 Hours (HS256)</span>
              </div>
            </div>
          </div>

          {/* Project JSON Backup & Export */}
          <div className="p-6 rounded-3xl glass-panel border border-white/10 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-indigo-400" />
                <h3 className="text-sm font-semibold text-white">Project Data Export</h3>
              </div>
              <span className="text-[10px] font-mono text-slate-400">JSON Archive</span>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Download complete project deliverables, including task boards, comments, attachments, milestones, and audit activities.
            </p>

            {exportError && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{exportError}</span>
              </div>
            )}

            <div className="space-y-3">
              <div className="relative">
                <select
                  value={selectedExportProjectId}
                  onChange={(e) => setSelectedExportProjectId(e.target.value)}
                  disabled={projects.length === 0}
                  className="w-full bg-slate-900 border border-white/10 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 appearance-none pr-8 cursor-pointer"
                >
                  {projects.length === 0 ? (
                    <option value="">No projects found</option>
                  ) : (
                    projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))
                  )}
                </select>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400 absolute right-3 top-3 pointer-events-none" />
              </div>

              <Button
                variant="primary"
                onClick={handleExportProject}
                disabled={!selectedExportProjectId || isExporting}
                className="w-full flex items-center justify-center gap-2 text-xs"
              >
                {isExporting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Packaging Archive...
                  </>
                ) : (
                  <>
                    <Download className="h-4 w-4" />
                    Export Project Backup
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
