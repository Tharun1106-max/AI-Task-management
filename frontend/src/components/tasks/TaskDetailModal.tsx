import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Calendar,
  User,
  Link as LinkIcon,
  MessageSquare,
  Send,
  Trash2,
  Tag,
  Edit3,
} from "lucide-react";
import { taskService, type Task, type TaskPriority, type TaskStatus } from "../../services/taskService";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";

interface TaskDetailModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onTaskUpdated: (updatedTask: Task) => void;
  onTaskDeleted?: (taskId: string) => void;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task,
  isOpen,
  onClose,
  onTaskUpdated,
  onTaskDeleted,
}) => {
  const [commentText, setCommentText] = useState("");
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Edit Task State
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editPriority, setEditPriority] = useState<TaskPriority>("MEDIUM");
  const [editTags, setEditTags] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    if (task) {
      setEditTitle(task.title);
      setEditDescription(task.description || "");
      setEditDueDate(task.due_date ? new Date(task.due_date).toISOString().split("T")[0] : "");
      setEditPriority(task.priority);
      setEditTags(task.tags ? task.tags.join(", ") : "");
      setIsEditing(false);
      setEditError(null);
    }
  }, [task]);

  if (!task) return null;

  const handleStatusChange = async (newStatus: TaskStatus) => {
    setIsUpdatingStatus(true);
    try {
      const updated = await taskService.updateTask(task.id, { status: newStatus });
      onTaskUpdated(updated);
    } catch (error) {
      console.error("Failed to update task status:", error);
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handlePriorityChange = async (newPriority: TaskPriority) => {
    try {
      const updated = await taskService.updateTask(task.id, { priority: newPriority });
      onTaskUpdated(updated);
    } catch (error) {
      console.error("Failed to update task priority:", error);
    }
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task) return;
    if (!editTitle.trim()) {
      setEditError("Task title is required.");
      return;
    }

    setIsSaving(true);
    setEditError(null);
    try {
      const parsedTags = editTags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const updated = await taskService.updateTask(task.id, {
        title: editTitle.trim(),
        description: editDescription.trim() || undefined,
        due_date: editDueDate ? new Date(`${editDueDate}T12:00:00Z`).toISOString() : undefined,
        priority: editPriority,
        tags: parsedTags,
      });

      onTaskUpdated(updated);
      setIsEditing(false);
    } catch (err: any) {
      setEditError(err.response?.data?.error?.message || "Failed to update task.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setIsSubmittingComment(true);
    try {
      const updated = await taskService.addComment(task.id, commentText.trim());
      onTaskUpdated(updated);
      setCommentText("");
    } catch (error) {
      console.error("Failed to add comment:", error);
    } finally {
      setIsSubmittingComment(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!window.confirm("Are you sure you want to permanently delete this task?")) return;
    setIsDeleting(true);
    try {
      await taskService.deleteTask(task.id);
      onTaskDeleted?.(task.id);
      onClose();
    } catch (error) {
      console.error("Failed to delete task:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md"
            onClick={onClose}
          />

          {/* Modal Container */}
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative z-10 w-full max-w-2xl max-h-[90vh] flex flex-col glass-panel rounded-3xl p-6 sm:p-8 shadow-2xl border border-white/15 overflow-hidden"
          >
            {/* Header: Actions & Close */}
            <div className="flex items-center justify-between pb-4 border-b border-white/10">
              <div className="flex items-center gap-3">
                {/* Status Dropdown */}
                <select
                  value={task.status}
                  onChange={(e) => handleStatusChange(e.target.value as TaskStatus)}
                  disabled={isUpdatingStatus}
                  className="rounded-lg bg-slate-900/80 px-3 py-1.5 text-xs font-semibold text-white border border-white/10 focus:border-indigo-500 focus:outline-none cursor-pointer"
                >
                  <option value="TODO">TODO</option>
                  <option value="IN_PROGRESS">IN PROGRESS</option>
                  <option value="IN_REVIEW">IN REVIEW</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="BLOCKED">BLOCKED</option>
                </select>

                {/* Priority Dropdown */}
                <select
                  value={task.priority}
                  onChange={(e) => handlePriorityChange(e.target.value as TaskPriority)}
                  className="rounded-lg bg-slate-900/80 px-3 py-1.5 text-xs font-semibold text-white border border-white/10 focus:border-indigo-500 focus:outline-none cursor-pointer"
                >
                  <option value="LOW">Low Priority</option>
                  <option value="MEDIUM">Medium Priority</option>
                  <option value="HIGH">High Priority</option>
                  <option value="CRITICAL">Critical Priority</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(!isEditing)}
                  title={isEditing ? "Cancel Editing" : "Edit Task"}
                  className={cn(
                    "rounded-full p-2 transition-colors cursor-pointer",
                    isEditing
                      ? "bg-indigo-600/30 text-indigo-300"
                      : "text-slate-400 hover:text-white hover:bg-white/10"
                  )}
                >
                  <Edit3 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={handleDeleteTask}
                  disabled={isDeleting}
                  aria-label="Delete Task"
                  className="rounded-full p-2 text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 transition-colors cursor-pointer"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="rounded-full p-2 text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Scrollable Modal Content */}
            <div className="overflow-y-auto flex-1 py-4 space-y-6 pr-1">
              {isEditing ? (
                <form onSubmit={handleSaveEdit} className="space-y-4 py-1">
                  {editError && (
                    <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
                      {editError}
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 block">Task Title *</label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full h-10 rounded-xl px-3.5 text-xs text-white glass-input border border-white/10 bg-slate-900/60 focus:ring-2 focus:ring-indigo-500/50"
                      autoFocus
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 block">Description</label>
                    <textarea
                      value={editDescription}
                      onChange={(e) => setEditDescription(e.target.value)}
                      rows={4}
                      className="w-full rounded-xl p-3 text-xs text-white glass-input border border-white/10 bg-slate-900/60 focus:ring-2 focus:ring-indigo-500/50"
                      placeholder="Task description and acceptance criteria..."
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300 block">Target Due Date (Deadline)</label>
                      <input
                        type="date"
                        value={editDueDate}
                        onChange={(e) => setEditDueDate(e.target.value)}
                        className="w-full h-10 rounded-xl px-3 text-xs text-white glass-input border border-white/10 bg-slate-900/60 focus:ring-2 focus:ring-indigo-500/50 cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-slate-300 block">Priority</label>
                      <select
                        value={editPriority}
                        onChange={(e) => setEditPriority(e.target.value as TaskPriority)}
                        className="w-full h-10 rounded-xl px-3 text-xs text-white glass-input border border-white/10 bg-slate-900/60 focus:ring-2 focus:ring-indigo-500/50 cursor-pointer"
                      >
                        <option value="LOW">Low</option>
                        <option value="MEDIUM">Medium</option>
                        <option value="HIGH">High</option>
                        <option value="CRITICAL">Critical</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-300 block">Tags (comma-separated)</label>
                    <input
                      type="text"
                      value={editTags}
                      onChange={(e) => setEditTags(e.target.value)}
                      placeholder="e.g. backend, database, security"
                      className="w-full h-10 rounded-xl px-3.5 text-xs text-white glass-input border border-white/10 bg-slate-900/60 focus:ring-2 focus:ring-indigo-500/50"
                    />
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditing(false)}
                      disabled={isSaving}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      size="sm"
                      glow
                      isLoading={isSaving}
                    >
                      Save Changes
                    </Button>
                  </div>
                </form>
              ) : (
                <>
                  {/* Title & Description */}
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-white">{task.title}</h2>
                    <p className="mt-2 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {task.description || "No description provided for this task."}
                    </p>
                  </div>

              {/* Metadata Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 rounded-2xl bg-slate-950/40 p-4 border border-white/5 text-xs">
                <div>
                  <span className="text-slate-500 block mb-1">Assignee</span>
                  <div className="flex items-center gap-1.5 font-medium text-slate-200">
                    <User className="h-3.5 w-3.5 text-indigo-400" />
                    <span>{task.assignee_name || "Unassigned"}</span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 block mb-1">Due Date</span>
                  <div className="flex items-center gap-1.5 font-medium text-slate-200">
                    <Calendar className="h-3.5 w-3.5 text-cyan-400" />
                    <span>
                      {task.due_date
                        ? new Date(task.due_date).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : "No deadline"}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 block mb-1">Prerequisites</span>
                  <div className="flex items-center gap-1.5 font-medium text-slate-200">
                    <LinkIcon className="h-3.5 w-3.5 text-amber-400" />
                    <span>{task.dependencies?.length || 0} dependency task(s)</span>
                  </div>
                </div>
              </div>

              {/* Tags */}
              {task.tags && task.tags.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5" /> Tags
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {task.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="rounded-lg bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 text-xs text-indigo-300"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Comments Timeline */}
              <div className="space-y-4 pt-2 border-t border-white/10">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-indigo-400" />
                    Discussion & Activity ({task.comments?.length || 0})
                  </h3>
                </div>

                {/* Comment list */}
                <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                  {task.comments && task.comments.length > 0 ? (
                    task.comments.map((comment) => (
                      <div
                        key={comment.id}
                        className="rounded-xl bg-slate-900/60 p-3 border border-white/5 space-y-1"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-2 font-medium text-indigo-300">
                            <div className="h-5 w-5 rounded-full bg-indigo-600/40 flex items-center justify-center text-[9px] text-white">
                              {comment.user_name?.charAt(0).toUpperCase()}
                            </div>
                            <span>{comment.user_name}</span>
                          </div>
                          <span className="text-[10px] text-slate-500">
                            {new Date(comment.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 pl-7">{comment.content}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500 italic">No comments yet. Start the conversation!</p>
                  )}
                </div>

                {/* New Comment Input */}
                <form onSubmit={handleAddComment} className="flex gap-2">
                  <input
                    type="text"
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder="Write a comment..."
                    className="flex-1 rounded-xl px-3.5 py-2 text-xs text-white glass-input focus:outline-none"
                  />
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    isLoading={isSubmittingComment}
                    leftIcon={<Send className="h-3 w-3" />}
                  >
                    Send
                  </Button>
                </form>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  )}
</AnimatePresence>
  );
};
