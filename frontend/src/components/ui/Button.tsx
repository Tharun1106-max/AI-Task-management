import React, { forwardRef } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils";

export interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  variant?: "primary" | "secondary" | "glass" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  children?: React.ReactNode;
  glow?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "md",
      isLoading = false,
      leftIcon,
      rightIcon,
      children,
      disabled,
      glow = false,
      ...props
    },
    ref
  ) => {
    // Size styles
    const sizeStyles = {
      sm: "h-9 px-3.5 text-xs rounded-lg gap-1.5",
      md: "h-11 px-5 text-sm rounded-xl gap-2",
      lg: "h-13 px-7 text-base rounded-2xl gap-2.5",
    };

    // Variant styles
    const variantStyles = {
      primary:
        "relative text-white font-medium bg-gradient-to-r from-indigo-500 via-violet-600 to-indigo-600 hover:from-indigo-400 hover:to-violet-500 shadow-md shadow-indigo-500/25 hover:shadow-lg hover:shadow-indigo-500/40 border border-indigo-400/30 overflow-hidden",
      secondary:
        "text-slate-200 bg-slate-800/80 hover:bg-slate-700/80 border border-white/10 hover:border-white/20 shadow-sm",
      glass:
        "text-slate-100 bg-white/[0.08] hover:bg-white/[0.14] border border-white/15 hover:border-white/25 backdrop-blur-md shadow-glass-sm hover:shadow-glass-md",
      outline:
        "text-indigo-300 border border-indigo-500/40 hover:bg-indigo-500/10 hover:border-indigo-400/70",
      ghost:
        "text-slate-300 hover:text-white hover:bg-white/[0.07]",
      danger:
        "text-white bg-red-600 hover:bg-red-500 border border-red-400/30 shadow-md shadow-red-500/25",
    };

    return (
      <motion.button
        ref={ref}
        disabled={disabled || isLoading}
        whileHover={{ scale: disabled || isLoading ? 1 : 1.02, y: disabled || isLoading ? 0 : -1 }}
        whileTap={{ scale: disabled || isLoading ? 1 : 0.97 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        className={cn(
          "inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:opacity-50 disabled:pointer-events-none cursor-pointer select-none",
          sizeStyles[size],
          variantStyles[variant],
          glow && "shadow-glow-indigo",
          className
        )}
        {...props}
      >
        {/* Subtle sliding light reflection for primary buttons */}
        {variant === "primary" && !disabled && !isLoading && (
          <span className="pointer-events-none absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
        )}

        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin text-current" />
            <span>Loading...</span>
          </>
        ) : (
          <>
            {leftIcon && <span className="shrink-0">{leftIcon}</span>}
            <span>{children}</span>
            {rightIcon && <span className="shrink-0">{rightIcon}</span>}
          </>
        )}
      </motion.button>
    );
  }
);

Button.displayName = "Button";
