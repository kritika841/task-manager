import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { loadLocalDb, saveLocalDb, type LocalDbSchema } from "@/lib/local-supabase-fallback";
import { canManageWorkspace, resolveRequestActor } from "@/lib/auth-server";
import { sendCheckoutReminderEmail } from "@/lib/email";
import { AttendanceRecord, EmployeeAttendanceRow, Role } from "@/lib/types";
import { getEmployeeCode, getUserColor } from "@/lib/utils";

const TARGET_TIMEZONE = "Asia/Kolkata";

function getISTDateTimeParts(date = new Date()): {
  dateStr: string;
  hour: number;
  minute: number;
} {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TARGET_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  const rawHour = Number(values.hour);
  const hour = rawHour === 24 ? 0 : rawHour;
  return {
    dateStr: `${values.year}-${values.month}-${values.day}`,
    hour,
    minute: Number(values.minute) || 0,
  };
}

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
  const escaped = value.replace(/"/g, '""');
  return `"${escaped}"`;
}

function getDepartment(role: string): string {
  switch (role) {
    case "admin":
      return "Executive & Admin";
    case "manager":
      return "Operations & Review";
    case "editor":
      return "Video Editing";
    case "content_creator":
      return "Content & Creative";
    case "media_buyer":
      return "Media & Growth";
    case "developer":
      return "Engineering & Product";
    default:
      return "Operations";
  }
}

function parseProfileMetadata(avatarUrl: string | null | undefined, name: string, role: string) {
  let color: string | undefined;
  let employeeCode: string | undefined;
  let appRole: Role | undefined;

  if (avatarUrl && typeof avatarUrl === "string") {
    try {
      if (avatarUrl.startsWith("{") && avatarUrl.endsWith("}")) {
        const parsed = JSON.parse(avatarUrl);
        color = parsed.color;
        employeeCode = parsed.employeeCode;
        appRole = parsed.appRole;
      } else if (avatarUrl.startsWith("#")) {
        color = avatarUrl;
      }
    } catch {
      // ignore malformed metadata
    }
  }

  const resolvedRole = (appRole || (role as Role) || "member") as Role;
  const code = getEmployeeCode(name, employeeCode);
  return {
    employeeCode: code,
    color: getUserColor(code, color),
    role: resolvedRole,
    department: getDepartment(resolvedRole),
  };
}

