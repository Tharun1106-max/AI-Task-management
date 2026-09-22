import React from "react";
import { motion } from "framer-motion";
import { Calendar, MessageSquare, Link as LinkIcon, AlertCircle, Trash2 } from "lucide-react";
import type { Task, TaskPriority } from "../../services/taskService";
import { cn } from "../../lib/utils";

interface TaskCardProps {
  task: Task;
  onClick: () => void;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>, taskId: string) => void;
  onDelete?: (taskId: string, e: React.MouseEvent) => void;
}

export const TaskCard: React.FC<TaskCardProps> = ({ task, onClick, onDragStart, onDelete }) => {
  const isOverdue = task.due_date ? new Date(task.due_date) < new Date() && task.status !== "COMPLETED" : false;

  const priorityConfig: Record<TaskPriority, { label: string; badge: string; border: string }> = {
    LOW: {
      label: "Low",
      badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      border: "border-l-emerald-500",
    },
    MEDIUM: {
      label: "Medium",
      badge: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
      border: "border-l-cyan-500",
    },
    HIGH: {
      label: "High",
      badge: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      border: "border-l-amber-500",
    },
    CRITICAL: {
      label: "Critical",
      badge: "bg-rose-500/10 text-rose-400 border-rose-500/20",
      border: "border-l-rose-500",
    },
  };

  const priorityStyle = priorityConfig[task.priority] || priorityConfig.MEDIUM;

  return (
    <motion.div
      layout
      layoutId={task.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -2, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.98 }}
      draggable
      onDragStart={(e: any) => onDragStart?.(e, task.id)}
      onClick={onClick}
      className={cn(
        "group relative cursor-pointer overflow-hidden rounded-xl glass-card p-4 transition-all duration-200 border border-white/10 hover:border-indigo-500/30",
        "border-l-4",
        priorityStyle.border
      )}
    >
      {/* Header: Priority & Assignee Avatar / Delete */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <span
          className={cn(
            "rounded-md px-2 py-0.5 text-[10px] font-semibold border",
            priorityStyle.badge
          )}
        >
          {priorityStyle.label}
        </span>

        <div className="flex items-center gap-1.5">
          {task.assignee_name ? (
            <div
              title={`Assigned to ${task.assignee_name}`}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-600/30 text-[10px] font-semibold text-indigo-200 border border-indigo-500/40"
            >
              {task.assignee_avatar ? (
                <img
                  src={task.assignee_avatar}
                  alt={task.assignee_name}
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                task.assignee_name.charAt(0).toUpperCase()
              )}
            </div>
          ) : (
            <span className="text-[10px] text-slate-500 italic">Unassigned</span>
          )}

          {onDelete && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onDelete(task.id, e);
              }}
              title="Delete Task"
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Task Title */}
      <h4 className="text-sm font-semibold text-white tracking-tight line-clamp-2 group-hover:text-indigo-300 transition-colors">
        {task.title}
      </h4>

      {/* Description Snippet */}
      {task.description && (
        <p className="mt-1 text-xs text-slate-400 line-clamp-2 leading-relaxed">
          {task.description}
        </p>
      )}

      {/* Tags */}
      {task.tags && task.tags.length > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1">
          {task.tags.slice(0, 3).map((tag, idx) => (
            <span
              key={idx}
              className="rounded bg-white/5 px-1.5 py-0.5 text-[9px] font-medium text-slate-300 border border-white/5"
            >
              #{tag}
            </span>
          ))}
          {task.tags.length > 3 && (
            <span className="text-[9px] text-slate-500">+{task.tags.length - 3}</span>
          )}
        </div>
      )}

      {/* Footer Info: Due Date, Dependencies, Comments */}
      <div className="mt-3.5 flex items-center justify-between border-t border-white/5 pt-2.5 text-[11px] text-slate-400">
        <div className="flex items-center gap-2">
          {task.due_date && (
            <div
              className={cn(
                "flex items-center gap-1 font-medium",
                isOverdue ? "text-rose-400" : "text-slate-400"
              )}
              title={isOverdue ? "Overdue deadline!" : "Due date"}
            >
              {isOverdue ? (
                <AlertCircle className="h-3 w-3 text-rose-400 shrink-0" />
              ) : (
                <Calendar className="h-3 w-3 shrink-0" />
              )}
              <span>{new Date(task.due_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          {task.dependencies && task.dependencies.length > 0 && (
            <div
              className="flex items-center gap-1 text-amber-400/80"
              title={`${task.dependencies.length} Prerequisite Dependencies`}
            >
              <LinkIcon className="h-3 w-3" />
              <span>{task.dependencies.length}</span>
            </div>
          )}

          <div
            className="flex items-center gap-1 text-slate-400"
            title={`${task.comments?.length || 0} Comments`}
          >
            <MessageSquare className="h-3 w-3" />
            <span>{task.comments?.length || 0}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};
