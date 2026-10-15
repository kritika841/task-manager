import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { TaskComment } from "./types";
import { supabaseAdmin } from "./supabase";

const DATA_DIR = path.join(process.cwd(), "data");
const COMMENTS_FILE = path.join(DATA_DIR, "task-comments.json");

let memoryCache: Record<string, TaskComment[]> | null = null;

async function ensureDataFile(): Promise<Record<string, TaskComment[]>> {
  if (memoryCache) return memoryCache;
  try {
    await mkdir(DATA_DIR, { recursive: true });
    const content = await readFile(COMMENTS_FILE, "utf-8");
    memoryCache = JSON.parse(content);
    return memoryCache!;
  } catch {
    memoryCache = {};
    try {
      await writeFile(COMMENTS_FILE, JSON.stringify({}, null, 2), "utf-8");
    } catch {}
    return memoryCache!;
  }
}

async function saveCommentsFile(data: Record<string, TaskComment[]>) {
  memoryCache = data;
  try {
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(COMMENTS_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving comments file:", err);
  }
}

export async function getCommentsForTask(taskId: string): Promise<TaskComment[]> {
  const all = await ensureDataFile();
  const fileComments = all[taskId] || [];

  // Also query Supabase audit_logs for any comments logged from other instances
  try {
    const { data: rows } = await supabaseAdmin
      .from("audit_logs")
      .select("*")
      .eq("target_type", "daily_team_target")
      .eq("target_id", taskId)
      .eq("action", "task_comment")
      .order("created_at", { ascending: true });

    if (rows && rows.length > 0) {
      const dbComments: TaskComment[] = rows.map((r) => ({
        id: r.id,
        taskId: r.target_id,
        userId: r.actor_id,
        userName: r.metadata?.authorName || "Team Member",
        userAvatar: r.metadata?.authorAvatar,
        content: r.metadata?.content || "",
        mentions: r.metadata?.mentions || [],
        reactions: r.metadata?.reactions || {},
        createdAt: r.created_at,
      }));

      // Merge and deduplicate by id
      const commentMap = new Map<string, TaskComment>();
      fileComments.forEach((c) => commentMap.set(c.id, c));
      dbComments.forEach((c) => commentMap.set(c.id, c));
      const merged = Array.from(commentMap.values()).sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
      );
      all[taskId] = merged;
      await saveCommentsFile(all);
      return merged;
    }
  } catch (e) {
    console.warn("Could not fetch db comments:", e);
  }

  return fileComments;
}

export async function getAllCommentsMap(): Promise<Record<string, TaskComment[]>> {
  const all = await ensureDataFile();

  // Also pull all task_comment actions from audit_logs
  try {
    const { data: rows } = await supabaseAdmin
      .from("audit_logs")
      .select("*")
      .eq("target_type", "daily_team_target")
      .eq("action", "task_comment")
      .order("created_at", { ascending: true })
      .limit(500);

    if (rows && rows.length > 0) {
      for (const r of rows) {
        const taskId = r.target_id;
        if (!taskId) continue;
        const comment: TaskComment = {
          id: r.id,
          taskId,
          userId: r.actor_id,
          userName: r.metadata?.authorName || "Team Member",
          userAvatar: r.metadata?.authorAvatar,
          content: r.metadata?.content || "",
          mentions: r.metadata?.mentions || [],
          reactions: r.metadata?.reactions || {},
          createdAt: r.created_at,
        };

        if (!all[taskId]) all[taskId] = [];
        if (!all[taskId].some((c) => c.id === comment.id)) {
          all[taskId].push(comment);
        }
      }
    }
  } catch (err) {
    console.warn("getAllCommentsMap audit_log fetch warning:", err);
  }

  return all;
}

export async function addCommentToTask(
  taskId: string,
  comment: {
    userId: string;
    userName?: string;
    userAvatar?: string;
    content: string;
    mentions?: string[];
  }
): Promise<TaskComment> {
  const all = await ensureDataFile();
  if (!all[taskId]) all[taskId] = [];

  const commentId = `cm_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const newComment: TaskComment = {
    id: commentId,
    taskId,
    userId: comment.userId,
    userName: comment.userName || "Team Member",
    userAvatar: comment.userAvatar,
    content: comment.content,
    mentions: comment.mentions || [],
    reactions: {},
    createdAt: new Date().toISOString(),
  };

  all[taskId].push(newComment);
  await saveCommentsFile(all);

  // Persist to Supabase audit_logs for cross-instance and realtime replication
  try {
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: comment.userId,
      action: "task_comment",
      target_type: "daily_team_target",
      target_id: taskId,
      metadata: {
        commentId,
        content: comment.content,
        mentions: comment.mentions || [],
        authorName: comment.userName,
        authorAvatar: comment.userAvatar,
      },
    });
  } catch (err) {
    console.warn("Could not insert comment to audit_logs:", err);
  }

  return newComment;
}

export async function deleteCommentFromTask(taskId: string, commentId: string): Promise<boolean> {
  const all = await ensureDataFile();
  if (!all[taskId]) return false;

  all[taskId] = all[taskId].filter((c) => c.id !== commentId);
  await saveCommentsFile(all);
  return true;
}
