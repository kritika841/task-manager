import { ADFLOW_SUPABASE_URL, ADFLOW_SUPABASE_SERVICE_KEY } from "@/lib/supabase";
import { loadLocalDb, saveLocalDb } from "@/lib/local-supabase-fallback";

export const ADFLOW_PRODUCTION_STAGES = [
  { id: "script_writing", label: "Script in progress", shortLabel: "Script", taskStatus: "todo" },
  { id: "ready_to_shoot", label: "Ready to shoot", shortLabel: "Shoot ready", taskStatus: "todo" },
  { id: "shoot_complete", label: "Shoot complete", shortLabel: "Shot", taskStatus: "in_progress" },
  { id: "ready_for_edit", label: "Ready for editing", shortLabel: "Handoff", taskStatus: "todo" },
  { id: "editing", label: "Editing", shortLabel: "Editing", taskStatus: "in_progress" },
  { id: "creator_review", label: "Creator review", shortLabel: "Creator review", taskStatus: "in_review" },
  { id: "final_review", label: "Final review", shortLabel: "Final review", taskStatus: "in_review" },
  { id: "creator_changes_requested", label: "Changes requested to creator", shortLabel: "Changes: Creator", taskStatus: "in_progress" },
  { id: "changes_requested", label: "Changes requested to editor", shortLabel: "Changes: Editor", taskStatus: "in_progress" },
  { id: "approved", label: "Approved", shortLabel: "Approved", taskStatus: "completed" },
] as const;

export type AdFlowProductionStage = (typeof ADFLOW_PRODUCTION_STAGES)[number]["id"];

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

  // Also check upstream profile if not found locally
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
    // Also check if task_name starts with PREFIX####
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
 * Returns pending Creative IDs generated in Task Manager for a given creator so AdFlow
 * can automatically fetch and assign the exact same Creative ID when creating creatives.
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
  const targets = (db.daily_team_targets || []).filter((t) => t.user_id === creatorId);

  // Sort oldest-first so (1/4), (2/4), (3/4), (4/4) are consumed in order
  const sortedTargets = [...targets].sort((a, b) => {
    const tA = String(a.created_at || "");
    const tB = String(b.created_at || "");
    if (tA !== tB) return tA.localeCompare(tB);
    return String(a.task_name || "").localeCompare(String(b.task_name || ""));
  });

  for (const row of sortedTargets) {
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

  // Sort by numeric suffix so KRI0036 comes before KRI0037, KRI0038, KRI0039
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

export function mapAdFlowStageToTaskStatus(stage: string, status?: string): "backlog" | "todo" | "in_progress" | "in_review" | "completed" {
  const s = (stage || "").toLowerCase();
  const st = (status || "").toLowerCase();
  if (s === "approved" || st === "approved") return "completed";
  if (s === "creator_review" || s === "final_review" || st === "pending_review") return "in_review";
  if (
    s === "editing" ||
    s === "shoot_complete" ||
    s === "changes_requested" ||
    s === "creator_changes_requested"
  ) {
    return "in_progress";
  }
  if (s === "script_writing" || s === "ready_to_shoot" || s === "ready_for_edit") {
    return "todo";
  }
  return "todo";
}

export function legacyAdStatusForStage(stage: string): string {
  if (stage === "creator_review" || stage === "final_review") return "pending_review";
  if (stage === "changes_requested" || stage === "creator_changes_requested") return "changes_requested";
  if (stage === "approved") return "approved";
  return "draft";
}
