"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  Bell,
  CheckCheck,
  Trash2,
  X,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileEdit,
  UserCheck,
  Send,
  Sparkles,
} from "lucide-react";
import { useTasks } from "@/lib/store";
import { NotificationItem } from "@/lib/types";
import { cn } from "@/lib/utils";

function getNotificationIcon(title: string) {
  const lower = title.toLowerCase();
  if (lower.includes("approved") || lower.includes("completed")) {
    return <CheckCircle2 className="size-4 text-success" />;
  }
  if (lower.includes("revision") || lower.includes("warning")) {
    return <AlertCircle className="size-4 text-warning" />;
  }
  if (lower.includes("deleted")) {
    return <Trash2 className="size-4 text-destructive" />;
  }
  if (lower.includes("reassigned") || lower.includes("assigned")) {
    return <UserCheck className="size-4 text-primary" />;
  }
  if (lower.includes("review")) {
    return <Clock className="size-4 text-primary" />;
  }
  return <FileEdit className="size-4 text-muted-foreground" />;
}

function timeAgo(dateString: string): string {
  try {
    const now = new Date();
    const date = new Date(dateString);
    const diffSecs = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (diffSecs < 60) return "just now";
    const diffMins = Math.floor(diffSecs / 60);
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export function NotificationCenter() {
  const {
    notifications,
    unreadNotificationsCount,
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification,
    currentUser,
    tasks,
    setSelectedTaskId,
  } = useTasks();

  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(unreadNotificationsCount);
  const [activeToast, setActiveToast] = useState<NotificationItem | null>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Show a popup toast when a new unread notification arrives for this user
  useEffect(() => {
    if (unreadNotificationsCount > prevCountRef.current && notifications.length > 0) {
      const newest = notifications[0];
      if (!newest.readAt) {
        setActiveToast(newest);
        const timer = setTimeout(() => setActiveToast(null), 5000);
        return () => clearTimeout(timer);
      }
    }
    prevCountRef.current = unreadNotificationsCount;
  }, [unreadNotificationsCount, notifications]);

  const displayedNotifications = filter === "unread"
    ? notifications.filter((n) => !n.readAt)
    : notifications;

  const handleNotificationClick = (item: NotificationItem) => {
    if (!item.readAt) {
      markNotificationAsRead(item.id);
    }
    // If notification body mentions a task, attempt to match and open drawer
    const foundTask = tasks.find(
      (t) =>
        item.title.includes(t.taskNumber) ||
        item.body.includes(t.taskNumber) ||
        item.body.toLowerCase().includes(t.title.toLowerCase())
    );
    if (foundTask) {
      setSelectedTaskId(foundTask.id);
      setIsOpen(false);
    }
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "relative flex size-8 items-center justify-center rounded-lg border transition cursor-pointer",
          isOpen
            ? "border-primary bg-primary/10 text-primary"
            : "border-border bg-card hover:bg-muted text-muted-foreground hover:text-foreground"
        )}
        title="Notifications delivered to you"
        aria-label="Notifications"
      >
        <Bell className="size-4" />
        {unreadNotificationsCount > 0 && (
          <span className="absolute -top-1 -right-1 flex size-4 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground animate-pulse font-mono">
            {unreadNotificationsCount > 9 ? "9+" : unreadNotificationsCount}
          </span>
        )}
      </button>

      {/* Floating Realtime Toast */}
      {activeToast && (
        <div
          onClick={() => {
            handleNotificationClick(activeToast);
            setActiveToast(null);
          }}
          className="fixed top-16 right-4 z-50 max-w-sm rounded-xl border border-primary/30 bg-card p-3.5 shadow-float backdrop-blur-md animate-in slide-in-from-top-3 duration-200 cursor-pointer hover:border-primary transition"
        >
          <div className="flex items-start gap-2.5">
            <div className="mt-0.5 shrink-0">{getNotificationIcon(activeToast.title)}</div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-bold text-foreground truncate">
                  {activeToast.title}
                </h4>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveToast(null);
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              </div>
              <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                {activeToast.body}
              </p>
              <span className="text-[10px] font-mono text-primary/80 mt-1 block">
                Delivered to {currentUser.name} · just now
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Notification Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 top-10 z-50 w-80 sm:w-96 rounded-2xl border border-border bg-card/95 p-0 shadow-float backdrop-blur-md animate-in fade-in-50 zoom-in-95 duration-150">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border/80 p-3 bg-muted/20">
            <div>
              <div className="flex items-center gap-1.5">
                <h3 className="text-xs font-bold text-foreground">Notifications</h3>
                {unreadNotificationsCount > 0 && (
                  <span className="rounded-full bg-primary/15 px-1.5 py-0.2 text-[10px] font-mono font-bold text-primary">
                    {unreadNotificationsCount} new
                  </span>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Delivered to <strong>{currentUser.name}</strong>
              </p>
            </div>

            <div className="flex items-center gap-1">
              {unreadNotificationsCount > 0 && (
                <button
                  type="button"
                  onClick={markAllNotificationsAsRead}
                  className="flex items-center gap-1 rounded px-2 py-1 text-[11px] font-medium text-primary hover:bg-primary/10 transition cursor-pointer"
                  title="Mark all as read"
                >
                  <CheckCheck className="size-3" />
                  <span>Mark all read</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="size-6 rounded text-muted-foreground hover:bg-muted hover:text-foreground flex items-center justify-center transition"
              >
                <X className="size-3.5" />
              </button>
            </div>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 border-b border-border/60 px-3 py-1.5 bg-muted/10 text-xs">
            <button
              type="button"
              onClick={() => setFilter("all")}
              className={cn(
                "rounded-md px-2 py-0.5 text-[11px] font-medium transition cursor-pointer",
                filter === "all"
                  ? "bg-card text-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              All ({notifications.length})
            </button>
            <button
              type="button"
              onClick={() => setFilter("unread")}
              className={cn(
                "rounded-md px-2 py-0.5 text-[11px] font-medium transition cursor-pointer",
                filter === "unread"
                  ? "bg-card text-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Unread ({unreadNotificationsCount})
            </button>
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-border/60">
            {displayedNotifications.map((item) => {
              const isUnread = !item.readAt;

              return (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  className={cn(
                    "flex items-start gap-2.5 p-3 text-xs transition cursor-pointer group hover:bg-muted/40",
                    isUnread ? "bg-primary/5" : "bg-card"
                  )}
                >
                  <div className="mt-0.5 shrink-0">
                    {getNotificationIcon(item.title)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1.5">
                      <span className={cn("text-xs font-semibold leading-snug", isUnread ? "text-foreground" : "text-foreground/80")}>
                        {item.title}
                      </span>
                      {isUnread && (
                        <span className="size-2 rounded-full bg-primary shrink-0" title="Unread" />
                      )}
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">
                      {item.body}
                    </p>

                    <div className="flex items-center justify-between mt-1 text-[10px] text-muted-foreground font-mono">
                      <span>{timeAgo(item.createdAt)}</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteNotification(item.id);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-destructive transition"
                        title="Delete notification"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {displayedNotifications.length === 0 && (
              <div className="py-10 px-4 text-center">
                <Sparkles className="size-6 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-xs font-medium text-foreground">All caught up!</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  No {filter === "unread" ? "unread " : ""}notifications delivered to {currentUser.name}.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
