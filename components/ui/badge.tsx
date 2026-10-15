import * as React from "react";
import { cn } from "@/lib/utils";
import type { TaskPriority, TaskStatus } from "@/lib/types";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "default" | "success" | "warning" | "destructive" | "accent" | "muted";
}

export function Badge({
  className,
  variant = "default",
  children,
  ...props
}: BadgeProps) {
  const variants = {
    default: "bg-muted text-muted-foreground",
    success: "bg-success/15 text-success",
    warning: "bg-warning/15 text-warning",
    destructive: "bg-destructive/15 text-destructive",
    accent: "bg-accent text-accent-foreground",
    muted: "bg-muted text-muted-foreground",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors select-none",
        variants[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ status }: { status: TaskStatus }) {
  const configs: Record<
    TaskStatus,
    { label: string; variant: BadgeProps["variant"]; dotColor: string }
  > = {
    backlog: { label: "Backlog", variant: "muted", dotColor: "bg-muted-foreground" },
    todo: { label: "To Do", variant: "accent", dotColor: "bg-accent-foreground" },
    in_progress: { label: "In Progress", variant: "warning", dotColor: "bg-warning" },
    in_review: { label: "In Review", variant: "warning", dotColor: "bg-warning" },
    completed: { label: "Completed", variant: "success", dotColor: "bg-success" },
  };

  const config = configs[status] || configs.backlog;

  return (
    <Badge variant={config.variant}>
      <span className={cn("size-1.5 rounded-full", config.dotColor)} />
      {config.label}
    </Badge>
  );
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  const configs: Record<
    TaskPriority,
    { label: string; variant: BadgeProps["variant"] }
  > = {
    low: { label: "Low", variant: "muted" },
    medium: { label: "Medium", variant: "accent" },
    high: { label: "High", variant: "warning" },
    urgent: { label: "Urgent", variant: "destructive" },
  };

  const config = configs[priority] || configs.medium;

  return (
    <Badge variant={config.variant} className="font-semibold text-[11px] uppercase tracking-wider">
      {config.label}
    </Badge>
  );
}
