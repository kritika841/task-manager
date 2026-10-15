"use client";

import React, { useState } from "react";
import {
  X,
  Calendar,
  Send,
  User as UserIcon,
  Clock,
  CheckCircle2,
  TrendingUp,
  Link as LinkIcon,
  Lock,
  RotateCcw,
  Check,
  History,
  FileText,
  Eye,
  Edit3,
  Archive,
  ShieldCheck,
  ListTodo,
  MessageSquare,
} from "lucide-react";
import { useTasks } from "@/lib/store";
import { TaskPriority, TaskStatus } from "@/lib/types";
import { isCanonicalAdflowTask } from "@/lib/supabase";
import { Button } from "./ui/button";
import { Input, Textarea, Select } from "./ui/field";
import { Markdown } from "./ui/markdown";
import { MediaDeliverable } from "./media-deliverable";
import { SubtaskChecklist } from "./subtask-checklist";
import { CommentThread } from "./comment-thread";
import { TimeTracker } from "./time-tracker";
import { formatDate, cn } from "@/lib/utils";

export function TaskDrawer() {
  const {
    tasks,
    users,
    selectedTaskId,
    setSelectedTaskId,
    updateTask,
    deleteTask,
    restoreTask,
    toggleSubtask,
    addSubtask,
    removeSubtask,
    updateTaskProgress,
    addComment,
    deleteComment,
    approveTask,
    requestRevision,
    submitForReview,
    startTimeTracking,
    stopTimeTracking,
    logManualHours,
    isTaskBlocked,
    getTaskAuditLogs,
    isManagerOrAdmin,
    isAdmin,
    currentUserId,
    currentUser,
    isAdsManagementConnected,
    enforceCanonicalLock,
  } = useTasks();

  const [revisionReasonInput, setRevisionReasonInput] = useState("");
  const [revisionNotesInput, setRevisionNotesInput] = useState("");
  const [isRevisionOpen, setIsRevisionOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"overview" | "checklist" | "activity">("overview");
  const [descMode, setDescMode] = useState<"edit" | "preview">("edit");

  if (!selectedTaskId) return null;

  const task = tasks.find((t) => t.id === selectedTaskId);
  if (!task) return null;

  const assignee = users.find((u) => u.id === task.assigneeId);
  const creator = users.find((u) => u.id === task.creatorId);
  const targetQty = task.targetQuantity || 1;
  const completedQty = task.completedQuantity || 0;
  const pct = Math.min(100, Math.round((completedQty / targetQty) * 100));
  const { blocked, blockingTasks } = isTaskBlocked(task);
  const taskAuditLogs = getTaskAuditLogs(task.id);
  const isStandardAdflow = isCanonicalAdflowTask(task.title);
  const isTitleLocked = isStandardAdflow && isAdsManagementConnected && enforceCanonicalLock;

  const otherTasks = tasks.filter((t) => t.id !== task.id);
  const downstreamBlockedTasks = tasks.filter((t) => t.blockedByTaskIds?.includes(task.id));

  const completedSubtasksCount = task.subtasks.filter((s) => s.completed).length;

  const handleRevisionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!revisionReasonInput.trim()) return;
    await requestRevision(task.id, revisionReasonInput.trim(), revisionNotesInput.trim() || undefined);
    setIsRevisionOpen(false);
    setRevisionReasonInput("");
    setRevisionNotesInput("");
  };

  const toggleDependency = (depTaskId: string) => {
    const current = task.blockedByTaskIds || [];
    const updated = current.includes(depTaskId)
      ? current.filter((id) => id !== depTaskId)
      : [...current, depTaskId];
    updateTask(task.id, { blockedByTaskIds: updated });
  };

  return (
    <div className="fixed inset-0 z-50 overflow-hidden" role="dialog" aria-modal="true">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-foreground/20 backdrop-blur-xs transition-opacity"
        onClick={() => setSelectedTaskId(null)}
      />

      {/* Drawer Container */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-xl bg-card border-l border-border shadow-float flex flex-col">
          {/* Drawer Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-border bg-card">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted text-muted-foreground">
                {task.taskNumber}
              </span>
              {isStandardAdflow && (
                <span
                  className="flex items-center gap-1 rounded bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-500"
                  title="Canonical Adflow Task"
                >
                  <Lock className="size-3" />
                  <span>Adflow Pipeline</span>
                </span>
              )}
              {task.isArchived && (
                <span className="flex items-center gap-1 rounded bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-500">
                  <Archive className="size-3" />
                  <span>Archived</span>
                </span>
              )}
              {blocked && (
                <span className="flex items-center gap-1 rounded bg-destructive/15 px-2 py-0.5 text-[10px] font-semibold text-destructive">
                  <Lock className="size-3" />
                  <span>Blocked</span>
                </span>
              )}
              {task.isRevisionRequested && (
                <span className="flex items-center gap-1 rounded bg-warning/15 px-2 py-0.5 text-[10px] font-semibold text-warning">
                  <RotateCcw className="size-3" />
                  <span>Revision Needed</span>
                </span>
              )}
            </div>

            <div className="flex items-center gap-2">
              {task.isArchived ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => restoreTask(task.id)}
                  className="text-xs h-7 gap-1 border-emerald-500/40 text-emerald-500 hover:bg-emerald-500/10 cursor-pointer"
                  title="Restore task from archive"
                >
                  <RotateCcw className="size-3" />
                  <span>Restore</span>
                </Button>
              ) : (
                isManagerOrAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      if (
                        confirm(
                          `Archive task ${task.taskNumber} ("${task.title}")? This preserves pipeline integrity and payroll data in Adflow.`
                        )
                      ) {
                        deleteTask(task.id);
                        setSelectedTaskId(null);
                      }
                    }}
                    className="size-7 rounded-lg border border-amber-500/20 hover:border-amber-500/60 hover:bg-amber-500/10 text-amber-500 flex items-center justify-center transition cursor-pointer"
                    title="Archive task (Soft Delete)"
                  >
                    <Archive className="size-3.5" />
                  </button>
                )
              )}

              <button
                type="button"
                onClick={() => setSelectedTaskId(null)}
                className="size-7 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition cursor-pointer"
                title="Close drawer"
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {/* Clean 3-Tab Navigation */}
          <div className="flex border-b border-border px-4 bg-muted/20 text-xs">
            {/* Tab 1: Overview & Deliverable */}
            <button
              type="button"
              onClick={() => setActiveTab("overview")}
              className={cn(
                "py-2.5 px-3 font-semibold border-b-2 transition cursor-pointer flex items-center gap-1.5",
                activeTab === "overview"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <FileText className="size-3.5" />
              <span>Overview & Media</span>
            </button>

            {/* Tab 2: Subtasks & Checklist */}
            <button
              type="button"
              onClick={() => setActiveTab("checklist")}
              className={cn(
                "py-2.5 px-3 font-semibold border-b-2 transition cursor-pointer flex items-center gap-1.5",
                activeTab === "checklist"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <ListTodo className="size-3.5" />
              <span>Checklist</span>
              {task.subtasks.length > 0 && (
                <span className="text-[10px] font-mono opacity-80 px-1 py-0.2 rounded bg-muted">
                  {completedSubtasksCount}/{task.subtasks.length}
                </span>
              )}
            </button>

            {/* Tab 3: Discussion & Activity */}
            <button
              type="button"
              onClick={() => setActiveTab("activity")}
              className={cn(
                "py-2.5 px-3 font-semibold border-b-2 transition cursor-pointer flex items-center gap-1.5",
                activeTab === "activity"
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              <MessageSquare className="size-3.5" />
              <span>Discussion & History</span>
              {(task.comments?.length || 0) > 0 && (
                <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-primary/10 text-primary font-bold">
                  {task.comments?.length}
                </span>
              )}
            </button>
          </div>

          {/* Drawer Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* TAB 1: OVERVIEW & DELIVERABLE */}
            {activeTab === "overview" && (
              <>
                {/* Title */}
                <div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={task.title}
                      disabled={isTitleLocked}
                      onChange={(e) => updateTask(task.id, { title: e.target.value })}
                      className={cn(
                        "text-base font-bold text-foreground bg-transparent border-b outline-hidden w-full transition pb-1",
                        isTitleLocked
                          ? "border-transparent cursor-not-allowed opacity-90 select-none"
                          : "border-transparent hover:border-border focus:border-primary"
                      )}
                    />
                    {isStandardAdflow && (
                      <span
                        className={cn(
                          "shrink-0 p-1 rounded border",
                          isTitleLocked
                            ? "text-amber-500 bg-amber-500/10 border-amber-500/20"
                            : "text-emerald-500 bg-emerald-500/10 border-emerald-500/20"
                        )}
                        title={
                          isTitleLocked
                            ? "Canonical Adflow Task: Title locked while Ads Management is connected."
                            : "Canonical Adflow Task: Unlocked in standalone mode."
                        }
                      >
                        {isTitleLocked ? <Lock className="size-3.5" /> : <ShieldCheck className="size-3.5" />}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>Department: <strong>{task.project}</strong></span>
                    <span>•</span>
                    <span>Created by {creator?.name || "Operations"}</span>
                  </div>
                </div>

                {/* Deliverable & Media Upload */}
                <MediaDeliverable
                  taskId={task.id}
                  deliverableUrl={task.deliverableUrl}
                  deliverableAsset={task.deliverableAsset}
                  onSave={async (url, asset) => {
                    await updateTask(task.id, {
                      deliverableUrl: url,
                      deliverableAsset: asset,
                    });
                  }}
                />

                {/* Submit for Review trigger if deliverable attached */}
                {task.status !== "in_review" && task.status !== "completed" && task.deliverableUrl && (
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Deliverable attached. Ready for manager review?</span>
                    <Button
                      type="button"
                      size="sm"
                      variant="primary"
                      onClick={() => submitForReview(task.id, task.deliverableUrl || "")}
                      className="h-7 text-xs gap-1 shadow-xs"
                    >
                      <Send className="size-3" />
                      <span>Submit for Review</span>
                    </Button>
                  </div>
                )}

                {/* Core Properties Grid */}
                <div className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-3 text-xs">
                  {/* Status Pill Selector */}
                  <div className="grid grid-cols-3 items-start gap-2">
                    <span className="text-muted-foreground font-medium flex items-center gap-1.5 pt-1">
                      <Clock className="size-3.5" />
                      <span>Status</span>
                    </span>
                    <div className="col-span-2 flex flex-wrap gap-1">
                      {[
                        { id: "backlog", label: "Backlog", activeStyle: "bg-muted text-foreground border-border" },
                        { id: "todo", label: "To Do", activeStyle: "bg-zinc-500/20 text-zinc-200 border-zinc-500/40" },
                        { id: "in_progress", label: "In Progress", activeStyle: "bg-blue-500/20 text-blue-400 border-blue-500/40" },
                        { id: "in_review", label: "In Review", activeStyle: "bg-amber-500/20 text-amber-400 border-amber-500/40" },
                        { id: "completed", label: "Done", activeStyle: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" },
                      ].map((st) => (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => updateTask(task.id, { status: st.id as TaskStatus })}
                          className={cn(
                            "px-2 py-0.5 rounded-md text-[11px] font-semibold border transition cursor-pointer select-none",
                            task.status === st.id
                              ? `${st.activeStyle} ring-1 ring-primary/30 font-bold shadow-xs`
                              : "border-transparent text-muted-foreground/80 hover:bg-muted/60 hover:text-foreground"
                          )}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Priority */}
                  <div className="grid grid-cols-3 items-center">
                    <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                      <TrendingUp className="size-3.5" />
                      <span>Priority</span>
                    </span>
                    <div className="col-span-2">
                      <Select
                        value={task.priority}
                        onChange={(e) =>
                          updateTask(task.id, {
                            priority: e.target.value as TaskPriority,
                          })
                        }
                        className="w-full text-xs h-8 bg-card"
                      >
                        <option value="urgent">Urgent</option>
                        <option value="high">High</option>
                        <option value="medium">Medium</option>
                        <option value="low">Low</option>
                      </Select>
                    </div>
                  </div>

                  {/* Assignee */}
                  <div className="grid grid-cols-3 items-center">
                    <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                      <UserIcon className="size-3.5" />
                      <span>Assignee</span>
                    </span>
                    <div className="col-span-2">
                      <Select
                        value={task.assigneeId}
                        onChange={(e) =>
                          updateTask(task.id, { assigneeId: e.target.value })
                        }
                        className="w-full text-xs h-8 bg-card"
                      >
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.role})
                          </option>
                        ))}
                      </Select>
                    </div>
                  </div>

                  {/* Daily Target Units */}
                  <div className="grid grid-cols-3 items-center">
                    <span className="text-muted-foreground font-medium">Daily Target</span>
                    <div className="col-span-2 flex items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={targetQty}
                        onChange={(e) =>
                          updateTask(task.id, {
                            targetQuantity: Math.max(1, parseInt(e.target.value) || 1),
                          })
                        }
                        className="w-20 rounded-md border border-border px-2 py-1 text-xs bg-card font-mono"
                      />
                      <span className="text-muted-foreground text-[11px]">deliverable units</span>
                    </div>
                  </div>

                  {/* Completed Progress Counter (+ / -) */}
                  <div className="grid grid-cols-3 items-center">
                    <div>
                      <span className="text-muted-foreground font-medium block">Completed Units</span>
                      {(task.autoCompletedQuantity || 0) > 0 && (
                        <span className="text-[10px] text-blue-500 font-mono block">
                          ⚡ {task.autoCompletedQuantity} auto-ingested
                        </span>
                      )}
                    </div>
                    <div className="col-span-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => updateTaskProgress(task.id, completedQty - 1)}
                        disabled={completedQty <= (task.autoCompletedQuantity || 0)}
                        className="size-7 rounded border border-border bg-card hover:bg-muted font-bold flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                      >
                        -
                      </button>
                      <span className="font-mono font-semibold text-sm w-8 text-center">
                        {completedQty}
                      </span>
                      <button
                        type="button"
                        onClick={() => updateTaskProgress(task.id, completedQty + 1)}
                        className="size-7 rounded border border-border bg-card hover:bg-muted font-bold flex items-center justify-center cursor-pointer"
                      >
                        +
                      </button>
                      <span className="text-muted-foreground text-[11px] ml-1">
                        of {targetQty} ({pct}%)
                      </span>
                    </div>
                  </div>

                  {/* Due Date & Time */}
                  <div className="grid grid-cols-3 items-center">
                    <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                      <Calendar className="size-3.5" />
                      <span>Due Date</span>
                    </span>
                    <div className="col-span-2 flex items-center gap-2">
                      <Input
                        type="date"
                        value={task.dueDate}
                        onChange={(e) => updateTask(task.id, { dueDate: e.target.value })}
                        className="flex-1 text-xs h-8 bg-card"
                      />
                      <Input
                        type="time"
                        value={task.dueTime || ""}
                        onChange={(e) => updateTask(task.id, { dueTime: e.target.value })}
                        className="w-24 text-xs h-8 bg-card"
                      />
                    </div>
                  </div>
                </div>

                {/* Instructions & Notes (Markdown) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Instructions & Notes
                    </span>
                    <div className="flex items-center rounded border border-border bg-muted/40 p-0.5 text-[10px]">
                      <button
                        type="button"
                        onClick={() => setDescMode("edit")}
                        className={cn(
                          "px-2 py-0.5 rounded cursor-pointer transition flex items-center gap-1",
                          descMode === "edit"
                            ? "bg-card text-foreground font-bold shadow-2xs"
                            : "text-muted-foreground"
                        )}
                      >
                        <Edit3 className="size-2.5" />
                        <span>Edit</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDescMode("preview")}
                        className={cn(
                          "px-2 py-0.5 rounded cursor-pointer transition flex items-center gap-1",
                          descMode === "preview"
                            ? "bg-card text-foreground font-bold shadow-2xs"
                            : "text-muted-foreground"
                        )}
                      >
                        <Eye className="size-2.5" />
                        <span>Preview</span>
                      </button>
                    </div>
                  </div>

                  {descMode === "edit" ? (
                    <Textarea
                      rows={3}
                      placeholder="Add task instructions, links, or requirements..."
                      value={task.description}
                      onChange={(e) =>
                        updateTask(task.id, { description: e.target.value })
                      }
                      className="w-full text-xs bg-muted/10 font-mono"
                    />
                  ) : (
                    <div className="rounded-xl border border-border bg-card p-3 min-h-[70px]">
                      {task.description ? (
                        <Markdown content={task.description} />
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          No description provided.
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </>
            )}

            {/* TAB 2: SUBTASKS & DEPENDENCIES */}
            {activeTab === "checklist" && (
              <div className="space-y-4">
                {/* Subtask Checklist Engine */}
                <SubtaskChecklist
                  taskId={task.id}
                  subtasks={task.subtasks}
                  targetQuantity={targetQty}
                  completedQuantity={completedQty}
                  autoCompletedQuantity={task.autoCompletedQuantity || 0}
                  users={users}
                  onToggle={(subtaskId) => toggleSubtask(task.id, subtaskId)}
                  onAddSubtask={(title, assignedTo) =>
                    addSubtask(task.id, title, assignedTo)
                  }
                  onRemoveSubtask={(subtaskId) => removeSubtask(task.id, subtaskId)}
                />

                {/* Prerequisite Dependencies */}
                <div className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground flex items-center gap-1.5">
                      <Lock className="size-3.5 text-primary" />
                      <span>Prerequisite Tasks (Blocked By)</span>
                    </span>
                    {blocked && (
                      <span className="text-[10px] font-semibold text-destructive font-mono bg-destructive/15 px-2 py-0.5 rounded">
                        Blocked
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] text-muted-foreground">
                    Select tasks that must be finished before this task can proceed:
                  </p>

                  <div className="space-y-1 max-h-36 overflow-y-auto">
                    {otherTasks.map((ot) => {
                      const isChecked = (task.blockedByTaskIds || []).includes(ot.id);
                      return (
                        <label
                          key={ot.id}
                          className="flex items-center justify-between p-1.5 rounded hover:bg-muted/40 cursor-pointer"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleDependency(ot.id)}
                              className="rounded border-border text-primary focus:ring-primary size-3.5"
                            />
                            <span className="truncate font-medium text-[11px]">
                              {ot.taskNumber}: {ot.title}
                            </span>
                          </div>
                          <span
                            className={cn(
                              "text-[10px] font-mono px-1 py-0.2 rounded shrink-0",
                              ot.status === "completed"
                                ? "bg-success/15 text-success font-semibold"
                                : "bg-muted text-muted-foreground"
                            )}
                          >
                            {ot.status}
                          </span>
                        </label>
                      );
                    })}
                  </div>

                  {/* Downstream Blocked Tasks */}
                  {downstreamBlockedTasks.length > 0 && (
                    <div className="pt-2 border-t border-border/50">
                      <span className="text-[11px] font-semibold text-muted-foreground block mb-1">
                        Tasks Blocked by This ({downstreamBlockedTasks.length}):
                      </span>
                      <div className="space-y-1">
                        {downstreamBlockedTasks.map((dt) => (
                          <div
                            key={dt.id}
                            onClick={() => setSelectedTaskId(dt.id)}
                            className="flex items-center justify-between p-1.5 rounded hover:bg-muted/40 cursor-pointer text-[11px] text-foreground border border-border/40 bg-card"
                          >
                            <span className="font-mono text-muted-foreground font-semibold">
                              {dt.taskNumber}: {dt.title}
                            </span>
                            <span className="text-[9px] uppercase font-mono px-1 py-0.2 rounded bg-muted text-muted-foreground">
                              {dt.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 3: DISCUSSION & ACTIVITY */}
            {activeTab === "activity" && (
              <div className="space-y-4">
                {/* Manager Review & Approval Box */}
                {isManagerOrAdmin && (
                  <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/5 p-3.5 text-xs space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-indigo-500 flex items-center gap-1.5">
                        <CheckCircle2 className="size-3.5" />
                        <span>Manager Approval Gate</span>
                      </span>
                      <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-500 font-semibold">
                        {currentUser.role}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      <Button
                        type="button"
                        size="sm"
                        variant="primary"
                        onClick={() => approveTask(task.id)}
                        className="text-xs h-7.5 gap-1.5 bg-success hover:bg-success/90 text-white"
                        disabled={task.status === "completed"}
                      >
                        <Check className="size-3.5" />
                        <span>{task.status === "completed" ? "Approved & Done" : "Approve Deliverable"}</span>
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => setIsRevisionOpen((prev) => !prev)}
                        className="text-xs h-7.5 gap-1.5 border-warning/40 text-warning hover:bg-warning/10"
                      >
                        <RotateCcw className="size-3.5" />
                        <span>Request Revision</span>
                      </Button>
                    </div>

                    {/* Revision Form */}
                    {isRevisionOpen && (
                      <form onSubmit={handleRevisionSubmit} className="pt-2 border-t border-border/60 space-y-2">
                        <div>
                          <label className="text-[11px] font-semibold text-muted-foreground block mb-1">
                            Revision Reason
                          </label>
                          <Select
                            value={revisionReasonInput}
                            onChange={(e) => setRevisionReasonInput(e.target.value)}
                            className="text-xs h-8 bg-card"
                          >
                            <option value="">Select reason...</option>
                            <option value="Audio / Voiceover Issue">Audio / Voiceover Issue</option>
                            <option value="Color Grading / Visual Glitch">Color Grading / Visual Glitch</option>
                            <option value="Pacing or Cut Needs Improvement">Pacing or Cut Needs Improvement</option>
                            <option value="Incorrect Asset / Missing Footage">Incorrect Asset / Missing Footage</option>
                            <option value="Brand Identity Guideline Mismatch">Brand Identity Guideline Mismatch</option>
                            <option value="Other Changes Needed">Other Changes Needed</option>
                          </Select>
                        </div>
                        <div>
                          <Textarea
                            placeholder="Provide specific timestamped instructions or fix details..."
                            value={revisionNotesInput}
                            onChange={(e) => setRevisionNotesInput(e.target.value)}
                            rows={2}
                            className="text-xs bg-card"
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setIsRevisionOpen(false)}
                            className="text-xs h-7"
                          >
                            Cancel
                          </Button>
                          <Button
                            type="submit"
                            variant="secondary"
                            size="sm"
                            className="text-xs h-7 text-warning"
                          >
                            Send Request
                          </Button>
                        </div>
                      </form>
                    )}
                  </div>
                )}

                {/* Revision Notice Banner */}
                {task.isRevisionRequested && task.status !== "in_review" && (
                  <div className="rounded-xl border border-warning/30 bg-warning/10 p-3.5 text-xs space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 font-semibold text-warning">
                        <RotateCcw className="size-3.5" />
                        <span>Revision Requested by Manager</span>
                      </div>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-warning/20 text-warning font-semibold">
                        Needs Changes
                      </span>
                    </div>
                    <p className="text-foreground text-[11px]">
                      <strong>Reason:</strong> {task.revisionReason || "Updates needed"}
                    </p>
                    {task.revisionNotes && (
                      <p className="text-muted-foreground text-[11px] bg-card/60 p-2.5 rounded-lg border border-border font-mono leading-relaxed">
                        {task.revisionNotes}
                      </p>
                    )}
                    <div className="pt-1 flex items-center justify-end">
                      <Button
                        type="button"
                        size="sm"
                        variant="secondary"
                        onClick={() => submitForReview(task.id, task.deliverableUrl || "")}
                        className="h-7 text-xs gap-1 border-warning/40 text-warning hover:bg-warning/20 bg-warning/10"
                      >
                        <RotateCcw className="size-3" />
                        <span>Mark Resolved & Resubmit</span>
                      </Button>
                    </div>
                  </div>
                )}

                {/* Time Tracker Stopwatch */}
                <TimeTracker
                  taskId={task.id}
                  timeTracking={task.timeTracking}
                  estimatedHours={task.estimatedHours}
                  actualHours={task.actualHours}
                  onStart={startTimeTracking}
                  onStop={stopTimeTracking}
                  onLogHours={logManualHours}
                />

                {/* Comment Thread */}
                <CommentThread
                  taskId={task.id}
                  comments={task.comments}
                  users={users}
                  currentUserId={currentUserId}
                  isAdmin={isAdmin}
                  onAddComment={(content, mentions) =>
                    addComment(task.id, content, mentions)
                  }
                  onDeleteComment={(commentId) => deleteComment(task.id, commentId)}
                />

                {/* Audit History Timeline */}
                <div className="space-y-2 pt-2 border-t border-border">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-muted-foreground flex items-center gap-1.5">
                      <History className="size-3.5 text-primary" />
                      <span>Audit History ({taskAuditLogs.length})</span>
                    </span>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {taskAuditLogs.map((log) => {
                      let logIcon = <History className="size-3.5 text-primary" />;
                      let logDescription = log.action.replace(/_/g, " ");

                      if (log.action === "created_task") {
                        logIcon = <Check className="size-3.5 text-primary" />;
                        logDescription = `Created task with ${log.metadata?.targetQuantity || 1} units`;
                      } else if (log.action === "approved_deliverable") {
                        logIcon = <Check className="size-3.5 text-success" />;
                        logDescription = "Approved deliverable and marked task completed";
                      } else if (log.action === "requested_revision") {
                        logIcon = <RotateCcw className="size-3.5 text-warning" />;
                        logDescription = `Requested changes: ${log.metadata?.revisionReason || "Needs updates"}`;
                      } else if (log.action === "submitted_for_review") {
                        logIcon = <LinkIcon className="size-3.5 text-primary" />;
                        logDescription = "Submitted deliverable for manager review";
                      } else if (log.action === "progress_logged") {
                        logIcon = <TrendingUp className="size-3.5 text-emerald-500" />;
                        logDescription = `Updated units: ${log.metadata?.completedUnits || 0} / ${log.metadata?.targetUnits || 1}`;
                      } else if (log.action === "status_changed") {
                        logIcon = <Clock className="size-3.5 text-indigo-500" />;
                        logDescription = `Moved status to ${log.metadata?.status || "updated"}`;
                      } else if (log.action === "reassigned_task") {
                        logIcon = <UserIcon className="size-3.5 text-blue-500" />;
                        logDescription = "Reassigned task to new team member";
                      }

                      return (
                        <div
                          key={log.id}
                          className="rounded-lg border border-border bg-card p-2 text-xs space-y-1"
                        >
                          <div className="flex items-center justify-between text-muted-foreground">
                            <span className="font-semibold text-foreground flex items-center gap-1.5 text-[11px]">
                              {logIcon}
                              <span>{log.actorName}</span>
                            </span>
                            <span className="text-[10px] font-mono">
                              {formatDate(log.createdAt)}
                            </span>
                          </div>
                          <div className="text-[11px] text-foreground font-medium">
                            {logDescription}
                          </div>
                        </div>
                      );
                    })}

                    {taskAuditLogs.length === 0 && (
                      <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                        No audit history entries recorded yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
