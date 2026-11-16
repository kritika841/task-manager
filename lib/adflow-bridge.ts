import { ADFLOW_SUPABASE_URL, ADFLOW_SUPABASE_SERVICE_KEY } from "@/lib/supabase";
import { loadLocalDb, saveLocalDb } from "@/lib/local-supabase-fallback";
import { TaskStatus, StageHistoryEntry } from "@/lib/types";

export const ADFLOW_PRODUCTION_STAGES = [
  {
    id: "script_writing",
    label: "Script in progress",
    shortLabel: "Script",
    taskStatus: "backlog" as TaskStatus,
    color: "#64748b",
  },
  {
    id: "ready_to_shoot",
    label: "Ready to shoot",
    shortLabel: "Shoot ready",
    taskStatus: "todo" as TaskStatus,
    color: "#0ea5e9",
  },
  {
    id: "ready_for_edit",
    label: "Ready for editing",
    shortLabel: "Handoff",
    taskStatus: "todo" as TaskStatus,
    color: "#6366f1",
  },
  {
    id: "shoot_complete",
    label: "Shoot complete",
    shortLabel: "Shot",
    taskStatus: "in_progress" as TaskStatus,
    color: "#3b82f6",
  },
  {
    id: "editing",
    label: "Editing",
    shortLabel: "Editing",
    taskStatus: "in_progress" as TaskStatus,
    color: "#2563eb",
  },
  {
    id: "creator_changes_requested",
    label: "Changes requested to creator",
    shortLabel: "Changes: Creator",
    taskStatus: "in_progress" as TaskStatus,
    color: "#f59e0b",
  },
  {
    id: "changes_requested",
    label: "Changes requested to editor",
    shortLabel: "Changes: Editor",
    taskStatus: "in_progress" as TaskStatus,
    color: "#ea580c",
  },
  {
    id: "creator_review",
    label: "Creator review",
    shortLabel: "Creator review",
    taskStatus: "in_review" as TaskStatus,
    color: "#d97706",
  },
  {
    id: "final_review",
    label: "Final review",
    shortLabel: "Final review",
    taskStatus: "in_review" as TaskStatus,
    color: "#8b5cf6",
  },
  {
    id: "approved",
    label: "Approved",
    shortLabel: "Approved",
    taskStatus: "completed" as TaskStatus,
    color: "#10b981",
  },
] as const;

export type AdFlowProductionStage = (typeof ADFLOW_PRODUCTION_STAGES)[number]["id"];

export const ADFLOW_STATUSES_BY_COLUMN: Record<
  TaskStatus,
  Array<(typeof ADFLOW_PRODUCTION_STAGES)[number]>
> = {
  backlog: ADFLOW_PRODUCTION_STAGES.filter((s) => s.taskStatus === "backlog"),
  todo: ADFLOW_PRODUCTION_STAGES.filter((s) => s.taskStatus === "todo"),
  in_progress: ADFLOW_PRODUCTION_STAGES.filter((s) => s.taskStatus === "in_progress"),
  in_review: ADFLOW_PRODUCTION_STAGES.filter((s) => s.taskStatus === "in_review"),
  completed: ADFLOW_PRODUCTION_STAGES.filter((s) => s.taskStatus === "completed"),
};

export function getAdFlowHeaders(): Record<string, string> {
  return {
    apikey: ADFLOW_SUPABASE_SERVICE_KEY,
    Authorization: `Bearer ${ADFLOW_SUPABASE_SERVICE_KEY}`,
    "Content-Type": "application/json",
  };
}

export function deriveCreatorPrefix(name: string): string {
  const clean = (name || "").replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase();
  return clean.length === 3 ? clean : (clean + "ADX").slice(0, 3);
}

export function isCreativeIdFormat(value: string | undefined | null): boolean {
  if (!value) return false;
  return /^[A-Z]{3}\d{4}$/i.test(value.trim());
}

