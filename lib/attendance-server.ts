import crypto from "node:crypto";
import { ADFLOW_SUPABASE_URL, supabaseAdmin } from "@/lib/supabase";
import { getAdFlowHeaders } from "@/lib/adflow-bridge";
import { loadLocalDb, saveLocalDb, type LocalDbSchema } from "@/lib/local-supabase-fallback";
import { AttendanceRecord, Role } from "@/lib/types";
import { getEmployeeCode, getUserColor } from "@/lib/utils";

export const ATTENDANCE_TIMEZONE = "Asia/Kolkata";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function getISTDateTimeParts(date = new Date()): {
  dateStr: string;
  hour: number;
  minute: number;
} {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: ATTENDANCE_TIMEZONE,
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

export function getDepartment(role: string): string {
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

export function parseProfileMetadata(
  avatarUrl: string | null | undefined,
  name: string,
  role: string
) {
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

export async function getProfilesAndDb(): Promise<{
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

/**
 * Fetches shared manual attendance events stored in Supabase `audit_logs`
 * (`tasks_attendance_checkin` / `tasks_attendance_checkout`) and merges them
 * with `db.attendance_records` so localhost and deployed dashboards stay in sync.
 */
export async function syncAttendanceFromSupabase(
  db: LocalDbSchema,
  options?: { userId?: string; startDate?: string; endDate?: string }
): Promise<AttendanceRecord[]> {
  const localRecords = (db.attendance_records || []) as AttendanceRecord[];
  const byKey = new Map<string, AttendanceRecord>();
  for (const rec of localRecords) {
    if (rec?.date && rec?.userId) {
      byKey.set(`${rec.date}::${String(rec.userId)}`, { ...rec });
    }
  }

  try {
    const params = new URLSearchParams({
      target_type: "eq.attendance",
      action: "in.(tasks_attendance_checkin,tasks_attendance_checkout)",
      select: "id,actor_id,action,target_id,metadata,created_at",
      order: "created_at.asc",
      limit: "5000",
    });
    if (options?.userId && UUID_RE.test(options.userId)) {
      params.set("actor_id", `eq.${options.userId}`);
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    const res = await fetch(`${ADFLOW_SUPABASE_URL}/rest/v1/audit_logs?${params.toString()}`, {
      headers: getAdFlowHeaders(),
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      const rows = (await res.json()) as Array<{
        id: string;
        actor_id: string | null;
        action: string;
        target_id: string | null;
        metadata: Record<string, any> | null;
        created_at: string;
      }>;

      let changed = false;
      for (const row of rows || []) {
        const meta = row.metadata || {};
        const date = String(meta.date || "").trim();
        const userId = String(meta.userId || row.actor_id || "").trim();
        if (!date || !userId) continue;
        if (options?.startDate && date < options.startDate) continue;
        if (options?.endDate && date > options.endDate) continue;

        const key = `${date}::${userId}`;
        const existing = byKey.get(key);

        if (row.action === "tasks_attendance_checkin") {
          const checkInTime = String(meta.checkInTime || row.created_at);
          if (!existing) {
            byKey.set(key, {
              id: String(meta.id || `att-${row.id}`),
              userId,
              userName: String(meta.userName || "Team Member"),
              userEmail: String(meta.userEmail || ""),
              employeeCode: String(meta.employeeCode || getEmployeeCode(String(meta.userName || "TM"))),
              role: (meta.role as Role) || "member",
              department: String(meta.department || getDepartment(String(meta.role || "member"))),
              date,
              status: "present",
              checkInTime,
              checkOutTime: meta.checkOutTime ? String(meta.checkOutTime) : null,
              checkoutReminderSent: false,
              checkoutReminderSentAt: null,
              createdAt: row.created_at,
              updatedAt: row.created_at,
            });
            changed = true;
          } else if (!existing.checkInTime || checkInTime < existing.checkInTime) {
            existing.status = "present";
            existing.checkInTime = checkInTime;
            existing.updatedAt = row.created_at;
            changed = true;
          }
        } else if (row.action === "tasks_attendance_checkout") {
          const checkOutTime = String(meta.checkOutTime || row.created_at);
          const checkInTime = meta.checkInTime ? String(meta.checkInTime) : existing?.checkInTime || checkOutTime;
          if (!existing) {
            byKey.set(key, {
              id: String(meta.id || `att-${row.id}`),
              userId,
              userName: String(meta.userName || "Team Member"),
              userEmail: String(meta.userEmail || ""),
              employeeCode: String(meta.employeeCode || getEmployeeCode(String(meta.userName || "TM"))),
              role: (meta.role as Role) || "member",
              department: String(meta.department || getDepartment(String(meta.role || "member"))),
              date,
              status: "present",
              checkInTime,
              checkOutTime,
              checkoutReminderSent: false,
              checkoutReminderSentAt: null,
              createdAt: row.created_at,
              updatedAt: row.created_at,
            });
            changed = true;
          } else if (!existing.checkOutTime || checkOutTime > existing.checkOutTime) {
            existing.status = "present";
            if (!existing.checkInTime && checkInTime) {
              existing.checkInTime = checkInTime;
            }
            existing.checkOutTime = checkOutTime;
            existing.updatedAt = row.created_at;
            changed = true;
          }
        }
      }

      if (changed) {
        db.attendance_records = Array.from(byKey.values());
        saveLocalDb(db);
      }
    }
  } catch {
    // Non-fatal: fall back to local records if offline
  }

  return Array.from(byKey.values());
}

async function publishAttendanceToSupabase(
  action: "tasks_attendance_checkin" | "tasks_attendance_checkout",
  record: AttendanceRecord,
  source?: string
): Promise<void> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);
    await fetch(`${ADFLOW_SUPABASE_URL}/rest/v1/audit_logs`, {
      method: "POST",
      headers: getAdFlowHeaders(),
      body: JSON.stringify({
        actor_id: UUID_RE.test(record.userId) ? record.userId : null,
        action,
        target_type: "attendance",
        target_id: `${record.date}::${record.userId}`,
        metadata: {
          id: record.id,
          userId: record.userId,
          userName: record.userName,
          userEmail: record.userEmail,
          employeeCode: record.employeeCode,
          role: record.role,
          department: record.department,
          date: record.date,
          status: record.status,
          checkInTime: record.checkInTime,
          checkOutTime: record.checkOutTime,
          ...(source ? { source } : {}),
        },
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);
  } catch {
    // Non-fatal if offline
  }
}

export function getTodayAttendanceRecordForUser(
  records: AttendanceRecord[],
  userId: string
): { today: string; record: AttendanceRecord | null } {
  const { dateStr: today } = getISTDateTimeParts();
  const record =
    records.find((r) => String(r.userId) === String(userId) && r.date === today) || null;
  return { today, record };
}

export async function recordAttendanceAction(params: {
  db: LocalDbSchema;
  profiles: Record<string, any>[];
  action: "checkin" | "checkout";
  targetUserId: string;
  actorId: string;
  fallbackName?: string;
  fallbackEmail?: string;
  fallbackRole?: string;
  source?: string;
  skipSupabasePublish?: boolean;
}): Promise<
  | {
      ok: true;
      record: AttendanceRecord;
      alreadyCheckedIn?: boolean;
      alreadyCheckedOut?: boolean;
    }
  | { ok: false; status: number; error: string }
> {
  const { db, profiles, action, targetUserId, actorId, source, skipSupabasePublish } = params;
  const targetProfile = profiles.find((p) => String(p.id) === String(targetUserId));
  if (!targetProfile || targetProfile.active === false || targetProfile.deleted_at) {
    return { ok: false, status: 404, error: "Employee profile not found" };
  }

  // Pull latest shared attendance from Supabase before mutating so duplicate clicks across apps are idempotent
  await syncAttendanceFromSupabase(db, { userId: targetUserId });

  const { dateStr: todayDateStr } = getISTDateTimeParts();
  const nowIso = new Date().toISOString();
  const records = db.attendance_records as AttendanceRecord[];
  let existing = records.find(
    (r) => String(r.userId) === String(targetUserId) && r.date === todayDateStr
  );

  const userName = String(
    targetProfile.name || targetProfile.email?.split("@")[0] || params.fallbackName || "Team Member"
  );
  const userEmail = String(targetProfile.email || params.fallbackEmail || "");
  const meta = parseProfileMetadata(
    targetProfile.avatar_url,
    userName,
    String(targetProfile.role || params.fallbackRole || "member")
  );

  if (action === "checkin") {
    if (existing && existing.checkInTime) {
      return { ok: true, record: existing, alreadyCheckedIn: true };
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
      actor_id: actorId,
      action: "attendance_checkin",
      target_type: "attendance",
      target_id: existing.id,
      metadata: {
        userId: existing.userId,
        userName: existing.userName,
        date: todayDateStr,
        checkInTime: existing.checkInTime,
        ...(source ? { source } : {}),
      },
      created_at: nowIso,
    });

    saveLocalDb(db);
    if (!skipSupabasePublish) {
      await publishAttendanceToSupabase("tasks_attendance_checkin", existing, source || "task_manager");
    }
    return { ok: true, record: existing };
  }

  if (!existing || !existing.checkInTime) {
    return {
      ok: false,
      status: 400,
      error: "Please check in first before checking out.",
    };
  }

  if (existing.checkOutTime) {
    return { ok: true, record: existing, alreadyCheckedOut: true };
  }

  existing.checkOutTime = nowIso;
  existing.updatedAt = nowIso;

  db.audit_logs.unshift({
    id: `aud-att-${crypto.randomUUID()}`,
    actor_id: actorId,
    action: "attendance_checkout",
    target_type: "attendance",
    target_id: existing.id,
    metadata: {
      userId: existing.userId,
      userName: existing.userName,
      date: todayDateStr,
      checkInTime: existing.checkInTime,
      checkOutTime: existing.checkOutTime,
      ...(source ? { source } : {}),
    },
    created_at: nowIso,
  });

  saveLocalDb(db);
  if (!skipSupabasePublish) {
    await publishAttendanceToSupabase("tasks_attendance_checkout", existing, source || "task_manager");
  }
  return { ok: true, record: existing };
}
