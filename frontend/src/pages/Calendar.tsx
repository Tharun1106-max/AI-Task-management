import React, { useState, useEffect, useCallback } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Plus,
  Trash2,
  Edit3,
  CheckCircle2,
} from "lucide-react";
import { type CalendarEvent, calendarService } from "../services/calendarService";
import { type Project, projectService } from "../services/projectService";
import { taskService, type TaskPriority } from "../services/taskService";
import { Button, Modal, Input } from "../components/ui";
import { cn } from "../lib/utils";

export const Calendar: React.FC = () => {
  const [currentDate, setCurrentDate] = useState(new Date());

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  // Selected Day Popover state
  const [selectedDayEvents, setSelectedDayEvents] = useState<{ date: Date; events: CalendarEvent[] } | null>(null);

  // Quick Task Creation state
  const [isQuickCreateOpen, setIsQuickCreateOpen] = useState(false);
  const [quickCreateDate, setQuickCreateDate] = useState<Date | null>(null);
  const [quickDateStr, setQuickDateStr] = useState<string>(new Date().toISOString().split("T")[0]);
  const [quickTitle, setQuickTitle] = useState("");
  const [quickPriority, setQuickPriority] = useState<TaskPriority>("MEDIUM");
  const [quickProjectId, setQuickProjectId] = useState<string>("");
  const [isSubmittingQuick, setIsSubmittingQuick] = useState(false);
  const [quickError, setQuickError] = useState<string | null>(null);

  // Edit Event/Deadline state
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDueDate, setEditDueDate] = useState("");
  const [editPriority, setEditPriority] = useState<TaskPriority>("MEDIUM");
  const [editStatus, setEditStatus] = useState<string>("TODO");
  const [isUpdatingEvent, setIsUpdatingEvent] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Fetch projects
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await projectService.getProjects({ limit: 50 });
        setProjects(res.projects);
        if (res.projects.length > 0 && !quickProjectId) {
          setQuickProjectId(res.projects[0].id);
        }
      } catch (err) {
        console.error("Failed to load projects:", err);
      }
    };
    fetchProjects();
  }, []);

  // Fetch events callback
  const fetchEvents = useCallback(async () => {
    setIsLoading(true);
    try {
      // Calculate date window for current month (plus padding)
      const yr = currentDate.getFullYear();
      const mo = currentDate.getMonth();
      const start = new Date(yr, mo - 1, 20).toISOString();
      const end = new Date(yr, mo + 1, 10).toISOString();

      const res = await calendarService.getCalendarEvents({
        project_id: selectedProjectId || undefined,
        start_date: start,
        end_date: end,
      });
      setEvents(res.events);
    } catch (err) {
      console.error("Failed to load calendar events:", err);
    } finally {
      setIsLoading(false);
    }
  }, [currentDate, selectedProjectId]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Calendar Date Math
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonthDays = new Date(year, month, 0).getDate();

  // Month navigation
  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => setCurrentDate(new Date());

  // Priority styling
  const priorityColor: Record<string, { badge: string; text: string; dot: string }> = {
    LOW: { badge: "bg-emerald-500/10 border-emerald-500/30 text-emerald-300", text: "text-emerald-400", dot: "bg-emerald-400" },
    MEDIUM: { badge: "bg-cyan-500/10 border-cyan-500/30 text-cyan-300", text: "text-cyan-400", dot: "bg-cyan-400" },
    HIGH: { badge: "bg-amber-500/10 border-amber-500/30 text-amber-300", text: "text-amber-400", dot: "bg-amber-400" },
    CRITICAL: { badge: "bg-rose-500/10 border-rose-500/30 text-rose-300", text: "text-rose-400", dot: "bg-rose-400" },
  };

  // Helper to match events for a given day
  const getEventsForDay = (dayDate: Date) => {
    const dayStr = dayDate.toISOString().split("T")[0];
    return events.filter((ev) => {
      const evDateStr = new Date(ev.date).toISOString().split("T")[0];
      return evDateStr === dayStr;
    });
  };

  // Open quick create modal pre-populated with clicked date
  const handleOpenQuickCreate = (date: Date, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setQuickCreateDate(date);
    setQuickDateStr(date.toISOString().split("T")[0]);
    setQuickTitle("");
    setQuickPriority("MEDIUM");
    setQuickProjectId(selectedProjectId || (projects[0]?.id ?? ""));
    setQuickError(null);
    setIsQuickCreateOpen(true);
  };

  // Submit quick task creation
  const handleCreateQuickTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickTitle.trim()) {
      setQuickError("Task title is required.");
      return;
    }
    let targetProject = quickProjectId || selectedProjectId || projects[0]?.id;
    if (!targetProject) {
      try {
        const defaultProj = await projectService.createProject({
          name: "Main Workspace",
          description: "Workspace initialized for scheduled milestones",
        });
        targetProject = defaultProj.id;
        setProjects((prev) => [defaultProj, ...prev]);
        setSelectedProjectId(defaultProj.id);
      } catch (err: any) {
        setQuickError("Please create a project first.");
        return;
      }
    }

    setIsSubmittingQuick(true);
    setQuickError(null);
    try {
      const dateIso = quickDateStr ? new Date(`${quickDateStr}T12:00:00Z`).toISOString() : (quickCreateDate ? quickCreateDate.toISOString() : new Date().toISOString());
      await taskService.createTask({
        title: quickTitle.trim(),
        project_id: targetProject,
        priority: quickPriority,
        due_date: dateIso,
      });

      setIsQuickCreateOpen(false);
      setQuickTitle("");
      await fetchEvents();
    } catch (err: any) {
      setQuickError(err.response?.data?.error?.message || "Failed to schedule task deadline.");
    } finally {
      setIsSubmittingQuick(false);
    }
  };

  const handleOpenEditEvent = (ev: CalendarEvent) => {
    setEditingEvent(ev);
    setEditTitle(ev.title);
    setEditDueDate(ev.date ? new Date(ev.date).toISOString().split("T")[0] : "");
    setEditPriority((ev.priority as TaskPriority) || "MEDIUM");
    setEditStatus(ev.status || "TODO");
    setEditError(null);
  };

  const handleSaveEditEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent) return;
    if (!editTitle.trim()) {
      setEditError("Title is required.");
      return;
    }
    setIsUpdatingEvent(true);
    setEditError(null);
    try {
      await taskService.updateTask(editingEvent.id, {
        title: editTitle.trim(),
        due_date: editDueDate ? new Date(`${editDueDate}T12:00:00Z`).toISOString() : undefined,
        priority: editPriority,
        status: editStatus as any,
      });
      setEditingEvent(null);
      setSelectedDayEvents(null);
      await fetchEvents();
    } catch (err: any) {
      setEditError(err.response?.data?.error?.message || "Failed to update deadline.");
    } finally {
      setIsUpdatingEvent(false);
    }
  };

  const handleDeleteEventTask = async (taskId: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this deadline task?")) return;
    try {
      await taskService.deleteTask(taskId);
      if (selectedDayEvents) {
        const remaining = selectedDayEvents.events.filter((e) => e.id !== taskId);
        if (remaining.length === 0) {
          setSelectedDayEvents(null);
        } else {
          setSelectedDayEvents({ ...selectedDayEvents, events: remaining });
        }
      }
      await fetchEvents();
    } catch (err) {
      console.error("Failed to delete task:", err);
    }
  };

  const handleToggleCompleteEvent = async (ev: CalendarEvent) => {
    const nextStatus = ev.status === "COMPLETED" ? "TODO" : "COMPLETED";
    try {
      await taskService.updateTask(ev.id, { status: nextStatus as any });
      await fetchEvents();
      if (selectedDayEvents) {
        setSelectedDayEvents({
          ...selectedDayEvents,
          events: selectedDayEvents.events.map((item) =>
            item.id === ev.id ? { ...item, status: nextStatus } : item
          ),
        });
      }
    } catch (err) {
      console.error("Failed to toggle status:", err);
    }
  };

  // Generate 42 calendar grid cells (6 rows x 7 days)
  const calendarCells = [];

  // 1. Previous month days
  for (let i = firstDayOfMonth - 1; i >= 0; i--) {
    const d = new Date(year, month - 1, prevMonthDays - i);
    calendarCells.push({ date: d, isCurrentMonth: false });
  }

  // 2. Current month days
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(year, month, day);
    calendarCells.push({ date: d, isCurrentMonth: true });
  }

  // 3. Next month days
  const remaining = 42 - calendarCells.length;
  for (let day = 1; day <= remaining; day++) {
    const d = new Date(year, month + 1, day);
    calendarCells.push({ date: d, isCurrentMonth: false });
  }

  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8 pb-32">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-950/40 px-3 py-1 text-xs font-medium text-indigo-300 mb-2">
            <CalendarIcon className="h-3.5 w-3.5 text-indigo-400" />
            <span>Milestone Schedules</span>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-white">Project Calendar</h1>
          <p className="text-sm text-slate-400">
            Track release schedules, sprint milestones, and upcoming due dates.
          </p>
        </div>

        {/* Project Filter & Action */}
        <div className="flex items-center gap-3">
          <select
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            className="h-10 rounded-xl px-3.5 text-xs text-white glass-input border border-white/10 bg-slate-900/60 focus:ring-2 focus:ring-indigo-500/50 cursor-pointer flex items-center min-w-[180px]"
          >
            <option value="">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>

          <Button
            variant="primary"
            size="sm"
            glow
            leftIcon={<Plus className="h-4 w-4" />}
            onClick={() => handleOpenQuickCreate(new Date())}
          >
            Add Deadline
          </Button>
        </div>
      </div>

      {/* Calendar Controls & Month Title */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 glass-panel rounded-2xl p-4 border border-white/10">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-white tracking-tight">
            {currentDate.toLocaleString("default", { month: "long" })} {year}
          </h2>
          {isLoading && <span className="h-2 w-2 rounded-full bg-indigo-400 animate-pulse" title="Loading events..." />}
          <Button variant="ghost" size="sm" onClick={goToToday} className="text-xs h-8 px-2.5 border border-white/10 bg-white/5 hover:bg-white/10">
            Today
          </Button>
        </div>

        {/* Navigation Buttons */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={prevMonth}
            className="h-8 w-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-300 transition-colors cursor-pointer"
            title="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={nextMonth}
            className="h-8 w-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-slate-300 transition-colors cursor-pointer"
            title="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Calendar Grid Container */}
      <div className="glass-panel rounded-3xl p-4 sm:p-6 overflow-hidden border border-white/10 shadow-2xl bg-slate-950/60">
        {/* Days of Week Header */}
        <div className="grid grid-cols-7 gap-2 pb-3 mb-3 border-b border-white/10 text-center text-xs font-semibold uppercase tracking-wider text-slate-400">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div key={day}>{day}</div>
          ))}
        </div>

        {/* 42 Day Cells Grid */}
        <div className="grid grid-cols-7 gap-2 sm:gap-2.5">
          {calendarCells.map((cell, idx) => {
            const dateStr = cell.date.toISOString().split("T")[0];
            const isToday = dateStr === todayStr;
            const dayEvents = getEventsForDay(cell.date);
            const hasOverdue = dayEvents.some((ev) => ev.is_overdue);

            return (
              <div
                key={idx}
                onClick={() => {
                  if (dayEvents.length > 0) {
                    setSelectedDayEvents({ date: cell.date, events: dayEvents });
                  } else {
                    handleOpenQuickCreate(cell.date);
                  }
                }}
                className={cn(
                  "group relative min-h-[105px] sm:min-h-[125px] rounded-2xl p-2.5 border transition-all duration-200 flex flex-col justify-between cursor-pointer select-none",
                  cell.isCurrentMonth
                    ? "bg-slate-900/50 border-white/10 hover:border-indigo-400/50 hover:bg-slate-900/80 shadow-sm"
                    : "bg-slate-950/30 border-white/[0.04] opacity-35 hover:opacity-75 text-slate-500",
                  isToday && "ring-2 ring-indigo-500 border-indigo-400/60 bg-indigo-950/30 shadow-glow-indigo"
                )}
              >
                {/* Cell Header: Crisp Centered Date & Hover '+' Action */}
                <div className="flex items-center justify-between">
                  <span
                    className={cn(
                      "text-xs font-mono font-semibold h-6 w-6 rounded-full flex items-center justify-center text-center leading-none transition-transform group-hover:scale-105",
                      isToday
                        ? "bg-indigo-600 text-white font-bold shadow-glow-indigo ring-2 ring-indigo-400/50"
                        : cell.isCurrentMonth
                        ? "text-slate-300 group-hover:text-white"
                        : "text-slate-500"
                    )}
                  >
                    {cell.date.getDate()}
                  </span>

                  <div className="flex items-center gap-1">
                    {/* Overdue alert pulse */}
                    {hasOverdue && (
                      <span className="relative flex h-2 w-2 mr-1" title="Contains overdue deadline!">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
                      </span>
                    )}

                    {/* Quick Task Creation Trigger on hover */}
                    <button
                      type="button"
                      onClick={(e) => handleOpenQuickCreate(cell.date, e)}
                      title={`Quick create task for ${cell.date.toLocaleDateString()}`}
                      className="opacity-0 group-hover:opacity-100 transition-all duration-150 h-5 w-5 rounded-md bg-white/10 hover:bg-indigo-600 text-slate-300 hover:text-white flex items-center justify-center cursor-pointer hover:scale-110"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                  </div>
                </div>

                {/* Event Pills List */}
                <div className="space-y-1 my-1 overflow-hidden">
                  {dayEvents.slice(0, 2).map((ev) => {
                    const style = priorityColor[ev.priority || "MEDIUM"] || priorityColor.MEDIUM;
                    return (
                      <div
                        key={ev.id}
                        className={cn(
                          "truncate rounded-lg px-2 py-0.5 text-[10px] font-medium border flex items-center gap-1 transition-transform hover:scale-[1.02]",
                          style.badge
                        )}
                      >
                        <span className={cn("h-1.5 w-1.5 rounded-full shrink-0", style.dot)} />
                        <span className="truncate">{ev.title}</span>
                      </div>
                    );
                  })}

                  {dayEvents.length > 2 && (
                    <div className="text-[10px] text-indigo-400 font-semibold pl-1">
                      +{dayEvents.length - 2} more
                    </div>
                  )}
                </div>

                <div className="h-1" />
              </div>
            );
          })}
        </div>
      </div>

      {/* Quick Task Creation Modal */}
      <Modal
        isOpen={isQuickCreateOpen}
        onClose={() => setIsQuickCreateOpen(false)}
        title={
          <span className="flex items-center gap-2 text-white">
            <Plus className="h-5 w-5 text-indigo-400" />
            Quick Schedule Task Deadline
          </span>
        }
        description="Assign a task deadline scheduled on your workspace calendar."
      >
        <form onSubmit={handleCreateQuickTask} className="space-y-4 pt-2">
          {quickError && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{quickError}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block">Task Title *</label>
            <Input
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              placeholder="e.g. Deploy staging migration, Review API schema"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block">Target Deadline Date *</label>
            <Input
              type="date"
              value={quickDateStr}
              onChange={(e) => setQuickDateStr(e.target.value)}
              className="cursor-pointer"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">Project *</label>
              <select
                value={quickProjectId}
                onChange={(e) => setQuickProjectId(e.target.value)}
                className="w-full h-10 rounded-xl px-3 text-xs text-white glass-input border border-white/10 bg-slate-900/60 focus:ring-2 focus:ring-indigo-500/50 cursor-pointer"
              >
                {projects.length === 0 ? (
                  <option value="">Main Workspace (Auto-created)</option>
                ) : (
                  projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">Priority</label>
              <select
                value={quickPriority}
                onChange={(e) => setQuickPriority(e.target.value as TaskPriority)}
                className="w-full h-10 rounded-xl px-3 text-xs text-white glass-input border border-white/10 bg-slate-900/60 focus:ring-2 focus:ring-indigo-500/50 cursor-pointer"
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-white/10">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setIsQuickCreateOpen(false)}
              disabled={isSubmittingQuick}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              glow
              isLoading={isSubmittingQuick}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Create Deadline
            </Button>
          </div>
        </form>
      </Modal>

      {/* Day Events Inspection Drawer/Modal */}
      <Modal
        isOpen={!!selectedDayEvents}
        onClose={() => setSelectedDayEvents(null)}
        title={
          <span className="flex items-center gap-2 text-white">
            <CalendarIcon className="h-5 w-5 text-indigo-400" />
            Deadlines on {selectedDayEvents?.date.toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        }
        description="Detailed breakdown of scheduled items due on this date."
      >
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <span className="text-xs text-slate-400 font-mono">
              Total items: {selectedDayEvents?.events.length || 0}
            </span>
            <Button
              variant="ghost"
              size="sm"
              leftIcon={<Plus className="h-3.5 w-3.5 text-indigo-400" />}
              onClick={() => {
                if (selectedDayEvents) {
                  const d = selectedDayEvents.date;
                  setSelectedDayEvents(null);
                  handleOpenQuickCreate(d);
                }
              }}
              className="text-xs h-7 px-2 border border-white/10 hover:bg-white/10 text-slate-300"
            >
              Add Deadline
            </Button>
          </div>

          {selectedDayEvents?.events.map((ev) => {
            const style = priorityColor[ev.priority || "MEDIUM"] || priorityColor.MEDIUM;
            const isDone = ev.status === "COMPLETED";

            return (
              <div
                key={ev.id}
                className={cn(
                  "rounded-2xl p-4 border glass-card space-y-2.5 transition-all",
                  isDone
                    ? "border-emerald-500/20 bg-emerald-950/20 opacity-80"
                    : ev.is_overdue
                    ? "border-rose-500/40 bg-rose-500/10"
                    : "border-white/10"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className={cn(
                        "rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                        style.badge
                      )}
                    >
                      {ev.priority || "Milestone"}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono">
                      Status: <span className={cn("font-semibold", isDone ? "text-emerald-400" : "text-white")}>{ev.status}</span>
                    </span>
                  </div>

                  {/* Actions: Toggle Complete, Edit, Delete */}
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleToggleCompleteEvent(ev)}
                      title={isDone ? "Mark as in-progress" : "Mark as completed"}
                      className={cn(
                        "h-7 px-2 rounded-lg border text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer",
                        isDone
                          ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/30"
                          : "bg-white/5 border-white/10 text-slate-300 hover:bg-emerald-500/20 hover:text-emerald-300"
                      )}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>{isDone ? "Done" : "Complete"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenEditEvent(ev)}
                      title="Edit Deadline"
                      className="h-7 w-7 rounded-lg bg-white/5 hover:bg-indigo-600/30 border border-white/10 text-slate-300 hover:text-indigo-300 flex items-center justify-center cursor-pointer transition-colors"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleDeleteEventTask(ev.id)}
                      title="Delete Task"
                      className="h-7 w-7 rounded-lg bg-white/5 hover:bg-rose-600/30 border border-white/10 text-slate-300 hover:text-rose-400 flex items-center justify-center cursor-pointer transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div>
                  <h4 className={cn("text-sm font-bold text-white", isDone && "line-through text-slate-400")}>
                    {ev.title}
                  </h4>
                  <p className="text-xs text-slate-400">Project: {ev.project_name}</p>
                </div>

                {ev.is_overdue && !isDone && (
                  <div className="text-xs text-rose-400 flex items-center gap-1 pt-0.5 font-semibold">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span>Past target due date!</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Modal>

      {/* Edit Deadline Modal */}
      <Modal
        isOpen={!!editingEvent}
        onClose={() => setEditingEvent(null)}
        title={
          <span className="flex items-center gap-2 text-white">
            <Edit3 className="h-5 w-5 text-indigo-400" />
            Edit Deadline & Milestone
          </span>
        }
        description="Update schedule, priority, and completion status."
      >
        <form onSubmit={handleSaveEditEvent} className="space-y-4 pt-2">
          {editError && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{editError}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block">Task Title *</label>
            <Input
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              placeholder="Task Title"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300 block">Target Due Date *</label>
            <Input
              type="date"
              value={editDueDate}
              onChange={(e) => setEditDueDate(e.target.value)}
              className="cursor-pointer"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 block">Status</label>
              <select
                value={editStatus}
                onChange={(e) => setEditStatus(e.target.value)}
                className="w-full h-10 rounded-xl px-3 text-xs text-white glass-input border border-white/10 bg-slate-900/60 focus:ring-2 focus:ring-indigo-500/50 cursor-pointer"
              >
                <option value="TODO">To Do</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="IN_REVIEW">In Review</option>
                <option value="COMPLETED">Completed</option>
                <option value="BLOCKED">Blocked</option>
              </select>
            </div>
          </div>

          <div className="pt-3 flex items-center justify-end gap-3 border-t border-white/10">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setEditingEvent(null)}
              disabled={isUpdatingEvent}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              glow
              isLoading={isUpdatingEvent}
            >
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
