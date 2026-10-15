"use client";

import React, { useState } from "react";
import {
  CheckSquare,
  Square,
  Plus,
  Trash2,
  User as UserIcon,
  GripVertical,
  CheckCircle2,
} from "lucide-react";
import { Subtask, User } from "@/lib/types";
import { Button } from "./ui/button";
import { Input, Select } from "./ui/field";
import { cn } from "@/lib/utils";

interface SubtaskChecklistProps {
  taskId: string;
  subtasks: Subtask[];
  targetQuantity: number;
  completedQuantity: number;
  autoCompletedQuantity?: number;
  users: User[];
  onToggle: (subtaskId: string) => Promise<void>;
  onAddSubtask: (title: string, assignedTo?: string) => Promise<void>;
  onRemoveSubtask: (subtaskId: string) => Promise<void>;
  disabled?: boolean;
}

export function SubtaskChecklist({
  taskId,
  subtasks,
  targetQuantity,
  completedQuantity,
  autoCompletedQuantity = 0,
  users,
  onToggle,
  onAddSubtask,
  onRemoveSubtask,
  disabled = false,
}: SubtaskChecklistProps) {
  const [newTitle, setNewTitle] = useState("");
  const [selectedAssignee, setSelectedAssignee] = useState<string>("");
  const [isAdding, setIsAdding] = useState(false);

  const doneCount = subtasks.filter((s) => s.completed).length;
  const totalCount = subtasks.length;
  const pct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await onAddSubtask(newTitle.trim(), selectedAssignee || undefined);
    setNewTitle("");
    setIsAdding(false);
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
            Checklist & Action Steps
          </span>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-muted text-muted-foreground font-semibold">
            {doneCount} / {totalCount} Done ({pct}%)
          </span>
        </div>

        {!disabled && (
          <button
            type="button"
            onClick={() => setIsAdding((prev) => !prev)}
            className="text-xs text-primary hover:underline font-medium flex items-center gap-1 cursor-pointer"
          >
            <Plus className="size-3" />
            <span>Add Step</span>
          </button>
        )}
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
        <div
          className={cn(
            "h-full transition-all duration-300",
            pct === 100 ? "bg-success" : "bg-primary"
          )}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Subtasks List */}
      <div className="space-y-1.5 rounded-xl border border-border bg-card p-3 max-h-56 overflow-y-auto">
        {subtasks.map((st) => {
          const assignee = users.find((u) => u.id === st.assignedTo);
          const isAutoIngested =
            !st.isCustom &&
            typeof st.sortOrder === "number" &&
            st.sortOrder <= autoCompletedQuantity;

          return (
            <div
              key={st.id}
              className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-muted/40 group/item transition"
            >
              <div
                onClick={() => !disabled && !isAutoIngested && onToggle(st.id)}
                title={
                  isAutoIngested
                    ? "Auto-ingested from Adflow pipeline. Cannot be subtracted manually."
                    : undefined
                }
                className={cn(
                  "flex items-center gap-2.5 min-w-0 flex-1",
                  isAutoIngested ? "cursor-not-allowed opacity-90" : "cursor-pointer"
                )}
              >
                {st.completed ? (
                  <CheckSquare
                    className={cn(
                      "size-4 shrink-0",
                      isAutoIngested ? "text-blue-500" : "text-success"
                    )}
                  />
                ) : (
                  <Square className="size-4 text-muted-foreground shrink-0 group-hover/item:text-foreground" />
                )}
                <span
                  className={cn(
                    "text-xs truncate select-none",
                    st.completed
                      ? "text-muted-foreground line-through"
                      : "text-foreground font-medium"
                  )}
                >
                  {st.title}
                </span>

                {isAutoIngested && (
                  <span
                    className="text-[9px] font-mono text-blue-500 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.2 rounded font-medium shrink-0"
                    title="Adflow Auto-Ingested"
                  >
                    ⚡ Auto
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {assignee && (
                  <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded flex items-center gap-1">
                    <UserIcon className="size-2.5" />
                    <span>{assignee.name.split(" ")[0]}</span>
                  </span>
                )}

                {st.isCustom && !disabled && (
                  <button
                    type="button"
                    onClick={() => onRemoveSubtask(st.id)}
                    className="opacity-0 group-hover/item:opacity-100 text-muted-foreground hover:text-destructive transition p-0.5"
                    title="Remove step"
                  >
                    <Trash2 className="size-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}

        {subtasks.length === 0 && (
          <p className="text-center text-xs text-muted-foreground py-2">
            No steps defined yet. Click &quot;Add Step&quot; above to create checklist items.
          </p>
        )}
      </div>

      {/* Inline Add Step Form */}
      {isAdding && (
        <form onSubmit={handleAdd} className="rounded-xl border border-border bg-muted/20 p-3 space-y-2">
          <Input
            placeholder="e.g. Draft hook, record B-roll, review rough cut..."
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            className="text-xs h-8 bg-card"
            autoFocus
          />
          <div className="flex items-center justify-between gap-2">
            <Select
              value={selectedAssignee}
              onChange={(e) => setSelectedAssignee(e.target.value)}
              className="text-xs h-7 w-auto min-w-[130px] bg-card"
            >
              <option value="">Assign to (optional)</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </Select>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsAdding(false)}
                className="text-xs h-7"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                className="text-xs h-7"
                disabled={!newTitle.trim()}
              >
                Add Step
              </Button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}
