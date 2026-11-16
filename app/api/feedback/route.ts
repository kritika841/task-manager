import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { loadLocalDb, saveLocalDb } from "@/lib/local-supabase-fallback";
import { resolveRequestActor } from "@/lib/auth-server";
import { Role, TaskPriority } from "@/lib/types";
import { sendFeedbackEmail } from "@/lib/email";

export interface FeatureRequestRecord {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: Role;
  type: "feature" | "feedback" | "bug";
  title: string;
  details: string;
  priority?: TaskPriority;
  status: "open" | "in_progress" | "resolved";
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

function getProfileName(p: Record<string, unknown>): string {
  return String(p.name || p.full_name || "User");
}

function findProfile(profiles: Record<string, unknown>[], userId: string | null | undefined) {
  if (!userId) return null;
  return (
    profiles.find((p) => String(p.id) === userId) ||
    profiles.find((p) => getProfileName(p).toLowerCase() === userId.toLowerCase()) ||
    null
  );
}

async function resolveCaller(req: NextRequest, bodyActorId?: string) {
  const { searchParams } = new URL(req.url);
  const explicitId =
    bodyActorId?.trim() ||
    searchParams.get("actorId")?.trim() ||
    searchParams.get("userId")?.trim() ||
    req.headers.get("x-user-id")?.trim() ||
    req.headers.get("x-satmi-actor-id")?.trim() ||
    null;

  const db = loadLocalDb();
  const profiles = Array.isArray(db.profiles) ? db.profiles : [];

  if (explicitId) {
    const profile = findProfile(profiles, explicitId);
    if (profile) {
      return {
        id: String(profile.id),
        name: getProfileName(profile),
        role: String(profile.role || "editor") as Role,
      };
    }
  }

  const resolved = await resolveRequestActor(req);
  if (resolved.actor) {
    return {
      id: resolved.actor.id,
      name: resolved.actor.name,
      role: resolved.actor.role as Role,
    };
  }

  return null;
}

function isPrivilegedViewer(role: string | null | undefined): boolean {
  return role === "admin" || role === "developer";
}

export async function GET(req: NextRequest) {
  try {
    const caller = await resolveCaller(req);
    if (!caller || !isPrivilegedViewer(caller.role)) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Forbidden: Feature requests and developer feedback are strictly restricted to Admin and Developer accounts.",
          requests: [],
          feedback: [],
          canManage: false,
        },
        { status: 403 }
      );
    }

    const db = loadLocalDb();
    const list = Array.isArray(db.feature_requests)
      ? (db.feature_requests as FeatureRequestRecord[])
      : [];

    const sorted = [...list].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json({
      ok: true,
      requests: sorted,
      feedback: sorted,
      canManage: true,
    });
  } catch (error) {
    console.error("Failed to fetch feature requests:", error);
    return NextResponse.json({ error: "Failed to fetch feature requests" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const rawTitle = String(body.title || body.subject || "").trim();
    const rawDetails = String(body.details || body.description || body.message || "").trim();

    if (!rawTitle && !rawDetails) {
      return NextResponse.json(
        { error: "Please provide a title or description for your feedback." },
        { status: 400 }
      );
    }

    // Ensure profiles are synced from AdFlow before resolving user emails
    const { data: liveProfiles } = await supabaseAdmin.from("profiles").select("*");
    const caller = await resolveCaller(req, body.authorId || body.userId || body.actorId);
    const db = loadLocalDb();
    const profiles =
      Array.isArray(liveProfiles) && liveProfiles.length > 0
        ? liveProfiles
        : Array.isArray(db.profiles)
          ? db.profiles
          : [];
    if (!Array.isArray(db.feature_requests)) {
      db.feature_requests = [];
    }
    if (!Array.isArray(db.notifications)) {
      db.notifications = [];
    }

    const authorId = caller?.id || String(body.authorId || body.userId || "unknown");
    const authorName = caller?.name || String(body.authorName || "Team Member");
    const authorRole = (caller?.role || body.authorRole || "editor") as Role;

    const rawType = String(body.type || body.category || "feature").toLowerCase();
    const type: "feature" | "feedback" | "bug" =
      rawType === "bug" ? "bug" : rawType === "feedback" ? "feedback" : "feature";

    const now = new Date().toISOString();
    const item: FeatureRequestRecord = {
      id: `fb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      authorId,
      authorName,
      authorRole,
      type,
      title: rawTitle || rawDetails.slice(0, 60),
      details: rawDetails || rawTitle,
      priority: (body.priority as TaskPriority) || "medium",
      status: "open",
      createdAt: now,
      updatedAt: now,
    };

    (db.feature_requests as FeatureRequestRecord[]).unshift(item);

    // Notify admins & developers silently via notification store
    const privilegedProfiles = profiles.filter(
      (p) => p.active !== false && !p.deleted_at && (p.role === "admin" || p.role === "developer")
    );
    for (const adminProfile of privilegedProfiles) {
      const adminId = String(adminProfile.id);
      if (adminId !== authorId) {
        const msgText = `${authorName}: "${item.title}"`;
        db.notifications.push({
          id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          user_id: adminId,
          title: `New ${type === "bug" ? "Bug Report" : type === "feedback" ? "Developer Feedback" : "Feature Request"}`,
          body: msgText,
          message: msgText,
          type: "system",
          task_id: null,
          read: false,
          read_at: null,
          created_at: now,
        });
      }
    }

    saveLocalDb(db);

    // Send email from support@satmi.in to the Developer user email with Kartavya in CC (dynamically resolved from users)
    const emailRes = await sendFeedbackEmail({
      type: item.type,
      title: item.title,
      details: item.details,
      priority: item.priority,
      authorName: item.authorName,
      authorRole: item.authorRole,
      profiles,
    });

    return NextResponse.json(
      {
        ok: true,
        request: item,
        feedback: item,
        emailSent: emailRes.ok,
        emailFrom: emailRes.from,
        emailTo: emailRes.to,
        emailCc: emailRes.cc,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Failed to submit feedback:", error);
    return NextResponse.json({ error: "Failed to submit feedback" }, { status: 500 });
  }
}

async function handleUpdate(req: NextRequest) {
  try {
    const body = await req.json();
    const caller = await resolveCaller(req, body.actorId || body.userId);
    if (!caller || !isPrivilegedViewer(caller.role)) {
      return NextResponse.json(
        { error: "Forbidden: Only Admin or Developer accounts can update feature requests." },
        { status: 403 }
      );
    }

    const id = body.id || new URL(req.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Feedback id is required" }, { status: 400 });
    }

    const db = loadLocalDb();
    if (!Array.isArray(db.feature_requests)) {
      db.feature_requests = [];
    }

    const list = db.feature_requests as FeatureRequestRecord[];
    const idx = list.findIndex((item) => item.id === id);
    if (idx === -1) {
      return NextResponse.json({ error: "Feedback item not found" }, { status: 404 });
    }

    const current = list[idx];
    const updated: FeatureRequestRecord = {
      ...current,
      status:
        body.status === "open" || body.status === "in_progress" || body.status === "resolved"
          ? body.status
          : current.status,
      adminNotes: body.adminNotes !== undefined ? String(body.adminNotes) : current.adminNotes,
      priority: (body.priority as TaskPriority) || current.priority,
      title: body.title !== undefined ? String(body.title).trim() : current.title,
      details: body.details !== undefined ? String(body.details).trim() : current.details,
      updatedAt: new Date().toISOString(),
    };

    list[idx] = updated;
    saveLocalDb(db);

    return NextResponse.json({
      ok: true,
      request: updated,
      feedback: updated,
    });
  } catch (error) {
    console.error("Failed to update feedback:", error);
    return NextResponse.json({ error: "Failed to update feedback" }, { status: 500 });
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
    const caller = await resolveCaller(req, body.actorId || body.userId);
    if (!caller || !isPrivilegedViewer(caller.role)) {
      return NextResponse.json(
        { error: "Forbidden: Only Admin or Developer accounts can delete feature requests." },
        { status: 403 }
      );
    }

    const id = searchParams.get("id") || body.id;
    if (!id) {
      return NextResponse.json({ error: "Feedback id is required" }, { status: 400 });
    }

    const db = loadLocalDb();
    if (!Array.isArray(db.feature_requests)) {
      db.feature_requests = [];
    }

    db.feature_requests = (db.feature_requests as FeatureRequestRecord[]).filter(
      (item) => item.id !== id
    );
    saveLocalDb(db);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Failed to delete feedback:", error);
    return NextResponse.json({ error: "Failed to delete feedback" }, { status: 500 });
  }
}
