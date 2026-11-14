import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { TaskComment } from "./types";
import { supabaseAdmin } from "./supabase";

const DATA_DIR = path.join(process.cwd(), "data");
const COMMENTS_FILE = path.join(DATA_DIR, "task-comments.json");
const DELETED_IDS_KEY = "__deleted_ids__";

let memoryCache: Record<string, any> | null = null;

async function ensureDataFile(): Promise<Record<string, any>> {
  if (memoryCache) return memoryCache;
  try {
    await mkdir(DATA_DIR, { recursive: true });
    const content = await readFile(COMMENTS_FILE, "utf-8");
    memoryCache = JSON.parse(content);
    if (!memoryCache || typeof memoryCache !== "object") {
      memoryCache = {};
    }
    return memoryCache!;
  } catch {
    memoryCache = {};
    try {
      await writeFile(COMMENTS_FILE, JSON.stringify({}, null, 2), "utf-8");
    } catch {}
    return memoryCache!;
  }
}

async function saveCommentsFile(data: Record<string, any>) {
  memoryCache = data;
  try {
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(COMMENTS_FILE, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving comments file:", err);
  }
}

function getDeletedSet(all: Record<string, any>): Set<string> {
  const arr = Array.isArray(all[DELETED_IDS_KEY]) ? all[DELETED_IDS_KEY] : [];
  return new Set<string>(arr);
}

export async function getCommentsForTask(taskId: string): Promise<TaskComment[]> {
  const all = await ensureDataFile();
  const deletedSet = getDeletedSet(all);
  const fileComments: TaskComment[] = (Array.isArray(all[taskId]) ? all[taskId] : []).filter(
    (c: TaskComment) => !deletedSet.has(c.id)
  );

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
      const commentMap = new Map<string, TaskComment>();
      fileComments.forEach((c) => commentMap.set(c.id, c));

      for (const r of rows) {
        const canonicalId = r.metadata?.commentId || r.id;
        if (deletedSet.has(canonicalId) || deletedSet.has(r.id)) continue;

        const existing = commentMap.get(canonicalId);
        const dbComment: TaskComment = {
          id: canonicalId,
          taskId: r.target_id,
          userId: r.actor_id,
          userName: r.metadata?.authorName || existing?.userName || "Team Member",
          userAvatar: r.metadata?.authorAvatar || existing?.userAvatar,
          content: r.metadata?.content || existing?.content || "",
          mentions: r.metadata?.mentions || existing?.mentions || [],
          reactions: existing?.reactions && Object.keys(existing.reactions).length > 0
            ? existing.reactions
            : r.metadata?.reactions || {},
          createdAt: existing?.createdAt || r.created_at,
        };
        commentMap.set(canonicalId, dbComment);
      }

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
  const deletedSet = getDeletedSet(all);
  const result: Record<string, TaskComment[]> = {};

  for (const [key, val] of Object.entries(all)) {
    if (key === DELETED_IDS_KEY || !Array.isArray(val)) continue;
    result[key] = val.filter((c: TaskComment) => c && c.id && !deletedSet.has(c.id));
  }

  // Also pull task_comment actions from audit_logs
  try {
    const { data: rows } = await supabaseAdmin
      .from("audit_logs")
      .select("*")
      .eq("target_type", "daily_team_target")
      .eq("action", "task_comment")
      .order("created_at", { ascending: true })
      .limit(500);

    if (rows && rows.length > 0) {
      let dirty = false;
      for (const r of rows) {
        const taskId = r.target_id;
        if (!taskId) continue;
        const canonicalId = r.metadata?.commentId || r.id;
        if (deletedSet.has(canonicalId) || deletedSet.has(r.id)) continue;

        if (!result[taskId]) result[taskId] = [];
        // Remove any legacy duplicate that used r.id when r.metadata.commentId also exists
        if (r.metadata?.commentId && r.id !== r.metadata.commentId) {
          const beforeLen = result[taskId].length;
          result[taskId] = result[taskId].filter((c) => c.id !== r.id);
          if (result[taskId].length !== beforeLen) dirty = true;
        }

        const existing = result[taskId].find((c) => c.id === canonicalId);
        if (!existing) {
          const comment: TaskComment = {
            id: canonicalId,
            taskId,
            userId: r.actor_id,
            userName: r.metadata?.authorName || "Team Member",
            userAvatar: r.metadata?.authorAvatar,
            content: r.metadata?.content || "",
            mentions: r.metadata?.mentions || [],
            reactions: r.metadata?.reactions || {},
            createdAt: r.created_at,
          };
          result[taskId].push(comment);
          all[taskId] = result[taskId];
          dirty = true;
        } else if (r.metadata?.reactions && (!existing.reactions || Object.keys(existing.reactions).length === 0)) {
          existing.reactions = r.metadata.reactions;
          all[taskId] = result[taskId];
          dirty = true;
        }
      }
      if (dirty) {
        await saveCommentsFile(all);
      }
    }
  } catch (err) {
    console.warn("getAllCommentsMap audit_log fetch warning:", err);
  }

  return result;
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
  if (!Array.isArray(all[taskId])) all[taskId] = [];

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
        reactions: {},
        authorName: comment.userName,
        authorAvatar: comment.userAvatar,
      },
    });
  } catch (err) {
    console.warn("Could not insert comment to audit_logs:", err);
  }

  return newComment;
}

