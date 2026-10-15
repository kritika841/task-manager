import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Subtask } from "./types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function calculateProgress(subtasks: Subtask[]): {
  total: number;
  completed: number;
  percentage: number;
} {
  if (!subtasks || subtasks.length === 0) {
    return { total: 0, completed: 0, percentage: 0 };
  }
  const completed = subtasks.filter((s) => s.completed).length;
  const total = subtasks.length;
  const percentage = Math.round((completed / total) * 100);
  return { total, completed, percentage };
}

export function formatDate(dateString: string): string {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  } catch {
    return dateString;
  }
}

export function formatDateTime(dateString: string): string {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  } catch {
    return dateString;
  }
}

export function isOverdue(dateString: string): boolean {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(dateString);
    target.setHours(0, 0, 0, 0);
    return target < today;
  } catch {
    return false;
  }
}

// Known Satmi AdFlow Employee Code mappings
export const KNOWN_EMPLOYEE_CODES: Record<string, string> = {
  himik: "HIM",
  nikhil: "NIK",
  tamanna: "TAM",
  kunal: "KUN",
  priya: "PRI",
  ishika: "ISH",
  yash: "YAS",
  kritika: "KRI",
  kartavya: "KAR",
  ragini: "RAG",
  muskan: "MUS",
  krishnapriya: "KRP",
};

export function getEmployeeCode(name: string, customCode?: string): string {
  if (customCode && customCode.trim()) {
    return customCode.trim().toUpperCase().slice(0, 5);
  }
  const cleanName = (name || "").trim().toLowerCase();
  for (const [key, code] of Object.entries(KNOWN_EMPLOYEE_CODES)) {
    if (cleanName.startsWith(key)) {
      return code;
    }
  }
  const sanitized = cleanName.replace(/[^a-z0-9]/g, "");
  return (sanitized.slice(0, 3) || "EMP").toUpperCase();
}

// Default vibrant distinct colors for each team member
export const DEFAULT_USER_COLORS: Record<string, string> = {
  HIM: "#f59e0b", // Amber (Himik)
  NIK: "#10b981", // Emerald (Nikhil)
  TAM: "#8b5cf6", // Violet (Tamanna)
  KUN: "#0ea5e9", // Sky Blue (Kunal)
  PRI: "#ec4899", // Pink (Priya)
  ISH: "#6366f1", // Indigo (Ishika)
  YAS: "#f97316", // Orange (Yash)
  KRI: "#14b8a6", // Teal (Kritika)
  KAR: "#3b82f6", // Blue (Kartavya)
  RAG: "#a855f7", // Purple (Ragini)
  MUS: "#e11d48", // Rose (Muskan)
  KRP: "#06b6d4", // Cyan (Krishnapriya)
};

export const CURATED_COLOR_OPTIONS = [
  { name: "Emerald", hex: "#10b981" },
  { name: "Teal", hex: "#14b8a6" },
  { name: "Sky Blue", hex: "#0ea5e9" },
  { name: "Blue", hex: "#3b82f6" },
  { name: "Indigo", hex: "#6366f1" },
  { name: "Violet", hex: "#8b5cf6" },
  { name: "Purple", hex: "#a855f7" },
  { name: "Pink", hex: "#ec4899" },
  { name: "Rose", hex: "#f43f5e" },
  { name: "Amber", hex: "#f59e0b" },
  { name: "Orange", hex: "#f97316" },
  { name: "Cyan", hex: "#06b6d4" },
];

export function getUserColor(empCode: string, customColor?: string): string {
  if (customColor && customColor.trim()) return customColor.trim();
  return DEFAULT_USER_COLORS[empCode.toUpperCase()] || "#64748b";
}

