import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges Tailwind classes conditionally and resolves collisions.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
