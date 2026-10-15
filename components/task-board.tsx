"use client";

import React, { useState } from "react";
import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  MoreHorizontal,
  Plus,
  Tag,
  Clock,
  AlertCircle,
  CheckSquare,
  Square,
  ChevronDown,
  Layers,
  Lock,
  RotateCcw,
  Check,
  RotateCw,
  Columns,
  Rows,
  Trash2,
  Archive,
} from "lucide-react";
import { Task, TaskStatus, User } from "@/lib/types";
import { useTasks } from "@/lib/store";
import { dateInTargetTimeZone } from "@/lib/supabase";
import { StatusBadge, PriorityBadge } from "./ui/badge";
import { ProgressBar } from "./ui/progress-bar";
import { Button } from "./ui/button";
import { calculateProgress, formatDate, isOverdue, cn, getUserColor, getEmployeeCode } from "@/lib/utils";

interface ColumnDef {
  id: TaskStatus;
  label: string;
  pillBg: string;
  dotColor: string;
}

const COLUMNS: ColumnDef[] = [
  {
    id: "backlog",
    label: "Backlog",
    pillBg: "bg-muted text-muted-foreground border border-border/60",
    dotColor: "bg-muted-foreground/60",
  },
  {
    id: "todo",
    label: "To Do",
    pillBg: "bg-zinc-500/10 text-zinc-700 dark:bg-zinc-800/80 dark:text-zinc-300 border border-zinc-500/20 dark:border-zinc-700/50",
    dotColor: "bg-zinc-400",
  },
  {
    id: "in_progress",
    label: "In Progress",
    pillBg: "bg-blue-500/10 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 border border-blue-500/25",
    dotColor: "bg-blue-500",
  },
  {
    id: "in_review",
    label: "In Review",
    pillBg: "bg-amber-500/10 text-amber-700 dark:bg-amber-500/20 dark:text-amber-400 border border-amber-500/25",
    dotColor: "bg-amber-500",
  },
  {
    id: "completed",
    label: "Done",
    pillBg: "bg-emerald-500/10 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400 border border-emerald-500/25",
    dotColor: "bg-emerald-500",
  },
];

