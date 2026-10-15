import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { NotificationItem } from "@/lib/types";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ notifications: [], unreadCount: 0 });
    }

    const { data: rows, error } = await supabaseAdmin
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(60);

    if (error) {
      console.error("GET /api/notifications error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const notifications: NotificationItem[] = (rows || []).map((r) => ({
      id: r.id,
      userId: r.user_id,
      title: r.title || "Notification",
      body: r.body || "",
      readAt: r.read_at,
      createdAt: r.created_at,
      adId: r.ad_id,
    }));

    const unreadCount = notifications.filter((n) => !n.readAt).length;

    return NextResponse.json({ notifications, unreadCount });
  } catch (error: any) {
    console.error("GET /api/notifications error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, userId, markAllRead, action } = body;

    if (markAllRead && userId) {
      const { error } = await supabaseAdmin
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", userId)
        .is("read_at", null);

      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (action === "delete" && id) {
      const { error } = await supabaseAdmin
        .from("notifications")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (id) {
      const { error } = await supabaseAdmin
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", id);

      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  } catch (error: any) {
    console.error("PATCH /api/notifications error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, title, body: content } = body;

    if (!userId || !title) {
      return NextResponse.json({ error: "userId and title are required" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("notifications")
      .insert({
        user_id: userId,
        title,
        body: content || "",
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ ok: true, notification: data });
  } catch (error: any) {
    console.error("POST /api/notifications error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