export async function toggleCommentReaction(
  taskId: string,
  commentId: string,
  userId: string,
  emoji: string
): Promise<TaskComment | null> {
  const all = await ensureDataFile();
  const list: TaskComment[] = Array.isArray(all[taskId]) ? all[taskId] : [];
  const target = list.find((c) => c.id === commentId);
  if (!target) return null;

  const reactions: Record<string, string[]> = { ...(target.reactions || {}) };
  const currentUsers = Array.isArray(reactions[emoji]) ? [...reactions[emoji]] : [];

  if (currentUsers.includes(userId)) {
    const filtered = currentUsers.filter((id) => id !== userId);
    if (filtered.length === 0) {
      delete reactions[emoji];
    } else {
      reactions[emoji] = filtered;
    }
  } else {
    reactions[emoji] = [...currentUsers, userId];
  }

  target.reactions = reactions;
  all[taskId] = list;
  await saveCommentsFile(all);

  // Also sync reaction update to Supabase audit_logs
  try {
    const { data: rows } = await supabaseAdmin
      .from("audit_logs")
      .select("id, metadata")
      .eq("target_type", "daily_team_target")
      .eq("target_id", taskId)
      .eq("action", "task_comment");

    if (rows && rows.length > 0) {
      const match = rows.find(
        (r) => r.id === commentId || r.metadata?.commentId === commentId
      );
      if (match) {
        await supabaseAdmin
          .from("audit_logs")
          .update({
            metadata: {
              ...(match.metadata || {}),
              reactions,
            },
          })
          .eq("id", match.id);
      }
    }
  } catch (err) {
    console.warn("Could not sync comment reaction to audit_logs:", err);
  }

  return target;
}

export async function deleteCommentFromTask(
  taskId: string,
  commentId: string
): Promise<boolean> {
  const all = await ensureDataFile();
  if (Array.isArray(all[taskId])) {
    all[taskId] = all[taskId].filter((c: TaskComment) => c.id !== commentId);
  }

  const deletedSet = getDeletedSet(all);
  deletedSet.add(commentId);
  all[DELETED_IDS_KEY] = Array.from(deletedSet);
  await saveCommentsFile(all);

  // Also remove from Supabase audit_logs so it never resurrects on reload
  try {
    const { data: rows } = await supabaseAdmin
      .from("audit_logs")
      .select("id, metadata")
      .eq("target_type", "daily_team_target")
      .eq("target_id", taskId)
      .eq("action", "task_comment");

    if (rows && rows.length > 0) {
      const idsToDelete = rows
        .filter((r) => r.id === commentId || r.metadata?.commentId === commentId)
        .map((r) => r.id);

      if (idsToDelete.length > 0) {
        await supabaseAdmin.from("audit_logs").delete().in("id", idsToDelete);
      }
    }
  } catch (err) {
    console.warn("Could not delete comment from audit_logs:", err);
  }

  return true;
}
