import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bot,
  X,
  Send,
  Sparkles,
} from "lucide-react";
import {
  aiService,
  type AssistantMessage,
  type ReferencedTask,
} from "../../services/aiService";
import { projectService, type Project } from "../../services/projectService";
import { Button } from "../ui/Button";
import { cn } from "../../lib/utils";

const QUICK_PROMPTS = [
  "What is currently blocking progress?",
  "Identify overdue items",
  "Summarize project status & wins",
  "Who has the highest task load?",
];

interface ChatEntry {
  id: string;
  role: "user" | "assistant";
  content: string;
  referenced_tasks?: ReferencedTask[];
  timestamp: string;
}

export const AIChatCopilot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [inputMessage, setInputMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [messages, setMessages] = useState<ChatEntry[]>([
    {
      id: "welcome",
      role: "assistant",
      content:
        "Hello! I am your **TaskPilot AI Copilot**. I have real-time access to your project telemetry, bottlenecks, and team workloads. How can I assist your sprint today?",
      timestamp: "Just now",
    },
  ]);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load projects
  useEffect(() => {
    projectService
      .getProjects({ limit: 50 })
      .then((res) => {
        setProjects(res.projects);
        if (res.projects.length > 0 && !selectedProjectId) {
          setSelectedProjectId(res.projects[0].id);
        }
      })
      .catch(() => {});
  }, []);

  // Auto scroll to bottom
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isOpen]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputMessage).trim();
    if (!text || isLoading) return;

    const userEntry: ChatEntry = {
      id: Date.now().toString(),
      role: "user",
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userEntry]);
    setInputMessage("");
    setIsLoading(true);

    try {
      // Build history for backend
      const historyPayload: AssistantMessage[] = messages
        .filter((m) => m.id !== "welcome")
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await aiService.askAssistant({
        message: text,
        project_id: selectedProjectId || undefined,
        history: historyPayload,
      });

      const assistantEntry: ChatEntry = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: res.answer,
        referenced_tasks: res.referenced_tasks,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, assistantEntry]);
    } catch (err: any) {
      console.error("AI Copilot request failed:", err);
      const errorEntry: ChatEntry = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "I encountered an issue analyzing the project snapshot. Please verify your connection or try again.",
        timestamp: "Just now",
      };
      setMessages((prev) => [...prev, errorEntry]);
    } finally {
      setIsLoading(false);
    }
  };

  // Basic markdown-like parser (bolding, bullet points, headers)
  const renderFormattedContent = (content: string) => {
    const lines = content.split("\n");
    return (
      <div className="space-y-1.5 text-xs text-slate-200 leading-relaxed">
        {lines.map((line, idx) => {
          if (!line.trim()) return <div key={idx} className="h-1" />;

          // Bullet point
          if (line.startsWith("- ") || line.startsWith("* ")) {
            const clean = line.replace(/^[-*]\s+/, "");
            return (
              <div key={idx} className="flex items-start gap-2 pl-1">
                <span className="h-1.5 w-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />
                <span>{renderInlineStyles(clean)}</span>
              </div>
            );
          }

          // Header ### or ##
          if (line.startsWith("### ") || line.startsWith("## ")) {
            const clean = line.replace(/^#{2,3}\s+/, "");
            return (
              <p key={idx} className="font-bold text-white text-sm pt-1">
                {clean}
              </p>
            );
          }

          return <p key={idx}>{renderInlineStyles(line)}</p>;
        })}
      </div>
    );
  };

  const renderInlineStyles = (text: string) => {
    // Replace **bold** with <strong>
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={i} className="font-bold text-white">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return part;
    });
  };

  return (
    <>
      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-50">
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen((prev) => !prev)}
          className={cn(
            "relative flex h-14 w-14 items-center justify-center rounded-2xl p-0.5 shadow-2xl transition-all cursor-pointer",
            isOpen ? "bg-slate-800 text-white" : "bg-gradient-to-tr from-indigo-600 via-violet-600 to-cyan-400 shadow-glow-indigo"
          )}
          title="Open AI Project Copilot"
        >
          <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-slate-950/90 text-white">
            {isOpen ? (
              <X className="h-6 w-6 text-slate-300" />
            ) : (
              <div className="relative">
                <Bot className="h-6 w-6 text-indigo-400" />
                {/* Pulsing indicator */}
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500" />
                </span>
              </div>
            )}
          </div>
        </motion.button>
      </div>

      {/* Floating Chat Drawer */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 25, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 350, damping: 30 }}
            className="fixed bottom-24 right-4 sm:right-6 z-50 w-[calc(100vw-2rem)] sm:w-[420px] h-[580px] rounded-3xl glass-panel border border-white/10 shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-slate-950/40">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shadow-glow-indigo">
                  <Bot className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-white tracking-tight">
                      TaskPilot Copilot
                    </span>
                    <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.2 rounded-full border border-emerald-500/20 font-mono">
                      Online
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400">Context-aware sprint assistant</p>
                </div>
              </div>

              {/* Project Context Selector */}
              {projects.length > 0 && (
                <div className="max-w-[140px]">
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="w-full rounded-lg px-2 py-1 text-[11px] text-white glass-input focus:outline-none cursor-pointer truncate"
                    title="Active Project Context"
                  >
                    {projects.map((p) => (
                      <option key={p.id} value={p.id} className="bg-slate-900 text-white">
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* Messages Stream */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.map((m) => {
                const isUser = m.role === "user";

                return (
                  <div
                    key={m.id}
                    className={cn("flex flex-col space-y-1.5", isUser ? "items-end" : "items-start")}
                  >
                    <div
                      className={cn(
                        "rounded-2xl p-3.5 max-w-[88%] space-y-2",
                        isUser
                          ? "bg-indigo-600 text-white rounded-br-none shadow-sm"
                          : "glass-card border border-white/10 rounded-bl-none text-slate-200"
                      )}
                    >
                      {renderFormattedContent(m.content)}

                      {/* Embedded Referenced Tasks */}
                      {m.referenced_tasks && m.referenced_tasks.length > 0 && (
                        <div className="pt-2 border-t border-white/10 space-y-1.5">
                          <span className="text-[10px] uppercase font-bold text-indigo-300 block tracking-wider">
                            Referenced Work Items:
                          </span>
                          {m.referenced_tasks.map((task) => (
                            <div
                              key={task.id}
                              className="rounded-xl bg-slate-950/60 p-2 border border-white/5 flex items-center justify-between gap-2"
                            >
                              <div className="flex items-center gap-2 truncate">
                                <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 shrink-0" />
                                <span className="text-xs font-semibold text-white truncate">
                                  {task.title}
                                </span>
                              </div>
                              <span className="text-[10px] font-mono text-slate-400 uppercase">
                                {task.status}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <span className="text-[9px] text-slate-500 px-1 font-mono">{m.timestamp}</span>
                  </div>
                );
              })}

              {isLoading && (
                <div className="flex items-center gap-2 rounded-2xl glass-card p-3 w-32 border border-white/10 text-xs text-slate-400">
                  <Sparkles className="h-3.5 w-3.5 text-indigo-400 animate-spin" />
                  <span>Thinking...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Prompt Pills */}
            <div className="p-2 px-3 border-t border-white/5 bg-slate-950/20 overflow-x-auto flex gap-1.5 scrollbar-none">
              {QUICK_PROMPTS.map((prompt, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(prompt)}
                  disabled={isLoading}
                  className="rounded-full bg-white/5 hover:bg-white/10 border border-white/10 px-2.5 py-1 text-[10px] text-slate-300 whitespace-nowrap transition-colors cursor-pointer shrink-0"
                >
                  {prompt}
                </button>
              ))}
            </div>

            {/* Chat Input Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="p-3 border-t border-white/10 bg-slate-950/40 flex items-center gap-2"
            >
              <input
                type="text"
                placeholder="Ask about blockers, workload, or sprint progress..."
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                disabled={isLoading}
                className="flex-1 rounded-xl px-3 py-2 text-xs text-white glass-input focus:outline-none"
              />

              <Button
                type="submit"
                variant="primary"
                size="sm"
                glow
                isLoading={isLoading}
                disabled={!inputMessage.trim() || isLoading}
                className="h-8 w-8 p-0 flex items-center justify-center shrink-0"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
