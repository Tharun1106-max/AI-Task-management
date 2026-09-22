import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Layers,
  Plus,
  Search,
  Calendar,
  FolderPlus,
  Sparkles,
  Filter,
  ArrowRight,
  Edit3,
  Trash2,
} from "lucide-react";
import { projectService, type Project, type ProjectStatus } from "../services/projectService";
import { Button, Input, Textarea, Modal } from "../components/ui";
import { cn } from "../lib/utils";

export const Projects: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "ALL">("ALL");

  // Create Project Modal state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");
  const [tags, setTags] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Edit Project Modal state
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [editStatus, setEditStatus] = useState<ProjectStatus>("ACTIVE");
  const [editTags, setEditTags] = useState("");
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  const [editFormError, setEditFormError] = useState<string | null>(null);

  const fetchProjects = async () => {
    setIsLoading(true);
    try {
      const res = await projectService.getProjects({
        status: statusFilter === "ALL" ? undefined : statusFilter,
        search: searchQuery || undefined,
      });
      setProjects(res.projects);
    } catch (error) {
      console.error("Failed to load projects:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, [statusFilter, searchQuery]);

  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setFormError("Project name is required.");
      return;
    }

    setFormError(null);
    setIsSubmitting(true);
    try {
      const parsedTags = tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const created = await projectService.createProject({
        name: name.trim(),
        description: description.trim() || undefined,
        deadline: deadline ? new Date(deadline).toISOString() : undefined,
        tags: parsedTags,
      });

      setProjects((prev) => [created, ...prev]);
      setIsCreateModalOpen(false);
      setName("");
      setDescription("");
      setDeadline("");
      setTags("");
    } catch (err: any) {
      setFormError(err.response?.data?.error?.message || "Failed to create project.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenEdit = (project: Project, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingProject(project);
    setEditName(project.name);
    setEditDescription(project.description || "");
    setEditDeadline(project.deadline ? new Date(project.deadline).toISOString().split("T")[0] : "");
    setEditStatus(project.status);
    setEditTags(project.tags ? project.tags.join(", ") : "");
    setEditFormError(null);
  };

  const handleSaveEditProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;
    if (!editName.trim()) {
      setEditFormError("Project name is required.");
      return;
    }

    setEditFormError(null);
    setIsSubmittingEdit(true);
    try {
      const parsedTags = editTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const updated = await projectService.updateProject(editingProject.id, {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
        deadline: editDeadline ? new Date(`${editDeadline}T12:00:00Z`).toISOString() : undefined,
        status: editStatus,
        tags: parsedTags,
      });

      setProjects((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setEditingProject(null);
    } catch (err: any) {
      setEditFormError(err.response?.data?.error?.message || "Failed to update project.");
    } finally {
      setIsSubmittingEdit(false);
    }
  };

  const handleDeleteProject = async (projectId: string, projectName: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (
      !window.confirm(
        `Are you sure you want to permanently delete "${projectName}" and all its tasks? This action cannot be undone.`
      )
    ) {
      return;
    }

    try {
      await projectService.deleteProject(projectId);
      setProjects((prev) => prev.filter((p) => p.id !== projectId));
    } catch (err: any) {
      alert(err.response?.data?.error?.message || "Failed to delete project.");
    }
  };

  const statusConfig: Record<ProjectStatus, { label: string; badge: string }> = {
    PLANNING: { label: "Planning", badge: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
    ACTIVE: { label: "Active", badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" },
    ON_HOLD: { label: "On Hold", badge: "bg-amber-500/10 text-amber-400 border-amber-500/20" },
    COMPLETED: { label: "Completed", badge: "bg-violet-500/10 text-violet-400 border-violet-500/20" },
    ARCHIVED: { label: "Archived", badge: "bg-slate-500/10 text-slate-400 border-slate-500/20" },
  };

  // Stagger container animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.08,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 15 },
    show: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  };

  return (
    <div className="w-full">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Header Title & CTA */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-950/40 px-3 py-1 text-xs font-medium text-indigo-300 mb-2">
              <Layers className="h-3.5 w-3.5 text-indigo-400" />
              <span>Workspace Portfolios</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Project Workspaces</h1>
            <p className="text-sm text-slate-400">
              Manage team projects, track real-time task completion progress, and coordinate sprints.
            </p>
          </div>

          <Button
            variant="primary"
            size="md"
            glow
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => setIsCreateModalOpen(true)}
          >
            New Project
          </Button>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-4 glass-panel rounded-2xl p-4">
          <div className="relative w-full md:w-96">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search projects by title or tags..."
              className="w-full rounded-xl pl-10 pr-4 py-2 text-xs text-white glass-input focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
            <span className="text-xs text-slate-400 flex items-center gap-1">
              <Filter className="h-3.5 w-3.5" /> Status:
            </span>
            {(["ALL", "ACTIVE", "PLANNING", "ON_HOLD", "COMPLETED", "ARCHIVED"] as const).map(
              (st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer shrink-0",
                    statusFilter === st
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-400 hover:text-white hover:bg-white/5"
                  )}
                >
                  {st === "ALL" ? "All" : st.replace("_", " ")}
                </button>
              )
            )}
          </div>
        </div>

        {/* Projects Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="h-56 rounded-2xl glass-card animate-pulse bg-slate-900/40 p-6"
              />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center rounded-3xl glass-panel p-12 space-y-4 max-w-md mx-auto">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-indigo-500/10 text-indigo-400">
              <FolderPlus className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold text-white">No projects found</h3>
            <p className="text-xs text-slate-400">
              {searchQuery || statusFilter !== "ALL"
                ? "Try adjusting your search criteria or filters."
                : "Create your first project to start assigning and tracking tasks."}
            </p>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={() => setIsCreateModalOpen(true)}
            >
              Create Project
            </Button>
          </div>
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {projects.map((proj) => {
              const statusInfo = statusConfig[proj.status] || statusConfig.ACTIVE;
              return (
                <motion.div
                  key={proj.id}
                  variants={itemVariants}
                  whileHover={{ y: -4, transition: { duration: 0.2 } }}
                  className="relative flex flex-col justify-between overflow-hidden rounded-2xl glass-card p-6 border border-white/10 hover:border-indigo-500/40 transition-all duration-300 group"
                >
                  {/* Top: Status & Date */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span
                        className={cn(
                          "rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                          statusInfo.badge
                        )}
                      >
                        {statusInfo.label}
                      </span>

                      <div className="flex items-center gap-1.5">
                        {proj.deadline && (
                          <div className="flex items-center gap-1 text-xs text-slate-400 mr-1">
                            <Calendar className="h-3.5 w-3.5 text-slate-500" />
                            <span>
                              {new Date(proj.deadline).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          </div>
                        )}
                        <button
                          type="button"
                          onClick={(e) => handleOpenEdit(proj, e)}
                          title="Edit Project"
                          className="h-7 w-7 rounded-lg bg-white/5 hover:bg-indigo-600/30 border border-white/10 text-slate-400 hover:text-indigo-300 flex items-center justify-center cursor-pointer transition-colors"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteProject(proj.id, proj.name, e)}
                          title="Delete Project"
                          className="h-7 w-7 rounded-lg bg-white/5 hover:bg-rose-600/30 border border-white/10 text-slate-400 hover:text-rose-400 flex items-center justify-center cursor-pointer transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <Link to={`/tasks?project_id=${proj.id}`}>
                      <h3 className="text-lg font-bold text-white tracking-tight group-hover:text-indigo-300 transition-colors">
                        {proj.name}
                      </h3>
                    </Link>

                    {proj.description && (
                      <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">
                        {proj.description}
                      </p>
                    )}

                    {/* Tags */}
                    {proj.tags && proj.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {proj.tags.map((tag, idx) => (
                          <span
                            key={idx}
                            className="rounded bg-white/5 px-2 py-0.5 text-[10px] font-medium text-slate-300 border border-white/5"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Bottom: Progress Bar & Link */}
                  <div className="mt-6 space-y-3 pt-4 border-t border-white/5">
                    <div className="flex items-center justify-between text-xs text-slate-400">
                      <span>Progress</span>
                      <span className="font-semibold text-indigo-300 font-mono">
                        {Math.round(proj.progress)}%
                      </span>
                    </div>

                    {/* Progress Track */}
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-900 border border-white/5">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${proj.progress}%` }}
                        transition={{ duration: 0.6, ease: "easeOut" }}
                        className="h-full rounded-full bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-400"
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 pt-1">
                      <span>
                        {proj.completed_tasks} / {proj.total_tasks} tasks done
                      </span>

                      <Link
                        to={`/tasks?project_id=${proj.id}`}
                        className="inline-flex items-center gap-1 font-semibold text-indigo-400 hover:text-indigo-300 transition-colors"
                      >
                        <span>View Board</span>
                        <ArrowRight className="h-3 w-3 group-hover:translate-x-1 transition-transform" />
                      </Link>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </div>

      {/* Create Project Modal */}
      <Modal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        title={
          <span className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-400" />
            Create New Project
          </span>
        }
        description="Set up an active workspace for organizing sprint milestones and AI-decomposed task backlogs."
      >
        <form onSubmit={handleCreateProject} className="space-y-4 pt-2">
          {formError && (
            <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-300">
              {formError}
            </div>
          )}

          <Input
            label="Project Name"
            placeholder="e.g. Next-Gen Mobile Redesign"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <Textarea
            label="Project Scope / Overview"
            placeholder="Outline objectives, tech stack, and milestone deliverables..."
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />

          <Input
            label="Target Deadline"
            type="date"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />

          <Input
            label="Tags (comma-separated)"
            placeholder="frontend, auth, ai-agents"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            helperText="Separate tags with commas."
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsCreateModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              glow
              isLoading={isSubmitting}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Create Project
            </Button>
          </div>
        </form>
      </Modal>

      {/* Edit Project Modal */}
      <Modal
        isOpen={!!editingProject}
        onClose={() => setEditingProject(null)}
        title={
          <span className="flex items-center gap-2">
            <Edit3 className="h-5 w-5 text-indigo-400" />
            Edit Project
          </span>
        }
        description="Update project details, timeline, and current status."
      >
        <form onSubmit={handleSaveEditProject} className="space-y-4 pt-2">
          {editFormError && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
              {editFormError}
            </div>
          )}

          <Input
            label="Project Name *"
            placeholder="e.g. Mobile App Redesign"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            autoFocus
          />

          <Textarea
            label="Description"
            placeholder="Provide context and high-level objectives..."
            value={editDescription}
            onChange={(e) => setEditDescription(e.target.value)}
            rows={3}
          />

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block">Status</label>
            <select
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value as ProjectStatus)}
              className="w-full h-10 rounded-xl px-3 text-xs text-white glass-input border border-white/10 bg-slate-900/60 focus:ring-2 focus:ring-indigo-500/50 cursor-pointer"
            >
              <option value="PLANNING">Planning</option>
              <option value="ACTIVE">Active</option>
              <option value="ON_HOLD">On Hold</option>
              <option value="COMPLETED">Completed</option>
              <option value="ARCHIVED">Archived</option>
            </select>
          </div>

          <Input
            label="Target Deadline"
            type="date"
            value={editDeadline}
            onChange={(e) => setEditDeadline(e.target.value)}
          />

          <Input
            label="Tags (comma-separated)"
            placeholder="frontend, auth, ai-agents"
            value={editTags}
            onChange={(e) => setEditTags(e.target.value)}
            helperText="Separate tags with commas."
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditingProject(null)}
              disabled={isSubmittingEdit}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              glow
              isLoading={isSubmittingEdit}
            >
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
