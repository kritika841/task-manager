"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Kanban,
  Table2,
  ListTodo,
  BarChart3,
  Calendar as CalendarIcon,
  Layers,
  Search,
  RotateCcw,
  Download,
  Upload,
  Maximize2,
  Minimize2,
  Filter,
  MoreHorizontal,
  Archive,
} from "lucide-react";
import { TaskProvider, useTasks } from "@/lib/store";
import { AppShell } from "@/components/app-shell";
import { TaskBoard } from "@/components/task-board";
import { TaskTable } from "@/components/task-table";
import { TaskList } from "@/components/task-list";
import { TaskCalendar } from "@/components/task-calendar";
import { TaskTimeline } from "@/components/task-timeline";
import { TaskAnalytics } from "@/components/task-analytics";
import { TaskDrawer } from "@/components/task-drawer";
import { TaskCreateModal } from "@/components/task-create-modal";
import { AutoDelegatorModal } from "@/components/auto-delegator-modal";
import { TaskImportModal } from "@/components/task-import-modal";
import { PersonalNotepad } from "@/components/personal-notepad";
import { RemindersPanel } from "@/components/reminders-panel";
import { LoginView } from "@/components/login-view";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/field";
import { DateRangePreset } from "@/lib/types";
import { cn } from "@/lib/utils";