export function TaskBoard() {
  const {
    filteredTasks,
    tasks,
    users,
    setSelectedTaskId,
    setIsCreateModalOpen,
    openCreateModal,
    updateTask,
    deleteTask,
    restoreTask,
    toggleSubtask,
    approveTask,
    requestRevision,
    isTaskBlocked,
    getMemberCapacity,
    isManagerOrAdmin,
    boardLayout,
    setBoardLayout,
    selectedTaskIds,
    toggleSelectTask,
    selectAllFilteredTasks,
    selectTasks,
    updateTaskProgress,
    currentUserId,
  } = useTasks();

  const [expandedTaskIds, setExpandedTaskIds] = useState<Record<string, boolean>>({});
  const [collapsedSwimlanes, setCollapsedSwimlanes] = useState<Record<string, boolean>>({});
  const [showPastCompleted, setShowPastCompleted] = useState<Record<string, boolean>>({});
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const draggedTaskIdRef = React.useRef<string | null>(null);

  const togglePast = (key: string) => {
    setShowPastCompleted((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleExpand = (e: React.MouseEvent, taskId: string) => {
    e.stopPropagation();
    setExpandedTaskIds((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  const toggleSwimlane = (userId: string) => {
    setCollapsedSwimlanes((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  const nextStatusMap: Record<TaskStatus, TaskStatus | null> = {
    backlog: "todo",
    todo: "in_progress",
    in_progress: "in_review",
    in_review: "completed",
    completed: null,
  };

  const prevStatusMap: Record<TaskStatus, TaskStatus | null> = {
    backlog: null,
    todo: "backlog",
    in_progress: "todo",
    in_review: "in_progress",
    completed: "in_review",
  };

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, taskId: string) => {
    draggedTaskIdRef.current = taskId;
    setDraggedTaskId(taskId);
    e.dataTransfer.setData("text/plain", taskId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    draggedTaskIdRef.current = null;
    setDraggedTaskId(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, key: string) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    if (dragOverColumn !== key) {
      setDragOverColumn(key);
    }
  };

  const handleDrop = (e: React.DragEvent, columnId: TaskStatus, targetUserId?: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverColumn(null);
    const taskId = e.dataTransfer.getData("text/plain") || draggedTaskIdRef.current || draggedTaskId;
    draggedTaskIdRef.current = null;
    setDraggedTaskId(null);

    if (taskId) {
      const taskObj = tasks.find((t) => t.id === taskId);
      if (taskObj) {
        // Skip if dropping to exact same status and assignee
        if (taskObj.status === columnId && (!targetUserId || taskObj.assigneeId === targetUserId)) {
          return;
        }

        const updates: Partial<Task> = { status: columnId };
        if (targetUserId) {
          updates.assigneeId = targetUserId;
        }
        updateTask(taskId, updates);
      }
    }
  };

  const handleAdvanceStatus = (e: React.MouseEvent, task: Task, nextStatus: TaskStatus) => {
    e.stopPropagation();
    updateTask(task.id, { status: nextStatus });
  };

  // Render a single task card
  const renderCard = (task: Task) => {
    const assignee = users.find((u) => u.id === task.assigneeId);
    const empCode = assignee?.employeeCode || (assignee ? getEmployeeCode(assignee.name) : "");
    const userColor = assignee ? getUserColor(empCode, assignee.color) : "#64748b";
    const targetQty = task.targetQuantity || 1;
    const completedQty = task.completedQuantity || 0;
    const pct = Math.min(100, Math.round((completedQty / targetQty) * 100));
    const overdue = isOverdue(task.dueDate) && task.status !== "completed";
    const isExpanded = !!expandedTaskIds[task.id];
    const nextStatus = nextStatusMap[task.status];
    const prevStatus = prevStatusMap[task.status];
    const isBeingDragged = draggedTaskId === task.id;
    const isSelected = selectedTaskIds.includes(task.id);
    const { blocked, blockingTasks } = isTaskBlocked(task);

    return (
      <div
        key={task.id}
        draggable
        onDragStart={(e) => handleDragStart(e, task.id)}
        onDragEnd={handleDragEnd}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleDrop(e, task.status);
        }}
        onClick={() => setSelectedTaskId(task.id)}
        className={cn(
          "group relative rounded-xl border bg-card p-3 shadow-soft transition-all duration-150 hover:border-primary/40 hover:shadow-md cursor-grab active:cursor-grabbing",
          isSelected ? "border-primary ring-2 ring-primary/20 bg-primary/5" : "border-border",
          isBeingDragged && "opacity-40 scale-95 border-primary"
        )}
        style={{
          borderLeft: `4px solid ${userColor}`,
        }}
      >
        {/* Card Top Meta */}
        <div className="flex items-center justify-between gap-1.5 mb-1.5">
          <div className="flex items-center gap-1.5">
            {/* Multi-select Checkbox */}
            <input
              type="checkbox"
              checked={isSelected}
              onChange={(e) => {
                e.stopPropagation();
                toggleSelectTask(task.id);
              }}
              onClick={(e) => e.stopPropagation()}
              className="rounded border-border text-primary focus:ring-primary size-3.5 cursor-pointer opacity-70 group-hover:opacity-100"
            />
            {task.adId ? (
              <span className="font-mono text-[10px] font-bold text-foreground bg-primary/10 border border-primary/25 px-1.5 py-0.5 rounded flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-primary" />
                <span>{task.taskNumber}</span>
              </span>
            ) : (
              <span className="font-mono text-[10px] font-semibold text-muted-foreground">
                {task.taskNumber}
              </span>
            )}
          </div>

          <div className="flex items-center gap-1">
            {/* Blocked Badge (Urgent/Abnormal Only) */}
            {blocked && (
              <span
                className="flex items-center gap-1 rounded bg-destructive/15 px-1.5 py-0.2 text-[9px] font-medium text-destructive"
                title={`Blocked by ${blockingTasks.map((t) => t.taskNumber).join(", ")}`}
              >
                <Lock className="size-2.5" />
                <span>Blocked</span>
              </span>
            )}

            {/* Revision Requested Badge (Urgent/Abnormal Only) */}
            {task.isRevisionRequested && (
              <span
                className="flex items-center gap-1 rounded bg-warning/15 px-1.5 py-0.2 text-[9px] font-medium text-warning"
                title={`Revision: ${task.revisionReason || "Needs updates"}`}
              >
                <RotateCcw className="size-2.5" />
                <span>Revision</span>
              </span>
            )}

            {/* Priority Badge only if Urgent or High */}
            {(task.priority === "urgent" || task.priority === "high") && (
              <PriorityBadge priority={task.priority} />
            )}

            {/* Archive / Restore subtle hover button */}
            {task.isArchived ? (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  restoreTask(task.id);
                }}
                className="size-5 rounded hover:bg-emerald-500/15 text-muted-foreground/60 hover:text-emerald-500 flex items-center justify-center transition cursor-pointer"
                title="Restore task from archive"
              >
                <RotateCcw className="size-3" />
              </button>
            ) : (
              isManagerOrAdmin && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (
                      confirm(
                        `Archive task ${task.taskNumber} ("${task.title}")? This preserves pipeline targets in Adflow.`
                      )
                    ) {
                      deleteTask(task.id);
                    }
                  }}
                  className="size-5 rounded hover:bg-amber-500/15 text-muted-foreground/40 hover:text-amber-500 flex items-center justify-center transition cursor-pointer opacity-0 group-hover:opacity-100"
                  title="Archive task (Soft Delete)"
                >
                  <Archive className="size-3" />
                </button>
              )
            )}
          </div>
        </div>

        {/* Task Title */}
        <h3 className="text-[13px] font-medium text-foreground leading-snug line-clamp-2 mb-2 group-hover:text-primary transition-colors">
          {task.title}
        </h3>

        {/* Deliverable or Target Units with 1-click + unit increment */}
        {((targetQty > 1) || task.deliverableUrl) && (
          <div className="flex items-center gap-2 mb-2.5" onClick={(e) => e.stopPropagation()}>
            {targetQty > 1 && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono bg-muted/80 text-muted-foreground border border-border/60">
                <span>{completedQty}/{targetQty} units</span>
                <span className="text-[9px] opacity-70">({pct}%)</span>
                {completedQty < targetQty && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      updateTaskProgress(task.id, completedQty + 1);
                    }}
                    className="ml-0.5 size-3.5 rounded bg-primary/20 text-primary hover:bg-primary hover:text-white flex items-center justify-center font-bold text-[10px] transition cursor-pointer"
                    title="Increment 1 unit completed"
                  >
                    +
                  </button>
                )}
              </span>
            )}
            {task.deliverableUrl && (
              <a
                href={task.deliverableUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-[10px] text-primary/80 hover:text-primary truncate underline"
              >
                <Tag className="size-2.5" />
                <span>Deliverable</span>
              </a>
            )}
          </div>
        )}

        {/* Manager Approval Actions on In Review Tasks */}
        {task.status === "in_review" && isManagerOrAdmin && (
          <div
            className="flex items-center gap-1.5 mb-2.5 p-1.5 rounded-lg border border-primary/20 bg-primary/5"
            onClick={(e) => e.stopPropagation()}
          >
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => approveTask(task.id)}
              className="h-6 text-[10px] gap-1 flex-1 bg-success hover:bg-success/90 text-white"
            >
              <Check className="size-3" />
              <span>Approve</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                const reason = prompt("Enter revision reason (e.g. Audio sync, hook pacing, color grading):");
                if (reason) requestRevision(task.id, reason);
              }}
              className="h-6 text-[10px] gap-1 flex-1 border-warning/30 text-warning hover:bg-warning/10"
            >
              <RotateCcw className="size-3" />
              <span>Revisions</span>
            </Button>
          </div>
        )}

        {/* Notion Card Footer: Assignee & Due Date (Matches Notion exactly) */}
        <div className="flex flex-col gap-1.5 pt-2 border-t border-border/40 text-xs">
          {/* Assignee Row: Avatar + Name + Employee Code */}
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="size-5 rounded-full font-semibold text-[9px] flex items-center justify-center shrink-0 ring-1"
              style={{
                backgroundColor: `${userColor}20`,
                color: userColor,
                borderColor: `${userColor}40`,
              }}
              title={`Assigned to ${assignee?.name || "Unassigned"} (${empCode || "N/A"})`}
            >
              {assignee?.avatar || "?"}
            </div>
            <span className="text-xs text-foreground/80 truncate">
              {assignee?.name || "Unassigned"}
            </span>
            {empCode && (
              <span
                className="font-mono text-[9px] font-semibold px-1 rounded shrink-0 ml-auto"
                style={{
                  backgroundColor: `${userColor}15`,
                  color: userColor,
                }}
              >
                {empCode}
              </span>
            )}
          </div>

          {/* Due Date Row: Notion style date */}
          <div
            className={cn(
              "flex items-center gap-1.5 text-[11px] pt-0.5",
              overdue
                ? "text-destructive font-medium"
                : "text-muted-foreground"
            )}
          >
            <Calendar className="size-3 shrink-0 opacity-70" />
            <span>{formatDate(task.dueDate)}</span>
            {overdue && (
              <span className="text-[10px] font-semibold bg-destructive/10 text-destructive px-1 rounded ml-1">
                Overdue
              </span>
            )}
          </div>

          {/* Interactive Notion Status Pill & Member Quick Advance */}
          <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-border/30" onClick={(e) => e.stopPropagation()}>
            <div className="relative inline-flex items-center">
              <div
                className={cn(
                  "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-semibold border transition cursor-pointer select-none",
                  task.status === "completed"
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/20"
                    : task.status === "in_review"
                    ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25 hover:bg-amber-500/20"
                    : task.status === "in_progress"
                    ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25 hover:bg-blue-500/20"
                    : task.status === "todo"
                    ? "bg-zinc-500/10 text-zinc-600 dark:text-zinc-300 border-zinc-500/20 hover:bg-zinc-500/20"
                    : "bg-muted text-muted-foreground border-border hover:bg-muted/80"
                )}
                title="Click to update status"
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full shrink-0",
                    task.status === "completed"
                      ? "bg-emerald-500"
                      : task.status === "in_review"
                      ? "bg-amber-500"
                      : task.status === "in_progress"
                      ? "bg-blue-500"
                      : task.status === "todo"
                      ? "bg-zinc-400"
                      : "bg-muted-foreground"
                  )}
                />
                <span>
                  {task.status === "in_progress"
                    ? "In Progress"
                    : task.status === "in_review"
                    ? "In Review"
                    : task.status === "completed"
                    ? "Done"
                    : task.status === "todo"
                    ? "To Do"
                    : "Backlog"}
                </span>
                <ChevronDown className="size-2.5 opacity-60 ml-0.5" />
              </div>

              {/* Native transparent select for 1-click updates */}
              <select
                value={task.status}
                onChange={(e) => {
                  e.stopPropagation();
                  updateTask(task.id, { status: e.target.value as TaskStatus });
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer text-xs"
                title="Change status"
              >
                <option value="backlog">Backlog</option>
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="in_review">In Review</option>
                <option value="completed">Done</option>
              </select>
            </div>

            {/* Quick advance shortcut */}
            {task.status === "todo" && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  updateTask(task.id, { status: "in_progress" });
                }}
                className="text-[10px] font-semibold text-primary hover:bg-primary/10 px-2 py-0.5 rounded border border-primary/25 cursor-pointer transition flex items-center gap-0.5"
                title="Start working"
              >
                <span>Start</span>
                <ChevronRight className="size-2.5" />
              </button>
            )}

            {task.status === "in_progress" && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  updateTask(task.id, { status: "in_review" });
                }}
                className="text-[10px] font-semibold text-amber-500 hover:bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/25 cursor-pointer transition flex items-center gap-0.5"
                title="Submit for review"
              >
                <span>Review</span>
                <ChevronRight className="size-2.5" />
              </button>
            )}

            {task.status === "backlog" && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  updateTask(task.id, { status: "todo" });
                }}
                className="text-[10px] font-semibold text-muted-foreground hover:bg-muted px-2 py-0.5 rounded border border-border cursor-pointer transition"
              >
                <span>To Do</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Distinct active members who have tasks or active team roles
  const activeMembers = users.filter(
    (u) =>
      u.active !== false &&
      !u.deletedAt &&
      (filteredTasks.some((t) => t.assigneeId === u.id) || u.role === "editor" || u.role === "content_creator")
  );

  return (
    <div className="space-y-4">
      {/* Board Top Toolbar: Layout Switcher & Bulk Tick */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-foreground select-none rounded-lg border border-border bg-card px-2.5 py-1.5 hover:bg-muted transition shadow-2xs">
            <input
              type="checkbox"
              checked={filteredTasks.length > 0 && selectedTaskIds.length === filteredTasks.length}
              onChange={(e) => selectAllFilteredTasks(e.target.checked)}
              className="rounded border-border text-primary focus:ring-primary size-3.5 cursor-pointer"
            />
            <span>Bulk Tick ({selectedTaskIds.length}/{filteredTasks.length})</span>
          </label>

          <div className="text-xs text-muted-foreground hidden sm:block">
            Showing <strong>{filteredTasks.length}</strong> tasks across {boardLayout === "swimlanes" ? `${activeMembers.length} member swimlanes` : "5 workflow stages"}.
          </div>
        </div>

        <div className="flex items-center gap-2">
          {boardLayout === "swimlanes" && (
            <button
              type="button"
              onClick={() => {
                const anyCollapsed = Object.values(collapsedSwimlanes).some(Boolean);
                if (anyCollapsed) {
                  setCollapsedSwimlanes({});
                } else {
                  const allCollapsed: Record<string, boolean> = {};
                  activeMembers.forEach((m) => {
                    allCollapsed[m.id] = true;
                  });
                  setCollapsedSwimlanes(allCollapsed);
                }
              }}
              className="rounded-lg border border-border bg-card px-2.5 py-1 text-xs font-medium text-muted-foreground hover:text-foreground transition cursor-pointer"
            >
              {Object.values(collapsedSwimlanes).some(Boolean) ? "Expand All" : "Collapse All"}
            </button>
          )}

          <div className="flex items-center gap-1.5 rounded-lg border border-border bg-muted/30 p-1">
            <button
              type="button"
              onClick={() => setBoardLayout("columns")}
              className={cn(
                "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition cursor-pointer",
                boardLayout === "columns"
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Columns className="size-3.5" />
              <span>Columns</span>
            </button>

            <button
              type="button"
              onClick={() => setBoardLayout("swimlanes")}
              className={cn(
                "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition cursor-pointer",
                boardLayout === "swimlanes"
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Rows className="size-3.5" />
              <span>Member Swimlanes</span>
            </button>
          </div>
        </div>
      </div>

      {/* 1. STANDARD COLUMNS LAYOUT */}
      {boardLayout === "columns" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 items-start">
          {COLUMNS.map((column) => {
            const columnTasks = filteredTasks.filter((t) => t.status === column.id);
            const isHovered = dragOverColumn === column.id;
            const isColAllSelected =
              columnTasks.length > 0 &&
              columnTasks.every((t) => selectedTaskIds.includes(t.id));

            return (
              <div
                key={column.id}
                onDragOver={(e) => handleDragOver(e, column.id)}
                onDragLeave={(e) => {
                  if (e.currentTarget === e.target) {
                    setDragOverColumn(null);
                  }
                }}
                onDrop={(e) => handleDrop(e, column.id)}
                className={cn(
                  "flex flex-col rounded-xl border bg-card/40 dark:bg-zinc-900/40 p-3 min-w-[250px] shadow-xs transition-colors duration-150 min-h-[320px]",
                  isHovered
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : "border-border/70 dark:border-zinc-800/80"
                )}
              >
                {/* Notion Column Header */}
                <div className="flex items-center justify-between pb-2 mb-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={isColAllSelected}
                      onChange={(e) =>
                        selectTasks(columnTasks.map((t) => t.id), e.target.checked)
                      }
                      className="rounded border-border text-primary focus:ring-primary size-3.5 cursor-pointer opacity-50 hover:opacity-100"
                      title={`Bulk select all ${columnTasks.length} tasks in ${column.label}`}
                    />
                    <div
                      className={cn(
                        "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide",
                        column.pillBg
                      )}
                    >
                      <span className={cn("size-2 rounded-full shrink-0", column.dotColor)} />
                      <span>{column.label}</span>
                      <span className="text-[10px] font-mono opacity-80 ml-0.5">
                        {columnTasks.length}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => openCreateModal(undefined, column.id)}
                    className="text-muted-foreground/60 hover:text-foreground transition p-1 rounded-md hover:bg-muted/50 cursor-pointer"
                    title={`Add task to ${column.label}`}
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>

                {/* Column Cards */}
                <div
                  onDragOver={(e) => handleDragOver(e, column.id)}
                  onDrop={(e) => handleDrop(e, column.id)}
                  className="space-y-2.5 min-h-[160px] flex-1 flex flex-col"
                >
                  {(() => {
                    const today = dateInTargetTimeZone();
                    const isDoneCol = column.id === "completed";
                    const activeTasks = isDoneCol
                      ? columnTasks.filter((t) => t.dueDate >= today)
                      : columnTasks;
                    const pastTasks = isDoneCol
                      ? columnTasks.filter((t) => t.dueDate < today)
                      : [];
                    const isPastOpen = Boolean(showPastCompleted[column.id]);

                    return (
                      <>
                        {activeTasks.map((task) => renderCard(task))}

                        {/* Past Completed Collapsible */}
                        {isDoneCol && pastTasks.length > 0 && (
                          <div className="pt-1">
                            <button
                              type="button"
                              onClick={() => togglePast(column.id)}
                              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border border-border/70 bg-muted/20 hover:bg-muted/40 text-[11px] text-muted-foreground transition cursor-pointer select-none"
                            >
                              <span className="flex items-center gap-1.5 font-medium">
                                <RotateCcw className="size-3 text-muted-foreground/70" />
                                <span>Past Completed ({pastTasks.length})</span>
                              </span>
                              <ChevronDown
                                className={cn(
                                  "size-3 transition-transform",
                                  isPastOpen && "rotate-180"
                                )}
                              />
                            </button>
                            {isPastOpen && (
                              <div className="space-y-2.5 pt-2">
                                {pastTasks.map((task) => renderCard(task))}
                              </div>
                            )}
                          </div>
                        )}
                      </>
                    );
                  })()}

                  {/* Notion + New task button */}
                  <button
                    type="button"
                    onClick={() => openCreateModal(undefined, column.id)}
                    className="flex items-center gap-1.5 w-full py-2 px-3 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded-lg transition text-left mt-1 border border-dashed border-border/60 hover:border-border cursor-pointer group"
                  >
                    <Plus className="size-3.5 text-muted-foreground group-hover:text-foreground" />
                    <span>New task</span>
                  </button>

                  {columnTasks.length === 0 && (
                    <div className="flex-1 rounded-lg border border-dashed border-border/60 p-5 flex items-center justify-center text-center text-xs text-muted-foreground/70">
                      Drop tasks here
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* 2. MEMBER SWIMLANES LAYOUT */}
      {boardLayout === "swimlanes" && (
        <div className="space-y-4">
          {activeMembers.map((member) => {
            const memberTasks = filteredTasks.filter((t) => t.assigneeId === member.id);
            const isCollapsed = !!collapsedSwimlanes[member.id];
            const capacity = getMemberCapacity(member.id);
            const memberEmpCode = member.employeeCode || getEmployeeCode(member.name);
            const memberColor = getUserColor(memberEmpCode, member.color);

            return (
              <div
                key={member.id}
                className="rounded-2xl border border-border bg-card shadow-xs overflow-hidden"
              >
                {/* Swimlane Header */}
                <div
                  onClick={() => toggleSwimlane(member.id)}
                  className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border cursor-pointer select-none hover:bg-muted/50 transition"
                >
                  <div className="flex items-center gap-3">
                    <ChevronDown
                      className={cn(
                        "size-4 text-muted-foreground transition-transform",
                        isCollapsed && "-rotate-90"
                      )}
                    />
                    <div
                      className="size-7 rounded-full font-semibold text-xs flex items-center justify-center ring-2 shrink-0"
                      style={{
                        backgroundColor: `${memberColor}20`,
                        color: memberColor,
                        borderColor: `${memberColor}50`,
                      }}
                    >
                      {member.avatar}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-foreground">
                          {member.name}
                        </span>
                        <span
                          className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded"
                          style={{
                            backgroundColor: `${memberColor}15`,
                            color: memberColor,
                          }}
                        >
                          {memberEmpCode}
                        </span>
                        <span className="text-[10px] font-mono uppercase bg-muted px-1.5 py-0.2 rounded text-muted-foreground">
                          {member.role.replace("_", " ")}
                        </span>
                      </div>
                      <span className="text-[11px] text-muted-foreground">
                        {memberTasks.length} tasks · {capacity.current} / {capacity.max} daily target units
                      </span>
                    </div>
                  </div>

                  {/* Capacity Meter & Quick Assign */}
                  <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => openCreateModal(member.id)}
                      className="flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-foreground hover:bg-muted transition shadow-2xs cursor-pointer"
                      title={`Assign task directly to ${member.name}`}
                    >
                      <Plus className="size-3 text-primary" />
                      <span>Assign</span>
                    </button>

                    <div className="w-16 bg-muted rounded-full h-1.5 overflow-hidden hidden sm:block">
                      <div
                        className={cn(
                          "h-full rounded-full transition-all duration-300",
                          capacity.isOverAllocated
                            ? "bg-warning"
                            : capacity.percent >= 80
                            ? "bg-primary"
                            : "bg-success"
                        )}
                        style={{ width: `${Math.min(100, capacity.percent)}%` }}
                      />
                    </div>

                    {capacity.isOverAllocated ? (
                      <span className="flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-semibold text-warning">
                        <AlertCircle className="size-3" />
                        <span>Over Capacity ({capacity.current}/{capacity.max})</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {capacity.percent}% Bandwidth
                      </span>
                    )}
                  </div>
                </div>

                {/* Swimlane Columns Grid */}
                {!isCollapsed && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 p-3 bg-card/40">
                    {COLUMNS.map((column) => {
                      const swimlaneTasks = memberTasks.filter((t) => t.status === column.id);
                      const key = `${member.id}-${column.id}`;
                      const isHovered = dragOverColumn === key;

                      return (
                        <div
                          key={column.id}
                          onDragOver={(e) => handleDragOver(e, key)}
                          onDragLeave={(e) => {
                            if (e.currentTarget === e.target) {
                              setDragOverColumn(null);
                            }
                          }}
                          onDrop={(e) => handleDrop(e, column.id, member.id)}
                          className={cn(
                            "rounded-xl border p-2.5 min-h-[110px] transition-colors flex flex-col",
                            isHovered
                              ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                              : "border-border/60 bg-muted/10"
                          )}
                        >
                          <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground pb-2 border-b border-border/40 mb-2">
                            <span className="flex items-center gap-1.5">
                              <input
                                type="checkbox"
                                checked={
                                  swimlaneTasks.length > 0 &&
                                  swimlaneTasks.every((t) => selectedTaskIds.includes(t.id))
                                }
                                onChange={(e) =>
                                  selectTasks(
                                    swimlaneTasks.map((t) => t.id),
                                    e.target.checked
                                  )
                                }
                                className="rounded border-border text-primary focus:ring-primary size-3 cursor-pointer"
                                title={`Bulk select all tasks in ${column.label}`}
                              />
                              <span className={cn("size-1.5 rounded-full", column.dotColor)} />
                              <span>{column.label}</span>
                            </span>
                            <span className="font-mono text-[10px]">{swimlaneTasks.length}</span>
                          </div>

                          <div
                            onDragOver={(e) => handleDragOver(e, key)}
                            onDrop={(e) => handleDrop(e, column.id, member.id)}
                            className="space-y-2 flex-1 min-h-[50px] flex flex-col"
                          >
                            {(() => {
                              const today = dateInTargetTimeZone();
                              const isDoneCol = column.id === "completed";
                              const activeTasks = isDoneCol
                                ? swimlaneTasks.filter((t) => t.dueDate >= today)
                                : swimlaneTasks;
                              const pastTasks = isDoneCol
                                ? swimlaneTasks.filter((t) => t.dueDate < today)
                                : [];
                              const isPastOpen = Boolean(showPastCompleted[key]);

                              return (
                                <>
                                  {activeTasks.map((task) => renderCard(task))}

                                  {isDoneCol && pastTasks.length > 0 && (
                                    <div className="pt-1">
                                      <button
                                        type="button"
                                        onClick={() => togglePast(key)}
                                        className="w-full flex items-center justify-between px-2 py-1 rounded border border-border/60 bg-muted/20 hover:bg-muted/40 text-[10px] text-muted-foreground transition cursor-pointer select-none"
                                      >
                                        <span className="flex items-center gap-1 font-medium">
                                          <RotateCcw className="size-2.5 text-muted-foreground/70" />
                                          <span>Past ({pastTasks.length})</span>
                                        </span>
                                        <ChevronDown
                                          className={cn(
                                            "size-2.5 transition-transform",
                                            isPastOpen && "rotate-180"
                                          )}
                                        />
                                      </button>
                                      {isPastOpen && (
                                        <div className="space-y-2 pt-1.5">
                                          {pastTasks.map((task) => renderCard(task))}
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </>
                              );
                            })()}

                            {swimlaneTasks.length === 0 && (
                              <div className="flex-1 min-h-[45px] border border-dashed border-border/50 rounded-lg flex items-center justify-center text-[10px] text-muted-foreground">
                                Empty
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
