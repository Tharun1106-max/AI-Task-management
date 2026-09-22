import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate, useLocation, Link } from "react-router-dom";
import {
  Bot,
  Mail,
  Lock,
  User as UserIcon,
  Eye,
  EyeOff,
  Sparkles,
  ArrowRight,
  AlertCircle,
} from "lucide-react";
import { DynamicBackground, Button, Input } from "../components/ui";
import { useAuth } from "../context/AuthContext";
import type { LoginPayload, RegisterPayload } from "../services/authService";

// Validation Schemas
const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

const registerSchema = z.object({
  full_name: z.string().min(2, "Full name must be at least 2 characters"),
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type LoginFormData = z.infer<typeof loginSchema>;
type RegisterFormData = z.infer<typeof registerSchema>;

interface AuthPageProps {
  initialMode?: "login" | "register";
}

export const AuthPage: React.FC<AuthPageProps> = ({ initialMode = "login" }) => {
  const [mode, setMode] = useState<"login" | "register">(initialMode);
  const [showPassword, setShowPassword] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const { login, register, isLoading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const redirectPath = (location.state as any)?.from?.pathname || "/dashboard";

  React.useEffect(() => {
    if (isAuthenticated) {
      navigate(redirectPath, { replace: true });
    }
  }, [isAuthenticated, navigate, redirectPath]);

  // Login Form
  const {
    register: registerLogin,
    handleSubmit: handleLoginSubmit,
    formState: { errors: loginErrors },
    reset: resetLoginForm,
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  // Register Form
  const {
    register: registerRegister,
    handleSubmit: handleRegisterSubmit,
    formState: { errors: registerErrors },
    reset: resetRegisterForm,
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const extractErrorMessage = (err: any, defaultMsg: string): string => {
    const data = err?.response?.data;
    if (data?.error?.message) return data.error.message;
    if (typeof data?.detail === "string") return data.detail;
    if (Array.isArray(data?.detail) && data.detail.length > 0) {
      return data.detail.map((d: any) => d.msg || JSON.stringify(d)).join(", ");
    }
    if (data?.message) return data.message;
    if (err?.message) return err.message;
    return defaultMsg;
  };

  const onLogin = async (data: LoginFormData) => {
    setServerError(null);
    try {
      const payload: LoginPayload = {
        email: data.email,
        password: data.password,
      };
      await login(payload);
      navigate(redirectPath, { replace: true });
    } catch (err: any) {
      setServerError(extractErrorMessage(err, "Authentication failed. Please check your credentials."));
    }
  };

  const onRegister = async (data: RegisterFormData) => {
    setServerError(null);
    try {
      const payload: RegisterPayload = {
        full_name: data.full_name,
        email: data.email,
        password: data.password,
      };
      await register(payload);
      navigate(redirectPath, { replace: true });
    } catch (err: any) {
      setServerError(extractErrorMessage(err, "Registration failed. Please try again."));
    }
  };

  const switchMode = (newMode: "login" | "register") => {
    setServerError(null);
    setMode(newMode);
    setShowPassword(false);
    if (newMode === "login") {
      resetLoginForm();
    } else {
      resetRegisterForm();
    }
  };

  return (
    <DynamicBackground showOverlay="grid" intensity="vibrant">
      <div className="flex min-h-screen items-center justify-center p-4 sm:p-6 lg:p-8">
        {/* Floating Glass Container */}
        <motion.div
          initial={{ opacity: 0, y: 25, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-md overflow-hidden rounded-3xl glass-panel p-6 sm:p-8 shadow-2xl border border-white/10"
        >
          {/* Subtle Top Glow Gradient Line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-cyan-400" />

          {/* Logo & Brand Header */}
          <div className="text-center space-y-2 mb-6">
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-indigo-600 to-cyan-400 p-0.5 shadow-glow-indigo">
              <div className="flex h-full w-full items-center justify-center rounded-[14px] bg-slate-950">
                <Bot className="h-6 w-6 text-indigo-400" />
              </div>
            </div>

            <h1 className="text-2xl font-bold tracking-tight text-white">
              {mode === "login" ? "Welcome back to TaskPilot" : "Create your TaskPilot account"}
            </h1>
            <p className="text-xs text-slate-400">
              {mode === "login"
                ? "Enter your credentials to access your AI workspace"
                : "Join high-performance teams orchestrating tasks with AI"}
            </p>
          </div>

          {/* Tab Pill Switcher */}
          <div className="relative mb-6 flex rounded-xl bg-slate-950/60 p-1 border border-white/5">
            <button
              type="button"
              onClick={() => switchMode("login")}
              className={`relative z-10 flex-1 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${mode === "login" ? "text-white" : "text-slate-400 hover:text-slate-200"
                }`}
            >
              Sign In
              {mode === "login" && (
                <motion.div
                  layoutId="active-tab"
                  className="absolute inset-0 z-[-1] rounded-lg bg-indigo-600/80 shadow-sm border border-indigo-400/40"
                  transition={{ type: "spring", stiffness: 450, damping: 30 }}
                />
              )}
            </button>

            <button
              type="button"
              onClick={() => switchMode("register")}
              className={`relative z-10 flex-1 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${mode === "register" ? "text-white" : "text-slate-400 hover:text-slate-200"
                }`}
            >
              Sign Up
              {mode === "register" && (
                <motion.div
                  layoutId="active-tab"
                  className="absolute inset-0 z-[-1] rounded-lg bg-indigo-600/80 shadow-sm border border-indigo-400/40"
                  transition={{ type: "spring", stiffness: 450, damping: 30 }}
                />
              )}
            </button>
          </div>

          {/* Server Error Alert Banner */}
          <AnimatePresence>
            {serverError && (
              <motion.div
                initial={{ opacity: 0, y: -8, height: 0 }}
                animate={{ opacity: 1, y: 0, height: "auto" }}
                exit={{ opacity: 0, y: -8, height: 0 }}
                transition={{ duration: 0.25 }}
                className="mb-4 flex items-start gap-2.5 rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-xs text-rose-300"
              >
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
                <span>{serverError}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Sliding Form Container */}
          <div className="relative overflow-hidden min-h-[290px]">
            <AnimatePresence mode="wait">
              {mode === "login" ? (
                <motion.form
                  key="login-form"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                  onSubmit={handleLoginSubmit(onLogin)}
                  onChangeCapture={() => { if (serverError) setServerError(null); }}
                  className="space-y-4"
                >
                  <Input
                    label="Email Address"
                    type="email"
                    placeholder="name@company.com"
                    leftIcon={<Mail className="h-4 w-4" />}
                    {...registerLogin("email")}
                    error={loginErrors.email?.message}
                  />

                  <Input
                    label="Password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    leftIcon={<Lock className="h-4 w-4" />}
                    rightIcon={
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="text-slate-400 hover:text-white transition-colors cursor-pointer focus:outline-none"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    }
                    {...registerLogin("password")}
                    error={loginErrors.password?.message}
                  />

                  <div className="flex items-center justify-between text-xs pt-1">
                    <label className="flex items-center gap-2 text-slate-400 cursor-pointer">
                      <input
                        type="checkbox"
                        className="rounded border-white/20 bg-slate-900/60 text-indigo-500 focus:ring-indigo-500/30"
                      />
                      <span>Remember me</span>
                    </label>
                    <a
                      href="#forgot"
                      onClick={(e) => {
                        e.preventDefault();
                        alert("Password reset instructions will be sent to your email.");
                      }}
                      className="text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      Forgot password?
                    </a>
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    glow
                    className="w-full mt-2"
                    isLoading={isLoading}
                    rightIcon={<ArrowRight className="h-4 w-4" />}
                  >
                    Sign In
                  </Button>
                </motion.form>
              ) : (
                <motion.form
                  key="register-form"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                  onSubmit={handleRegisterSubmit(onRegister)}
                  onChangeCapture={() => { if (serverError) setServerError(null); }}
                  className="space-y-4"
                >
                  <Input
                    label="Full Name"
                    placeholder="Jane Doe"
                    leftIcon={<UserIcon className="h-4 w-4" />}
                    {...registerRegister("full_name")}
                    error={registerErrors.full_name?.message}
                  />

                  <Input
                    label="Email Address"
                    type="email"
                    placeholder="name@company.com"
                    leftIcon={<Mail className="h-4 w-4" />}
                    {...registerRegister("email")}
                    error={registerErrors.email?.message}
                  />

                  <Input
                    label="Password"
                    type={showPassword ? "text" : "password"}
                    placeholder="At least 8 characters"
                    leftIcon={<Lock className="h-4 w-4" />}
                    rightIcon={
                      <button
                        type="button"
                        onClick={() => setShowPassword((prev) => !prev)}
                        className="text-slate-400 hover:text-white transition-colors cursor-pointer focus:outline-none"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    }
                    {...registerRegister("password")}
                    error={registerErrors.password?.message}
                  />

                  <div className="rounded-xl bg-indigo-950/25 border border-indigo-500/20 p-2.5 flex items-center gap-2 text-[11px] text-slate-300">
                    <Sparkles className="h-4 w-4 text-indigo-400 shrink-0" />
                    <span>Includes AI task decomposition and semantic search access</span>
                  </div>

                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    glow
                    className="w-full mt-2"
                    isLoading={isLoading}
                    rightIcon={<ArrowRight className="h-4 w-4" />}
                  >
                    Create Account
                  </Button>
                </motion.form>
              )}
            </AnimatePresence>
          </div>

          {/* Footer Navigation */}
          <div className="mt-6 border-t border-white/5 pt-4 text-center text-xs text-slate-400">
            <Link to="/" className="text-slate-400 hover:text-white transition-colors inline-flex items-center gap-1">
              ← Return to Design Showcase
            </Link>
          </div>
        </motion.div>
      </div>
    </DynamicBackground>
  );
};
