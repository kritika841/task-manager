import { NextRequest, NextResponse } from "next/server";
import { saveLocalDb, type LocalDbSchema } from "@/lib/local-supabase-fallback";
import { canManageWorkspace, resolveRequestActor } from "@/lib/auth-server";
import { sendCheckoutReminderEmail } from "@/lib/email";
import {
  getISTDateTimeParts,
  getProfilesAndDb,
  parseProfileMetadata,
  recordAttendanceAction,
  syncAttendanceFromSupabase,
} from "@/lib/attendance-server";
import {
  AttendanceLedgerCell,
  AttendanceLedgerRow,
  AttendanceLedgerSummary,
  AttendanceLedgerUser,
  AttendanceRecord,
  EmployeeAttendanceRow,
} from "@/lib/types";
import { sanitizeCsvCell } from "@/lib/utils";

const TARGET_TIMEZONE = "Asia/Kolkata";

function formatISTTimeForCSV(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: TARGET_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(d);
}

function formatDurationForCSV(checkInTime: string | null, checkOutTime: string | null): string {
  if (!checkInTime || !checkOutTime) return "-";
  const diffMs = new Date(checkOutTime).getTime() - new Date(checkInTime).getTime();
  if (!Number.isFinite(diffMs) || diffMs < 0) return "-";
  const totalMinutes = Math.floor(diffMs / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${minutes}m`;
}

function escapeCSVField(value: string): string {
  return sanitizeCsvCell(value);
}

let isChecking8PmReminders = false;

async function checkAndSend8PmReminders(
  db: LocalDbSchema,
  profiles: Record<string, any>[],
  force = false
): Promise<{ remindedCount: number; remindedUsers: string[] }> {
  if (isChecking8PmReminders) {
    return { remindedCount: 0, remindedUsers: [] };
  }

  isChecking8PmReminders = true;
  try {
    const { dateStr: todayDateStr, hour } = getISTDateTimeParts();
    if (!force && hour < 20) {
      return { remindedCount: 0, remindedUsers: [] };
    }

    if (!Array.isArray(db.attendance_records)) {
      db.attendance_records = [];
    }
    if (!Array.isArray(db.notifications)) {
      db.notifications = [];
    }

    const records = db.attendance_records as AttendanceRecord[];
    const pendingCheckout = records.filter(
      (r) =>
        r.date === todayDateStr &&
        Boolean(r.checkInTime) &&
        !r.checkOutTime &&
        !r.checkoutReminderSent
    );

    if (pendingCheckout.length === 0) {
      return { remindedCount: 0, remindedUsers: [] };
    }

    const nowIso = new Date().toISOString();
    const remindedUsers: string[] = [];
    const emailJobs: Array<{
      userName: string;
      userEmail: string;
      date: string;
      checkInTime: string;
    }> = [];

    for (const record of pendingCheckout) {
      const profile = profiles.find((p) => String(p.id) === String(record.userId));
      const userEmail = String(profile?.email || record.userEmail || "")
        .trim()
        .toLowerCase();
      const userName = String(profile?.name || record.userName || "Team Member").trim();

      record.checkoutReminderSent = true;
      record.checkoutReminderSentAt = nowIso;
      record.updatedAt = nowIso;

      db.notifications.push({
        id: `notif-att-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        user_id: record.userId,
        title: "⏰ Checkout Reminder (8:00 PM)",
        body: "You haven't checked out for today yet. Please click Check Out in the top bar.",
        message: "You haven't checked out for today yet. Please click Check Out in the top bar.",
        type: "attendance_checkout",
        task_id: null,
        read: false,
        read_at: null,
        created_at: nowIso,
      });

      if (userEmail && record.checkInTime) {
        emailJobs.push({
          userName,
          userEmail,
          date: todayDateStr,
          checkInTime: record.checkInTime,
        });
      }
      remindedUsers.push(userName);
    }

    saveLocalDb(db);

    await Promise.allSettled(
      emailJobs.map((job) =>
        sendCheckoutReminderEmail({
          userName: job.userName,
          userEmail: job.userEmail,
          date: job.date,
          checkInTime: job.checkInTime,
        })
      )
    );

    return { remindedCount: remindedUsers.length, remindedUsers };
  } finally {
    isChecking8PmReminders = false;
  }
}

