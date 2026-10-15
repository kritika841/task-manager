"use client";

import React, { useMemo } from "react";
import {
  Clock,
  Lock,
  RotateCcw,
  CheckCircle2,
  Calendar,
  Layers,
  ChevronRight,
} from "lucide-react";
import { Task } from "@/lib/types";
import { useTasks } from "@/lib/store";
import { calculateProgress, formatDate, cn } from "@/lib/utils";

export function TaskTimeline() {
  const { filteredTasks, setSelectedTaskId, users, isTaskBlocked } = useTasks();

  // Calculate min and max dates across tasks to generate 14-day timeline window
  const timelineDates = useMemo(() => {
    const dates: string[] = [];
    const baseDate = new Date();
    // Start 3 days before today, go 11 days forward
    for (let i = -3; i <= 10; i++) {
      const d = new Date(baseDate);
      d.setDate(baseDate.getDate() + i);
      dates.push(d.toISOString().slice(0, 10));
    }
    return dates;
  }, []);

  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="panel overflow-hidden space-y-4 p-4 sm:p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="size-5 text-primary" />
          <h2 className="text-base font-bold text-foreground">
            Pipeline & Timeline Schedule (Gantt)
          </h2>
          <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded">
            {filteredTasks.length} tasks
          </span>
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

      <div className="border border-border rounded-xl overflow-x-auto bg-card">
        <div className="min-w-[850px]">
          {/* Header Row: Task Info + Date Columns */}
          <div className="grid grid-cols-12 border-b border-border bg-muted/40 py-2.5 text-xs font-semibold text-muted-foreground">
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
              const taskDueIndex = timelineDates.indexOf(task.dueDate);
              const effectiveDueIdx = taskDueIndex !== -1 ? taskDueIndex : 4;
              // Duration in days (default 2 days if no start date)
              const startIdx = Math.max(0, effectiveDueIdx - 1);

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
