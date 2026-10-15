"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Settings,
  Database,
  Radio,
  Wifi,
  WifiOff,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Unplug,
  Lock,
  ShieldCheck,
  Clock,
  User as UserIcon,
  Sliders,
  Sparkles,
  Activity,
  Layers,
  Kanban,
  Table2,
  ListTodo,
  BarChart3,
  Calendar,
  Minimize2,
  Maximize2,
  Check,
  Plus,
  Trash2,
  Palette,
  UserPlus,
  Shield,
  UserX,
  LogOut,
} from "lucide-react";
import { useTasks } from "@/lib/store";
import { AdsSyncMode, ViewMode, DensityMode, Role, type User } from "@/lib/types";
import { targetTimeZone } from "@/lib/supabase";
import { cn, getUserColor, getEmployeeCode, CURATED_COLOR_OPTIONS } from "@/lib/utils";
import { Button } from "./ui/button";

export function SettingsModal() {
  const {
    isSettingsModalOpen,
    setIsSettingsModalOpen,
    isAdsManagementConnected,
    setIsAdsManagementConnected,
    toggleAdsManagementConnection,
    adsSyncMode,
    setAdsSyncMode,
    enforceCanonicalLock,
    setEnforceCanonicalLock,
    autoMaterializeRulesOnSync,
    setAutoMaterializeRulesOnSync,
    testAdsConnection,
    pendingOfflineChangesCount,
    refreshAll,
    isSyncing,
    lastSyncedAt,
    viewMode,
    setViewMode,
    density,
    setDensity,
    currentUser,
    users,
    switchUser,
    logout,
    updateUserCapacity,
    setIsShortcutsModalOpen,
    isAdmin,
    createUser,
    updateUserColor,
    updateUser,
    deleteUser,
  } = useTasks();

  const [activeTab, setActiveTab] = useState<"ads" | "general" | "team">("ads");
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    latencyMs: number;
    message: string;
    testedAt: Date;
  } | null>(null);

  // Team Management state (Admin)
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberPassword, setNewMemberPassword] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<Role>("editor");
  const [newMemberCode, setNewMemberCode] = useState("");
  const [newMemberColor, setNewMemberColor] = useState("#10b981");
  const [newMemberCapacity, setNewMemberCapacity] = useState(6);
  const [colorPickerUserId, setColorPickerUserId] = useState<string | null>(null);
  const [isSavingMember, setIsSavingMember] = useState(false);
  const [memberActionError, setMemberActionError] = useState<string | null>(null);

  const handleCreateMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) {
      setMemberActionError("Member name is required");
      return;
    }
    const cleanEmail =
      newMemberEmail.trim() ||
      `${newMemberName.trim().toLowerCase().replace(/\s+/g, ".")}@satmi.in`;
    const cleanCode =
      newMemberCode.trim().toUpperCase() || getEmployeeCode(newMemberName);

    setIsSavingMember(true);
    setMemberActionError(null);
    try {
      const created = await createUser({
        name: newMemberName.trim(),
        email: cleanEmail,
        password: newMemberPassword.trim() || undefined,
        role: newMemberRole,
        employeeCode: cleanCode,
        color: newMemberColor,
        dailyCapacityUnits: newMemberCapacity,
      });
      if (created) {
        setIsAddingMember(false);
        setNewMemberName("");
        setNewMemberEmail("");
        setNewMemberPassword("");
        setNewMemberCode("");
        setNewMemberRole("editor");
        setNewMemberColor("#10b981");
        setNewMemberCapacity(6);
      } else {
        setMemberActionError("Failed to provision profile in Adflow");
      }
    } catch (err: any) {
      setMemberActionError(err?.message || "Failed to provision member");
    } finally {
      setIsSavingMember(false);
    }
  };

  const handleDeleteMember = async (u: User) => {
    const ok = window.confirm(
      `Deactivate member ${u.name} (${u.role.replace("_", " ")})?\n\nThis will soft-delete their profile in Adflow and hide them from active workflows.`
    );
    if (!ok) return;
    await deleteUser(u.id);
  };

  // Live clock in target timezone (Asia/Kolkata)
  const [currentTimeStr, setCurrentTimeStr] = useState("");
  useEffect(() => {
    const updateTime = () => {
      try {
        const str = new Intl.DateTimeFormat("en-IN", {
          timeZone: targetTimeZone,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
        }).format(new Date());
        setCurrentTimeStr(str);
      } catch {
        setCurrentTimeStr(new Date().toLocaleTimeString());
      }
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  if (!isSettingsModalOpen) return null;

  const handleRunTest = async () => {
    setIsTesting(true);
    try {
      const res = await testAdsConnection();
      setTestResult({
        ...res,
        testedAt: new Date(),
      });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-foreground/30 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-3xl rounded-2xl border border-border bg-card shadow-float flex flex-col max-h-[90vh] overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="size-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-xs">
              <Settings className="size-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                <span>Dashboard Settings</span>
                {isAdsManagementConnected ? (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 rounded-full">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>Ads Connected</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 rounded-full">
                    <Unplug className="size-3" />
                    <span>Ads Disconnected</span>
                  </span>
                )}
              </h2>
              <p className="text-xs text-muted-foreground">
                Manage external Ads Management pipeline sync, layout options, and team rules
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsSettingsModalOpen(false)}
            className="size-8 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition cursor-pointer"
            aria-label="Close settings"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-1 px-6 pt-3 border-b border-border bg-muted/10 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab("ads")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition cursor-pointer",
              activeTab === "ads"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Radio className="size-4" />
            <span>Ads Management Sync</span>
            <span
              className={cn(
                "size-2 rounded-full",
                isAdsManagementConnected ? "bg-emerald-500" : "bg-amber-500"
              )}
            />
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("general")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition cursor-pointer",
              activeTab === "general"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Sliders className="size-4" />
            <span>General & Display</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("team")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition cursor-pointer",
              activeTab === "team"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <UserIcon className="size-4" />
            <span>Team & Profile</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: ADS MANAGEMENT INTEGRATION */}
          {activeTab === "ads" && (
            <div className="space-y-5">
              {/* Master Connection Switch Banner */}
              <div
                className={cn(
                  "p-4 sm:p-5 rounded-xl border transition-all duration-200",
                  isAdsManagementConnected
                    ? "bg-emerald-500/5 border-emerald-500/30 dark:bg-emerald-500/10"
                    : "bg-amber-500/5 border-amber-500/30 dark:bg-amber-500/10"
                )}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3.5">
                    <div
                      className={cn(
                        "size-11 rounded-xl flex items-center justify-center shrink-0 border shadow-xs transition-colors",
                        isAdsManagementConnected
                          ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                          : "bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400"
                      )}
                    >
                      {isAdsManagementConnected ? (
                        <Radio className="size-6 animate-pulse" />
                      ) : (
                        <Unplug className="size-6" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-foreground">
                          Ads Management Connection
                        </h3>
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider",
                            isAdsManagementConnected
                              ? "bg-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                              : "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                          )}
                        >
                          {isAdsManagementConnected ? "Connected" : "Disconnected"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 max-w-lg leading-relaxed">
                        {isAdsManagementConnected
                          ? "Live two-way synchronization is active with the central Ads Management database (table: daily_team_targets). Daily targets, creator/editor units, and deliverables sync seamlessly."
                          : "Dashboard is disconnected from Ads Management. Real-time background sync is paused, preventing external pipeline updates from altering your local workspace."}
                      </p>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                    <button
                      type="button"
                      role="switch"
                      aria-checked={isAdsManagementConnected}
                      onClick={toggleAdsManagementConnection}
                      className={cn(
                        "relative inline-flex h-7 w-13 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden focus:ring-2 focus:ring-primary focus:ring-offset-2",
                        isAdsManagementConnected ? "bg-emerald-600" : "bg-muted-foreground/30"
                      )}
                    >
                      <span className="sr-only">Toggle Ads Management connection</span>
                      <span
                        className={cn(
                          "pointer-events-none inline-block size-6 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out",
                          isAdsManagementConnected ? "translate-x-6" : "translate-x-0"
                        )}
                      />
                    </button>
                    <span className="text-xs font-semibold min-w-16">
                      {isAdsManagementConnected ? "Enabled" : "Disabled"}
                    </span>
                  </div>
                </div>

                {/* Local modifications warning when disconnected */}
                {!isAdsManagementConnected && pendingOfflineChangesCount > 0 && (
                  <div className="mt-4 pt-3 border-t border-amber-500/20 flex items-center justify-between text-xs text-amber-700 dark:text-amber-300">
                    <span className="flex items-center gap-1.5">
                      <AlertTriangle className="size-3.5 shrink-0" />
                      <span>
                        <strong>{pendingOfflineChangesCount} local change(s)</strong> created while
                        disconnected.
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsAdsManagementConnected(true)}
                      className="font-semibold underline hover:text-amber-800 dark:hover:text-amber-200 cursor-pointer"
                    >
                      Reconnect to sync
                    </button>
                  </div>
                )}
              </div>

              {/* Connection Diagnostics Card */}
              <div className="rounded-xl border border-border bg-card p-4 space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="size-4 text-primary" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Pipeline Integration Details
                    </h4>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRunTest}
                      disabled={isTesting}
                      className="h-7 text-xs gap-1.5 border border-border"
                    >
                      <Activity className={cn("size-3", isTesting && "animate-spin")} />
                      <span>{isTesting ? "Testing Ping..." : "Test Connection"}</span>
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => refreshAll()}
                      disabled={!isAdsManagementConnected || isSyncing}
                      className="h-7 text-xs gap-1.5 border border-border"
                      title={
                        isAdsManagementConnected
                          ? "Force refresh all targets"
                          : "Connect Ads Management first"
                      }
                    >
                      <RotateCw className={cn("size-3", isSyncing && "animate-spin")} />
                      <span>{isSyncing ? "Syncing..." : "Sync Now"}</span>
                    </Button>
                  </div>
                </div>

                {/* Metrics Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-muted/40 border border-border/70 space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                      Target Database
                    </span>
                    <span className="font-mono font-medium text-foreground truncate block">
                      daily_team_targets
                    </span>
                    <span className="text-[10px] text-muted-foreground block truncate">
                      qexjnswuvbyjenfrbwvj.supabase.co
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-muted/40 border border-border/70 space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                      Sync Engine Status
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span
                        className={cn(
                          "size-2 rounded-full",
                          isAdsManagementConnected ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"
                        )}
                      />
                      <span className="font-semibold text-foreground">
                        {isAdsManagementConnected ? "Live Websocket" : "Paused / Offline"}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground block">
                      {isAdsManagementConnected ? "Realtime + 60s Heartbeat" : "Channel closed"}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-muted/40 border border-border/70 space-y-1">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block">
                      Last Synchronized
                    </span>
                    <span className="font-medium text-foreground block">
                      {lastSyncedAt
                        ? lastSyncedAt.toLocaleTimeString("en-IN", {
                            timeZone: targetTimeZone,
                            hour: "2-digit",
                            minute: "2-digit",
                            second: "2-digit",
                          })
                        : "Never"}
                    </span>
                    <span className="text-[10px] text-muted-foreground block">
                      IST (Asia/Kolkata)
                    </span>
                  </div>
                </div>

                {/* Test Result Display if run */}
                {testResult && (
                  <div
                    className={cn(
                      "p-3 rounded-lg border text-xs flex items-center justify-between gap-2 animate-in fade-in duration-100",
                      testResult.ok
                        ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-700 dark:text-emerald-300"
                        : "bg-destructive/10 border-destructive/25 text-destructive"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {testResult.ok ? (
                        <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                      ) : (
                        <AlertTriangle className="size-4 shrink-0 text-destructive" />
                      )}
                      <span className="truncate">{testResult.message}</span>
                    </div>
                    <span className="font-mono text-[11px] font-bold shrink-0 bg-card/60 px-2 py-0.5 rounded border border-border">
                      {testResult.latencyMs} ms
                    </span>
                  </div>
                )}
              </div>

              {/* Sync Behavior & Pipeline Settings */}
              <div className="rounded-xl border border-border bg-card p-4 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Sync & Pipeline Preferences
                </h4>

                <div className="space-y-3.5 divide-y divide-border/60">
                  {/* Sync Mode Selector */}
                  <div className="pt-2 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold text-foreground">
                        Background Sync Strategy
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Select how actively the dashboard monitors Ads Management database updates
                      </div>
                    </div>

                    <div className="flex items-center gap-1 bg-muted/50 p-1 rounded-lg border border-border">
                      {(
                        [
                          { id: "realtime", label: "Realtime (Websocket)" },
                          { id: "interval", label: "60s Polling" },
                          { id: "manual", label: "Manual Only" },
                        ] as const
                      ).map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setAdsSyncMode(m.id)}
                          className={cn(
                            "px-2.5 py-1 rounded-md text-[11px] font-medium transition cursor-pointer",
                            adsSyncMode === m.id
                              ? "bg-card text-foreground font-semibold shadow-xs"
                              : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {m.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Canonical Adflow Protection Lock */}
                  <div className="pt-3 flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Lock className="size-3 text-primary" />
                        <span>Lock Standard Adflow Pipeline Task Titles</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground max-w-md">
                        Protects canonical tasks (e.g. Ad video edits, Video shoots, Script writing)
                        from being renamed, preventing pipeline desync with live Ads Management.
                      </div>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={enforceCanonicalLock}
                      onClick={() => setEnforceCanonicalLock(!enforceCanonicalLock)}
                      className={cn(
                        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out",
                        enforceCanonicalLock ? "bg-primary" : "bg-muted-foreground/30"
                      )}
                    >
                      <span
                        className={cn(
                          "pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out",
                          enforceCanonicalLock ? "translate-x-5" : "translate-x-0"
                        )}
                      />
                    </button>
                  </div>

                  {/* Auto-Materialize Delegator Rules */}
                  <div className="pt-3 flex items-center justify-between gap-4">
                    <div className="space-y-0.5">
                      <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Sparkles className="size-3 text-primary" />
                        <span>Auto-Materialize Delegator Rules on Daily Sync</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground max-w-md">
                        Automatically instantiate recurring creator/editor daily targets defined in
                        Auto Delegator when launching the dashboard each day.
                      </div>
                    </div>

                    <button
                      type="button"
                      role="switch"
                      aria-checked={autoMaterializeRulesOnSync}
                      onClick={() => setAutoMaterializeRulesOnSync(!autoMaterializeRulesOnSync)}
                      className={cn(
                        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out",
                        autoMaterializeRulesOnSync ? "bg-primary" : "bg-muted-foreground/30"
                      )}
                    >
                      <span
                        className={cn(
                          "pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out",
                          autoMaterializeRulesOnSync ? "translate-x-5" : "translate-x-0"
                        )}
                      />
                    </button>
                  </div>
                </div>
              </div>

              {/* Direct Pipeline Flow Impact Explainer */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Activity className="size-4 text-primary" />
                  <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Live Ads Management (AdFlow) Pipeline Impact
                  </h4>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider bg-primary/20 text-primary">
                    Shared Supabase Database
                  </span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <strong>Does changing task status here affect the live Ads Management app?</strong>{" "}
                  <span className="text-foreground font-semibold">Yes, immediately.</span> Because both dashboards operate on the same live database (<code className="font-mono text-[11px] bg-background/80 px-1 py-0.5 rounded border border-border">ads</code> &amp; <code className="font-mono text-[11px] bg-background/80 px-1 py-0.5 rounded border border-border">daily_team_targets</code>):
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-background border border-border space-y-1">
                    <span className="font-bold text-foreground flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-blue-500" />
                      In Progress (Editing)
                    </span>
                    <p className="text-[11px] text-muted-foreground">
                      Sets <code className="font-mono text-[10px]">editing_started_at</code> and transitions creative to <code className="font-mono text-[10px]">editing</code> stage in AdFlow.
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-background border border-border space-y-1">
                    <span className="font-bold text-foreground flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-amber-500" />
                      In Review (Creator Review)
                    </span>
                    <p className="text-[11px] text-muted-foreground">
                      Submits creative for review in AdFlow and sets <code className="font-mono text-[10px]">status = pending_review</code>.
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-background border border-border space-y-1">
                    <span className="font-bold text-foreground flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-emerald-500" />
                      Completed (Approved)
                    </span>
                    <p className="text-[11px] text-muted-foreground">
                      Marks creative as <code className="font-mono text-[10px]">approved</code> in AdFlow and increments completed target quotas and incentive metrics.
                    </p>
                  </div>
                  <div className="p-2.5 rounded-lg bg-background border border-border space-y-1">
                    <span className="font-bold text-foreground flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-slate-500" />
                      To Do (Ready for Edit)
                    </span>
                    <p className="text-[11px] text-muted-foreground">
                      Resets <code className="font-mono text-[10px]">editing_started_at</code> and returns creative to the unassigned editing queue in AdFlow.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: GENERAL & DISPLAY */}
          {activeTab === "general" && (
            <div className="space-y-5">
              {/* Default View Mode */}
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Default Board View
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {[
                    { id: "board", label: "Kanban Board", icon: Kanban },
                    { id: "table", label: "Task Table", icon: Table2 },
                    { id: "list", label: "Checklist Units", icon: ListTodo },
                    { id: "analytics", label: "Stats & Overview", icon: BarChart3 },
                    { id: "calendar", label: "Calendar", icon: Calendar },
                    { id: "timeline", label: "Timeline (Gantt)", icon: Layers },
                  ].map((v) => {
                    const Icon = v.icon;
                    const isSelected = viewMode === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => setViewMode(v.id as ViewMode)}
                        className={cn(
                          "flex items-center gap-2.5 p-3 rounded-lg border text-left text-xs transition cursor-pointer",
                          isSelected
                            ? "border-primary bg-primary/10 text-primary font-semibold shadow-xs"
                            : "border-border bg-muted/20 text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <Icon className="size-4 shrink-0" />
                        <span>{v.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Layout Density */}
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Board Density & Padding
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setDensity("comfortable")}
                    className={cn(
                      "flex items-center gap-3 p-3.5 rounded-lg border text-left text-xs transition cursor-pointer",
                      density === "comfortable"
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-border bg-muted/20 text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Maximize2 className="size-4" />
                    <div>
                      <div className="font-semibold">Comfortable Mode</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        Spacious cards, rich meta tags, and full unit details
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDensity("compact")}
                    className={cn(
                      "flex items-center gap-3 p-3.5 rounded-lg border text-left text-xs transition cursor-pointer",
                      density === "compact"
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-border bg-muted/20 text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Minimize2 className="size-4" />
                    <div>
                      <div className="font-semibold">Compact Mode</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        High-density data grid for fast multi-task scanning
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Timezone & Cutoff Clock */}
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Operations Timezone & Cutoff SLA
                </h4>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-lg bg-muted/30 border border-border">
                  <div className="space-y-0.5">
                    <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                      <Clock className="size-3.5 text-primary" />
                      <span>Operating Timezone: Asia/Kolkata (IST - UTC+5:30)</span>
                    </span>
                    <span className="text-[11px] text-muted-foreground block">
                      Daily target cut-off is configured at 8:00 PM IST daily. Tasks not completed by
                      cutoff are eligible for rollover.
                    </span>
                  </div>

                  <div className="text-right shrink-0">
                    <div className="font-mono text-sm font-bold text-foreground">
                      {currentTimeStr}
                    </div>
                    <span className="text-[10px] text-muted-foreground">Live Indian Standard Time</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: TEAM & PROFILE */}
          {activeTab === "team" && (
            <div className="space-y-6">
              {/* Current Active User Profile */}
              {(() => {
                const currentEmpCode = currentUser.employeeCode || getEmployeeCode(currentUser.name);
                const currentColor = getUserColor(currentEmpCode, currentUser.color);

                return (
                  <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="size-12 rounded-xl border flex items-center justify-center font-bold text-base shadow-xs ring-1"
                          style={{
                            backgroundColor: `${currentColor}20`,
                            color: currentColor,
                            borderColor: `${currentColor}40`,
                          }}
                        >
                          {currentUser.avatar}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-foreground">{currentUser.name}</h3>
                            <span
                              className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded"
                              style={{
                                backgroundColor: `${currentColor}15`,
                                color: currentColor,
                              }}
                            >
                              {currentEmpCode}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground">{currentUser.email}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wide bg-primary/15 text-primary border border-primary/20">
                          {currentUser.role.replace("_", " ")}
                        </span>
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setIsSettingsModalOpen(false);
                            logout();
                          }}
                          className="text-xs h-7 text-destructive border-destructive/30 hover:bg-destructive/10 gap-1.5 cursor-pointer ml-1"
                        >
                          <LogOut className="size-3" />
                          <span>Sign Out</span>
                        </Button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-3 border-t border-border text-xs">
                      <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60">
                        <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                          Department
                        </span>
                        <span className="font-semibold text-foreground">{currentUser.department}</span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60">
                        <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                          Daily Capacity Limit
                        </span>
                        <span className="font-semibold text-foreground">
                          {currentUser.dailyCapacityUnits || 6} Units / day
                        </span>
                      </div>

                      <div className="p-2.5 rounded-lg bg-muted/40 border border-border/60">
                        <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                          Assigned Color
                        </span>
                        <span className="font-semibold flex items-center gap-1.5">
                          <span
                            className="size-3 rounded-full border border-black/10 shrink-0"
                            style={{ backgroundColor: currentColor }}
                          />
                          <span className="font-mono text-[11px]">{currentColor}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ADMIN TEAM MANAGEMENT (Adflow Aligned) */}
              {isAdmin ? (
                <div className="rounded-xl border border-border bg-card p-5 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-border">
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                        <Shield className="size-3.5 text-primary" />
                        <span>Team Management (Adflow Synchronized)</span>
                      </h4>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        Color-code team members, customize employee codes, and provision accounts matching AdFlow profiles.
                      </p>
                    </div>

                    <Button
                      type="button"
                      variant={isAddingMember ? "secondary" : "primary"}
                      size="sm"
                      onClick={() => setIsAddingMember(!isAddingMember)}
                      className="text-xs h-7.5 gap-1.5"
                    >
                      {isAddingMember ? <X className="size-3.5" /> : <UserPlus className="size-3.5" />}
                      <span>{isAddingMember ? "Cancel" : "Add Member"}</span>
                    </Button>
                  </div>

                  {/* Add Member Form */}
                  {isAddingMember && (
                    <form
                      onSubmit={handleCreateMember}
                      className="p-4 rounded-xl border border-primary/25 bg-primary/5 space-y-3.5 animate-in fade-in duration-150"
                    >
                      <div className="text-xs font-bold text-foreground flex items-center gap-1.5">
                        <UserPlus className="size-3.5 text-primary" />
                        <span>New Team Member (AdFlow Profile Schema)</span>
                      </div>

                      {memberActionError && (
                        <div className="text-xs text-destructive bg-destructive/10 p-2 rounded-lg border border-destructive/20">
                          {memberActionError}
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div>
                          <label className="block text-[11px] font-semibold text-foreground mb-1">
                            Full Name *
                          </label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Himik Roy"
                            value={newMemberName}
                            onChange={(e) => {
                              const val = e.target.value;
                              setNewMemberName(val);
                              if (!newMemberCode || newMemberCode === getEmployeeCode(newMemberName)) {
                                setNewMemberCode(getEmployeeCode(val));
                              }
                            }}
                            className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-foreground mb-1">
                            Email Address *
                          </label>
                          <input
                            type="email"
                            required
                            placeholder="e.g. himik@satmi.in"
                            value={newMemberEmail}
                            onChange={(e) => setNewMemberEmail(e.target.value)}
                            className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-foreground mb-1">
                            Role / Permission *
                          </label>
                          <select
                            value={newMemberRole}
                            onChange={(e) => setNewMemberRole(e.target.value as Role)}
                            className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                          >
                            <option value="editor">Editor</option>
                            <option value="content_creator">Content Creator</option>
                            <option value="manager">Manager</option>
                            <option value="admin">Admin</option>
                            <option value="media_buyer">Media Buyer</option>
                            <option value="member">Member</option>
                          </select>
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-foreground mb-1">
                            Login Password *
                          </label>
                          <input
                            type="password"
                            required
                            placeholder="Set initial password for login"
                            value={newMemberPassword}
                            onChange={(e) => setNewMemberPassword(e.target.value)}
                            className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-foreground mb-1">
                            Daily Target Quota (units/day)
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={24}
                            value={newMemberCapacity}
                            onChange={(e) =>
                              setNewMemberCapacity(
                                Math.max(1, Math.min(24, Number(e.target.value) || 1))
                              )
                            }
                            className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-foreground mb-1">
                            Employee Code (for task IDs)
                          </label>
                          <input
                            type="text"
                            maxLength={5}
                            placeholder="e.g. HIM"
                            value={newMemberCode}
                            onChange={(e) => setNewMemberCode(e.target.value.toUpperCase())}
                            className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-mono uppercase text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                      </div>

                      {/* Color Palette Picker */}
                      <div>
                        <label className="block text-[11px] font-semibold text-foreground mb-1.5">
                          Pick Member Color Tag
                        </label>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {CURATED_COLOR_OPTIONS.map((c) => {
                            const isChosen = newMemberColor === c.hex;
                            return (
                              <button
                                key={c.hex}
                                type="button"
                                onClick={() => setNewMemberColor(c.hex)}
                                className={cn(
                                  "size-6 rounded-full border flex items-center justify-center transition cursor-pointer hover:scale-110",
                                  isChosen ? "ring-2 ring-primary ring-offset-2 scale-110 border-white" : "border-transparent"
                                )}
                                style={{ backgroundColor: c.hex }}
                                title={`${c.name} (${c.hex})`}
                              >
                                {isChosen && <Check className="size-3 text-white drop-shadow" />}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setIsAddingMember(false)}
                          className="text-xs h-7.5"
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          variant="primary"
                          size="sm"
                          disabled={isSavingMember}
                          className="text-xs h-7.5 px-3"
                        >
                          {isSavingMember ? "Provisioning..." : "Save Member"}
                        </Button>
                      </div>
                    </form>
                  )}

                  {/* Members Table */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground px-1">
                      <span>{users.filter((u) => u.active !== false && !u.deletedAt).length} Active Team Members</span>
                      <span>Click color swatch to customize user color</span>
                    </div>

                    <div className="divide-y divide-border border border-border rounded-xl overflow-hidden bg-card">
                      {users
                        .filter((u) => u.active !== false && !u.deletedAt)
                        .map((u) => {
                          const empCode = u.employeeCode || getEmployeeCode(u.name);
                          const userColor = getUserColor(empCode, u.color);
                          const isPickerOpen = colorPickerUserId === u.id;
                          const isCurrent = u.id === currentUser.id;

                          return (
                            <div
                              key={u.id}
                              className="p-3 flex flex-col gap-2 hover:bg-muted/30 transition text-xs"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div
                                    className="size-7 rounded-full font-bold text-[10px] flex items-center justify-center ring-2 shrink-0"
                                    style={{
                                      backgroundColor: `${userColor}20`,
                                      color: userColor,
                                      borderColor: `${userColor}50`,
                                    }}
                                  >
                                    {u.avatar}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="font-semibold text-foreground truncate">
                                        {u.name}
                                      </span>
                                      <span
                                        className="font-mono text-[9px] font-bold px-1.5 py-0.2 rounded shrink-0"
                                        style={{
                                          backgroundColor: `${userColor}15`,
                                          color: userColor,
                                        }}
                                      >
                                        {empCode}
                                      </span>
                                      <span className="text-[9px] font-mono uppercase bg-muted px-1.5 py-0.2 rounded text-muted-foreground shrink-0">
                                        {u.role.replace("_", " ")}
                                      </span>
                                    </div>
                                    <div className="text-[11px] text-muted-foreground truncate">
                                      {u.email}
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2 shrink-0">
                                  {/* Color Swatch Trigger */}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setColorPickerUserId(isPickerOpen ? null : u.id)
                                    }
                                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-border bg-card hover:bg-muted transition cursor-pointer"
                                    title="Change user color code"
                                  >
                                    <span
                                      className="size-3.5 rounded-full border border-black/10 shrink-0"
                                      style={{ backgroundColor: userColor }}
                                    />
                                    <span className="font-mono text-[10px] text-muted-foreground">
                                      {userColor}
                                    </span>
                                  </button>

                                  {/* Daily Capacity Limit Stepper */}
                                  <div
                                    className="flex items-center gap-1 border border-border rounded-lg bg-card px-2 py-1 shadow-2xs"
                                    title="Daily target capacity (units/day)"
                                  >
                                    <span className="text-[10px] text-muted-foreground mr-0.5">Quota:</span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateUserCapacity(u.id, (u.dailyCapacityUnits || 6) - 1)
                                      }
                                      className="size-4.5 rounded hover:bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground hover:text-foreground transition cursor-pointer"
                                      title="Decrease daily quota"
                                    >
                                      -
                                    </button>
                                    <span className="font-mono text-[11px] font-bold text-foreground w-4 text-center">
                                      {u.dailyCapacityUnits || 6}
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateUserCapacity(u.id, (u.dailyCapacityUnits || 6) + 1)
                                      }
                                      className="size-4.5 rounded hover:bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground hover:text-foreground transition cursor-pointer"
                                      title="Increase daily quota"
                                    >
                                      +
                                    </button>
                                    <span className="text-[10px] text-muted-foreground">u/day</span>
                                  </div>

                                  {/* Soft Delete / Deactivate */}
                                  {!isCurrent && (
                                    <button
                                      type="button"
                                      onClick={() => handleDeleteMember(u)}
                                      className="size-7 rounded-lg text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 flex items-center justify-center transition cursor-pointer"
                                      title={`Deactivate ${u.name} (Adflow Soft Delete)`}
                                    >
                                      <Trash2 className="size-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Color Picker Popover / Drawer */}
                              {isPickerOpen && (
                                <div className="pt-2 pb-1 border-t border-border/60 flex items-center gap-1.5 flex-wrap animate-in fade-in duration-100">
                                  <span className="text-[10px] text-muted-foreground mr-1">
                                    Assign color:
                                  </span>
                                  {CURATED_COLOR_OPTIONS.map((c) => {
                                    const isSelected = userColor.toLowerCase() === c.hex.toLowerCase();
                                    return (
                                      <button
                                        key={c.hex}
                                        type="button"
                                        onClick={async () => {
                                          await updateUserColor(u.id, c.hex);
                                          setColorPickerUserId(null);
                                        }}
                                        className={cn(
                                          "size-5 rounded-full border transition cursor-pointer hover:scale-125 flex items-center justify-center",
                                          isSelected
                                            ? "ring-2 ring-primary ring-offset-1 scale-110"
                                            : "border-transparent"
                                        )}
                                        style={{ backgroundColor: c.hex }}
                                        title={`${c.name} (${c.hex})`}
                                      >
                                        {isSelected && (
                                          <Check className="size-2.5 text-white drop-shadow" />
                                        )}
                                      </button>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl border border-border bg-muted/10 text-xs text-muted-foreground">
                  Logged in as <strong className="text-foreground">{currentUser.name}</strong>. Team provisioning, member deactivation, and member color coding are managed by workspace Admins.
                </div>
              )}

              {/* Keyboard Shortcuts Hint */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/20 text-xs">
                <span className="text-muted-foreground">
                  Need faster navigation? View all keyboard shortcuts
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsSettingsModalOpen(false);
                    setIsShortcutsModalOpen(true);
                  }}
                  className="font-semibold text-primary hover:underline cursor-pointer"
                >
                  Press ? to view
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-border bg-muted/20 shrink-0 text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <span className="font-mono text-[11px] bg-card px-1.5 py-0.5 rounded border border-border">
              Esc
            </span>
            <span>to close</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setIsSettingsModalOpen(false);
                logout();
              }}
              className="text-xs h-8 text-destructive border-destructive/30 hover:bg-destructive/10 gap-1.5 cursor-pointer"
            >
              <LogOut className="size-3.5" />
              <span>Sign Out</span>
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsSettingsModalOpen(false)}
              className="text-xs h-8 px-4"
            >
              Done
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