// Server-side singleton interval (every 60s) to automatically send 8:00 PM IST checkout reminder emails
const globalWithScheduler = globalThis as typeof globalThis & {
  __satmiAttendance8PmInterval?: ReturnType<typeof setInterval>;
};

if (typeof window === "undefined" && !globalWithScheduler.__satmiAttendance8PmInterval) {
  const timer = setInterval(() => {
    const { hour } = getISTDateTimeParts();
    if (hour >= 20) {
      getProfilesAndDb()
        .then(({ db, profiles }) => checkAndSend8PmReminders(db, profiles, false))
        .catch((err) => {
          console.error("Background 8 PM attendance reminder check error:", err);
        });
    }
  }, 60_000);
  if (typeof timer.unref === "function") {
    timer.unref();
  }
  globalWithScheduler.__satmiAttendance8PmInterval = timer;
}

const MAX_LEDGER_DAYS = 180;

function isValidISODate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() === m - 1 &&
    dt.getUTCDate() === d
  );
}

function enumerateDateRange(startDate: string, endDate: string): string[] {
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  const cur = new Date(Date.UTC(sy, sm - 1, sd));
  const end = new Date(Date.UTC(ey, em - 1, ed));
  const dates: string[] = [];

  while (cur.getTime() <= end.getTime() && dates.length < MAX_LEDGER_DAYS) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}

function buildLedgerUsers(profiles: Record<string, any>[]): AttendanceLedgerUser[] {
  const activeProfiles = profiles
    .filter((p) => p && p.active !== false && !p.deleted_at)
    .sort((a, b) =>
      String(a.name || a.email || "").localeCompare(String(b.name || b.email || ""))
    );

  return activeProfiles.map((p) => {
    const name = String(p.name || p.email?.split("@")[0] || "Team Member");
    const email = String(p.email || "");
    const meta = parseProfileMetadata(p.avatar_url, name, String(p.role || "member"));

    return {
      userId: String(p.id),
      userName: name,
      userEmail: email,
      employeeCode: meta.employeeCode,
      role: meta.role,
      department: meta.department,
      color: meta.color,
      avatar: meta.employeeCode.slice(0, 2),
    };
  });
}

function buildAttendanceSheet(
  profiles: Record<string, any>[],
  records: AttendanceRecord[],
  targetDate: string
): EmployeeAttendanceRow[] {
  const users = buildLedgerUsers(profiles);

  const dateRecordsByUserId = new Map<string, AttendanceRecord>();
  for (const r of records) {
    if (r.date === targetDate) {
      dateRecordsByUserId.set(String(r.userId), r);
    }
  }

  return users.map((u) => {
    const record = dateRecordsByUserId.get(u.userId);
    const isPresent = Boolean(record?.checkInTime);

    return {
      ...u,
      date: targetDate,
      status: isPresent ? "present" : "absent",
      checkInTime: record?.checkInTime || null,
      checkOutTime: record?.checkOutTime || null,
      checkoutReminderSent: Boolean(record?.checkoutReminderSent),
      checkoutReminderSentAt: record?.checkoutReminderSentAt || null,
      recordId: record?.id || null,
    };
  });
}

