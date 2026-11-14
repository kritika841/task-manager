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
} from "lucide-react";
import { useTasks } from "@/lib/store";
import {
  TaskPriority,
  TaskStatus,
  DeliverableAsset,
  Subtask,
  Role,
} from "@/lib/types";
import { dateInTargetTimeZone, taskOptionsForRole } from "@/lib/supabase";
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
    getMemberCapacity,
  } = useTasks();

  const today = dateInTargetTimeZone();

  const [title, setTitle] = useState("");
  const [selectedPreset, setSelectedPreset] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [status, setStatus] = useState<TaskStatus>(createModalStatus || "todo");
  const [assigneeId, setAssigneeId] = useState(createModalAssigneeId || currentUserId || "");
  const [targetQuantity, setTargetQuantity] = useState<number>(1);
  const [dueDate, setDueDate] = useState(today);
  const [dueTime, setDueTime] = useState("");
  const [estimatedHours, setEstimatedHours] = useState<number | undefined>(undefined);
  const [deliverableUrl, setDeliverableUrl] = useState("");
  const [deliverableAsset, setDeliverableAsset] = useState<DeliverableAsset | undefined>(undefined);
  const [subColumnId, setSubColumnId] = useState<string | undefined>(undefined);
  const [templateRole, setTemplateRole] = useState<Role | undefined>(undefined);
  const [checklistItems, setChecklistItems] = useState<string[]>([]);
  const [newChecklistInput, setNewChecklistInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

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
  }, [isCreateModalOpen, createModalAssigneeId, createModalStatus, currentUserId, users]);

  const selectedAssignee = useMemo(
    () => users.find((u) => u.id === assigneeId) || currentUser,
    [users, assigneeId, currentUser]
  );

  const matchingRoleTemplate = useMemo(() => {
    if (!selectedAssignee) return templates[0];
    return (
      templates.find((t) => t.role === selectedAssignee.role) ||
      templates[0]
    );
  }, [templates, selectedAssignee]);

  const templateStages = useMemo(() => {
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

    for (const tpl of templates) {
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
  }, [templates]);

  if (!isCreateModalOpen) return null;

  const isSelfTask = Boolean(currentUserId && assigneeId === currentUserId);
  const roleStandardTasks = taskOptionsForRole(selectedAssignee?.role);
  const assigneeRoleStages = templateStages.filter(
    (s) => s.role === selectedAssignee?.role
  );

  const assigneeCapacity = assigneeId
    ? getMemberCapacity(assigneeId)
    : { max: 6, current: 0, percent: 0, isOverAllocated: false };
  const projectedTotal = (assigneeCapacity.current || 0) + (Number(targetQuantity) || 1);
  const willOverAllocate = projectedTotal > assigneeCapacity.max;

  const handlePresetSelect = (val: string) => {
    setSelectedPreset(val);
    if (!val || val === "__custom__") {
      if (val === "__custom__") setTitle("");
      setSubColumnId(undefined);
      setTemplateRole(undefined);
      return;
    }

    if (val.startsWith("std:")) {
      const taskTitle = val.slice(4);
      setTitle(taskTitle);
      setSubColumnId(undefined);
      setTemplateRole(selectedAssignee?.role);
      return;
    }

    if (val.startsWith("stage:")) {
      const found = templateStages.find((s) => s.key === val);
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
    if (!matchingRoleTemplate) return;
    const targetUser = assigneeId || currentUserId;
    if (!targetUser) return;
    setIsSubmitting(true);
    await applyTemplateToUser(matchingRoleTemplate.id, targetUser, dueDate || today);
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
      targetQuantity: Math.max(1, Number(targetQuantity) || 1),
      deliverableUrl: deliverableUrl.trim() || deliverableAsset?.url || undefined,
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
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div
        className="fixed inset-0 bg-foreground/20 backdrop-blur-xs transition-opacity"
        onClick={() => setIsCreateModalOpen(false)}
      />

      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-float transition-all">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border pb-3 mb-3.5">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold text-foreground">
                {isSelfTask ? "New Self Task" : "Assign Task"}
              </h2>
              <span
                className={cn(
                  "text-[10px] font-mono px-2 py-0.5 rounded-full border",
                  willOverAllocate
                    ? "border-warning/40 bg-warning/10 text-warning font-semibold"
                    : "border-border bg-muted text-muted-foreground"
                )}
              >
                {willOverAllocate ? (
                  <span className="inline-flex items-center gap-1">
                    <AlertCircle className="size-3" />
                    {projectedTotal}/{assigneeCapacity.max} units
                  </span>
                ) : (
                  `${assigneeCapacity.current}/${assigneeCapacity.max} units`
                )}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="size-7 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition"
            >
              <X className="size-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3 text-xs">
            {/* Assignee & Self-Task Quick Bar */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-medium text-foreground">Assignee</label>
                <div className="flex items-center gap-1.5">
                  {currentUserId && (
                    <button
                      type="button"
                      onClick={() => {
                        setAssigneeId(currentUserId);
                        setSelectedPreset("");
                      }}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold transition cursor-pointer border",
                        isSelfTask
                          ? "bg-primary/15 text-primary border-primary/30"
                          : "bg-muted/60 text-muted-foreground hover:text-foreground border-border"
                      )}
                    >
                      <UserCheck className="size-3" />
                      <span>Assign to Me (Self Task)</span>
                    </button>
                  )}
                </div>
              </div>

              <Select
                value={assigneeId}
                onChange={(e) => {
                  setAssigneeId(e.target.value);
                  setSelectedPreset("");
                }}
                className="w-full text-xs h-8.5 bg-card"
                required
              >
                {users.map((u) => {
                  const isMe = u.id === currentUserId;
                  const cap = getMemberCapacity(u.id);
                  return (
                    <option key={u.id} value={u.id}>
                      {u.name} {isMe ? "(Me)" : ""} — {u.role.replace("_", " ")} ({cap.current}/{cap.max}u)
                    </option>
                  );
                })}
              </Select>
            </div>

            {/* Role Template & Task Preset Selector */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="flex items-center gap-1 font-medium text-foreground">
                  <Layers className="size-3 text-primary" />
                  <span>Role Template / Preset</span>
                </label>
                {matchingRoleTemplate && (
                  <button
                    type="button"
                    onClick={handleApplyFullRoleTemplate}
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary hover:underline cursor-pointer"
                    title={`Create all workflow stages from ${matchingRoleTemplate.name}`}
                  >
                    <Sparkles className="size-3" />
                    <span>Apply Full {matchingRoleTemplate.role.replace("_", " ")} Template</span>
                  </button>
                )}
              </div>

              <Select
                value={selectedPreset}
                onChange={(e) => handlePresetSelect(e.target.value)}
                className="w-full text-xs h-8.5 bg-card"
              >
                <option value="">Custom task or choose role template...</option>
                <optgroup label={`Quick Presets (${selectedAssignee?.role.replace("_", " ") || "Role"})`}>
                  {roleStandardTasks.map((t) => (
                    <option key={`std:${t}`} value={`std:${t}`}>
                      {t}
                    </option>
                  ))}
                </optgroup>
                {assigneeRoleStages.length > 0 && (
                  <optgroup label={`${matchingRoleTemplate?.name || "Role"} Stages`}>
                    {assigneeRoleStages.map((s) => (
                      <option key={s.key} value={s.key}>
                        [{s.parentLabel}] {s.label} ({s.units}u)
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="All Role Templates">
                  {templateStages
                    .filter((s) => s.role !== selectedAssignee?.role)
                    .map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.role.replace("_", " ").toUpperCase()}: {s.label}
                      </option>
                    ))}
                </optgroup>
                <option value="__custom__">Custom task...</option>
              </Select>
            </div>

            {/* Title */}
            <div>
              <label className="block font-medium text-foreground mb-1">Task Title *</label>
              <Input
                required
                placeholder="What needs to get done?"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-xs h-8.5 bg-card"
              />
            </div>

            {/* Target Units, Due Date, Due Time, Est Hours */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <label className="block font-medium text-foreground mb-1">Units</label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={targetQuantity}
                  onChange={(e) => setTargetQuantity(Number(e.target.value))}
                  className="text-xs h-8.5 bg-card"
                  required
                />
              </div>

              <div>
                <label className="block font-medium text-foreground mb-1">Due Date</label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="text-xs h-8.5 bg-card"
                  required
                />
              </div>

              <div>
                <label className="block font-medium text-foreground mb-1">Time</label>
                <Input
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  className="text-xs h-8.5 bg-card"
                />
              </div>

              <div>
                <label className="block font-medium text-foreground mb-1">Est. Hrs</label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="2.0"
                  value={estimatedHours ?? ""}
                  onChange={(e) =>
                    setEstimatedHours(e.target.value ? parseFloat(e.target.value) : undefined)
                  }
                  className="text-xs h-8.5 bg-card"
                />
              </div>
            </div>

            {/* Priority & Status */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block font-medium text-foreground mb-1">Priority</label>
                <Select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  className="w-full text-xs h-8.5 bg-card"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </Select>
              </div>

              <div>
                <label className="block font-medium text-foreground mb-1">Status</label>
                <Select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  className="w-full text-xs h-8.5 bg-card"
                >
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="in_review">In Review</option>
                  <option value="completed">Done</option>
                  <option value="backlog">Backlog</option>
                </Select>
              </div>
            </div>

            {/* Checklist Steps (Optional or populated from template) */}
            <div>
              <label className="block font-medium text-foreground mb-1">
                Checklist Steps {checklistItems.length > 0 && `(${checklistItems.length})`}
              </label>
              <div className="flex items-center gap-1.5">
                <Input
                  placeholder="Add step..."
                  value={newChecklistInput}
                  onChange={(e) => setNewChecklistInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddChecklistItem();
                    }
                  }}
                  className="text-xs h-8 bg-card flex-1"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleAddChecklistItem}
                  className="h-8 px-2.5 text-xs"
                >
                  <Plus className="size-3.5" />
                </Button>
              </div>
              {checklistItems.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {checklistItems.map((item, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[11px] text-foreground"
                    >
                      <span>{item}</span>
                      <button
                        type="button"
                        onClick={() =>
                          setChecklistItems((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="size-2.5" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Deliverable Link */}
            <div>
              <label className="flex items-center gap-1.5 font-medium text-foreground mb-1">
                <LinkIcon className="size-3 text-muted-foreground" />
                <span>Drive / Deliverable Link</span>
              </label>
              <Input
                placeholder="https://drive.google.com/..."
                value={deliverableUrl}
                onChange={(e) => setDeliverableUrl(e.target.value)}
                className="text-xs h-8.5 bg-card"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block font-medium text-foreground mb-1">Notes</label>
              <Textarea
                rows={2}
                placeholder="Brief or instructions..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="text-xs bg-card"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2.5 border-t border-border">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsCreateModalOpen(false)}
                className="text-xs h-8"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={isSubmitting || !title.trim()}
                className="text-xs h-8"
              >
                {isSubmitting
                  ? "Saving..."
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
