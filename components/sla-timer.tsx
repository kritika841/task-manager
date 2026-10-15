"use client";

import React, { useState, useEffect } from "react";
import { Clock, AlertTriangle, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export function SlaTimer() {
  const [timeLeft, setTimeLeft] = useState<{
    hours: number;
    minutes: number;
    seconds: number;
    totalSeconds: number;
  }>({ hours: 0, minutes: 0, seconds: 0, totalSeconds: 0 });

  const [tooltipOpen, setTooltipOpen] = useState(false);

  useEffect(() => {
    function calculate() {
      const now = new Date();
      // Calculate current time in Asia/Kolkata
      const kolkataTimeStr = now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" });
      const kolkataDate = new Date(kolkataTimeStr);

      // Target is 23:59:59 of current day in Asia/Kolkata
      const cutoff = new Date(kolkataDate);
      cutoff.setHours(23, 59, 59, 999);

      const diffMs = cutoff.getTime() - kolkataDate.getTime();
      const diffSec = Math.max(0, Math.floor(diffMs / 1000));

      const hours = Math.floor(diffSec / 3600);
      const minutes = Math.floor((diffSec % 3600) / 60);
      const seconds = diffSec % 60;

      setTimeLeft({ hours, minutes, seconds, totalSeconds: diffSec });
    }

    calculate();
    const interval = setInterval(calculate, 1000);
    return () => clearInterval(interval);
  }, []);

  const { hours, minutes, totalSeconds } = timeLeft;
  const isCritical = totalSeconds < 3600; // < 1 hour
  const isWarning = totalSeconds < 10800 && !isCritical; // < 3 hours

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setTooltipOpen(!tooltipOpen)}
        className={cn(
          "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-mono font-medium transition border cursor-pointer select-none",
          isCritical
            ? "border-destructive/40 bg-destructive/15 text-destructive animate-pulse"
            : isWarning
            ? "border-warning/40 bg-warning/15 text-warning"
            : "border-border bg-card/80 text-muted-foreground hover:text-foreground hover:bg-muted"
        )}
        title="Daily Target SLA Cutoff Timer (11:59 PM IST)"
      >
        {isCritical ? (
          <ShieldAlert className="size-3 text-destructive" />
        ) : isWarning ? (
          <AlertTriangle className="size-3 text-warning" />
        ) : (
          <Clock className="size-3 text-muted-foreground" />
        )}
        <span>
          Cutoff: {hours}h {minutes}m
        </span>
      </button>

      {/* SLA Info Tooltip */}
      {tooltipOpen && (
        <div className="absolute right-0 top-9 z-50 w-64 rounded-xl border border-border bg-card p-3 shadow-float text-xs text-foreground animate-in fade-in zoom-in-95 duration-100">
          <div className="flex items-center justify-between pb-1.5 border-b border-border font-semibold">
            <span className="flex items-center gap-1.5">
              <Clock className="size-3.5 text-primary" />
              <span>Daily Target Cutoff</span>
            </span>
            <button
              onClick={() => setTooltipOpen(false)}
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              ✕
            </button>
          </div>
          <p className="mt-2 text-muted-foreground text-[11px] leading-relaxed">
            Daily targets close automatically at <strong>11:59 PM IST</strong>. Any incomplete
            deliverable units are carried forward to tomorrow.
          </p>
          <div className="mt-2.5 rounded bg-muted/40 p-2 text-[10px] font-mono text-muted-foreground">
            Current target timezone: <strong>Asia/Kolkata</strong>
          </div>
        </div>
      )}
    </div>
  );
}
