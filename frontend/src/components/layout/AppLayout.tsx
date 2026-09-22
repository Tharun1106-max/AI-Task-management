import React, { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  LayoutDashboard,
  Layers,
  Kanban,
  Calendar as CalendarIcon,
  Users,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Bell,
  User,
  LogOut,
  FileText,
  Activity,
  Settings as SettingsIcon,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { ProfileModal } from "../ProfileModal";
import { NotificationDrawer } from "../notifications/NotificationDrawer";
import { AIChatCopilot } from "../ai/AIChatCopilot";
import { notificationService } from "../../services/notificationService";
import { DynamicBackground } from "../ui/DynamicBackground";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";

interface AppLayoutProps {
  children: React.ReactNode;
}

export const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [isNotificationDrawerOpen, setIsNotificationDrawerOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Fetch initial unread count
  useEffect(() => {
    if (isAuthenticated) {
      notificationService
        .getNotifications({ page: 1, limit: 1 })
        .then((res) => {
          setUnreadCount(res.unread_count);
        })
        .catch(() => {});
    }
  }, [isAuthenticated]);

  const navItems = [
    { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { label: "Analytics", href: "/analytics", icon: Activity },
    { label: "AI Planner", href: "/ai-planner", icon: Bot },
    { label: "Documents", href: "/documents", icon: FileText },
    { label: "Projects", href: "/projects", icon: Layers },
    { label: "Task Board", href: "/tasks", icon: Kanban },
    { label: "Calendar", href: "/calendar", icon: CalendarIcon },
    { label: "Team", href: "/team", icon: Users },
    { label: "Settings", href: "/settings", icon: SettingsIcon },
    { label: "Showcase", href: "/showcase", icon: Sparkles },
  ];

  // Dynamic breadcrumb generation
  const getBreadcrumbs = () => {
    const path = location.pathname;
    if (path === "/dashboard") return ["Executive", "Analytics Dashboard"];
    if (path === "/analytics") return ["Intelligence", "Advanced Analytics & Health"];
    if (path === "/ai-planner") return ["Intelligence", "AI Project Planner"];
    if (path === "/documents") return ["Knowledge", "Document RAG & Specs"];
    if (path === "/projects") return ["Workspaces", "Projects Portfolio"];
    if (path === "/tasks") return ["Execution", "Task Board"];
    if (path === "/calendar") return ["Schedule", "Calendar & Milestones"];
    if (path === "/team") return ["Organization", "Team & Members"];
    if (path === "/settings") return ["Account", "Security & Settings"];
    if (path === "/showcase" || path === "/") return ["Product", "Design Showcase"];
    return ["TaskPilot", "Workspace"];
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <DynamicBackground showOverlay="grid" intensity="subtle">
      <div className="flex min-h-screen w-full">
        {/* Desktop Collapsible Sidebar */}
        <motion.aside
          animate={{ width: isCollapsed ? 76 : 240 }}
          transition={{ type: "spring", stiffness: 350, damping: 30 }}
          className="hidden md:flex flex-col justify-between sticky top-0 h-screen border-r border-white/10 glass-panel z-30 overflow-hidden"
        >
          {/* Brand Header */}
          <div className="p-4 space-y-6">
            <div className="flex items-center justify-between">
              <Link to="/" className="flex items-center gap-3 overflow-hidden">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-cyan-400 p-0.5 shadow-glow-indigo">
                  <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-slate-950">
                    <Bot className="h-5 w-5 text-indigo-400" />
                  </div>
                </div>

                <AnimatePresence>
                  {!isCollapsed && (
                    <motion.div
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: "auto" }}
                      exit={{ opacity: 0, width: 0 }}
                      className="whitespace-nowrap"
                    >
                      <span className="text-base font-bold tracking-tight text-white block">
                        TaskPilot
                      </span>
                      <span className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wider block">
                        Enterprise AI
                      </span>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Link>

              {/* Collapse Toggle Button */}
              <button
                type="button"
                onClick={() => setIsCollapsed((prev) => !prev)}
                className="h-7 w-7 rounded-lg bg-white/5 hover:bg-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors cursor-pointer"
                title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </button>
            </div>

            {/* Navigation List */}
            <nav className="space-y-1.5">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href;

                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      "relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-colors group",
                      isActive
                        ? "text-white"
                        : "text-slate-400 hover:text-slate-100 hover:bg-white/5"
                    )}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-indigo-400" : "text-slate-400 group-hover:text-slate-200")} />

                    <AnimatePresence>
                      {!isCollapsed && (
                        <motion.span
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="whitespace-nowrap"
                        >
                          {item.label}
                        </motion.span>
                      )}
                    </AnimatePresence>

                    {/* Active Nav Pill Transition */}
                    {isActive && (
                      <motion.div
                        layoutId="active-nav-pill"
                        className="absolute inset-0 z-[-1] rounded-xl bg-indigo-600/20 border border-indigo-500/30"
                        transition={{ type: "spring", stiffness: 400, damping: 30 }}
                      />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Sidebar Footer User Info */}
          <div className="p-3 border-t border-white/10">
            {isAuthenticated && user ? (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsProfileOpen(true)}
                  className="flex items-center gap-2 w-full p-2 rounded-xl hover:bg-white/5 transition-colors text-left cursor-pointer overflow-hidden"
                  title="Profile Settings"
                >
                  <div className="h-8 w-8 shrink-0 rounded-full bg-indigo-600/40 flex items-center justify-center font-bold text-xs text-white border border-indigo-500/30">
                    {user.avatar_url ? (
                      <img src={user.avatar_url} alt={user.full_name} className="h-full w-full rounded-full object-cover" />
                    ) : (
                      user.full_name.charAt(0).toUpperCase()
                    )}
                  </div>

                  {!isCollapsed && (
                    <div className="truncate flex-1">
                      <p className="text-xs font-semibold text-white truncate">{user.full_name}</p>
                      <p className="text-[10px] text-slate-400 truncate">{user.role}</p>
                    </div>
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-1">
                <Link to="/login" className="w-full block">
                  <Button variant="ghost" size="sm" className="w-full justify-start text-xs">
                    <User className="h-3.5 w-3.5" />
                    {!isCollapsed && <span>Sign In</span>}
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </motion.aside>

        {/* Main Content Area with Top Glass Header */}
        <div className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
          {/* Top Glass Header */}
          <header className="sticky top-0 z-20 h-16 border-b border-white/10 glass-panel px-4 sm:px-6 flex items-center justify-between">
            {/* Breadcrumbs */}
            <div className="flex items-center gap-2 text-xs">
              <span className="text-slate-400">{breadcrumbs[0]}</span>
              <span className="text-slate-600">/</span>
              <span className="font-semibold text-white">{breadcrumbs[1]}</span>
            </div>

            {/* Header Right Actions */}
            <div className="flex items-center gap-3">
              <a
                href="http://localhost:8000/docs"
                target="_blank"
                rel="noreferrer"
                className="hidden sm:inline-flex"
              >
                <Button variant="ghost" size="sm" leftIcon={<FileText className="h-3.5 w-3.5" />}>
                  API Docs
                </Button>
              </a>

              {/* Notification Bell with Badge */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsNotificationDrawerOpen(true)}
                  className="relative p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
                  aria-label="Notifications"
                >
                  <Bell className="h-4 w-4" />
                  {/* Pulsing Alert Ping when unread exists */}
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 flex h-3 w-3 items-center justify-center">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500" />
                    </span>
                  )}
                </button>
              </div>

              {/* User Profile Trigger */}
              {isAuthenticated && user ? (
                <div className="flex items-center gap-2">
                  <Button
                    variant="glass"
                    size="sm"
                    leftIcon={<User className="h-3.5 w-3.5 text-indigo-400" />}
                    onClick={() => setIsProfileOpen(true)}
                  >
                    <span className="hidden sm:inline">{user.full_name}</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => logout()}
                    leftIcon={<LogOut className="h-3.5 w-3.5" />}
                    className="hidden sm:inline-flex"
                  >
                    Logout
                  </Button>
                </div>
              ) : (
                <Link to="/login">
                  <Button variant="primary" size="sm">
                    Sign In
                  </Button>
                </Link>
              )}
            </div>
          </header>

          {/* Main Body */}
          <main className="flex-1">{children}</main>
        </div>

        {/* Mobile Bottom Navigation Bar (< 768px) */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 glass-panel flex items-center justify-around py-2 px-3">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.href;

            return (
              <Link
                key={item.href}
                to={item.href}
                className={cn(
                  "flex flex-col items-center gap-1 py-1 px-3 text-[10px] font-semibold transition-colors",
                  isActive ? "text-indigo-400" : "text-slate-400 hover:text-slate-200"
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
      <NotificationDrawer
        isOpen={isNotificationDrawerOpen}
        onClose={() => setIsNotificationDrawerOpen(false)}
        onNotificationCountChange={setUnreadCount}
      />
      <AIChatCopilot />
    </DynamicBackground>
  );
};
