import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import {
  Bell,
  X,
  CheckCircle2,
  Sparkles,
  ExternalLink,
  Kanban,
  UserPlus,
  Inbox,
} from "lucide-react";
import {
  type NotificationItem,
  notificationService,
} from "../../services/notificationService";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";

interface NotificationDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onNotificationCountChange?: (unreadCount: number) => void;
}

export const NotificationDrawer: React.FC<NotificationDrawerProps> = ({
  isOpen,
  onClose,
  onNotificationCountChange,
}) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
      const res = await notificationService.getNotifications({ limit: 50 });
      setNotifications(res.notifications);
      setUnreadCount(res.unread_count);
      onNotificationCountChange?.(res.unread_count);
    } catch (err) {
      console.error("Failed to load notifications:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
      onNotificationCountChange?.(Math.max(0, unreadCount - 1));
    } catch (err) {
      console.error("Failed to mark notification as read:", err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
      onNotificationCountChange?.(0);
    } catch (err) {
      console.error("Failed to mark all as read:", err);
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "MEMBER_INVITED":
        return <UserPlus className="h-4 w-4 text-emerald-400" />;
      case "TASK_ASSIGNED":
        return <Kanban className="h-4 w-4 text-cyan-400" />;
      case "TASK_UPDATED":
      case "TASK_COMPLETED":
        return <CheckCircle2 className="h-4 w-4 text-indigo-400" />;
      default:
        return <Sparkles className="h-4 w-4 text-violet-400" />;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop Blur */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm transition-opacity"
            onClick={onClose}
          />

          {/* Slide-over Drawer */}
          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <motion.div
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 350, damping: 32 }}
              className="w-screen max-w-md glass-panel border-l border-white/10 shadow-2xl flex flex-col h-full overflow-hidden"
            >
              {/* Header */}
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                    <Bell className="h-4 w-4" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-white tracking-tight">Notifications</h2>
                    <p className="text-[11px] text-slate-400">
                      {unreadCount} unread alert{unreadCount === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {unreadCount > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleMarkAllAsRead}
                      className="text-[11px] h-8 px-2.5"
                    >
                      Mark all read
                    </Button>
                  )}
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Notification Items List */}
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((n) => (
                      <div key={n} className="h-20 rounded-2xl glass-card animate-pulse bg-slate-900/40" />
                    ))}
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
                    <div className="h-12 w-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500">
                      <Inbox className="h-6 w-6" />
                    </div>
                    <p className="text-sm font-semibold text-white">All caught up!</p>
                    <p className="text-xs text-slate-400 max-w-xs">
                      You have acknowledged all alerts. New task assignments and team invitations will appear here.
                    </p>
                  </div>
                ) : (
                  notifications.map((item) => (
                    <motion.div
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={cn(
                        "relative rounded-2xl p-4 border transition-all duration-200 group flex items-start gap-3",
                        item.is_read
                          ? "glass-card border-white/5 opacity-70 hover:opacity-100"
                          : "glass-card border-indigo-500/30 bg-indigo-950/20"
                      )}
                    >
                      <div className="mt-0.5 shrink-0">{getNotificationIcon(item.type)}</div>

                      <div className="flex-1 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-xs font-semibold text-white tracking-tight">{item.title}</h4>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {new Date(item.created_at).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                            })}
                          </span>
                        </div>

                        <p className="text-xs text-slate-300 leading-relaxed">{item.message}</p>

                        <div className="flex items-center justify-between pt-1">
                          {item.link ? (
                            <Link
                              to={item.link}
                              onClick={onClose}
                              className="text-[11px] font-semibold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                            >
                              <span>View details</span>
                              <ExternalLink className="h-3 w-3" />
                            </Link>
                          ) : (
                            <span />
                          )}

                          {!item.is_read && (
                            <button
                              type="button"
                              onClick={(e) => handleMarkAsRead(item.id, e)}
                              className="text-[11px] text-slate-400 hover:text-indigo-400 flex items-center gap-1 transition-colors cursor-pointer"
                              title="Mark as read"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span>Mark read</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        </div>
      )}
    </AnimatePresence>
  );
};