export function getStageLabel(stageId: string | undefined | null): string {
  if (!stageId) return "Script in progress";
  const found = ADFLOW_PRODUCTION_STAGES.find((s) => s.id === stageId);
  return found ? found.label : stageId.replace(/_/g, " ");
}

export function getStageShortLabel(stageId: string | undefined | null): string {
  if (!stageId) return "Script";
  const found = ADFLOW_PRODUCTION_STAGES.find((s) => s.id === stageId);
  return found ? found.shortLabel : stageId.replace(/_/g, " ");
}

export async function revalidateAdFlowCache(adId?: string) {
  const endpoints = [
    "http://127.0.0.1:3000/api/ads/revalidate",
    "https://ads.satmi.in/api/ads/revalidate",
  ];
  for (const url of endpoints) {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 1500);
      await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ adId }),
        signal: controller.signal,
      });
      clearTimeout(t);
    } catch {}
  }
}

/**
 * Queries both AdFlow's live `ads` table and Task Manager's `daily_team_targets`
 * to find all existing `PREFIX####` creative codes and generate `count` new sequential Creative IDs.
 */
export async function generateNextCreativeIds(
  creatorId: string,
  count: number = 1
): Promise<{ prefix: string; creativeIds: string[]; maxExisting: number }> {
  const db = loadLocalDb();
  const profile = db.profiles.find((p) => p.id === creatorId);
  let creatorName = profile?.name || "";

  if (!creatorName) {
    try {
      const res = await fetch(
        `${ADFLOW_SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(creatorId)}&select=name`,
        { headers: getAdFlowHeaders() }
      );
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows[0]?.name) {
          creatorName = rows[0].name;
        }
      }
    } catch {}
  }

  const prefix = deriveCreatorPrefix(creatorName);
  let maxNum = 0;

  const recordNameNumber = (candidate: string | undefined | null) => {
    if (!candidate) return;
    const upper = candidate.trim().toUpperCase();
    if (!upper.startsWith(prefix)) return;
    const suffix = upper.slice(prefix.length);
    const num = parseInt(suffix, 10);
    if (!isNaN(num) && String(num).padStart(4, "0") === suffix) {
      if (num > maxNum) maxNum = num;
    }
  };

  // 1. Check upstream AdFlow `ads` table for existing PREFIX#### names
  try {
    const res = await fetch(
      `${ADFLOW_SUPABASE_URL}/rest/v1/ads?name=ilike.${encodeURIComponent(prefix)}*&select=name`,
      { headers: getAdFlowHeaders() }
    );
    if (res.ok) {
      const ads = await res.json();
      if (Array.isArray(ads)) {
        for (const ad of ads) {
          recordNameNumber(ad.name);
        }
      }
    }
  } catch {}

  // 2. Check local fallback `ads`
  for (const ad of db.ads || []) {
    recordNameNumber(ad.name);
  }

  // 3. Check Task Manager `daily_team_targets` for already-reserved Creative IDs
  for (const target of db.daily_team_targets || []) {
    if (target.notes) {
      try {
        if (String(target.notes).startsWith("{")) {
          const parsed = JSON.parse(target.notes);
          if (parsed.isArchived) continue;
          recordNameNumber(parsed.creativeName);
        }
      } catch {}
    }
    const match = String(target.task_name || "").match(/^([A-Z]{3}\d{4})\b/i);
    if (match) {
      recordNameNumber(match[1]);
    }
  }

  const safeCount = Math.max(1, count);
  const creativeIds: string[] = [];
  for (let i = 1; i <= safeCount; i++) {
    creativeIds.push(`${prefix}${String(maxNum + i).padStart(4, "0")}`);
  }

  return {
    prefix,
    creativeIds,
    maxExisting: maxNum,
  };
}

export interface PendingCreativeTaskInfo {
  taskId: string;
  creativeId: string;
  title: string;
  dueDate: string;
  status: string;
  description: string;
  isLinkedInAdFlow: boolean;
  adId?: string;
}

