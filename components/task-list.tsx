"use client";

import React, { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  CheckSquare,
  Square,
  Plus,
  Calendar,
  User as UserIcon,
  Tag,
  CheckCircle2,
  Clock,
  Trash2,
  Archive,
  RotateCcw,
} from "lucide-react";
import { Task, Subtask } from "@/lib/types";
import { useTasks } from "@/lib/store";
import { StatusBadge, PriorityBadge } from "./ui/badge";
import { ProgressBar } from "./ui/progress-bar";
import { Button } from "./ui/button";
import { Input } from "./ui/field";
import { calculateProgress, formatDate, isOverdue, cn } from "@/lib/utils";

export function TaskList() {
  const {
    filteredTasks,
    users,
    setSelectedTaskId,
    toggleSubtask,
    updateTask,
    deleteTask,
    restoreTask,
    isManagerOrAdmin,
    selectedTaskIds,
    toggleSelectTask,
    selectAllFilteredTasks,
  } = useTasks();

  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});

  const toggleRow = (taskId: string) => {
    setExpandedIds((prev) => ({
      ...prev,
      [taskId]: !prev[taskId],
    }));
  };

  const isAllSelected =
    filteredTasks.length > 0 &&
    filteredTasks.every((t) => selectedTaskIds.includes(t.id));

  return (
    <div className="space-y-3">
      {/* Top Toolbar: Bulk Tick */}
      <div className="flex items-center justify-between px-1">
        <label className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-foreground select-none rounded-lg border border-border bg-card px-2.5 py-1.5 hover:bg-muted transition shadow-2xs">
          <input
            type="checkbox"
            checked={isAllSelected}
            onChange={(e) => selectAllFilteredTasks(e.target.checked)}
            className="rounded border-border text-primary focus:ring-primary size-3.5 cursor-pointer"
          />
          <span>Bulk Tick ({selectedTaskIds.length}/{filteredTasks.length})</span>
        </label>
        <span className="text-xs text-muted-foreground">
          Showing {filteredTasks.length} checklist items
        </span>
      </div>

      {filteredTasks.map((task) => {
        const isExpanded = !!expandedIds[task.id];
        const isSelected = selectedTaskIds.includes(task.id);
        const assignee = users.find((u) => u.id === task.assigneeId);
        const targetQty = task.targetQuantity || 1;
        const completedQty = task.completedQuantity || 0;
        const pct = Math.min(100, Math.round((completedQty / targetQty) * 100));
        const overdue = isOverdue(task.dueDate) && task.status !== "completed";

        return (
          <div
            key={task.id}
            className={cn(
              "rounded-xl border bg-card shadow-xs overflow-hidden transition-all",
              isSelected ? "border-primary ring-1 ring-primary/20 bg-primary/5" : "border-border"
            )}
          >
            {/* Main Task Header Row */}
            <div className="flex flex-wrap items-center justify-between gap-3 p-3.5 hover:bg-muted/30 transition-colors">
              {/* Left Title & Expand Arrow */}
              <div className="flex items-center gap-2.5 min-w-[260px] flex-1">
                {/* Multi-select Checkbox */}
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={(e) => {
                    e.stopPropagation();
                    toggleSelectTask(task.id);
                  }}
                  className="rounded border-border text-primary focus:ring-primary size-3.5 cursor-pointer"
                />

                <button
                  type="button"
                  onClick={() => toggleRow(task.id)}
                  className="size-7 rounded-lg border border-border/80 bg-background flex items-center justify-center text-muted-foreground hover:text-foreground transition cursor-pointer"
                  title={isExpanded ? "Collapse checklist" : "Expand checklist"}
                >
                  {isExpanded ? (
                    <ChevronDown className="size-4" />
                  ) : (
                    <ChevronRight className="size-4" />
                  )}
                </button>

                <div
                  className="flex-1 cursor-pointer"
                  onClick={() => setSelectedTaskId(task.id)}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-muted-foreground">
                      {task.taskNumber}
                    </span>
                    <h3 className="text-xs sm:text-sm font-semibold text-foreground hover:text-primary transition-colors flex items-center gap-1.5">
                      <span>{task.title}</span>
                      {task.isCarried && (
                        <span className="rounded bg-warning/15 px-1.5 py-0.2 text-[9px] font-medium text-warning">
                          Carried
                        </span>
                      )}
                    </h3>
                  </div>
                  {task.description ? (
                    <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                      {task.description}
                    </p>
                  ) : null}
                </div>
              </div>

              {/* Middle Metrics & Progress */}
              <div className="flex items-center gap-3">
                <div className="w-28 hidden sm:block">
                  <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground mb-0.5">
                    <span>{completedQty} / {targetQty} units</span>
                    <span>{pct}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                    <div
                      className={cn(
                        "h-full transition-all duration-300 rounded-full",
                        pct >= 100 ? "bg-success" : pct > 0 ? "bg-primary" : "bg-muted"
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <StatusBadge status={task.status} />
                <PriorityBadge priority={task.priority} />

                {/* Assignee Avatar */}
                <div
                  className="flex items-center gap-2 min-w-[100px]"
                  title={`Assigned to ${assignee?.name}`}
                >
                  <div className="size-6 rounded-full bg-primary/15 font-semibold text-[10px] text-primary flex items-center justify-center ring-1 ring-primary/20">
                    {assignee?.avatar || "?"}
                  </div>
                  <span className="text-xs font-medium text-foreground truncate max-w-[80px]">
                    {assignee?.name || "Unassigned"}
                  </span>
                </div>

                {/* Due Date */}
                <span
                  className={cn(
                    "text-xs font-mono tabular-nums flex items-center gap-1 hidden md:flex",
                    overdue ? "text-destructive font-semibold" : "text-muted-foreground"
                  )}
                >
                  <Calendar className="size-3" />
                  {formatDate(task.dueDate)}
                </span>

                {/* Archive / Delete button */}
                {task.isArchived ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      restoreTask(task.id);
                    }}
                    className="size-7 rounded hover:bg-emerald-500/15 text-muted-foreground/60 hover:text-emerald-500 flex items-center justify-center transition cursor-pointer"
                    title="Restore task from archive"
                  >
                    <RotateCcw className="size-3.5" />
                  </button>
                ) : (
                  isManagerOrAdmin && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (
                          confirm(
                            `Archive task ${task.taskNumber} ("${task.title}")? This preserves pipeline data in Adflow.`
                          )
                        ) {
                          deleteTask(task.id);
                        }
                      }}
                      className="size-7 rounded hover:bg-amber-500/15 text-muted-foreground/60 hover:text-amber-500 flex items-center justify-center transition cursor-pointer"
                      title="Archive task (Soft Delete)"
                    >
                      <Archive className="size-3.5" />
                    </button>
                  )
                )}
              </div>
            </div>

            {/* Expanded Checklist Units */}
            {isExpanded && (
              <div className="border-t border-border bg-muted/20 px-4 py-3 pl-12 space-y-2">
                <div className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Checklist Units ({completedQty} of {targetQty} completed)
                </div>

                <div className="space-y-1.5">
                  {task.subtasks.map((st) => (
                    <div
                      key={st.id}
                      onClick={() => toggleSubtask(task.id, st.id)}
                      className="flex items-center justify-between py-1 group/st hover:text-primary transition cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5">
                        {st.completed ? (
                          <CheckSquare className="size-4 text-success shrink-0" />
                        ) : (
                          <Square className="size-4 text-muted-foreground shrink-0 group-hover/st:text-foreground" />
                        )}
                        <span
                          className={cn(
                            "text-xs select-none",
                            st.completed
                              ? "text-muted-foreground line-through"
                              : "text-foreground font-medium"
                          )}
                        >
                          {st.title}
                        </span>
                      </div>

                      {st.completed && st.completedAt && (
                        <span className="text-[10px] font-mono text-muted-foreground">
                          Done
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {filteredTasks.length === 0 && (
        <div className="rounded-xl border border-dashed border-border p-12 text-center text-xs text-muted-foreground">
          No tasks found matching your filters.
        </div>
      )}
    </div>
  );
}
