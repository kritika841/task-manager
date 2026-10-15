import { NextResponse } from "next/server";
import { getCommentsForTask, addCommentToTask, deleteCommentFromTask } from "@/lib/comments-store";
import { supabaseAdmin } from "@/lib/supabase";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
    }

    const comments = await getCommentsForTask(id);
    return NextResponse.json({ ok: true, comments });
  } catch (error: any) {
    console.error("GET comments error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch comments" }, { status: 500 });
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { userId, content, mentions } = body;

    if (!id || !userId || !content?.trim()) {
      return NextResponse.json(
        { error: "Task ID, user ID, and comment content are required" },
        { status: 400 }
      );
    }

    // Get user details
    let authorName = "Team Member";
    let authorAvatar: string | undefined;
    try {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("name, email")
        .eq("id", userId)
        .single();
      if (profile) {
        authorName = profile.name || profile.email?.split("@")[0] || "Team Member";
      }
    } catch {}

    const newComment = await addCommentToTask(id, {
      userId,
      userName: authorName,
      userAvatar: authorAvatar,
      content: content.trim(),
      mentions: mentions || [],
    });

    // Check for mentions or target task assignee to deliver targeted notifications
    try {
      const { data: taskData } = await supabaseAdmin
        .from("daily_team_targets")
        .select("task_name, user_id, assigned_by")
        .eq("id", id)
        .single();

      if (taskData) {
        // Notify task assignee if commenter is someone else
        if (taskData.user_id && taskData.user_id !== userId) {
          await supabaseAdmin.from("notifications").insert({
            user_id: taskData.user_id,
            title: `New Comment on ${taskData.task_name}`,
            body: `${authorName}: "${content.slice(0, 100)}"`,
          });
        }

        // Notify mentioned users
        if (Array.isArray(mentions) && mentions.length > 0) {
          const { data: mentionedUsers } = await supabaseAdmin
            .from("profiles")
            .select("id, name, email")
            .in("id", mentions);

          if (mentionedUsers) {
            for (const mu of mentionedUsers) {
              if (mu.id !== userId && mu.id !== taskData.user_id) {
                await supabaseAdmin.from("notifications").insert({
                  user_id: mu.id,
                  title: `${authorName} mentioned you in ${taskData.task_name}`,
                  body: content.slice(0, 120),
                });
              }
            }
          }
        }
      }
    } catch (notifErr) {
      console.warn("Could not dispatch comment notifications:", notifErr);
    }

    return NextResponse.json({ ok: true, comment: newComment });
  } catch (error: any) {
    console.error("POST comment error:", error);
    return NextResponse.json({ error: error.message || "Failed to post comment" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const commentId = searchParams.get("commentId");

    if (!id || !commentId) {
      return NextResponse.json({ error: "Missing id or commentId" }, { status: 400 });
    }

    const success = await deleteCommentFromTask(id, commentId);
    return NextResponse.json({ ok: success });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