/**
 * Returns pending Creative IDs generated in Task Manager for a given creator (or sharing the same 3-letter prefix)
 * so AdFlow automatically fetches and assigns the exact same Creative ID in sequential order.
 */
export async function getPendingCreativeIdsForCreator(creatorId: string): Promise<{
  creatorId: string;
  prefix: string;
  nextCreativeId: string;
  pendingCreativeIds: string[];
  pendingTasks: PendingCreativeTaskInfo[];
  allCreatorTasks: PendingCreativeTaskInfo[];
}> {
  const db = loadLocalDb();
  const profile = db.profiles.find((p) => p.id === creatorId);
  let creatorName = profile?.name || "";

  if (!creatorName) {
    try {
      const res = await fetch(
        `${ADFLOW_SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(creatorId)}&select=name`,
        { headers: getAdFlowHeaders() }
      );
      if (res.ok) {
        const rows = await res.json();
        if (Array.isArray(rows) && rows[0]?.name) {
          creatorName = rows[0].name;
        }
      }
    } catch {}
  }

  const prefix = deriveCreatorPrefix(creatorName);

  // Fetch all existing ads in AdFlow with this prefix
  const existingAdsByName = new Map<string, string>();
  try {
    const res = await fetch(
      `${ADFLOW_SUPABASE_URL}/rest/v1/ads?name=ilike.${encodeURIComponent(prefix)}*&select=id,name,deleted_at`,
      { headers: getAdFlowHeaders() }
    );
    if (res.ok) {
      const ads = await res.json();
      if (Array.isArray(ads)) {
        for (const ad of ads) {
          if (!ad.deleted_at && ad.name) {
            existingAdsByName.set(String(ad.name).trim().toUpperCase(), ad.id);
          }
        }
      }
    }
  } catch {}

  const allCreatorTasks: PendingCreativeTaskInfo[] = [];
  const seenCodes = new Set<string>();

  // Match tasks assigned to this creatorId OR sharing the same 3-letter prefix (e.g. KRI)
  const targets = db.daily_team_targets || [];

  for (const row of targets) {
    let creativeId = "";
    let desc = "";
    let status = "todo";
    let isArchived = false;

    if (row.notes && String(row.notes).startsWith("{")) {
      try {
        const parsed = JSON.parse(row.notes);
        creativeId = parsed.creativeName || "";
        desc = parsed.desc || "";
        status = parsed.statusOverride || "todo";
        isArchived = Boolean(parsed.isArchived);
      } catch {}
    }

    if (isArchived) continue;

    if (!creativeId) {
      const match = String(row.task_name || "").match(/^([A-Z]{3}\d{4})\b/i);
      if (match) creativeId = match[1].toUpperCase();
    }

    if (!creativeId || !isCreativeIdFormat(creativeId)) continue;

    const normalizedCode = creativeId.trim().toUpperCase();
    if (row.user_id !== creatorId && !normalizedCode.startsWith(prefix)) {
      continue;
    }
    if (seenCodes.has(normalizedCode)) continue;
    seenCodes.add(normalizedCode);

    const matchedAdId = existingAdsByName.get(normalizedCode);

    allCreatorTasks.push({
      taskId: row.id,
      creativeId: normalizedCode,
      title: row.task_name,
      dueDate: row.target_date,
      status,
      description: desc,
      isLinkedInAdFlow: Boolean(matchedAdId),
      adId: matchedAdId,
    });
  }

  // Sort by numeric code so KRI0036 -> KRI0037 -> KRI0040 -> KRI0041 -> KRI0042 are strictly in order
  allCreatorTasks.sort((a, b) => a.creativeId.localeCompare(b.creativeId));

  const pendingTasks = allCreatorTasks.filter((t) => !t.isLinkedInAdFlow);
  const pendingCreativeIds = pendingTasks.map((t) => t.creativeId);

  let nextCreativeId = pendingCreativeIds[0] || "";
  if (!nextCreativeId) {
    const generated = await generateNextCreativeIds(creatorId, 1);
    nextCreativeId = generated.creativeIds[0] || `${prefix}0001`;
  }

  return {
    creatorId,
    prefix,
    nextCreativeId,
    pendingCreativeIds,
    pendingTasks,
    allCreatorTasks,
  };
}

