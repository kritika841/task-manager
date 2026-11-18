"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Plus,
  Trash2,
  AlertCircle,
  Link as LinkIcon,
  UserCheck,
  Sparkles,
  Layers,
  Split,
} from "lucide-react";
import { useTasks } from "@/lib/store";
import {
  TaskPriority,
  TaskStatus,
  DeliverableAsset,
  Subtask,
  Role,
} from "@/lib/types";
import {
  dateInTargetTimeZone,
  taskOptionsForRole,
  isCanonicalAdflowTask,
} from "@/lib/supabase";
import { Button } from "./ui/button";
import { Input, Textarea, Select } from "./ui/field";
import { cn } from "@/lib/utils";

export function TaskCreateModal() {
  const {
    isCreateModalOpen,
    setIsCreateModalOpen,
    createModalAssigneeId,
    createModalStatus,
    createTask,
    templates,
    applyTemplateToUser,
    users,
    currentUser,
    currentUserId,
    isManagerOrAdmin,
    getMemberCapacity,
  } = useTasks();

  const today = dateInTargetTimeZone();

  const [title, setTitle] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [status, setStatus] = useState<TaskStatus>(createModalStatus || "todo");
  const [assigneeId, setAssigneeId] = useState(
    createModalAssigneeId || currentUserId || ""
  );
  const [targetQuantity, setTargetQuantity] = useState<number>(1);
  const [dueDate, setDueDate] = useState(today);
  const [dueTime, setDueTime] = useState("");
  const [estimatedHours, setEstimatedHours] = useState<number | undefined>(
    undefined
  );
  const [deliverableUrl, setDeliverableUrl] = useState("");
  const [deliverableAsset, setDeliverableAsset] = useState<
    DeliverableAsset | undefined
  >(undefined);
  const [subColumnId, setSubColumnId] = useState<string | undefined>(undefined);
  const [templateRole, setTemplateRole] = useState<Role | undefined>(undefined);
  const [checklistItems, setChecklistItems] = useState<string[]>([]);
  const [newChecklistInput, setNewChecklistInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewCreativeIds, setPreviewCreativeIds] = useState<string[]>([]);

  useEffect(() => {
    if (isCreateModalOpen) {
      if (createModalAssigneeId) {
        setAssigneeId(createModalAssigneeId);
      } else if (currentUserId) {
        setAssigneeId(currentUserId);
      } else if (users.length > 0) {
        setAssigneeId(users[0].id);
      }
      setStatus(createModalStatus || "todo");
    }
  }, [
    isCreateModalOpen,
    createModalAssigneeId,
    createModalStatus,
    currentUserId,
    users,
  ]);

  const selectedAssignee = useMemo(
    () => users.find((u) => u.id === assigneeId) || currentUser,
    [users, assigneeId, currentUser]
  );

  // Strictly match templates belonging ONLY to the selected assignee's role (or user-specific override)
  const matchingRoleTemplates = useMemo(() => {
    if (!selectedAssignee) return [];
    return templates.filter(
      (t) =>
        t.userId === selectedAssignee.id || t.role === selectedAssignee.role
    );
  }, [templates, selectedAssignee]);

  const primaryRoleTemplate = matchingRoleTemplates[0] || null;

  // Extract ONLY the tasks/stages inside the selected assignee's role template(s)
  const assigneeRoleStages = useMemo(() => {
    const stages: {
      key: string;
      templateId: string;
      templateName: string;
      role: Role | "general";
      parentStatus: TaskStatus;
      parentLabel: string;
      subColId: string;
      label: string;
      description?: string;
      units: number;
      checklist: string[];
    }[] = [];

    for (const tpl of matchingRoleTemplates) {
      for (const parent of tpl.parentColumns) {
        for (const sub of parent.subColumns) {
          stages.push({
            key: `stage:${tpl.id}:${sub.id}`,
            templateId: tpl.id,
            templateName: tpl.name,
            role: tpl.role,
            parentStatus: parent.id,
            parentLabel: parent.label,
            subColId: sub.id,
            label: sub.label,
            description: sub.description,
            units: sub.defaultTargetQuantity || 1,
            checklist: sub.defaultChecklist || [],
          });
        }
      }
    }
    return stages;
  }, [matchingRoleTemplates]);

  const canonicalRoleTasks = useMemo(() => {
    if (!selectedAssignee) return [];
    return taskOptionsForRole(selectedAssignee.role);
  }, [selectedAssignee]);

  const unitsNum = Math.max(1, Number(targetQuantity) || 1);
  const willGenerateCreativeIds = Boolean(
    selectedAssignee?.role === "content_creator" ||
      isCanonicalAdflowTask(title)
  );

  useEffect(() => {
    if (!isCreateModalOpen || !assigneeId || !willGenerateCreativeIds) {
      setPreviewCreativeIds([]);
      return;
    }
    let cancelled = false;
    fetch(
      `/api/adflow/creative-ids?creatorId=${encodeURIComponent(
        assigneeId
      )}&count=${unitsNum}`
    )
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data?.nextSequentialIds) {
          setPreviewCreativeIds(data.nextSequentialIds);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isCreateModalOpen, assigneeId, unitsNum, willGenerateCreativeIds]);

  if (!isCreateModalOpen) return null;

  const isSelfTask = Boolean(currentUserId && assigneeId === currentUserId);
  const assigneeCapacity = assigneeId
    ? getMemberCapacity(assigneeId)
    : { max: 6, current: 0, percent: 0, isOverAllocated: false };
  const projectedTotal = (assigneeCapacity.current || 0) + unitsNum;
  const willOverAllocate = projectedTotal > assigneeCapacity.max;

  const handlePresetSelect = (val: string) => {
    setSelectedPreset(val);
    if (!val || val === "__custom__") {
      if (val === "__custom__") setTitle("");
      setSubColumnId(undefined);
      setTemplateRole(undefined);
      return;
    }

    if (val.startsWith("canonical:")) {
      const taskTitle = val.replace(/^canonical:/, "");
      setTitle(taskTitle);
      setSubColumnId(undefined);
      setTemplateRole(selectedAssignee?.role);
      return;
    }

    if (val.startsWith("stage:")) {
      const found = assigneeRoleStages.find((s) => s.key === val);
      if (found) {
        setTitle(found.label);
        if (found.description) setDescription(found.description);
        setStatus(found.parentStatus);
        setTargetQuantity(found.units);
        setSubColumnId(found.subColId);
        setTemplateRole(found.role !== "general" ? found.role : undefined);
        if (found.checklist.length > 0) {
          setChecklistItems(found.checklist);
        }
      }
    }
  };

  const handleAddChecklistItem = () => {
    const trimmed = newChecklistInput.trim();
    if (!trimmed) return;
    setChecklistItems((prev) => [...prev, trimmed]);
    setNewChecklistInput("");
  };

  const handleApplyFullRoleTemplate = async () => {
    if (!primaryRoleTemplate) return;
    const targetUser = assigneeId || currentUserId;
    if (!targetUser) return;
    setIsSubmitting(true);
    await applyTemplateToUser(
      primaryRoleTemplate.id,
      targetUser,
      dueDate || today
    );
    setIsSubmitting(false);
    setIsCreateModalOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    const targetUser = assigneeId || currentUserId;
    const customSubtasks: Subtask[] | undefined =
      checklistItems.length > 0
        ? checklistItems.map((item, idx) => ({
            id: `csub-${Date.now()}-${idx}`,
            title: item,
            completed: false,
            assignedTo: targetUser,
            sortOrder: idx + 1,
            isCustom: true,
          }))
        : undefined;

    await createTask({
      title: title.trim(),
      description: description.trim(),
      priority,
      status,
      assigneeId: targetUser,
      dueDate: dueDate || today,
      dueTime: dueTime || undefined,
      estimatedHours: estimatedHours || undefined,
      targetQuantity: unitsNum,
      deliverableUrl:
        deliverableUrl.trim() || deliverableAsset?.url || undefined,
      deliverableAsset,
      subColumnId,
      parentColumnId: status,
      templateRole,
      customSubtasks,
    });

    setIsSubmitting(false);
    setTitle("");
    setSelectedPreset("");
    setDescription("");
    setTargetQuantity(1);
    setDueTime("");
    setEstimatedHours(undefined);
    setDeliverableUrl("");
    setDeliverableAsset(undefined);
    setSubColumnId(undefined);
    setTemplateRole(undefined);
    setChecklistItems([]);
    setIsCreateModalOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-foreground/30 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={() => setIsCreateModalOpen(false)}
    >
      <div className="flex min-h-full items-center justify-center p-4 sm:p-6">
        <div
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-2xl rounded-2xl border border-border bg-card p-6 sm:p-7 shadow-float transition-all"
        >
          {/* Modal Header */}
          <div className="flex items-center justify-between border-b border-border pb-4 mb-5">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-bold text-foreground tracking-tight">
                  {isSelfTask ? "Create New Self Task" : "Assign New Task"}
                </h2>
                <span
                  className={cn(
                    "text-xs font-mono px-2.5 py-0.5 rounded-full border",
                    willOverAllocate
                      ? "border-warning/40 bg-warning/10 text-warning font-semibold"
                      : "border-border bg-muted text-muted-foreground"
                  )}
                >
                  {willOverAllocate ? (
                    <span className="inline-flex items-center gap-1">
                      <AlertCircle className="size-3.5" />
                      {projectedTotal}/{assigneeCapacity.max} units
                    </span>
                  ) : (
                    `${assigneeCapacity.current}/${assigneeCapacity.max} daily units`
                  )}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Configure task details, role template stage, and target units.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="size-8 rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition cursor-pointer"
              aria-label="Close modal"
            >
              <X className="size-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 text-sm">
            {/* Row 1: Assignee & Role Template Stage */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Assignee */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-sm font-semibold text-foreground">
                    Assignee
                  </label>
                  {isManagerOrAdmin && currentUserId && (
                    <button
                      type="button"
                      onClick={() => {
                        setAssigneeId(currentUserId);
                        setSelectedPreset("");
                      }}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-semibold transition cursor-pointer border",
                        isSelfTask
                          ? "bg-primary/15 text-primary border-primary/30"
                          : "bg-muted/60 text-muted-foreground hover:text-foreground border-border"
                      )}
                    >
                      <UserCheck className="size-3" />
                      <span>Assign to Me</span>
                    </button>
                  )}
                </div>

                <Select
                  value={assigneeId}
                  disabled={!isManagerOrAdmin}
                  onChange={(e) => {
                    setAssigneeId(e.target.value);
                    setSelectedPreset("");
                  }}
                  className="w-full text-sm h-10 bg-background"
                  required
                >
                  {users.map((u) => {
                    const isMe = u.id === currentUserId;
                    const cap = getMemberCapacity(u.id);
                    return (
                      <option key={u.id} value={u.id}>
                        {u.name} {isMe ? "(Me)" : ""} —{" "}
                        {u.role.replace("_", " ")} ({cap.current}/{cap.max}u)
                      </option>
                    );
                  })}
                </Select>
              </div>

              {/* Strictly Role-Scoped Template Task Selector */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                    <Layers className="size-3.5 text-primary" />
                    <span>
                      {selectedAssignee
                        ? `${selectedAssignee.role.replace("_", " ")} Template Tasks`
                        : "Role Template Tasks"}
                    </span>
                  </label>
                  {isManagerOrAdmin && primaryRoleTemplate && assigneeRoleStages.length > 0 && (
                    <button
                      type="button"
                      onClick={handleApplyFullRoleTemplate}
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline cursor-pointer"
                      title={`Create all workflow stages from ${primaryRoleTemplate.name}`}
                    >
                      <Sparkles className="size-3" />
                      <span>Apply All</span>
                    </button>
                  )}
                </div>

                <Select
                  value={selectedPreset}
                  onChange={(e) => handlePresetSelect(e.target.value)}
                  className="w-full text-sm h-10 bg-background"
                >
                  <option value="">
                    {assigneeRoleStages.length > 0 || canonicalRoleTasks.length > 0
                      ? `Select ${selectedAssignee?.role.replace("_", " ")} task...`
                      : `Custom task`}
                  </option>
                  {assigneeRoleStages.length > 0 && (
                    <optgroup
                      label={`${primaryRoleTemplate?.name || selectedAssignee?.role.replace("_", " ")} Template Tasks`}
                    >
                      {assigneeRoleStages.map((s) => (
                        <option key={s.key} value={s.key}>
                          [{s.parentLabel}] {s.label} ({s.units}u)
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {canonicalRoleTasks.length > 0 && (
                    <optgroup
                      label={`${selectedAssignee?.role.replace("_", " ")} Pipeline Tasks`}
                    >
                      {canonicalRoleTasks.map((taskLabel) => (
                        <option key={`canonical:${taskLabel}`} value={`canonical:${taskLabel}`}>
                          {taskLabel}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  <option value="__custom__">Write custom task title...</option>
                </Select>
              </div>
            </div>

            {/* Row 2: Task Title */}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">
                Task Title <span className="text-destructive">*</span>
              </label>
              <Input
                required
                placeholder="What needs to get done?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-sm h-10 bg-background"
              />
            </div>

            {/* Row 3: Units (with Multi-Task Split notice), Due Date, Due Time, Est. Hours */}
            <div className="space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">
                    Units
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={targetQuantity}
                    onChange={(e) =>
                      setTargetQuantity(Math.max(1, Number(e.target.value) || 1))
                    }
                    className="text-sm h-10 bg-background font-mono"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">
                    Due Date
                  </label>
                  <Input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className="text-sm h-10 bg-background"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">
                    Time
                  </label>
                  <Input
                    type="time"
                    value={dueTime}
                    onChange={(e) => setDueTime(e.target.value)}
                    className="text-sm h-10 bg-background"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-foreground mb-1.5">
                    Est. Hours
                  </label>
                  <Input
                    type="number"
                    step="0.5"
                    min="0"
                    placeholder="2.0"
                    value={estimatedHours ?? ""}
                    onChange={(e) =>
                      setEstimatedHours(
                        e.target.value ? parseFloat(e.target.value) : undefined
                      )
                    }
                    className="text-sm h-10 bg-background"
                  />
                </div>
              </div>

              {unitsNum > 1 && (
                <div className="flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/5 px-3.5 py-2 text-xs font-medium text-primary">
                  <Split className="size-3.5 shrink-0" />
                  <span>
                    Adding <strong>{unitsNum} units</strong> will automatically
                    split into <strong>{unitsNum} individual tasks</strong> (
                    {title.trim() ? `"${title.trim()} (1/${unitsNum})"` : `1/${unitsNum}`}{" "}
                    to {`(${unitsNum}/${unitsNum})`}) for{" "}
                    {selectedAssignee?.name || "the user"}.
                  </span>
                </div>
              )}

              {previewCreativeIds.length > 0 && (
                <div className="flex items-center justify-between gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Sparkles className="size-3.5 shrink-0" />
                    <span>
                      AdFlow Creative {previewCreativeIds.length > 1 ? "IDs" : "ID"} Generated:
                    </span>
                    <div className="flex items-center gap-1 flex-wrap">
                      {previewCreativeIds.map((cid) => (
                        <span
                          key={cid}
                          className="font-mono font-bold px-2 py-0.5 rounded bg-emerald-500/20 border border-emerald-500/30 text-[11px]"
                        >
                          {cid}
                        </span>
                      ))}
                    </div>
                  </div>
                  <span className="text-[10px] opacity-80 shrink-0">
                    Synced with AdFlow
                  </span>
                </div>
              )}
            </div>

            {/* Row 4: Priority & Initial Stage */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">
                  Priority
                </label>
                <Select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  className="w-full text-sm h-10 bg-background"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </Select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">
                  Initial Stage
                </label>
                <Select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  className="w-full text-sm h-10 bg-background"
                >
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="in_review">In Review</option>
                  <option value="completed">Done</option>
                  <option value="backlog">Backlog</option>
                </Select>
              </div>
            </div>

            {/* Row 5: Checklist Steps & Deliverable Link */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-foreground mb-1.5">
                  Checklist Steps{" "}
                  {checklistItems.length > 0 && `(${checklistItems.length})`}
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    placeholder="Add a step & press Enter..."
                    value={newChecklistInput}
                    onChange={(e) => setNewChecklistInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddChecklistItem();
                      }
                    }}
                    className="text-sm h-10 bg-background flex-1"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleAddChecklistItem}
                    className="h-10 px-3 text-sm"
                  >
                    <Plus className="size-4" />
                  </Button>
                </div>
                {checklistItems.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {checklistItems.map((item, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-muted/50 px-2.5 py-1 text-xs text-foreground"
                      >
                        <span>{item}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setChecklistItems((prev) =>
                              prev.filter((_, i) => i !== idx)
                            )
                          }
                          className="text-muted-foreground hover:text-destructive cursor-pointer"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-sm font-semibold text-foreground mb-1.5">
                  <LinkIcon className="size-3.5 text-muted-foreground" />
                  <span>Drive / Deliverable Link</span>
                </label>
                <Input
                  placeholder="https://drive.google.com/..."
                  value={deliverableUrl}
                  onChange={(e) => setDeliverableUrl(e.target.value)}
                  className="text-sm h-10 bg-background"
                />
              </div>
            </div>

            {/* Row 6: Instructions / Brief */}
            <div>
              <label className="block text-sm font-semibold text-foreground mb-1.5">
                Notes & Instructions
              </label>
              <Textarea
                rows={3}
                placeholder="Add brief, references, or deliverable expectations..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="text-sm bg-background"
              />
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-border">
              <Button
                type="button"
                variant="secondary"
                size="md"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-sm h-10 px-4"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="md"
                disabled={isSubmitting || !title.trim()}
                className="text-sm h-10 px-5 shadow-xs"
              >
                {isSubmitting
                  ? "Creating..."
                  : unitsNum > 1
                    ? `Create ${unitsNum} Split Tasks`
                    : isSelfTask
                      ? "Create Self Task"
                      : "Assign Task"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
