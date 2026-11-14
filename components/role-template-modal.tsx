"use client";

import React, { useState } from "react";
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
  ChevronRight,
  ChevronDown,
  ArrowRightLeft,
  Clock,
  CheckSquare,
  AlertCircle,
  Copy,
} from "lucide-react";
import { useTasks } from "@/lib/store";
import { RoleTemplate, Role, TaskStatus, ParentColumnDef, SubColumnDef } from "@/lib/types";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

const ROLE_OPTIONS: { role: Role | "general"; label: string; icon: any; color: string }[] = [
  { role: "developer", label: "Full-Stack Developer", icon: Code2, color: "text-blue-400 bg-blue-500/10 border-blue-500/30" },
  { role: "content_creator", label: "Content Creator", icon: Clapperboard, color: "text-pink-400 bg-pink-500/10 border-pink-500/30" },
  { role: "editor", label: "Video Editor", icon: Video, color: "text-amber-400 bg-amber-500/10 border-amber-500/30" },
  { role: "media_buyer", label: "Media Buyer", icon: TrendingUp, color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30" },
  { role: "general", label: "General Operations", icon: Briefcase, color: "text-indigo-400 bg-indigo-500/10 border-indigo-500/30" },
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
    reassignTask,
    users,
    tasks,
    currentUser,
    isManagerOrAdmin,
  } = useTasks();

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(
    activeTemplateId || templates[0]?.id || "tpl-developer"
  );
  const [activeTab, setActiveTab] = useState<"templates" | "builder" | "reassign">("templates");
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<RoleTemplate | null>(null);

  // Form state for new / edited template
  const [formName, setFormName] = useState("");
  const [formRole, setFormRole] = useState<Role | "general">("developer");
  const [formUserId, setFormUserId] = useState<string>("");
  const [formDesc, setFormDesc] = useState("");
  const [formParentCols, setFormParentCols] = useState<ParentColumnDef[]>([]);

  // Apply template state
  const [applyUserId, setApplyUserId] = useState<string>("");
  const [applyDate, setApplyDate] = useState<string>("");
  const [applySuccessMessage, setApplySuccessMessage] = useState<string>("");

  // Reassignment state
  const [reassignSelectedTaskId, setReassignSelectedTaskId] = useState<string>("");
  const [reassignTargetUserId, setReassignTargetUserId] = useState<string>("");
  const [reassignRole, setReassignRole] = useState<string>("all");
  const [reassignSuccessMsg, setReassignSuccessMsg] = useState<string>("");

  // New subcolumn inline input state
  const [addingSubColParentId, setAddingSubColParentId] = useState<TaskStatus | null>(null);
  const [newSubColLabel, setNewSubColLabel] = useState("");
  const [newSubColDesc, setNewSubColDesc] = useState("");
  const [newSubColUnits, setNewSubColUnits] = useState(1);
  const [newSubColSLA, setNewSubColSLA] = useState(24);
  const [newSubColChecklist, setNewSubColChecklist] = useState("");

  const currentTpl = templates.find((t) => t.id === selectedTemplateId) || templates[0];

  const handleStartNewTemplate = () => {
    setFormName("New Custom Role Template");
    setFormRole("developer");
    setFormUserId("");
    setFormDesc("Custom workflow tailored with parent stages and role-specific sub-columns");
    setFormParentCols(
      PARENT_COLUMNS_PRESET.map((p) => ({
        id: p.id,
        label: p.label,
        subColumns: [],
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
    setFormParentCols(JSON.parse(JSON.stringify(tpl.parentColumns)));
    setEditingTemplate(tpl);
    setIsCreatingNew(false);
    setActiveTab("builder");
  };

  const handleSaveBuilder = async () => {
    if (!formName.trim()) {
      alert("Please provide a template name");
      return;
    }

    if (isCreatingNew) {
      const created = await createRoleTemplate({
        name: formName.trim(),
        role: formRole,
        userId: formUserId || undefined,
        description: formDesc.trim(),
        parentColumns: formParentCols,
        isDefault: false,
      });
      if (created) {
        setSelectedTemplateId(created.id);
        setActiveTemplateId(created.id);
        setActiveTab("templates");
      }
    } else if (editingTemplate) {
      const updated = await updateRoleTemplate(editingTemplate.id, {
        name: formName.trim(),
        role: formRole,
        userId: formUserId || undefined,
        description: formDesc.trim(),
        parentColumns: formParentCols,
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
      prev.map((col) => {
        if (col.id === parentId) {
          return {
            ...col,
            subColumns: [...col.subColumns, newSub],
          };
        }
        return col;
      })
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
      prev.map((col) => {
        if (col.id === parentId) {
          return {
            ...col,
            subColumns: col.subColumns.filter((s) => s.id !== subId),
          };
        }
        return col;
      })
    );
  };

  const handleApplyTemplate = async () => {
    if (!applyUserId) {
      alert("Please select a user to apply this template to.");
      return;
    }
    const tplToApply = currentTpl;
    if (!tplToApply) return;

    setApplySuccessMessage("Applying template and generating tasks...");
    await applyTemplateToUser(tplToApply.id, applyUserId, applyDate || undefined);
    const assignedUser = users.find((u) => u.id === applyUserId);
    setApplySuccessMessage(
      `✓ Successfully generated all template workflow tasks for ${assignedUser?.name || "User"}!`
    );
    setTimeout(() => setApplySuccessMessage(""), 4000);
  };

  const handleReassignTaskAction = async () => {
    if (!reassignSelectedTaskId || !reassignTargetUserId) {
      alert("Please choose a task and a target user.");
      return;
    }
    await reassignTask(reassignSelectedTaskId, reassignTargetUserId);
    const targetUser = users.find((u) => u.id === reassignTargetUserId);
    setReassignSuccessMsg(`✓ Task reassigned to ${targetUser?.name || "member"}!`);
    setTimeout(() => setReassignSuccessMsg(""), 3500);
  };

  const effectiveIsOpen = isOpen !== undefined ? isOpen : storeIsOpen;
  const handleCloseModal = () => {
    if (onClose) onClose();
    setIsRoleTemplateModalOpen(false);
  };

  if (!effectiveIsOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-150">
      <div className="relative flex flex-col w-full max-w-5xl h-[88vh] max-h-[820px] rounded-2xl border border-border bg-card text-card-foreground shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Layers className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-foreground">
                  Role & User Workflow Templates
                </h2>
                <span className="rounded-full bg-primary/15 text-primary text-[10px] font-semibold uppercase px-2 py-0.5 border border-primary/25">
                  Admin System
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Manage parent workflow stages and role-specific sub-columns (e.g. Developer, Content Creator) to assign and reassign tasks seamlessly.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCloseModal}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center justify-between px-6 border-b border-border bg-card">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("templates")}
              className={cn(
                "py-3 px-3.5 text-xs font-semibold border-b-2 transition cursor-pointer flex items-center gap-2",
                activeTab === "templates"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Sparkles className="size-3.5" />
              <span>Explore Templates ({templates.length})</span>
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
                "py-3 px-3.5 text-xs font-semibold border-b-2 transition cursor-pointer flex items-center gap-2",
                activeTab === "builder"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <Edit2 className="size-3.5" />
              <span>{isCreatingNew ? "Create New Template" : editingTemplate ? `Edit: ${editingTemplate.name}` : "Template Builder"}</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("reassign")}
              className={cn(
                "py-3 px-3.5 text-xs font-semibold border-b-2 transition cursor-pointer flex items-center gap-2",
                activeTab === "reassign"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <ArrowRightLeft className="size-3.5" />
              <span>Assign & Reassign Tasks</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleStartNewTemplate}
              className="text-xs h-7.5 gap-1.5"
            >
              <Plus className="size-3.5 text-primary" />
              <span>New Template</span>
            </Button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 scrollbar-thin">
          {/* TAB 1: EXPLORE TEMPLATES */}
          {activeTab === "templates" && (
            <div className="space-y-6">
              {/* Role Cards Selector */}
              <div>
                <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  Available Role & User Workflows
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {templates.map((tpl) => {
                    const isSelected = selectedTemplateId === tpl.id;
                    const isActiveOnBoard = activeTemplateId === tpl.id;
                    const roleBadge = ROLE_OPTIONS.find((r) => r.role === tpl.role) || ROLE_OPTIONS[0];
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
                          "flex flex-col p-4 rounded-xl border transition-all duration-150 cursor-pointer relative",
                          isSelected
                            ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-md"
                            : "border-border bg-card/60 hover:bg-muted/40 hover:border-border/90"
                        )}
                      >
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2">
                            <div className={cn("p-1.5 rounded-lg border", roleBadge.color)}>
                              <Icon className="size-4" />
                            </div>
                            <span className="text-xs font-bold text-foreground">
                              {tpl.name}
                            </span>
                          </div>
                          {isActiveOnBoard && (
                            <span className="rounded-full bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 text-[9px] font-bold px-2 py-0.2">
                              Active Board
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-muted-foreground line-clamp-2 mb-3">
                          {tpl.description}
                        </p>

                        <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/50 pt-2.5 mt-auto">
                          <span className="font-mono">
                            {tpl.parentColumns.length} Parent · {totalSubCols} Sub-columns
                          </span>
                          <span className="capitalize font-medium text-foreground/80">
                            {tpl.role.replace("_", " ")}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Template Detailed Preview & Quick Actions */}
              {currentTpl && (
                <div className="rounded-xl border border-border bg-card/90 p-5 shadow-xs space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base font-bold text-foreground">
                          {currentTpl.name}
                        </h3>
                        <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-muted border border-border">
                          {currentTpl.role.replace("_", " ")}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {currentTpl.description}
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        variant={activeTemplateId === currentTpl.id ? "primary" : "secondary"}
                        size="sm"
                        onClick={() => {
                          if (activeTemplateId === currentTpl.id) {
                            setActiveTemplateId(null);
                          } else {
                            setActiveTemplateId(currentTpl.id);
                          }
                        }}
                        className="text-xs gap-1.5"
                      >
                        <CheckCircle2 className="size-3.5" />
                        <span>
                          {activeTemplateId === currentTpl.id
                            ? "Active on Board"
                            : "Set as Active Board Workflow"}
                        </span>
                      </Button>

                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleEditTemplate(currentTpl)}
                        className="text-xs gap-1.5"
                      >
                        <Edit2 className="size-3.5" />
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
                          className="text-xs text-destructive hover:bg-destructive/10"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Visual Parent & Sub-Columns Architecture */}
                  <div>
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                      Workflow Pipeline Structure (Parent & Sub-columns)
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 items-start">
                      {currentTpl.parentColumns.map((parent) => (
                        <div
                          key={parent.id}
                          className="rounded-xl border border-border/80 bg-muted/20 p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between pb-1.5 border-b border-border/60">
                            <span className="text-xs font-bold text-foreground">
                              {parent.label}
                            </span>
                            <span className="text-[10px] font-mono text-muted-foreground">
                              {parent.subColumns.length} stages
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            {parent.subColumns.map((sub) => (
                              <div
                                key={sub.id}
                                className="p-2 rounded-lg bg-card border border-border/60 shadow-2xs hover:border-primary/40 transition"
                              >
                                <div className="text-xs font-semibold text-foreground">
                                  {sub.label}
                                </div>
                                {sub.description && (
                                  <div className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                                    {sub.description}
                                  </div>
                                )}
                                <div className="flex items-center justify-between mt-1 pt-1 border-t border-border/40 text-[9px] text-muted-foreground">
                                  <span className="flex items-center gap-1">
                                    <Clock className="size-2.5 text-primary" />
                                    <span>{sub.slaHours || 24}h SLA</span>
                                  </span>
                                  <span>{sub.defaultTargetQuantity || 1} units</span>
                                </div>
                              </div>
                            ))}

                            {parent.subColumns.length === 0 && (
                              <div className="text-[11px] text-muted-foreground/60 italic text-center py-2">
                                No sub-columns configured
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* 1-Click Apply Section */}
                  <div className="border-t border-border pt-4">
                    <div className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                      <UserCheck className="size-4 text-primary" />
                      <span>Instantiate & Apply Template to User</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <select
                        value={applyUserId}
                        onChange={(e) => setApplyUserId(e.target.value)}
                        className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary"
                      >
                        <option value="">Select team member...</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.role.replace("_", " ")})
                          </option>
                        ))}
                      </select>

                      <input
                        type="date"
                        value={applyDate}
                        onChange={(e) => setApplyDate(e.target.value)}
                        className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs text-foreground focus:ring-1 focus:ring-primary"
                        title="Target Date (defaults to today)"
                      />

                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleApplyTemplate}
                        className="text-xs gap-1.5"
                      >
                        <Sparkles className="size-3.5" />
                        <span>Generate Template Tasks</span>
                      </Button>

                      {applySuccessMessage && (
                        <span className="text-xs font-semibold text-emerald-500 animate-in fade-in">
                          {applySuccessMessage}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TEMPLATE BUILDER */}
          {activeTab === "builder" && (
            <div className="space-y-6 max-w-4xl mx-auto">
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div>
                  <h3 className="text-base font-bold text-foreground">
                    {isCreatingNew ? "Create New Workflow Template" : `Edit: ${formName}`}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Define the parent workflow stages and customize role-specific sub-columns with default SLA hours, checklists, and units.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => setActiveTab("templates")}
                    className="text-xs"
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSaveBuilder}
                    className="text-xs gap-1.5"
                  >
                    <CheckCircle2 className="size-3.5" />
                    <span>Save Template</span>
                  </Button>
                </div>
              </div>

              {/* Template Metadata */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Template Name
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Senior Frontend Engineer Workflow"
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Target Role
                  </label>
                  <select
                    value={formRole}
                    onChange={(e) => setFormRole(e.target.value as any)}
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.role} value={r.role}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold text-foreground mb-1">
                    Description & Objectives
                  </label>
                  <textarea
                    rows={2}
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    placeholder="Describe how tasks flow through this pipeline..."
                    className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Parent & Sub-Columns Builder */}
              <div className="space-y-4">
                <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Parent Columns & Role Sub-Columns
                </div>

                <div className="space-y-4">
                  {formParentCols.map((parent) => (
                    <div
                      key={parent.id}
                      className="rounded-xl border border-border bg-card p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="size-2.5 rounded-full bg-primary" />
                          <span className="text-xs font-bold text-foreground">
                            {parent.label}
                          </span>
                          <span className="text-[10px] font-mono text-muted-foreground">
                            ({parent.subColumns.length} sub-columns)
                          </span>
                        </div>

                        <button
                          type="button"
                          onClick={() => setAddingSubColParentId(parent.id)}
                          className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:bg-primary/10 px-2.5 py-1 rounded-md transition cursor-pointer"
                        >
                          <Plus className="size-3" />
                          <span>Add Sub-Column</span>
                        </button>
                      </div>

                      {/* Sub-columns listing */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                        {parent.subColumns.map((sub) => (
                          <div
                            key={sub.id}
                            className="p-3 rounded-lg border border-border bg-muted/20 relative group"
                          >
                            <div className="flex items-start justify-between">
                              <span className="text-xs font-semibold text-foreground">
                                {sub.label}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleDeleteSubColumn(parent.id, sub.id)}
                                className="text-muted-foreground hover:text-destructive opacity-40 group-hover:opacity-100 transition p-0.5"
                                title="Delete sub-column"
                              >
                                <Trash2 className="size-3" />
                              </button>
                            </div>
                            {sub.description && (
                              <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                                {sub.description}
                              </p>
                            )}
                            <div className="flex items-center gap-3 mt-2 pt-2 border-t border-border/40 text-[10px] text-muted-foreground">
                              <span>Target: {sub.defaultTargetQuantity || 1} units</span>
                              <span>SLA: {sub.slaHours || 24}h</span>
                              {sub.defaultChecklist && (
                                <span>{sub.defaultChecklist.length} checklist items</span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Add subcolumn form inline */}
                      {addingSubColParentId === parent.id && (
                        <div className="p-3 rounded-lg border border-dashed border-primary/50 bg-primary/5 space-y-3">
                          <div className="text-xs font-bold text-foreground">
                            New Sub-Column under "{parent.label}"
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <input
                              type="text"
                              value={newSubColLabel}
                              onChange={(e) => setNewSubColLabel(e.target.value)}
                              placeholder="Sub-column label (e.g. Code Review)"
                              className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-foreground"
                            />
                            <input
                              type="number"
                              min={1}
                              value={newSubColUnits}
                              onChange={(e) => setNewSubColUnits(Number(e.target.value) || 1)}
                              placeholder="Target Units"
                              className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-foreground"
                            />
                            <input
                              type="number"
                              min={1}
                              value={newSubColSLA}
                              onChange={(e) => setNewSubColSLA(Number(e.target.value) || 24)}
                              placeholder="SLA (hours)"
                              className="rounded-lg border border-border bg-card px-2.5 py-1.5 text-xs text-foreground"
                            />
                          </div>
                          <textarea
                            rows={2}
                            value={newSubColChecklist}
                            onChange={(e) => setNewSubColChecklist(e.target.value)}
                            placeholder="Default checklist steps (1 per line)..."
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
                              Confirm Sub-Column
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: ASSIGN & REASSIGN TASKS HUB */}
          {activeTab === "reassign" && (
            <div className="space-y-6 max-w-4xl mx-auto">
              <div>
                <h3 className="text-base font-bold text-foreground">
                  Task Assignment & Reassignment Center
                </h3>
                <p className="text-xs text-muted-foreground">
                  As an admin, reassign tasks across team roles (e.g. from Content Creator to Video Editor, or to Developer) to ensure optimal team bandwidth and delivery flow.
                </p>
              </div>

              {/* Quick Reassign Action Card */}
              <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-xs">
                <div className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Reassign Task to New Role or Member
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      1. Select Task to Reassign
                    </label>
                    <select
                      value={reassignSelectedTaskId}
                      onChange={(e) => setReassignSelectedTaskId(e.target.value)}
                      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
                    >
                      <option value="">Choose task...</option>
                      {tasks.map((t) => {
                        const assignee = users.find((u) => u.id === t.assigneeId);
                        return (
                          <option key={t.id} value={t.id}>
                            {t.taskNumber} — {t.title} (Currently: {assignee?.name || "Unassigned"} | {t.status})
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-foreground mb-1">
                      2. New Assignee & Role
                    </label>
                    <select
                      value={reassignTargetUserId}
                      onChange={(e) => setReassignTargetUserId(e.target.value)}
                      className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground focus:ring-1 focus:ring-primary"
                    >
                      <option value="">Select new assignee...</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name} — {u.role.replace("_", " ")} ({u.department})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs text-muted-foreground">
                    Reassigning will notify the member and update all active workflow swimlanes instantly.
                  </span>
                  <div className="flex items-center gap-3">
                    {reassignSuccessMsg && (
                      <span className="text-xs font-semibold text-emerald-500 animate-in fade-in">
                        {reassignSuccessMsg}
                      </span>
                    )}
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleReassignTaskAction}
                      className="text-xs gap-1.5"
                    >
                      <ArrowRightLeft className="size-3.5" />
                      <span>Reassign Task</span>
                    </Button>
                  </div>
                </div>
              </div>

              {/* Quick Tasks Overview by Role */}
              <div>
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-2">
                  Active Tasks Grouped by Current Owner
                </div>
                <div className="rounded-xl border border-border overflow-hidden">
                  <div className="max-h-72 overflow-y-auto divide-y divide-border">
                    {tasks.slice(0, 20).map((task) => {
                      const assignee = users.find((u) => u.id === task.assigneeId);
                      return (
                        <div
                          key={task.id}
                          className="flex items-center justify-between p-3 hover:bg-muted/30 transition text-xs"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded bg-muted">
                              {task.taskNumber}
                            </span>
                            <span className="font-medium text-foreground truncate max-w-[280px]">
                              {task.title}
                            </span>
                            <span className="text-[10px] text-muted-foreground uppercase font-mono px-1.5 py-0.2 rounded bg-muted/60">
                              {task.status}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">
                              {assignee?.name || "Unassigned"} ({assignee?.role.replace("_", " ") || "Member"})
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                setReassignSelectedTaskId(task.id);
                                window.scrollTo({ top: 0, behavior: "smooth" });
                              }}
                              className="text-primary hover:underline text-[11px] font-semibold cursor-pointer"
                            >
                              Quick Reassign
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
