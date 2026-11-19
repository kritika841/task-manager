"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  CalendarCheck,
  Download,
  Search,
  ShieldAlert,
  Users,
  UserCheck,
  Clock,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  ArrowUpDown,
  CalendarRange,
  LogIn,
  LogOut,
} from "lucide-react";
import { useTasks } from "@/lib/store";
import { dateInTargetTimeZone } from "@/lib/supabase";
import {
  AttendanceLedgerRow,
  AttendanceLedgerSummary,
  AttendanceLedgerUser,
} from "@/lib/types";
import { cn, getUserColor, getEmployeeCode } from "@/lib/utils";
import { Button } from "./ui/button";

type LedgerEmployeeFilter = "all" | "present_in_range" | "active_now" | "absent_in_range";
type DateSortOrder = "desc" | "asc";

function shiftISODate(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

function diffDaysInclusive(startDate: string, endDate: string): number {
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  const s = Date.UTC(sy, (sm || 1) - 1, sd || 1);
  const e = Date.UTC(ey, (em || 1) - 1, ed || 1);
  return Math.max(1, Math.round((e - s) / 86_400_000) + 1);
}

function getStartOfWeekISO(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  const day = dt.getUTCDay(); // 0 = Sun, 1 = Mon
  const offsetToMon = day === 0 ? -6 : 1 - day;
  dt.setUTCDate(dt.getUTCDate() + offsetToMon);
  return dt.toISOString().slice(0, 10);
}

function getStartOfMonthISO(dateStr: string): string {
  return `${dateStr.slice(0, 7)}-01`;
}

function formatISTTimeCompact(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  })
    .format(d)
    .toUpperCase();
}

function formatISTTimeFull(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(d);
}