export function mapAdFlowStageToTaskStatus(
  stage: string,
  status?: string
): TaskStatus {
  const s = (stage || "").toLowerCase();
  const st = (status || "").toLowerCase();
  if (s === "approved" || st === "approved") return "completed";
  if (s === "creator_review" || s === "final_review" || st === "pending_review")
    return "in_review";
  if (
    s === "editing" ||
    s === "shoot_complete" ||
    s === "changes_requested" ||
    s === "creator_changes_requested"
  ) {
    return "in_progress";
  }
  if (s === "script_writing") {
    return "backlog";
  }
  if (s === "ready_to_shoot" || s === "ready_for_edit") {
    return "todo";
  }
  return "todo";
}

export function mapTaskStatusToDefaultAdFlowStage(
  status: TaskStatus,
  currentStage?: string,
  isRevisionRequested?: boolean,
  revisionTarget?: "creator" | "editor"
): AdFlowProductionStage {
  if (isRevisionRequested) {
    return revisionTarget === "creator"
      ? "creator_changes_requested"
      : "changes_requested";
  }
  if (status === "completed") return "approved";
  if (status === "in_review") {
    if (currentStage === "creator_review" || currentStage === "final_review") {
      return currentStage;
    }
    return "final_review";
  }
  if (status === "in_progress") {
    if (
      currentStage === "shoot_complete" ||
      currentStage === "editing" ||
      currentStage === "creator_changes_requested" ||
      currentStage === "changes_requested"
    ) {
      return currentStage;
    }
    return "editing";
  }
  if (status === "todo") {
    if (currentStage === "ready_to_shoot" || currentStage === "ready_for_edit") {
      return currentStage;
    }
    return "ready_to_shoot";
  }
  return "script_writing";
}

export function legacyAdStatusForStage(stage: string): string {
  if (stage === "creator_review" || stage === "final_review") return "pending_review";
  if (stage === "changes_requested" || stage === "creator_changes_requested")
    return "changes_requested";
  if (stage === "approved") return "approved";
  return "draft";
}

/**
 * Synchronizes any status, stage, approval, or revision update from Task Manager
 * directly into AdFlow's `ads`, `review_actions`, `activity_logs`, and `notifications` tables,
 * and triggers AdFlow cache revalidation so changes reflect in AdFlow immediately.
 */
