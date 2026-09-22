import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Bot,
  Layers,
  Kanban,
  FileText,
  User,
  Settings,
  LogOut,
  Home,
} from "lucide-react";
import { Button } from "./ui/Button";
import { useAuth } from "../context/AuthContext";
import { ProfileModal } from "./ProfileModal";
import { cn } from "../lib/utils";

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const navLinks = [
    { label: "Overview", href: "/", icon: Home },
    { label: "Projects", href: "/projects", icon: Layers },
    { label: "Task Board", href: "/tasks", icon: Kanban },
  ];

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b border-white/10 glass-panel">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo & Platform Name */}
          <div className="flex items-center gap-6">
            <Link to="/" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-violet-600 to-cyan-400 p-0.5 shadow-glow-indigo">
                <div className="flex h-full w-full items-center justify-center rounded-[10px] bg-slate-950">
                  <Bot className="h-5 w-5 text-indigo-400" />
                </div>
              </div>
              <div>
                <span className="text-lg font-bold tracking-tight text-white">TaskPilot</span>
                <span className="ml-2 rounded-full bg-indigo-500/10 px-2 py-0.5 text-[10px] font-semibold text-indigo-400 border border-indigo-500/20">
                  v1.0
                </span>
              </div>
            </Link>

            {/* Navigation Links */}
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((item) => {
                const Icon = item.icon;
                const isActive =
                  item.href === "/"
                    ? location.pathname === "/"
                    : location.pathname.startsWith(item.href);

                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className={cn(
                      "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                      isActive
                        ? "bg-indigo-600/80 text-white shadow-sm border border-indigo-400/30"
                        : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          {/* Right Action Tools */}
          <div className="flex items-center gap-3">
            <a
              href="http://localhost:8000/docs"
              target="_blank"
              rel="noreferrer"
              className="hidden lg:inline-flex"
            >
              <Button variant="ghost" size="sm" leftIcon={<FileText className="h-4 w-4" />}>
                API Docs
              </Button>
            </a>

            {isAuthenticated && user ? (
              <div className="flex items-center gap-2">
                <Button
                  variant="glass"
                  size="sm"
                  leftIcon={<User className="h-4 w-4 text-indigo-400" />}
                  onClick={() => setIsProfileOpen(true)}
                  className="hidden sm:inline-flex"
                >
                  {user.full_name} ({user.role})
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Profile Settings"
                  onClick={() => setIsProfileOpen(true)}
                >
                  <Settings className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Sign Out"
                  onClick={() => logout()}
                  leftIcon={<LogOut className="h-4 w-4" />}
                >
                  Logout
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Link to="/login">
                  <Button variant="ghost" size="sm">
                    Sign In
                  </Button>
                </Link>
                <Link to="/register">
                  <Button variant="secondary" size="sm">
                    Sign Up
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />
    </>
  );
};
