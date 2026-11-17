"use client";

import React, { useState } from "react";
import {
  X,
  Settings,
  User as UserIcon,
  Sliders,
  Layers,
  Kanban,
  Table2,
  ListTodo,
  BarChart3,
  Calendar,
  Minimize2,
  Maximize2,
  Check,
  Trash2,
  UserPlus,
  Shield,
  LogOut,
  Zap,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { useTasks } from "@/lib/store";
import { ViewMode, Role, TaskStatus, type User } from "@/lib/types";
import {
  ADFLOW_PRODUCTION_STAGES,
  type AdFlowProductionStage,
} from "@/lib/adflow-bridge";
import { cn, getUserColor, getEmployeeCode, CURATED_COLOR_OPTIONS } from "@/lib/utils";
import type { WorkspaceSettings } from "@/lib/workspace-settings";
import { Button } from "./ui/button";

export function SettingsModal() {
  const {
    isSettingsModalOpen,
    setIsSettingsModalOpen,
    isAdsManagementConnected,
    workspaceSettings,
    isWorkspaceSettingsLoading,
    saveWorkspaceSettings,
    viewMode,
    setViewMode,
    density,
    setDensity,
    currentUser,
    users,
    logout,
    updateUserCapacity,
    setIsShortcutsModalOpen,
    isAdmin,
    createUser,
    updateUserColor,
    updateUser,
    deleteUser,
    adflowStageMapping,
    saveAdflowStageMapping,
    resetAdflowStageMapping,
  } = useTasks();

  const [activeTab, setActiveTab] = useState<"general" | "adflow" | "team">("general");
  const [isSavingWorkspace, setIsSavingWorkspace] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [isSavingMapping, setIsSavingMapping] = useState(false);
  const [mappingError, setMappingError] = useState<string | null>(null);

  const saveMapping = async (save: () => Promise<boolean>) => {
    setIsSavingMapping(true);
    setMappingError(null);
    try {
      if (!(await save())) setMappingError("Could not save the AdFlow stage template.");
    } finally {
      setIsSavingMapping(false);
    }
  };

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

  if (!isSettingsModalOpen) return null;

  const handleSaveWorkspace = async (updates: Partial<WorkspaceSettings>) => {
    setIsSavingWorkspace(true);
    setWorkspaceError(null);
    try {
      await saveWorkspaceSettings(updates);
    } catch (err) {
      setWorkspaceError(err instanceof Error ? err.message : "Could not save workspace settings.");
    } finally {
      setIsSavingWorkspace(false);
    }
  };

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
        setMemberActionError("Failed to create team member");
      }
    } catch (err: any) {
      setMemberActionError(err?.message || "Failed to create member");
    } finally {
      setIsSavingMember(false);
    }
  };

  const handleDeleteMember = async (u: User) => {
    const ok = window.confirm(
      `Deactivate member ${u.name} (${u.role.replace("_", " ")})?`
    );
    if (!ok) return;
    await deleteUser(u.id);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-foreground/30 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={() => setIsSettingsModalOpen(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-float flex flex-col max-h-[88vh] overflow-hidden"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Settings className="size-4" />
            </div>
            <h2 className="text-sm font-bold text-foreground">
              Dashboard Settings
            </h2>
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
        <div className="flex items-center gap-1 px-6 pt-2 border-b border-border bg-muted/10 shrink-0 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab("general")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition cursor-pointer whitespace-nowrap",
              activeTab === "general"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Sliders className="size-3.5" />
            <span>General & Sync</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("adflow")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition cursor-pointer whitespace-nowrap",
              activeTab === "adflow"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Layers className="size-3.5" />
            <span>AdFlow Stage Template</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("team")}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold border-b-2 transition cursor-pointer whitespace-nowrap",
              activeTab === "team"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <UserIcon className="size-3.5" />
            <span>Team & Profile</span>
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* TAB 1: GENERAL & SYNC */}
          {activeTab === "general" && (
            <div className="space-y-5">
              {/* Single Control: AdFlow Tasks Sync Toggle */}
              <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      "size-9 rounded-xl flex items-center justify-center border shrink-0",
                      isAdsManagementConnected
                        ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-500"
                        : "bg-muted border-border text-muted-foreground"
                    )}
                  >
                    <Zap className="size-4" />
                  </div>
                  <div className="text-sm font-bold text-foreground">
                    AdFlow Tasks Sync
                  </div>
                </div>

                <div className="flex items-center gap-2.5 shrink-0">
                  <span
                    className={cn(
                      "text-xs font-semibold",
                      isAdsManagementConnected
                        ? "text-emerald-500"
                        : "text-muted-foreground"
                    )}
                  >
                    {isAdsManagementConnected ? "On" : "Off"}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isAdsManagementConnected}
                    disabled={!isAdmin || isWorkspaceSettingsLoading || isSavingWorkspace}
                    onClick={() => handleSaveWorkspace({ adflowSyncEnabled: !isAdsManagementConnected })}
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out",
                      isAdsManagementConnected
                        ? "bg-emerald-500"
                        : "bg-muted-foreground/30"
                    )}
                  >
                    <span className="sr-only">Toggle AdFlow Tasks Sync</span>
                    <span
                      className={cn(
                        "pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out",
                        isAdsManagementConnected ? "translate-x-5" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>
              </div>

              {workspaceError && <p role="alert" className="text-xs text-destructive">{workspaceError}</p>}

              {/* Default View Mode */}
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                  Default View
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {[
                    { id: "board", label: "Board", icon: Kanban },
                    { id: "table", label: "Table", icon: Table2 },
                    { id: "list", label: "Checklist", icon: ListTodo },
                    { id: "calendar", label: "Calendar", icon: Calendar },
                    ...(isAdmin
                      ? [{ id: "analytics", label: "Analytics", icon: BarChart3 }]
                      : []),
                  ].map((v) => {
                    const Icon = v.icon;
                    const isSelected = (isAdmin ? workspaceSettings.defaultView || viewMode : viewMode) === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        disabled={isWorkspaceSettingsLoading || isSavingWorkspace}
                        onClick={() => isAdmin
                          ? handleSaveWorkspace({ defaultView: v.id as ViewMode })
                          : setViewMode(v.id as ViewMode)}
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
                  Density
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    disabled={isWorkspaceSettingsLoading || isSavingWorkspace}
                    onClick={() => isAdmin ? handleSaveWorkspace({ density: "comfortable" }) : setDensity("comfortable")}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border text-left text-xs transition cursor-pointer",
                      (isAdmin ? workspaceSettings.density || density : density) === "comfortable"
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-border bg-muted/20 text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Maximize2 className="size-4" />
                    <span className="font-semibold">Comfortable</span>
                  </button>

                  <button
                    type="button"
                    disabled={isWorkspaceSettingsLoading || isSavingWorkspace}
                    onClick={() => isAdmin ? handleSaveWorkspace({ density: "compact" }) : setDensity("compact")}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border text-left text-xs transition cursor-pointer",
                      (isAdmin ? workspaceSettings.density || density : density) === "compact"
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-border bg-muted/20 text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Minimize2 className="size-4" />
                    <span className="font-semibold">Compact</span>
                  </button>
                </div>
              </div>

              {/* Keyboard Shortcuts Trigger */}
              <div className="flex items-center justify-between p-3.5 rounded-xl border border-border bg-card text-xs">
                <span className="font-medium text-foreground">Keyboard Shortcuts</span>
                <button
                  type="button"
                  onClick={() => {
                    setIsSettingsModalOpen(false);
                    setIsShortcutsModalOpen(true);
                  }}
                  className="font-semibold text-primary hover:underline cursor-pointer"
                >
                  View Shortcuts (?)
                </button>
              </div>
            </div>
          )}

          {/* TAB 2: ADFLOW STAGE TEMPLATE & BLANK CREATIVE AUTOMATION */}
          {activeTab === "adflow" && (
            <div className="space-y-5">
              {/* Auto-Create Blank Creative in AdFlow Pending */}
              <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Sparkles className="size-4 text-primary" />
                      <h3 className="text-sm font-bold text-foreground">
                        Auto-Create Blank Creatives in AdFlow Pending
                      </h3>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      When you assign a creative task (e.g. 4 scripts or creatives) to a Content Creator or any user in Task Manager, automatically generate their sequential Creative IDs and create blank pending creatives in AdFlow immediately so neither you nor the creator has to manually pick IDs.
                    </p>
                  </div>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={adflowStageMapping.autoCreateBlankCreative}
                    disabled={!isAdmin || isSavingMapping}
                    onClick={async () => {
                      await saveMapping(() => saveAdflowStageMapping({
                        autoCreateBlankCreative: !adflowStageMapping.autoCreateBlankCreative,
                      }));
                    }}
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out",
                      adflowStageMapping.autoCreateBlankCreative
                        ? "bg-emerald-500"
                        : "bg-muted-foreground/30"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block size-5 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out",
                        adflowStageMapping.autoCreateBlankCreative
                          ? "translate-x-5"
                          : "translate-x-0"
                      )}
                    />
                  </button>
                </div>

                <div className="pt-2 border-t border-border/50 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-foreground">
                    Initial AdFlow Stage for New Assigned Tasks:
                  </span>
                  <select
                    value={adflowStageMapping.defaultBlankCreativeStage}
                    disabled={!isAdmin || isSavingMapping}
                    onChange={async (e) => {
                      const nextStage = e.target.value as AdFlowProductionStage;
                      await saveMapping(() => saveAdflowStageMapping({
                        defaultBlankCreativeStage: nextStage,
                      }));
                    }}
                    className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground cursor-pointer"
                  >
                    {ADFLOW_PRODUCTION_STAGES.map((stg) => (
                      <option key={stg.id} value={stg.id}>
                        {stg.label} ({stg.id})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Stage-to-Stage Mapping Template */}
              <div className="rounded-xl border border-border bg-card p-4 space-y-4">
                <div className="flex items-center justify-between gap-2 pb-2 border-b border-border">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-foreground">
                      AdFlow Stage Mapping Template (10 AdFlow Stages ↔ 5 Board Columns)
                    </h4>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Choose which board column displays each AdFlow stage and which stage labels appear on local tasks.
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={!isAdmin || isSavingMapping}
                    onClick={async () => {
                      await saveMapping(() => resetAdflowStageMapping());
                    }}
                    className="text-xs h-7 gap-1 shrink-0"
                  >
                    <RotateCcw className="size-3" />
                    <span>Reset Defaults</span>
                  </Button>
                </div>

                {mappingError && <p role="alert" className="text-xs text-destructive">{mappingError}</p>}

                {/* Part A: Map each of the 10 AdFlow stages to a Tasks Dashboard Status */}
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    1. Assign AdFlow Stages to Tasks Dashboard Columns
                  </div>
                  <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
                    {ADFLOW_PRODUCTION_STAGES.map((stg) => {
                      const assignedCol =
                        adflowStageMapping.stageToColumn?.[stg.id] || stg.taskStatus;
                      return (
                        <div
                          key={stg.id}
                          className="flex items-center justify-between gap-3 px-3.5 py-2.5 bg-card hover:bg-muted/20 text-xs"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="size-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: stg.color }}
                            />
                            <div className="truncate">
                              <span className="font-semibold text-foreground">
                                {stg.label}
                              </span>
                              <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">
                                ({stg.id})
                              </span>
                            </div>
                          </div>

                          <select
                            value={assignedCol}
                            disabled={!isAdmin || isSavingMapping}
                            onChange={async (e) => {
                              const newCol = e.target.value as TaskStatus;
                              await saveMapping(() => saveAdflowStageMapping({
                                stageToColumn: { [stg.id]: newCol },
                              }));
                            }}
                            className="rounded-lg border border-border bg-muted/30 px-2.5 py-1 text-xs font-semibold text-foreground cursor-pointer shrink-0"
                          >
                            <option value="backlog">Backlog</option>
                            <option value="todo">To Do</option>
                            <option value="in_progress">In Progress</option>
                            <option value="in_review">In Review</option>
                            <option value="completed">Done</option>
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Part B: Default AdFlow stage when moving a card into a Tasks column */}
                <div className="space-y-2 pt-2">
                  <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    2. Default Stage Label for Local Task Columns
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {(
                      [
                        { id: "backlog", label: "Backlog" },
                        { id: "todo", label: "To Do" },
                        { id: "in_progress", label: "In Progress" },
                        { id: "in_review", label: "In Review" },
                        { id: "completed", label: "Done" },
                      ] as { id: TaskStatus; label: string }[]
                    ).map((col) => {
                      const currentDefault =
                        adflowStageMapping.columnDefaultStage?.[col.id] ||
                        "script_writing";
                      return (
                        <div
                          key={col.id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/15 px-3 py-2 text-xs"
                        >
                          <span className="font-semibold text-foreground">
                            {col.label}:
                          </span>
                          <select
                            value={currentDefault}
                            disabled={!isAdmin || isSavingMapping}
                            onChange={async (e) => {
                              const nextStg = e.target.value as AdFlowProductionStage;
                              await saveMapping(() => saveAdflowStageMapping({
                                columnDefaultStage: { [col.id]: nextStg },
                              }));
                            }}
                            className="rounded border border-border bg-card px-2 py-1 text-[11px] font-semibold text-foreground cursor-pointer"
                          >
                            {ADFLOW_PRODUCTION_STAGES.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.shortLabel} ({s.label})
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TEAM & PROFILE */}
          {activeTab === "team" && (
            <div className="space-y-5">
              {/* Current Active User Profile */}
              {(() => {
                const currentEmpCode =
                  currentUser.employeeCode || getEmployeeCode(currentUser.name);
                const currentColor = getUserColor(
                  currentEmpCode,
                  currentUser.color
                );

                return (
                  <div className="rounded-xl border border-border bg-card p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className="size-10 rounded-xl border flex items-center justify-center font-bold text-sm shadow-xs ring-1"
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
                            <h3 className="text-sm font-bold text-foreground">
                              {currentUser.name}
                            </h3>
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
                          <div className="text-xs text-muted-foreground">
                            {currentUser.email}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 rounded-md text-xs font-semibold uppercase tracking-wide bg-primary/15 text-primary border border-primary/20">
                          {currentUser.role.replace("_", " ")}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ADMIN TEAM MANAGEMENT */}
              {isAdmin && (
                <div className="rounded-xl border border-border bg-card p-4 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-border">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center gap-2">
                      <Shield className="size-3.5 text-primary" />
                      <span>Team Members</span>
                    </h4>

                    <Button
                      type="button"
                      variant={isAddingMember ? "secondary" : "primary"}
                      size="sm"
                      onClick={() => setIsAddingMember(!isAddingMember)}
                      className="text-xs h-7.5 gap-1.5"
                    >
                      {isAddingMember ? (
                        <X className="size-3.5" />
                      ) : (
                        <UserPlus className="size-3.5" />
                      )}
                      <span>{isAddingMember ? "Cancel" : "Add Member"}</span>
                    </Button>
                  </div>

                  {/* Add Member Form */}
                  {isAddingMember && (
                    <form
                      onSubmit={handleCreateMember}
                      className="p-4 rounded-xl border border-primary/25 bg-primary/5 space-y-3.5 animate-in fade-in duration-150"
                    >
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
                              if (
                                !newMemberCode ||
                                newMemberCode === getEmployeeCode(newMemberName)
                              ) {
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
                            Role *
                          </label>
                          <select
                            value={newMemberRole}
                            onChange={(e) =>
                              setNewMemberRole(e.target.value as Role)
                            }
                            className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary cursor-pointer"
                          >
                            <option value="developer">
                              Developer (Task Delegation & Admin)
                            </option>
                            <option value="admin">Admin</option>
                            <option value="manager">Manager</option>
                            <option value="editor">Editor</option>
                            <option value="content_creator">
                              Content Creator
                            </option>
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
                            placeholder="Set password"
                            value={newMemberPassword}
                            onChange={(e) =>
                              setNewMemberPassword(e.target.value)
                            }
                            className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-foreground mb-1">
                            Daily Quota (units/day)
                          </label>
                          <input
                            type="number"
                            min={1}
                            max={24}
                            value={newMemberCapacity}
                            onChange={(e) =>
                              setNewMemberCapacity(
                                Math.max(
                                  1,
                                  Math.min(24, Number(e.target.value) || 1)
                                )
                              )
                            }
                            className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-semibold text-foreground mb-1">
                            Employee Code
                          </label>
                          <input
                            type="text"
                            maxLength={5}
                            placeholder="e.g. HIM"
                            value={newMemberCode}
                            onChange={(e) =>
                              setNewMemberCode(e.target.value.toUpperCase())
                            }
                            className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-mono uppercase text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                      </div>

                      {/* Color Palette Picker */}
                      <div>
                        <label className="block text-[11px] font-semibold text-foreground mb-1.5">
                          Color Tag
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
                                  isChosen
                                    ? "ring-2 ring-primary ring-offset-2 scale-110 border-white"
                                    : "border-transparent"
                                )}
                                style={{ backgroundColor: c.hex }}
                                title={c.name}
                              >
                                {isChosen && (
                                  <Check className="size-3 text-white drop-shadow" />
                                )}
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
                          {isSavingMember ? "Saving..." : "Save Member"}
                        </Button>
                      </div>
                    </form>
                  )}

                  {/* Members List */}
                  <div className="divide-y divide-border border border-border rounded-xl overflow-hidden bg-card">
                    {users
                      .filter((u) => u.active !== false && !u.deletedAt)
                      .map((u) => {
                        const empCode =
                          u.employeeCode || getEmployeeCode(u.name);
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
                                    <select
                                      value={u.role}
                                      onChange={(e) =>
                                        updateUser(u.id, {
                                          role: e.target.value as Role,
                                        })
                                      }
                                      className="text-[10px] font-mono uppercase bg-muted hover:bg-muted/80 border border-border px-1.5 py-0.5 rounded text-foreground shrink-0 cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary"
                                      title="Change role in Task Manager dashboard"
                                    >
                                      <option value="developer">DEVELOPER</option>
                                      <option value="admin">ADMIN</option>
                                      <option value="manager">MANAGER</option>
                                      <option value="editor">EDITOR</option>
                                      <option value="content_creator">
                                        CONTENT CREATOR
                                      </option>
                                      <option value="media_buyer">
                                        MEDIA BUYER
                                      </option>
                                      <option value="member">MEMBER</option>
                                    </select>
                                  </div>
                                  <div className="text-[11px] text-muted-foreground truncate">
                                    {u.email}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setColorPickerUserId(
                                      isPickerOpen ? null : u.id
                                    )
                                  }
                                  className="flex items-center gap-1.5 px-2 py-1 rounded-lg border border-border bg-card hover:bg-muted transition cursor-pointer"
                                  title="Change user color"
                                >
                                  <span
                                    className="size-3.5 rounded-full border border-black/10 shrink-0"
                                    style={{ backgroundColor: userColor }}
                                  />
                                </button>

                                <div className="flex items-center gap-1 border border-border rounded-lg bg-card px-2 py-1">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateUserCapacity(
                                        u.id,
                                        (u.dailyCapacityUnits || 6) - 1
                                      )
                                    }
                                    className="size-4.5 rounded hover:bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground hover:text-foreground transition cursor-pointer"
                                  >
                                    -
                                  </button>
                                  <span className="font-mono text-[11px] font-bold text-foreground w-4 text-center">
                                    {u.dailyCapacityUnits || 6}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() =>
                                      updateUserCapacity(
                                        u.id,
                                        (u.dailyCapacityUnits || 6) + 1
                                      )
                                    }
                                    className="size-4.5 rounded hover:bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground hover:text-foreground transition cursor-pointer"
                                  >
                                    +
                                  </button>
                                  <span className="text-[10px] text-muted-foreground">
                                    u/day
                                  </span>
                                </div>

                                {!isCurrent && (
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteMember(u)}
                                    className="size-7 rounded-lg text-muted-foreground/60 hover:text-destructive hover:bg-destructive/10 flex items-center justify-center transition cursor-pointer"
                                    title={`Deactivate ${u.name}`}
                                  >
                                    <Trash2 className="size-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {isPickerOpen && (
                              <div className="pt-2 pb-1 border-t border-border/60 flex items-center gap-1.5 flex-wrap animate-in fade-in duration-100">
                                {CURATED_COLOR_OPTIONS.map((c) => {
                                  const isSelected =
                                    userColor.toLowerCase() ===
                                    c.hex.toLowerCase();
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
                                      title={c.name}
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
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t border-border bg-muted/20 shrink-0 text-xs">
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
  );
}
