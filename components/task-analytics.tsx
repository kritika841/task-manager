"use client";

import React, { useState, useMemo } from "react";
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  UserCheck,
  TrendingUp,
  BarChart2,
  Users,
  Layers,
  ArrowRight,
  ShieldAlert,
  ShieldCheck,
  History,
  Check,
  RotateCcw,
  Plus,
  Calendar,
  Search,
  Filter,
  Download,
  Lock,
  FileText,
  ExternalLink,
  ChevronDown,
} from "lucide-react";
import { useTasks } from "@/lib/store";
import { ProgressBar } from "./ui/progress-bar";
import { calculateProgress, formatDate, formatDateTime, isOverdue, cn, getUserColor, getEmployeeCode } from "@/lib/utils";
import { Button } from "./ui/button";

type AnalyticsSubTab = "overview" | "allocations" | "work_done" | "permissions";

export function TaskAnalytics() {
  const {
    tasks,
    filteredTasks,
    users,
    currentUser,
    isAdmin,
    isManager,
    setFilter,
    setViewMode,
    getMemberCapacity,
    auditLogs,
    setSelectedTaskId,
    exportTasksToCSV,
  } = useTasks();

  const [activeTab, setActiveTab] = useState<AnalyticsSubTab>("overview");
  const [allocationSearch, setAllocationSearch] = useState("");
  const [allocationMemberFilter, setAllocationMemberFilter] = useState("all");
  const [auditActionFilter, setAuditActionFilter] = useState("all");

  // Admin Security Barrier: If not admin, render restricted notice
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
            Executive performance analytics, allocation logs, and team audit trails are restricted to Workspace Administrators.
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
          <div className="flex justify-between">
            <span className="text-muted-foreground">Permission Level:</span>
            <span className="text-muted-foreground">Standard Member Access</span>
          </div>
        </div>
        <Button
          variant="primary"
          size="sm"
          onClick={() => setViewMode("board")}
          className="w-full text-xs font-semibold"
        >
          Return to Tasks Board
        </Button>
      </div>
    );
  }

  // --- Real Analytical Metrics (Strictly reflects tasks showing on dashboard) ---
  const tasksToAnalyze = filteredTasks;
  const totalTasks = tasksToAnalyze.length;
  const completedTasks = tasksToAnalyze.filter((t) => t.status === "completed").length;
  const inReviewTasks = tasksToAnalyze.filter((t) => t.status === "in_review").length;
  const inProgressTasks = tasksToAnalyze.filter((t) => t.status === "in_progress").length;
  const urgentTasks = tasksToAnalyze.filter(
    (t) => (t.priority === "urgent" || t.priority === "high") && t.status !== "completed"
  ).length;

  const totalTargetUnits = tasksToAnalyze.reduce((acc, t) => acc + (t.targetQuantity || 1), 0);
  const completedTargetUnits = tasksToAnalyze.reduce((acc, t) => acc + (t.completedQuantity || 0), 0);
  const overallVelocity =
    totalTargetUnits > 0 ? Math.round((completedTargetUnits / totalTargetUnits) * 100) : 0;

  // On-time delivery rate for completed tasks
  const onTimeCompleted = tasksToAnalyze.filter((t) => {
    if (t.status !== "completed") return false;
    const completedDate = t.updatedAt?.slice(0, 10) || t.dueDate;
    return completedDate <= t.dueDate;
  }).length;
  const onTimePct = completedTasks > 0 ? Math.round((onTimeCompleted / completedTasks) * 100) : 100;

  // Workload by team member with capacity
  const memberWorkload = users.map((u) => {
    const userTasks = tasksToAnalyze.filter((t) => t.assigneeId === u.id);
    const userTargetUnits = userTasks.reduce((acc, t) => acc + (t.targetQuantity || 1), 0);
    const userCompletedUnits = userTasks.reduce((acc, t) => acc + (t.completedQuantity || 0), 0);
    const capacity = getMemberCapacity(u.id);
    const pct =
      userTargetUnits > 0 ? Math.round((userCompletedUnits / userTargetUnits) * 100) : 0;

    return {
      user: u,
      taskCount: userTasks.length,
      targetUnits: userTargetUnits,
      completedUnits: userCompletedUnits,
      capacity,
      pct,
      inProgressCount: userTasks.filter(
        (t) => t.status === "in_progress" || t.status === "in_review"
      ).length,
    };
  });

  const overAllocatedMembers = memberWorkload.filter((m) => m.capacity?.isOverAllocated);
  const underCapacityMembers = memberWorkload.filter(
    (m) => (m.capacity?.percent ?? 0) < 80 && (m.user.role === "editor" || m.user.role === "content_creator")
  );

  // Chronological Task Allocations ("What was allocated when")
  const allocationList = useMemo(() => {
    let list = [...tasksToAnalyze];

    // Filter by member
    if (allocationMemberFilter !== "all") {
      list = list.filter((t) => t.assigneeId === allocationMemberFilter);
    }

    // Filter by search
    if (allocationSearch.trim()) {
      const q = allocationSearch.toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.taskNumber.toLowerCase().includes(q) ||
          t.description?.toLowerCase().includes(q)
      );
    }

    // Sort by createdAt descending (most recently allocated first)
    return list.sort((a, b) => {
      const dateA = new Date(a.createdAt || a.dueDate).getTime();
      const dateB = new Date(b.createdAt || b.dueDate).getTime();
      return dateB - dateA;
    });
  }, [tasks, allocationMemberFilter, allocationSearch]);

  // Work Completed & Action Logs ("What work has been done")
  const filteredAuditLogs = useMemo(() => {
    let logs = [...auditLogs];

    if (auditActionFilter !== "all") {
      logs = logs.filter((l) => {
        if (auditActionFilter === "completed") {
          return l.action.includes("complete") || l.action.includes("approved");
        }
        if (auditActionFilter === "review") {
          return l.action.includes("review") || l.action.includes("revision");
        }
        if (auditActionFilter === "progress") {
          return l.action.includes("progress") || l.action.includes("unit");
        }
        if (auditActionFilter === "create") {
          return l.action.includes("create") || l.action.includes("assign");
        }
        return true;
      });
    }

    return logs;
  }, [auditLogs, auditActionFilter]);

  return (
    <div className="space-y-6">
      {/* Header with Admin Badge & View Tabs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Executive Analytics & Work Logs
            </h2>
            <span className="flex items-center gap-1 rounded-full bg-primary/15 border border-primary/25 px-2 py-0.5 text-[10px] font-bold text-primary uppercase">
              <ShieldCheck className="size-3" />
              <span>Admin Visibility Only</span>
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Verified team performance records, allocation audit timestamps, and completed deliverable streams.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={exportTasksToCSV}
            className="text-xs h-8 gap-1.5 shadow-2xs font-semibold cursor-pointer"
          >
            <Download className="size-3.5" />
            <span>Export CSV</span>
          </Button>
        </div>
      </div>

      {/* Internal Analytics Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-border/60 pb-2 text-xs overflow-x-auto scrollbar-none">
        <button
          type="button"
          onClick={() => setActiveTab("overview")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer shrink-0",
            activeTab === "overview"
              ? "bg-primary/15 text-primary font-semibold border border-primary/25"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
          )}
        >
          <BarChart2 className="size-3.5" />
          <span>KPIs & Capacity</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("allocations")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer shrink-0",
            activeTab === "allocations"
              ? "bg-primary/15 text-primary font-semibold border border-primary/25"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
          )}
        >
          <Clock className="size-3.5" />
          <span>Allocation History ("What Allocated When")</span>
          <span className="text-[10px] font-mono px-1 rounded bg-muted/80">
            {tasksToAnalyze.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("work_done")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer shrink-0",
            activeTab === "work_done"
              ? "bg-primary/15 text-primary font-semibold border border-primary/25"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
          )}
        >
          <History className="size-3.5" />
          <span>Work Done & Audit Trail</span>
          <span className="text-[10px] font-mono px-1 rounded bg-muted/80">
            {auditLogs.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("permissions")}
          className={cn(
            "flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition cursor-pointer shrink-0",
            activeTab === "permissions"
              ? "bg-primary/15 text-primary font-semibold border border-primary/25"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
          )}
        >
          <Lock className="size-3.5" />
          <span>Role Permissions Matrix</span>
        </button>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: OVERVIEW & TEAM WORKLOAD CAPACITY */}
      {/* ======================================================== */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Key Metric Cards Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="panel p-4 sm:p-5">
              <div className="flex items-center justify-between text-muted-foreground text-xs">
                <span>Daily Target Units</span>
                <TrendingUp className="size-4 text-primary" />
              </div>
              <div className="mt-2 text-2xl font-bold text-foreground">
                {completedTargetUnits} / {totalTargetUnits}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                <span className="font-semibold text-primary">{overallVelocity}%</span> team delivery velocity
              </div>
            </div>

            <div className="panel p-4 sm:p-5">
              <div className="flex items-center justify-between text-muted-foreground text-xs">
                <span>Completed Tasks</span>
                <CheckCircle2 className="size-4 text-success" />
              </div>
              <div className="mt-2 text-2xl font-bold text-foreground">
                {completedTasks} / {totalTasks}
              </div>
              <div className="mt-2">
                <ProgressBar completed={completedTasks} total={totalTasks} size="sm" />
              </div>
            </div>

            <div className="panel p-4 sm:p-5">
              <div className="flex items-center justify-between text-muted-foreground text-xs">
                <span>In Review Work</span>
                <Clock className="size-4 text-warning" />
              </div>
              <div className="mt-2 text-2xl font-bold text-warning">
                {inReviewTasks}
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Awaiting approval / revision check
              </div>
            </div>

            <div className="panel p-4 sm:p-5">
              <div className="flex items-center justify-between text-muted-foreground text-xs">
                <span>On-Time Delivery Rate</span>
                <Check className="size-4 text-emerald-500" />
              </div>
              <div className="mt-2 text-2xl font-bold text-emerald-500">
                {onTimePct}%
              </div>
              <div className="mt-2 text-xs text-muted-foreground">
                Delivered on or before target deadline
              </div>
            </div>
          </div>

          {/* Capacity Planning & Workload Leveler */}
          {overAllocatedMembers.length > 0 && (
            <div className="rounded-2xl border border-warning/40 bg-warning/10 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-warning flex items-center gap-2">
                  <ShieldAlert className="size-4" />
                  <span>Capacity Alerts & Workload Leveling</span>
                </h3>
                <span className="text-[11px] font-mono text-warning font-semibold">
                  {overAllocatedMembers.length} member(s) over daily limit
                </span>
              </div>
              <p className="text-xs text-foreground leading-relaxed">
                The following team members have been assigned targets exceeding their standard daily bandwidth.
                Consider rebalancing targets to prevent bottlenecks and ensure 11:59 PM cutoff compliance.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                {overAllocatedMembers.map(({ user, capacity }) => {
                  const capCurrent = capacity?.current || 0;
                  const capMax = capacity?.max || 6;
                  const diff = capCurrent - capMax;
                  const suggested = underCapacityMembers[0];
                  const sugCurrent = suggested?.capacity?.current || 0;
                  const sugMax = suggested?.capacity?.max || 6;

                  return (
                    <div
                      key={user.id}
                      className="rounded-xl border border-warning/30 bg-card p-3.5 text-xs space-y-1.5 shadow-2xs"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-foreground">{user.name}</span>
                        <span className="font-mono text-[10px] text-destructive font-bold bg-destructive/10 px-2 py-0.5 rounded">
                          +{diff} units over capacity ({capCurrent}/{capMax})
                        </span>
                      </div>
                      {suggested ? (
                        <div className="text-[11px] text-muted-foreground">
                          💡 Leveling Suggestion: Reassign {diff} unit(s) to{" "}
                          <strong>{suggested.user.name}</strong> (currently at {sugCurrent}/{sugMax} units).
                        </div>
                      ) : (
                        <div className="text-[11px] text-muted-foreground">
                          Team bandwidth is heavily utilized today.
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Team Member Workload Breakdown */}
          <div className="panel p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Users className="size-4 text-primary" />
                  <span>Team Workload & Capacity Utilization</span>
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Live breakdown of assigned target units vs daily capacity limits.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-muted/40 text-xs text-muted-foreground select-none">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Member</th>
                    <th className="px-4 py-3 font-semibold">Role</th>
                    <th className="px-4 py-3 font-semibold text-center">Active Tasks</th>
                    <th className="px-4 py-3 font-semibold text-center">Assigned Units</th>
                    <th className="px-4 py-3 font-semibold text-center">Completed</th>
                    <th className="px-4 py-3 font-semibold min-w-[160px]">Capacity Bandwidth</th>
                    <th className="px-4 py-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {memberWorkload.map(({ user, taskCount, targetUnits, completedUnits, capacity }) => {
                    const empCode = user.employeeCode || getEmployeeCode(user.name);
                    const color = getUserColor(empCode, user.color);

                    return (
                      <tr key={user.id} className="hover:bg-muted/40 transition">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-2.5">
                            <div
                              className="size-7 rounded-full font-semibold text-xs flex items-center justify-center ring-1 shrink-0"
                              style={{
                                backgroundColor: `${color}20`,
                                color,
                                borderColor: `${color}40`,
                              }}
                            >
                              {user.avatar}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-foreground text-xs">
                                  {user.name}
                                </span>
                                <span
                                  className="text-[9px] font-mono font-bold px-1 rounded"
                                  style={{ backgroundColor: `${color}15`, color }}
                                >
                                  {empCode}
                                </span>
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {user.email}
                              </div>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3.5">
                          <span className="rounded bg-muted px-2 py-0.5 text-[10px] font-mono font-medium text-muted-foreground uppercase">
                            {user.role.replace("_", " ")}
                          </span>
                        </td>

                        <td className="px-4 py-3.5 text-center font-mono text-xs">
                          {taskCount}
                        </td>

                        <td className="px-4 py-3.5 text-center font-mono text-xs font-semibold">
                          {targetUnits}
                        </td>

                        <td className="px-4 py-3.5 text-center font-mono text-xs text-success font-semibold">
                          {completedUnits}
                        </td>

                        <td className="px-4 py-3.5">
                          <div className="w-full max-w-[160px]">
                            <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground mb-1">
                              <span>
                                {capacity?.current || 0} / {capacity?.max || 6} units
                              </span>
                              <span
                                className={cn(
                                  capacity?.isOverAllocated
                                    ? "text-warning font-bold"
                                    : "text-muted-foreground"
                                )}
                              >
                                {capacity?.percent || 0}%
                              </span>
                            </div>
                            <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                              <div
                                className={cn(
                                  "h-full transition-all duration-300 rounded-full",
                                  capacity?.isOverAllocated
                                    ? "bg-warning"
                                    : (capacity?.percent || 0) >= 80
                                    ? "bg-primary"
                                    : "bg-success"
                                )}
                                style={{ width: `${Math.min(100, capacity?.percent || 0)}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-3.5 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setFilter({ assigneeId: user.id });
                              setViewMode("board");
                            }}
                            className="text-xs h-7 text-primary hover:underline cursor-pointer"
                          >
                            View Tasks
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: WHAT WAS ALLOCATED WHEN (ALLOCATION LOGS) */}
      {/* ======================================================== */}
      {activeTab === "allocations" && (
        <div className="panel p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border">
            <div>
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Clock className="size-4 text-primary" />
                <span>Task Allocation & Assignment History</span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Exact log of what tasks were allocated, to whom, and at what timestamp.
              </p>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Filter tasks..."
                  value={allocationSearch}
                  onChange={(e) => setAllocationSearch(e.target.value)}
                  className="w-36 sm:w-48 pl-7 pr-2 py-1 text-xs rounded-lg bg-muted/40 border border-border text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              <select
                value={allocationMemberFilter}
                onChange={(e) => setAllocationMemberFilter(e.target.value)}
                className="text-xs h-7.5 px-2 rounded-lg bg-muted/40 border border-border text-foreground"
              >
                <option value="all">All Members</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/30 text-muted-foreground select-none">
                <tr>
                  <th className="px-3 py-2.5 font-semibold">Task ID & Title</th>
                  <th className="px-3 py-2.5 font-semibold">Allocated To</th>
                  <th className="px-3 py-2.5 font-semibold">Allocated When</th>
                  <th className="px-3 py-2.5 font-semibold">Allocated By</th>
                  <th className="px-3 py-2.5 font-semibold text-center">Target Units</th>
                  <th className="px-3 py-2.5 font-semibold">Due Date</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {allocationList.map((task) => {
                  const assignee = users.find((u) => u.id === task.assigneeId);
                  const creator = users.find((u) => u.id === task.creatorId);
                  const empCode = assignee?.employeeCode || (assignee ? getEmployeeCode(assignee.name) : "EMP");
                  const color = assignee ? getUserColor(empCode, assignee.color) : "#64748b";

                  return (
                    <tr
                      key={task.id}
                      onClick={() => setSelectedTaskId(task.id)}
                      className="hover:bg-muted/40 transition cursor-pointer"
                    >
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <span
                            className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0"
                            style={{
                              backgroundColor: `${color}15`,
                              color,
                            }}
                          >
                            {task.taskNumber}
                          </span>
                          <span className="font-medium text-foreground truncate max-w-[200px] sm:max-w-[280px]">
                            {task.title}
                          </span>
                        </div>
                      </td>

                      <td className="px-3 py-3">
                        <div className="flex items-center gap-1.5">
                          <div
                            className="size-5 rounded-full font-semibold text-[9px] flex items-center justify-center shrink-0"
                            style={{
                              backgroundColor: `${color}20`,
                              color,
                            }}
                          >
                            {assignee?.avatar || "?"}
                          </div>
                          <span className="text-foreground">{assignee?.name || "Unassigned"}</span>
                        </div>
                      </td>

                      <td className="px-3 py-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                        {formatDateTime(task.createdAt)}
                      </td>

                      <td className="px-3 py-3 text-muted-foreground">
                        {creator?.name || "Auto Delegator"}
                      </td>

                      <td className="px-3 py-3 text-center font-mono font-semibold text-foreground">
                        {task.targetQuantity || 1} units
                      </td>

                      <td className="px-3 py-3 font-mono text-[11px] text-muted-foreground">
                        {formatDate(task.dueDate)}
                      </td>

                      <td className="px-3 py-3 text-right">
                        <span
                          className={cn(
                            "px-2 py-0.5 rounded text-[10px] font-semibold capitalize",
                            task.status === "completed"
                              ? "bg-emerald-500/15 text-emerald-500"
                              : task.status === "in_review"
                              ? "bg-amber-500/15 text-amber-500"
                              : task.status === "in_progress"
                              ? "bg-blue-500/15 text-blue-500"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {task.status.replace("_", " ")}
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {allocationList.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                      No matching task allocations found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: WORK DONE & AUDIT TRAIL */}
      {/* ======================================================== */}
      {activeTab === "work_done" && (
        <div className="panel p-5 sm:p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border">
            <div>
              <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <History className="size-4 text-primary" />
                <span>Work Completed & Activity Audit Trail</span>
              </h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Immutable event stream of completed targets, unit increments, review submissions, and approvals.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={auditActionFilter}
                onChange={(e) => setAuditActionFilter(e.target.value)}
                className="text-xs h-7.5 px-2 rounded-lg bg-muted/40 border border-border text-foreground"
              >
                <option value="all">All Audit Actions</option>
                <option value="completed">Completed & Approved</option>
                <option value="review">Reviews & Revisions</option>
                <option value="progress">Progress & Unit Updates</option>
                <option value="create">Created & Assigned</option>
              </select>
            </div>
          </div>

          <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
            {filteredAuditLogs.map((log) => {
              const task = tasks.find((t) => t.id === log.targetId);
              const isApproved = log.action.includes("approved");
              const isCompleted = log.action.includes("complete");
              const isRevision = log.action.includes("revision");

              return (
                <div
                  key={log.id}
                  onClick={() => {
                    if (task) setSelectedTaskId(task.id);
                  }}
                  className={cn(
                    "flex items-center justify-between p-3.5 rounded-xl border border-border/80 bg-card hover:bg-muted/30 transition text-xs",
                    task && "cursor-pointer"
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={cn(
                        "size-7 rounded-full flex items-center justify-center shrink-0",
                        isApproved || isCompleted
                          ? "bg-emerald-500/15 text-emerald-500"
                          : isRevision
                          ? "bg-amber-500/15 text-amber-500"
                          : "bg-primary/10 text-primary"
                      )}
                    >
                      {isApproved || isCompleted ? (
                        <Check className="size-3.5" />
                      ) : isRevision ? (
                        <RotateCcw className="size-3.5" />
                      ) : (
                        <History className="size-3.5" />
                      )}
                    </div>
                    <div className="truncate">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-foreground">{log.actorName}</span>
                        <span
                          className={cn(
                            "text-[10px] font-mono uppercase px-1.5 py-0.2 rounded font-bold",
                            isApproved || isCompleted
                              ? "bg-emerald-500/15 text-emerald-500"
                              : isRevision
                              ? "bg-amber-500/15 text-amber-500"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {log.action.replace(/_/g, " ")}
                        </span>
                        {task && (
                          <span className="font-mono text-primary font-semibold text-[11px]">
                            {task.taskNumber}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {log.metadata?.taskName || task?.title || "Daily Target Action"}
                        {log.metadata?.revisionReason && ` — Reason: ${log.metadata.revisionReason}`}
                        {log.metadata?.completedUnits !== undefined &&
                          ` — Completed: ${log.metadata.completedUnits} units`}
                        {log.metadata?.deliverableUrl && ` — Deliverable attached`}
                      </div>
                    </div>
                  </div>

                  <span className="text-[11px] font-mono text-muted-foreground shrink-0 ml-3 whitespace-nowrap">
                    {formatDateTime(log.createdAt)}
                  </span>
                </div>
              );
            })}

            {filteredAuditLogs.length === 0 && (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No activity audit logs found for the selected filter.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 4: ROLE PERMISSIONS MATRIX */}
      {/* ======================================================== */}
      {activeTab === "permissions" && (
        <div className="panel p-5 sm:p-6 space-y-4">
          <div className="pb-2 border-b border-border">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Lock className="size-4 text-primary" />
              <span>Workspace Role & Permissions Architecture</span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Clear breakdown of varying authority and view permissions enforced across profiles.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-border bg-muted/30 text-muted-foreground select-none">
                <tr>
                  <th className="px-4 py-3 font-semibold">Capability / Feature</th>
                  <th className="px-4 py-3 font-semibold text-center">Admin (Kritika)</th>
                  <th className="px-4 py-3 font-semibold text-center">Manager</th>
                  <th className="px-4 py-3 font-semibold text-center">Member (Editor / Creator)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium text-foreground">
                    Analytics & Work Allocation Logs
                  </td>
                  <td className="px-4 py-3 text-center text-emerald-500 font-bold">✓ Full Access</td>
                  <td className="px-4 py-3 text-center text-muted-foreground">✗ Restricted</td>
                  <td className="px-4 py-3 text-center text-muted-foreground">✗ Restricted</td>
                </tr>
                <tr className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium text-foreground">
                    Auto Delegator Automation Rules
                  </td>
                  <td className="px-4 py-3 text-center text-emerald-500 font-bold">✓ Manage & Materialize</td>
                  <td className="px-4 py-3 text-center text-muted-foreground">✗ View Only</td>
                  <td className="px-4 py-3 text-center text-muted-foreground">✗ No Access</td>
                </tr>
                <tr className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium text-foreground">
                    User Management & Color Coding
                  </td>
                  <td className="px-4 py-3 text-center text-emerald-500 font-bold">✓ Create, Edit, Delete, Colors</td>
                  <td className="px-4 py-3 text-center text-muted-foreground">✗ View Only</td>
                  <td className="px-4 py-3 text-center text-muted-foreground">✗ No Access</td>
                </tr>
                <tr className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium text-foreground">
                    Task Review & Deliverable Approval
                  </td>
                  <td className="px-4 py-3 text-center text-emerald-500 font-bold">✓ Approve & Request Revisions</td>
                  <td className="px-4 py-3 text-center text-emerald-500 font-bold">✓ Approve & Request Revisions</td>
                  <td className="px-4 py-3 text-center text-muted-foreground">Submit for Review</td>
                </tr>
                <tr className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium text-foreground">
                    Self-Task Assignment & Status Progression
                  </td>
                  <td className="px-4 py-3 text-center text-emerald-500 font-bold">✓ All Tasks</td>
                  <td className="px-4 py-3 text-center text-emerald-500 font-bold">✓ All Tasks</td>
                  <td className="px-4 py-3 text-center text-emerald-500 font-bold">✓ Assigned / Self Tasks</td>
                </tr>
                <tr className="hover:bg-muted/30">
                  <td className="px-4 py-3 font-medium text-foreground">
                    Task Archival & Permanent Deletion
                  </td>
                  <td className="px-4 py-3 text-center text-emerald-500 font-bold">✓ Soft Delete & Restore</td>
                  <td className="px-4 py-3 text-center text-emerald-500 font-bold">✓ Soft Delete & Restore</td>
                  <td className="px-4 py-3 text-center text-muted-foreground">✗ Restricted</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
