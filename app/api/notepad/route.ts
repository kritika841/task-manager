import { NextRequest, NextResponse } from "next/server";
import { loadLocalDb, saveLocalDb } from "@/lib/local-supabase-fallback";
import { resolveRequestActor } from "@/lib/auth-server";

interface NoteEntry {
  id: string;
  title: string;
  content: string;
  pinned?: boolean;
  color?: string;
  updatedAt: string;
}

interface UserNotepadRecord {
  userId: string;
  content: string;
  notes: NoteEntry[];
  updatedAt: string;
}

function resolveTargetUser(req: NextRequest, bodyUserId?: string, bodyActorId?: string): {
  userId: string | null;
  actorId: string | null;
  forbidden: boolean;
} {
  const { searchParams } = new URL(req.url);
  const queryUserId = searchParams.get("userId")?.trim() || null;
  const headerUserId = req.headers.get("x-user-id")?.trim() || null;
  const cleanBodyUserId = bodyUserId?.trim() || null;
  const requestedUserId = (cleanBodyUserId || queryUserId || headerUserId) ?? null;

  const explicitActorId =
    bodyActorId?.trim() ||
    searchParams.get("actorId")?.trim() ||
    req.headers.get("x-satmi-actor-id")?.trim() ||
    null;

  if (explicitActorId && requestedUserId && explicitActorId !== requestedUserId) {
    return { userId: requestedUserId, actorId: explicitActorId, forbidden: true };
  }

  if (headerUserId && requestedUserId && headerUserId !== requestedUserId) {
    return { userId: requestedUserId, actorId: headerUserId, forbidden: true };
  }

  if (cleanBodyUserId && queryUserId && cleanBodyUserId !== queryUserId) {
    return { userId: requestedUserId, actorId: queryUserId, forbidden: true };
  }

  return {
    userId: requestedUserId,
    actorId: explicitActorId || headerUserId,
    forbidden: false,
  };
}

export async function GET(req: NextRequest) {
  try {
    const check = resolveTargetUser(req);
    if (check.forbidden) {
      return NextResponse.json(
        { error: "Forbidden: Personal notepad is strictly private to its owner." },
        { status: 403 }
      );
    }

    let userId = check.userId;
    if (!userId) {
      const resolved = await resolveRequestActor(req);
      userId = resolved.actor?.id ?? null;
    }

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required to access personal notepad." },
        { status: 400 }
      );
    }

    const db = loadLocalDb();
    const allNotes = Array.isArray(db.personal_notes) ? (db.personal_notes as UserNotepadRecord[]) : [];
    const existing = allNotes.find((n) => n.userId === userId);

    const record: UserNotepadRecord = existing || {
      userId,
      content: "",
      notes: [],
      updatedAt: new Date().toISOString(),
    };

    return NextResponse.json({
      ok: true,
      notepad: record,
      userId: record.userId,
      content: record.content || "",
      notes: Array.isArray(record.notes) ? record.notes : [],
      updatedAt: record.updatedAt,
    });
  } catch (error) {
    console.error("Failed to fetch personal notepad:", error);
    return NextResponse.json({ error: "Failed to fetch personal notepad" }, { status: 500 });
  }
}

