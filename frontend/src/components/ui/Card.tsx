import React, { useRef, useState } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "../../lib/utils";

export interface CardProps extends HTMLMotionProps<"div"> {
  enableTilt?: boolean;
  glowOnHover?: boolean;
  children?: React.ReactNode;
  variant?: "glass" | "solid" | "bordered";
}

export const Card = React.forwardRef<HTMLDivElement, CardProps>(
  (
    {
      className,
      children,
      enableTilt = true,
      glowOnHover = true,
      variant = "glass",
      ...props
    },
    ref
  ) => {
    const cardRef = useRef<HTMLDivElement | null>(null);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    const [rotateX, setRotateX] = useState(0);
    const [rotateY, setRotateY] = useState(0);
    const [isHovered, setIsHovered] = useState(false);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!cardRef.current) return;
      const rect = cardRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setMousePosition({ x, y });

      if (enableTilt) {
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const tiltX = ((y - centerY) / centerY) * -6; // max 6 deg
        const tiltY = ((x - centerX) / centerX) * 6; // max 6 deg
        setRotateX(tiltX);
        setRotateY(tiltY);
      }
    };

    const handleMouseEnter = () => {
      setIsHovered(true);
    };

    const handleMouseLeave = () => {
      setIsHovered(false);
      setRotateX(0);
      setRotateY(0);
    };

    const variantStyles = {
      glass: "glass-card",
      solid: "bg-slate-900/90 border border-white/10 shadow-xl",
      bordered: "bg-slate-900/50 border border-indigo-500/20 hover:border-indigo-500/40",
    };

    return (
      <motion.div
        ref={(node) => {
          cardRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) (ref as any).current = node;
        }}
        initial={{ opacity: 0, y: 15 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: "-20px" }}
        transition={{ duration: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
        onMouseMove={handleMouseMove}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          perspective: 1000,
          transformStyle: "preserve-3d",
        }}
        animate={{
          rotateX: isHovered ? rotateX : 0,
          rotateY: isHovered ? rotateY : 0,
        }}
        className={cn(
          "relative overflow-hidden rounded-2xl p-6 transition-colors duration-300",
          variantStyles[variant],
          glowOnHover && "group",
          className
        )}
        {...props}
      >
        {/* Dynamic radial gradient following mouse cursor */}
        {glowOnHover && (
          <div
            className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            style={{
              background: `radial-gradient(450px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(99, 102, 241, 0.14), transparent 60%)`,
            }}
          />
        )}

        {/* Card Content with subtle 3D depth */}
        <div className="relative z-10 space-y-4">{children}</div>
      </motion.div>
    );
  }
);

Card.displayName = "Card";

export const CardHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => <div className={cn("flex flex-col space-y-1.5", className)} {...props} />;

export const CardTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({
  className,
  ...props
}) => (
  <h3
    className={cn("text-lg font-semibold tracking-tight text-white", className)}
    {...props}
  />
);

export const CardDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({
  className,
  ...props
}) => (
  <p className={cn("text-xs text-slate-400 leading-relaxed", className)} {...props} />
);

export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => <div className={cn("pt-2", className)} {...props} />;

export const CardFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({
  className,
  ...props
}) => (
  <div
    className={cn("flex items-center justify-between pt-4 border-t border-white/5", className)}
    {...props}
  />
);