export async function syncTaskUpdateToAdFlow(params: {
  adId?: string | null;
  creativeName?: string | null;
  productionStage?: string;
  taskStatus?: TaskStatus;
  isRevisionRequested?: boolean;
  revisionTarget?: "creator" | "editor";
  revisionReason?: string;
  revisionNotes?: string;
  deliverableUrl?: string;
  actorId?: string | null;
  actorName?: string;
}): Promise<{ ok: boolean; ad?: Record<string, any>; error?: string }> {
  const headers = {
    ...getAdFlowHeaders(),
    Prefer: "return=representation",
  };
  const nowIso = new Date().toISOString();
  const reviewerId = params.actorId || "4a206a68-c5a4-4d12-be76-90468ea3df44";
  const actorName = params.actorName || "Admin";

  // 1. Find existing AdFlow creative by adId or creativeName
  let existingAd: Record<string, any> | null = null;
  const cleanAdId = params.adId ? String(params.adId).replace(/^ad-/, "") : "";

  if (cleanAdId) {
    try {
      const res = await fetch(
        `${ADFLOW_SUPABASE_URL}/rest/v1/ads?id=eq.${encodeURIComponent(cleanAdId)}&select=*`,
        { headers: getAdFlowHeaders() }
      );
      if (res.ok) {
        const rows = await res.json();
        existingAd = Array.isArray(rows) && rows[0] ? rows[0] : null;
      }
    } catch {}
  }

  if (!existingAd && params.creativeName) {
    try {
      const res = await fetch(
        `${ADFLOW_SUPABASE_URL}/rest/v1/ads?name=ilike.${encodeURIComponent(
          params.creativeName.trim()
        )}&deleted_at=is.null&select=*`,
        { headers: getAdFlowHeaders() }
      );
      if (res.ok) {
        const rows = await res.json();
        existingAd = Array.isArray(rows) && rows[0] ? rows[0] : null;
      }
    } catch {}
  }

  if (!existingAd) {
    return { ok: false, error: "Matching AdFlow creative not found" };
  }

  const prevStage = existingAd.production_stage;
  let nextStage = params.productionStage || prevStage;

  // Determine target productionStage if not explicitly provided or if revision/approval was triggered
  if (params.isRevisionRequested === true) {
    const resolvedTarget: "creator" | "editor" =
      params.revisionTarget ||
      (params.productionStage === "creator_changes_requested" ||
      String(params.revisionReason || "")
        .toLowerCase()
        .includes("creator")
        ? "creator"
        : "editor");
    nextStage =
      resolvedTarget === "creator"
        ? "creator_changes_requested"
        : "changes_requested";
  } else if (!params.productionStage && params.taskStatus) {
    nextStage = mapTaskStatusToDefaultAdFlowStage(
      params.taskStatus,
       undefined,
      params.isRevisionRequested,
      params.revisionTarget
    );
  }

  const stageIdx = ADFLOW_PRODUCTION_STAGES.findIndex((s) => s.id === nextStage);
  const patch: Record<string, any> = {
    production_stage: nextStage,
    status: legacyAdStatusForStage(nextStage),
    approval_stage:
      nextStage === "approved"
        ? "complete"
        : nextStage === "final_review"
        ? "admin_final"
        : "manager_review",
    updated_at: nowIso,
    workflow_status_changed_at: nowIso,
  };

  if (stageIdx >= 1 && !existingAd.script_ready_at) patch.script_ready_at = nowIso;
  if (stageIdx >= 2 && !existingAd.shoot_completed_at) patch.shoot_completed_at = nowIso;
  if (stageIdx >= 3 && !existingAd.raw_footage_shared_at) patch.raw_footage_shared_at = nowIso;
  if (stageIdx >= 4 && !existingAd.editing_started_at) patch.editing_started_at = nowIso;
  if (stageIdx >= 5 && !existingAd.submitted_at) patch.submitted_at = nowIso;
  if (stageIdx >= 6 && !existingAd.creator_reviewed_at) patch.creator_reviewed_at = nowIso;

  if (nextStage === "approved") {
    patch.approved_at = nowIso;
    patch.final_approved_at = nowIso;
  } else if (
    nextStage === "changes_requested" ||
    nextStage === "creator_changes_requested"
  ) {
    patch.approved_at = null;
    patch.final_approved_at = null;
  }

  if (params.deliverableUrl) {
    patch.drive_url = params.deliverableUrl;
  }

  const updateRes = await fetch(
    `${ADFLOW_SUPABASE_URL}/rest/v1/ads?id=eq.${encodeURIComponent(existingAd.id)}`,
    {
      method: "PATCH",
      headers,
      body: JSON.stringify(patch),
    }
  );

  if (!updateRes.ok) {
    const errText = await updateRes.text();
    return { ok: false, error: errText };
  }

  const updatedRows = await updateRes.json();
  const updatedAd =
    Array.isArray(updatedRows) && updatedRows[0]
      ? updatedRows[0]
      : { ...existingAd, ...patch };

  const noteText =
    [params.revisionReason, params.revisionNotes]
      .filter(Boolean)
      .join(": ")
      .trim() || null;

  // Insert into review_actions & activity_logs so AdFlow UI displays the exact review state and feedback banner
  if (
    nextStage === "creator_changes_requested" ||
    nextStage === "changes_requested"
  ) {
    const targetRole =
      nextStage === "creator_changes_requested" ? "creator" : "editor";
    const isReopen = prevStage === "approved";
    const activityAction = isReopen
      ? "approved_ad_reopened"
      : targetRole === "creator"
      ? "final_changes_requested_to_creator"
      : "final_changes_requested_to_editor";

    await Promise.all([
      fetch(`${ADFLOW_SUPABASE_URL}/rest/v1/review_actions`, {
        method: "POST",
        headers: getAdFlowHeaders(),
        body: JSON.stringify({
          ad_id: existingAd.id,
          reviewer_id: reviewerId,
          decision: "request_changes",
          note: noteText || `Changes requested to ${targetRole} from Task Manager`,
        }),
      }).catch(() => {}),
      fetch(`${ADFLOW_SUPABASE_URL}/rest/v1/activity_logs`, {
        method: "POST",
        headers: getAdFlowHeaders(),
        body: JSON.stringify({
          ad_id: existingAd.id,
          actor_id: reviewerId,
          action: activityAction,
          metadata: {
            previous_stage: prevStage,
            production_stage: nextStage,
            new_stage: nextStage,
            target: targetRole,
            note: noteText || `Changes requested to ${targetRole}`,
            source: "task_manager",
            ...(isReopen ? { reopened: true } : {}),
          },
        }),
      }).catch(() => {}),
    ]);

    const recipientId =
      targetRole === "creator"
        ? existingAd.creator_id
        : existingAd.editor_id || existingAd.creator_id;
    if (recipientId) {
      await fetch(`${ADFLOW_SUPABASE_URL}/rest/v1/notifications`, {
        method: "POST",
        headers: getAdFlowHeaders(),
        body: JSON.stringify({
          user_id: recipientId,
          ad_id: existingAd.id,
          title: `Changes requested (${targetRole === "creator" ? "Creator" : "Editor"})`,
          body: `${existingAd.name}: ${noteText || "Updates requested from Task Manager."}`,
        }),
      }).catch(() => {});
    }
  } else if (nextStage === "approved" && prevStage !== "approved") {
    await Promise.all([
      fetch(`${ADFLOW_SUPABASE_URL}/rest/v1/review_actions`, {
        method: "POST",
        headers: getAdFlowHeaders(),
        body: JSON.stringify({
          ad_id: existingAd.id,
          reviewer_id: reviewerId,
          decision: "approve",
          note: noteText || `Approved by ${actorName} from Task Manager`,
        }),
      }).catch(() => {}),
      fetch(`${ADFLOW_SUPABASE_URL}/rest/v1/activity_logs`, {
        method: "POST",
        headers: getAdFlowHeaders(),
        body: JSON.stringify({
          ad_id: existingAd.id,
          actor_id: reviewerId,
          action: "final_approval_granted",
          metadata: {
            previous_stage: prevStage,
            production_stage: "approved",
            new_stage: "approved",
            source: "task_manager",
          },
        }),
      }).catch(() => {}),
    ]);
  } else if (nextStage !== prevStage) {
    await fetch(`${ADFLOW_SUPABASE_URL}/rest/v1/activity_logs`, {
      method: "POST",
      headers: getAdFlowHeaders(),
      body: JSON.stringify({
        ad_id: existingAd.id,
        actor_id: reviewerId,
        action: "admin_creative_override",
        metadata: {
          previous_stage: prevStage,
          production_stage: nextStage,
          new_stage: nextStage,
          source: "task_manager",
        },
      }),
    }).catch(() => {});
  }

  // Trigger immediate cache invalidation on AdFlow server
  await revalidateAdFlowCache(existingAd.id);

  return { ok: true, ad: updatedAd };
}
