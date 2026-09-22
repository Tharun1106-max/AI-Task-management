import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Users,
  UserPlus,
  Trash2,
  Mail,
  CheckCircle2,
  AlertCircle,
  Layers,
  Crown,
} from "lucide-react";
import { type ProjectMember, teamService } from "../services/teamService";
import { type Project, projectService } from "../services/projectService";
import { useAuth } from "../context/AuthContext";
import { Button, Input, Modal } from "../components/ui";
import { cn } from "../lib/utils";
import type { UserRole } from "../services/authService";

export const Team: React.FC = () => {
  const { user: currentUser } = useAuth();

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Invite Member Modal
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<UserRole>("MEMBER");
  const [isInviting, setIsInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  // Load user projects
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await projectService.getProjects({ limit: 50 });
        setProjects(res.projects);
        if (res.projects.length > 0) {
          setSelectedProjectId(res.projects[0].id);
        }
      } catch (err) {
        console.error("Failed to load projects:", err);
      }
    };
    fetchProjects();
  }, []);

  // Fetch members when project changes
  const fetchMembers = async () => {
    if (!selectedProjectId) return;
    setIsLoading(true);
    try {
      const res = await teamService.getProjectMembers(selectedProjectId);
      setMembers(res.members);
    } catch (err) {
      console.error("Failed to load members:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [selectedProjectId]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      setInviteError("Email address is required.");
      return;
    }

    setInviteError(null);
    setInviteSuccess(null);
    setIsInviting(true);
    try {
      const newMember = await teamService.inviteMember(selectedProjectId, {
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      setMembers((prev) => [...prev, newMember]);
      setInviteSuccess(`Successfully added ${newMember.full_name} to the team!`);
      setTimeout(() => {
        setIsInviteOpen(false);
        setInviteEmail("");
        setInviteSuccess(null);
      }, 1200);
    } catch (err: any) {
      setInviteError(err.response?.data?.error?.message || err.response?.data?.detail || "Failed to invite member.");
    } finally {
      setIsInviting(false);
    }
  };

  const handleRemoveMember = async (userId: string, memberName: string) => {
    if (!window.confirm(`Are you sure you want to remove ${memberName} from this project?`)) return;
    try {
      await teamService.removeMember(selectedProjectId, userId);
      setMembers((prev) => prev.filter((m) => m.user_id !== userId));
    } catch (err) {
      console.error("Failed to remove member:", err);
    }
  };

  const currentProject = projects.find((p) => p.id === selectedProjectId);
  const isCurrentUserAdmin =
    currentProject?.owner_id === currentUser?.id ||
    currentUser?.role === "OWNER" ||
    currentUser?.role === "ADMIN";

  const roleBadgeStyle: Record<UserRole, string> = {
    OWNER: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    ADMIN: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20",
    MEMBER: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
    VIEWER: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-950/40 px-3 py-1 text-xs font-medium text-indigo-300 mb-2">
            <Users className="h-3.5 w-3.5 text-indigo-400" />
            <span>Collaboration & Access</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Team Management</h1>
          <p className="text-sm text-slate-400">
            Coordinate team permissions, allocate sprint task loads, and invite project collaborators.
          </p>
        </div>

        <Button
          variant="primary"
          size="md"
          glow
          leftIcon={<UserPlus className="h-4 w-4" />}
          onClick={() => setIsInviteOpen(true)}
          disabled={!isCurrentUserAdmin}
          title={!isCurrentUserAdmin ? "Only project owners or admins can invite members" : undefined}
        >
          Invite Member
        </Button>
      </div>

      {/* Project Selector Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 glass-panel rounded-2xl p-4">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Layers className="h-4 w-4 text-indigo-400 shrink-0" />
          <span className="text-xs font-semibold text-slate-300 whitespace-nowrap">Active Project:</span>
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="rounded-xl px-3 py-1.5 text-xs text-white glass-input focus:outline-none cursor-pointer w-full sm:w-64"
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>

        <div className="text-xs text-slate-400">
          Total Team Size: <span className="font-mono font-bold text-white">{members.length} members</span>
        </div>
      </div>

      {/* Members Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-56 rounded-2xl glass-card animate-pulse bg-slate-900/40" />
          ))}
        </div>
      ) : members.length === 0 ? (
        <div className="text-center rounded-3xl glass-panel p-12 space-y-3 max-w-md mx-auto">
          <p className="text-sm font-semibold text-white">No members assigned yet.</p>
          <p className="text-xs text-slate-400">Invite colleagues to start collaborating on this project.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {members.map((member) => {
            const completionRate =
              member.assigned_tasks_count > 0
                ? Math.round((member.completed_tasks_count / member.assigned_tasks_count) * 100)
                : 0;

            return (
              <motion.div
                key={member.user_id}
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ y: -3, transition: { duration: 0.2 } }}
                className="relative flex flex-col justify-between overflow-hidden rounded-2xl glass-card p-6 border border-white/10 hover:border-indigo-500/30 transition-all duration-300"
              >
                <div>
                  {/* Top Bar: Role badge & Owner icon */}
                  <div className="flex items-center justify-between mb-4">
                    <span
                      className={cn(
                        "rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider flex items-center gap-1",
                        roleBadgeStyle[member.role] || roleBadgeStyle.MEMBER
                      )}
                    >
                      {member.is_owner && <Crown className="h-3 w-3 text-amber-400" />}
                      <span>{member.is_owner ? "Project Owner" : member.role}</span>
                    </span>

                    {isCurrentUserAdmin && !member.is_owner && member.user_id !== currentUser?.id && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMember(member.user_id, member.full_name)}
                        className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-rose-500/10 transition-colors cursor-pointer"
                        title="Remove from project"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {/* Member Profile info */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-violet-600 flex items-center justify-center text-white font-bold text-base shadow-glow-indigo shrink-0">
                      {member.avatar_url ? (
                        <img
                          src={member.avatar_url}
                          alt={member.full_name}
                          className="h-full w-full rounded-2xl object-cover"
                        />
                      ) : (
                        member.full_name.charAt(0).toUpperCase()
                      )}
                    </div>
                    <div className="truncate">
                      <h3 className="text-sm font-bold text-white tracking-tight truncate">
                        {member.full_name}
                      </h3>
                      <p className="text-xs text-slate-400 truncate flex items-center gap-1">
                        <Mail className="h-3 w-3 shrink-0" />
                        <span>{member.email}</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Task Workload & Progress */}
                <div className="space-y-2 pt-4 border-t border-white/5">
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span>Task Throughput</span>
                    <span className="font-mono text-indigo-300 font-bold">{completionRate}%</span>
                  </div>

                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-900 border border-white/5">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-cyan-400 transition-all duration-500"
                      style={{ width: `${completionRate}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1">
                    <span>
                      {member.completed_tasks_count} / {member.assigned_tasks_count} tasks done
                    </span>
                    <span>
                      {member.assigned_tasks_count - member.completed_tasks_count} active
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Invite Member Modal */}
      <Modal
        isOpen={isInviteOpen}
        onClose={() => setIsInviteOpen(false)}
        title={
          <span className="flex items-center gap-2">
            <UserPlus className="h-5 w-5 text-indigo-400" />
            Invite Member to {currentProject?.name || "Project"}
          </span>
        }
        description="Add a registered TaskPilot user by their email address to grant workspace access."
      >
        <form onSubmit={handleInvite} className="space-y-4 pt-2">
          {inviteSuccess && (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs text-emerald-300">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-400" />
              <span>{inviteSuccess}</span>
            </div>
          )}

          {inviteError && (
            <div className="flex items-center gap-2 rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-300">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
              <span>{inviteError}</span>
            </div>
          )}

          <Input
            label="User Email Address"
            type="email"
            placeholder="colleague@company.com"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            leftIcon={<Mail className="h-4 w-4" />}
            required
          />

          <div className="space-y-1 text-left">
            <label className="block text-xs font-medium text-slate-300">Project Role</label>
            <select
              value={inviteRole}
              onChange={(e) => setInviteRole(e.target.value as UserRole)}
              className="w-full rounded-xl px-3 py-2 text-xs text-white glass-input focus:outline-none cursor-pointer"
            >
              <option value="MEMBER">Member (Create & Edit Tasks)</option>
              <option value="ADMIN">Admin (Manage Members & Settings)</option>
              <option value="VIEWER">Viewer (Read-Only Access)</option>
            </select>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsInviteOpen(false)}
              disabled={isInviting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              glow
              isLoading={isInviting}
              leftIcon={<UserPlus className="h-4 w-4" />}
            >
              Send Invite
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