async function getProfilesAndDb(): Promise<{
  db: LocalDbSchema;
  profiles: Record<string, any>[];
}> {
  const { data: liveProfiles } = await supabaseAdmin
    .from("profiles")
    .select("id, name, email, role, avatar_url, active, deleted_at");
  const db = loadLocalDb();
  if (!Array.isArray(db.attendance_records)) {
    db.attendance_records = [];
  }
  if (!Array.isArray(db.notifications)) {
    db.notifications = [];
  }
  if (!Array.isArray(db.audit_logs)) {
    db.audit_logs = [];
  }

  const profiles =
    Array.isArray(liveProfiles) && liveProfiles.length > 0
      ? liveProfiles
      : Array.isArray(db.profiles)
        ? db.profiles
        : [];

  return { db, profiles };
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

function buildAttendanceSheet(
  profiles: Record<string, any>[],
  records: AttendanceRecord[],
  targetDate: string
): EmployeeAttendanceRow[] {
  const activeProfiles = profiles
    .filter((p) => p && p.active !== false && !p.deleted_at)
    .sort((a, b) =>
      String(a.name || a.email || "").localeCompare(String(b.name || b.email || ""))
    );

  const dateRecordsByUserId = new Map<string, AttendanceRecord>();
  for (const r of records) {
    if (r.date === targetDate) {
      dateRecordsByUserId.set(String(r.userId), r);
    }
  }

  return activeProfiles.map((p) => {
    const name = String(p.name || p.email?.split("@")[0] || "Team Member");
    const email = String(p.email || "");
    const meta = parseProfileMetadata(p.avatar_url, name, String(p.role || "member"));
    const record = dateRecordsByUserId.get(String(p.id));
    const isPresent = Boolean(record?.checkInTime);

    return {
      userId: String(p.id),
      userName: name,
      userEmail: email,
      employeeCode: meta.employeeCode,
      role: meta.role,
      department: meta.department,
      color: meta.color,
      avatar: meta.employeeCode.slice(0, 2),
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

export async function GET(req: NextRequest) {
  try {
    const { actor } = await resolveRequestActor(req);
    if (!actor) {
      return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const { dateStr: todayDateStr } = getISTDateTimeParts();
    const rawDate = searchParams.get("date")?.trim();
    const targetDate =
      rawDate && /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : todayDateStr;
    const format = searchParams.get("format")?.trim().toLowerCase();
    const isAdminCaller = canManageWorkspace(actor.role);

    const { db, profiles } = await getProfilesAndDb();
    await checkAndSend8PmReminders(db, profiles, false);

    const records = (db.attendance_records || []) as AttendanceRecord[];
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

    const targetProfile = profiles.find((p) => String(p.id) === String(targetUserId));
    if (!targetProfile || targetProfile.active === false || targetProfile.deleted_at) {
      return NextResponse.json({ error: "Employee profile not found" }, { status: 404 });
    }

    const { dateStr: todayDateStr } = getISTDateTimeParts();
    const nowIso = new Date().toISOString();
    const records = db.attendance_records as AttendanceRecord[];
    let existing = records.find(
      (r) => String(r.userId) === String(targetUserId) && r.date === todayDateStr
    );

    const userName = String(targetProfile.name || targetProfile.email?.split("@")[0] || actor.name);
    const userEmail = String(targetProfile.email || actor.email);
    const meta = parseProfileMetadata(
      targetProfile.avatar_url,
      userName,
      String(targetProfile.role || actor.role)
    );

    if (action === "checkin") {
      if (existing && existing.checkInTime) {
        return NextResponse.json({
          ok: true,
          record: existing,
          alreadyCheckedIn: true,
        });
      }

      if (existing) {
        existing.status = "present";
        existing.checkInTime = nowIso;
        existing.updatedAt = nowIso;
      } else {
        existing = {
          id: `att-${crypto.randomUUID()}`,
          userId: String(targetProfile.id),
          userName,
          userEmail,
          employeeCode: meta.employeeCode,
          role: meta.role,
          department: meta.department,
          date: todayDateStr,
          status: "present",
          checkInTime: nowIso,
          checkOutTime: null,
          checkoutReminderSent: false,
          checkoutReminderSentAt: null,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        records.push(existing);
      }

      db.audit_logs.unshift({
        id: `aud-att-${crypto.randomUUID()}`,
        actor_id: actor.id,
        action: "attendance_checkin",
        target_type: "attendance",
        target_id: existing.id,
        metadata: {
          userId: existing.userId,
          userName: existing.userName,
          date: todayDateStr,
          checkInTime: existing.checkInTime,
        },
        created_at: nowIso,
      });

      saveLocalDb(db);
      return NextResponse.json({ ok: true, record: existing });
    }

    // action === "checkout"
    if (!existing || !existing.checkInTime) {
      return NextResponse.json(
        { error: "Please check in first before checking out." },
        { status: 400 }
      );
    }

    if (existing.checkOutTime) {
      return NextResponse.json({
        ok: true,
        record: existing,
        alreadyCheckedOut: true,
      });
    }

    existing.checkOutTime = nowIso;
    existing.updatedAt = nowIso;

    db.audit_logs.unshift({
      id: `aud-att-${crypto.randomUUID()}`,
      actor_id: actor.id,
      action: "attendance_checkout",
      target_type: "attendance",
      target_id: existing.id,
      metadata: {
        userId: existing.userId,
        userName: existing.userName,
        date: todayDateStr,
        checkInTime: existing.checkInTime,
        checkOutTime: existing.checkOutTime,
      },
      created_at: nowIso,
    });

    saveLocalDb(db);
    return NextResponse.json({ ok: true, record: existing });
  } catch (error: any) {
    console.error("POST /api/attendance error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to update attendance" },
      { status: 500 }
    );
  }
}
