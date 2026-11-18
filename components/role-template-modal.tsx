"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Layers,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  UserCheck,
  Sparkles,
  Code2,
  Video,
  Clapperboard,
  TrendingUp,
  Briefcase,
  ShieldCheck,
  Users,
  ArrowRightLeft,
  Clock,
  Copy,
} from "lucide-react";
import { useTasks } from "@/lib/store";
import { RoleTemplate, Role, TaskStatus, ParentColumnDef, SubColumnDef } from "@/lib/types";
import { dateInTargetTimeZone } from "@/lib/supabase";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

export const ROLE_OPTIONS: { role: Role | "general"; label: string; icon: any; color: string }[] = [
  { role: "editor", label: "Video Editor", icon: Video, color: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
  { role: "content_creator", label: "Content Creator", icon: Clapperboard, color: "text-pink-400 bg-pink-500/10 border-pink-500/30" },
  { role: "media_buyer", label: "Media Buyer", icon: TrendingUp, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  { role: "developer", label: "Developer", icon: Code2, color: "text-blue-400 bg-blue-500/10 border-blue-500/30" },
  { role: "manager", label: "Manager", icon: Users, color: "text-purple-400 bg-purple-500/10 border-purple-500/30" },
  { role: "admin", label: "Admin", icon: ShieldCheck, color: "text-rose-400 bg-rose-500/10 border-rose-500/30" },
  { role: "general", label: "General", icon: Briefcase, color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/30" },
];

const PARENT_COLUMNS_PRESET: { id: TaskStatus; label: string }[] = [
  { id: "backlog", label: "Backlog" },
  { id: "todo", label: "To Do" },
  { id: "in_progress", label: "In Progress" },
  { id: "in_review", label: "In Review" },
  { id: "completed", label: "Done" },
];

interface RoleTemplateModalProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export function RoleTemplateModal({ isOpen, onClose }: RoleTemplateModalProps = {}) {
  const {
    isRoleTemplateModalOpen: storeIsOpen,
    setIsRoleTemplateModalOpen,
    templates,
    activeTemplateId,
    setActiveTemplateId,
    createRoleTemplate,
    updateRoleTemplate,
    deleteRoleTemplate,
    applyTemplateToUser,
    createTask,
    reassignTask,
    users,
    tasks,
    currentUser,
    currentUserId,
    isAdmin,
  } = useTasks();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    activeTemplateId || templates[0]?.id || "tpl-video-editor"
  );
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [activeTab, setActiveTab] = useState<"templates" | "builder" | "reassign">("templates");
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<RoleTemplate | null>(null);

  // Builder state
  const [formName, setFormName] = useState("");
  const [formRole, setFormRole] = useState<Role | "general">("editor");
  const [formUserId, setFormUserId] = useState<string>("");
  const [formDesc, setFormDesc] = useState("");
  const [formCustomStatusLabelsEnabled, setFormCustomStatusLabelsEnabled] = useState(false);
  const [formParentCols, setFormParentCols] = useState<ParentColumnDef[]>([]);

  // Apply template state
  const [applyUserId, setApplyUserId] = useState<string>(currentUserId || "");
  const [applyDate, setApplyDate] = useState<string>("");
  const [applySuccessMessage, setApplySuccessMessage] = useState<string>("");

  // Reassignment state
  const [reassignSelectedTaskId, setReassignSelectedTaskId] = useState<string>("");
  const [reassignTargetUserId, setReassignTargetUserId] = useState<string>("");
  const [reassignSuccessMsg, setReassignSuccessMsg] = useState<string>("");

  // New subcolumn inline input state
  const [addingSubColParentId, setAddingSubColParentId] = useState<TaskStatus | null>(null);
  const [newSubColLabel, setNewSubColLabel] = useState("");
  const [newSubColDesc, setNewSubColDesc] = useState("");
  const [newSubColUnits, setNewSubColUnits] = useState(1);
  const [newSubColSLA, setNewSubColSLA] = useState(24);
  const [newSubColChecklist, setNewSubColChecklist] = useState("");

  useEffect(() => {
    if (currentUserId && !applyUserId) {
      setApplyUserId(currentUserId);
    }
  }, [currentUserId, applyUserId]);

  const filteredTemplates =
    roleFilter === "all"
      ? templates
      : templates.filter((t) => t.role === roleFilter);

  const currentTpl =
    templates.find((t) => t.id === selectedTemplateId) ||
    filteredTemplates[0] ||
    templates[0];

  const handleStartNewTemplate = (presetRole?: Role | "general") => {
    const targetRole = presetRole || (currentUser?.role as Role) || "editor";
    const roleLabel = ROLE_OPTIONS.find((r) => r.role === targetRole)?.label || "Custom";
    setFormName(`${roleLabel} Workflow`);
    setFormRole(targetRole);
    setFormUserId("");
    setFormDesc(`${roleLabel} pipeline stages and checklist`);
    setFormParentCols(
      PARENT_COLUMNS_PRESET.map((p) => ({
        id: p.id,
        label: p.label,
        subColumns:
          p.id === "todo"
            ? [
                {
                  id: `sub-${Date.now()}-1`,
                  label: `${roleLabel} Daily Deliverable`,
                  description: "Primary daily task deliverable",
                  defaultTargetQuantity: 2,
                  slaHours: 24,
                  defaultChecklist: ["Review brief", "Complete deliverable", "Submit link"],
                  color: "#3b82f6",
                },
              ]
            : [],
      }))
    );
    setFormCustomStatusLabelsEnabled(false);
    setIsCreatingNew(true);
    setEditingTemplate(null);
    setActiveTab("builder");
  };

  const handleDuplicateTemplate = (tpl: RoleTemplate) => {
    setFormName(`${tpl.name} (Custom)`);
    setFormRole(tpl.role);
    setFormUserId(tpl.userId || "");
    setFormDesc(tpl.description || "");
    setFormCustomStatusLabelsEnabled(Boolean(tpl.customStatusLabelsEnabled));
    setFormParentCols(
      JSON.parse(JSON.stringify(tpl.parentColumns)).map((col: ParentColumnDef) => ({
        ...col,
        label:
          (tpl.customStatusLabelsEnabled && tpl.statusLabels?.[col.id]) || col.label,
      }))
    );
    setIsCreatingNew(true);
    setEditingTemplate(null);
    setActiveTab("builder");
  };

  const handleEditTemplate = (tpl: RoleTemplate) => {
    setFormName(tpl.name);
    setFormRole(tpl.role);
    setFormUserId(tpl.userId || "");
    setFormDesc(tpl.description || "");
    setFormCustomStatusLabelsEnabled(Boolean(tpl.customStatusLabelsEnabled));
    setFormParentCols(
      JSON.parse(JSON.stringify(tpl.parentColumns)).map((col: ParentColumnDef) => ({
        ...col,
        label:
          (tpl.customStatusLabelsEnabled && tpl.statusLabels?.[col.id]) || col.label,
      }))
    );
    setEditingTemplate(tpl);
    setIsCreatingNew(false);
    setActiveTab("builder");
  };

  const handleSaveBuilder = async () => {
    if (!formName.trim()) return;

    const normalizedParentCols: ParentColumnDef[] = formParentCols.map((col) => {
      const defaultLabel =
        PARENT_COLUMNS_PRESET.find((p) => p.id === col.id)?.label || col.label;
      return {
        ...col,
        label: formCustomStatusLabelsEnabled
          ? col.label.trim() || defaultLabel
          : defaultLabel,
      };
    });

    const statusLabels = formCustomStatusLabelsEnabled
      ? normalizedParentCols.reduce(
          (acc, col) => ({ ...acc, [col.id]: col.label }),
          {} as Partial<Record<TaskStatus, string>>
        )
      : undefined;

    const selectedUserName = formUserId
      ? users.find((u) => u.id === formUserId)?.name
      : undefined;

    if (isCreatingNew) {
      const created = await createRoleTemplate({
        name: formName.trim(),
        role: formRole,
        userId: formUserId || undefined,
        userName: selectedUserName,
        description: formDesc.trim(),
        customStatusLabelsEnabled: formCustomStatusLabelsEnabled,
        statusLabels,
        parentColumns: normalizedParentCols,
        isDefault: false,
      });
      if (created) {
        setSelectedTemplateId(created.id);
        setActiveTab("templates");
      }
    } else if (editingTemplate) {
      const updated = await updateRoleTemplate(editingTemplate.id, {
        name: formName.trim(),
        role: formRole,
        userId: formUserId || undefined,
        userName: selectedUserName,
        description: formDesc.trim(),
        customStatusLabelsEnabled: formCustomStatusLabelsEnabled,
        statusLabels,
        parentColumns: normalizedParentCols,
      });
      if (updated) {
        setSelectedTemplateId(updated.id);
        setActiveTab("templates");
      }
    }
  };

  const handleAddSubColumn = (parentId: TaskStatus) => {
    if (!newSubColLabel.trim()) return;
    const checklistItems = newSubColChecklist
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    const newSub: SubColumnDef = {
      id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      label: newSubColLabel.trim(),
      description: newSubColDesc.trim() || undefined,
      defaultTargetQuantity: newSubColUnits || 1,
      slaHours: newSubColSLA || 24,
      defaultChecklist: checklistItems.length > 0 ? checklistItems : undefined,
      color: "#0284c7",
    };

    setFormParentCols((prev) =>
      prev.map((col) =>
        col.id === parentId
          ? { ...col, subColumns: [...col.subColumns, newSub] }
          : col
      )
    );

    setNewSubColLabel("");
    setNewSubColDesc("");
    setNewSubColUnits(1);
    setNewSubColSLA(24);
    setNewSubColChecklist("");
    setAddingSubColParentId(null);
  };

  const handleDeleteSubColumn = (parentId: TaskStatus, subId: string) => {
    setFormParentCols((prev) =>
      prev.map((col) =>
        col.id === parentId
          ? { ...col, subColumns: col.subColumns.filter((s) => s.id !== subId) }
          : col
      )
    );
  };

  const handleApplyTemplate = async (targetUserOverride?: string) => {
    const targetId = targetUserOverride || applyUserId || currentUserId;
    if (!targetId || !currentTpl) return;

    setApplySuccessMessage("Generating tasks...");
    await applyTemplateToUser(currentTpl.id, targetId, applyDate || undefined);
    const assignedUser = users.find((u) => u.id === targetId);
    setApplySuccessMessage(
      `✓ Assigned ${currentTpl.name} to ${assignedUser?.name || "Me"}`
    );
    setTimeout(() => setApplySuccessMessage(""), 3500);
  };

  const handleCreateSingleStageTask = async (
    parentCol: ParentColumnDef,
    subCol: SubColumnDef
  ) => {
    const targetId = applyUserId || currentUserId;
    if (!targetId || !currentTpl) return;
    await createTask({
      title: subCol.label,
      description: subCol.description || `${currentTpl.name} · ${parentCol.label}`,
      priority: "medium",
      status: parentCol.id,
      assigneeId: targetId,
      dueDate: applyDate || dateInTargetTimeZone(),
      targetQuantity: subCol.defaultTargetQuantity || 1,
      subColumnId: subCol.id,
      parentColumnId: parentCol.id,
      templateRole: currentTpl.role !== "general" ? currentTpl.role : undefined,
      customSubtasks: subCol.defaultChecklist?.map((item, idx) => ({
        id: `sub-stage-${Date.now()}-${idx}`,
        title: item,
        completed: false,
        assignedTo: targetId,
        sortOrder: idx + 1,
        isCustom: true,
      })),
    });
    const assignedUser = users.find((u) => u.id === targetId);
    setApplySuccessMessage(`✓ Added "${subCol.label}" for ${assignedUser?.name || "Me"}`);
    setTimeout(() => setApplySuccessMessage(""), 3000);
  };

  const handleReassignTaskAction = async () => {
    if (!reassignSelectedTaskId || !reassignTargetUserId) return;
    await reassignTask(reassignSelectedTaskId, reassignTargetUserId);
    const targetUser = users.find((u) => u.id === reassignTargetUserId);
    setReassignSuccessMsg(`✓ Reassigned to ${targetUser?.name || "member"}`);
    setTimeout(() => setReassignSuccessMsg(""), 3000);
  };

  const effectiveIsOpen = isOpen !== undefined ? isOpen : storeIsOpen;
  const handleCloseModal = () => {
    if (onClose) onClose();
    setIsRoleTemplateModalOpen(false);
  };

  useEffect(() => {
    if (!effectiveIsOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (onClose) onClose();
        setIsRoleTemplateModalOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [effectiveIsOpen, onClose, setIsRoleTemplateModalOpen]);

  if (!effectiveIsOpen || !isAdmin) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-150"
      onClick={handleCloseModal}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex flex-col w-full max-w-5xl h-[86vh] max-h-[800px] rounded-2xl border border-border bg-card text-card-foreground shadow-2xl overflow-hidden"
      >
        {/* Compact Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-primary/10 text-primary border border-primary/20">
              <Layers className="size-4" />
            </div>
            <h2 className="text-sm font-bold text-foreground">Role Templates</h2>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => handleStartNewTemplate()}
              className="text-xs h-7 gap-1"
            >
              <Plus className="size-3.5 text-primary" />
              <span>New Template</span>
            </Button>
            <button
              type="button"
              onClick={handleCloseModal}
              className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center justify-between px-5 border-b border-border bg-card">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveTab("templates")}
              className={cn(
                "py-2.5 px-3 text-xs font-semibold border-b-2 transition cursor-pointer flex items-center gap-1.5",
                activeTab === "templates"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Sparkles className="size-3.5" />
              <span>Templates ({templates.length})</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (!isCreatingNew && !editingTemplate) {
                  handleStartNewTemplate();
                } else {
                  setActiveTab("builder");
                }
              }}
              className={cn(
                "py-2.5 px-3 text-xs font-semibold border-b-2 transition cursor-pointer flex items-center gap-1.5",
                activeTab === "builder"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Edit2 className="size-3.5" />
              <span>
                {isCreatingNew
                  ? "New Template"
                  : editingTemplate
                  ? `Edit: ${editingTemplate.name}`
                  : "Builder"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("reassign")}
              className={cn(
                "py-2.5 px-3 text-xs font-semibold border-b-2 transition cursor-pointer flex items-center gap-1.5",
                activeTab === "reassign"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <ArrowRightLeft className="size-3.5" />
              <span>Quick Reassign</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 scrollbar-thin">
          {/* TAB 1: TEMPLATES */}
          {activeTab === "templates" && (
            <div className="space-y-5">
              {/* Role Filter Pills */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setRoleFilter("all")}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-medium border transition cursor-pointer",
                    roleFilter === "all"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-card text-muted-foreground border-border hover:text-foreground"
                  )}
                >
                  All Roles
                </button>
                {ROLE_OPTIONS.map((r) => {
                  const Icon = r.icon;
                  const active = roleFilter === r.role;
                  return (
                    <button
                      key={r.role}
                      type="button"
                      onClick={() => {
                        setRoleFilter(r.role);
                        const match = templates.find((t) => t.role === r.role);
                        if (match) setSelectedTemplateId(match.id);
                      }}
                      className={cn(
                        "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition cursor-pointer",
                        active
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-card text-muted-foreground border-border hover:text-foreground"
                      )}
                    >
                      <Icon className="size-3" />
                      <span>{r.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Template Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredTemplates.map((tpl) => {
                  const isSelected = currentTpl?.id === tpl.id;
                  const isActiveOnBoard = activeTemplateId === tpl.id;
                  const roleBadge =
                    ROLE_OPTIONS.find((r) => r.role === tpl.role) || ROLE_OPTIONS[0];
                  const Icon = roleBadge.icon;
                  const totalSubCols = tpl.parentColumns.reduce(
                    (acc, p) => acc + p.subColumns.length,
                    0
                  );

                  return (
                    <div
                      key={tpl.id}
                      onClick={() => setSelectedTemplateId(tpl.id)}
                      className={cn(
                        "flex flex-col p-3.5 rounded-xl border transition-all duration-150 cursor-pointer",
                        isSelected
                          ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                          : "border-border bg-card/60 hover:bg-muted/40"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={cn("p-1.5 rounded-lg border shrink-0", roleBadge.color)}>
                            <Icon className="size-3.5" />
                          </div>
                          <span className="text-xs font-bold text-foreground truncate">
                            {tpl.name}
                          </span>
                        </div>
                        {isActiveOnBoard && (
                          <span className="rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 text-[9px] font-bold px-2 py-0.5 shrink-0">
                            Active
                          </span>
                        )}
                      </div>

                      <p className="text-[11px] text-muted-foreground line-clamp-1 mb-2.5">
                        {tpl.description}
                      </p>

                      <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/50 pt-2 mt-auto">
                        <span className="font-mono">{totalSubCols} task stages</span>
                        <span className="capitalize font-semibold text-foreground/80">
                          {roleBadge.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Selected Template Details & 1-Click Assignment */}
              {currentTpl && (
                <div className="rounded-xl border border-border bg-card/90 p-4 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-foreground">{currentTpl.name}</h3>
                      <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-muted border border-border">
                        {currentTpl.role.replace("_", " ")}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Button
                        variant={activeTemplateId === currentTpl.id ? "primary" : "secondary"}
                        size="sm"
                        onClick={() =>
                          setActiveTemplateId(
                            activeTemplateId === currentTpl.id ? null : currentTpl.id
                          )
                        }
                        className="text-xs h-7 gap-1"
                      >
                        <CheckCircle2 className="size-3.5" />
                        <span>
                          {activeTemplateId === currentTpl.id ? "Active Board" : "Use on Board"}
                        </span>
                      </Button>

                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleDuplicateTemplate(currentTpl)}
                        className="text-xs h-7 gap-1"
                        title="Clone as custom template"
                      >
                        <Copy className="size-3" />
                        <span>Clone</span>
                      </Button>

                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleEditTemplate(currentTpl)}
                        className="text-xs h-7 gap-1"
                      >
                        <Edit2 className="size-3" />
                        <span>Edit</span>
                      </Button>

                      {!currentTpl.isDefault && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm(`Delete template "${currentTpl.name}"?`)) {
                              deleteRoleTemplate(currentTpl.id);
                            }
                          }}
                          className="text-xs h-7 text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Quick Apply Bar */}
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/30 border border-border/70 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <UserCheck className="size-4 text-primary shrink-0" />
                      <select
                        value={applyUserId}
                        onChange={(e) => setApplyUserId(e.target.value)}
                        className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary"
                      >
                        <option value="">Select member...</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} {u.id === currentUserId ? "(Me)" : ""} · {u.role.replace("_", " ")}
                          </option>
                        ))}
                      </select>

                      <input
                        type="date"
                        value={applyDate}
                        onChange={(e) => setApplyDate(e.target.value)}
                        className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary"
                        title="Due Date (defaults to today)"
                      />

                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleApplyTemplate()}
                        className="text-xs h-7 gap-1"
                      >
                        <Sparkles className="size-3.5" />
                        <span>Assign All Stages</span>
                      </Button>

                      {currentUserId && (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => {
                            setApplyUserId(currentUserId);
                            handleApplyTemplate(currentUserId);
                          }}
                          className="text-xs h-7 gap-1"
                        >
                          <UserCheck className="size-3.5 text-primary" />
                          <span>Assign to Me</span>
                        </Button>
                      )}
                    </div>

                    {applySuccessMessage && (
                      <span className="text-xs font-semibold text-emerald-500">
                        {applySuccessMessage}
                      </span>
                    )}
                  </div>

                  {/* Columns & Stage Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2.5 items-start">
                    {currentTpl.parentColumns.map((parent) => (
                      <div
                        key={parent.id}
                        className="rounded-xl border border-border/80 bg-muted/15 p-2.5 space-y-2"
                      >
                        <div className="flex items-center justify-between pb-1 border-b border-border/60">
                          <span className="text-xs font-bold text-foreground">
                            {currentTpl.customStatusLabelsEnabled
                              ? currentTpl.statusLabels?.[parent.id] || parent.label
                              : PARENT_COLUMNS_PRESET.find((p) => p.id === parent.id)?.label ||
                                parent.label}
                          </span>
                          <span className="text-[10px] font-mono text-muted-foreground">
                            {parent.subColumns.length}
                          </span>
                        </div>

                        <div className="space-y-1.5">
                          {parent.subColumns.map((sub) => (
                            <div
                              key={sub.id}
                              className="p-2 rounded-lg bg-card border border-border/60 hover:border-primary/40 transition group"
                            >
                              <div className="flex items-start justify-between gap-1">
                                <span className="text-xs font-semibold text-foreground leading-snug">
                                  {sub.label}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleCreateSingleStageTask(parent, sub)}
                                  className="opacity-0 group-hover:opacity-100 text-[10px] font-semibold text-primary hover:bg-primary/10 px-1.5 py-0.5 rounded transition shrink-0 cursor-pointer"
                                  title="Add only this stage as a task"
                                >
                                  + Add
                                </button>
                              </div>
                              {sub.defaultChecklist && sub.defaultChecklist.length > 0 && (
                                <div className="mt-1 space-y-0.5">
                                  {sub.defaultChecklist.slice(0, 2).map((item, i) => (
                                    <div
                                      key={i}
                                      className="text-[10px] text-muted-foreground truncate"
                                    >
                                      • {item}
                                    </div>
                                  ))}
                                </div>
                              )}
                              <div className="flex items-center justify-between mt-1.5 pt-1 border-t border-border/40 text-[9px] text-muted-foreground">
                                <span className="flex items-center gap-0.5">
                                  <Clock className="size-2.5 text-primary" />
                                  {sub.slaHours || 24}h
                                </span>
                                <span>{sub.defaultTargetQuantity || 1}u</span>
                              </div>
                            </div>
                          ))}

                          {parent.subColumns.length === 0 && (
                            <div className="text-[10px] text-muted-foreground/50 text-center py-2">
                              Empty
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: BUILDER */}
          {activeTab === "builder" && (
            <div className="space-y-5 max-w-4xl mx-auto">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <h3 className="text-sm font-bold text-foreground">
                  {isCreatingNew ? "Create Role Template" : `Edit: ${formName}`}
                </h3>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setActiveTab("templates")}
                    className="text-xs h-7"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSaveBuilder}
                    className="text-xs h-7 gap-1"
                  >
                    <CheckCircle2 className="size-3.5" />
                    <span>Save Template</span>
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Template Name
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Short-Form Video Editor"
                    className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Role
                  </label>
                  <select
                    value={formRole}
                    onChange={(e) => {
                      const prevRoleLabel =
                        ROLE_OPTIONS.find((r) => r.role === formRole)?.label || "Custom";
                      const nextRole = e.target.value as Role | "general";
                      const nextRoleLabel =
                        ROLE_OPTIONS.find((r) => r.role === nextRole)?.label || "Custom";
                      setFormRole(nextRole);

                      if (formUserId && nextRole !== "general") {
                        const selectedUser = users.find((u) => u.id === formUserId);
                        if (!selectedUser || selectedUser.role !== nextRole) {
                          setFormUserId("");
                        }
                      }

                      if (isCreatingNew) {
                        if (
                          !formName.trim() ||
                          formName === `${prevRoleLabel} Workflow`
                        ) {
                          setFormName(`${nextRoleLabel} Workflow`);
                        }
                        if (
                          !formDesc.trim() ||
                          formDesc === `${prevRoleLabel} pipeline stages and checklist`
                        ) {
                          setFormDesc(`${nextRoleLabel} pipeline stages and checklist`);
                        }
                        setFormParentCols((prev) =>
                          prev.map((col) => ({
                            ...col,
                            subColumns: col.subColumns.map((sub) =>
                              sub.label === `${prevRoleLabel} Daily Deliverable`
                                ? { ...sub, label: `${nextRoleLabel} Daily Deliverable` }
                                : sub
                            ),
                          }))
                        );
                      }
                    }}
                    className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.role} value={r.role}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Summary
                  </label>
                  <input
                    type="text"
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    placeholder="Short description..."
                    className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-border bg-muted/20 p-3">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Specific User (Optional)
                  </label>
                  <select
                    value={formUserId}
                    onChange={(e) => setFormUserId(e.target.value)}
                    className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground"
                  >
                    <option value="">
                      {formRole === "general"
                        ? "All users"
                        : `All users in ${
                            ROLE_OPTIONS.find((r) => r.role === formRole)?.label ||
                            formRole.replace("_", " ")
                          } role`}
                    </option>
                    {users
                      .filter((u) => formRole === "general" || u.role === formRole)
                      .map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} ({u.role.replace("_", " ")})
                        </option>
                      ))}
                  </select>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="block text-xs font-semibold text-foreground">
                      Customize Default Status Nomenclature
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      Off by default. Toggle on to rename To Do, In Progress, etc.
                    </span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={formCustomStatusLabelsEnabled}
                    onClick={() => {
                      const next = !formCustomStatusLabelsEnabled;
                      setFormCustomStatusLabelsEnabled(next);
                      if (!next) {
                        setFormParentCols((prev) =>
                          prev.map((col) => ({
                            ...col,
                            label:
                              PARENT_COLUMNS_PRESET.find((p) => p.id === col.id)?.label ||
                              col.label,
                          }))
                        );
                      }
                    }}
                    className={cn(
                      "relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition cursor-pointer",
                      formCustomStatusLabelsEnabled
                        ? "bg-primary border-primary"
                        : "bg-muted border-border"
                    )}
                    title="Toggle custom status nomenclature"
                  >
                    <span
                      className={cn(
                        "inline-block size-4 rounded-full bg-white shadow transition-transform",
                        formCustomStatusLabelsEnabled ? "translate-x-5" : "translate-x-1"
                      )}
                    />
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {formParentCols.map((parent) => (
                  <div
                    key={parent.id}
                    className="rounded-xl border border-border bg-card p-3.5 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-primary" />
                        {formCustomStatusLabelsEnabled ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              type="text"
                              value={parent.label}
                              onChange={(e) =>
                                setFormParentCols((prev) =>
                                  prev.map((col) =>
                                    col.id === parent.id
                                      ? { ...col, label: e.target.value }
                                      : col
                                  )
                                )
                              }
                              aria-label={`Custom status label for ${parent.id}`}
                              className="rounded-md border border-primary/40 bg-background px-2 py-0.5 text-xs font-bold text-foreground w-36 focus:outline-none focus:ring-1 focus:ring-primary"
                            />
                            <span className="text-[10px] font-mono text-muted-foreground">
                              (default:{" "}
                              {PARENT_COLUMNS_PRESET.find((p) => p.id === parent.id)?.label})
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs font-bold text-foreground">
                            {PARENT_COLUMNS_PRESET.find((p) => p.id === parent.id)?.label ||
                              parent.label}
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-muted-foreground">
                          ({parent.subColumns.length})
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setAddingSubColParentId(parent.id)}
                        className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:bg-primary/10 px-2 py-1 rounded-md transition cursor-pointer"
                      >
                        <Plus className="size-3" />
                        <span>Add Stage</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      {parent.subColumns.map((sub) => (
                        <div
                          key={sub.id}
                          className="p-2.5 rounded-lg border border-border bg-muted/20 relative group"
                        >
                          <div className="flex items-start justify-between">
                            <span className="text-xs font-semibold text-foreground">
                              {sub.label}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleDeleteSubColumn(parent.id, sub.id)}
                              className="text-muted-foreground hover:text-destructive opacity-50 group-hover:opacity-100 transition p-0.5"
                            >
                              <Trash2 className="size-3" />
                            </button>
                          </div>
                          <div className="flex items-center gap-2 mt-1.5 text-[10px] text-muted-foreground">
                            <span>{sub.defaultTargetQuantity || 1} units</span>
                            <span>· {sub.slaHours || 24}h SLA</span>
                            {sub.defaultChecklist && (
                              <span>· {sub.defaultChecklist.length} steps</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {addingSubColParentId === parent.id && (
                      <div className="p-3 rounded-lg border border-dashed border-primary/50 bg-primary/5 space-y-2.5">
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <input
                            type="text"
                            value={newSubColLabel}
                            onChange={(e) => setNewSubColLabel(e.target.value)}
                            placeholder="Stage title (e.g. Rough Cut)"
                            className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-foreground"
                          />
                          <input
                            type="number"
                            min={1}
                            value={newSubColUnits}
                            onChange={(e) => setNewSubColUnits(Number(e.target.value) || 1)}
                            placeholder="Units"
                            className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-foreground"
                          />
                          <input
                            type="number"
                            min={1}
                            value={newSubColSLA}
                            onChange={(e) => setNewSubColSLA(Number(e.target.value) || 24)}
                            placeholder="SLA hours"
                            className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-foreground"
                          />
                        </div>
                        <textarea
                          rows={2}
                          value={newSubColChecklist}
                          onChange={(e) => setNewSubColChecklist(e.target.value)}
                          placeholder="Checklist items (one per line)..."
                          className="w-full rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-foreground"
                        />
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setAddingSubColParentId(null)}
                            className="text-xs h-7"
                          >
                            Cancel
                          </Button>
                          <Button
                            variant="primary"
                            size="sm"
                            onClick={() => handleAddSubColumn(parent.id)}
                            className="text-xs h-7"
                          >
                            Add Stage
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 3: QUICK REASSIGN */}
          {activeTab === "reassign" && (
            <div className="space-y-4 max-w-4xl mx-auto">
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      Task
                    </label>
                    <select
                      value={reassignSelectedTaskId}
                      onChange={(e) => setReassignSelectedTaskId(e.target.value)}
                      className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground"
                    >
                      <option value="">Choose task...</option>
                      {tasks.map((t) => {
                        const assignee = users.find((u) => u.id === t.assigneeId);
                        return (
                          <option key={t.id} value={t.id}>
                            {t.taskNumber} — {t.title} ({assignee?.name || "Unassigned"})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      New Assignee
                    </label>
                    <select
                      value={reassignTargetUserId}
                      onChange={(e) => setReassignTargetUserId(e.target.value)}
                      className="w-full rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground"
                    >
                      <option value="">Select member...</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} · {u.role.replace("_", " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3">
                  {reassignSuccessMsg && (
                    <span className="text-xs font-semibold text-emerald-500">
                      {reassignSuccessMsg}
                    </span>
                  )}
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleReassignTaskAction}
                    className="text-xs h-7.5 gap-1.5"
                  >
                    <ArrowRightLeft className="size-3.5" />
                    <span>Reassign</span>
                  </Button>
                </div>
              </div>

              <div className="rounded-xl border border-border overflow-hidden">
                <div className="max-h-72 overflow-y-auto divide-y divide-border">
                  {tasks.slice(0, 20).map((task) => {
                    const assignee = users.find((u) => u.id === task.assigneeId);
                    return (
                      <div
                        key={task.id}
                        className="flex items-center justify-between p-2.5 hover:bg-muted/30 transition text-xs"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted">
                            {task.taskNumber}
                          </span>
                          <span className="font-medium text-foreground truncate max-w-[280px]">
                            {task.title}
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground text-[11px]">
                            {assignee?.name || "Unassigned"}
                          </span>
                          <button
                            type="button"
                            onClick={() => setReassignSelectedTaskId(task.id)}
                            className="text-primary hover:underline text-[11px] font-semibold cursor-pointer"
                          >
                            Select
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
