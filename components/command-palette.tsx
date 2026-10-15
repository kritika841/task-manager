"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Plus,
  Zap,
  Kanban,
  Table2,
  ListTodo,
  BarChart3,
  UserCheck,
  Clock,
  RotateCcw,
  CheckCircle2,
  X,
  ArrowRight,
  User as UserIcon,
  Settings,
  Unplug,
  Radio,
  RotateCw,
} from "lucide-react";
import { useTasks } from "@/lib/store";
import { ViewMode } from "@/lib/types";
import { cn } from "@/lib/utils";

export function CommandPalette() {
  const {
    isCommandPaletteOpen,
    setIsCommandPaletteOpen,
    tasks,
    users,
    setViewMode,
    setFilter,
    resetFilter,
    setSelectedTaskId,
    setIsCreateModalOpen,
    setIsAutoDelegatorOpen,
    setIsSettingsModalOpen,
    isAdsManagementConnected,
    toggleAdsManagementConnection,
    refreshAll,
    switchUser,
    materializeDelegatorNow,
    currentUserId,
    isAdmin,
  } = useTasks();

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isCommandPaletteOpen) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isCommandPaletteOpen]);

  if (!isCommandPaletteOpen) return null;

  // Actions list
  const actions = [
    {
      id: "open-settings",
      title: "Open Settings & Ads Connection",
      category: "Settings",
      icon: Settings,
      run: () => {
        setIsSettingsModalOpen(true);
        setIsCommandPaletteOpen(false);
      },
    },
    {
      id: "toggle-ads-connection",
      title: isAdsManagementConnected
        ? "Disconnect from Ads Management (Standalone Mode)"
        : "Connect to Ads Management (Live Pipeline Sync)",
      category: "Settings",
      icon: isAdsManagementConnected ? Unplug : Radio,
      run: () => {
        toggleAdsManagementConnection();
        setIsCommandPaletteOpen(false);
      },
    },
    {
      id: "refresh-ads-sync",
      title: "Live Daily Sync: Refresh All Targets",
      category: "Action",
      icon: RotateCw,
      run: () => {
        refreshAll();
        setIsCommandPaletteOpen(false);
      },
    },
    {
      id: "create-task",
      title: "Create New Task",
      category: "Action",
      icon: Plus,
      run: () => {
        setIsCreateModalOpen(true);
        setIsCommandPaletteOpen(false);
      },
    },
    {
      id: "auto-delegator",
      title: "Open Auto Delegator Rules",
      category: "Automation",
      icon: Zap,
      run: () => {
        setIsAutoDelegatorOpen(true);
        setIsCommandPaletteOpen(false);
      },
    },
    {
      id: "run-delegator",
      title: "Run Auto Delegator for Today",
      category: "Automation",
      icon: Zap,
      run: () => {
        materializeDelegatorNow();
        setIsCommandPaletteOpen(false);
      },
    },
    {
      id: "view-board",
      title: "Switch to Board View",
      category: "Navigation",
      icon: Kanban,
      run: () => {
        setViewMode("board");
        setIsCommandPaletteOpen(false);
      },
    },
    {
      id: "view-table",
      title: "Switch to Table View",
      category: "Navigation",
      icon: Table2,
      run: () => {
        setViewMode("table");
        setIsCommandPaletteOpen(false);
      },
    },
    {
      id: "view-list",
      title: "Switch to Checklist View",
      category: "Navigation",
      icon: ListTodo,
      run: () => {
        setViewMode("list");
        setIsCommandPaletteOpen(false);
      },
    },
    {
      id: "view-analytics",
      title: "Switch to Overview / Stats View",
      category: "Navigation",
      icon: BarChart3,
      run: () => {
        setViewMode("analytics");
        setIsCommandPaletteOpen(false);
      },
    },
    {
      id: "filter-my-tasks",
      title: "Filter: My Tasks Only",
      category: "Filter",
      icon: UserCheck,
      run: () => {
        setFilter({ onlyMyTasks: true, assigneeId: "all" });
        setIsCommandPaletteOpen(false);
      },
    },
    {
      id: "filter-review",
      title: "Filter: Tasks In Review",
      category: "Filter",
      icon: Clock,
      run: () => {
        setFilter({ status: "in_review" });
        setIsCommandPaletteOpen(false);
      },
    },
    {
      id: "clear-filters",
      title: "Clear All Active Filters",
      category: "Filter",
      icon: RotateCcw,
      run: () => {
        resetFilter();
        setIsCommandPaletteOpen(false);
      },
    },
  ];

  // Matching tasks
  const matchingTasks = tasks
    .filter(
      (t) =>
        t.title.toLowerCase().includes(query.toLowerCase()) ||
        t.taskNumber.toLowerCase().includes(query.toLowerCase())
    )
    .slice(0, 5)
    .map((t) => ({
      id: `task-${t.id}`,
      title: `${t.taskNumber}: ${t.title}`,
      category: "Task",
      icon: CheckCircle2,
      run: () => {
        setSelectedTaskId(t.id);
        setIsCommandPaletteOpen(false);
      },
    }));

  // Matching users (Admin only)
  const matchingUsers = isAdmin
    ? users
        .filter(
          (u) =>
            u.active !== false &&
            !u.deletedAt &&
            (u.name.toLowerCase().includes(query.toLowerCase()) ||
              u.role.toLowerCase().includes(query.toLowerCase()))
        )
        .slice(0, 4)
        .map((u) => ({
          id: `user-${u.id}`,
          title: `Switch to ${u.name} (${u.role.replace("_", " ")})`,
          category: "User",
          icon: UserIcon,
          run: () => {
            switchUser(u.id);
            setIsCommandPaletteOpen(false);
          },
        }))
    : [];

  const filteredItems = query.trim()
    ? [...matchingTasks, ...matchingUsers, ...actions.filter((a) => a.title.toLowerCase().includes(query.toLowerCase()))]
    : actions;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredItems.length));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
    } else if (e.key === "Enter" && filteredItems[selectedIndex]) {
      e.preventDefault();
      filteredItems[selectedIndex].run();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setIsCommandPaletteOpen(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 p-4 bg-foreground/30 backdrop-blur-sm animate-in fade-in duration-100">
      <div className="w-full max-w-xl rounded-2xl border border-border bg-card shadow-float overflow-hidden flex flex-col">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 border-b border-border">
          <Search className="size-4 text-muted-foreground shrink-0 mr-2.5" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command, task title, or search..."
            className="w-full h-12 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
          />
          <kbd className="hidden sm:inline-block text-[10px] font-mono bg-muted text-muted-foreground px-1.5 py-0.5 rounded border border-border">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="max-h-80 overflow-y-auto p-2 space-y-1">
          {filteredItems.map((item, idx) => {
            const Icon = item.icon;
            const isSelected = idx === selectedIndex;

            return (
              <button
                key={item.id}
                type="button"
                onClick={item.run}
                onMouseEnter={() => setSelectedIndex(idx)}
                className={cn(
                  "flex w-full items-center justify-between px-3 py-2 rounded-xl text-xs text-left transition cursor-pointer",
                  isSelected
                    ? "bg-accent text-accent-foreground font-semibold"
                    : "text-foreground hover:bg-muted/50"
                )}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Icon className={cn("size-3.5 shrink-0", isSelected ? "text-primary" : "text-muted-foreground")} />
                  <span className="truncate">{item.title}</span>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground uppercase px-1.5 py-0.5 rounded bg-muted/60 shrink-0">
                  {item.category}
                </span>
              </button>
            );
          })}

          {filteredItems.length === 0 && (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No matching commands or tasks found for "{query}".
            </div>
          )}
        </div>

        {/* Footer shortcuts helper */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-border bg-muted/20 text-[10px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span>↑↓ to navigate</span>
            <span>↵ to select</span>
            <span>esc to close</span>
          </div>
          <span className="font-mono">Cmd + K</span>
        </div>
      </div>
    </div>
  );
}
