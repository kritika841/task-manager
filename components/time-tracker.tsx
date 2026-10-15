"use client";

import React, { useState, useEffect } from "react";
import { Play, Pause, Square, Clock, Plus, Check } from "lucide-react";
import { TaskTimeTracking } from "@/lib/types";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

interface TimeTrackerProps {
  taskId: string;
  timeTracking?: TaskTimeTracking;
  estimatedHours?: number;
  actualHours?: number;
  onStart: (taskId: string) => void;
  onStop: (taskId: string) => Promise<void>;
  onLogHours: (taskId: string, hours: number) => Promise<void>;
  disabled?: boolean;
}

export function TimeTracker({
  taskId,
  timeTracking,
  estimatedHours,
  actualHours = 0,
  onStart,
  onStop,
  onLogHours,
  disabled = false,
}: TimeTrackerProps) {
  const isRunning = Boolean(timeTracking?.isRunning);
  const [elapsed, setElapsed] = useState<number>(0);
  const [manualInput, setManualInput] = useState<string>("");
  const [showManual, setShowManual] = useState(false);

  useEffect(() => {
    if (!isRunning || !timeTracking?.startedAt) {
      setElapsed(0);
      return;
    }

    const startTs = new Date(timeTracking.startedAt).getTime();
    const update = () => {
      const now = Date.now();
      setElapsed(Math.max(0, Math.floor((now - startTs) / 1000)));
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [isRunning, timeTracking?.startedAt]);

  const totalCurrentSeconds = (timeTracking?.totalSeconds || 0) + elapsed;
  const currentActualHours = actualHours || Number((totalCurrentSeconds / 3600).toFixed(2));

  const formatTimer = (totalSec: number) => {
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    return `${hrs > 0 ? `${hrs}h ` : ""}${mins.toString().padStart(2, "0")}m ${secs
      .toString()
      .padStart(2, "0")}s`;
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const h = parseFloat(manualInput);
    if (!isNaN(h) && h > 0) {
      await onLogHours(taskId, h);
      setManualInput("");
      setShowManual(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-3 text-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 font-semibold text-foreground">
          <Clock className="size-3.5 text-primary" />
          <span>Time Tracking & Work Stopwatch</span>
        </div>

        {isRunning && (
          <span className="flex items-center gap-1.5 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-500 font-semibold animate-pulse">
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Working Now
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 bg-card p-2.5 rounded-lg border border-border">
        {/* Stopwatch Display */}
        <div>
          <div className="text-[10px] text-muted-foreground uppercase font-medium">
            Elapsed Active Time
          </div>
          <div className="font-mono text-base font-bold text-foreground">
            {formatTimer(totalCurrentSeconds)}
          </div>
        </div>

        {/* Start / Stop Button */}
        <div className="flex items-center gap-2">
          {isRunning ? (
            <Button
              type="button"
              size="sm"
              variant="danger"
              onClick={() => onStop(taskId)}
              className="h-8 text-xs gap-1 shadow-xs"
              disabled={disabled}
            >
              <Square className="size-3 fill-current" />
              <span>Stop & Save</span>
            </Button>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="primary"
              onClick={() => onStart(taskId)}
              className="h-8 text-xs gap-1 shadow-xs"
              disabled={disabled}
            >
              <Play className="size-3 fill-current" />
              <span>Start Working</span>
            </Button>
          )}
        </div>
      </div>

      {/* Estimates & Logged Hours */}
      <div className="flex items-center justify-between text-muted-foreground pt-1 border-t border-border/50 text-[11px]">
        <div>
          <span>Logged: </span>
          <strong className="text-foreground">{currentActualHours}h</strong>
          {estimatedHours ? (
            <span> / Est: {estimatedHours}h</span>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onLogHours(taskId, 0.5)}
            className="text-[10px] bg-muted hover:bg-muted/80 text-foreground px-1.5 py-0.5 rounded cursor-pointer transition font-medium"
            disabled={disabled}
          >
            +30m
          </button>
          <button
            type="button"
            onClick={() => onLogHours(taskId, 1)}
            className="text-[10px] bg-muted hover:bg-muted/80 text-foreground px-1.5 py-0.5 rounded cursor-pointer transition font-medium"
            disabled={disabled}
          >
            +1h
          </button>
          <button
            type="button"
            onClick={() => setShowManual((prev) => !prev)}
            className="text-[10px] text-primary hover:underline ml-1 cursor-pointer font-medium"
          >
            Custom
          </button>
        </div>
      </div>

      {/* Manual hours input */}
      {showManual && (
        <form onSubmit={handleManualSubmit} className="flex gap-2 pt-1">
          <input
            type="number"
            step="0.25"
            placeholder="Add hours e.g. 1.5"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            className="text-xs h-7 rounded border border-border px-2 flex-1 bg-card text-foreground"
          />
          <Button type="submit" size="sm" variant="secondary" className="h-7 text-xs">
            Add
          </Button>
        </form>
      )}
    </div>
  );
}