function TaskDashboardContent() {
  const {
    users,
    filteredTasks,
    isAdmin,
    activeSection,
    viewMode,
    setViewMode,
    density,
    setDensity,
    filter,
    setFilter,
    resetFilter,
    exportTasksToCSV,
  } = useTasks();

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  const filterPopoverRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Close menus on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        filterPopoverRef.current &&
        !filterPopoverRef.current.contains(event.target as Node)
      ) {
        setIsFilterPopoverOpen(false);
      }
      if (
        moreMenuRef.current &&
        !moreMenuRef.current.contains(event.target as Node)
      ) {
        setIsMoreMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Count active granular filters
  const activeFiltersCount = [
    filter.assigneeId !== "all",
    filter.status !== "all",
    filter.priority !== "all",
    filter.project !== "all",
    filter.datePreset && filter.datePreset !== "all",
    filter.onlyMyTasks,
    filter.showArchived,
  ].filter(Boolean).length;

  return (
    <div className="space-y-3">
      {activeSection === "notepad" ? (
        <PersonalNotepad asView={true} />
      ) : activeSection === "reminders" ? (
        <RemindersPanel asView={true} />
      ) : (
        <>
          {/* Clean View Tabs & Action Toolbar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border/80 pb-2.5 gap-2.5">
            {/* Left: View Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none text-xs">
              <button
                type="button"
                onClick={() => setViewMode("board")}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer shrink-0",
                  viewMode === "board"
                    ? "bg-muted text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                )}
              >
                <Kanban className="size-3.5 text-primary" />
                <span>Board</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode("table")}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer shrink-0",
                  viewMode === "table"
                    ? "bg-muted text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                )}
              >
                <Table2 className="size-3.5" />
                <span>Table</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer shrink-0",
                  viewMode === "list"
                    ? "bg-muted text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                )}
              >
                <ListTodo className="size-3.5" />
                <span>Checklist</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode("calendar")}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer shrink-0",
                  viewMode === "calendar"
                    ? "bg-muted text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                )}
              >
                <CalendarIcon className="size-3.5" />
                <span>Calendar</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode("timeline")}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer shrink-0",
                  viewMode === "timeline"
                    ? "bg-muted text-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                )}
              >
                <Layers className="size-3.5" />
                <span>Timeline</span>
              </button>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setViewMode("analytics")}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer shrink-0",
                    viewMode === "analytics"
                      ? "bg-muted text-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                  )}
                >
                  <BarChart3 className="size-3.5" />
                  <span>Analytics</span>
                </button>
              )}

              <span className="ml-1 text-[11px] font-mono text-muted-foreground">
                ({filteredTasks.length})
              </span>
            </div>

            {/* Right: Search, Filter & Overflow Actions */}
            <div className="flex items-center gap-1.5 shrink-0">
              {/* Quick Search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search tasks..."
                  value={filter.search}
                  onChange={(e) => setFilter({ search: e.target.value })}
                  className="w-32 sm:w-44 pl-7 pr-2 py-1 text-xs rounded-lg bg-muted/40 border border-border/80 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary transition"
                />
                {filter.search && (
                  <button
                    type="button"
                    onClick={() => setFilter({ search: "" })}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-foreground"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Filter Popover */}
              <div className="relative" ref={filterPopoverRef}>
                <button
                  type="button"
                  onClick={() => setIsFilterPopoverOpen((prev) => !prev)}
                  className={cn(
                    "flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-medium transition cursor-pointer",
                    activeFiltersCount > 0
                      ? "bg-primary/15 text-primary border border-primary/30 font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted border border-border/70"
                  )}
                  title="Filter tasks"
                >
                  <Filter className="size-3" />
                  <span className="hidden sm:inline">Filter</span>
                  {activeFiltersCount > 0 && (
                    <span className="size-3.5 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                      {activeFiltersCount}
                    </span>
                  )}
                </button>

                {isFilterPopoverOpen && (
                  <div className="absolute right-0 top-9 z-50 w-68 rounded-xl border border-border bg-card p-3 shadow-float space-y-3 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="flex items-center justify-between border-b border-border pb-2">
                      <span className="text-xs font-bold text-foreground">
                        Filter Tasks
                      </span>
                      {activeFiltersCount > 0 && (
                        <button
                          type="button"
                          onClick={resetFilter}
                          className="text-[11px] text-primary hover:underline cursor-pointer"
                        >
                          Clear all
                        </button>
                      )}
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                        Status
                      </label>
                      <Select
                        value={filter.status}
                        onChange={(e) => setFilter({ status: e.target.value })}
                        className="h-8 text-xs w-full bg-card"
                      >
                        <option value="all">All Statuses</option>
                        <option value="todo">To Do</option>
                        <option value="in_progress">In Progress</option>
                        <option value="in_review">In Review</option>
                        <option value="completed">Done</option>
                        <option value="backlog">Backlog</option>
                      </Select>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                        Priority
                      </label>
                      <Select
                        value={filter.priority}
                        onChange={(e) =>
                          setFilter({ priority: e.target.value })
                        }
                        className="h-8 text-xs w-full bg-card"
                      >
                        <option value="all">All Priorities</option>
                        <option value="urgent">Urgent</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </Select>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                        Due Date
                      </label>
                      <Select
                        value={filter.datePreset || "all"}
                        onChange={(e) =>
                          setFilter({
                            datePreset: e.target.value as DateRangePreset,
                          })
                        }
                        className="h-8 text-xs w-full bg-card"
                      >
                        <option value="all">All Dates</option>
                        <option value="today">Due Today</option>
                        <option value="yesterday">Due Yesterday</option>
                        <option value="next_7_days">Next 7 Days</option>
                        <option value="overdue">Overdue</option>
                      </Select>
                    </div>

                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                        Assigned Member
                      </label>
                      <Select
                        value={filter.assigneeId}
                        onChange={(e) =>
                          setFilter({ assigneeId: e.target.value })
                        }
                        className="h-8 text-xs w-full bg-card"
                      >
                        <option value="all">All Members</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.role.replace("_", " ")})
                          </option>
                        ))}
                      </Select>
                    </div>

                    <div className="pt-1 flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => setIsFilterPopoverOpen(false)}
                        className="h-7 text-xs w-full"
                      >
                        Done
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Density Toggle */}
              <button
                type="button"
                onClick={() =>
                  setDensity(
                    density === "comfortable" ? "compact" : "comfortable"
                  )
                }
                className="flex items-center justify-center size-7 text-muted-foreground hover:text-foreground rounded-lg border border-border/70 hover:bg-muted transition cursor-pointer"
                title={`Toggle density (${density})`}
              >
                {density === "comfortable" ? (
                  <Minimize2 className="size-3.5" />
                ) : (
                  <Maximize2 className="size-3.5" />
                )}
              </button>

              {/* More Actions Menu */}
              <div className="relative" ref={moreMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsMoreMenuOpen((prev) => !prev)}
                  className="flex items-center justify-center size-7 rounded-lg border border-border/70 bg-card hover:bg-muted text-muted-foreground hover:text-foreground transition cursor-pointer"
                  title="More Actions"
                >
                  <MoreHorizontal className="size-3.5" />
                </button>

                {isMoreMenuOpen && (
                  <div className="absolute right-0 top-9 z-50 w-48 rounded-xl border border-border bg-card p-1.5 shadow-float space-y-0.5 animate-in fade-in slide-in-from-top-2 duration-150">
                    <button
                      type="button"
                      onClick={() => {
                        exportTasksToCSV();
                        setIsMoreMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-2.5 py-1.5 text-xs text-foreground hover:bg-muted rounded-lg transition cursor-pointer"
                    >
                      <Download className="size-3.5 text-muted-foreground" />
                      <span>Export CSV</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setIsImportModalOpen(true);
                        setIsMoreMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-2.5 py-1.5 text-xs text-foreground hover:bg-muted rounded-lg transition cursor-pointer"
                    >
                      <Upload className="size-3.5 text-muted-foreground" />
                      <span>Import CSV</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setFilter({ showArchived: !filter.showArchived });
                        setIsMoreMenuOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-2.5 py-1.5 text-xs text-foreground hover:bg-muted rounded-lg transition cursor-pointer border-t border-border mt-1 pt-1.5"
                    >
                      <Archive className="size-3.5 text-amber-500" />
                      <span>
                        {filter.showArchived ? "Hide Archived" : "Show Archived"}
                      </span>
                    </button>
                  </div>
                )}
              </div>

              {(activeFiltersCount > 0 || filter.search) && (
                <button
                  type="button"
                  onClick={resetFilter}
                  className="flex items-center gap-1 text-[11px] text-primary hover:underline px-1.5 py-0.5 cursor-pointer shrink-0"
                  title="Reset all filters"
                >
                  <RotateCcw className="size-3" />
                  <span className="hidden sm:inline">Reset</span>
                </button>
              )}
            </div>
          </div>

          {/* Main Views Rendering */}
          <div>
            {viewMode === "board" && <TaskBoard />}
            {viewMode === "table" && <TaskTable />}
            {viewMode === "list" && <TaskList />}
            {viewMode === "calendar" && <TaskCalendar />}
            {viewMode === "timeline" && <TaskTimeline />}
            {viewMode === "analytics" && <TaskAnalytics />}
          </div>
        </>
      )}

      {/* Global Slide-Over & Action Modals */}
      <TaskDrawer />
      <TaskCreateModal />
      <AutoDelegatorModal />
      <TaskImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
      />
    </div>
  );
}

function AuthenticatedApp() {
  const { isAuthenticated, isAuthLoading, login } = useTasks();

  if (isAuthLoading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background text-foreground gap-3">
        <div className="size-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
        <span className="text-xs text-muted-foreground font-mono">
          Loading workspace...
        </span>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginView onLogin={login} />;
  }

  return (
    <AppShell>
      <TaskDashboardContent />
    </AppShell>
  );
}

export default function Page() {
  return (
    <TaskProvider>
      <AuthenticatedApp />
    </TaskProvider>
  );
}
