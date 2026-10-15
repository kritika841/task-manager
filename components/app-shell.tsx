"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Kanban,
  Table2,
  ListTodo,
  BarChart3,
  Calendar,
  Layers,
  Clock,
  Plus,
  Search,
  Menu,
  X,
  UserCheck,
  ChevronDown,
  Zap,
  Command,
  Archive,
  Settings,
  Unplug,
  LogOut,
  PanelLeft,
  Check,
} from "lucide-react";
import { useTasks } from "@/lib/store";
import { ThemeToggle } from "./theme-toggle";
import { SlaTimer } from "./sla-timer";
import { CommandPalette } from "./command-palette";
import { BulkActionsToolbar } from "./bulk-actions-toolbar";
import { ShortcutsModal } from "./shortcuts-modal";
import { NotificationCenter } from "./notification-center";
import { SettingsModal } from "./settings-modal";
import { Button } from "./ui/button";
import { cn, getUserColor, getEmployeeCode } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const {
    tasks,
    filteredTasks,
    baseVisibleTasks,
    users,
    currentUser,
    currentUserId,
    isAdmin,
    isManager,
    isManagerOrAdmin,
    viewMode,
    setViewMode,
    filter,
    setFilter,
    switchUser,
    logout,
    setIsCreateModalOpen,
    setIsAutoDelegatorOpen,
    setIsCommandPaletteOpen,
    setIsShortcutsModalOpen,
    isSettingsModalOpen,
    setIsSettingsModalOpen,
    isAdsManagementConnected,
    isSyncing,
  } = useTasks();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);

  const currentEmpCode = currentUser.employeeCode || getEmployeeCode(currentUser.name);
  const userColor = getUserColor(currentEmpCode, currentUser.color);

  // Close user dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setUserDropdownOpen(false);
      }
    }
    if (userDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [userDropdownOpen]);

  // Quick counts accurately reflect visible/showing tasks
  const myTasksCount = filter.onlyMyTasks
    ? filteredTasks.length
    : baseVisibleTasks.filter((t) => t.assigneeId === currentUserId).length;
  const inReviewCount = filter.status === "in_review"
    ? filteredTasks.length
    : baseVisibleTasks.filter((t) => t.status === "in_review").length;
  const archivedCount = tasks.filter((t) => t.isArchived).length;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Mobile Sidebar Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-xs lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* 1. Left Fixed Sidebar (Collapsible Notion Style) */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[240px] flex-col border-r border-border bg-card transition-all duration-200 ease-in-out",
          mobileMenuOpen ? "translate-x-0 shadow-float z-50" : "-translate-x-full",
          isSidebarCollapsed ? "lg:-translate-x-full" : "lg:translate-x-0"
        )}
      >
        {/* Top Header: Logo + Title */}
        <div className="flex flex-col items-start border-b border-border px-5 py-4">
          <Link
            href="/"
            className="flex flex-col items-start gap-1.5 group transition-transform active:scale-95"
            onClick={() => setMobileMenuOpen(false)}
          >
            <div className="relative flex items-center">
              <img
                src="/logo-light.png"
                alt="Satmi"
                className="h-6 w-auto max-w-[100px] object-contain dark:hidden"
              />
              <img
                src="/logo-dark.png"
                alt="Satmi"
                className="hidden h-6 w-auto max-w-[100px] object-contain dark:block"
              />
            </div>
            <span className="block text-sm font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors">
              Task Manager
            </span>
          </Link>
        </div>

        {/* Navigation Content */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
          {/* Views (Consistent 6-view list) */}
          <div>
            <div className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Views
            </div>
            <nav className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  setViewMode("board");
                  setMobileMenuOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition duration-150 cursor-pointer",
                  viewMode === "board"
                    ? "bg-accent text-accent-foreground font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Kanban className="size-4 shrink-0 text-primary" />
                  <span>Board</span>
                </div>
                <span className="text-[10px] font-mono opacity-70">
                  {filteredTasks.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setViewMode("table");
                  setMobileMenuOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition duration-150 cursor-pointer",
                  viewMode === "table"
                    ? "bg-accent text-accent-foreground font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Table2 className="size-4 shrink-0 text-primary" />
                  <span>Table</span>
                </div>
                <span className="text-[10px] font-mono opacity-70">All</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setViewMode("list");
                  setMobileMenuOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition duration-150 cursor-pointer",
                  viewMode === "list"
                    ? "bg-accent text-accent-foreground font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <ListTodo className="size-4 shrink-0 text-primary" />
                  <span>Checklist</span>
                </div>
                <span className="text-[10px] font-mono opacity-70">Units</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setViewMode("calendar");
                  setMobileMenuOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition duration-150 cursor-pointer",
                  viewMode === "calendar"
                    ? "bg-accent text-accent-foreground font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Calendar className="size-4 shrink-0 text-primary" />
                  <span>Calendar</span>
                </div>
              </button>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setViewMode("analytics");
                    setMobileMenuOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition duration-150 cursor-pointer",
                    viewMode === "analytics"
                      ? "bg-accent text-accent-foreground font-semibold"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <BarChart3 className="size-4 shrink-0 text-primary" />
                    <span>Analytics</span>
                  </div>
                  <span className="text-[10px] font-mono opacity-70">Admin</span>
                </button>
              )}
            </nav>
          </div>

          {/* Clean Quick Sections */}
          <div>
            <div className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Filter By
            </div>
            <nav className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  setFilter({
                    onlyMyTasks: !filter.onlyMyTasks,
                    assigneeId: "all",
                  });
                  setMobileMenuOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition duration-150 cursor-pointer",
                  filter.onlyMyTasks
                    ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <UserCheck className="size-4 shrink-0" />
                  <span>My Tasks</span>
                </div>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.2 text-[10px] font-mono font-medium",
                    filter.onlyMyTasks
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {myTasksCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setFilter({
                    status: filter.status === "in_review" ? "all" : "in_review",
                  });
                  setMobileMenuOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition duration-150 cursor-pointer",
                  filter.status === "in_review"
                    ? "bg-warning text-warning-foreground font-semibold shadow-xs"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Clock className="size-4 shrink-0 text-warning" />
                  <span>Needs Review</span>
                </div>
                {inReviewCount > 0 && (
                  <span className="rounded-full bg-warning/15 px-2 py-0.2 text-[10px] font-mono font-semibold text-warning">
                    {inReviewCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setFilter({
                    showArchived: !filter.showArchived,
                  });
                  setMobileMenuOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition duration-150 cursor-pointer",
                  filter.showArchived
                    ? "bg-amber-500 text-white font-semibold shadow-xs"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <Archive className="size-4 shrink-0 text-amber-500" />
                  <span>Archived</span>
                </div>
                {archivedCount > 0 && (
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.2 text-[10px] font-mono font-semibold",
                      filter.showArchived ? "bg-white/20 text-white" : "bg-amber-500/15 text-amber-500"
                    )}
                  >
                    {archivedCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setFilter({
                    showAdflowTasks: !filter.showAdflowTasks,
                  });
                  setMobileMenuOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition duration-150 cursor-pointer",
                  filter.showAdflowTasks
                    ? "bg-primary/15 text-primary font-semibold border border-primary/25"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                title="Toggle visibility of AdFlow active creatives (Default: Off)"
              >
                <div className="flex items-center gap-2.5">
                  <Zap className="size-4 shrink-0 text-primary" />
                  <span>AdFlow Tasks</span>
                </div>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.2 text-[9px] font-mono font-semibold uppercase",
                    filter.showAdflowTasks ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                  )}
                >
                  {filter.showAdflowTasks ? "On" : "Off"}
                </span>
              </button>
            </nav>
          </div>

          {/* Automation & Management (Managers/Admins only) */}
          {isManagerOrAdmin && (
            <div>
              <div className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Automation
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsAutoDelegatorOpen(true);
                  setMobileMenuOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition duration-150 cursor-pointer text-foreground hover:bg-primary/10 hover:text-primary border border-primary/20 bg-primary/5"
              >
                <div className="flex items-center gap-2.5">
                  <Zap className="size-4 shrink-0 text-primary" />
                  <span className="font-semibold">Auto Delegator</span>
                </div>
                <span className="text-[10px] font-semibold text-primary">Rules</span>
              </button>
            </div>
          )}

          {/* Configuration & Settings */}
          <div>
            <div className="px-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              Configuration
            </div>
            <button
              type="button"
              onClick={() => {
                setIsSettingsModalOpen(true);
                setMobileMenuOpen(false);
              }}
              className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition duration-150 cursor-pointer text-muted-foreground hover:bg-muted hover:text-foreground border border-transparent hover:border-border"
            >
              <div className="flex items-center gap-2.5">
                <Settings className="size-4 shrink-0 text-primary" />
                <span>Settings</span>
              </div>
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 text-[9px] font-semibold tracking-wide uppercase",
                  isAdsManagementConnected
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                )}
              >
                {isAdsManagementConnected ? "Live" : "Offline"}
              </span>
            </button>
          </div>
        </div>

        {/* Notion Bottom User Profile & Popover Menu (Matches reference image) */}
        <div className="border-t border-border/80 p-2 relative" ref={userMenuRef}>
          <button
            type="button"
            onClick={() => setUserDropdownOpen(!userDropdownOpen)}
            className="flex w-full items-center justify-between rounded-lg p-2 hover:bg-muted/60 transition cursor-pointer text-left group border border-transparent hover:border-border/60"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <div
                className="size-7 rounded-full font-bold text-xs flex items-center justify-center shrink-0 ring-1"
                style={{
                  backgroundColor: `${userColor}20`,
                  color: userColor,
                  borderColor: `${userColor}40`,
                }}
              >
                {currentUser.avatar}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold text-foreground truncate flex items-center gap-1.5">
                  <span>{currentUser.name}</span>
                  <span
                    className="font-mono text-[9px] font-bold px-1 rounded shrink-0"
                    style={{ backgroundColor: `${userColor}15`, color: userColor }}
                  >
                    {currentEmpCode}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {currentUser.email}
                </div>
              </div>
            </div>
            <ChevronDown className="size-3 text-muted-foreground group-hover:text-foreground shrink-0" />
          </button>

          {/* Notion Account Popover */}
          {userDropdownOpen && (
            <div className="absolute left-2 bottom-14 z-50 w-64 rounded-xl border border-border bg-card p-2 shadow-float animate-in fade-in slide-in-from-bottom-2 duration-150">
              {/* Account Header */}
              <div className="px-2.5 py-2 border-b border-border/70 mb-1">
                <div className="text-[11px] text-muted-foreground truncate">
                  {currentUser.email}
                </div>
                <div className="text-xs font-bold text-foreground mt-0.5 flex items-center justify-between">
                  <span>{currentUser.name}</span>
                  <Check className="size-3 text-emerald-500" />
                </div>
                <div className="text-[10px] font-mono text-muted-foreground mt-1">
                  Daily Quota: {currentUser.dailyCapacityUnits || 6} units/day
                </div>
              </div>

              {/* Action Links */}
              <div className="space-y-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => {
                    setIsSettingsModalOpen(true);
                    setUserDropdownOpen(false);
                  }}
                  className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg text-foreground hover:bg-muted cursor-pointer transition"
                >
                  <Settings className="size-3.5 text-muted-foreground" />
                  <span>Settings & Team</span>
                </button>

                {isManagerOrAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsAutoDelegatorOpen(true);
                      setUserDropdownOpen(false);
                    }}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg text-foreground hover:bg-muted cursor-pointer transition"
                  >
                    <Zap className="size-3.5 text-primary" />
                    <span>Auto Delegator Rules</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setIsShortcutsModalOpen(true);
                    setUserDropdownOpen(false);
                  }}
                  className="flex w-full items-center justify-between px-2.5 py-1.5 rounded-lg text-foreground hover:bg-muted cursor-pointer transition"
                >
                  <div className="flex items-center gap-2">
                    <Command className="size-3.5 text-muted-foreground" />
                    <span>Keyboard Shortcuts</span>
                  </div>
                  <kbd className="text-[10px] font-mono text-muted-foreground bg-muted px-1 py-0.2 rounded border border-border">
                    ?
                  </kbd>
                </button>

                <div className="border-t border-border/70 my-1 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setUserDropdownOpen(false);
                      logout();
                    }}
                    className="flex w-full items-center gap-2 px-2.5 py-1.5 rounded-lg text-destructive hover:bg-destructive/10 cursor-pointer transition font-medium"
                  >
                    <LogOut className="size-3.5" />
                    <span>Log out</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>

      {/* Right Content Area */}
      <div
        className={cn(
          "flex-1 flex flex-col min-w-0 transition-all duration-200",
          isSidebarCollapsed ? "lg:pl-0" : "lg:pl-[240px]"
        )}
      >
        {/* Streamlined Sticky Header */}
        <header className="sticky top-0 z-30 flex h-12 w-full items-center justify-between border-b border-border/80 bg-card/95 px-4 lg:px-6 text-card-foreground backdrop-blur">
          <div className="flex items-center gap-2.5">
            {/* Mobile Menu Button */}
            <button
              type="button"
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden cursor-pointer"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle mobile menu"
            >
              {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>

            {/* Desktop Notion Sidebar Collapse Toggle */}
            <button
              type="button"
              className="hidden lg:flex rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <PanelLeft className="size-4" />
            </button>

            {/* Breadcrumb / Title */}
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-foreground">Satmi Workspace</span>
              <span className="text-muted-foreground">/</span>
              <span className="text-muted-foreground">Tasks</span>
            </div>
          </div>

          {/* Right Header Cluster (Focused & Decluttered) */}
          <div className="flex items-center gap-2">
            {/* Live Cutoff Countdown Timer (SLA) */}
            <SlaTimer />

            {/* Command Palette Button (Cmd+K) */}
            <button
              type="button"
              onClick={() => setIsCommandPaletteOpen(true)}
              className="hidden md:flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
              title="Open Command Palette (Cmd + K)"
            >
              <Search className="size-3.5" />
              <span className="text-[11px]">Search...</span>
              <kbd className="text-[9px] font-mono bg-card px-1 py-0.2 rounded border border-border">
                ⌘K
              </kbd>
            </button>

            {/* Compact Ads Connection Status Pill */}
            {isAdsManagementConnected ? (
              <button
                type="button"
                onClick={() => setIsSettingsModalOpen(true)}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-2.5 py-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition cursor-pointer"
                title="Connected to Supabase Ads Pipeline. Click for Settings."
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full bg-emerald-500",
                    isSyncing ? "animate-spin" : "animate-pulse"
                  )}
                />
                <span>{isSyncing ? "Syncing" : "Live Ads"}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setIsSettingsModalOpen(true)}
                className="hidden sm:inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/25 px-2.5 py-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition cursor-pointer"
                title="Standalone Mode (Ads Disconnected). Click for Settings."
              >
                <Unplug className="size-3 text-amber-500" />
                <span>Offline</span>
              </button>
            )}

            {/* Notification Center */}
            <NotificationCenter />

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Primary Action Button: + New Task */}
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateModalOpen(true)}
              className="gap-1.5 text-xs h-8 shadow-xs"
            >
              <Plus className="size-3.5" />
              <span>New Task</span>
            </Button>
          </div>
        </header>

        {/* Main Page Area */}
        <main className="flex-1">
          <div className="page-container">{children}</div>
        </main>
      </div>

      {/* Global Command Palette (Cmd + K) */}
      <CommandPalette />

      {/* Floating Bulk Actions Toolbar */}
      <BulkActionsToolbar />

      {/* Keyboard Shortcuts Cheat Sheet (?) */}
      <ShortcutsModal />

      {/* Settings & Ads Connection Modal */}
      <SettingsModal />
    </div>
  );
}
