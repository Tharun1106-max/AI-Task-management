import React from "react";
import { motion } from "framer-motion";

interface DynamicBackgroundProps {
  showOverlay?: "grid" | "dots" | "none";
  intensity?: "subtle" | "vibrant";
  className?: string;
  children?: React.ReactNode;
}

export const DynamicBackground: React.FC<DynamicBackgroundProps> = ({
  showOverlay = "grid",
  intensity = "subtle",
  className = "",
  children,
}) => {
  const opacityFactor = intensity === "vibrant" ? 0.35 : 0.22;

  return (
    <div className={`relative min-h-screen w-full overflow-hidden bg-canvas ${className}`}>
      {/* Ambient Blurred Drifting Orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Orb 1: Violet/Indigo Glow (Top-Left to Center) */}
        <motion.div
          className="absolute -top-[20%] -left-[10%] h-[550px] w-[550px] rounded-full blur-[130px] filter"
          style={{
            background: "radial-gradient(circle, #6366F1 0%, #4F46E5 50%, transparent 70%)",
            opacity: opacityFactor,
          }}
          animate={{
            x: [0, 80, -40, 0],
            y: [0, 60, -20, 0],
            scale: [1, 1.15, 0.95, 1],
          }}
          transition={{
            duration: 22,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />

        {/* Orb 2: Cyan/Teal Glow (Top-Right to Center) */}
        <motion.div
          className="absolute top-[10%] -right-[15%] h-[600px] w-[600px] rounded-full blur-[140px] filter"
          style={{
            background: "radial-gradient(circle, #06B6D4 0%, #0891B2 50%, transparent 70%)",
            opacity: opacityFactor * 0.9,
          }}
          animate={{
            x: [0, -90, 30, 0],
            y: [0, 70, -50, 0],
            scale: [1, 1.1, 0.9, 1],
          }}
          transition={{
            duration: 26,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 2,
          }}
        />

        {/* Orb 3: Deep Fuchsia/Violet Accent (Bottom Center) */}
        <motion.div
          className="absolute -bottom-[20%] left-[25%] h-[650px] w-[650px] rounded-full blur-[150px] filter"
          style={{
            background: "radial-gradient(circle, #8B5CF6 0%, #D946EF 40%, transparent 70%)",
            opacity: opacityFactor * 0.75,
          }}
          animate={{
            x: [0, 60, -60, 0],
            y: [0, -80, 20, 0],
            scale: [1, 1.2, 0.92, 1],
          }}
          transition={{
            duration: 28,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 4,
          }}
        />

        {/* Subtle Vignette Overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_20%,#0B0F19_85%)]" />
      </div>

      {/* Grid or Dot Pattern Overlay */}
      {showOverlay === "grid" && (
        <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-60" />
      )}
      {showOverlay === "dots" && (
        <div className="pointer-events-none absolute inset-0 bg-dots-pattern opacity-70" />
      )}

      {/* Foreground Content */}
      <div className="relative z-10 w-full min-h-screen">{children}</div>
    </div>
  );
};
