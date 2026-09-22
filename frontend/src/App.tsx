import { useState } from "react";
import { Routes, Route, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Sparkles,
  Layers,
  Search,
  CheckCircle2,
  AlertCircle,
  Plus,
  ArrowRight,
  Database,
  Cpu,
  ShieldCheck,
  Zap,
  Activity,
  Settings as SettingsIcon,
} from "lucide-react";
import {
  DynamicBackground,
  Button,
  Input,
  Textarea,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Modal,
} from "./components/ui";
import { useAuth } from "./context/AuthContext";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Dashboard } from "./pages/Dashboard";
import { Projects } from "./pages/Projects";
import { Tasks } from "./pages/Tasks";
import { Team } from "./pages/Team";
import { Calendar } from "./pages/Calendar";
import { AIPlanner } from "./pages/AIPlanner";
import { Documents } from "./pages/Documents";
import { Analytics } from "./pages/Analytics";
import { Settings } from "./pages/Settings";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppLayout } from "./components/layout/AppLayout";
import { Navbar } from "./components/Navbar";
import { ProfileModal } from "./components/ProfileModal";

function DashboardShowcase() {
  const { user, isAuthenticated } = useAuth();

  // Modal states
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // Form states for showcase
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [hasError, setHasError] = useState(false);
  const [isLoadingDemo, setIsLoadingDemo] = useState(false);

  const handleCreateTask = () => {
    if (!taskTitle.trim()) {
      setHasError(true);
      return;
    }
    setHasError(false);
    setIsLoadingDemo(true);
    setTimeout(() => {
      setIsLoadingDemo(false);
      setIsModalOpen(false);
      setTaskTitle("");
      setTaskDescription("");
    }, 1200);
  };

  return (
    <DynamicBackground showOverlay="grid" intensity="subtle">
      <Navbar />

      {/* Main Content Area */}
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 space-y-16">
        {/* User Welcome Banner if Logged In */}
        {isAuthenticated && user && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-between rounded-2xl glass-panel p-4 px-6 border border-indigo-500/20 shadow-glow-indigo"
          >
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-gradient-to-tr from-indigo-500 to-violet-600 flex items-center justify-center font-bold text-white shadow-md">
                {user.avatar_url ? (
                  <img
                    src={user.avatar_url}
                    alt={user.full_name}
                    className="h-full w-full rounded-full object-cover"
                  />
                ) : (
                  user.full_name.charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <p className="text-sm font-semibold text-white">
                  Welcome back, {user.full_name}!
                </p>
                <p className="text-xs text-slate-400">
                  Signed in as <span className="text-indigo-300 font-mono">{user.email}</span> • Role: <span className="font-semibold text-indigo-400">{user.role}</span>
                </p>
              </div>
            </div>

            <Button
              variant="glass"
              size="sm"
              leftIcon={<SettingsIcon className="h-4 w-4 text-indigo-400" />}
              onClick={() => setIsProfileOpen(true)}
            >
              Edit Profile
            </Button>
          </motion.div>
        )}

        {/* Hero Section */}
        <section className="text-center space-y-6 pt-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-indigo-500/30 bg-indigo-950/40 px-3.5 py-1.5 text-xs font-medium text-indigo-300 backdrop-blur-md shadow-glow-indigo"
          >
            <Sparkles className="h-3.5 w-3.5 text-indigo-400 animate-pulse" />
            <span>FastAPI JWT Auth + Modern React Motion Design System</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-4xl font-extrabold tracking-tight sm:text-6xl max-w-4xl mx-auto"
          >
            Intelligent Workflows.{" "}
            <span className="text-gradient-primary">Effortless Execution.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed"
          >
            Explore TaskPilot&apos;s interactive primitives: high-performance glassmorphism,
            subtle 3D hover physics, spring-based dialogs, and ambient canvas gradients.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="flex flex-wrap items-center justify-center gap-4 pt-2"
          >
            {isAuthenticated ? (
              <Button
                variant="primary"
                size="lg"
                glow
                leftIcon={<Sparkles className="h-5 w-5" />}
                onClick={() => setIsModalOpen(true)}
              >
                Create AI Workspace
              </Button>
            ) : (
              <Link to="/register">
                <Button
                  variant="primary"
                  size="lg"
                  glow
                  leftIcon={<Sparkles className="h-5 w-5" />}
                >
                  Get Started Free
                </Button>
              </Link>
            )}

            <Button
              variant="glass"
              size="lg"
              leftIcon={<Activity className="h-5 w-5 text-cyan-400" />}
              onClick={() => {
                const el = document.getElementById("primitives-section");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Explore Primitives
            </Button>
          </motion.div>
        </section>

        {/* Section 1: 3D Interactive Feature Cards */}
        <section id="primitives-section" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">3D Tilt & Glow Cards</h2>
              <p className="text-sm text-slate-400">
                Move your mouse over each container to experience dynamic 3D perspective tilt and cursor radial glow.
              </p>
            </div>
            <span className="hidden sm:inline-flex text-xs text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-full border border-indigo-500/20">
              Interactive
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1 */}
            <Card enableTilt glowOnHover>
              <CardHeader>
                <div className="h-11 w-11 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 mb-2">
                  <Cpu className="h-5 w-5" />
                </div>
                <CardTitle>AI Task Decomposition</CardTitle>
                <CardDescription>
                  Leverage Google Gemini models to transform complex project roadmaps into actionable sprint tasks.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg bg-slate-950/60 p-3 border border-white/5 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Latency</span>
                    <span className="text-emerald-400 font-mono">~350ms</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Model Engine</span>
                    <span className="text-indigo-300">Gemini 2.5 Flash</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <span className="text-xs text-slate-400 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  Zero prompt latency
                </span>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-indigo-400 group-hover:translate-x-1 transition-all" />
              </CardFooter>
            </Card>

            {/* Card 2 */}
            <Card enableTilt glowOnHover>
              <CardHeader>
                <div className="h-11 w-11 rounded-xl bg-violet-600/20 border border-violet-500/30 flex items-center justify-center text-violet-400 mb-2">
                  <Search className="h-5 w-5" />
                </div>
                <CardTitle>Vector Semantic Search</CardTitle>
                <CardDescription>
                  Query project documents and technical specs using all-MiniLM-L6-v2 embeddings and Cosine similarity.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg bg-slate-950/60 p-3 border border-white/5 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Chunking Strategy</span>
                    <span className="text-violet-300">PyPDF Recursive</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Embedding Dim</span>
                    <span className="text-cyan-400 font-mono">384-d</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <span className="text-xs text-slate-400 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  Instant retrieval
                </span>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-violet-400 group-hover:translate-x-1 transition-all" />
              </CardFooter>
            </Card>

            {/* Card 3 */}
            <Card enableTilt glowOnHover>
              <CardHeader>
                <div className="h-11 w-11 rounded-xl bg-cyan-600/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-2">
                  <Database className="h-5 w-5" />
                </div>
                <CardTitle>Async Motor & MongoDB</CardTitle>
                <CardDescription>
                  Reactive connection pooling, compound indexing, and auto-lifecycle ping telemetry for zero downtime.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg bg-slate-950/60 p-3 border border-white/5 space-y-2 text-xs">
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Connection Pool</span>
                    <span className="text-cyan-300 font-mono">10 - 50 conns</span>
                  </div>
                  <div className="flex items-center justify-between text-slate-400">
                    <span>Driver</span>
                    <span className="text-emerald-400 font-mono">Motor AsyncIO</span>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <span className="text-xs text-slate-400 flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                  Production Ready
                </span>
                <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
              </CardFooter>
            </Card>
          </div>
        </section>

        {/* Section 2: Buttons & Motion Primitives */}
        <section className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Interactive Button System</h2>
            <p className="text-sm text-slate-400">
              Press scaling, sliding light reflections, spring dampening, and loading spinners.
            </p>
          </div>

          <div className="glass-panel rounded-2xl p-6 sm:p-8 space-y-6">
            <div className="flex flex-wrap items-center gap-4">
              <Button variant="primary" glow leftIcon={<Zap className="h-4 w-4" />}>
                Primary Glow
              </Button>
              <Button variant="secondary" leftIcon={<Layers className="h-4 w-4" />}>
                Secondary
              </Button>
              <Button variant="glass" leftIcon={<Sparkles className="h-4 w-4 text-violet-400" />}>
                Glass Morphic
              </Button>
              <Button variant="outline">Outline</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger" leftIcon={<AlertCircle className="h-4 w-4" />}>
                Danger Action
              </Button>
              <Button
                variant="primary"
                isLoading={isLoadingDemo}
                onClick={() => {
                  setIsLoadingDemo(true);
                  setTimeout(() => setIsLoadingDemo(false), 2000);
                }}
              >
                Click to Test Spinner
              </Button>
            </div>

            <div className="border-t border-white/5 pt-4 flex flex-wrap items-center gap-4">
              <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Sizes:</span>
              <Button variant="glass" size="sm">
                Small (sm)
              </Button>
              <Button variant="glass" size="md">
                Medium (md)
              </Button>
              <Button variant="glass" size="lg">
                Large (lg)
              </Button>
            </div>
          </div>
        </section>

        {/* Section 3: Glass Form Controls & Validation */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-white tracking-tight">Glass Form Controls</h2>
              <p className="text-sm text-slate-400">
                Inputs and textareas with animated focus rings and fluid inline validation feedback.
              </p>
            </div>
            <Button
              variant="glass"
              size="sm"
              onClick={() => setHasError((prev) => !prev)}
            >
              Toggle Error State
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-panel rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
                Inputs & Search Fields
              </h3>

              <Input
                label="Project Title"
                placeholder="e.g. Q4 Platform Migration"
                leftIcon={<Layers className="h-4 w-4" />}
                value={taskTitle}
                onChange={(e) => {
                  setTaskTitle(e.target.value);
                  if (hasError && e.target.value.trim()) setHasError(false);
                }}
                error={hasError ? "Project title is required to initialize workflow." : undefined}
                helperText="Enter a descriptive label for your team workspace."
              />

              <Input
                label="Semantic Knowledge Query"
                placeholder="Ask anything about architecture specs..."
                leftIcon={<Search className="h-4 w-4" />}
                rightIcon={<Sparkles className="h-4 w-4 text-indigo-400" />}
              />
            </div>

            <div className="glass-panel rounded-2xl p-6 space-y-4">
              <h3 className="text-sm font-semibold text-slate-200 uppercase tracking-wider">
                Textarea & Context Window
              </h3>

              <Textarea
                label="AI Context & Requirements"
                placeholder="Provide high-level user stories, acceptance criteria, or API endpoint needs..."
                rows={4}
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                helperText="Google Gemini automatically decomposes this content into subtasks."
              />
            </div>
          </div>
        </section>
      </main>

      {/* Task Creation Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={
          <span className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-400" />
            Initialize AI Project Workspace
          </span>
        }
        description="Configure your project parameters. TaskPilot's background agents will synthesize requirements, generate backlog issues, and setup vector indexes."
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => setIsModalOpen(false)}
              disabled={isLoadingDemo}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              glow
              isLoading={isLoadingDemo}
              onClick={handleCreateTask}
              leftIcon={<Plus className="h-4 w-4" />}
            >
              Create Workspace
            </Button>
          </>
        }
      >
        <div className="space-y-4 py-2">
          <Input
            label="Workspace Name"
            placeholder="e.g. E-Commerce Core Re-architecture"
            value={taskTitle}
            onChange={(e) => setTaskTitle(e.target.value)}
            error={hasError ? "Workspace name cannot be blank." : undefined}
            leftIcon={<Layers className="h-4 w-4" />}
          />

          <Textarea
            label="Scope & System Requirements"
            placeholder="Outline functional scope, tech stack requirements, and key deliverables..."
            rows={3}
            value={taskDescription}
            onChange={(e) => setTaskDescription(e.target.value)}
          />

          <div className="rounded-xl bg-indigo-950/30 border border-indigo-500/20 p-3.5 flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-indigo-400 shrink-0 mt-0.5" />
            <div className="text-xs text-slate-300 leading-relaxed">
              <span className="font-semibold text-white">Automated Vector Indexing:</span>{" "}
              Any PDF or Markdown documents attached to this workspace will be automatically chunked and embedded via PyPDF and Sentence-Transformers.
            </div>
          </div>
        </div>
      </Modal>

      {/* Profile & Account Settings Modal */}
      <ProfileModal
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
      />

      {/* Footer */}
      <footer className="mt-20 border-t border-white/5 py-8 text-center text-xs text-slate-500">
        <div className="mx-auto max-w-7xl px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>FastAPI & Async MongoDB Gateway Ready</span>
          </div>
          <p>© 2026 TaskPilot Architecture. Built with React, TypeScript, Tailwind CSS, & Framer Motion.</p>
        </div>
      </footer>
    </DynamicBackground>
  );
}

export function App() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Dashboard />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/projects"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Projects />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Analytics />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/ai-planner"
        element={
          <ProtectedRoute>
            <AppLayout>
              <AIPlanner />
            </AppLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/documents"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Documents />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/tasks"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Tasks />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/calendar"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Calendar />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/team"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Team />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Settings />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route path="/showcase" element={<DashboardShowcase />} />
      <Route
        path="/"
        element={
          isAuthenticated ? (
            <ProtectedRoute>
              <AppLayout>
                <Dashboard />
              </AppLayout>
            </ProtectedRoute>
          ) : (
            <DashboardShowcase />
          )
        }
      />
    </Routes>
  );
}

export default App;
