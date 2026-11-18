"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
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
  LogIn,
  LogOut,
  PanelLeft,
  LayoutTemplate,
  StickyNote,
  AlarmClock,
  Volume2,
  VolumeX,
  Sparkles,
  LayoutDashboard,
  CheckCircle2,
  CalendarCheck,
  MessageSquarePlus,
} from "lucide-react";
import { useTasks } from "@/lib/store";
import { isSoundMuted, toggleSoundMuted } from "@/lib/sound";
import { ThemeToggle } from "./theme-toggle";
import { CommandPalette } from "./command-palette";
import { BulkActionsToolbar } from "./bulk-actions-toolbar";
import { ShortcutsModal } from "./shortcuts-modal";
import { NotificationCenter } from "./notification-center";
import { SettingsModal } from "./settings-modal";
import { RoleTemplateModal } from "./role-template-modal";
import { FeatureRequestModal } from "./feature-request-modal";
import { RemindersPanel } from "./reminders-panel";
import { Button } from "./ui/button";
import { cn, getUserColor, getEmployeeCode } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const store = useTasks() as ReturnType<typeof useTasks> & {
    isDeveloper?: boolean;
    isAdminOrDeveloper?: boolean;
    soundMuted?: boolean;
    toggleSound?: () => void;
  };

  const {
    tasks,
    filteredTasks,
    baseVisibleTasks,
    currentUser,
    currentUserId,
    isAdmin,
    isManagerOrAdmin,
    activeSection,
    setActiveSection,
    viewMode,
    filter,
    setFilter,
    logout,
    setIsCreateModalOpen,
    setIsAutoDelegatorOpen,
    setIsCommandPaletteOpen,
    setIsShortcutsModalOpen,
    setIsSettingsModalOpen,
    isRoleTemplateModalOpen,
    setIsRoleTemplateModalOpen,
    myTodayAttendance,
    isAttendanceLoading,
    checkInToday,
    checkOutToday,
  } = store;

  const isDeveloper = store.isDeveloper ?? currentUser?.role === "developer";
  const isAdminOrDeveloper =
    store.isAdminOrDeveloper ?? (isAdmin || isDeveloper);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [userDropdownOpen, setUserDropdownOpen] = useState(false);
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [feedbackInitialTab, setFeedbackInitialTab] = useState<
    "submit" | "manage"
  >("submit");
  const [dueRemindersCount, setDueRemindersCount] = useState(0);
  const [pendingRemindersCount, setPendingRemindersCount] = useState(0);
  const [localMuted, setLocalMuted] = useState<boolean>(false);

  const userMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalMuted(store.soundMuted ?? isSoundMuted());
  }, [store.soundMuted]);

  const handleToggleSound = () => {
    if (store.toggleSound) {
      store.toggleSound();
      setLocalMuted(isSoundMuted());
    } else {
      const next = toggleSoundMuted();
      setLocalMuted(next);
    }
  };

  const currentEmpCode =
    currentUser.employeeCode || getEmployeeCode(currentUser.name);
  const userColor = getUserColor(currentEmpCode, currentUser.color);

  const formatShortISTTime = (iso: string | null | undefined) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const handleAttendanceAction = async (action: "checkin" | "checkout") => {
    const res = action === "checkin" ? await checkInToday() : await checkOutToday();
    if (!res.ok && res.error) {
      window.alert(res.error);
    }
  };

  // Close user dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        userMenuRef.current &&
        !userMenuRef.current.contains(event.target as Node)
      ) {
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

  const myTasksCount = filter.onlyMyTasks
    ? filteredTasks.length
    : baseVisibleTasks.filter(
        (t) =>
          t.assigneeId === currentUserId ||
          t.adCreatorId === currentUserId ||
          t.adEditorId === currentUserId
      ).length;
  const inReviewCount =
    filter.status === "in_review"
      ? filteredTasks.length
      : baseVisibleTasks.filter((t) => t.status === "in_review").length;
  const completedCount = tasks.filter(
    (t) => !t.isArchived && t.status === "completed"
  ).length;
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

      {/* Left Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-[240px] flex-col border-r border-border bg-card transition-all duration-200 ease-in-out",
          mobileMenuOpen
            ? "translate-x-0 shadow-float z-50"
            : "-translate-x-full",
          isSidebarCollapsed ? "lg:-translate-x-full" : "lg:translate-x-0"
        )}
      >
        {/* Top Brand Header */}
        <div className="flex flex-col items-start border-b border-border px-5 py-3.5">
          <Link
            href="/"
            className="flex flex-col items-start gap-1 group transition-transform active:scale-95"
            onClick={() => {
              setActiveSection("overview");
              setMobileMenuOpen(false);
            }}
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
            <span className="block text-xs font-semibold tracking-tight text-muted-foreground group-hover:text-foreground transition-colors">
              Task Manager
            </span>
          </Link>
        </div>

        {/* Sidebar Navigation: Overview (with nested Filters submenu), Workspace Tools, Feedback */}
        <div className="flex-1 overflow-y-auto px-3 py-3.5 space-y-5">
          {/* 1. Overview & Indented Overview Filters Submenu */}
          <div>
            <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Overview
            </div>
            <nav className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  setActiveSection("overview");
                  setFilter({
                    onlyMyTasks: false,
                    status: "all",
                    showArchived: false,
                    showCompletedHistory: false,
                  });
                  setMobileMenuOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition cursor-pointer",
                  activeSection === "overview" &&
                    !filter.onlyMyTasks &&
                    filter.status === "all" &&
                    !filter.showArchived &&
                    !filter.showCompletedHistory
                    ? "bg-accent text-accent-foreground font-semibold"
                    : activeSection === "overview"
                      ? "bg-muted/60 text-foreground font-semibold"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <LayoutDashboard className="size-4 shrink-0 text-primary" />
                  <span>Overview</span>
                </div>
                <span className="text-[10px] font-mono opacity-70">
                  {filteredTasks.length}
                </span>
              </button>

              {/* Indented Overview Submenu (Overview Filters) */}
              <div className="ml-4 pl-2.5 border-l-2 border-border/70 space-y-0.5 pt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setActiveSection("overview");
                    setFilter({
                      onlyMyTasks: !filter.onlyMyTasks,
                      assigneeId: "all",
                    });
                    setMobileMenuOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition cursor-pointer",
                    filter.onlyMyTasks
                      ? "bg-primary text-primary-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <UserCheck className="size-3.5 shrink-0" />
                    <span>My Tasks</span>
                  </div>
                  <span
                    className={cn(
                      "rounded-full px-1.5 py-0.2 text-[10px] font-mono font-medium",
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
                    setActiveSection("overview");
                    setFilter({
                      status: filter.status === "in_review" ? "all" : "in_review",
                      showCompletedHistory: false,
                    });
                    setMobileMenuOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition cursor-pointer",
                    filter.status === "in_review"
                      ? "bg-warning text-warning-foreground font-semibold shadow-xs"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Clock className="size-3.5 shrink-0 text-warning" />
                    <span>Needs Review</span>
                  </div>
                  {inReviewCount > 0 && (
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.2 text-[10px] font-mono font-semibold",
                        filter.status === "in_review"
                          ? "bg-warning-foreground/20 text-warning-foreground"
                          : "bg-warning/15 text-warning"
                      )}
                    >
                      {inReviewCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveSection("overview");
                    setFilter({
                      showCompletedHistory: !filter.showCompletedHistory,
                      status: "all",
                      showArchived: false,
                    });
                    setMobileMenuOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition cursor-pointer",
                    filter.showCompletedHistory
                      ? "bg-emerald-500 text-white font-semibold shadow-xs"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
                    <span>Done History</span>
                  </div>
                  {completedCount > 0 && (
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.2 text-[10px] font-mono font-semibold",
                        filter.showCompletedHistory
                          ? "bg-white/20 text-white"
                          : "bg-emerald-500/15 text-emerald-500"
                      )}
                    >
                      {completedCount}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setActiveSection("overview");
                    setFilter({
                      showArchived: !filter.showArchived,
                      showCompletedHistory: false,
                    });
                    setMobileMenuOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition cursor-pointer",
                    filter.showArchived
                      ? "bg-amber-500 text-white font-semibold shadow-xs"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Archive className="size-3.5 shrink-0 text-amber-500" />
                    <span>Archived</span>
                  </div>
                  {archivedCount > 0 && (
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.2 text-[10px] font-mono font-semibold",
                        filter.showArchived
                          ? "bg-white/20 text-white"
                          : "bg-amber-500/15 text-amber-500"
                      )}
                    >
                      {archivedCount}
                    </span>
                  )}
                </button>
              </div>
            </nav>
          </div>

          {/* 2. Workspace Tools */}
          <div>
            <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Workspace Tools
            </div>
            <nav className="space-y-0.5">
              <button
                type="button"
                onClick={() => {
                  setActiveSection("notepad");
                  setMobileMenuOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition cursor-pointer",
                  activeSection === "notepad"
                    ? "bg-accent text-accent-foreground font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <StickyNote className="size-4 shrink-0 text-primary" />
                  <span>Personal Notepad</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveSection("reminders");
                  setMobileMenuOpen(false);
                }}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition cursor-pointer",
                  activeSection === "reminders"
                    ? "bg-accent text-accent-foreground font-semibold"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <AlarmClock className="size-4 shrink-0 text-amber-500" />
                  <span>Reminders</span>
                </div>
                {dueRemindersCount > 0 ? (
                  <span className="rounded-full bg-amber-500 px-1.5 py-0.2 text-[10px] font-mono font-bold text-white">
                    {dueRemindersCount} due
                  </span>
                ) : pendingRemindersCount > 0 ? (
                  <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] font-mono text-muted-foreground">
                    {pendingRemindersCount}
                  </span>
                ) : null}
              </button>

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setActiveSection("attendance");
                    setMobileMenuOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition cursor-pointer",
                    activeSection === "attendance"
                      ? "bg-accent text-accent-foreground font-semibold"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <div className="flex items-center gap-2.5">
                    <CalendarCheck className="size-4 shrink-0 text-emerald-500" />
                    <span>Attendance</span>
                  </div>
                </button>
              )}

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setIsRoleTemplateModalOpen(true);
                    setMobileMenuOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition cursor-pointer text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <div className="flex items-center gap-2.5">
                    <LayoutTemplate className="size-4 shrink-0 text-primary" />
                    <span>Role Templates</span>
                  </div>
                </button>
              )}

              {isManagerOrAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setIsAutoDelegatorOpen(true);
                    setMobileMenuOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition cursor-pointer text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <div className="flex items-center gap-2.5">
                    <Zap className="size-4 shrink-0 text-amber-500" />
                    <span>Auto Delegator</span>
                  </div>
                </button>
              )}

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setIsSettingsModalOpen(true);
                    setMobileMenuOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition cursor-pointer text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <div className="flex items-center gap-2.5">
                    <Settings className="size-4 shrink-0 text-primary" />
                    <span>Settings</span>
                  </div>
                </button>
              )}
            </nav>

            {/* Feedback to Developer / Request Feature — directly beneath Workspace Tools */}
            <div className="mt-2 pt-2 border-t border-border/60">
              <button
                type="button"
                onClick={() => {
                  setFeedbackInitialTab("submit");
                  setIsFeedbackOpen(true);
                  setMobileMenuOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-1.5 text-xs font-medium transition cursor-pointer text-muted-foreground hover:bg-primary/10 hover:text-primary group"
              >
                <div className="flex items-center gap-2.5">
                  <MessageSquarePlus className="size-4 shrink-0 text-primary" />
                  <span>Feedback / Request Feature</span>
                </div>
                <Sparkles className="size-3 text-primary/70 opacity-70 group-hover:opacity-100" />
              </button>
            </div>
          </div>
        </div>

        {/* Bottom User Profile Menu (No Account Switcher — must log out to switch users) */}
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
                    style={{
                      backgroundColor: `${userColor}15`,
                      color: userColor,
                    }}
                  >
                    {currentEmpCode}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground truncate capitalize">
                  {currentUser.role.replace("_", " ")}
                </div>
              </div>
            </div>
            <ChevronDown className="size-3.5 text-muted-foreground group-hover:text-foreground shrink-0" />
          </button>

          {userDropdownOpen && (
            <div className="absolute left-2 bottom-14 z-50 w-56 rounded-xl border border-border bg-card p-2 shadow-float animate-in fade-in slide-in-from-bottom-2 duration-150">
              {/* Active Account Header */}
              <div className="px-2.5 py-1.5 border-b border-border/70 mb-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-foreground truncate">
                    {currentUser.name}
                  </span>
                  <span className="rounded bg-primary/10 px-1.5 py-0.2 text-[9px] font-semibold uppercase text-primary">
                    {currentUser.role.replace("_", " ")}
                  </span>
                </div>
                <div className="text-[10px] text-muted-foreground truncate">
                  {currentUser.email}
                </div>
              </div>

              {/* Quick Actions */}
              <div className="space-y-0.5 text-xs">
                {isAdmin && (
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
                    <span>Shortcuts</span>
                  </div>
                  <kbd className="text-[10px] font-mono text-muted-foreground bg-muted px-1 py-0.2 rounded border border-border">
                    ?
                  </kbd>
                </button>

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

              {/* Feature Request / Feedback */}
              <div className="border-t border-border/50 mt-1 pt-1 flex items-center justify-between px-1">
                <button
                  type="button"
                  onClick={() => {
                    setFeedbackInitialTab("submit");
                    setIsFeedbackOpen(true);
                    setUserDropdownOpen(false);
                  }}
                  className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[10px] text-muted-foreground/80 hover:text-foreground hover:bg-muted/50 transition cursor-pointer"
                >
                  <Sparkles className="size-3 text-primary/70" />
                  <span>Feedback</span>
                </button>

                {isAdminOrDeveloper && (
                  <button
                    type="button"
                    onClick={() => {
                      setFeedbackInitialTab("manage");
                      setIsFeedbackOpen(true);
                      setUserDropdownOpen(false);
                    }}
                    className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary hover:bg-primary/20 transition cursor-pointer"
                    title="View submitted feature requests"
                  >
                    Dev Inbox
                  </button>
                )}
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
        {/* Sticky Top Header */}
        <header className="sticky top-0 z-30 flex h-12 w-full items-center justify-between border-b border-border/80 bg-card/95 px-4 lg:px-6 text-card-foreground backdrop-blur">
          <div className="flex items-center gap-2.5">
            {/* Mobile Menu Button */}
            <button
              type="button"
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden cursor-pointer"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle mobile menu"
            >
              {mobileMenuOpen ? (
                <X className="size-5" />
              ) : (
                <Menu className="size-5" />
              )}
            </button>

            {/* Sidebar Collapse Toggle */}
            <button
              type="button"
              className="hidden lg:flex rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
              onClick={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              <PanelLeft className="size-4" />
            </button>

            {/* Workspace Breadcrumb */}
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-foreground">Satmi</span>
              <span className="text-muted-foreground">/</span>
              <span className="text-muted-foreground capitalize">
                {activeSection === "overview" ? viewMode : activeSection}
              </span>
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Search (Cmd+K) */}
            <button
              type="button"
              onClick={() => setIsCommandPaletteOpen(true)}
              className="hidden md:flex items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
              title="Search & Commands (Cmd + K)"
            >
              <Search className="size-3.5" />
              <span className="text-[11px]">Search</span>
              <kbd className="text-[9px] font-mono bg-card px-1 py-0.2 rounded border border-border">
                ⌘K
              </kbd>
            </button>

            {/* Sound Mute Toggle */}
            <button
              type="button"
              onClick={handleToggleSound}
              className={cn(
                "rounded-lg p-1.5 transition cursor-pointer border border-transparent",
                localMuted
                  ? "text-muted-foreground hover:bg-muted"
                  : "text-primary hover:bg-primary/10"
              )}
              title={
                localMuted
                  ? "Notification chime muted (Click to unmute)"
                  : "Notification chime active (Click to mute)"
              }
            >
              {localMuted ? (
                <VolumeX className="size-4" />
              ) : (
                <Volume2 className="size-4" />
              )}
            </button>

            <NotificationCenter />
            <ThemeToggle />

            {/* Daily Check-In / Check-Out Button */}
            {!myTodayAttendance?.checkInTime ? (
              <Button
                type="button"
                size="sm"
                disabled={isAttendanceLoading}
                onClick={() => handleAttendanceAction("checkin")}
                className="gap-1.5 text-xs h-8 bg-emerald-600 hover:bg-emerald-500 text-white border-0 shadow-xs cursor-pointer"
                title="Check in for today"
              >
                <LogIn className="size-3.5" />
                <span>{isAttendanceLoading ? "Checking in..." : "Check In"}</span>
              </Button>
            ) : !myTodayAttendance?.checkOutTime ? (
              <Button
                type="button"
                size="sm"
                disabled={isAttendanceLoading}
                onClick={() => handleAttendanceAction("checkout")}
                className="gap-1.5 text-xs h-8 bg-rose-600 hover:bg-rose-500 text-white border-0 shadow-xs cursor-pointer"
                title={`Checked in at ${formatShortISTTime(myTodayAttendance.checkInTime)} IST — Click to Check Out`}
              >
                <span className="size-2 rounded-full bg-white animate-pulse shrink-0" />
                <LogOut className="size-3.5" />
                <span>{isAttendanceLoading ? "Checking out..." : "Check Out"}</span>
                <span className="hidden sm:inline text-[10px] opacity-90 font-mono pl-0.5">
                  In {formatShortISTTime(myTodayAttendance.checkInTime)}
                </span>
              </Button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  if (isAdmin) setActiveSection("attendance");
                }}
                className={cn(
                  "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-xs font-semibold transition",
                  isAdmin ? "cursor-pointer hover:bg-emerald-500/15" : "cursor-default"
                )}
                title={`Checked in: ${formatShortISTTime(myTodayAttendance.checkInTime)} | Checked out: ${formatShortISTTime(myTodayAttendance.checkOutTime)} (IST)`}
              >
                <CheckCircle2 className="size-3.5 shrink-0" />
                <span>Checked Out</span>
                <span className="hidden md:inline text-[10px] font-mono opacity-80">
                  {formatShortISTTime(myTodayAttendance.checkInTime)} – {formatShortISTTime(myTodayAttendance.checkOutTime)}
                </span>
              </button>
            )}

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

      {/* Global Overlays & Modals */}
      <CommandPalette />
      <BulkActionsToolbar />
      <ShortcutsModal />
      <SettingsModal />
      {isAdmin && (
        <RoleTemplateModal
          isOpen={isRoleTemplateModalOpen}
          onClose={() => setIsRoleTemplateModalOpen(false)}
        />
      )}
      {/* Background due-reminder alert listener when not on the Reminders view */}
      {activeSection !== "reminders" && (
        <RemindersPanel
          isOpen={false}
          asView={false}
          onCountChange={(due, pending) => {
            setDueRemindersCount(due);
            setPendingRemindersCount(pending);
          }}
        />
      )}
      <FeatureRequestModal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
        initialTab={feedbackInitialTab}
      />
    </div>
  );
}
