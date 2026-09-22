import React, { forwardRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertCircle } from "lucide-react";
import { cn } from "../../lib/utils";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  helperText?: string;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  (
    {
      className,
      label,
      error,
      helperText,
      id,
      rows = 4,
      onFocus,
      onBlur,
      ...props
    },
    ref
  ) => {
    const textareaId = id || (label ? label.toLowerCase().replace(/\s+/g, "-") : undefined);
    const [isFocused, setIsFocused] = useState(false);

    return (
      <div className="w-full space-y-1.5 text-left">
        {label && (
          <label
            htmlFor={textareaId}
            className={cn(
              "block text-xs font-medium transition-colors duration-200",
              isFocused ? "text-indigo-400" : "text-slate-300",
              error && "text-rose-400"
            )}
          >
            {label}
          </label>
        )}

        <div className="relative">
          <textarea
            id={textareaId}
            ref={ref}
            rows={rows}
            onFocus={(e) => {
              setIsFocused(true);
              onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              onBlur?.(e);
            }}
            className={cn(
              "w-full rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500",
              "glass-input focus:outline-none resize-y min-h-[90px]",
              error
                ? "border-rose-500/60 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20"
                : "focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/25",
              className
            )}
            {...props}
          />

          {error && (
            <div className="pointer-events-none absolute top-3.5 right-3.5 flex items-center text-rose-400">
              <AlertCircle className="h-4 w-4" />
            </div>
          )}
        </div>

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

Textarea.displayName = "Textarea";
