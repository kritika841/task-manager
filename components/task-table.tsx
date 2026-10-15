"use client";

import React, { useState, useMemo } from "react";
import {
  Calendar,
  CheckCircle2,
  ChevronRight,
  User as UserIcon,
  Tag,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Lock,
  RotateCcw,
  Check,
  Trash2,
  SlidersHorizontal,
  ExternalLink,
} from "lucide-react";
import { Task, TaskPriority, TaskStatus } from "@/lib/types";
import { useTasks } from "@/lib/store";
import { StatusBadge, PriorityBadge } from "./ui/badge";
import { ProgressBar } from "./ui/progress-bar";
import { calculateProgress, formatDate, isOverdue, cn } from "@/lib/utils";

type SortField =
  | "taskNumber"
  | "title"
  | "status"
  | "priority"
  | "targetQuantity"
  | "assignee"
  | "dueDate";

type SortDirection = "asc" | "desc" | null;

export function TaskTable() {
  const {
    filteredTasks,
    users,
    setSelectedTaskId,
    updateTask,
    deleteTask,
    isManagerOrAdmin,
    isTaskBlocked,
    selectedTaskIds,
    toggleSelectTask,
    selectAllFilteredTasks,
    getMemberCapacity,
    approveTask,
    requestRevision,
    density,
  } = useTasks();

  // Sorting state
  const [sortField, setSortField] = useState<SortField | null>("dueDate");
  const [sortDir, setSortDir] = useState<SortDirection>("asc");

  // Column Visibility state
  const [visibleColumns, setVisibleColumns] = useState({
    taskNumber: true,
    title: true,
    status: true,
    priority: true,
    units: true,
    assignee: true,
    dueDate: true,
    deliverable: true,
    actions: true,
  });
  const [showColumnMenu, setShowColumnMenu] = useState(false);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      if (sortDir === "asc") setSortDir("desc");
      else if (sortDir === "desc") {
        setSortField(null);
        setSortDir(null);
      }
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  };

  // Sorted tasks
  const sortedTasks = useMemo(() => {
    if (!sortField || !sortDir) return filteredTasks;

    return [...filteredTasks].sort((a, b) => {
      let comparison = 0;
      switch (sortField) {
        case "taskNumber":
          comparison = a.taskNumber.localeCompare(b.taskNumber);
          break;
        case "title":
          comparison = a.title.localeCompare(b.title);
          break;
        case "status":
          comparison = a.status.localeCompare(b.status);
          break;
        case "priority": {
          const weights: Record<TaskPriority, number> = {
            urgent: 4,
            high: 3,
            medium: 2,
            low: 1,
          };
          comparison = weights[a.priority] - weights[b.priority];
          break;
        }
        case "targetQuantity":
          comparison = (a.targetQuantity || 1) - (b.targetQuantity || 1);
          break;
        case "assignee": {
          const userA = users.find((u) => u.id === a.assigneeId)?.name || "";
          const userB = users.find((u) => u.id === b.assigneeId)?.name || "";
          comparison = userA.localeCompare(userB);
          break;
        }
        case "dueDate":
          comparison = a.dueDate.localeCompare(b.dueDate);
          break;
      }
      return sortDir === "desc" ? -comparison : comparison;
    });
  }, [filteredTasks, sortField, sortDir, users]);

  const allSelected =
    sortedTasks.length > 0 &&
    sortedTasks.every((t) => selectedTaskIds.includes(t.id));

  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="size-3 text-muted-foreground/60 ml-1 inline" />;
    }
    if (sortDir === "asc") {
      return <ArrowUp className="size-3 text-primary ml-1 inline" />;
    }
    return <ArrowDown className="size-3 text-primary ml-1 inline" />;
  };

  const isCompact = density === "compact";

  return (
    <div className="panel overflow-hidden space-y-2">
      {/* Table Toolbar: Column visibility toggle */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/60 bg-card/60 text-xs">
        <span className="text-muted-foreground font-mono">
          Showing {sortedTasks.length} task{sortedTasks.length === 1 ? "" : "s"}
        </span>

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowColumnMenu((prev) => !prev)}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-2.5 py-1 bg-card hover:bg-muted transition cursor-pointer"
          >
            <SlidersHorizontal className="size-3" />
            <span>Customize Columns</span>
          </button>

          {showColumnMenu && (
            <div className="absolute right-0 top-full mt-1 z-30 w-48 rounded-xl border border-border bg-card p-2 shadow-float space-y-1 text-xs">
              <div className="px-2 py-1 font-semibold text-muted-foreground uppercase text-[10px]">
                Toggle Columns
              </div>
              {Object.entries(visibleColumns).map(([key, val]) => (
                <label
                  key={key}
                  className="flex items-center gap-2 px-2 py-1 rounded hover:bg-muted cursor-pointer capitalize text-foreground"
                >
                  <input
                    type="checkbox"
                    checked={val}
                    onChange={(e) =>
                      setVisibleColumns((prev) => ({
                        ...prev,
                        [key]: e.target.checked,
                      }))
                    }
                    className="rounded border-border text-primary size-3.5"
                  />
                  <span>{key.replace(/([A-Z])/g, " $1")}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-muted/70 text-xs text-muted-foreground select-none">
            <tr>
              <th className="px-3 py-3 w-10 text-center">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => selectAllFilteredTasks(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary size-3.5 cursor-pointer"
                  title="Select all tasks"
                />
              </th>

              {visibleColumns.taskNumber && (
                <th
                  onClick={() => handleSort("taskNumber")}
                  className="px-3 py-3 font-semibold w-24 cursor-pointer hover:text-foreground transition"
                >
                  <span>Task #</span>
                  {renderSortIcon("taskNumber")}
                </th>
              )}

              {visibleColumns.title && (
                <th
                  onClick={() => handleSort("title")}
                  className="px-4 py-3 font-semibold min-w-[260px] cursor-pointer hover:text-foreground transition"
                >
                  <span>Task Title</span>
                  {renderSortIcon("title")}
                </th>
              )}

              {visibleColumns.status && (
                <th
                  onClick={() => handleSort("status")}
                  className="px-4 py-3 font-semibold w-36 cursor-pointer hover:text-foreground transition"
                >
                  <span>Status</span>
                  {renderSortIcon("status")}
                </th>
              )}

              {visibleColumns.priority && (
                <th
                  onClick={() => handleSort("priority")}
                  className="px-4 py-3 font-semibold w-28 cursor-pointer hover:text-foreground transition"
                >
                  <span>Priority</span>
                  {renderSortIcon("priority")}
                </th>
              )}

              {visibleColumns.units && (
                <th
                  onClick={() => handleSort("targetQuantity")}
                  className="px-4 py-3 font-semibold min-w-[170px] cursor-pointer hover:text-foreground transition"
                >
                  <span>Daily Units</span>
                  {renderSortIcon("targetQuantity")}
                </th>
              )}

              {visibleColumns.assignee && (
                <th
                  onClick={() => handleSort("assignee")}
                  className="px-4 py-3 font-semibold w-44 cursor-pointer hover:text-foreground transition"
                >
                  <span>Assignee</span>
                  {renderSortIcon("assignee")}
                </th>
              )}

              {visibleColumns.dueDate && (
                <th
                  onClick={() => handleSort("dueDate")}
                  className="px-4 py-3 font-semibold w-32 cursor-pointer hover:text-foreground transition"
                >
                  <span>Due Date</span>
                  {renderSortIcon("dueDate")}
                </th>
              )}

              {visibleColumns.deliverable && (
                <th className="px-3 py-3 font-semibold w-28">Asset</th>
              )}

              {visibleColumns.actions && (
                <th className="px-4 py-3 font-semibold text-right w-24">Actions</th>
              )}
            </tr>
          </thead>

          <tbody className="divide-y divide-border">
            {sortedTasks.map((task) => {
              const assignee = users.find((u) => u.id === task.assigneeId);
              const targetQty = task.targetQuantity || 1;
              const completedQty = task.completedQuantity || 0;
              const pct = Math.min(100, Math.round((completedQty / targetQty) * 100));
              const overdue = isOverdue(task.dueDate) && task.status !== "completed";
              const isSelected = selectedTaskIds.includes(task.id);
              const { blocked } = isTaskBlocked(task);

              return (
                <tr
                  key={task.id}
                  onClick={() => setSelectedTaskId(task.id)}
                  className={cn(
                    "transition-colors cursor-pointer group",
                    isSelected ? "bg-primary/5" : "bg-card hover:bg-muted/40"
                  )}
                >
                  {/* Select Checkbox */}
                  <td
                    className={cn(
                      "px-3 text-center",
                      isCompact ? "py-2" : "py-3.5"
                    )}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelectTask(task.id)}
                      className="rounded border-border text-primary focus:ring-primary size-3.5 cursor-pointer"
                    />
                  </td>

                  {/* Task Number */}
                  {visibleColumns.taskNumber && (
                    <td
                      className={cn(
                        "px-3 font-mono text-xs font-semibold text-muted-foreground",
                        isCompact ? "py-2" : "py-3.5"
                      )}
                    >
                      {task.taskNumber}
                    </td>
                  )}

                  {/* Title & Description & Badges */}
                  {visibleColumns.title && (
                    <td
                      className={cn(
                        "px-4",
                        isCompact ? "py-2" : "py-3.5"
                      )}
                    >
                      <div className="font-medium text-foreground group-hover:text-primary transition-colors text-xs sm:text-sm flex items-center gap-1.5 flex-wrap">
                        <span>{task.title}</span>
                        {blocked && (
                          <span className="flex items-center gap-1 rounded bg-destructive/15 px-1.5 py-0.2 text-[9px] font-medium text-destructive">
                            <Lock className="size-2.5" />
                            <span>Blocked</span>
                          </span>
                        )}
                        {task.isRevisionRequested && (
                          <span className="flex items-center gap-1 rounded bg-warning/15 px-1.5 py-0.2 text-[9px] font-medium text-warning">
                            <RotateCcw className="size-2.5" />
                            <span>Revision</span>
                          </span>
                        )}
                        {task.isCarried && (
                          <span className="rounded bg-muted px-1.5 py-0.2 text-[9px] font-medium text-muted-foreground">
                            Carried
                          </span>
                        )}
                      </div>

                      {!isCompact && task.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                          {task.description}
                        </p>
                      )}
                    </td>
                  )}

                  {/* Status */}
                  {visibleColumns.status && (
                    <td
                      className={cn("px-4", isCompact ? "py-2" : "py-3.5")}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <select
                        value={task.status}
                        onChange={(e) =>
                          updateTask(task.id, {
                            status: e.target.value as TaskStatus,
                          })
                        }
                        className="text-xs rounded-lg border border-border bg-card px-2 py-1 text-foreground focus:ring-1 focus:ring-primary outline-hidden"
                      >
                        <option value="todo">To Do</option>
                        <option value="in_progress">In Progress</option>
                        <option value="in_review">In Review</option>
                        <option value="completed">Completed</option>
                        <option value="backlog">Backlog</option>
                      </select>
                    </td>
                  )}

                  {/* Priority */}
                  {visibleColumns.priority && (
                    <td className={cn("px-4", isCompact ? "py-2" : "py-3.5")}>
                      <PriorityBadge priority={task.priority} />
                    </td>
                  )}

                  {/* Units Progress */}
                  {visibleColumns.units && (
                    <td className={cn("px-4", isCompact ? "py-2" : "py-3.5")}>
                      <div className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono font-medium text-foreground">
                            {completedQty} / {targetQty} units
                          </span>
                          <span className="text-muted-foreground text-[10px] font-mono">
                            {pct}%
                          </span>
                        </div>
                        <ProgressBar completed={completedQty} total={targetQty} size="sm" />
                      </div>
                    </td>
                  )}

                  {/* Assignee */}
                  {visibleColumns.assignee && (
                    <td className={cn("px-4", isCompact ? "py-2" : "py-3.5")}>
                      {assignee ? (
                        <div className="flex items-center gap-2">
                          <div className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-[10px] shrink-0">
                            {assignee.avatar}
                          </div>
                          <div className="truncate">
                            <span className="text-xs font-medium text-foreground block truncate">
                              {assignee.name}
                            </span>
                            <span className="text-[10px] text-muted-foreground capitalize block truncate">
                              {assignee.role.replace("_", " ")}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground italic">
                          Unassigned
                        </span>
                      )}
                    </td>
                  )}

                  {/* Due Date */}
                  {visibleColumns.dueDate && (
                    <td className={cn("px-4", isCompact ? "py-2" : "py-3.5")}>
                      <div
                        className={cn(
                          "flex items-center gap-1.5 text-xs font-mono",
                          overdue ? "text-destructive font-semibold" : "text-muted-foreground"
                        )}
                      >
                        <Calendar className="size-3.5 shrink-0" />
                        <span>{formatDate(task.dueDate)}</span>
                      </div>
                    </td>
                  )}

                  {/* Deliverable Link */}
                  {visibleColumns.deliverable && (
                    <td
                      className={cn("px-3", isCompact ? "py-2" : "py-3.5")}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {task.deliverableUrl ? (
                        <a
                          href={task.deliverableUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-xs text-primary hover:underline flex items-center gap-1"
                        >
                          <span>View</span>
                          <ExternalLink className="size-3" />
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">-</span>
                      )}
                    </td>
                  )}

                  {/* Actions */}
                  {visibleColumns.actions && (
                    <td
                      className={cn(
                        "px-4 text-right",
                        isCompact ? "py-2" : "py-3.5"
                      )}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-1">
                        {isManagerOrAdmin && task.status === "in_review" && (
                          <>
                            <button
                              type="button"
                              onClick={() => approveTask(task.id)}
                              className="size-7 rounded hover:bg-success/15 text-success flex items-center justify-center transition cursor-pointer"
                              title="Approve deliverable"
                            >
                              <Check className="size-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                requestRevision(
                                  task.id,
                                  "Please adjust and resubmit deliverable"
                                )
                              }
                              className="size-7 rounded hover:bg-warning/15 text-warning flex items-center justify-center transition cursor-pointer"
                              title="Request revision"
                            >
                              <RotateCcw className="size-3.5" />
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => setSelectedTaskId(task.id)}
                          className="size-7 rounded hover:bg-muted text-muted-foreground hover:text-foreground flex items-center justify-center transition cursor-pointer"
                          title="View task details"
                        >
                          <ChevronRight className="size-4" />
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}

            {sortedTasks.length === 0 && (
              <tr>
                <td
                  colSpan={10}
                  className="px-4 py-12 text-center text-xs text-muted-foreground"
                >
                  No tasks found matching your filter criteria.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
