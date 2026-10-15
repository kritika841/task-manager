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
  Zap,
  Download,
  Upload,
  Maximize2,
  Minimize2,
  Filter,
  MoreHorizontal,
  X,
  Archive,
  CheckSquare,
  Plus,
  UserCheck,
  Clock,
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
import { LoginView } from "@/components/login-view";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/field";
import { DateRangePreset } from "@/lib/types";
import { cn } from "@/lib/utils";

function TaskDashboardContent() {
  const {
    tasks,
    users,
    filteredTasks,
    currentUser,
    isAdmin,
    isManager,
    isManagerOrAdmin,
    viewMode,
    setViewMode,
    density,
    setDensity,
    filter,
    setFilter,
    resetFilter,
    openCreateModal,
    setIsAutoDelegatorOpen,
    exportTasksToCSV,
  } = useTasks();

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isFilterPopoverOpen, setIsFilterPopoverOpen] = useState(false);
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);

  const filterPopoverRef = useRef<HTMLDivElement>(null);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Security redirect: Non-admin users cannot access analytics view
  useEffect(() => {
    if (!isAdmin && viewMode === "analytics") {
      setViewMode("board");
    }
  }, [isAdmin, viewMode, setViewMode]);

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
    Boolean(filter.showAdflowTasks),
  ].filter(Boolean).length;

  // Active preset tracking
  const isMyTasksActive = filter.onlyMyTasks;
  const isNeedsReviewActive = filter.status === "in_review";
  const isOverdueActive = filter.datePreset === "overdue";
  const isHighUrgentActive = filter.priority === "urgent" || filter.priority === "high";
  const isAllActive =
    !isMyTasksActive &&
    !isNeedsReviewActive &&
    !isOverdueActive &&
    !isHighUrgentActive &&
    activeFiltersCount === 0 &&
    !filter.search;

  const myTasksCount = tasks.filter((t) => t.assigneeId === currentUser?.id && !t.isArchived).length;
  const inReviewCount = tasks.filter((t) => t.status === "in_review" && !t.isArchived).length;
  const overdueCount = tasks.filter((t) => {
    const today = new Date().toISOString().slice(0, 10);
    return t.dueDate < today && t.status !== "completed" && !t.isArchived;
  }).length;

  return (
    <div className="space-y-4">
      {/* Notion Breadcrumb & Page Title Header */}
      <div className="flex flex-col gap-1.5 pt-1">
        {/* Subtle Notion Breadcrumbs */}
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1 font-medium text-foreground">
            <CheckSquare className="size-3.5 text-primary" />
            <span>Tasks</span>
          </span>
          <span>/</span>
          <span className="text-muted-foreground hover:text-foreground transition cursor-pointer">
            Satmi Operations
          </span>
        </div>

        {/* Big Notion Title & Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-0.5">
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
              Tasks
            </h1>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
                isAdmin
                  ? "bg-primary/15 text-primary border border-primary/20"
                  : isManager
                  ? "bg-indigo-500/15 text-indigo-500 border border-indigo-500/20"
                  : "bg-muted text-muted-foreground"
              )}
            >
              {isAdmin ? "Admin" : isManager ? "Manager" : "Member"}
            </span>
            <span className="text-xs font-mono text-muted-foreground">
              ({filteredTasks.length} {filteredTasks.length === 1 ? "task" : "tasks"})
            </span>
          </div>

          {/* Primary Quick Create Button */}
          <div className="flex items-center gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => openCreateModal()}
              className="gap-1.5 text-xs h-7.5 px-3 rounded-lg shadow-2xs font-semibold"
            >
              <Plus className="size-3.5" />
              <span>New task</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Notion Database Views Tab Bar & Inline Action Tools */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border/80 pb-2 gap-3">
        {/* Left: Notion Database View Tabs */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-none text-xs">
          <button
            type="button"
            onClick={() => {
              resetFilter();
              setViewMode("board");
            }}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer shrink-0",
              viewMode === "board" && isAllActive
                ? "bg-muted text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            )}
          >
            <span>All</span>
          </button>

          <button
            type="button"
            onClick={() => setViewMode("board")}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer shrink-0",
              viewMode === "board" && !isAllActive
                ? "bg-muted text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            )}
          >
            <Kanban className="size-3.5 text-primary" />
            <span>Board</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setFilter({
                onlyMyTasks: !isMyTasksActive,
                assigneeId: "all",
              });
              setViewMode("board");
            }}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer shrink-0",
              isMyTasksActive
                ? "bg-primary/15 text-primary font-semibold border border-primary/25"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            )}
          >
            <UserCheck className="size-3.5" />
            <span>Mine</span>
            {myTasksCount > 0 && (
              <span className="text-[10px] font-mono opacity-80">({myTasksCount})</span>
            )}
          </button>

          <button
            type="button"
            onClick={() => {
              setFilter({
                status: isNeedsReviewActive ? "all" : "in_review",
              });
              setViewMode("board");
            }}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition cursor-pointer shrink-0",
              isNeedsReviewActive
                ? "bg-warning/15 text-warning font-semibold border border-warning/25"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            )}
          >
            <Clock className="size-3.5" />
            <span>Needs Review</span>
            {inReviewCount > 0 && (
              <span className="text-[10px] font-mono opacity-80">({inReviewCount})</span>
            )}
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
        </div>

        {/* Right: Inline Action Toolbar (Notion Style) */}
        <div className="flex items-center gap-1.5 shrink-0">
          {/* Quick Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search..."
              value={filter.search}
              onChange={(e) => setFilter({ search: e.target.value })}
              className="w-28 sm:w-36 pl-7 pr-2 py-1 text-xs rounded-lg bg-muted/40 border border-border/80 text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary transition"
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

          {/* AdFlow Tasks Toggle (Default: Off) */}
          <button
            type="button"
            onClick={() => setFilter({ showAdflowTasks: !filter.showAdflowTasks })}
            className={cn(
              "flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-xs font-medium transition cursor-pointer border",
              filter.showAdflowTasks
                ? "bg-primary/15 text-primary border-primary/30 font-semibold shadow-2xs"
                : "text-muted-foreground hover:text-foreground hover:bg-muted border-border/70"
            )}
            title={
              filter.showAdflowTasks
                ? "AdFlow tasks active. Click to hide (Default: Off)."
                : "AdFlow tasks hidden. Click to view live pipeline creatives."
            }
          >
            <Zap
              className={cn(
                "size-3",
                filter.showAdflowTasks ? "text-primary fill-primary" : "text-muted-foreground"
              )}
            />
            <span className="hidden sm:inline">AdFlow Tasks</span>
            <span
              className={cn(
                "px-1 py-0.2 rounded text-[9px] font-mono uppercase font-bold",
                filter.showAdflowTasks ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
              )}
            >
              {filter.showAdflowTasks ? "On" : "Off"}
            </span>
          </button>

          {/* Filter Popover Button & Panel */}
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

            {/* Filter Popover Content */}
            {isFilterPopoverOpen && (
              <div className="absolute right-0 top-9 z-50 w-72 rounded-xl border border-border bg-card p-3 shadow-float space-y-3 animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <span className="text-xs font-bold text-foreground">Filter Tasks</span>
                  {activeFiltersCount > 0 && (
                    <button
                      type="button"
                      onClick={resetFilter}
                      className="text-[11px] text-primary hover:underline cursor-pointer"
                    >
                      Clear all ({activeFiltersCount})
                    </button>
                  )}
                </div>

                {/* Status Dropdown */}
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

                {/* Priority Dropdown */}
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                    Priority
                  </label>
                  <Select
                    value={filter.priority}
                    onChange={(e) => setFilter({ priority: e.target.value })}
                    className="h-8 text-xs w-full bg-card"
                  >
                    <option value="all">All Priorities</option>
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </Select>
                </div>

                {/* Date Preset Dropdown */}
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                    Due Date
                  </label>
                  <Select
                    value={filter.datePreset || "all"}
                    onChange={(e) =>
                      setFilter({ datePreset: e.target.value as DateRangePreset })
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

                {/* Assignee Dropdown */}
                <div>
                  <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                    Assigned Member
                  </label>
                  <Select
                    value={filter.assigneeId}
                    onChange={(e) => setFilter({ assigneeId: e.target.value })}
                    className="h-8 text-xs w-full bg-card"
                  >
                    <option value="all">All Members</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.role})
                      </option>
                    ))}
                  </Select>
                </div>

                {/* AdFlow Creative Tasks Filter Toggle */}
                <div className="border-t border-border/70 pt-2.5">
                  <label className="flex items-center justify-between cursor-pointer group select-none">
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5 group-hover:text-primary transition-colors">
                        <Zap className="size-3 text-primary" />
                        <span>Include AdFlow Tasks</span>
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        Show live creatives from Ads Management (Default: Off)
                      </span>
                    </div>
                    <input
                      type="checkbox"
                      checked={!!filter.showAdflowTasks}
                      onChange={(e) => setFilter({ showAdflowTasks: e.target.checked })}
                      className="rounded border-border text-primary focus:ring-primary size-4 cursor-pointer"
                    />
                  </label>
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

          {/* Auto Delegator (⚡ Zap) */}
          {isManagerOrAdmin && (
            <button
              type="button"
              onClick={() => setIsAutoDelegatorOpen(true)}
              className="flex items-center gap-1 h-7 px-2 rounded-lg text-xs font-medium text-muted-foreground hover:text-primary hover:bg-primary/10 transition cursor-pointer border border-border/70"
              title="Auto Delegator Rules"
            >
              <Zap className="size-3 text-primary" />
              <span className="hidden sm:inline">Rules</span>
            </button>
          )}

          {/* Density Toggle */}
          <button
            type="button"
            onClick={() => setDensity(density === "comfortable" ? "compact" : "comfortable")}
            className="flex items-center justify-center size-7 text-muted-foreground hover:text-foreground rounded-lg border border-border/70 hover:bg-muted transition cursor-pointer"
            title={`Toggle density (${density})`}
          >
            {density === "comfortable" ? <Minimize2 className="size-3.5" /> : <Maximize2 className="size-3.5" />}
          </button>

          {/* More Actions Overflow Menu (CSV Export/Import & Archive) */}
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
                  <span>Export Tasks (CSV)</span>
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
                  <span>Import Tasks (CSV)</span>
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
                  <span>{filter.showArchived ? "Hide Archived" : "Show Archived"}</span>
                </button>
              </div>
            )}
          </div>

          {/* Reset Filters button if any active */}
          {(activeFiltersCount > 0 || filter.search || !isAllActive) && (
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

      {/* 3. Main Views Rendering */}
      <div>
        {viewMode === "board" && <TaskBoard />}
        {viewMode === "table" && <TaskTable />}
        {viewMode === "list" && <TaskList />}
        {viewMode === "calendar" && <TaskCalendar />}
        {viewMode === "analytics" && isAdmin && <TaskAnalytics />}
      </div>

      {/* 4. Slide-Over Detail Drawer */}
      <TaskDrawer />

      {/* 5. Create Task Modal */}
      <TaskCreateModal />

      {/* 6. Auto Delegator Modal */}
      <AutoDelegatorModal />

      {/* 7. CSV Import Modal */}
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
        <span className="text-xs text-muted-foreground font-mono">Verifying workspace session...</span>
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
