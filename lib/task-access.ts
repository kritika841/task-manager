import { canReviewTasks } from "./auth-server";
import { loadLocalDb } from "./local-supabase-fallback";
import { supabaseAdmin } from "./supabase";
import type { Role } from "./types";

type TaskActor = { id: string; role: Role };
type CreativeAssignment = {
  production_stage?: string | null;
  creator_id?: string | null;
  editor_id?: string | null;
};

export function canAccessTask(
  actor: TaskActor,
  assigneeId?: string | null
): boolean {
  return canReviewTasks(actor.role) || (Boolean(assigneeId) && actor.id === assigneeId);
}

export function isCreatorStage(stage?: string | null): boolean {
  return [
    "script_writing",
    "ready_to_shoot",
    "ready_for_shoot",
    "shoot_complete",
    "shooting",
    "creator_changes_requested",
    "creator_review",
  ].includes(stage?.toLowerCase() || "");
}

export function getCreativeAssignee(
  ad: CreativeAssignment,
  override?: { assigneeId?: string; productionStage?: string }
): string {
  const creatorStage = isCreatorStage(ad.production_stage || override?.productionStage);
  return override?.assigneeId || (creatorStage ? ad.creator_id : ad.editor_id) || "";
}

export function resolveMergedTaskAssignee(
  ad: CreativeAssignment | null | undefined,
  taskUserId?: string | null,
  fallbackStage?: string | null
): string {
  if (!ad) return taskUserId || "";
  const effectiveStage = ad.production_stage || fallbackStage;
  return (
    getCreativeAssignee(ad, { productionStage: effectiveStage || undefined }) ||
    (isCreatorStage(effectiveStage) ? taskUserId || "" : "")
  );
}

export function readTaskNotesMetadata(raw?: string | null): Record<string, any> | null {
  if (typeof raw !== "string" || !raw.trimStart().startsWith("{")) return null;
  try {
    const notes = JSON.parse(raw);
    return notes?.__meta__ === true ? notes : null;
  } catch {
    return null;
  }
}

export async function canAccessStandaloneCreative(actor: TaskActor, adId: string): Promise<boolean> {
  if (canReviewTasks(actor.role)) return true;

  const { data: ad } = await supabaseAdmin
    .from("ads")
    .select("id, name, creator_id, editor_id, production_stage")
    .eq("id", adId)
    .is("deleted_at", null)
    .maybeSingle();
  if (!ad) return false;

  const db = loadLocalDb();
  const name = ad.name?.trim().toUpperCase();
  // A creative merged into a dashboard task is accessed through that task's assignment.
  const hasLinkedTask = db.daily_team_targets.some((target) => {
    const notes = readTaskNotesMetadata(target.notes);
    return notes?.adId === adId ||
      Boolean(name && typeof notes?.creativeName === "string" && notes.creativeName.trim().toUpperCase() === name);
  });
  if (hasLinkedTask) return false;
  return canAccessTask(
    actor,
    getCreativeAssignee(ad, db.ad_overrides[adId] || db.ad_overrides[`ad-${adId}`])
  );
}

export async function canAccessTaskById(actor: TaskActor, taskId: string): Promise<boolean> {
  if (canReviewTasks(actor.role)) return true;
  if (taskId.startsWith("ad-")) return canAccessStandaloneCreative(actor, taskId.slice(3));

  const { data: task } = await supabaseAdmin
    .from("daily_team_targets")
    .select("user_id, notes")
    .eq("id", taskId)
    .maybeSingle();
  if (!task) return false;
  const notes = readTaskNotesMetadata(task.notes);
  if (notes?.adId) {
    const { data: ad } = await supabaseAdmin
      .from("ads")
      .select("creator_id, editor_id, production_stage")
      .eq("id", notes.adId)
      .maybeSingle();
    if (ad) {
      return canAccessTask(actor, resolveMergedTaskAssignee(ad, task.user_id, notes.productionStage));
    }
  }
  return canAccessTask(actor, task.user_id);
}