function buildAttendanceLedger(
  profiles: Record<string, any>[],
  records: AttendanceRecord[],
  startDate: string,
  endDate: string
): {
  users: AttendanceLedgerUser[];
  dates: string[];
  rows: AttendanceLedgerRow[];
  summary: AttendanceLedgerSummary;
} {
  const users = buildLedgerUsers(profiles);
  const dates = enumerateDateRange(startDate, endDate);
  const dateSet = new Set(dates);

  const recordsByDateUser = new Map<string, AttendanceRecord>();
  for (const r of records) {
    if (dateSet.has(r.date)) {
      recordsByDateUser.set(`${r.date}::${String(r.userId)}`, r);
    }
  }

  let presentEntries = 0;
  let checkedOutEntries = 0;
  let activeEntries = 0;

  const rows: AttendanceLedgerRow[] = dates.map((date) => {
    const cells: Record<string, AttendanceLedgerCell> = {};
    for (const u of users) {
      const record = recordsByDateUser.get(`${date}::${u.userId}`);
      const isPresent = Boolean(record?.checkInTime);
      const checkInTime = record?.checkInTime || null;
      const checkOutTime = record?.checkOutTime || null;

      if (isPresent) {
        presentEntries += 1;
        if (checkOutTime) {
          checkedOutEntries += 1;
        } else {
          activeEntries += 1;
        }
      }

      cells[u.userId] = {
        userId: u.userId,
        date,
        status: isPresent ? "present" : "absent",
        checkInTime,
        checkOutTime,
        checkoutReminderSent: Boolean(record?.checkoutReminderSent),
        checkoutReminderSentAt: record?.checkoutReminderSentAt || null,
        recordId: record?.id || null,
      };
    }
    return { date, cells };
  });

  const totalPossibleEntries = users.length * dates.length;
  return {
    users,
    dates,
    rows,
    summary: {
      totalEmployees: users.length,
      totalDays: dates.length,
      totalPossibleEntries,
      presentEntries,
      absentEntries: totalPossibleEntries - presentEntries,
      checkedOutEntries,
      activeEntries,
    },
  };
}

function buildAttendanceCSV(sheet: EmployeeAttendanceRow[], targetDate: string): string {
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

  const rows = sheet.map((row) =>
    [
      escapeCSVField(row.date || targetDate),
      escapeCSVField(row.employeeCode),
      escapeCSVField(row.userName),
      escapeCSVField(row.userEmail),
      escapeCSVField(row.role.replace(/_/g, " ")),
      escapeCSVField(row.department),
      escapeCSVField(row.status === "present" ? "Present" : "Absent"),
      escapeCSVField(formatISTTimeForCSV(row.checkInTime)),
      escapeCSVField(formatISTTimeForCSV(row.checkOutTime)),
      escapeCSVField(formatDurationForCSV(row.checkInTime, row.checkOutTime)),
    ].join(",")
  );

  return [headers.join(","), ...rows].join("\n");
}

function buildAttendanceLedgerCSV(
  users: AttendanceLedgerUser[],
  rows: AttendanceLedgerRow[]
): string {
  const headers = [
    "Employee Code",
    "Employee Name",
    "Role",
    "Department",
    "Present Days",
  ];
  for (const row of rows) {
    headers.push(`${row.date} Check-In (IST)`);
    headers.push(`${row.date} Check-Out (IST)`);
  }

  const csvRows = users.map((u) => {
    let presentDays = 0;
    const dateCols: string[] = [];
    for (const row of rows) {
      const cell = row.cells[u.userId];
      if (cell?.status === "present") presentDays += 1;
      dateCols.push(escapeCSVField(formatISTTimeForCSV(cell?.checkInTime || null)));
      dateCols.push(
        escapeCSVField(
          cell?.checkOutTime
            ? formatISTTimeForCSV(cell.checkOutTime)
            : cell?.checkInTime
              ? "Active"
              : "-"
        )
      );
    }

    const cols = [
      escapeCSVField(u.employeeCode),
      escapeCSVField(u.userName),
      escapeCSVField(u.role.replace(/_/g, " ")),
      escapeCSVField(u.department),
      escapeCSVField(`${presentDays}/${rows.length}`),
      ...dateCols,
    ];
    return cols.join(",");
  });

  return [headers.map((h) => escapeCSVField(h)).join(","), ...csvRows].join("\n");
}

