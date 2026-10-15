import * as React from "react";
import { cn } from "@/lib/utils";

interface ProgressBarProps {
  completed: number;
  total: number;
  percentage?: number;
  showLabel?: boolean;
  size?: "sm" | "md";
  className?: string;
}

export function ProgressBar({
  completed,
  total,
  percentage: customPercentage,
  showLabel = true,
  size = "sm",
  className,
}: ProgressBarProps) {
  const percentage =
    customPercentage !== undefined
      ? customPercentage
      : total > 0
      ? Math.round((completed / total) * 100)
      : 0;

  const isComplete = total > 0 && completed === total;

  return (
    <div className={cn("w-full flex flex-col gap-1.5", className)}>
      {showLabel && (
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="flex items-center gap-1 font-medium">
            <span
              className={cn(
                "tabular-nums",
                isComplete ? "text-success font-semibold" : "text-foreground"
              )}
            >
              {completed}/{total}
            </span>
            <span>subtasks</span>
          </span>
          <span
            className={cn(
              "font-mono text-[11px] tabular-nums",
              isComplete ? "text-success font-semibold" : "text-muted-foreground"
            )}
          >
            {percentage}%
          </span>
        </div>
      )}
      <div
        className={cn(
          "w-full rounded-full bg-muted overflow-hidden relative",
          size === "sm" ? "h-1.5" : "h-2"
        )}
      >
        <div
          className={cn(
            "h-full transition-all duration-300 rounded-full",
            isComplete
              ? "bg-success"
              : percentage > 50
              ? "bg-primary"
              : "bg-primary/80"
          )}
          style={{ width: `${Math.min(Math.max(percentage, 0), 100)}%` }}
        />
      </div>
    </div>
  );
}