function formatDuration(checkInTime: string | null, checkOutTime: string | null): string {
  if (!checkInTime) return "—";
  if (!checkOutTime) return "In Progress";
  const diffMs = new Date(checkOutTime).getTime() - new Date(checkInTime).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return "—";
  const totalMinutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function formatLedgerDateLabel(dateStr: string): {
  shortDate: string;
  weekday: string;
  isWeekend: boolean;
} {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  const dayIdx = dt.getUTCDay();
  const shortDate = new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(dt);
  const weekday = new Intl.DateTimeFormat("en-IN", {
    timeZone: "UTC",
    weekday: "short",
  }).format(dt);
  return {
    shortDate,
    weekday,
    isWeekend: dayIdx === 0 || dayIdx === 6,
  };
}

export function AttendancePanel() {
  const {
    currentUser,
    isAdmin,
    setActiveSection,
    setViewMode,
    myTodayAttendance,
  } = useTasks();

  const todayIST = useMemo(() => dateInTargetTimeZone(), []);
  const [startDate, setStartDate] = useState<string>(() => shiftISODate(todayIST, -6));
  const [endDate, setEndDate] = useState<string>(todayIST);
  const [users, setUsers] = useState<AttendanceLedgerUser[]>([]);
  const [rows, setRows] = useState<AttendanceLedgerRow[]>([]);
  const [summary, setSummary] = useState<AttendanceLedgerSummary | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [employeeFilter, setEmployeeFilter] = useState<LedgerEmployeeFilter>("all");
  const [sortOrder, setSortOrder] = useState<DateSortOrder>("desc");

  const fetchAttendanceLedger = useCallback(async () => {
    if (!isAdmin) return;
    setIsLoading(true);
    setError(null);
    try {
      const s = startDate <= endDate ? startDate : endDate;
      const e = startDate <= endDate ? endDate : startDate;
      const res = await fetch(
        `/api/attendance?startDate=${encodeURIComponent(s)}&endDate=${encodeURIComponent(e)}`,
        { cache: "no-store" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to load attendance ledger.");
      }
      const ledger = data.ledger || {};
      setUsers(Array.isArray(ledger.users) ? ledger.users : []);
      setRows(Array.isArray(ledger.rows) ? ledger.rows : []);
      setSummary(ledger.summary || null);
    } catch (err: any) {
      setError(err?.message || "Failed to load attendance ledger.");
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, startDate, endDate]);

  useEffect(() => {
    void fetchAttendanceLedger();
  }, [fetchAttendanceLedger, myTodayAttendance?.checkInTime, myTodayAttendance?.checkOutTime]);

  const userStatsMap = useMemo(() => {
    const map = new Map<
      string,
      { presentDays: number; checkedOutDays: number; activeDays: number }
    >();
    for (const u of users) {
      map.set(u.userId, { presentDays: 0, checkedOutDays: 0, activeDays: 0 });
    }
    for (const row of rows) {
      for (const u of users) {
        const cell = row.cells[u.userId];
        if (!cell || cell.status !== "present") continue;
        const stat = map.get(u.userId)!;
        stat.presentDays += 1;
        if (cell.checkOutTime) {
          stat.checkedOutDays += 1;
        } else {
          stat.activeDays += 1;
        }
      }
    }
    return map;
  }, [users, rows]);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const stats = userStatsMap.get(u.userId);
      if (employeeFilter === "present_in_range" && !(stats && stats.presentDays > 0)) {
        return false;
      }
      if (employeeFilter === "active_now" && !(stats && stats.activeDays > 0)) {
        return false;
      }
      if (employeeFilter === "absent_in_range" && stats && stats.presentDays > 0) {
        return false;
      }

      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const matchName = u.userName.toLowerCase().includes(q);
        const matchEmail = u.userEmail.toLowerCase().includes(q);
        const matchCode = u.employeeCode.toLowerCase().includes(q);
        const matchDept = u.department.toLowerCase().includes(q);
        const matchRole = u.role.replace(/_/g, " ").toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchCode && !matchDept && !matchRole) {
          return false;
        }
      }
      return true;
    });
  }, [users, userStatsMap, employeeFilter, searchQuery]);

  const displayedRows = useMemo(() => {
    const copy = [...rows];
    copy.sort((a, b) =>
      sortOrder === "desc" ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date)
    );
    return copy;
  }, [rows, sortOrder]);

  if (!isAdmin) {
    return (
      <div className="panel p-8 text-center max-w-lg mx-auto my-12 space-y-4">
        <div className="size-14 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto border border-destructive/20 shadow-xs">
          <ShieldAlert className="size-7" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-foreground">
            Administrator Access Required
          </h2>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Employee attendance records and attendance sheet exports are restricted to Workspace Administrators.
          </p>
        </div>
        <div className="rounded-xl border border-border bg-muted/30 p-3 text-xs text-left space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Current User:</span>
            <span className="font-semibold text-foreground">{currentUser.name}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Assigned Role:</span>
            <span className="font-mono text-primary font-bold uppercase text-[11px]">
              {currentUser.role.replace("_", " ")}
            </span>
          </div>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => {
            setActiveSection("overview");
            setViewMode("board");
          }}
          className="w-full text-xs font-semibold cursor-pointer"
        >
          Return to Dashboard
        </Button>
      </div>
    );
  }

  const effectiveStart = startDate <= endDate ? startDate : endDate;
  const effectiveEnd = startDate <= endDate ? endDate : startDate;
  const rangeDays = diffDaysInclusive(effectiveStart, effectiveEnd);

  const shiftRange = (direction: -1 | 1) => {
    const delta = direction * rangeDays;
    setStartDate(shiftISODate(effectiveStart, delta));
    setEndDate(shiftISODate(effectiveEnd, delta));
  };

  const applyPreset = (preset: "today" | "last7" | "thisWeek" | "thisMonth" | "last30") => {
    if (preset === "today") {
      setStartDate(todayIST);
      setEndDate(todayIST);
    } else if (preset === "last7") {
      setStartDate(shiftISODate(todayIST, -6));
      setEndDate(todayIST);
    } else if (preset === "thisWeek") {
      setStartDate(getStartOfWeekISO(todayIST));
      setEndDate(todayIST);
    } else if (preset === "thisMonth") {
      setStartDate(getStartOfMonthISO(todayIST));
      setEndDate(todayIST);
    } else if (preset === "last30") {
      setStartDate(shiftISODate(todayIST, -29));
      setEndDate(todayIST);
    }
  };

  const handleExportCSV = async () => {
    setIsExporting(true);
    try {
      const res = await fetch(
        `/api/attendance?startDate=${encodeURIComponent(effectiveStart)}&endDate=${encodeURIComponent(effectiveEnd)}&format=csv`,
        { cache: "no-store" }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to export attendance ledger.");
      }
      const csvText = await res.text();
      const blob = new Blob([csvText], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `satmi_attendance_ledger_${effectiveStart}_to_${effectiveEnd}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message || "Failed to export attendance ledger.");
    } finally {
      setIsExporting(false);
    }
  };

  const totalEmployees = summary?.totalEmployees ?? users.length;
  const presentEntries = summary?.presentEntries ?? 0;
  const totalPossibleEntries = summary?.totalPossibleEntries ?? totalEmployees * rangeDays;
  const checkedOutEntries = summary?.checkedOutEntries ?? 0;
  const activeEntries = summary?.activeEntries ?? 0;
  const attendanceRate =
    totalPossibleEntries > 0 ? Math.round((presentEntries / totalPossibleEntries) * 100) : 0;

  const presentInRangeCount = users.filter(
    (u) => (userStatsMap.get(u.userId)?.presentDays ?? 0) > 0
  ).length;
  const activeNowCount = users.filter(
    (u) => (userStatsMap.get(u.userId)?.activeDays ?? 0) > 0
  ).length;
  const absentInRangeCount = users.filter(
    (u) => (userStatsMap.get(u.userId)?.presentDays ?? 0) === 0
  ).length;

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 border-b border-border/80 pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <CalendarCheck className="size-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                Attendance Ledger
              </h1>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-mono font-semibold text-muted-foreground">
                {effectiveStart} → {effectiveEnd} ({rangeDays} {rangeDays === 1 ? "day" : "days"})
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Per-user check-in &amp; check-out time ledger (IST) across the selected date range
            </p>
          </div>
        </div>

        {/* Date Range Picker & Export Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center rounded-lg border border-border bg-card p-0.5 gap-1">
            <button
              type="button"
              onClick={() => shiftRange(-1)}
              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
              title={`Previous ${rangeDays} day${rangeDays === 1 ? "" : "s"}`}
            >
              <ChevronLeft className="size-3.5" />
            </button>

            <div className="flex items-center gap-1.5 px-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                From
              </span>
              <input
                type="date"
                aria-label="Start Date"
                value={effectiveStart}
                max={effectiveEnd}
                onChange={(e) => {
                  if (!e.target.value) return;
                  const nextStart = e.target.value;
                  setStartDate(nextStart);
                  if (nextStart > effectiveEnd) {
                    setEndDate(nextStart);
                  }
                }}
                className="bg-transparent px-1 py-1 text-xs font-medium text-foreground focus:outline-none cursor-pointer"
              />
              <span className="text-muted-foreground text-xs">→</span>
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                To
              </span>
              <input
                type="date"
                aria-label="End Date"
                value={effectiveEnd}
                min={effectiveStart}
                onChange={(e) => {
                  if (!e.target.value) return;
                  const nextEnd = e.target.value;
                  setEndDate(nextEnd);
                  if (nextEnd < effectiveStart) {
                    setStartDate(nextEnd);
                  }
                }}
                className="bg-transparent px-1 py-1 text-xs font-medium text-foreground focus:outline-none cursor-pointer"
              />
            </div>

            <button
              type="button"
              onClick={() => shiftRange(1)}
              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
              title={`Next ${rangeDays} day${rangeDays === 1 ? "" : "s"}`}
            >
              <ChevronRight className="size-3.5" />
            </button>
          </div>

          <button
            type="button"
            onClick={() => fetchAttendanceLedger()}
            disabled={isLoading}
            className="inline-flex items-center justify-center size-8 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
            title="Refresh attendance ledger"
          >
            <RefreshCw className={cn("size-3.5", isLoading && "animate-spin")} />
          </button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleExportCSV}
            disabled={rows.length === 0 || users.length === 0 || isExporting}
            className="gap-1.5 h-8 text-xs font-semibold shadow-xs cursor-pointer"
          >
            <Download className="size-3.5" />
            <span>{isExporting ? "Exporting..." : "Export Ledger CSV"}</span>
          </Button>
        </div>
      </div>

      {/* Quick Date Range Presets */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground mr-1">
            <CalendarRange className="size-3.5" />
            Range:
          </span>
          {[
            { id: "today" as const, label: "Today", active: effectiveStart === todayIST && effectiveEnd === todayIST },
            {
              id: "last7" as const,
              label: "Last 7 Days",
              active: effectiveStart === shiftISODate(todayIST, -6) && effectiveEnd === todayIST,
            },
            {
              id: "thisWeek" as const,
              label: "This Week",
              active: effectiveStart === getStartOfWeekISO(todayIST) && effectiveEnd === todayIST,
            },
            {
              id: "thisMonth" as const,
              label: "This Month",
              active: effectiveStart === getStartOfMonthISO(todayIST) && effectiveEnd === todayIST,
            },
            {
              id: "last30" as const,
              label: "Last 30 Days",
              active: effectiveStart === shiftISODate(todayIST, -29) && effectiveEnd === todayIST,
            },
          ].map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset.id)}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11px] font-medium transition cursor-pointer",
                preset.active
                  ? "bg-primary/15 text-primary border border-primary/30 font-semibold"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Box Legend */}
        <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-emerald-500" />
            Top: Check-In
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-sky-500" />
            Bottom: Check-Out
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-amber-500" />
            Active (No Out)
          </span>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="panel p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Team Columns</span>
            <Users className="size-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {totalEmployees}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Active workspace members
          </div>
        </div>

        <div className="panel p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Date Range Rows</span>
            <CalendarRange className="size-4 text-sky-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {rangeDays} <span className="text-sm font-medium text-muted-foreground">days</span>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {effectiveStart} to {effectiveEnd}
          </div>
        </div>

        <div className="panel p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Present Entries</span>
            <UserCheck className="size-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {presentEntries}
            <span className="text-sm font-medium text-muted-foreground ml-1">
              / {totalPossibleEntries}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {attendanceRate}% attendance across range
          </div>
        </div>

        <div className="panel p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Checked Out / Active</span>
            <Clock className="size-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {checkedOutEntries}{" "}
            <span className="text-sm font-medium text-muted-foreground">
              / {activeEntries} active
            </span>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            8:00 PM IST auto-reminder enabled
          </div>
        </div>
      </div>

      {/* Filters & Employee Column Search Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
          {[
            { id: "all", label: `All Users (${users.length})` },
            { id: "present_in_range", label: `Checked In (${presentInRangeCount})` },
            { id: "active_now", label: `Missing Checkout (${activeNowCount})` },
            { id: "absent_in_range", label: `No Logs in Range (${absentInRangeCount})` },
          ].map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => setEmployeeFilter(pill.id as LedgerEmployeeFilter)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer shrink-0",
                employeeFilter === pill.id
                  ? "bg-primary text-primary-foreground font-semibold shadow-2xs"
                  : "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              {pill.label}
            </button>
          ))}
        </div>

        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter user columns..."
            className="w-full sm:w-64 rounded-lg border border-border bg-card pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Attendance Ledger Matrix Table */}
      <div className="panel overflow-hidden">
        <div className="overflow-auto max-h-[68vh]">
          <table className="w-full text-left border-separate border-spacing-0">
            <thead className="sticky top-0 z-20">
              <tr className="bg-muted/95 backdrop-blur-xs">
                {/* Sticky Top-Left Corner: Date Column Header */}
                <th className="sticky left-0 z-30 min-w-[155px] bg-muted border-b border-r border-border py-3 px-3.5 align-middle">
                  <button
                    type="button"
                    onClick={() => setSortOrder((s) => (s === "desc" ? "asc" : "desc"))}
                    className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:text-foreground transition cursor-pointer"
                    title="Toggle date order"
                  >
                    <span>Date</span>
                    <ArrowUpDown className="size-3" />
                    <span className="text-[10px] font-mono lowercase text-primary">
                      ({sortOrder === "desc" ? "newest" : "oldest"})
                    </span>
                  </button>
                </th>

                {/* One Column Header Per User */}
                {filteredUsers.map((user) => {
                  const code = user.employeeCode || getEmployeeCode(user.userName);
                  const color = getUserColor(code, user.color);
                  const stats = userStatsMap.get(user.userId);
                  const presentDays = stats?.presentDays ?? 0;

                  return (
                    <th
                      key={user.userId}
                      className="min-w-[154px] border-b border-r last:border-r-0 border-border py-2.5 px-2.5 align-top bg-muted/95"
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="size-7 rounded-full font-bold text-[11px] flex items-center justify-center shrink-0 ring-1"
                          style={{
                            backgroundColor: `${color}20`,
                            color,
                            borderColor: `${color}40`,
                          }}
                        >
                          {user.avatar || code.slice(0, 2)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1">
                            <span
                              className="text-xs font-semibold text-foreground truncate"
                              title={user.userName}
                            >
                              {user.userName}
                            </span>
                            <span
                              className="font-mono text-[9px] font-bold px-1 rounded shrink-0"
                              style={{
                                backgroundColor: `${color}15`,
                                color,
                              }}
                            >
                              {code}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-1 mt-0.5">
                            <span className="text-[10px] text-muted-foreground capitalize truncate font-normal">
                              {user.role.replace(/_/g, " ")}
                            </span>
                            <span className="font-mono text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 shrink-0">
                              {presentDays}/{rangeDays}d
                            </span>
                          </div>
                        </div>
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody className="text-xs">
              {isLoading && rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={Math.max(2, filteredUsers.length + 1)}
                    className="py-14 text-center text-muted-foreground"
                  >
                    Loading attendance ledger...
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td
                    colSpan={2}
                    className="py-14 text-center text-muted-foreground"
                  >
                    No employees match the current filter.
                  </td>
                </tr>
              ) : displayedRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={filteredUsers.length + 1}
                    className="py-14 text-center text-muted-foreground"
                  >
                    No dates found in the selected range.
                  </td>
                </tr>
              ) : (
                displayedRows.map((row) => {
                  const dateInfo = formatLedgerDateLabel(row.date);
                  const isToday = row.date === todayIST;
                  const rowPresentCount = filteredUsers.reduce((acc, u) => {
                    return acc + (row.cells[u.userId]?.status === "present" ? 1 : 0);
                  }, 0);

                  return (
                    <tr
                      key={row.date}
                      className={cn(
                        "group transition-colors",
                        isToday
                          ? "bg-primary/[0.03] hover:bg-primary/[0.06]"
                          : dateInfo.isWeekend
                            ? "bg-muted/20 hover:bg-muted/35"
                            : "hover:bg-muted/25"
                      )}
                    >
                      {/* Sticky Left Date Cell */}
                      <td className="sticky left-0 z-10 border-b border-r border-border py-2.5 px-3.5 align-middle whitespace-nowrap bg-card">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono text-xs font-semibold text-foreground">
                                {dateInfo.shortDate}
                              </span>
                              {isToday && (
                                <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[9px] font-bold uppercase text-primary">
                                  Today
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-muted-foreground">
                              <span className={cn(dateInfo.isWeekend && "text-amber-600 dark:text-amber-400 font-medium")}>
                                {dateInfo.weekday}
                              </span>
                              <span>•</span>
                              <span>
                                {rowPresentCount}/{filteredUsers.length} present
                              </span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* User Attendance Boxes (Top = Check-In, Bottom = Check-Out) */}
                      {filteredUsers.map((user) => {
                        const cell = row.cells[user.userId];
                        const isPresent = cell?.status === "present" && Boolean(cell.checkInTime);
                        const hasCheckOut = Boolean(cell?.checkOutTime);
                        const isActive = isPresent && !hasCheckOut;

                        const tooltipLines = [
                          `${user.userName} (${user.employeeCode}) — ${row.date}`,
                          `Status: ${isPresent ? "Present" : "Absent"}`,
                          `Check-In: ${cell?.checkInTime ? `${formatISTTimeFull(cell.checkInTime)} IST` : "—"}`,
                          `Check-Out: ${
                            cell?.checkOutTime
                              ? `${formatISTTimeFull(cell.checkOutTime)} IST`
                              : isActive
                                ? "Active (Not checked out yet)"
                                : "—"
                          }`,
                          isPresent
                            ? `Duration: ${formatDuration(cell.checkInTime, cell.checkOutTime)}`
                            : null,
                          cell?.checkoutReminderSent
                            ? `8 PM Reminder: Sent${cell.checkoutReminderSentAt ? ` at ${formatISTTimeFull(cell.checkoutReminderSentAt)} IST` : ""}`
                            : null,
                        ]
                          .filter(Boolean)
                          .join("\n");

                        return (
                          <td
                            key={`${row.date}-${user.userId}`}
                            className="border-b border-r last:border-r-0 border-border p-2 align-middle"
                          >
                            {/* Check-In (Top) & Check-Out (Bottom) Box */}
                            <div
                              title={tooltipLines}
                              className={cn(
                                "rounded-lg border overflow-hidden transition-colors shadow-2xs",
                                isPresent && hasCheckOut
                                  ? "border-emerald-500/30 bg-card"
                                  : isActive
                                    ? "border-amber-500/40 bg-card"
                                    : "border-border/70 bg-muted/20"
                              )}
                            >
                              {/* TOP OF BOX: Check-In Time */}
                              <div
                                className={cn(
                                  "flex items-center justify-between gap-1.5 px-2 py-1 border-b",
                                  isPresent
                                    ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-700 dark:text-emerald-300"
                                    : "bg-transparent border-border/50 text-muted-foreground/70"
                                )}
                              >
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider shrink-0">
                                  <LogIn className="size-2.5" />
                                  <span>In</span>
                                </span>
                                <span className="font-mono text-[11px] font-semibold tabular-nums whitespace-nowrap">
                                  {cell?.checkInTime
                                    ? formatISTTimeCompact(cell.checkInTime)
                                    : "—"}
                                </span>
                              </div>

                              {/* BOTTOM OF BOX: Check-Out Time */}
                              <div
                                className={cn(
                                  "flex items-center justify-between gap-1.5 px-2 py-1",
                                  hasCheckOut
                                    ? "bg-sky-500/[0.08] text-foreground"
                                    : isActive
                                      ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
                                      : "bg-transparent text-muted-foreground/70"
                                )}
                              >
                                <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider shrink-0">
                                  <LogOut className="size-2.5" />
                                  <span>Out</span>
                                </span>
                                {hasCheckOut ? (
                                  <span className="font-mono text-[11px] font-semibold tabular-nums whitespace-nowrap">
                                    {formatISTTimeCompact(cell.checkOutTime)}
                                  </span>
                                ) : isActive ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold whitespace-nowrap">
                                    <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                                    <span>Active</span>
                                  </span>
                                ) : (
                                  <span className="font-mono text-[11px] font-semibold tabular-nums">
                                    —
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
