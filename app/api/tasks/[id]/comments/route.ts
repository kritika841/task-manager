import { NextResponse } from "next/server";
import {
  getCommentsForTask,
  addCommentToTask,
  deleteCommentFromTask,
  toggleCommentReaction,
} from "@/lib/comments-store";
import { supabaseAdmin } from "@/lib/supabase";
import { dispatchWebhookEvent } from "@/lib/webhooks-store";
import { canReviewTasks, resolveRequestActor } from "@/lib/auth-server";
import { canAccessTaskById } from "@/lib/task-access";

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { actor } = await resolveRequestActor(req);
    if (!actor) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    if (!(await canAccessTaskById(actor, id))) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    if (!id) {
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
    }

    const comments = await getCommentsForTask(id);
    return NextResponse.json({ ok: true, comments });
  } catch (error: any) {
    console.error("GET comments error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch comments" },
      { status: 500 }
    );
  }
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { actor } = await resolveRequestActor(req);
    if (!actor) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    if (!(await canAccessTaskById(actor, id))) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    const body = await req.json();
    const { content, mentions } = body;
    const userId = actor.id;

    if (!id || !content?.trim()) {
      return NextResponse.json(
        { error: "Task ID and comment content are required" },
        { status: 400 }
      );
    }

    // Get commenter details
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

    // Deliver targeted notifications for both regular daily targets AND AdFlow creative tasks (ad-*)
    try {
      let taskTitle = "Task";
      let primaryOwnerIds: string[] = [];
      let realAdId: string | null = null;

      if (id.startsWith("ad-")) {
        realAdId = id.replace("ad-", "");
        const { data: adData } = await supabaseAdmin
          .from("ads")
          .select("id, name, editor_id, creator_id")
          .eq("id", realAdId)
          .maybeSingle();

        if (adData) {
          taskTitle = adData.name || `Ad Creative ${realAdId}`;
          if (adData.editor_id) primaryOwnerIds.push(adData.editor_id);
          if (adData.creator_id && !primaryOwnerIds.includes(adData.creator_id)) {
            primaryOwnerIds.push(adData.creator_id);
          }
        }
      } else {
        const { data: taskData } = await supabaseAdmin
          .from("daily_team_targets")
          .select("task_name, user_id, assigned_by")
          .eq("id", id)
          .maybeSingle();

        if (taskData) {
          taskTitle = taskData.task_name || "Daily Target";
          if (taskData.user_id) primaryOwnerIds.push(taskData.user_id);
        }
      }

      const notifiedUserIds = new Set<string>([userId]);

      // 1. Notify primary task owner(s) if commenter is someone else
      for (const ownerId of primaryOwnerIds) {
        if (ownerId && !notifiedUserIds.has(ownerId)) {
          notifiedUserIds.add(ownerId);
          await supabaseAdmin.from("notifications").insert({
            user_id: ownerId,
            title: `New Comment on ${taskTitle}`,
            body: `${authorName}: "${content.trim().slice(0, 100)}"`,
            ad_id: realAdId,
          });
        }
      }

      // 2. Notify mentioned users (both explicit mention IDs and @Name matches in content)
      const mentionIds = new Set<string>(Array.isArray(mentions) ? mentions : []);
      if (content.includes("@")) {
        const { data: allProfiles } = await supabaseAdmin
          .from("profiles")
          .select("id, name, email")
          .eq("active", true)
          .is("deleted_at", null);

        if (allProfiles) {
          const lowerContent = content.toLowerCase();
          for (const p of allProfiles) {
            const firstName = (p.name || "").split(" ")[0]?.toLowerCase();
            const fullName = (p.name || "").toLowerCase();
            if (
              (fullName && lowerContent.includes(`@${fullName}`)) ||
              (firstName && lowerContent.includes(`@${firstName}`))
            ) {
              mentionIds.add(p.id);
            }
          }
        }
      }

      for (const mId of mentionIds) {
        if (mId && !notifiedUserIds.has(mId)) {
          notifiedUserIds.add(mId);
          await supabaseAdmin.from("notifications").insert({
            user_id: mId,
            title: `${authorName} mentioned you in ${taskTitle}`,
            body: content.trim().slice(0, 120),
            ad_id: realAdId,
          });
        }
      }

      // Dispatch outbound webhook non-blocking
      dispatchWebhookEvent("comment.created", {
        taskId: id,
        taskTitle,
        commentId: newComment.id,
        authorId: userId,
        authorName,
        content: newComment.content,
        mentions: Array.from(mentionIds),
      }).catch(() => {});
    } catch (notifErr) {
      console.warn("Could not dispatch comment notifications:", notifErr);
    }

    return NextResponse.json({ ok: true, comment: newComment });
  } catch (error: any) {
    console.error("POST comment error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to post comment" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { actor } = await resolveRequestActor(req);
    if (!actor) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    if (!(await canAccessTaskById(actor, id))) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    const body = await req.json();
    const { commentId, emoji } = body;

    if (!id || !commentId || !emoji) {
      return NextResponse.json(
        { error: "Task ID, commentId, and emoji are required" },
        { status: 400 }
      );
    }

    const updated = await toggleCommentReaction(id, commentId, actor.id, emoji);
    if (!updated) {
      return NextResponse.json({ error: "Comment not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true, comment: updated });
  } catch (error: any) {
    console.error("PATCH comment reaction error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to toggle reaction" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { actor } = await resolveRequestActor(req);
    if (!actor) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    if (!(await canAccessTaskById(actor, id))) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    const { searchParams } = new URL(req.url);
    const commentId = searchParams.get("commentId");

    if (!id || !commentId) {
      return NextResponse.json({ error: "Missing id or commentId" }, { status: 400 });
    }

    if (!canReviewTasks(actor.role)) {
      const comments = await getCommentsForTask(id);
      if (!comments.some((comment) => comment.id === commentId && comment.userId === actor.id)) {
        return NextResponse.json({ error: "Comment not found" }, { status: 404 });
      }
    }

    const success = await deleteCommentFromTask(id, commentId);
    return NextResponse.json({ ok: success });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
