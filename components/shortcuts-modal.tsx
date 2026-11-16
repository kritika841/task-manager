"use client";

import React from "react";
import { X, Keyboard } from "lucide-react";
import { useTasks } from "@/lib/store";

export function ShortcutsModal() {
  const { isShortcutsModalOpen, setIsShortcutsModalOpen } = useTasks();

  if (!isShortcutsModalOpen) return null;

  const shortcuts = [
    { key: "⌘ + K", description: "Open Command Palette / Instant Search" },
    { key: "S / ⌘ ,", description: "Open Settings & Ads Management Connection" },
    { key: "C", description: "Create & Assign New Daily Task" },
    { key: "B", description: "Switch to Board View (Kanban & Swimlanes)" },
    { key: "T", description: "Switch to Table View (Dense Grid & Multi-Select)" },
    { key: "L", description: "Switch to Checklist View (Unit Stepper)" },
    { key: "O", description: "Switch to Overview / Analytics & Capacity" },
    { key: "D", description: "Switch to Calendar View" },
    { key: "Esc", description: "Close active modal/drawer / Clear task selection" },
    { key: "?", description: "Show this Keyboard Shortcuts cheat sheet" },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-foreground/30 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={() => setIsShortcutsModalOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-float"
      >
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Keyboard className="size-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                Keyboard Shortcuts
              </h2>
              <p className="text-xs text-muted-foreground">
                Navigate and manage tasks faster across the workspace
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsShortcutsModalOpen(false)}
            className="size-8 rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition cursor-pointer"
            aria-label="Close shortcuts"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-4 divide-y divide-border/60 text-sm">
          {shortcuts.map((s) => (
            <div key={s.key} className="flex items-center justify-between py-2.5">
              <span className="text-foreground/90">{s.description}</span>
              <kbd className="rounded-lg border border-border bg-muted/60 px-2.5 py-1 font-mono text-xs font-semibold text-foreground shadow-2xs shrink-0 ml-3">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="mt-5 pt-3.5 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
          <span>Click anywhere outside or press Esc to dismiss</span>
          <button
            type="button"
            onClick={() => setIsShortcutsModalOpen(false)}
            className="rounded-lg bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 transition cursor-pointer"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
