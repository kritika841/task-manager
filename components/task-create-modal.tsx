"use client";

import React, { useState, useEffect } from "react";
import { X, Plus, Trash2, CheckSquare, AlertCircle, Link as LinkIcon } from "lucide-react";
import { useTasks } from "@/lib/store";
import { TaskPriority, TaskStatus, DeliverableAsset } from "@/lib/types";
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
    tasks,
    users,
    currentUserId,
    isManagerOrAdmin,
    getMemberCapacity,
  } = useTasks();

  const today = dateInTargetTimeZone();

  const [title, setTitle] = useState("");
  const [selectedStandardTask, setSelectedStandardTask] = useState("");
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
      if (createModalStatus) {
        setStatus(createModalStatus);
      } else {
        setStatus("todo");
      }
    }
  }, [isCreateModalOpen, createModalAssigneeId, createModalStatus, currentUserId, users]);

  if (!isCreateModalOpen) return null;

  const selectedAssignee = users.find((u) => u.id === assigneeId);
  const roleStandardTasks = taskOptionsForRole(selectedAssignee?.role);

  // Capacity calculation
  const assigneeCapacity = assigneeId ? getMemberCapacity(assigneeId) : { max: 6, current: 0, percent: 0, isOverAllocated: false };
  const projectedTotal = (assigneeCapacity.current || 0) + (Number(targetQuantity) || 1);
  const willOverAllocate = projectedTotal > assigneeCapacity.max;

  const handleStandardTaskSelect = (task: string) => {
    setSelectedStandardTask(task);
    if (task && task !== "__custom__") {
      setTitle(task);
    } else if (task === "__custom__") {
      setTitle("");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    setIsSubmitting(true);
    await createTask({
      title: title.trim(),
      description: description.trim(),
      priority,
      status,
      assigneeId: assigneeId || currentUserId,
      dueDate: dueDate || today,
      dueTime: dueTime || undefined,
      estimatedHours: estimatedHours || undefined,
      targetQuantity: Math.max(1, Number(targetQuantity) || 1),
      deliverableUrl: deliverableUrl.trim() || deliverableAsset?.url || undefined,
      deliverableAsset,
    });

    setIsSubmitting(false);
    // Reset and close
    setTitle("");
    setSelectedStandardTask("");
    setDescription("");
    setTargetQuantity(1);
    setDueTime("");
    setEstimatedHours(undefined);
    setDeliverableUrl("");
    setDeliverableAsset(undefined);
    setIsCreateModalOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-foreground/20 backdrop-blur-xs transition-opacity"
        onClick={() => setIsCreateModalOpen(false)}
      />

      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-lg rounded-2xl border border-border bg-card p-6 shadow-float transition-all">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border pb-3.5 mb-4">
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Assign New Task
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Creates a daily target synced with team deliverables.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(false)}
              className="size-8 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
            {/* Assignee */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-medium text-foreground">
                  Assign To *
                </label>
                <div className="flex items-center gap-2">
                  {currentUserId && assigneeId !== currentUserId && (
                    <button
                      type="button"
                      onClick={() => {
                        setAssigneeId(currentUserId);
                        setSelectedStandardTask("");
                      }}
                      className="text-[11px] text-primary hover:underline font-semibold cursor-pointer"
                    >
                      Assign to myself
                    </button>
                  )}
                  <span className="text-[10px] font-mono text-muted-foreground">
                    Bandwidth: {assigneeCapacity.current} / {assigneeCapacity.max} units
                  </span>
                </div>
              </div>
              <Select
                value={assigneeId}
                onChange={(e) => {
                  setAssigneeId(e.target.value);
                  setSelectedStandardTask("");
                }}
                className="w-full text-xs h-9 bg-card"
                required
              >
                {users.map((u) => {
                  const isMe = u.id === currentUserId;
                  const cap = getMemberCapacity(u.id);
                  return (
                    <option key={u.id} value={u.id}>
                      {u.name} {isMe ? "· (You)" : ""} — {u.role.replace("_", " ")} ({cap.current}/{cap.max} units)
                    </option>
                  );
                })}
              </Select>
            </div>

            {/* Capacity Warning Alert */}
            {willOverAllocate && (
              <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/10 p-2.5 text-warning text-[11px] leading-relaxed">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <div>
                  <strong>Bandwidth Warning:</strong> {selectedAssignee?.name} has {assigneeCapacity.current}/{assigneeCapacity.max} units today. Adding {targetQuantity} units will put them at <strong>{projectedTotal}/{assigneeCapacity.max} units</strong> (over capacity by {projectedTotal - assigneeCapacity.max} units).
                </div>
              </div>
            )}

            {/* Standard Task Shortcuts */}
            <div>
              <label className="block font-medium text-foreground mb-1">
                Task Type
              </label>
              <Select
                value={selectedStandardTask}
                onChange={(e) => handleStandardTaskSelect(e.target.value)}
                className="w-full text-xs h-9 bg-card"
              >
                <option value="">Select task template (or custom below)</option>
                {roleStandardTasks.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
                <option value="__custom__">Custom task...</option>
              </Select>
            </div>

            {/* Title */}
            <div>
              <label className="block font-medium text-foreground mb-1">
                Task Title *
              </label>
              <Input
                required
                placeholder="e.g. Ad video edits or Script writing"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="text-xs h-9 bg-card"
              />
            </div>

            {/* Target Quantity, Due Date, Due Time, and Est Hours */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div>
                <label className="block font-medium text-foreground mb-1">
                  Target Units *
                </label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={targetQuantity}
                  onChange={(e) => setTargetQuantity(Number(e.target.value))}
                  className="text-xs h-9 bg-card"
                  required
                />
              </div>

              <div>
                <label className="block font-medium text-foreground mb-1">
                  Due Date *
                </label>
                <Input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="text-xs h-9 bg-card"
                  required
                />
              </div>

              <div>
                <label className="block font-medium text-foreground mb-1">
                  Due Time
                </label>
                <Input
                  type="time"
                  value={dueTime}
                  onChange={(e) => setDueTime(e.target.value)}
                  className="text-xs h-9 bg-card"
                />
              </div>

              <div>
                <label className="block font-medium text-foreground mb-1">
                  Est. Hours
                </label>
                <Input
                  type="number"
                  step="0.5"
                  min="0"
                  placeholder="e.g. 2.5"
                  value={estimatedHours ?? ""}
                  onChange={(e) =>
                    setEstimatedHours(e.target.value ? parseFloat(e.target.value) : undefined)
                  }
                  className="text-xs h-9 bg-card"
                />
              </div>
            </div>

            {/* Priority & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-medium text-foreground mb-1">
                  Priority
                </label>
                <Select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  className="w-full text-xs h-9 bg-card"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </Select>
              </div>

              <div>
                <label className="block font-medium text-foreground mb-1">
                  Status
                </label>
                <Select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  className="w-full text-xs h-9 bg-card"
                >
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="in_review">In Review</option>
                  <option value="completed">Done</option>
                  <option value="backlog">Backlog</option>
                </Select>
              </div>
            </div>



            {/* Deliverable / Brief Asset Link */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="flex items-center gap-1.5 font-medium text-foreground">
                  <LinkIcon className="size-3 text-muted-foreground" />
                  <span>Deliverable or Google Drive Link (Optional)</span>
                </label>
                <span className="text-[10px] text-primary font-mono">Max 20MB for files or Drive link</span>
              </div>
              <Input
                placeholder="e.g. drive.google.com/drive/folders/... or raw footage link"
                value={deliverableUrl}
                onChange={(e) => setDeliverableUrl(e.target.value)}
                className="text-xs h-9 bg-card"
              />
            </div>

            {/* Description / Instructions */}
            <div>
              <label className="block font-medium text-foreground mb-1">
                Instructions / Notes (optional)
              </label>
              <Textarea
                rows={2}
                placeholder="Specific instructions, asset references, or deliverable notes..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="text-xs bg-card"
              />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-3 border-t border-border">
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
                {isSubmitting ? "Creating..." : "Assign Task"}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
