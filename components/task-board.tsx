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
  ExternalLink,
  Sparkles,
  History,
} from "lucide-react";
import { Task, TaskStatus, User, RoleTemplate } from "@/lib/types";
import { isAdFlowLinkedTask, useTasks } from "@/lib/store";
import { dateInTargetTimeZone } from "@/lib/supabase";
import {
  ADFLOW_PRODUCTION_STAGES,
  getAdFlowStatusesByColumn,
  type AdFlowProductionStage,
} from "@/lib/adflow-bridge";
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
    templates,
    activeTemplateId,
    setActiveTemplateId,
    setIsRoleTemplateModalOpen,
    archiveCompletedTasks,
    filter,
    setFilter,
    adflowStageMapping,
  } = useTasks();

  const statusesByColumn = getAdFlowStatusesByColumn(adflowStageMapping);

  const [expandedTaskIds, setExpandedTaskIds] = useState<Record<string, boolean>>({});
  const [collapsedSwimlanes, setCollapsedSwimlanes] = useState<Record<string, boolean>>({});
  const [showPastCompleted, setShowPastCompleted] = useState<Record<string, boolean>>({});
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [activeStageFilter, setActiveStageFilter] = useState<string | null>(null);
  const [cardRevisionTaskId, setCardRevisionTaskId] = useState<string | null>(null);
  const [cardRevisionTarget, setCardRevisionTarget] = useState<"creator" | "editor">("editor");
  const [cardRevisionNote, setCardRevisionNote] = useState("");
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
  const handleDragStart = (e: React.DragEvent, task: Task) => {
    if (isAdFlowLinkedTask(task)) {
      e.preventDefault();
      return;
    }
    draggedTaskIdRef.current = task.id;
    setDraggedTaskId(task.id);
    e.dataTransfer.setData("text/plain", task.id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnd = () => {
    draggedTaskIdRef.current = null;
    setDraggedTaskId(null);
    setDragOverColumn(null);
  };

  const handleDragOver = (e: React.DragEvent, key: string) => {
    if (!draggedTaskIdRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    if (dragOverColumn !== key) {
      setDragOverColumn(key);
    }
  };

  const handleDrop = (
    e: React.DragEvent,
    columnId: TaskStatus,
    targetUserId?: string,
    targetSubColumnId?: string,
    targetProductionStage?: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOverColumn(null);
    const taskId = draggedTaskIdRef.current;
    draggedTaskIdRef.current = null;
    setDraggedTaskId(null);

    if (taskId) {
      const taskObj = tasks.find((t) => t.id === taskId);
      if (taskObj && !isAdFlowLinkedTask(taskObj)) {
        if (
          taskObj.status === columnId &&
          (!targetUserId || taskObj.assigneeId === targetUserId) &&
          (!targetSubColumnId || taskObj.subColumnId === targetSubColumnId) &&
          (!targetProductionStage || taskObj.productionStage === targetProductionStage)
        ) {
          return;
        }

        const updates: Partial<Task> = { status: columnId };
        if (targetUserId) {
          updates.assigneeId = targetUserId;
        }
        if (targetSubColumnId !== undefined) {
          updates.subColumnId = targetSubColumnId;
          updates.parentColumnId = columnId;
        }
        if (targetProductionStage) {
          updates.productionStage = targetProductionStage;
        } else if (
          targetSubColumnId &&
          ADFLOW_PRODUCTION_STAGES.some((s) => s.id === targetSubColumnId)
        ) {
          updates.productionStage = targetSubColumnId;
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
    const linked = isAdFlowLinkedTask(task);
    const isBeingDragged = draggedTaskId === task.id;
    const isSelected = selectedTaskIds.includes(task.id);
    const { blocked, blockingTasks } = isTaskBlocked(task);

    return (
      <div
        key={task.id}
        draggable={!linked}
        title={linked ? "Open the creative to use its workflow actions." : undefined}
        onDragStart={(e) => handleDragStart(e, task)}
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
          "group relative rounded-xl border bg-card p-3 shadow-soft transition-all duration-150 hover:border-primary/40 hover:shadow-md",
          linked ? "cursor-pointer" : "cursor-grab active:cursor-grabbing",
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
                    if (confirm(`Archive task ${task.taskNumber}?`)) {
                      deleteTask(task.id);
                    }
                  }}
                  className="size-5 rounded hover:bg-amber-500/15 text-muted-foreground/40 hover:text-amber-500 flex items-center justify-center transition cursor-pointer opacity-0 group-hover:opacity-100"
                  title="Archive task"
                >
                  <Archive className="size-3" />
                </button>
              )
            )}
          </div>
        </div>

        {/* Compact AdFlow Badge, Stage & Sub-Column Tag */}
        {(task.adId || task.productionStage || task.subColumnId) && (
          <div className="flex items-center gap-1 mb-1.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
            {task.adId && (
              <span
                className="inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[9px] font-semibold bg-primary/15 text-primary border border-primary/25"
                title="Read-Only AdFlow Sync (Local Task Updates Enabled)"
              >
                <span className="size-1 rounded-full bg-primary" />
                <span>AdFlow</span>
              </span>
            )}
            {task.productionStage && (
              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-mono uppercase bg-muted text-muted-foreground border border-border">
                {task.productionStage.replace(/_/g, " ")}
              </span>
            )}
            {task.subColumnId && (
              <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-medium bg-sky-500/10 text-sky-400 border border-sky-500/20">
                {task.subColumnId.replace(/^(dev|cc|ed|mb)-/, "").replace(/-/g, " ")}
              </span>
            )}
          </div>
        )}

        {/* Task Title */}
        <h3 className="text-[13px] font-medium text-foreground leading-snug line-clamp-2 mb-2 group-hover:text-primary transition-colors">
          {task.title}
        </h3>

        {/* Deliverable or Target Units with 1-click + unit increment */}
        {((targetQty > 1) || task.deliverableUrl) && (
          <div className="flex items-center gap-2 mb-2.5 flex-wrap" onClick={(e) => e.stopPropagation()}>
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
                className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded hover:bg-emerald-500/20 transition truncate"
                title="Open Deliverable Video / Drive link"
              >
                <ExternalLink className="size-2.5" />
                <span>Drive Deliverable</span>
              </a>
            )}
          </div>
        )}

        {/* Manager Approval & Revision Actions on In Review / Creative Tasks */}
        {(task.status === "in_review" || task.adId || task.creativeName) && isManagerOrAdmin && (
          <div
            className="mb-2.5 p-1.5 rounded-lg border border-primary/20 bg-primary/5 space-y-1.5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => approveTask(task.id)}
                disabled={task.status === "completed" && task.productionStage === "approved"}
                className="h-6 text-[10px] gap-1 flex-1 bg-success hover:bg-success/90 text-white cursor-pointer"
              >
                <Check className="size-3" />
                <span>{task.status === "completed" ? "Approved" : "Approve"}</span>
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  if (cardRevisionTaskId === task.id) {
                    setCardRevisionTaskId(null);
                  } else {
                    setCardRevisionTaskId(task.id);
                    setCardRevisionTarget("editor");
                    setCardRevisionNote("");
                  }
                }}
                className="h-6 text-[10px] gap-1 flex-1 border-warning/30 text-warning hover:bg-warning/10 cursor-pointer"
              >
                <RotateCcw className="size-3" />
                <span>Revisions</span>
              </Button>
            </div>

            {cardRevisionTaskId === task.id && (
              <div className="pt-1.5 border-t border-border/50 space-y-1.5 text-[10px]">
                <div className="grid grid-cols-2 gap-1">
                  <button
                    type="button"
                    onClick={() => setCardRevisionTarget("editor")}
                    className={cn(
                      "px-1.5 py-1 rounded border font-semibold transition cursor-pointer",
                      cardRevisionTarget === "editor"
                        ? "bg-amber-500/20 text-amber-500 border-amber-500/50"
                        : "bg-card text-muted-foreground border-border"
                    )}
                  >
                    To Editor
                  </button>
                  <button
                    type="button"
                    onClick={() => setCardRevisionTarget("creator")}
                    className={cn(
                      "px-1.5 py-1 rounded border font-semibold transition cursor-pointer",
                      cardRevisionTarget === "creator"
                        ? "bg-amber-500/20 text-amber-500 border-amber-500/50"
                        : "bg-card text-muted-foreground border-border"
                    )}
                  >
                    To Creator
                  </button>
                </div>
                <input
                  type="text"
                  placeholder={`Note for ${cardRevisionTarget === "creator" ? "Content Creator" : "Video Editor"}...`}
                  value={cardRevisionNote}
                  onChange={(e) => setCardRevisionNote(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && cardRevisionNote.trim()) {
                      e.preventDefault();
                      requestRevision(
                        task.id,
                        cardRevisionTarget === "creator"
                          ? "Creator Changes Requested"
                          : "Editor Changes Requested",
                        cardRevisionNote.trim(),
                        cardRevisionTarget
                      );
                      setCardRevisionTaskId(null);
                      setCardRevisionNote("");
                    }
                  }}
                  className="w-full rounded border border-border bg-card px-2 py-1 text-[10px] text-foreground outline-none focus:border-primary"
                />
                <div className="flex items-center justify-end gap-1">
                  <button
                    type="button"
                    onClick={() => setCardRevisionTaskId(null)}
                    className="px-2 py-0.5 rounded text-[10px] text-muted-foreground hover:bg-muted cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const note = cardRevisionNote.trim() || "Changes requested from Task Manager";
                      requestRevision(
                        task.id,
                        cardRevisionTarget === "creator"
                          ? "Creator Changes Requested"
                          : "Editor Changes Requested",
                        note,
                        cardRevisionTarget
                      );
                      setCardRevisionTaskId(null);
                      setCardRevisionNote("");
                    }}
                    className="px-2 py-0.5 rounded bg-amber-500 text-white font-semibold text-[10px] hover:bg-amber-600 cursor-pointer"
                  >
                    Send to {cardRevisionTarget === "creator" ? "Creator" : "Editor"}
                  </button>
                </div>
              </div>
            )}
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

          {/* Individual Per-Task Stage History (Card-Only) */}
          {(() => {
            const historyList =
              task.stageHistory && task.stageHistory.length > 0
                ? task.stageHistory
                : [
                    {
                      stage: task.status,
                      label:
                        task.status === "completed"
                          ? "Done"
                          : task.status === "in_review"
                            ? "In Review"
                            : task.status === "in_progress"
                              ? "In Progress"
                              : task.status === "todo"
                                ? "To Do"
                                : "Backlog",
                      timestamp: task.createdAt,
                    },
                  ];

            return (
              <div
                className="pt-1.5 border-t border-border/30 space-y-1"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={(e) => toggleExpand(e, task.id)}
                  className="flex w-full items-center justify-between gap-1 text-[10px] text-muted-foreground hover:text-foreground transition cursor-pointer group/hist"
                  title="Click to toggle full stage history timestamps"
                >
                  <div className="flex items-center gap-1 min-w-0 flex-wrap">
                    <History className="size-3 shrink-0 text-primary/80" />
                    <span className="font-semibold text-foreground/80 shrink-0">
                      Stages ({historyList.length}):
                    </span>
                    <span className="truncate font-mono text-[9.5px] text-muted-foreground">
                      {historyList.map((h) => h.label).join(" → ")}
                    </span>
                  </div>
                  <ChevronDown
                    className={cn(
                      "size-3 shrink-0 opacity-60 transition-transform",
                      isExpanded && "rotate-180"
                    )}
                  />
                </button>

                {isExpanded && (
                  <div className="rounded-lg border border-border/60 bg-muted/30 p-2 space-y-1 text-[10px] animate-in fade-in duration-100">
                    {historyList.map((entry, idx) => (
                      <div
                        key={`${task.id}-hist-${idx}`}
                        className="flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className={cn(
                              "size-1.5 rounded-full shrink-0",
                              idx === historyList.length - 1
                                ? "bg-primary"
                                : "bg-muted-foreground/50"
                            )}
                          />
                          <span
                            className={cn(
                              "truncate",
                              idx === historyList.length - 1
                                ? "font-semibold text-foreground"
                                : "text-muted-foreground"
                            )}
                          >
                            {entry.label}
                          </span>
                        </div>
                        <span className="font-mono text-[9px] text-muted-foreground shrink-0">
                          {new Date(entry.timestamp).toLocaleTimeString([], {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

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
                  {task.productionStage
                    ? ADFLOW_PRODUCTION_STAGES.find((s) => s.id === task.productionStage)
                        ?.shortLabel ||
                      task.productionStage.replace(/_/g, " ")
                    : task.status === "in_progress"
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

              {/* Native transparent select for 1-click updates (5 Main Statuses + All 10 AdFlow Statuses) */}
              <select
                disabled={linked}
                value={task.productionStage ? `adflow:${task.productionStage}` : task.status}
                onChange={(e) => {
                  e.stopPropagation();
                  const val = e.target.value;
                  if (val.startsWith("adflow:")) {
                    const stgId = val.replace("adflow:", "") as AdFlowProductionStage;
                    const stgDef = ADFLOW_PRODUCTION_STAGES.find((s) => s.id === stgId);
                    const mappedStatus =
                      adflowStageMapping?.stageToColumn?.[stgId] ||
                      (stgDef ? stgDef.taskStatus : task.status);
                    updateTask(task.id, {
                      status: mappedStatus,
                      productionStage: stgId,
                      isRevisionRequested:
                        stgId === "creator_changes_requested" || stgId === "changes_requested",
                    });
                  } else {
                    updateTask(task.id, { status: val as TaskStatus });
                  }
                }}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer text-xs"
                title="Change status or AdFlow production stage"
              >
                <optgroup label="Main Board Statuses (5)">
                  <option value="backlog">Backlog</option>
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="in_review">In Review</option>
                  <option value="completed">Done</option>
                </optgroup>
                <optgroup label="Backlog · AdFlow Statuses">
                  {statusesByColumn.backlog.map((s) => (
                    <option key={s.id} value={`adflow:${s.id}`}>
                      {s.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="To Do · AdFlow Statuses">
                  {statusesByColumn.todo.map((s) => (
                    <option key={s.id} value={`adflow:${s.id}`}>
                      {s.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="In Progress · AdFlow Statuses">
                  {statusesByColumn.in_progress.map((s) => (
                    <option key={s.id} value={`adflow:${s.id}`}>
                      {s.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="In Review · AdFlow Statuses">
                  {statusesByColumn.in_review.map((s) => (
                    <option key={s.id} value={`adflow:${s.id}`}>
                      {s.label}
                    </option>
                  ))}
                </optgroup>
                <optgroup label="Done · AdFlow Statuses">
                  {statusesByColumn.completed.map((s) => (
                    <option key={s.id} value={`adflow:${s.id}`}>
                      {s.label}
                    </option>
                  ))}
                </optgroup>
              </select>
            </div>

            {/* Quick advance shortcut */}
            {!linked && task.status === "todo" && (
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

            {!linked && task.status === "in_progress" && (
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

            {!linked && task.status === "backlog" && (
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

  // All active team members synced from AdFlow
  const activeMembers = users.filter(
    (u) => u.active !== false && !u.deletedAt
  );

  return (
    <div className="space-y-3">
      {/* Board Top Toolbar: Layout Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-1">
        <div className="flex items-center gap-2 flex-wrap">
          {filteredTasks.length > 0 && (
            <label className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground select-none rounded-lg border border-border bg-card px-2.5 py-1 transition">
              <input
                type="checkbox"
                checked={
                  filteredTasks.length > 0 &&
                  selectedTaskIds.length === filteredTasks.length
                }
                onChange={(e) => selectAllFilteredTasks(e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary size-3.5 cursor-pointer"
              />
              <span>
                Select ({selectedTaskIds.length}/{filteredTasks.length})
              </span>
            </label>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {boardLayout === "swimlanes" && activeMembers.length > 0 && (
            <button
              type="button"
              onClick={() => {
                const anyCollapsed =
                  Object.values(collapsedSwimlanes).some(Boolean);
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
              {Object.values(collapsedSwimlanes).some(Boolean)
                ? "Expand All"
                : "Collapse All"}
            </button>
          )}

          {boardLayout === "subcolumns" && (
            <div className="flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-xs">
              <select
                value={activeTemplateId || "adflow-pipeline"}
                onChange={(e) => setActiveTemplateId(e.target.value || null)}
                className="bg-transparent text-xs font-semibold text-foreground border-none outline-none cursor-pointer pr-1"
              >
                <option value="adflow-pipeline">AdFlow 10-Status Pipeline</option>
                {templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-0.5">
            <button
              type="button"
              onClick={() => setBoardLayout("columns")}
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition cursor-pointer",
                boardLayout === "columns"
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Columns className="size-3.5" />
              <span>Board</span>
            </button>

            <button
              type="button"
              onClick={() => setBoardLayout("subcolumns")}
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition cursor-pointer",
                boardLayout === "subcolumns"
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
              title="Role Sub-Columns"
            >
              <Layers className="size-3.5" />
              <span>Sub-Columns</span>
            </button>

            <button
              type="button"
              onClick={() => setBoardLayout("swimlanes")}
              className={cn(
                "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition cursor-pointer",
                boardLayout === "swimlanes"
                  ? "bg-card text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Rows className="size-3.5" />
              <span>Swimlanes</span>
            </button>
          </div>
        </div>
      </div>

      {/* 1. STANDARD COLUMNS LAYOUT */}
      {boardLayout === "columns" && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {COLUMNS.map((column) => {
            const allColumnTasks = filteredTasks.filter((t) => t.status === column.id);
            const columnTasks = activeStageFilter &&
              statusesByColumn[column.id].some((s) => s.id === activeStageFilter)
              ? allColumnTasks.filter((t) => t.productionStage === activeStageFilter)
              : allColumnTasks;
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
                  "flex flex-col rounded-xl border bg-card/40 dark:bg-zinc-900/40 p-2.5 min-w-0 shadow-xs transition-colors duration-150 min-h-[320px]",
                  isHovered
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : "border-border/70 dark:border-zinc-800/80"
                )}
              >
                {/* Notion Column Header - STICKY STATUSES + ALL ADFLOW STATUSES */}
                <div className="sticky top-12 z-20 bg-card/95 dark:bg-zinc-900/95 backdrop-blur-md pb-2 pt-1.5 mb-2 -mt-1 -mx-2 px-2 border-b border-border/60 rounded-t-xl shadow-2xs space-y-1.5">
                  <div className="flex items-center justify-between">
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
                          "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide whitespace-nowrap",
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
                    <div className="flex items-center gap-1">
                      {column.id === "completed" &&
                        columnTasks.length > 0 &&
                        !filter.showArchived && (
                          <button
                            type="button"
                            onClick={async () => {
                              await archiveCompletedTasks();
                            }}
                            className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/25 px-2 py-0.5 rounded-md transition cursor-pointer"
                            title="Move all Done tasks out of active Overview into Done History / Archive"
                          >
                            Clear Done
                          </button>
                        )}
                      <button
                        type="button"
                        onClick={() => openCreateModal(undefined, column.id)}
                        className="text-muted-foreground/60 hover:text-foreground transition p-1 rounded-md hover:bg-muted/50 cursor-pointer"
                        title={`Add task to ${column.label}`}
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* AdFlow Statuses mapped inside this column (Drop Targets & Quick Filters) */}
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {statusesByColumn[column.id].map((stg) => {
                      const stageCount = allColumnTasks.filter(
                        (t) => t.productionStage === stg.id
                      ).length;
                      const isStageSelected = activeStageFilter === stg.id;
                      const isStageDragOver = dragOverColumn === `stage-${stg.id}`;

                      return (
                        <button
                          key={stg.id}
                          type="button"
                          onClick={() =>
                            setActiveStageFilter((prev) => (prev === stg.id ? null : stg.id))
                          }
                          onDragOver={(e) => handleDragOver(e, `stage-${stg.id}`)}
                          onDragLeave={(e) => {
                            if (e.currentTarget === e.target) setDragOverColumn(null);
                          }}
                          onDrop={(e) =>
                            handleDrop(e, column.id, undefined, undefined, stg.id)
                          }
                          className={cn(
                            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9.5px] font-medium border transition cursor-pointer select-none",
                            isStageDragOver
                              ? "border-primary bg-primary/20 text-primary ring-1 ring-primary"
                              : isStageSelected
                              ? "bg-primary/15 text-primary border-primary/40 font-bold"
                              : "bg-muted/40 text-muted-foreground border-border/60 hover:bg-muted hover:text-foreground"
                          )}
                          title={`${stg.label} — Drag a card here to set AdFlow status to "${stg.label}", or click to filter`}
                        >
                          <span
                            className="size-1.5 rounded-full shrink-0"
                            style={{ backgroundColor: stg.color }}
                          />
                          <span>{stg.shortLabel}</span>
                          {stageCount > 0 && (
                            <span className="font-mono text-[9px] opacity-80 ml-0.5">
                              {stageCount}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Column Cards */}
                <div
                  onDragOver={(e) => handleDragOver(e, column.id)}
                  onDrop={(e) => handleDrop(e, column.id)}
                  className="space-y-2.5 min-h-[160px] flex-1 flex flex-col"
                >
                  {columnTasks.map((task) => renderCard(task))}

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

      {/* 2. ROLE WORKFLOW SUB-COLUMNS LAYOUT */}
      {boardLayout === "subcolumns" && (() => {
        const adflowBuiltInTemplate: RoleTemplate = {
          id: "adflow-pipeline",
          name: "AdFlow 10-Status Pipeline",
          role: "content_creator",
          description: "All 10 AdFlow creative statuses mapped into the 5 main board statuses.",
          createdAt: "",
          updatedAt: "",
          parentColumns: COLUMNS.map((col) => ({
            id: col.id,
            label: col.label,
            subColumns: statusesByColumn[col.id].map((stg, idx) => ({
              id: stg.id,
              label: stg.label,
              parentStatus: col.id,
              color: stg.color,
              order: idx + 1,
            })),
          })),
        };

        const activeTpl =
          !activeTemplateId || activeTemplateId === "adflow-pipeline"
            ? adflowBuiltInTemplate
            : templates.find((t) => t.id === activeTemplateId) || adflowBuiltInTemplate;

        return (
          <div className="space-y-3">
            {/* Compact Role Template Header */}
            <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-xl border border-primary/20 bg-primary/5">
              <div className="flex items-center gap-2">
                <Layers className="size-3.5 text-primary" />
                <span className="text-xs font-bold text-foreground">{activeTpl.name}</span>
                <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full bg-primary/20 text-primary">
                  {activeTpl.id === "adflow-pipeline"
                    ? "10 AdFlow Statuses"
                    : activeTpl.role.replace("_", " ")}
                </span>
              </div>

              <Button
                variant="secondary"
                size="sm"
                onClick={() => setIsRoleTemplateModalOpen(true)}
                className="text-xs h-7 gap-1"
              >
                <span>Templates</span>
                <ChevronRight className="size-3" />
              </Button>
            </div>

            {/* Parent Columns Grid with Nested Sub-Columns */}
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              {activeTpl.parentColumns.map((parent) => {
                const parentTasks = filteredTasks.filter((t) => t.status === parent.id);
                const colDef = COLUMNS.find((c) => c.id === parent.id) || COLUMNS[1];

                return (
                  <div
                    key={parent.id}
                    className="flex flex-col rounded-xl border border-border/80 bg-card/40 dark:bg-zinc-900/40 p-2.5 min-w-0 shadow-xs space-y-3"
                  >
                    {/* Sticky Parent Header */}
                    <div className="sticky top-12 z-20 bg-card/95 dark:bg-zinc-900/95 backdrop-blur-md flex items-center justify-between pb-2.5 pt-1.5 -mt-1 -mx-2 px-2 border-b border-border/60 rounded-t-xl shadow-2xs">
                      <div className="flex items-center gap-2">
                        <div className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold tracking-wide whitespace-nowrap", colDef.pillBg)}>
                          <span className={cn("size-2 rounded-full shrink-0", colDef.dotColor)} />
                          <span>{parent.label}</span>
                          <span className="text-[10px] font-mono opacity-80 ml-0.5">
                            {parentTasks.length}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => openCreateModal(undefined, parent.id)}
                        className="text-muted-foreground/60 hover:text-foreground transition p-1 rounded-md hover:bg-muted/50 cursor-pointer"
                        title={`Add task to ${parent.label}`}
                      >
                        <Plus className="size-3.5" />
                      </button>
                    </div>

                    {/* Sub-Columns List under this Parent Stage */}
                    <div className="space-y-3 flex-1">
                      {parent.subColumns.map((subCol) => {
                        const isAdflowSub = activeTpl.id === "adflow-pipeline";
                        const subTasks = parentTasks.filter((t) =>
                          isAdflowSub
                            ? t.productionStage === subCol.id ||
                              (!t.productionStage && parent.subColumns[0]?.id === subCol.id)
                            : t.subColumnId === subCol.id ||
                              (!t.subColumnId && parent.subColumns[0]?.id === subCol.id)
                        );
                        const isHovered = dragOverColumn === subCol.id;

                        return (
                          <div
                            key={subCol.id}
                            onDragOver={(e) => handleDragOver(e, subCol.id)}
                            onDragLeave={(e) => {
                              if (e.currentTarget === e.target) setDragOverColumn(null);
                            }}
                            onDrop={(e) =>
                              handleDrop(
                                e,
                                parent.id,
                                undefined,
                                isAdflowSub ? undefined : subCol.id,
                                isAdflowSub ? subCol.id : undefined
                              )
                            }
                            className={cn(
                              "rounded-lg border p-2.5 bg-card/90 transition-all flex flex-col space-y-2",
                              isHovered
                                ? "border-primary bg-primary/5 ring-2 ring-primary/20 shadow-xs"
                                : "border-border/60 hover:border-border/90"
                            )}
                          >
                            {/* Sub-column header (sticky below parent stage header) */}
                            <div className="sticky top-[94px] z-10 bg-card/95 dark:bg-zinc-900/95 backdrop-blur-sm flex items-center justify-between py-1.5 -mx-1 px-1 border-b border-border/40 rounded-t">
                              <div className="flex items-center gap-1.5 min-w-0">
                                <span
                                  className="size-1.5 rounded-full shrink-0"
                                  style={{ backgroundColor: subCol.color || "#0ea5e9" }}
                                />
                                <span className="text-xs font-semibold text-foreground truncate">
                                  {subCol.label}
                                </span>
                              </div>
                              <span className="font-mono text-[9px] text-muted-foreground ml-1">
                                {subTasks.length}
                              </span>
                            </div>

                            {/* Sub-column Cards */}
                            <div className="space-y-2 flex-1">
                              {subTasks.map((task) => renderCard(task))}
                              {subTasks.length === 0 && (
                                <div className="text-[10px] text-muted-foreground/60 italic text-center py-3 border border-dashed border-border/50 rounded-md">
                                  Drop into {subCol.label}
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {parent.subColumns.length === 0 && (
                        <div className="space-y-2">
                          {parentTasks.map((task) => renderCard(task))}
                          {parentTasks.length === 0 && (
                            <div className="text-xs text-muted-foreground/60 italic text-center py-4 border border-dashed border-border/50 rounded-lg">
                              No tasks in {parent.label}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* 3. MEMBER SWIMLANES LAYOUT */}
      {boardLayout === "swimlanes" && (
        <div className="space-y-4">
          {/* Sticky Global 5-Stage Status Bar for Swimlanes */}
          <div className="sticky top-12 z-20 hidden md:grid md:grid-cols-5 gap-3 px-3 py-2.5 rounded-xl border border-border/80 bg-card/95 dark:bg-zinc-900/95 backdrop-blur-md shadow-sm">
            {COLUMNS.map((column) => {
              const colCount = filteredTasks.filter((t) => t.status === column.id).length;
              return (
                <div
                  key={column.id}
                  className="flex items-center justify-between px-2.5 py-1 rounded-lg bg-muted/30 border border-border/50"
                >
                  <div
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold tracking-wide",
                      column.pillBg
                    )}
                  >
                    <span className={cn("size-2 rounded-full shrink-0", column.dotColor)} />
                    <span>{column.label}</span>
                  </div>
                  <span className="text-xs font-mono font-bold text-muted-foreground pr-1">
                    {colCount}
                  </span>
                </div>
              );
            })}
          </div>

          {activeMembers.map((member) => {
            const memberTasks = filteredTasks.filter((t) => t.assigneeId === member.id);
            const isCollapsed = !!collapsedSwimlanes[member.id];
            const capacity = getMemberCapacity(member.id);
            const memberEmpCode = member.employeeCode || getEmployeeCode(member.name);
            const memberColor = getUserColor(memberEmpCode, member.color);

            return (
              <div
                key={member.id}
                className="rounded-2xl border border-border bg-card shadow-xs"
              >
                {/* Swimlane Header */}
                <div
                  onClick={() => toggleSwimlane(member.id)}
                  className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border cursor-pointer select-none hover:bg-muted/50 transition rounded-t-2xl"
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
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-3 p-3 bg-card/40">
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
                          <div className="sticky top-[102px] z-10 bg-card/95 dark:bg-zinc-900/95 backdrop-blur-sm flex items-center justify-between text-[11px] font-medium text-muted-foreground pb-2 pt-1 border-b border-border/40 mb-2 -mt-1 -mx-1 px-1 rounded-t-lg">
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
                            {swimlaneTasks.map((task) => renderCard(task))}

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
