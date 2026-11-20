import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ADFLOW_SUPABASE_SERVICE_KEY } from "@/lib/supabase";
import {
  getProfilesAndDb,
  getTodayAttendanceRecordForUser,
  recordAttendanceAction,
  syncAttendanceFromSupabase,
} from "@/lib/attendance-server";

function isAuthorizedAdflowRequest(req: NextRequest): boolean {
  const expected = process.env.SUPABASE_SERVICE_ROLE_KEY || ADFLOW_SUPABASE_SERVICE_KEY;
  if (!expected) return false;

  const headerKey =
    req.headers.get("x-adflow-service-key") ||
    (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();

  if (!headerKey) return false;
  const a = Buffer.from(headerKey, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  try {
    if (!isAuthorizedAdflowRequest(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = new URL(req.url).searchParams.get("userId")?.trim();
    if (!userId) {
      return NextResponse.json({ error: "userId query parameter is required" }, { status: 400 });
    }

    const { db } = await getProfilesAndDb();
    const records = await syncAttendanceFromSupabase(db, { userId });
    const { today, record } = getTodayAttendanceRecordForUser(records, userId);

    return NextResponse.json(
      { ok: true, today, record },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error: any) {
    console.error("GET /api/adflow/attendance error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to fetch attendance" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    if (!isAuthorizedAdflowRequest(req)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "").trim().toLowerCase();
    const userId = String(body.userId || "").trim();
    const skipSupabasePublish = Boolean(body.skipSupabasePublish);

    if (!userId) {
      return NextResponse.json({ error: "userId is required" }, { status: 400 });
    }

    if (action !== "checkin" && action !== "checkout") {
      return NextResponse.json(
        { error: "Invalid action. Expected checkin or checkout." },
        { status: 400 }
      );
    }

    const { db, profiles } = await getProfilesAndDb();
    const result = await recordAttendanceAction({
      db,
      profiles,
      action,
      targetUserId: userId,
      actorId: userId,
      source: "adflow",
      skipSupabasePublish,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }

    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error: any) {
    console.error("POST /api/adflow/attendance error:", error);
    return NextResponse.json(
      { error: error?.message || "Failed to sync attendance" },
      { status: 500 }
    );
  }
}
