"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Zap,
  Plus,
  Play,
  Pause,
  Trash2,
  Edit2,
  Check,
  Calendar,
  Users,
  AlertCircle,
  Clock,
  RotateCw,
} from "lucide-react";
import { useTasks } from "@/lib/store";
import { DailyTaskRule } from "@/lib/types";
import { taskOptionsForRole, dateInTargetTimeZone } from "@/lib/supabase";
import { Button } from "./ui/button";
import { Input, Textarea, Select } from "./ui/field";
import { cn } from "@/lib/utils";

export function AutoDelegatorModal() {
  const {
    isAutoDelegatorOpen,
    setIsAutoDelegatorOpen,
    users,
    delegatorRules,
    saveDelegatorRule,
    deleteDelegatorRule,
    toggleDelegatorRule,
    materializeDelegatorNow,
    refreshAll,
  } = useTasks();

  const today = dateInTargetTimeZone();

  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string>("");
  const [taskName, setTaskName] = useState<string>("");
  const [customTaskName, setCustomTaskName] = useState<string>("");
  const [isCustom, setIsCustom] = useState<boolean>(false);
  const [targetQuantity, setTargetQuantity] = useState<number>(4);
  const [startsOn, setStartsOn] = useState<string>(today);
  const [endsOn, setEndsOn] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [active, setActive] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [isMaterializing, setIsMaterializing] = useState<boolean>(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  // Set default user
  useEffect(() => {
    if (users.length > 0 && !userId) {
      const defaultUser =
        users.find((u) => u.role === "editor" || u.role === "content_creator") ||
        users[0];
      if (defaultUser) setUserId(defaultUser.id);
    }
  }, [users, userId]);

  if (!isAutoDelegatorOpen) return null;

  const selectedUser = users.find((u) => u.id === userId);
  const roleTaskOptions = taskOptionsForRole(selectedUser?.role);

  const resetForm = () => {
    setEditingRuleId(null);
    setTaskName("");
    setCustomTaskName("");
    setIsCustom(false);
    setTargetQuantity(4);
    setStartsOn(today);
    setEndsOn("");
    setNotes("");
    setActive(true);
    setMessage(null);
  };

  const handleEdit = (rule: DailyTaskRule) => {
    setEditingRuleId(rule.id);
    setUserId(rule.userId);
    const isStandardOption = roleTaskOptions.includes(rule.taskName as any);
    if (isStandardOption) {
      setIsCustom(false);
      setTaskName(rule.taskName);
      setCustomTaskName("");
    } else {
      setIsCustom(true);
      setTaskName("__custom__");
      setCustomTaskName(rule.taskName);
    }
    setTargetQuantity(rule.targetQuantity);
    setStartsOn(rule.startsOn);
    setEndsOn(rule.endsOn || "");
    setNotes(rule.notes || "");
    setActive(rule.active);
    setMessage(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalTaskName = isCustom ? customTaskName.trim() : taskName.trim();
    if (!userId || !finalTaskName) {
      setMessage({ text: "Please select a member and specify a task name.", type: "error" });
      return;
    }

    setIsSaving(true);
    setMessage(null);

    const success = await saveDelegatorRule({
      id: editingRuleId || undefined,
      userId,
      taskName: finalTaskName,
      targetQuantity: Math.max(1, Number(targetQuantity) || 1),
      notes: notes.trim() || null,
      startsOn,
      endsOn: endsOn.trim() || null,
      active,
    });

    setIsSaving(false);
    if (success) {
      setMessage({
        text: editingRuleId ? "Rule updated successfully." : "New recurring rule created.",
        type: "success",
      });
      resetForm();
    } else {
      setMessage({ text: "Could not save recurring rule.", type: "error" });
    }
  };

  const handleRunNow = async () => {
    setIsMaterializing(true);
    setMessage(null);
    const ok = await materializeDelegatorNow();
    setIsMaterializing(false);
    if (ok) {
      setMessage({
        text: "Auto-delegator executed! Today's daily targets are now up to date.",
        type: "success",
      });
    } else {
      setMessage({ text: "Failed to run auto-delegator.", type: "error" });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/30 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl rounded-2xl border border-border bg-card p-6 shadow-float max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Zap className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-foreground">
                  Auto Delegator
                </h2>
                <span className="rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-medium text-success">
                  Connected to Ads Daily Targets
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Automatically assigns recurring daily targets to team members each day.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRunNow}
              disabled={isMaterializing}
              className="gap-1.5 text-xs h-8"
              title="Apply recurring rules for today immediately"
            >
              <RotateCw className={cn("size-3.5", isMaterializing && "animate-spin")} />
              <span>{isMaterializing ? "Running..." : "Run Delegator Now"}</span>
            </Button>

            <button
              onClick={() => setIsAutoDelegatorOpen(false)}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
          </div>
        </div>

        {/* Status Message */}
        {message && (
          <div
            className={cn(
              "mt-3 rounded-lg px-3 py-2 text-xs flex items-center justify-between",
              message.type === "success"
                ? "bg-success/10 text-success border border-success/20"
                : "bg-destructive/10 text-destructive border border-destructive/20"
            )}
          >
            <span>{message.text}</span>
            <button onClick={() => setMessage(null)} className="text-xs font-semibold ml-2">
              ✕
            </button>
          </div>
        )}

        {/* Main Grid: Rules List on Left, Form on Right */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 mt-4 flex-1 overflow-y-auto pr-1">
          {/* Left Column: Existing Rules (5 cols) */}
          <div className="md:col-span-5 flex flex-col space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground uppercase tracking-wider">
                Recurring Rules ({delegatorRules.length})
              </span>
              {editingRuleId && (
                <button
                  onClick={resetForm}
                  className="text-[11px] text-primary hover:underline font-medium"
                >
                  + Add New Rule
                </button>
              )}
            </div>

            <div className="space-y-2 overflow-y-auto max-h-[460px] pr-1">
              {delegatorRules.map((rule) => {
                const assignedPerson = users.find((u) => u.id === rule.userId);
                const isSelected = editingRuleId === rule.id;

                return (
                  <div
                    key={rule.id}
                    className={cn(
                      "rounded-xl border p-3 text-left transition relative flex flex-col gap-2",
                      isSelected
                        ? "border-primary bg-primary/5 shadow-xs"
                        : "border-border bg-card/60 hover:bg-muted/40"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-foreground truncate">
                            {rule.taskName}
                          </span>
                          <span className="rounded bg-muted px-1.5 py-0.2 text-[10px] font-mono text-muted-foreground shrink-0">
                            {rule.targetQuantity}/day
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                          {assignedPerson?.name || "Team member"} ·{" "}
                          <span className="capitalize">{assignedPerson?.role.replace("_", " ")}</span>
                        </div>
                      </div>

                      {/* Active/Paused Switch */}
                      <button
                        type="button"
                        onClick={() => toggleDelegatorRule(rule.id, !rule.active)}
                        className={cn(
                          "rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0 transition",
                          rule.active
                            ? "bg-success/15 text-success hover:bg-success/25"
                            : "bg-muted text-muted-foreground hover:bg-muted-foreground/20"
                        )}
                        title={rule.active ? "Click to Pause" : "Click to Activate"}
                      >
                        {rule.active ? "Active" : "Paused"}
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-muted-foreground border-t border-border/50 pt-2">
                      <div className="flex items-center gap-1 truncate">
                        <Calendar className="size-3 text-muted-foreground shrink-0" />
                        <span>
                          From {rule.startsOn}
                          {rule.endsOn ? ` to ${rule.endsOn}` : " · Ongoing"}
                        </span>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleEdit(rule)}
                          className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition"
                          title="Edit rule"
                        >
                          <Edit2 className="size-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteDelegatorRule(rule.id)}
                          className="p-1 rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition"
                          title="Delete rule"
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {delegatorRules.length === 0 && (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                  No recurring delegator rules yet.
                  <p className="mt-1 text-[11px]">
                    Create a rule on the right to start assigning tasks automatically!
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Rule Editor Form (7 cols) */}
          <div className="md:col-span-7 rounded-xl border border-border bg-muted/20 p-4">
            <h3 className="text-xs font-semibold text-foreground uppercase tracking-wider">
              {editingRuleId ? "Edit Recurring Task" : "Add Recurring Task"}
            </h3>

            <form onSubmit={handleSave} className="mt-3 space-y-3.5">
              {/* Assignee */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Team Member
                </label>
                <Select
                  value={userId}
                  onChange={(e) => {
                    setUserId(e.target.value);
                    setTaskName("");
                    setIsCustom(false);
                  }}
                  className="w-full text-xs h-9 bg-card"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} · {u.role.replace("_", " ")}
                    </option>
                  ))}
                </Select>
              </div>

              {/* Task Type */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Task Type
                </label>
                <Select
                  value={isCustom ? "__custom__" : taskName}
                  onChange={(e) => {
                    if (e.target.value === "__custom__") {
                      setIsCustom(true);
                      setTaskName("__custom__");
                    } else {
                      setIsCustom(false);
                      setTaskName(e.target.value);
                    }
                  }}
                  className="w-full text-xs h-9 bg-card"
                >
                  <option value="">Select a standard task</option>
                  {roleTaskOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                  <option value="__custom__">Custom task...</option>
                </Select>
              </div>

              {/* Custom Task Input */}
              {isCustom && (
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Custom Task Title
                  </label>
                  <Input
                    placeholder="e.g. Daily Reels Review & Packaging"
                    value={customTaskName}
                    onChange={(e) => setCustomTaskName(e.target.value)}
                    className="w-full text-xs h-9 bg-card"
                    required
                  />
                </div>
              )}

              {/* Quantity & Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Daily Quantity
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    value={targetQuantity}
                    onChange={(e) => setTargetQuantity(Number(e.target.value))}
                    className="w-full text-xs h-9 bg-card"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Starts On
                  </label>
                  <Input
                    type="date"
                    value={startsOn}
                    onChange={(e) => setStartsOn(e.target.value)}
                    className="w-full text-xs h-9 bg-card"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    Ends On (optional)
                  </label>
                  <Input
                    type="date"
                    value={endsOn}
                    onChange={(e) => setEndsOn(e.target.value)}
                    className="w-full text-xs h-9 bg-card"
                  />
                </div>
              </div>

              {/* Instructions */}
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">
                  Instructions / Notes (optional)
                </label>
                <Textarea
                  placeholder="Optional details, guidelines, or asset drive references"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  className="w-full text-xs bg-card"
                />
              </div>

              {/* Active Toggle */}
              <label className="flex items-center gap-2 text-xs text-foreground cursor-pointer pt-1">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary size-4"
                />
                <span>Assign this task automatically every day</span>
              </label>

              {/* Action Buttons */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                {editingRuleId && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={resetForm}
                    className="text-xs h-8"
                  >
                    Cancel Edit
                  </Button>
                )}
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isSaving}
                  className="gap-1.5 text-xs h-8"
                >
                  <Check className="size-3.5" />
                  <span>{isSaving ? "Saving..." : editingRuleId ? "Update Rule" : "Save Rule"}</span>
                </Button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
