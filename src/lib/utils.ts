import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Cast reactive expressions for Sinwan JSX attribute typing. */
export function jsxClass<T = string>(value: unknown): T {
  return value as T;
}
