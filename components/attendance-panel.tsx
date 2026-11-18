"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  CalendarCheck,
  Download,
  Search,
  ShieldAlert,
  Users,
  UserCheck,
  UserX,
  Clock,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Mail,
  CheckCircle2,
} from "lucide-react";
import { useTasks } from "@/lib/store";
import { dateInTargetTimeZone } from "@/lib/supabase";
import { EmployeeAttendanceRow } from "@/lib/types";
import { cn, getUserColor, getEmployeeCode } from "@/lib/utils";
import { Button } from "./ui/button";

type AttendanceStatusFilter = "all" | "present" | "absent" | "not_checked_out";

function shiftISODate(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
  dt.setUTCDate(dt.getUTCDate() + deltaDays);
  return dt.toISOString().slice(0, 10);
}

function formatISTTime(iso: string | null): string {
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

function escapeCSV(val: string): string {
  return `"${String(val ?? "").replace(/"/g, '""')}"`;
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
  const [selectedDate, setSelectedDate] = useState<string>(todayIST);
  const [sheet, setSheet] = useState<EmployeeAttendanceRow[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<AttendanceStatusFilter>("all");

  const fetchAttendanceSheet = useCallback(async () => {
    if (!isAdmin) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/attendance?date=${encodeURIComponent(selectedDate)}`,
        { cache: "no-store" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || "Failed to load attendance records.");
      }
      setSheet(Array.isArray(data.sheet) ? data.sheet : []);
    } catch (err: any) {
      setError(err?.message || "Failed to load attendance records.");
    } finally {
      setIsLoading(false);
    }
  }, [isAdmin, selectedDate]);

  useEffect(() => {
    void fetchAttendanceSheet();
  }, [fetchAttendanceSheet, myTodayAttendance?.checkInTime, myTodayAttendance?.checkOutTime]);

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

  const totalEmployees = sheet.length;
  const presentCount = sheet.filter((r) => r.status === "present").length;
  const absentCount = sheet.filter((r) => r.status === "absent").length;
  const checkedOutCount = sheet.filter((r) => Boolean(r.checkOutTime)).length;
  const workingCount = sheet.filter(
    (r) => r.status === "present" && !r.checkOutTime
  ).length;

  const filteredRows = sheet.filter((row) => {
    if (statusFilter === "present" && row.status !== "present") return false;
    if (statusFilter === "absent" && row.status !== "absent") return false;
    if (
      statusFilter === "not_checked_out" &&
      !(row.status === "present" && !row.checkOutTime)
    ) {
      return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      const matchName = row.userName.toLowerCase().includes(q);
      const matchEmail = row.userEmail.toLowerCase().includes(q);
      const matchCode = row.employeeCode.toLowerCase().includes(q);
      const matchDept = row.department.toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchCode && !matchDept) return false;
    }
    return true;
  });

  const handleExportCSV = () => {
    const headers = [
      "Date",
      "Employee Code",
      "Employee Name",
      "Email",
      "Role",
      "Department",
      "Attendance Status",
      "Check-In Time (IST)",
      "Check-Out Time (IST)",
      "Duration",
    ];

    const rows = sheet.map((row) => [
      escapeCSV(row.date || selectedDate),
      escapeCSV(row.employeeCode),
      escapeCSV(row.userName),
      escapeCSV(row.userEmail),
      escapeCSV(row.role.replace(/_/g, " ")),
      escapeCSV(row.department),
      escapeCSV(row.status === "present" ? "Present" : "Absent"),
      escapeCSV(row.checkInTime ? formatISTTime(row.checkInTime) : "-"),
      escapeCSV(row.checkOutTime ? formatISTTime(row.checkOutTime) : "-"),
      escapeCSV(
        row.checkInTime && row.checkOutTime
          ? formatDuration(row.checkInTime, row.checkOutTime)
          : "-"
      ),
    ].join(","));

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `satmi_attendance_${selectedDate}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-border/80 pb-3.5">
        <div className="flex items-center gap-2.5">
          <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
            <CalendarCheck className="size-4.5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground">
                Attendance Records
              </h1>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-mono font-semibold text-muted-foreground">
                {selectedDate}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Daily check-in &amp; check-out log (IST) with automated 8:00 PM checkout reminder emails
            </p>
          </div>
        </div>

        {/* Date Picker & Export Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center rounded-lg border border-border bg-card p-0.5">
            <button
              type="button"
              onClick={() => setSelectedDate((d) => shiftISODate(d, -1))}
              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
              title="Previous Day"
            >
              <ChevronLeft className="size-3.5" />
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                if (e.target.value) setSelectedDate(e.target.value);
              }}
              className="bg-transparent px-2 py-1 text-xs font-medium text-foreground focus:outline-none cursor-pointer"
            />
            <button
              type="button"
              onClick={() => setSelectedDate((d) => shiftISODate(d, 1))}
              className="rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
              title="Next Day"
            >
              <ChevronRight className="size-3.5" />
            </button>
          </div>

          {selectedDate !== todayIST && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setSelectedDate(todayIST)}
              className="h-8 text-xs cursor-pointer"
            >
              Today
            </Button>
          )}

          <button
            type="button"
            onClick={() => fetchAttendanceSheet()}
            disabled={isLoading}
            className="inline-flex items-center justify-center size-8 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted transition cursor-pointer"
            title="Refresh attendance"
          >
            <RefreshCw className={cn("size-3.5", isLoading && "animate-spin")} />
          </button>

          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={handleExportCSV}
            disabled={sheet.length === 0}
            className="gap-1.5 h-8 text-xs font-semibold shadow-xs cursor-pointer"
          >
            <Download className="size-3.5" />
            <span>Export Attendance Sheet</span>
          </Button>
        </div>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="panel p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Total Employees</span>
            <Users className="size-4 text-primary" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {totalEmployees}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Active workspace roster
          </div>
        </div>

        <div className="panel p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Present ({selectedDate === todayIST ? "Today" : selectedDate})</span>
            <UserCheck className="size-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-600 dark:text-emerald-400">
            {presentCount}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {totalEmployees > 0
              ? `${Math.round((presentCount / totalEmployees) * 100)}% attendance rate`
              : "0% attendance rate"}
          </div>
        </div>

        <div className="panel p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Absent ({selectedDate === todayIST ? "Today" : selectedDate})</span>
            <UserX className="size-4 text-rose-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-600 dark:text-rose-400">
            {absentCount}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            No check-in recorded
          </div>
        </div>

        <div className="panel p-4">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Checked Out / Working</span>
            <Clock className="size-4 text-amber-500" />
          </div>
          <div className="mt-2 text-2xl font-bold text-foreground">
            {checkedOutCount}{" "}
            <span className="text-sm font-medium text-muted-foreground">
              / {workingCount} working
            </span>
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            8:00 PM IST auto-reminder enabled
          </div>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 text-xs">
          {[
            { id: "all", label: `All (${totalEmployees})` },
            { id: "present", label: `Present (${presentCount})` },
            { id: "absent", label: `Absent (${absentCount})` },
            { id: "not_checked_out", label: `Working / Not Checked Out (${workingCount})` },
          ].map((pill) => (
            <button
              key={pill.id}
              type="button"
              onClick={() => setStatusFilter(pill.id as AttendanceStatusFilter)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium transition cursor-pointer shrink-0",
                statusFilter === pill.id
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
            placeholder="Search employee name, code, email..."
            className="w-full sm:w-64 rounded-lg border border-border bg-card pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-xs text-destructive">
          {error}
        </div>
      )}

      {/* Attendance Table */}
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <th className="py-3 px-4">Employee</th>
                <th className="py-3 px-3">Role &amp; Dept</th>
                <th className="py-3 px-3">Date</th>
                <th className="py-3 px-3">Attendance</th>
                <th className="py-3 px-3">Check-In Time</th>
                <th className="py-3 px-3">Check-Out Time</th>
                <th className="py-3 px-3">Duration</th>
                <th className="py-3 px-4 text-right">8 PM Reminder</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/70 text-xs">
              {isLoading && sheet.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    Loading attendance sheet...
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-muted-foreground">
                    No matching employee attendance records found for {selectedDate}.
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => {
                  const code = row.employeeCode || getEmployeeCode(row.userName);
                  const color = getUserColor(code, row.color);
                  const isPresent = row.status === "present";

                  return (
                    <tr
                      key={row.userId}
                      className="hover:bg-muted/25 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className="size-8 rounded-full font-bold text-xs flex items-center justify-center shrink-0 ring-1"
                            style={{
                              backgroundColor: `${color}20`,
                              color,
                              borderColor: `${color}40`,
                            }}
                          >
                            {row.avatar || code.slice(0, 2)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 font-semibold text-foreground">
                              <span className="truncate">{row.userName}</span>
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
                            <div className="text-[11px] text-muted-foreground truncate">
                              {row.userEmail}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <div className="font-medium text-foreground capitalize">
                          {row.role.replace(/_/g, " ")}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {row.department}
                        </div>
                      </td>

                      <td className="py-3 px-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                        {row.date}
                      </td>

                      <td className="py-3 px-3">
                        {isPresent ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="size-3" />
                            <span>Present</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-rose-500/30 bg-rose-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                            <UserX className="size-3" />
                            <span>Absent</span>
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 font-mono text-[11px] whitespace-nowrap">
                        {row.checkInTime ? (
                          <span className="text-foreground font-medium">
                            {formatISTTime(row.checkInTime)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      <td className="py-3 px-3 font-mono text-[11px] whitespace-nowrap">
                        {row.checkOutTime ? (
                          <span className="text-foreground font-medium">
                            {formatISTTime(row.checkOutTime)}
                          </span>
                        ) : isPresent ? (
                          <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-sans font-medium">
                            <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                            <span>Active</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>

                      <td className="py-3 px-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                        {formatDuration(row.checkInTime, row.checkOutTime)}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {row.checkoutReminderSent ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 border border-amber-500/25 px-2 py-0.5 text-[10px] font-semibold text-amber-600 dark:text-amber-400"
                            title={
                              row.checkoutReminderSentAt
                                ? `Email sent at ${formatISTTime(row.checkoutReminderSentAt)} IST`
                                : "8:00 PM reminder email sent"
                            }
                          >
                            <Mail className="size-3" />
                            <span>Sent</span>
                          </span>
                        ) : isPresent && !row.checkOutTime ? (
                          <span className="text-[11px] text-muted-foreground">
                            Scheduled 8 PM
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">—</span>
                        )}
                      </td>
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
