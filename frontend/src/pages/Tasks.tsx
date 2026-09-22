import React, { useState, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import {
  Kanban,
  List as ListIcon,
  Search,
  Plus,
  Sparkles,
  Zap,
  FileText,
  Trash2,
} from "lucide-react";
import { taskService, type Task, type TaskPriority, type TaskStatus } from "../services/taskService";
import { projectService, type Project } from "../services/projectService";
import { Button, Input, Textarea, Modal } from "../components/ui";
import { TaskCard } from "../components/tasks/TaskCard";
import { TaskDetailModal } from "../components/tasks/TaskDetailModal";
import { TaskQuickGeneratorModal } from "../components/ai/TaskQuickGeneratorModal";
import { AIPriorityDrawer } from "../components/ai/AIPriorityDrawer";
import { MeetingNotesModal } from "../components/ai/MeetingNotesModal";
import { cn } from "../lib/utils";

const KANBAN_COLUMNS: { id: TaskStatus; label: string; accent: string }[] = [
  { id: "TODO", label: "To Do", accent: "border-t-slate-500" },
  { id: "IN_PROGRESS", label: "In Progress", accent: "border-t-indigo-500" },
  { id: "IN_REVIEW", label: "In Review", accent: "border-t-amber-500" },
  { id: "COMPLETED", label: "Completed", accent: "border-t-emerald-500" },
  { id: "BLOCKED", label: "Blocked", accent: "border-t-rose-500" },
];

export const Tasks: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialProjectId = searchParams.get("project_id") || "";

  // View mode
  const [viewMode, setViewMode] = useState<"kanban" | "list">("kanban");

  // Data states
  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPriority, setSelectedPriority] = useState<TaskPriority | "ALL">("ALL");
  const [selectedStatus, setSelectedStatus] = useState<TaskStatus | "ALL">("ALL");

  // Task Detail Modal
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Create Task Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newPriority, setNewPriority] = useState<TaskPriority>("MEDIUM");
  const [newDueDate, setNewDueDate] = useState("");
  const [newTags, setNewTags] = useState("");
  const [isSubmittingTask, setIsSubmittingTask] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  // AI Tool states
  const [isQuickGenOpen, setIsQuickGenOpen] = useState(false);
  const [isPriorityDrawerOpen, setIsPriorityDrawerOpen] = useState(false);
  const [isNotesModalOpen, setIsNotesModalOpen] = useState(false);

  // Drag and drop state
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<TaskStatus | null>(null);

  // Fetch projects list for filter dropdown
  useEffect(() => {
    const loadProjects = async () => {
      try {
        const res = await projectService.getProjects({ limit: 100 });
        setProjects(res.projects);
        if (!selectedProjectId && res.projects.length > 0) {
          setSelectedProjectId(res.projects[0].id);
        }
      } catch (err) {
        console.error("Failed to load projects:", err);
      }
    };
    loadProjects();
  }, []);

  // Fetch tasks when project or filters change
  const fetchTasks = async () => {
    setIsLoading(true);
    try {
      const res = await taskService.getTasks({
        project_id: selectedProjectId || undefined,
        status: selectedStatus === "ALL" ? undefined : selectedStatus,
        priority: selectedPriority === "ALL" ? undefined : selectedPriority,
        search: searchQuery || undefined,
      });
      setTasks(res.tasks);
    } catch (err) {
      console.error("Failed to load tasks:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [selectedProjectId, selectedStatus, selectedPriority, searchQuery]);

  // Drag and Drop handlers
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, taskId: string) => {
    e.dataTransfer.setData("text/plain", taskId);
    setDraggingTaskId(taskId);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, columnId: TaskStatus) => {
    e.preventDefault();
    setDragOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>, targetStatus: TaskStatus) => {
    e.preventDefault();
    setDragOverColumn(null);
    const taskId = e.dataTransfer.getData("text/plain") || draggingTaskId;
    if (!taskId) return;

    // Optimistic UI update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, status: targetStatus } : t))
    );

    try {
      await taskService.updateTask(taskId, { status: targetStatus });
    } catch (err) {
      console.error("Failed to reassign task status:", err);
      // Revert by re-fetching
      fetchTasks();
    } finally {
      setDraggingTaskId(null);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      setCreateError("Task title is required.");
      return;
    }
    if (!selectedProjectId) {
      setCreateError("Please select a project first.");
      return;
    }

    setCreateError(null);
    setIsSubmittingTask(true);
    try {
      const parsedTags = newTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const created = await taskService.createTask({
        title: newTitle.trim(),
        description: newDescription.trim() || undefined,
        project_id: selectedProjectId,
        priority: newPriority,
        due_date: newDueDate ? new Date(newDueDate).toISOString() : undefined,
        tags: parsedTags,
      });

      setTasks((prev) => [created, ...prev]);
      setIsCreateOpen(false);
      setNewTitle("");
      setNewDescription("");
      setNewDueDate("");
      setNewTags("");
    } catch (err: any) {
      setCreateError(err.response?.data?.error?.message || "Failed to create task.");
    } finally {
      setIsSubmittingTask(false);
    }
  };

  const openTaskDetail = (task: Task) => {
    setSelectedTask(task);
    setIsDetailOpen(true);
  };

  const handleTaskUpdated = (updated: Task) => {
    setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    setSelectedTask(updated);
  };

  const handleTaskDeleted = (deletedId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== deletedId));
    setIsDetailOpen(false);
  };

  const handleDirectDeleteTask = async (taskId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this task?")) return;
    try {
      await taskService.deleteTask(taskId);
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
    } catch (err) {
      console.error("Failed to delete task:", err);
      alert("Failed to delete task. Please try again.");
    }
  };

  return (
    <div className="w-full">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-950/40 px-3 py-1 text-xs font-medium text-indigo-300 mb-2">
              <Kanban className="h-3.5 w-3.5 text-indigo-400" />
              <span>Interactive Workflow Engine</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-white">Task Management</h1>
            <p className="text-sm text-slate-400">
              Coordinate team execution across Kanban columns with drag-and-drop or structured list views.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* View Mode Toggle Switch */}
            <div className="flex items-center h-10 rounded-xl bg-slate-950/60 p-1 border border-white/10">
              <button
                type="button"
                onClick={() => setViewMode("kanban")}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer h-8",
                  viewMode === "kanban"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                )}
              >
                <Kanban className="h-3.5 w-3.5" />
                <span>Kanban</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer h-8",
                  viewMode === "list"
                    ? "bg-indigo-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                )}
              >
                <ListIcon className="h-3.5 w-3.5" />
                <span>List</span>
              </button>
            </div>

            <Button
              variant="ghost"
              size="md"
              leftIcon={<Sparkles className="h-3.5 w-3.5 text-indigo-400" />}
              onClick={() => setIsQuickGenOpen(true)}
              disabled={!selectedProjectId}
              title="Quickly generate task cards with AI"
              className="h-10 border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/20 text-slate-300 hover:text-white text-xs px-3 font-medium"
            >
              AI Quick Tasks
            </Button>

            <Button
              variant="ghost"
              size="md"
              leftIcon={<Zap className="h-3.5 w-3.5 text-amber-400" />}
              onClick={() => setIsPriorityDrawerOpen(true)}
              disabled={!selectedProjectId}
              title="Analyze bottlenecks and rank priorities with AI"
              className="h-10 border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/20 text-slate-300 hover:text-white text-xs px-3 font-medium"
            >
              AI Prioritize
            </Button>

            <Button
              variant="ghost"
              size="md"
              leftIcon={<FileText className="h-3.5 w-3.5 text-cyan-400" />}
              onClick={() => setIsNotesModalOpen(true)}
              disabled={!selectedProjectId}
              title="Parse meeting notes and extract action items"
              className="h-10 border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/20 text-slate-300 hover:text-white text-xs px-3 font-medium"
            >
              Notes to Tasks
            </Button>

            <Button
              variant="primary"
              size="md"
              glow
              leftIcon={<Plus className="h-4 w-4" />}
              onClick={() => setIsCreateOpen(true)}
              disabled={!selectedProjectId}
              className="h-10 px-4 font-semibold shadow-glow-indigo shrink-0"
            >
              New Task
            </Button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 glass-panel rounded-2xl p-4">
          {/* Project Selector */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
              Project
            </label>
            <select
              value={selectedProjectId}
              onChange={(e) => {
                const nextId = e.target.value;
                setSelectedProjectId(nextId);
                if (nextId) {
                  setSearchParams({ project_id: nextId });
                } else {
                  setSearchParams({});
                }
              }}
              className="w-full h-10 rounded-xl px-3.5 text-xs text-white glass-input border border-white/10 bg-slate-900/60 focus:ring-2 focus:ring-indigo-500/50 cursor-pointer flex items-center"
            >
              <option value="">All Projects</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Search Query */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
              Search
            </label>
            <div className="relative h-10">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search tasks..."
                className="w-full h-10 rounded-xl pl-10 pr-3.5 text-xs text-white glass-input border border-white/10 bg-slate-900/60 focus:ring-2 focus:ring-indigo-500/50"
              />
            </div>
          </div>

          {/* Priority Filter */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
              Priority
            </label>
            <select
              value={selectedPriority}
              onChange={(e) => setSelectedPriority(e.target.value as any)}
              className="w-full h-10 rounded-xl px-3.5 text-xs text-white glass-input border border-white/10 bg-slate-900/60 focus:ring-2 focus:ring-indigo-500/50 cursor-pointer flex items-center"
            >
              <option value="ALL">All Priorities</option>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>

          {/* Status Filter */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider block">
              Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as any)}
              className="w-full h-10 rounded-xl px-3.5 text-xs text-white glass-input border border-white/10 bg-slate-900/60 focus:ring-2 focus:ring-indigo-500/50 cursor-pointer flex items-center"
            >
              <option value="ALL">All Statuses</option>
              <option value="TODO">To Do</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="IN_REVIEW">In Review</option>
              <option value="COMPLETED">Completed</option>
              <option value="BLOCKED">Blocked</option>
            </select>
          </div>
        </div>

        {/* Content Views: Kanban or List */}
        {isLoading ? (
          <div className="overflow-x-auto pb-6 pt-1 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
            <div className="flex gap-4 items-start min-w-max">
              {[1, 2, 3, 4, 5].map((c) => (
                <div
                  key={c}
                  className="h-[520px] w-[300px] min-w-[280px] lg:w-[320px] lg:min-w-[320px] flex-shrink-0 rounded-2xl glass-card animate-pulse bg-slate-900/40 p-4"
                />
              ))}
            </div>
          </div>
        ) : viewMode === "kanban" ? (
          /* Kanban Board View with horizontal auto-scrolling & fixed min-widths */
          <div className="overflow-x-auto pb-6 pt-1 -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
            <div className="flex gap-4 items-start min-w-max pb-2">
              {KANBAN_COLUMNS.map((column) => {
                const columnTasks = tasks.filter((t) => t.status === column.id);
                const isOver = dragOverColumn === column.id;

                return (
                  <div
                    key={column.id}
                    onDragOver={(e) => handleDragOver(e, column.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, column.id)}
                    className={cn(
                      "flex flex-col rounded-2xl glass-panel p-3.5 transition-all duration-200 min-h-[520px] w-[300px] min-w-[280px] lg:w-[320px] lg:min-w-[320px] flex-shrink-0 border-t-4",
                      column.accent,
                      isOver && "ring-2 ring-indigo-400 bg-indigo-950/20"
                    )}
                  >
                    {/* Column Header */}
                    <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/5">
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                        {column.label}
                      </span>
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/10 text-[10px] font-semibold text-slate-300">
                        {columnTasks.length}
                      </span>
                    </div>

                    {/* Task Cards Column Stack */}
                    <div className="space-y-3 flex-1">
                      <AnimatePresence>
                        {columnTasks.map((task) => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            onClick={() => openTaskDetail(task)}
                            onDragStart={handleDragStart}
                            onDelete={handleDirectDeleteTask}
                          />
                        ))}
                      </AnimatePresence>

                      {columnTasks.length === 0 && (
                        <div className="rounded-xl border-2 border-dashed border-white/15 bg-white/[0.02] hover:border-indigo-400/40 hover:bg-indigo-500/[0.03] p-8 text-center transition-all flex flex-col items-center justify-center gap-2 group min-h-[140px]">
                          <div className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center text-slate-400 group-hover:text-indigo-300 transition-colors">
                            <Plus className="h-4 w-4" />
                          </div>
                          <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors">
                            Drop tasks here
                          </span>
                          <span className="text-[11px] text-slate-400">
                            Drag from another column to update status
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          /* List View */
          <div className="glass-panel rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-white/10 bg-slate-950/40 text-slate-400 font-semibold">
                  <tr>
                    <th className="py-3.5 px-4">Task</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Priority</th>
                    <th className="py-3.5 px-4">Assignee</th>
                    <th className="py-3.5 px-4">Due Date</th>
                    <th className="py-3.5 px-4">Comments</th>
                    <th className="py-3.5 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {tasks.length > 0 ? (
                    tasks.map((task) => (
                      <tr
                        key={task.id}
                        onClick={() => openTaskDetail(task)}
                        className="hover:bg-white/[0.04] transition-colors cursor-pointer group"
                      >
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-white">{task.title}</div>
                          {task.description && (
                            <div className="text-[11px] text-slate-400 truncate max-w-xs">
                              {task.description}
                            </div>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="rounded-md bg-white/5 px-2 py-0.5 text-[10px] font-semibold text-slate-300 border border-white/10">
                            {task.status.replace("_", " ")}
                          </span>
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="rounded-md bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-400 border border-indigo-500/20">
                            {task.priority}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-slate-300">
                          {task.assignee_name || "Unassigned"}
                        </td>
                        <td className="py-3.5 px-4 text-slate-400">
                          {task.due_date
                            ? new Date(task.due_date).toLocaleDateString(undefined, {
                                month: "short",
                                day: "numeric",
                              })
                            : "-"}
                        </td>
                        <td className="py-3.5 px-4 text-slate-400">
                          {task.comments?.length || 0}
                        </td>
                        <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={(e) => handleDirectDeleteTask(task.id, e)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                            title="Delete task"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-500">
                        No tasks match current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Create Task Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title={
          <span className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-400" />
            Create New Task
          </span>
        }
        description="Add a task to the current project roadmap with urgency priority and deadline."
      >
        <form onSubmit={handleCreateTask} className="space-y-4 pt-2">
          {createError && (
            <div className="rounded-xl bg-rose-500/10 border border-rose-500/30 p-3 text-xs text-rose-300">
              {createError}
            </div>
          )}

          <Input
            label="Task Title"
            placeholder="e.g. Implement OAuth2 Refresh Token Flow"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            required
          />

          <Textarea
            label="Task Description"
            placeholder="Define technical acceptance criteria and requirements..."
            rows={3}
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
          />

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 text-left">
              <label className="block text-xs font-medium text-slate-300">Priority</label>
              <select
                value={newPriority}
                onChange={(e) => setNewPriority(e.target.value as TaskPriority)}
                className="w-full rounded-xl px-3 py-2 text-xs text-white glass-input focus:outline-none"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>

            <Input
              label="Due Date"
              type="date"
              value={newDueDate}
              onChange={(e) => setNewDueDate(e.target.value)}
            />
          </div>

          <Input
            label="Tags (comma-separated)"
            placeholder="api, backend, auth"
            value={newTags}
            onChange={(e) => setNewTags(e.target.value)}
          />

          <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsCreateOpen(false)}
              disabled={isSubmittingTask}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              glow
              isLoading={isSubmittingTask}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Create Task
            </Button>
          </div>
        </form>
      </Modal>

      {/* Task Details Slide-over Modal */}
      <TaskDetailModal
        task={selectedTask}
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        onTaskUpdated={handleTaskUpdated}
        onTaskDeleted={handleTaskDeleted}
      />

      {/* AI Quick Task Generator Modal */}
      <TaskQuickGeneratorModal
        isOpen={isQuickGenOpen}
        onClose={() => setIsQuickGenOpen(false)}
        projectId={selectedProjectId}
        onTasksAdded={fetchTasks}
      />

      {/* AI Priority & Bottleneck Drawer */}
      <AIPriorityDrawer
        isOpen={isPriorityDrawerOpen}
        onClose={() => setIsPriorityDrawerOpen(false)}
        projectId={selectedProjectId}
      />

      {/* Meeting Notes to Tasks Modal */}
      <MeetingNotesModal
        isOpen={isNotesModalOpen}
        onClose={() => setIsNotesModalOpen(false)}
        projectId={selectedProjectId}
        onTasksAdded={fetchTasks}
      />
    </div>
  );
};
