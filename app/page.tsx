"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Kanban,
  Table2,
  ListTodo,
  BarChart3,
  Calendar as CalendarIcon,
  Search,
  RotateCcw,
  Download,
  Upload,
  Maximize2,
  Minimize2,
  Filter,
  MoreHorizontal,
  Archive,
  CheckCircle2,
  X,
} from "lucide-react";
import { TaskProvider, useTasks } from "@/lib/store";
import { AppShell } from "@/components/app-shell";
import { TaskBoard } from "@/components/task-board";
import { TaskTable } from "@/components/task-table";
import { TaskList } from "@/components/task-list";
import { TaskCalendar } from "@/components/task-calendar";
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
    tasks,
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
    archiveCompletedTasks,
  } = useTasks();

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
  const [isDateRangePopoverOpen, setIsDateRangePopoverOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  const filterPopoverRef = useRef<HTMLDivElement>(null);
  const dateRangePopoverRef = useRef<HTMLDivElement>(null);
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
        dateRangePopoverRef.current &&
        !dateRangePopoverRef.current.contains(event.target as Node)
      ) {
        setIsDateRangePopoverOpen(false);
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

  const hasCustomDateRange = Boolean(filter.dateFrom || filter.dateTo);
  const hasDateFilter =
    hasCustomDateRange || Boolean(filter.datePreset && filter.datePreset !== "all");

  // Count active granular filters
  const activeFiltersCount = [
    filter.assigneeId !== "all",
    filter.status !== "all",
    filter.priority !== "all",
    filter.project !== "all",
    hasDateFilter,
    filter.onlyMyTasks,
    filter.showArchived,
    filter.showCompletedHistory,
  ].filter(Boolean).length;

  const activeDoneTasksCount = tasks.filter(
    (t) => !t.isArchived && t.status === "completed"
  ).length;

  const dateFilterLabel = () => {
    if (filter.dateFrom && filter.dateTo) {
      return filter.dateFrom === filter.dateTo
        ? `Due: ${filter.dateFrom}`
        : `${filter.dateFrom} → ${filter.dateTo}`;
    }
    if (filter.dateFrom) return `From ${filter.dateFrom}`;
    if (filter.dateTo) return `Until ${filter.dateTo}`;
    switch (filter.datePreset) {
      case "today":
        return "Due Today";
      case "yesterday":
        return "Due Yesterday";
      case "this_week":
        return "This Week";
      case "next_7_days":
        return "Next 7 Days";
      case "overdue":
        return "Overdue";
      default:
        return "Date Range";
    }
  };

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

            {/* Right: Search, Due Date Range Picker, Filter & Overflow Actions */}
            <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap shrink-0">
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

              {/* Dedicated Due Date & Custom Date Range Picker */}
              <div className="relative" ref={dateRangePopoverRef}>
                <button
                  type="button"
                  onClick={() => setIsDateRangePopoverOpen((prev) => !prev)}
                  className={cn(
                    "flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-medium transition cursor-pointer",
                    hasDateFilter
                      ? "bg-primary/15 text-primary border border-primary/30 font-semibold"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted border border-border/70"
                  )}
                  title="Filter by due date or custom date range"
                >
                  <CalendarIcon className="size-3" />
                  <span>{dateFilterLabel()}</span>
                  {hasDateFilter && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        setFilter({
                          datePreset: "all",
                          dateFrom: "",
                          dateTo: "",
                        });
                      }}
                      className="ml-0.5 hover:text-destructive"
                      title="Clear date filter"
                    >
                      <X className="size-3" />
                    </span>
                  )}
                </button>

                {isDateRangePopoverOpen && (
                  <div className="absolute right-0 top-9 z-50 w-76 rounded-2xl border border-border bg-card p-4 shadow-float space-y-3.5 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="flex items-center justify-between border-b border-border pb-2">
                      <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <CalendarIcon className="size-3.5 text-primary" />
                        <span>Due Date Range Filter</span>
                      </span>
                      {hasDateFilter && (
                        <button
                          type="button"
                          onClick={() =>
                            setFilter({
                              datePreset: "all",
                              dateFrom: "",
                              dateTo: "",
                            })
                          }
                          className="text-[11px] text-primary hover:underline cursor-pointer"
                        >
                          Reset Dates
                        </button>
                      )}
                    </div>

                    {/* Quick Presets */}
                    <div>
                      <label className="text-[11px] font-semibold text-muted-foreground block mb-1.5">
                        Quick Date Presets
                      </label>
                      <div className="grid grid-cols-3 gap-1.5">
                        {[
                          { id: "all", label: "All Dates" },
                          { id: "today", label: "Today" },
                          { id: "yesterday", label: "Yesterday" },
                          { id: "this_week", label: "This Week" },
                          { id: "next_7_days", label: "Next 7 Days" },
                          { id: "overdue", label: "Overdue" },
                        ].map((p) => {
                          const isSelected =
                            (filter.datePreset || "all") === p.id && !hasCustomDateRange;
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() =>
                                setFilter({
                                  datePreset: p.id as DateRangePreset,
                                  dateFrom: "",
                                  dateTo: "",
                                })
                              }
                              className={cn(
                                "px-2 py-1.5 rounded-lg text-[11px] font-medium border transition cursor-pointer text-center",
                                isSelected
                                  ? "border-primary bg-primary/15 text-primary font-semibold"
                                  : "border-border bg-muted/30 text-muted-foreground hover:text-foreground hover:bg-muted"
                              )}
                            >
                              {p.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Single Custom Date Quick Picker */}
                    <div className="pt-1 border-t border-border/60">
                      <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                        Single Custom Date
                      </label>
                      <input
                        type="date"
                        value={
                          filter.dateFrom && filter.dateFrom === filter.dateTo
                            ? filter.dateFrom
                            : ""
                        }
                        onChange={(e) => {
                          const val = e.target.value;
                          setFilter({
                            datePreset: val ? "custom" : "all",
                            dateFrom: val,
                            dateTo: val,
                          });
                        }}
                        className="w-full h-8.5 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>

                    {/* Custom Start & End Date Range */}
                    <div className="pt-1 border-t border-border/60 space-y-2">
                      <label className="text-[11px] font-semibold text-muted-foreground block">
                        Custom Date Range (From — To)
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <span className="text-[10px] text-muted-foreground block mb-0.5">
                            From
                          </span>
                          <input
                            type="date"
                            value={filter.dateFrom || ""}
                            onChange={(e) =>
                              setFilter({
                                datePreset: "custom",
                                dateFrom: e.target.value,
                              })
                            }
                            className="w-full h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block mb-0.5">
                            To
                          </span>
                          <input
                            type="date"
                            value={filter.dateTo || ""}
                            onChange={(e) =>
                              setFilter({
                                datePreset: "custom",
                                dateTo: e.target.value,
                              })
                            }
                            className="w-full h-8 rounded-lg border border-border bg-background px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-1 flex justify-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="primary"
                        onClick={() => setIsDateRangePopoverOpen(false)}
                        className="h-7.5 text-xs w-full"
                      >
                        Apply Date Filter
                      </Button>
                    </div>
                  </div>
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
                  <div className="absolute right-0 top-9 z-50 w-72 rounded-xl border border-border bg-card p-3.5 shadow-float space-y-3 animate-in fade-in slide-in-from-top-2 duration-150">
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
                        Due Date Preset
                      </label>
                      <Select
                        value={filter.datePreset || "all"}
                        onChange={(e) =>
                          setFilter({
                            datePreset: e.target.value as DateRangePreset,
                            ...(e.target.value !== "custom"
                              ? { dateFrom: "", dateTo: "" }
                              : {}),
                          })
                        }
                        className="h-8 text-xs w-full bg-card"
                      >
                        <option value="all">All Dates</option>
                        <option value="today">Due Today</option>
                        <option value="yesterday">Due Yesterday</option>
                        <option value="this_week">This Week</option>
                        <option value="next_7_days">Next 7 Days</option>
                        <option value="overdue">Overdue</option>
                        <option value="custom">Custom Date Range</option>
                      </Select>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
                          From Date
                        </label>
                        <input
                          type="date"
                          value={filter.dateFrom || ""}
                          onChange={(e) =>
                            setFilter({
                              datePreset: "custom",
                              dateFrom: e.target.value,
                            })
                          }
                          className="w-full h-8 rounded-lg border border-border bg-card px-2 text-xs text-foreground"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-semibold text-muted-foreground block mb-1">
                          To Date
                        </label>
                        <input
                          type="date"
                          value={filter.dateTo || ""}
                          onChange={(e) =>
                            setFilter({
                              datePreset: "custom",
                              dateTo: e.target.value,
                            })
                          }
                          className="w-full h-8 rounded-lg border border-border bg-card px-2 text-xs text-foreground"
                        />
                      </div>
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
                  <div className="absolute right-0 top-9 z-50 w-52 rounded-xl border border-border bg-card p-1.5 shadow-float space-y-0.5 animate-in fade-in slide-in-from-top-2 duration-150">
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

                    {activeDoneTasksCount > 0 && (
                      <button
                        type="button"
                        onClick={async () => {
                          await archiveCompletedTasks();
                          setIsMoreMenuOpen(false);
                        }}
                        className="flex w-full items-center gap-2 px-2.5 py-1.5 text-xs text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition cursor-pointer border-t border-border mt-1 pt-1.5"
                      >
                        <CheckCircle2 className="size-3.5" />
                        <span>Move Done Out ({activeDoneTasksCount})</span>
                      </button>
                    )}

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
