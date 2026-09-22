import React, { forwardRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle } from "lucide-react";
import { cn } from "../../lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      className,
      type = "text",
      label,
      error,
      helperText,
      leftIcon,
      rightIcon,
      id,
      value,
      defaultValue,
      onFocus,
      onBlur,
      ...props
    },
    ref
  ) => {
    const inputId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);
    const [isFocused, setIsFocused] = useState(false);

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label
            htmlFor={inputId}
            className={cn(
              "block text-xs font-medium transition-colors duration-200",
              isFocused ? "text-indigo-400" : "text-slate-300",
              error && "text-rose-400"
            )}
          >
            {label}
          </label>
        )}

        <div className="relative flex items-center">
          {leftIcon && (
            <div className="pointer-events-none absolute left-3.5 flex items-center text-slate-400">
              {leftIcon}
            </div>
          )}

          <input
            id={inputId}
            ref={ref}
            type={type}
            value={value}
            defaultValue={defaultValue}
            onFocus={(e) => {
              setIsFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              onBlur?.(e);
            }}
            className={cn(
              "w-full rounded-xl px-4 py-2.5 text-sm text-slate-100 placeholder-slate-500",
              "glass-input focus:outline-none",
              leftIcon && "pl-10",
              rightIcon && "pr-10",
              error
                ? "border-rose-500/60 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                : "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25",
              className
            )}
            {...props}
          />

          {rightIcon && !error && (
            <div className="absolute right-3.5 flex items-center text-slate-400">
              {rightIcon}
            </div>
          )}

          {error && (
            <div className="pointer-events-none absolute right-3.5 flex items-center text-rose-400">
              <AlertCircle className="h-4 w-4" />
            </div>
          )}
        </div>

        {/* Inline animated validation error or helper text */}
        <AnimatePresence mode="wait">
          {error ? (
            <motion.p
              key="error"
              initial={{ opacity: 0, y: -4, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -4, height: 0 }}
              transition={{ duration: 0.2 }}
              className="text-xs text-rose-400 font-medium flex items-center gap-1 mt-1"
            >
              {error}
            </motion.p>
          ) : helperText ? (
            <p key="helper" className="text-xs text-slate-400 mt-1">
              {helperText}
            </p>
          ) : null}
        </AnimatePresence>
      </div>
    );
  }
);

Input.displayName = "Input";