export async function GET(req: NextRequest) {
  try {
    const { actor } = await resolveRequestActor(req);
    if (!actor) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const { dateStr: todayDateStr } = getISTDateTimeParts();
    const rawDate = searchParams.get("date")?.trim();
    const rawStartDate = searchParams.get("startDate")?.trim();
    const rawEndDate = searchParams.get("endDate")?.trim();
    const isLedgerMode = Boolean(rawStartDate || rawEndDate);

    const targetDate =
      rawDate && isValidISODate(rawDate) ? rawDate : todayDateStr;
    const format = searchParams.get("format")?.trim().toLowerCase();
    const isAdminCaller = canManageWorkspace(actor.role);

    let startDate = rawStartDate && isValidISODate(rawStartDate) ? rawStartDate : todayDateStr;
    let endDate = rawEndDate && isValidISODate(rawEndDate) ? rawEndDate : startDate;
    if (startDate > endDate) {
      [startDate, endDate] = [endDate, startDate];
    }

    const { db, profiles } = await getProfilesAndDb();
    const records = await syncAttendanceFromSupabase(db);
    await checkAndSend8PmReminders(db, profiles, false);
    const requestedUserId =
      isAdminCaller && searchParams.get("userId")?.trim()
        ? searchParams.get("userId")!.trim()
        : actor.id;

    const myTodayRecord =
      records.find(
        (r) => String(r.userId) === String(requestedUserId) && r.date === todayDateStr
      ) || null;

    if (format === "csv") {
      if (!isAdminCaller) {
        return NextResponse.json(
          { error: "Forbidden: Only Administrators can export the attendance sheet." },
          { status: 403 }
        );
      }

      if (isLedgerMode) {
        const ledger = buildAttendanceLedger(profiles, records, startDate, endDate);
        const csv = buildAttendanceLedgerCSV(ledger.users, ledger.rows);
        return new NextResponse(csv, {
          status: 200,
          headers: {
            "Content-Type": "text/csv; charset=utf-8",
            "Content-Disposition": `attachment; filename="satmi_attendance_ledger_${startDate}_to_${endDate}.csv"`,
            "Cache-Control": "no-store",
          },
        });
      }

      const sheet = buildAttendanceSheet(profiles, records, targetDate);
      const csv = buildAttendanceCSV(sheet, targetDate);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="satmi_attendance_${targetDate}.csv"`,
          "Cache-Control": "no-store",
        },
      });
    }

    if (!isAdminCaller) {
      return NextResponse.json(
        {
          ok: true,
          date: targetDate,
          today: todayDateStr,
          myTodayRecord,
          sheet: [],
          summary: null,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    if (isLedgerMode) {
      const ledger = buildAttendanceLedger(profiles, records, startDate, endDate);
      return NextResponse.json(
        {
          ok: true,
          mode: "ledger",
          startDate,
          endDate,
          today: todayDateStr,
          myTodayRecord,
          ledger,
        },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const sheet = buildAttendanceSheet(profiles, records, targetDate);
    const presentCount = sheet.filter((row) => row.status === "present").length;
    const absentCount = sheet.length - presentCount;
    const checkedOutCount = sheet.filter((row) => Boolean(row.checkOutTime)).length;
    const workingCount = sheet.filter(
      (row) => row.status === "present" && !row.checkOutTime
    ).length;

    return NextResponse.json(
      {
        ok: true,
        date: targetDate,
        today: todayDateStr,
        myTodayRecord,
        sheet,
        summary: {
          totalEmployees: sheet.length,
          presentCount,
          absentCount,
          checkedOutCount,
          workingCount,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: any) {
    console.error("GET /api/attendance error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch attendance" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const { actor } = await resolveRequestActor(req);
    if (!actor) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "").trim().toLowerCase();

    if (!["checkin", "checkout", "check_8pm_reminders"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Expected checkin, checkout, or check_8pm_reminders." },
        { status: 400 }
      );
    }

    const { db, profiles } = await getProfilesAndDb();

    if (action === "check_8pm_reminders") {
      if (!canManageWorkspace(actor.role)) {
        return NextResponse.json(
          { error: "Forbidden: Only Administrators can trigger attendance reminders." },
          { status: 403 }
        );
      }
      const result = await checkAndSend8PmReminders(db, profiles, Boolean(body.force));
      return NextResponse.json({
        ok: true,
        remindedCount: result.remindedCount,
        remindedUsers: result.remindedUsers,
      });
    }

    const targetUserId =
      canManageWorkspace(actor.role) && typeof body.userId === "string" && body.userId.trim()
        ? body.userId.trim()
        : actor.id;

    const result = await recordAttendanceAction({
      db,
      profiles,
      action: action as "checkin" | "checkout",
      targetUserId,
      actorId: actor.id,
      fallbackName: actor.name,
      fallbackEmail: actor.email,
      fallbackRole: actor.role,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result);
  } catch (error: any) {
    console.error("POST /api/attendance error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update attendance" },
      { status: 500 }
    );
  }
}
