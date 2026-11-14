"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  X,
  AlarmClock,
  Plus,
  Check,
  Clock,
  Trash2,
  BellRing,
  Users,
  User as UserIcon,
} from "lucide-react";
import { useTasks } from "@/lib/store";
import { playNotificationSound } from "@/lib/sound";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

export interface ReminderItem {
  id: string;
  title: string;
  note?: string;
  remindAt: string;
  targetUserId: string;
  createdByUserId: string;
  createdByName: string;
  completed: boolean;
  dismissed?: boolean;
  notified?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface RemindersPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onCountChange?: (dueCount: number, pendingCount: number) => void;
}

function toLocalDateTimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function RemindersPanel({
  isOpen,
  onClose,
  onCountChange,
}: RemindersPanelProps) {
  const { currentUser, currentUserId, users, isAdmin } = useTasks();

  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [targetUserId, setTargetUserId] = useState<string>(currentUserId);
  const [remindAtInput, setRemindAtInput] = useState<string>(() =>
    toLocalDateTimeInput(new Date(Date.now() + 30 * 60 * 1000))
  );
  const [submitting, setSubmitting] = useState(false);
  const [filterTab, setFilterTab] = useState<"upcoming" | "completed" | "team">(
    "upcoming"
  );
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  const alertedIdsRef = useRef<Set<string>>(new Set());

  // Sync default targetUserId when currentUserId changes
  useEffect(() => {
    setTargetUserId(currentUserId);
  }, [currentUserId]);

  const extractList = (data: unknown): ReminderItem[] => {
    if (Array.isArray(data)) return data as ReminderItem[];
    if (data && typeof data === "object") {
      const obj = data as Record<string, unknown>;
      if (Array.isArray(obj.reminders)) return obj.reminders as ReminderItem[];
      if (Array.isArray(obj.items)) return obj.items as ReminderItem[];
      if (Array.isArray(obj.data)) return obj.data as ReminderItem[];
    }
    return [];
  };

  const fetchReminders = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const res = await fetch(
        `/api/reminders?userId=${encodeURIComponent(currentUserId)}&role=${encodeURIComponent(currentUser.role)}`,
        {
          headers: {
            "x-user-id": currentUserId,
            "x-user-role": currentUser.role,
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        setReminders(extractList(data));
      }
    } catch {
      // ignore network error
    }
  }, [currentUserId, currentUser.role]);

  // Poll reminders & check due status every 15 seconds
  useEffect(() => {
    fetchReminders();
    const interval = setInterval(() => {
      setNowMs(Date.now());
      fetchReminders();
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchReminders]);

  // Refresh immediately when panel opens
  useEffect(() => {
    if (isOpen) {
      setNowMs(Date.now());
      fetchReminders();
    }
  }, [isOpen, fetchReminders]);

  // Check for newly due reminders for currentUserId and trigger sound
  useEffect(() => {
    const myPending = reminders.filter(
      (r) =>
        (r.targetUserId === currentUserId || r.targetUserId === "all") &&
        !r.completed &&
        !r.dismissed
    );
    const dueNow = myPending.filter(
      (r) => new Date(r.remindAt).getTime() <= nowMs
    );

    if (onCountChange) {
      onCountChange(dueNow.length, myPending.length);
    }

    for (const r of dueNow) {
      if (!alertedIdsRef.current.has(r.id)) {
        alertedIdsRef.current.add(r.id);
        playNotificationSound("reminder");
        if (!r.notified) {
          fetch("/api/reminders", {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "x-user-id": currentUserId,
            },
            body: JSON.stringify({ id: r.id, notified: true }),
          }).catch(() => {});
        }
      }
    }
  }, [reminders, currentUserId, nowMs, onCountChange]);

  const applyQuickTime = (minutesFromNow: number) => {
    const d = new Date(Date.now() + minutesFromNow * 60 * 1000);
    setRemindAtInput(toLocalDateTimeInput(d));
  };

  const handleCreateReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);

    const parsedDate = new Date(remindAtInput);
    const isoRemindAt = Number.isNaN(parsedDate.getTime())
      ? new Date(Date.now() + 15 * 60 * 1000).toISOString()
      : parsedDate.toISOString();

    const effectiveTarget = isAdmin ? targetUserId : currentUserId;

    try {
      if (isAdmin && effectiveTarget === "all") {
        await Promise.all(
          users.map((u) =>
            fetch("/api/reminders", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-user-id": currentUserId,
                "x-user-role": currentUser.role,
              },
              body: JSON.stringify({
                title: title.trim(),
                note: note.trim() || undefined,
                remindAt: isoRemindAt,
                targetUserId: u.id,
                createdByUserId: currentUserId,
                createdByName: currentUser.name,
              }),
            })
          )
        );
      } else {
        await fetch("/api/reminders", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": currentUserId,
            "x-user-role": currentUser.role,
          },
          body: JSON.stringify({
            title: title.trim(),
            note: note.trim() || undefined,
            remindAt: isoRemindAt,
            targetUserId: effectiveTarget,
            createdByUserId: currentUserId,
            createdByName: currentUser.name,
          }),
        });
      }

      setTitle("");
      setNote("");
      await fetchReminders();
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateReminder = async (
    id: string,
    updates: Partial<ReminderItem>
  ) => {
    setReminders((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updates } : r))
    );
    try {
      await fetch("/api/reminders", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": currentUserId,
          "x-user-role": currentUser.role,
        },
        body: JSON.stringify({ id, ...updates, userId: currentUserId }),
      });
    } catch {
      fetchReminders();
    }
  };

  const handleSnooze = async (id: string, minutes: number) => {
    alertedIdsRef.current.delete(id);
    const nextTime = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    await handleUpdateReminder(id, {
      remindAt: nextTime,
      notified: false,
      dismissed: false,
    });
  };

  const handleDeleteReminder = async (id: string) => {
    setReminders((prev) => prev.filter((r) => r.id !== id));
    try {
      await fetch(
        `/api/reminders?id=${encodeURIComponent(id)}&userId=${encodeURIComponent(currentUserId)}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": currentUserId,
          },
          body: JSON.stringify({ id, userId: currentUserId }),
        }
      );
    } catch {
      fetchReminders();
    }
  };

  // Active due alerts for the current user (shown as floating banner even when panel is closed)
  const dueAlerts = reminders.filter(
    (r) =>
      (r.targetUserId === currentUserId || r.targetUserId === "all") &&
      !r.completed &&
      !r.dismissed &&
      new Date(r.remindAt).getTime() <= nowMs
  );

  const myUpcoming = reminders.filter(
    (r) =>
      (r.targetUserId === currentUserId || r.targetUserId === "all") &&
      !r.completed
  );
  const myCompleted = reminders.filter(
    (r) =>
      (r.targetUserId === currentUserId || r.targetUserId === "all") &&
      r.completed
  );
  const teamDelegated = reminders.filter(
    (r) => r.createdByUserId === currentUserId && r.targetUserId !== currentUserId
  );

  const visibleList =
    filterTab === "completed"
      ? myCompleted
      : filterTab === "team"
        ? teamDelegated
        : myUpcoming;

  return (
    <>
      {/* Floating Due Reminder Alert Banner (Always active in background) */}
      {dueAlerts.length > 0 && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80 max-w-[calc(100vw-2rem)]">
          {dueAlerts.slice(0, 3).map((alert) => {
            const isFromAdmin =
              alert.createdByUserId &&
              alert.createdByUserId !== alert.targetUserId;
            return (
              <div
                key={alert.id}
                className="rounded-xl border border-amber-500/40 bg-card p-3.5 shadow-float animate-in fade-in slide-in-from-bottom-3 duration-200"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="flex size-6 items-center justify-center rounded-full bg-amber-500/15 text-amber-500 shrink-0">
                      <BellRing className="size-3.5 animate-bounce" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                          Reminder Due
                        </span>
                        {isFromAdmin && (
                          <span className="rounded bg-primary/15 px-1.5 py-0.2 text-[9px] font-semibold text-primary">
                            From {alert.createdByName}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-semibold text-foreground truncate">
                        {alert.title}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateReminder(alert.id, { dismissed: true })
                    }
                    className="rounded p-0.5 text-muted-foreground hover:text-foreground cursor-pointer"
                    title="Dismiss alert"
                  >
                    <X className="size-3.5" />
                  </button>
                </div>

                {alert.note && (
                  <p className="mt-1.5 text-[11px] text-muted-foreground line-clamp-2">
                    {alert.note}
                  </p>
                )}

                <div className="mt-2.5 flex items-center justify-end gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleSnooze(alert.id, 15)}
                    className="rounded-md border border-border bg-muted/50 px-2 py-1 text-[11px] font-medium text-foreground hover:bg-muted transition cursor-pointer"
                  >
                    Snooze 15m
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      handleUpdateReminder(alert.id, {
                        completed: true,
                        dismissed: true,
                      })
                    }
                    className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-[11px] font-semibold text-primary-foreground hover:opacity-90 transition cursor-pointer"
                  >
                    <Check className="size-3" />
                    <span>Done</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Slide-Over Reminders Drawer */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-foreground/20 backdrop-blur-xs">
          <div className="relative flex h-full w-full max-w-md flex-col border-l border-border bg-card text-card-foreground shadow-float animate-in slide-in-from-right duration-150">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <div className="flex items-center gap-2">
                <AlarmClock className="size-4 text-primary" />
                <h2 className="text-sm font-semibold text-foreground">
                  Reminders
                </h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* New Reminder Form */}
            <form
              onSubmit={handleCreateReminder}
              className="border-b border-border bg-muted/20 p-4 space-y-2.5"
            >
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Remind about..."
                className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />

              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Optional note or link..."
                className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] font-semibold uppercase text-muted-foreground mb-1">
                    When
                  </label>
                  <input
                    type="datetime-local"
                    value={remindAtInput}
                    onChange={(e) => setRemindAtInput(e.target.value)}
                    className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                  />
                </div>

                {isAdmin && (
                  <div>
                    <label className="block text-[10px] font-semibold uppercase text-muted-foreground mb-1">
                      For Member (Admin)
                    </label>
                    <select
                      value={targetUserId}
                      onChange={(e) => setTargetUserId(e.target.value)}
                      className="w-full rounded-lg border border-border bg-background px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
                    >
                      <option value={currentUserId}>
                        Me ({currentUser.name})
                      </option>
                      <option value="all">All Team Members</option>
                      {users
                        .filter((u) => u.id !== currentUserId)
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.role})
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Quick Time Presets + Submit */}
              <div className="flex items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-1">
                  {[
                    { label: "+15m", mins: 15 },
                    { label: "+1h", mins: 60 },
                    { label: "+3h", mins: 180 },
                    { label: "Tomorrow", mins: 24 * 60 },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => applyQuickTime(preset.mins)}
                      className="rounded-md border border-border bg-background px-2 py-1 text-[10px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={submitting || !title.trim()}
                  className="gap-1 text-xs h-7 px-3"
                >
                  <Plus className="size-3.5" />
                  <span>Add</span>
                </Button>
              </div>
            </form>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1.5 border-b border-border px-4 py-2 bg-muted/10">
              <button
                type="button"
                onClick={() => setFilterTab("upcoming")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition cursor-pointer",
                  filterTab === "upcoming"
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Active ({myUpcoming.length})
              </button>
              <button
                type="button"
                onClick={() => setFilterTab("completed")}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition cursor-pointer",
                  filterTab === "completed"
                    ? "bg-primary text-primary-foreground font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Done ({myCompleted.length})
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setFilterTab("team")}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-medium transition cursor-pointer",
                    filterTab === "team"
                      ? "bg-primary text-primary-foreground font-semibold"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Sent to Team ({teamDelegated.length})
                </button>
              )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {visibleList.length === 0 ? (
                <div className="py-12 text-center text-xs text-muted-foreground">
                  No reminders here.
                </div>
              ) : (
                visibleList.map((r) => {
                  const isDue =
                    !r.completed && new Date(r.remindAt).getTime() <= nowMs;
                  const targetUser = users.find((u) => u.id === r.targetUserId);
                  const isFromAdmin =
                    r.createdByUserId && r.createdByUserId !== r.targetUserId;

                  return (
                    <div
                      key={r.id}
                      className={cn(
                        "rounded-xl border p-3 transition space-y-1.5",
                        isDue
                          ? "border-amber-500/40 bg-amber-500/5"
                          : "border-border bg-muted/20"
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateReminder(r.id, {
                                completed: !r.completed,
                                dismissed: !r.completed,
                              })
                            }
                            className={cn(
                              "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition cursor-pointer",
                              r.completed
                                ? "border-emerald-500 bg-emerald-500 text-white"
                                : "border-border hover:border-primary"
                            )}
                          >
                            {r.completed && <Check className="size-3" />}
                          </button>
                          <div className="min-w-0">
                            <p
                              className={cn(
                                "text-xs font-semibold text-foreground",
                                r.completed &&
                                  "line-through text-muted-foreground"
                              )}
                            >
                              {r.title}
                            </p>
                            {r.note && (
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                {r.note}
                              </p>
                            )}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDeleteReminder(r.id)}
                          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition cursor-pointer shrink-0"
                          title="Delete"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-2 pl-6 text-[10px] text-muted-foreground">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 font-mono",
                              isDue &&
                                "text-amber-600 dark:text-amber-400 font-semibold"
                            )}
                          >
                            <Clock className="size-3" />
                            {new Date(r.remindAt).toLocaleString([], {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>

                          {isFromAdmin && filterTab !== "team" && (
                            <span className="rounded bg-primary/15 px-1.5 py-0.2 font-semibold text-primary">
                              From {r.createdByName}
                            </span>
                          )}

                          {filterTab === "team" && targetUser && (
                            <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.2 font-medium text-foreground">
                              <UserIcon className="size-2.5" />
                              To {targetUser.name}
                            </span>
                          )}
                        </div>

                        {!r.completed && isDue && (
                          <button
                            type="button"
                            onClick={() => handleSnooze(r.id, 15)}
                            className="text-[10px] font-semibold text-primary hover:underline cursor-pointer"
                          >
                            Snooze +15m
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
