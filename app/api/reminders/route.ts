import { NextRequest, NextResponse } from "next/server";
import { loadLocalDb, saveLocalDb } from "@/lib/local-supabase-fallback";
import { resolveRequestActor } from "@/lib/auth-server";

export interface ReminderRecord {
  id: string;
  title: string;
  note?: string;
  remindAt: string;
  targetUserId: string;
  targetUserName?: string;
  createdByUserId: string;
  createdByName: string;
  enabled?: boolean;
  isLongTerm?: boolean;
  recurrence?: string;
  completed: boolean;
  dismissed?: boolean;
  notified?: boolean;
  createdAt: string;
  updatedAt: string;
}

function getProfileName(p: Record<string, unknown>): string {
  return String(p.name || p.full_name || "Team Member");
}

function findProfile(profiles: Record<string, unknown>[], userId: string | null | undefined) {
  if (!userId) return null;
  return (
    profiles.find((p) => String(p.id) === userId) ||
    profiles.find((p) => getProfileName(p).toLowerCase() === userId.toLowerCase()) ||
    null
  );
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const queryUserId =
      searchParams.get("userId")?.trim() ||
      req.headers.get("x-user-id")?.trim() ||
      req.headers.get("x-satmi-actor-id")?.trim() ||
      null;
    const includeAll = searchParams.get("includeAll") === "true";

    const db = loadLocalDb();
    const profiles = Array.isArray(db.profiles) ? db.profiles : [];
    const reminders = Array.isArray(db.reminders) ? (db.reminders as ReminderRecord[]) : [];

    let userId = queryUserId;
    let userRole =
      searchParams.get("role")?.trim() ||
      req.headers.get("x-user-role")?.trim() ||
      "editor";

    if (userId) {
      const profile = findProfile(profiles, userId);
      if (profile) {
        userId = String(profile.id);
        userRole = String(profile.role || userRole);
      }
    } else {
      const resolved = await resolveRequestActor(req);
      if (resolved.actor) {
        userId = resolved.actor.id;
        userRole = resolved.actor.role;
      }
    }

    const filtered = reminders
      .filter((r) => {
        if (!userId) return true;
        if (includeAll && (userRole === "admin" || userRole === "developer")) return true;
        return (
          r.targetUserId === userId ||
          r.targetUserId === "all" ||
          r.createdByUserId === userId
        );
      })
      .sort((a, b) => new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime());

    return NextResponse.json({
      ok: true,
      reminders: filtered,
    });
  } catch (error) {
    console.error("Failed to fetch reminders:", error);
    return NextResponse.json({ error: "Failed to fetch reminders" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const title = String(body.title || body.text || "").trim();
    if (!title) {
      return NextResponse.json({ error: "Reminder title is required" }, { status: 400 });
    }

    const db = loadLocalDb();
    const profiles = Array.isArray(db.profiles) ? db.profiles : [];
    if (!Array.isArray(db.reminders)) {
      db.reminders = [];
    }
    if (!Array.isArray(db.notifications)) {
      db.notifications = [];
    }

    const rawCreatorId =
      body.createdByUserId ||
      body.actorId ||
      body.userId ||
      req.headers.get("x-user-id") ||
      req.headers.get("x-satmi-actor-id") ||
      null;

    const creatorProfile = findProfile(profiles, rawCreatorId);
    let creatorId = creatorProfile
      ? String(creatorProfile.id)
      : rawCreatorId
        ? String(rawCreatorId)
        : null;
    let creatorName =
      body.createdByName ||
      (creatorProfile ? getProfileName(creatorProfile) : null);
    let creatorRole =
      (creatorProfile ? String(creatorProfile.role) : null) ||
      req.headers.get("x-user-role") ||
      null;

    if (!creatorId) {
      const resolved = await resolveRequestActor(req);
      if (resolved.actor) {
        creatorId = resolved.actor.id;
        creatorName = creatorName || resolved.actor.name;
        creatorRole = creatorRole || resolved.actor.role;
      }
    }

    if (!creatorId) {
      return NextResponse.json({ error: "Unauthorized: Creator user not found" }, { status: 401 });
    }

    creatorName = creatorName || "Team Member";
    creatorRole = creatorRole || "editor";

    // Determine target user(s)
    const rawTargets: string[] = Array.isArray(body.targetUserIds)
      ? body.targetUserIds.map(String)
      : body.targetUserId
        ? [String(body.targetUserId)]
        : [creatorId];

    let targetIds: string[] = [];
    if (rawTargets.includes("all")) {
      targetIds = profiles
        .filter((p) => p.active !== false && !p.deleted_at)
        .map((p) => String(p.id));
    } else {
      targetIds = rawTargets;
    }

    // Check permission if creating reminder for someone else
    const isTargetingOthers = targetIds.some((tid) => tid !== creatorId);
    if (
      isTargetingOthers &&
      creatorRole !== "admin" &&
      creatorRole !== "manager" &&
      creatorRole !== "developer"
    ) {
      return NextResponse.json(
        { error: "Forbidden: Only admins can create reminders for other team members." },
        { status: 403 }
      );
    }

    const now = new Date().toISOString();
    const remindAt =
      body.remindAt ||
      body.dueAt ||
      new Date(Date.now() + 30 * 60_000).toISOString();
    const note =
      typeof body.note === "string"
        ? body.note.trim()
        : typeof body.description === "string"
          ? body.description.trim()
          : undefined;

    const created: ReminderRecord[] = [];
    const list = db.reminders as ReminderRecord[];

    for (const targetId of targetIds) {
      const targetProfile = findProfile(profiles, targetId);
      const resolvedTargetId = targetProfile ? String(targetProfile.id) : targetId;
      const resolvedTargetName =
        body.targetUserName ||
        (targetProfile ? getProfileName(targetProfile) : "Team Member");

      const reminder: ReminderRecord = {
        id: `rem-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        title,
        note,
        remindAt,
        targetUserId: resolvedTargetId,
        targetUserName: resolvedTargetName,
        createdByUserId: creatorId,
        createdByName: creatorName,
        enabled: body.enabled !== undefined ? Boolean(body.enabled) : true,
        isLongTerm: Boolean(body.isLongTerm),
        recurrence: typeof body.recurrence === "string" ? body.recurrence : "once",
        completed: false,
        dismissed: false,
        notified: false,
        createdAt: now,
        updatedAt: now,
      };

      list.push(reminder);
      created.push(reminder);

      // If admin created a reminder for another user, also send a notification
      if (resolvedTargetId !== creatorId) {
        const msgText = `"${title}" scheduled for ${new Date(remindAt).toLocaleString([], {
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}`;
        db.notifications.push({
          id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          user_id: resolvedTargetId,
          title: `New Reminder from ${creatorName}`,
          body: msgText,
          message: msgText,
          type: "reminder",
          task_id: null,
          read: false,
          read_at: null,
          created_at: now,
        });
      }
    }

    saveLocalDb(db);

    return NextResponse.json(
      {
        ok: true,
        reminder: created[0],
        reminders: created,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to create reminder:", error);
    return NextResponse.json({ error: "Failed to create reminder" }, { status: 500 });
  }
}

async function handleUpdate(req: NextRequest) {
  try {
    const body = await req.json();
    const id = body.id || new URL(req.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Reminder id is required" }, { status: 400 });
    }

    const db = loadLocalDb();
    if (!Array.isArray(db.reminders)) {
      db.reminders = [];
    }

    const list = db.reminders as ReminderRecord[];
    const idx = list.findIndex((r) => r.id === id);
    if (idx === -1) {
      return NextResponse.json({ error: "Reminder not found" }, { status: 404 });
    }

    const current = list[idx];
    const now = new Date().toISOString();

    let updatedRemindAt = body.remindAt !== undefined ? String(body.remindAt) : current.remindAt;
    let updatedNotified = body.notified !== undefined ? Boolean(body.notified) : current.notified;
    let updatedDismissed = body.dismissed !== undefined ? Boolean(body.dismissed) : current.dismissed;
    let updatedCompleted = body.completed !== undefined ? Boolean(body.completed) : current.completed;

    if (typeof body.snoozeMinutes === "number" && body.snoozeMinutes > 0) {
      updatedRemindAt = new Date(Date.now() + body.snoozeMinutes * 60_000).toISOString();
      updatedNotified = false;
      updatedDismissed = false;
      updatedCompleted = false;
    }

    const updated: ReminderRecord = {
      ...current,
      title: body.title !== undefined ? String(body.title).trim() : current.title,
      note: body.note !== undefined ? String(body.note).trim() : current.note,
      remindAt: updatedRemindAt,
      enabled: body.enabled !== undefined ? Boolean(body.enabled) : current.enabled ?? true,
      isLongTerm: body.isLongTerm !== undefined ? Boolean(body.isLongTerm) : current.isLongTerm,
      recurrence: body.recurrence !== undefined ? String(body.recurrence) : current.recurrence,
      completed: updatedCompleted,
      dismissed: updatedDismissed,
      notified: updatedNotified,
      updatedAt: now,
    };

    list[idx] = updated;
    saveLocalDb(db);

    return NextResponse.json({
      ok: true,
      reminder: updated,
    });
  } catch (error) {
    console.error("Failed to update reminder:", error);
    return NextResponse.json({ error: "Failed to update reminder" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  return handleUpdate(req);
}

export async function PUT(req: NextRequest) {
  return handleUpdate(req);
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const id = searchParams.get("id") || body.id;

    if (!id) {
      return NextResponse.json({ error: "Reminder id is required" }, { status: 400 });
    }

    const db = loadLocalDb();
    if (!Array.isArray(db.reminders)) {
      db.reminders = [];
    }

    const list = db.reminders as ReminderRecord[];
    db.reminders = list.filter((r) => r.id !== id);
    saveLocalDb(db);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete reminder:", error);
    return NextResponse.json({ error: "Failed to delete reminder" }, { status: 500 });
  }
}
