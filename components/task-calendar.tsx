"use client";

import React, { useState, useMemo } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Plus,
  CheckCircle2,
  Clock,
  RotateCcw,
  Lock,
} from "lucide-react";
import { Task } from "@/lib/types";
import { useTasks } from "@/lib/store";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

export function TaskCalendar() {
  const { filteredTasks, setSelectedTaskId, openCreateModal, users } = useTasks();
  const [currentDate, setCurrentDate] = useState(() => new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthName = currentDate.toLocaleString("default", { month: "long" });

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // Calendar matrix calculation
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(year, month, 1).getDay(); // 0 is Sunday
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const days: {
      dateStr: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
    }[] = [];

    // Today in YYYY-MM-DD
    const todayStr = new Date().toISOString().slice(0, 10);

    // Prev month padding
    for (let i = firstDayOfMonth - 1; i >= 0; i--) {
      const d = daysInPrevMonth - i;
      const prevDate = new Date(year, month - 1, d);
      const dateStr = prevDate.toISOString().slice(0, 10);
      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const currDate = new Date(year, month, d);
      const dateStr = currDate.toISOString().slice(0, 10);
      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: true,
        isToday: dateStr === todayStr,
      });
    }

    // Next month padding to complete 35 or 42 grid cells
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      const nextDate = new Date(year, month + 1, d);
      const dateStr = nextDate.toISOString().slice(0, 10);
      days.push({
        dateStr,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: dateStr === todayStr,
      });
    }

    return days;
  }, [year, month]);

  // Group tasks by dueDate
  const tasksByDate = useMemo(() => {
    const map = new Map<string, Task[]>();
    filteredTasks.forEach((t) => {
      if (!t.dueDate) return;
      const list = map.get(t.dueDate) || [];
      list.push(t);
      map.set(t.dueDate, list);
    });
    return map;
  }, [filteredTasks]);

  const weekDayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  return (
    <div className="panel overflow-hidden space-y-4 p-4 sm:p-5">
      {/* Calendar Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarIcon className="size-5 text-primary" />
          <h2 className="text-base font-bold text-foreground">
            {monthName} {year}
          </h2>
          <span className="text-xs text-muted-foreground font-mono bg-muted px-2 py-0.5 rounded">
            {filteredTasks.length} tasks
          </span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={goToToday}
            className="text-xs h-8"
          >
            Today
          </Button>

          <div className="flex items-center border border-border rounded-lg bg-card shadow-xs">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition rounded-l-md cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="size-4" />
            </button>
            <div className="h-4 w-px bg-border" />
            <button
              type="button"
              onClick={nextMonth}
              className="p-1.5 hover:bg-muted text-muted-foreground hover:text-foreground transition rounded-r-md cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Grid Container */}
      <div className="border border-border rounded-xl overflow-hidden bg-card">
        {/* Days of Week */}
        <div className="grid grid-cols-7 border-b border-border bg-muted/40 text-center py-2 text-xs font-semibold text-muted-foreground">
          {weekDayNames.map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>

        {/* Calendar Days Matrix */}
        <div className="grid grid-cols-7 divide-x divide-y divide-border">
          {calendarDays.map((cell) => {
            const dayTasks = tasksByDate.get(cell.dateStr) || [];

            return (
              <div
                key={cell.dateStr}
                className={cn(
                  "min-h-[110px] sm:min-h-[130px] p-2 flex flex-col justify-between transition-colors",
                  cell.isCurrentMonth
                    ? "bg-card"
                    : "bg-muted/15 text-muted-foreground/60",
                  cell.isToday && "bg-primary/5 ring-1 ring-inset ring-primary/40"
                )}
              >
                {/* Date header */}
                <div className="flex items-center justify-between mb-1.5">
                  <span
                    className={cn(
                      "size-6 flex items-center justify-center rounded-full text-xs font-semibold",
                      cell.isToday
                        ? "bg-primary text-primary-foreground font-bold"
                        : cell.isCurrentMonth
                        ? "text-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    {cell.dayNumber}
                  </span>

                  {cell.isCurrentMonth && (
                    <button
                      type="button"
                      onClick={() => openCreateModal()}
                      className="size-5 rounded hover:bg-muted text-muted-foreground hover:text-foreground opacity-0 hover:opacity-100 flex items-center justify-center transition cursor-pointer"
                      title="Add task for this date"
                    >
                      <Plus className="size-3" />
                    </button>
                  )}
                </div>

                {/* Day tasks list */}
                <div className="space-y-1 overflow-y-auto max-h-24">
                  {dayTasks.slice(0, 3).map((task) => {
                    const assignee = users.find((u) => u.id === task.assigneeId);
                    const isDone = task.status === "completed";
                    const isReview = task.status === "in_review";

                    return (
                      <div
                        key={task.id}
                        onClick={() => setSelectedTaskId(task.id)}
                        className={cn(
                          "px-1.5 py-1 rounded text-[11px] truncate font-medium cursor-pointer transition flex items-center gap-1 border",
                          isDone
                            ? "bg-success/10 border-success/30 text-success line-through"
                            : isReview
                            ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-500 font-semibold"
                            : task.priority === "urgent"
                            ? "bg-destructive/10 border-destructive/30 text-destructive font-semibold"
                            : "bg-muted/60 border-border text-foreground hover:border-primary/50"
                        )}
                        title={`${task.taskNumber}: ${task.title}`}
                      >
                        <span className="font-mono text-[9px] opacity-75 shrink-0">
                          {task.taskNumber}
                        </span>
                        <span className="truncate flex-1">{task.title}</span>
                      </div>
                    );
                  })}

                  {dayTasks.length > 3 && (
                    <div className="text-[10px] font-semibold text-primary pl-1">
                      +{dayTasks.length - 3} more
                    </div>
                  )}
                </div>

                {/* Bottom spacer */}
                <div />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