async function handleUpsert(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const check = resolveTargetUser(req, body.userId, body.actorId);
    if (check.forbidden) {
      return NextResponse.json(
        { error: "Forbidden: Cannot modify another user's private notepad." },
        { status: 403 }
      );
    }

    let userId = check.userId;
    if (!userId) {
      const resolved = await resolveRequestActor(req);
      userId = resolved.actor?.id ?? null;
    }

    if (!userId) {
      return NextResponse.json(
        { error: "userId is required to save personal notepad." },
        { status: 400 }
      );
    }

    const db = loadLocalDb();
    if (!Array.isArray(db.personal_notes)) {
      db.personal_notes = [];
    }

    const now = new Date().toISOString();
    const list = db.personal_notes as UserNotepadRecord[];
    const idx = list.findIndex((n) => n.userId === userId);
    const record: UserNotepadRecord =
      idx >= 0
        ? {
            userId,
            content: typeof list[idx].content === "string" ? list[idx].content : "",
            notes: Array.isArray(list[idx].notes) ? [...list[idx].notes] : [],
            updatedAt: now,
          }
        : {
            userId,
            content: "",
            notes: [],
            updatedAt: now,
          };

    // Full content update
    if (typeof body.content === "string" && !body.action && !body.noteId && !body.title) {
      record.content = body.content;
    } else if (typeof body.content === "string" && Array.isArray(body.notes)) {
      record.content = body.content;
    }

    // Full notes array replacement
    if (Array.isArray(body.notes)) {
      record.notes = body.notes.map((n: Partial<NoteEntry>, i: number) => ({
        id: n.id || `note-${Date.now()}-${i}`,
        title: typeof n.title === "string" ? n.title : "Untitled Note",
        content: typeof n.content === "string" ? n.content : "",
        pinned: Boolean(n.pinned),
        color: n.color,
        updatedAt: n.updatedAt || now,
      }));
    }

    // Action-based or single-note mutations
    const action = body.action as string | undefined;
    if (action === "add_note" || action === "create" || (!action && body.title && !Array.isArray(body.notes))) {
      const newNote: NoteEntry = {
        id: body.noteId || body.id || `note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: typeof body.title === "string" ? body.title : "Quick Note",
        content:
          typeof body.noteContent === "string"
            ? body.noteContent
            : typeof body.content === "string"
              ? body.content
              : "",
        pinned: Boolean(body.pinned),
        color: body.color,
        updatedAt: now,
      };
      record.notes = [newNote, ...record.notes.filter((n) => n.id !== newNote.id)];
    } else if (action === "update_note" || (body.noteId && !action)) {
      const targetId = body.noteId || body.id;
      record.notes = record.notes.map((n) =>
        n.id === targetId
          ? {
              ...n,
              title: typeof body.title === "string" ? body.title : n.title,
              content:
                typeof body.noteContent === "string"
                  ? body.noteContent
                  : typeof body.content === "string"
                    ? body.content
                    : n.content,
              pinned: body.pinned !== undefined ? Boolean(body.pinned) : n.pinned,
              color: body.color !== undefined ? body.color : n.color,
              updatedAt: now,
            }
          : n
      );
    } else if (action === "delete_note") {
      const targetId = body.noteId || body.id;
      record.notes = record.notes.filter((n) => n.id !== targetId);
    }

    record.updatedAt = now;
    if (idx >= 0) {
      list[idx] = record;
    } else {
      list.push(record);
    }

    saveLocalDb(db);

    return NextResponse.json({
      ok: true,
      notepad: record,
      userId: record.userId,
      content: record.content,
      notes: record.notes,
      updatedAt: record.updatedAt,
    });
  } catch (error) {
    console.error("Failed to save personal notepad:", error);
    return NextResponse.json({ error: "Failed to save personal notepad" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return handleUpsert(req);
}

export async function PUT(req: NextRequest) {
  return handleUpsert(req);
}

export async function PATCH(req: NextRequest) {
  return handleUpsert(req);
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const body = await req.json().catch(() => ({}));
    const check = resolveTargetUser(req, body.userId, body.actorId);
    if (check.forbidden) {
      return NextResponse.json(
        { error: "Forbidden: Cannot delete another user's private notepad." },
        { status: 403 }
      );
    }

    let userId = check.userId;
    if (!userId) {
      const resolved = await resolveRequestActor(req);
      userId = resolved.actor?.id ?? null;
    }
    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    const noteId = searchParams.get("noteId") || body.noteId || body.id;
    const db = loadLocalDb();
    if (!Array.isArray(db.personal_notes)) {
      db.personal_notes = [];
    }

    const list = db.personal_notes as UserNotepadRecord[];
    const idx = list.findIndex((n) => n.userId === userId);
    const now = new Date().toISOString();

    if (idx >= 0) {
      if (noteId) {
        list[idx].notes = (list[idx].notes || []).filter((n) => n.id !== noteId);
        list[idx].updatedAt = now;
      } else {
        list[idx].content = "";
        list[idx].notes = [];
        list[idx].updatedAt = now;
      }
      saveLocalDb(db);
    }

    const record = idx >= 0 ? list[idx] : { userId, content: "", notes: [], updatedAt: now };
    return NextResponse.json({
      ok: true,
      notepad: record,
      content: record.content,
      notes: record.notes,
      updatedAt: record.updatedAt,
    });
  } catch (error) {
    console.error("Failed to delete personal notepad item:", error);
    return NextResponse.json({ error: "Failed to delete notepad item" }, { status: 500 });
  }
}
