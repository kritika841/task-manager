"use client";

import React, { useState } from "react";
import {
  X,
  Users,
  CheckCircle2,
  Calendar,
  Trash2,
  ChevronDown,
  Layers,
} from "lucide-react";
import { useTasks } from "@/lib/store";
import { TaskStatus } from "@/lib/types";
import { Button } from "./ui/button";
import { Select, Input } from "./ui/field";

export function BulkActionsToolbar() {
  const {
    selectedTaskIds,
    clearSelectedTasks,
    bulkReassign,
    bulkMoveStatus,
    bulkReschedule,
    bulkDelete,
    users,
    getMemberCapacity,
  } = useTasks();

  const [isReassigning, setIsReassigning] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [rescheduleDate, setRescheduleDate] = useState("");

  if (selectedTaskIds.length === 0) return null;

  const handleReassignSubmit = async (userId: string) => {
    if (!userId) return;
    await bulkReassign(userId);
    setIsReassigning(false);
  };

  const handleRescheduleSubmit = async (date: string) => {
    if (!date) return;
    await bulkReschedule(date);
    setIsRescheduling(false);
  };

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 duration-200">
      <div className="flex items-center gap-2 rounded-2xl border border-border bg-card/95 px-4 py-2.5 shadow-float backdrop-blur-md text-xs">
        {/* Count pill */}
        <div className="flex items-center gap-1.5 pr-2 border-r border-border font-medium text-foreground">
          <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground font-mono">
            {selectedTaskIds.length}
          </span>
          <span>Selected</span>
        </div>

        {/* Reassign Action */}
        <div className="relative">
          {isReassigning ? (
            <div className="flex items-center gap-1">
              <Select
                value={selectedUserId}
                onChange={(e) => handleReassignSubmit(e.target.value)}
                className="text-xs h-7 w-44 bg-card"
                autoFocus
              >
                <option value="">Choose member</option>
                {users.map((u) => {
                  const cap = getMemberCapacity(u.id);
                  return (
                    <option key={u.id} value={u.id}>
                      {u.name} ({cap.current}/{cap.max} units)
                    </option>
                  );
                })}
              </Select>
              <button
                onClick={() => setIsReassigning(false)}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                ✕
              </button>
            </div>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsReassigning(true)}
              className="h-7 text-xs gap-1"
            >
              <Users className="size-3 text-muted-foreground" />
              <span>Reassign</span>
            </Button>
          )}
        </div>

        {/* Status Dropdown */}
        <Select
          value=""
          onChange={(e) => {
            if (e.target.value) bulkMoveStatus(e.target.value as TaskStatus);
          }}
          className="text-xs h-7 w-28 bg-card"
        >
          <option value="">Move Status</option>
          <option value="todo">To Do</option>
          <option value="in_progress">In Progress</option>
          <option value="in_review">In Review</option>
          <option value="completed">Done</option>
          <option value="backlog">Backlog</option>
        </Select>

        {/* Reschedule Date */}
        <div className="relative">
          {isRescheduling ? (
            <div className="flex items-center gap-1">
              <Input
                type="date"
                value={rescheduleDate}
                onChange={(e) => handleRescheduleSubmit(e.target.value)}
                className="text-xs h-7 w-32 bg-card"
                autoFocus
              >
              </Input>
              <button
                onClick={() => setIsRescheduling(false)}
                className="text-muted-foreground hover:text-foreground p-1"
              >
                ✕
              </button>
            </div>
          ) : (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setIsRescheduling(true)}
              className="h-7 text-xs gap-1"
            >
              <Calendar className="size-3 text-muted-foreground" />
              <span>Due Date</span>
            </Button>
          )}
        </div>

        {/* Bulk Delete */}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            if (
              confirm(
                `⚠️ Admin Action: Are you sure you want to permanently delete all ${selectedTaskIds.length} selected tasks? Targeted assignees will be notified.`
              )
            ) {
              bulkDelete();
            }
          }}
          className="h-7 text-xs gap-1.5 border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive hover:text-destructive-foreground font-semibold transition"
          title="Permanently delete all selected tasks"
        >
          <Trash2 className="size-3.5" />
          <span>Delete ({selectedTaskIds.length})</span>
        </Button>

        {/* Clear / Dismiss */}
        <button
          type="button"
          onClick={clearSelectedTasks}
          className="ml-1 p-1 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground transition"
          title="Deselect all (Esc)"
        >
          <X className="size-4" />
        </button>
      </div>
    </div>
  );
}
