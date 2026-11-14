"use client";

import React, { useMemo, useState } from "react";
import {
  Clock,
  Lock,
  RotateCcw,
  CheckCircle2,
  Calendar,
  Layers,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Task } from "@/lib/types";
import { useTasks } from "@/lib/store";
import { calculateProgress, formatDate, cn } from "@/lib/utils";

export function TaskTimeline() {
  const { filteredTasks, setSelectedTaskId, users, isTaskBlocked } = useTasks();
  const [dayOffset, setDayOffset] = useState(0);

  // Calculate 14-day timeline window anchored to today + dayOffset
  const timelineDates = useMemo(() => {
    const dates: string[] = [];
    const baseDate = new Date();
    baseDate.setDate(baseDate.getDate() + dayOffset);
    // Start 3 days before anchor, go 10 days forward (14 days total)
    for (let i = -3; i <= 10; i++) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i);
      dates.push(d.toISOString().slice(0, 10));
    }
    return dates;
  }, [dayOffset]);

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="panel space-y-4 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Layers className="size-5 text-primary" />
          <h2 className="text-base font-bold text-foreground">
            Pipeline & Timeline Schedule (Gantt)
          </h2>
          <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded">
            {filteredTasks.length} tasks
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setDayOffset((prev) => prev - 7)}
              className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-card text-muted-foreground hover:text-foreground transition cursor-pointer"
              title="Previous 7 days"
            >
              <ChevronLeft className="size-3.5" />
              <span>Prev 7d</span>
            </button>
            <button
              type="button"
              onClick={() => setDayOffset(0)}
              className={cn(
                "px-2.5 py-1 rounded-md font-semibold transition cursor-pointer",
                dayOffset === 0
                  ? "bg-card text-foreground shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setDayOffset((prev) => prev + 7)}
              className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-card text-muted-foreground hover:text-foreground transition cursor-pointer"
              title="Next 7 days"
            >
              <span>Next 7d</span>
              <ChevronRight className="size-3.5" />
            </button>
          </div>

          <div className="text-xs text-muted-foreground flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-primary" />
              <span>Target Pipeline</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-success" />
              <span>Completed</span>
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-destructive" />
              <span>Blocked</span>
            </span>
          </div>
        </div>
      </div>

      <div className="border border-border rounded-xl overflow-x-auto xl:overflow-visible bg-card">
        <div className="min-w-[850px]">
          {/* Header Row: Task Info + Date Columns (Sticky on vertical scroll) */}
          <div className="sticky top-12 z-20 grid grid-cols-12 border-b border-border bg-card/95 dark:bg-zinc-900/95 backdrop-blur-md py-2.5 text-xs font-semibold text-muted-foreground rounded-t-xl shadow-2xs">
            <div className="col-span-4 px-4 font-semibold">Task & Assignee</div>
            <div className="col-span-8 grid grid-cols-14 text-center font-mono text-[11px]">
              {timelineDates.map((dateStr) => {
                const isToday = dateStr === todayStr;
                const d = new Date(dateStr);
                const dayName = d.toLocaleDateString("en-US", { weekday: "narrow" });
                const dayNum = d.getDate();

                return (
                  <div
                    key={dateStr}
                    className={cn(
                      "py-0.5 rounded",
                      isToday ? "bg-primary text-primary-foreground font-bold" : ""
                    )}
                  >
                    <div>{dayName}</div>
                    <div className="text-[10px]">{dayNum}</div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Task Rows */}
          <div className="divide-y divide-border/60">
            {filteredTasks.map((task) => {
              const assignee = users.find((u) => u.id === task.assigneeId);
              const { blocked } = isTaskBlocked(task);
              const targetQty = task.targetQuantity || 1;
              const completedQty = task.completedQuantity || 0;
              const pct = Math.min(100, Math.round((completedQty / targetQty) * 100));

              // Calculate start and end position in 14-day window
              const firstDate = timelineDates[0];
              const lastDate = timelineDates[timelineDates.length - 1];
              const rawDueIdx = timelineDates.indexOf(task.dueDate);
              const effectiveDueIdx =
                rawDueIdx !== -1
                  ? rawDueIdx
                  : task.dueDate < firstDate
                  ? 0
                  : task.dueDate > lastDate
                  ? timelineDates.length - 1
                  : 3;

              const rawStartIdx = task.startDate ? timelineDates.indexOf(task.startDate) : -1;
              const startIdx =
                rawStartIdx !== -1
                  ? Math.min(rawStartIdx, effectiveDueIdx)
                  : task.startDate && task.startDate < firstDate
                  ? 0
                  : Math.max(0, effectiveDueIdx - 1);

              return (
                <div
                  key={task.id}
                  onClick={() => setSelectedTaskId(task.id)}
                  className="grid grid-cols-12 py-3 hover:bg-muted/30 transition cursor-pointer items-center group"
                >
                  {/* Left Column: Task Meta */}
                  <div className="col-span-4 px-4 flex items-center justify-between min-w-0 pr-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-xs font-semibold text-muted-foreground">
                          {task.taskNumber}
                        </span>
                        <span className="text-xs font-semibold text-foreground group-hover:text-primary transition truncate">
                          {task.title}
                        </span>
                      </div>
                      <div className="text-[11px] text-muted-foreground flex items-center gap-2 mt-0.5">
                        <span>{assignee?.name || "Unassigned"}</span>
                        <span>•</span>
                        <span>Due {task.dueDate}</span>
                      </div>
                    </div>

                    {blocked && (
                      <span className="rounded bg-destructive/15 text-destructive p-1" title="Blocked">
                        <Lock className="size-3" />
                      </span>
                    )}
                  </div>

                  {/* Right Column: 14-day Grid with Gantt Timeline Bar */}
                  <div className="col-span-8 grid grid-cols-14 relative h-7 items-center px-1">
                    {/* Background date guidelines */}
                    {timelineDates.map((dateStr) => (
                      <div
                        key={dateStr}
                        className={cn(
                          "h-full border-r border-border/20",
                          dateStr === todayStr && "bg-primary/5"
                        )}
                      />
                    ))}

                    {/* Gantt Bar */}
                    <div
                      style={{
                        gridColumnStart: startIdx + 1,
                        gridColumnEnd: effectiveDueIdx + 2,
                      }}
                      className={cn(
                        "h-6 rounded-md shadow-xs flex items-center justify-between px-2 text-[10px] font-semibold text-white relative z-10 transition-all",
                        task.status === "completed"
                          ? "bg-success"
                          : blocked
                          ? "bg-destructive"
                          : task.status === "in_review"
                          ? "bg-indigo-600"
                          : "bg-primary"
                      )}
                    >
                      <span className="truncate pr-1">{task.status.replace("_", " ")}</span>
                      <span className="font-mono">{pct}%</span>
                    </div>
                  </div>
                </div>
              );
            })}

            {filteredTasks.length === 0 && (
              <div className="text-center py-8 text-xs text-muted-foreground">
                No tasks match current filter in this timeline window.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
