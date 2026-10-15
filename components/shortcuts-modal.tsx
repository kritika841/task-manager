"use client";

import React from "react";
import { X, Keyboard, Command } from "lucide-react";
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
    { key: "Esc", description: "Close active modal/drawer / Clear task selection" },
    { key: "?", description: "Show this Keyboard Shortcuts cheat sheet" },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/25 backdrop-blur-xs animate-in fade-in duration-100">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-float">
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Keyboard className="size-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Keyboard Shortcuts</h2>
          </div>
          <button
            type="button"
            onClick={() => setIsShortcutsModalOpen(false)}
            className="size-7 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-3.5 divide-y divide-border/60 text-xs">
          {shortcuts.map((s) => (
            <div key={s.key} className="flex items-center justify-between py-2">
              <span className="text-muted-foreground">{s.description}</span>
              <kbd className="rounded-md border border-border bg-muted/50 px-2 py-0.5 font-mono text-[11px] font-semibold text-foreground shadow-2xs">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="mt-4 pt-3 border-t border-border flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Shortcuts work when not typing in text fields</span>
          <button
            type="button"
            onClick={() => setIsShortcutsModalOpen(false)}
            className="text-primary hover:underline font-medium cursor-pointer"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
