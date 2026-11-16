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
  Calendar,
  Repeat,
  User as UserIcon,
  Edit3,
  Search,
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
  targetUserName?: string;
  createdByUserId: string;
  createdByName: string;
  enabled?: boolean;
  isLongTerm?: boolean;
  recurrence?: string;
  completed: boolean;
  dismissed?: boolean;
  notified?: boolean;
  createdAt: string;
  updatedAt: string;
}

interface RemindersPanelProps {
  isOpen?: boolean;
  onClose?: () => void;
  onCountChange?: (dueCount: number, pendingCount: number) => void;
  asView?: boolean;
}

function toLocalDateTimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function RemindersPanel({
  isOpen = false,
  onClose,
  onCountChange,
  asView = false,
}: RemindersPanelProps) {
  const { currentUser, currentUserId, users, isAdmin } = useTasks();

  const [reminders, setReminders] = useState<ReminderItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterTab, setFilterTab] = useState<
    "all" | "active" | "long_term" | "paused" | "completed"
  >("all");
  const [nowMs, setNowMs] = useState<number>(() => Date.now());

  // Lightbox Modal State for Add / Edit Reminder
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [editingReminderId, setEditingReminderId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [targetUserId, setTargetUserId] = useState<string>(currentUserId);
  const [remindAtInput, setRemindAtInput] = useState<string>(() =>
    toLocalDateTimeInput(new Date(Date.now() + 60 * 60 * 1000))
  );
  const [isLongTerm, setIsLongTerm] = useState<boolean>(false);
  const [recurrence, setRecurrence] = useState<string>("once");
  const [enabled, setEnabled] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState(false);

  const alertedIdsRef = useRef<Set<string>>(new Set());
  const prevCountsRef = useRef<{ due: number; pending: number }>({
    due: -1,
    pending: -1,
  });

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
        `/api/reminders?userId=${encodeURIComponent(currentUserId)}&role=${encodeURIComponent(currentUser.role)}&includeAll=true`,
        {
          headers: {
            "x-user-id": currentUserId,
            "x-user-role": currentUser.role,
          },
          cache: "no-store",
        }
      );
      if (res.ok) {
        const data = await res.json();
        const incoming = extractList(data);
        setReminders((prev) => {
          if (JSON.stringify(prev) === JSON.stringify(incoming)) {
            return prev;
          }
          return incoming;
        });
      }
    } catch {
      // ignore network error
    }
  }, [currentUserId, currentUser.role]);

  // Poll reminders every 30 seconds quietly
  useEffect(() => {
    fetchReminders();
    const interval = setInterval(() => {
      setNowMs(Date.now());
      fetchReminders();
    }, 30000);
    return () => clearInterval(interval);
  }, [fetchReminders]);

  useEffect(() => {
    if (isOpen || asView) {
      setNowMs(Date.now());
      fetchReminders();
    }
  }, [isOpen, asView, fetchReminders]);

  // Check for newly due reminders for currentUserId and trigger sound (only when enabled !== false)
  useEffect(() => {
    const myPending = reminders.filter(
      (r) =>
        (r.targetUserId === currentUserId || r.targetUserId === "all") &&
        r.enabled !== false &&
        !r.completed &&
        !r.dismissed
    );
    const dueNow = myPending.filter(
      (r) => new Date(r.remindAt).getTime() <= nowMs
    );

    if (
      onCountChange &&
      (prevCountsRef.current.due !== dueNow.length ||
        prevCountsRef.current.pending !== myPending.length)
    ) {
      prevCountsRef.current = {
        due: dueNow.length,
        pending: myPending.length,
      };
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

  const openAddLightbox = () => {
    setEditingReminderId(null);
    setTitle("");
    setNote("");
    setTargetUserId(currentUserId);
    setRemindAtInput(
      toLocalDateTimeInput(new Date(Date.now() + 60 * 60 * 1000))
    );
    setIsLongTerm(false);
    setRecurrence("once");
    setEnabled(true);
    setIsLightboxOpen(true);
  };

  const openEditLightbox = (r: ReminderItem) => {
    setEditingReminderId(r.id);
    setTitle(r.title);
    setNote(r.note || "");
    setTargetUserId(r.targetUserId || currentUserId);
    setRemindAtInput(toLocalDateTimeInput(new Date(r.remindAt)));
    setIsLongTerm(Boolean(r.isLongTerm));
    setRecurrence(r.recurrence || "once");
    setEnabled(r.enabled !== false);
    setIsLightboxOpen(true);
  };

  const applyPresetOffset = (days: number, minutes = 0, longTermFlag = false) => {
    const d = new Date(
      Date.now() + days * 24 * 60 * 60 * 1000 + minutes * 60 * 1000
    );
    setRemindAtInput(toLocalDateTimeInput(d));
    setIsLongTerm(longTermFlag || days >= 7);
  };

  const handleSaveReminder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);

    const parsedDate = new Date(remindAtInput);
    const isoRemindAt = Number.isNaN(parsedDate.getTime())
      ? new Date(Date.now() + 60 * 60 * 1000).toISOString()
      : parsedDate.toISOString();

    const daysAhead =
      (new Date(isoRemindAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    const effectiveLongTerm = isLongTerm || daysAhead >= 7;
    const effectiveTarget = isAdmin ? targetUserId : currentUserId;

    try {
      if (editingReminderId) {
        await handleUpdateReminder(editingReminderId, {
          title: title.trim(),
          note: note.trim() || undefined,
          remindAt: isoRemindAt,
          isLongTerm: effectiveLongTerm,
          recurrence,
          enabled,
        });
      } else if (isAdmin && effectiveTarget === "all") {
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
                enabled,
                isLongTerm: effectiveLongTerm,
                recurrence,
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
            enabled,
            isLongTerm: effectiveLongTerm,
            recurrence,
          }),
        });
      }

      setIsLightboxOpen(false);
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

  const handleToggleEnabled = async (r: ReminderItem) => {
    const nextEnabled = r.enabled === false ? true : false;
    await handleUpdateReminder(r.id, {
      enabled: nextEnabled,
      ...(nextEnabled ? { dismissed: false } : {}),
    });
  };

  const handleSnooze = async (id: string, minutes: number) => {
    alertedIdsRef.current.delete(id);
    const nextTime = new Date(Date.now() + minutes * 60 * 1000).toISOString();
    await handleUpdateReminder(id, {
      remindAt: nextTime,
      notified: false,
      dismissed: false,
      enabled: true,
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

  // Active due alerts for the current user (shown as floating banner when due)
  const dueAlerts = reminders.filter(
    (r) =>
      (r.targetUserId === currentUserId || r.targetUserId === "all") &&
      r.enabled !== false &&
      !r.completed &&
      !r.dismissed &&
      new Date(r.remindAt).getTime() <= nowMs
  );

  const isReminderLongTerm = (r: ReminderItem) => {
    if (r.isLongTerm) return true;
    const diffDays =
      (new Date(r.remindAt).getTime() - new Date(r.createdAt || nowMs).getTime()) /
      (1000 * 60 * 60 * 24);
    return diffDays >= 7 || (r.recurrence && r.recurrence !== "once");
  };

  const filteredReminders = reminders.filter((r) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = r.title.toLowerCase().includes(q);
      const matchNote = r.note?.toLowerCase().includes(q);
      if (!matchTitle && !matchNote) return false;
    }
    if (filterTab === "active") {
      return r.enabled !== false && !r.completed;
    }
    if (filterTab === "long_term") {
      return isReminderLongTerm(r);
    }
    if (filterTab === "paused") {
      return r.enabled === false && !r.completed;
    }
    if (filterTab === "completed") {
      return r.completed;
    }
    return true;
  });

  // If mounted purely as background listener in AppShell
  if (!asView && !isOpen) {
    if (dueAlerts.length === 0) return null;
    return (
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
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-500 border border-amber-500/20">
            <AlarmClock className="size-4" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Reminders
            </h1>
            <span className="text-xs font-mono text-muted-foreground">
              ({reminders.length})
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search reminders..."
              className="w-40 sm:w-52 rounded-lg border border-border bg-muted/30 pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          </div>

          {/* Add Reminder Button -> Opens Lightbox */}
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={openAddLightbox}
            className="gap-1.5 text-xs h-8 shadow-xs cursor-pointer"
          >
            <Plus className="size-3.5" />
            <span>Add Reminder</span>
          </Button>

          {!asView && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
        {[
          { id: "all", label: `All Reminders (${reminders.length})` },
          {
            id: "active",
            label: `Active (${reminders.filter((r) => r.enabled !== false && !r.completed).length})`,
          },
          {
            id: "long_term",
            label: `Long-Term (${reminders.filter((r) => isReminderLongTerm(r)).length})`,
          },
          {
            id: "paused",
            label: `Off / Paused (${reminders.filter((r) => r.enabled === false && !r.completed).length})`,
          },
          {
            id: "completed",
            label: `Completed (${reminders.filter((r) => r.completed).length})`,
          },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setFilterTab(tab.id as any)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer shrink-0",
              filterTab === tab.id
                ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Reminders List / Grid */}
      {filteredReminders.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 py-16 px-4 text-center space-y-3">
          <div className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
            <AlarmClock className="size-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">
              No reminders found
            </h3>
            <p className="text-xs text-muted-foreground">
              Set short-term or long-term reminders and toggle them on or off anytime.
            </p>
          </div>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={openAddLightbox}
            className="gap-1.5 text-xs h-8 cursor-pointer"
          >
            <Plus className="size-3.5" />
            <span>Add Reminder</span>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {filteredReminders.map((r) => {
            const isEnabled = r.enabled !== false;
            const isDue =
              isEnabled &&
              !r.completed &&
              new Date(r.remindAt).getTime() <= nowMs;
            const longTerm = isReminderLongTerm(r);
            const targetUser = users.find((u) => u.id === r.targetUserId);

            return (
              <div
                key={r.id}
                className={cn(
                  "rounded-2xl border p-4 transition-all flex flex-col justify-between gap-3 shadow-2xs",
                  !isEnabled || r.completed
                    ? "border-border/70 bg-muted/15 opacity-75"
                    : isDue
                      ? "border-amber-500/50 bg-amber-500/5"
                      : "border-border bg-card hover:border-primary/40"
                )}
              >
                <div className="space-y-2">
                  {/* Top Row: Badges + On/Off Toggle Switch */}
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {longTerm ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-violet-500/15 border border-violet-500/30 px-2 py-0.5 text-[10px] font-semibold text-violet-500">
                          <Calendar className="size-2.5" />
                          <span>Long-Term</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-semibold text-primary">
                          <Clock className="size-2.5" />
                          <span>Reminder</span>
                        </span>
                      )}

                      {r.recurrence && r.recurrence !== "once" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 border border-sky-500/25 px-2 py-0.5 text-[10px] font-semibold text-sky-500 capitalize">
                          <Repeat className="size-2.5" />
                          <span>{r.recurrence}</span>
                        </span>
                      )}

                      {isDue && (
                        <span className="rounded-full bg-amber-500 px-2 py-0.5 text-[10px] font-bold text-white">
                          Due Now
                        </span>
                      )}
                    </div>

                    {/* Automatic On/Off Toggle Button */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span
                        className={cn(
                          "text-[10px] font-mono font-bold uppercase",
                          isEnabled ? "text-emerald-500" : "text-muted-foreground"
                        )}
                      >
                        {isEnabled ? "On" : "Off"}
                      </span>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={isEnabled}
                        onClick={() => handleToggleEnabled(r)}
                        className={cn(
                          "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out",
                          isEnabled ? "bg-emerald-500" : "bg-muted-foreground/30"
                        )}
                        title={
                          isEnabled
                            ? "Reminder is ON (Click to turn off)"
                            : "Reminder is OFF (Click to turn on)"
                        }
                      >
                        <span
                          className={cn(
                            "pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out",
                            isEnabled ? "translate-x-4" : "translate-x-0"
                          )}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Title & Note */}
                  <div className="flex items-start gap-2 pt-1">
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
                      title={r.completed ? "Mark incomplete" : "Mark completed"}
                    >
                      {r.completed && <Check className="size-3" />}
                    </button>

                    <div className="min-w-0 flex-1">
                      <h3
                        className={cn(
                          "text-sm font-bold text-foreground leading-snug",
                          r.completed && "line-through text-muted-foreground"
                        )}
                      >
                        {r.title}
                      </h3>
                      {r.note && (
                        <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap line-clamp-3">
                          {r.note}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Footer: Date/Time + Actions */}
                <div className="pt-2.5 border-t border-border/60 flex items-center justify-between gap-2 text-[11px] text-muted-foreground">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 font-mono",
                        isDue && "text-amber-500 font-semibold"
                      )}
                    >
                      <Clock className="size-3" />
                      {new Date(r.remindAt).toLocaleString([], {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>

                    {targetUser && (
                      <span className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium text-foreground">
                        <UserIcon className="size-2.5" />
                        <span>{targetUser.name}</span>
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {!r.completed && isDue && (
                      <button
                        type="button"
                        onClick={() => handleSnooze(r.id, 15)}
                        className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-primary hover:bg-primary/10 cursor-pointer"
                      >
                        +15m
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => openEditLightbox(r)}
                      className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
                      title="Edit reminder"
                    >
                      <Edit3 className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteReminder(r.id)}
                      className="rounded-lg p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition cursor-pointer"
                      title="Delete reminder"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lightbox Modal for Adding / Editing Reminder */}
      {isLightboxOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setIsLightboxOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-float space-y-4 animate-in zoom-in-95 duration-150"
          >
            {/* Lightbox Header */}
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <AlarmClock className="size-4 text-amber-500" />
                <h2 className="text-sm font-bold text-foreground">
                  {editingReminderId ? "Edit Reminder" : "Add Reminder"}
                </h2>
              </div>

              <div className="flex items-center gap-2">
                {/* Active On/Off Toggle inside Lightbox */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    {enabled ? "Active (On)" : "Paused (Off)"}
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={enabled}
                    onClick={() => setEnabled(!enabled)}
                    className={cn(
                      "relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out",
                      enabled ? "bg-emerald-500" : "bg-muted-foreground/30"
                    )}
                  >
                    <span
                      className={cn(
                        "pointer-events-none inline-block size-4 transform rounded-full bg-white shadow-xs transition duration-200 ease-in-out",
                        enabled ? "translate-x-4" : "translate-x-0"
                      )}
                    />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setIsLightboxOpen(false)}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveReminder} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Reminder Title *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What do you want to be reminded about?"
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold text-foreground mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  rows={3}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Add details, links, or long-term milestone notes..."
                  className="w-full resize-none rounded-xl border border-border bg-background p-3 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
              </div>

              {/* Horizon Type & Recurrence */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    Reminder Horizon
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 rounded-xl border border-border bg-muted/30 p-1">
                    <button
                      type="button"
                      onClick={() => setIsLongTerm(false)}
                      className={cn(
                        "rounded-lg py-1.5 text-xs font-medium transition cursor-pointer",
                        !isLongTerm
                          ? "bg-card text-foreground font-semibold shadow-2xs"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Short-Term
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsLongTerm(true)}
                      className={cn(
                        "rounded-lg py-1.5 text-xs font-medium transition cursor-pointer",
                        isLongTerm
                          ? "bg-violet-500 text-white font-semibold shadow-2xs"
                          : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      Long-Term
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    Repeat / Recurrence
                  </label>
                  <select
                    value={recurrence}
                    onChange={(e) => setRecurrence(e.target.value)}
                    className="w-full h-9 rounded-xl border border-border bg-background px-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
                  >
                    <option value="once">One-Time</option>
                    <option value="daily">Daily</option>
                    <option value="weekly">Weekly</option>
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly (Every 3 Months)</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>

              {/* Date & Time + Target User */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-foreground mb-1">
                    Date & Time
                  </label>
                  <input
                    type="datetime-local"
                    value={remindAtInput}
                    onChange={(e) => setRemindAtInput(e.target.value)}
                    className="w-full h-9 rounded-xl border border-border bg-background px-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
                  />
                </div>

                {isAdmin && (
                  <div>
                    <label className="block font-semibold text-foreground mb-1">
                      Assign To
                    </label>
                    <select
                      value={targetUserId}
                      onChange={(e) => setTargetUserId(e.target.value)}
                      className="w-full h-9 rounded-xl border border-border bg-background px-2.5 text-xs text-foreground focus:border-primary focus:outline-none"
                    >
                      <option value={currentUserId}>
                        Me ({currentUser.name})
                      </option>
                      <option value="all">All Team Members</option>
                      {users
                        .filter((u) => u.id !== currentUserId)
                        .map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name} ({u.role.replace("_", " ")})
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Quick Time Presets (Short-Term & Long-Term) */}
              <div className="space-y-1.5">
                <span className="block text-[11px] font-semibold text-muted-foreground">
                  Quick Schedule Presets
                </span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {[
                    { label: "+30m", days: 0, mins: 30, long: false },
                    { label: "+1h", days: 0, mins: 60, long: false },
                    { label: "Tomorrow", days: 1, mins: 0, long: false },
                    { label: "+1 Week", days: 7, mins: 0, long: true },
                    { label: "+1 Month", days: 30, mins: 0, long: true },
                    { label: "+3 Months", days: 90, mins: 0, long: true },
                    { label: "+6 Months", days: 180, mins: 0, long: true },
                    { label: "+1 Year", days: 365, mins: 0, long: true },
                  ].map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() =>
                        applyPresetOffset(preset.days, preset.mins, preset.long)
                      }
                      className={cn(
                        "rounded-lg border px-2 py-1 text-[10px] font-medium transition cursor-pointer",
                        preset.long
                          ? "border-violet-500/30 bg-violet-500/5 text-violet-500 hover:bg-violet-500/15"
                          : "border-border bg-background text-muted-foreground hover:text-foreground hover:bg-muted"
                      )}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit Actions */}
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setIsLightboxOpen(false)}
                  className="text-xs h-8"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={submitting || !title.trim()}
                  className="text-xs h-8 px-4"
                >
                  {submitting
                    ? "Saving..."
                    : editingReminderId
                      ? "Save Changes"
                      : "Add Reminder"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
