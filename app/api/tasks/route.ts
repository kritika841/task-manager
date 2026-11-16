import { NextResponse } from "next/server";
import {
  supabaseAdmin,
  dateInTargetTimeZone,
  isCanonicalAdflowTask,
  ADFLOW_SUPABASE_URL,
} from "@/lib/supabase";
import { loadLocalDb, saveLocalDb } from "@/lib/local-supabase-fallback";
import {
  generateNextCreativeIds,
  getAdFlowHeaders,
  legacyAdStatusForStage,
} from "@/lib/adflow-bridge";
import {
  Task,
  User,
  Subtask,
  Role,
  TaskStatus,
  TaskPriority,
  AuditLogEntry,
  DeliverableAsset,
  TaskTimeTracking,
  StageHistoryEntry,
} from "@/lib/types";
import { getAllCommentsMap } from "@/lib/comments-store";
import { getEmployeeCode, getUserColor } from "@/lib/utils";
import { resolveRequestActor } from "@/lib/auth-server";
import { dispatchWebhookEvent } from "@/lib/webhooks-store";

function getDepartment(role: string): string {
  switch (role) {
    case "admin":
      return "Executive & Admin";
    case "manager":
      return "Operations & Review";
    case "developer":
      return "Engineering & Product";
    case "editor":
      return "Video Editing";
    case "content_creator":
      return "Content & Creative";
    case "media_buyer":
      return "Media & Growth";
    default:
      return "Operations";
  }
}

function getDailyCapacity(role: string): number {
  switch (role) {
    case "developer":
      return 6;
    case "editor":
      return 6;
    case "content_creator":
      return 4;
    case "manager":
      return 8;
    case "admin":
      return 10;
    default:
      return 5;
  }
}

function formatStageLabel(
  status: TaskStatus,
  subColumnId?: string,
  productionStage?: string
): string {
  const baseMap: Record<TaskStatus, string> = {
    backlog: "Backlog",
    todo: "To Do",
    in_progress: "In Progress",
    in_review: "In Review",
    completed: "Done",
  };
  const base = baseMap[status] || status;
  if (productionStage) {
    return `${base} (${productionStage.replace(/_/g, " ")})`;
  }
  if (subColumnId) {
    const cleanSub = subColumnId.replace(/^(dev|cc|ed|mb|mgr|adm|sub)-/, "").replace(/-/g, " ");
    return `${base} · ${cleanSub}`;
  }
  return base;
}

interface ParsedNotes {
  description: string;
  priority?: TaskPriority;
  project?: string;
  tags?: string[];
  deliverableUrl?: string;
  deliverableAsset?: DeliverableAsset;
  isRevisionRequested?: boolean;
  revisionReason?: string;
  revisionNotes?: string;
  blockedByTaskIds?: string[];
  statusOverride?: TaskStatus;
  customSubtasks?: Subtask[];
  startDate?: string;
  dueTime?: string;
  estimatedHours?: number;
  actualHours?: number;
  timeTracking?: TaskTimeTracking;
  isArchived?: boolean;
  archivedAt?: string;
  archivedBy?: string | null;
  subColumnId?: string;
  parentColumnId?: TaskStatus;
  templateRole?: Role;
  stageHistory?: StageHistoryEntry[];
  completedAt?: string;
  creativeName?: string;
  adId?: string;
  productionStage?: string;
}

function parseNotes(raw: string | null): ParsedNotes {
  if (!raw) return { description: "" };
  try {
    if (raw.startsWith("{") && raw.includes('"__meta__":true')) {
      const parsed = JSON.parse(raw);
      return {
        description: parsed.desc || "",
        priority: parsed.priority,
        project: parsed.project,
        tags: Array.isArray(parsed.tags) ? parsed.tags : undefined,
        deliverableUrl: parsed.deliverableUrl,
        deliverableAsset: parsed.deliverableAsset,
        isRevisionRequested: parsed.isRevisionRequested,
        revisionReason: parsed.revisionReason,
        revisionNotes: parsed.revisionNotes,
        blockedByTaskIds: parsed.blockedByTaskIds,
        statusOverride: parsed.statusOverride,
        customSubtasks: parsed.customSubtasks,
        startDate: parsed.startDate,
        dueTime: parsed.dueTime,
        estimatedHours: parsed.estimatedHours,
        actualHours: parsed.actualHours,
        timeTracking: parsed.timeTracking,
        isArchived: Boolean(parsed.isArchived),
        archivedAt: parsed.archivedAt,
        archivedBy: parsed.archivedBy,
        subColumnId: parsed.subColumnId,
        parentColumnId: parsed.parentColumnId,
        templateRole: parsed.templateRole,
        stageHistory: Array.isArray(parsed.stageHistory) ? parsed.stageHistory : undefined,
        completedAt: parsed.completedAt,
        creativeName: parsed.creativeName,
        adId: parsed.adId,
        productionStage: parsed.productionStage,
      };
    }
  } catch {}
  return { description: raw };
}

function stringifyNotes(meta: ParsedNotes): string {
  const hasExtra =
    meta.priority ||
    meta.project ||
    (meta.tags && meta.tags.length > 0) ||
    meta.deliverableUrl ||
    meta.deliverableAsset ||
    meta.isRevisionRequested ||
    meta.revisionReason ||
    meta.revisionNotes ||
    (meta.blockedByTaskIds && meta.blockedByTaskIds.length > 0) ||
    meta.statusOverride ||
    (meta.customSubtasks && meta.customSubtasks.length > 0) ||
    meta.startDate ||
    meta.dueTime ||
    meta.estimatedHours !== undefined ||
    meta.actualHours !== undefined ||
    meta.timeTracking ||
    meta.isArchived !== undefined ||
    meta.archivedAt ||
    meta.archivedBy ||
    meta.subColumnId ||
    meta.parentColumnId ||
    meta.templateRole ||
    (meta.stageHistory && meta.stageHistory.length > 0) ||
    meta.completedAt ||
    meta.creativeName ||
    meta.adId ||
    meta.productionStage;

  if (!hasExtra) {
    return meta.description || "";
  }

  return JSON.stringify({
    __meta__: true,
    desc: meta.description || "",
    priority: meta.priority,
    project: meta.project,
    tags: meta.tags,
    deliverableUrl: meta.deliverableUrl,
    deliverableAsset: meta.deliverableAsset,
    isRevisionRequested: meta.isRevisionRequested,
    revisionReason: meta.revisionReason,
    revisionNotes: meta.revisionNotes,
    blockedByTaskIds: meta.blockedByTaskIds,
    statusOverride: meta.statusOverride,
    customSubtasks: meta.customSubtasks,
    startDate: meta.startDate,
    dueTime: meta.dueTime,
    estimatedHours: meta.estimatedHours,
    actualHours: meta.actualHours,
    timeTracking: meta.timeTracking,
    isArchived: meta.isArchived,
    archivedAt: meta.archivedAt,
    archivedBy: meta.archivedBy,
    subColumnId: meta.subColumnId,
    parentColumnId: meta.parentColumnId,
    templateRole: meta.templateRole,
    stageHistory: meta.stageHistory,
    completedAt: meta.completedAt,
    creativeName: meta.creativeName,
    adId: meta.adId,
    productionStage: meta.productionStage,
  });
}

function parseUserMetadata(avatarUrl: string | null, name: string, role?: string) {
  let color: string | undefined;
  let employeeCode: string | undefined;
  let dailyCapacityUnits: number | undefined;

  if (avatarUrl) {
    try {
      if (avatarUrl.startsWith("{") && avatarUrl.endsWith("}")) {
        const parsed = JSON.parse(avatarUrl);
        color = parsed.color;
        employeeCode = parsed.employeeCode;
        dailyCapacityUnits = parsed.dailyCapacityUnits;
      } else if (avatarUrl.startsWith("#")) {
        color = avatarUrl;
      }
    } catch {}
  }

  const code = getEmployeeCode(name, employeeCode);
  const resolvedColor = getUserColor(code, color);
  const resolvedCapacity =
    typeof dailyCapacityUnits === "number" && dailyCapacityUnits > 0
      ? dailyCapacityUnits
      : getDailyCapacity(role || "member");

  return {
    employeeCode: code,
    color: resolvedColor,
    dailyCapacityUnits: resolvedCapacity,
  };
}

export async function GET(req: Request) {
  try {
    const today = dateInTargetTimeZone();
    const url = new URL(req.url);
    const includeArchived = url.searchParams.get("includeArchived") === "true";

    // 1. Ensure recurring delegator rules are materialized locally for today
    try {
      await supabaseAdmin.rpc("materialize_daily_task_rules", {
        p_start: today,
        p_end: today,
      });
    } catch (e) {
      console.warn("Could not auto-materialize delegator rules:", e);
    }

    // 2. Fetch active profiles (Filter out soft-deleted profiles)
    const { data: profileRows, error: profileErr } = await supabaseAdmin
      .from("profiles")
      .select("id, name, email, role, avatar_url, active, deleted_at")
      .is("deleted_at", null)
      .eq("active", true)
      .order("name", { ascending: true });

    if (profileErr) {
      console.error("Error fetching profiles:", profileErr);
      return NextResponse.json({ error: profileErr.message }, { status: 500 });
    }

    const users: User[] = (profileRows || []).map((p) => {
      const { employeeCode, color, dailyCapacityUnits } = parseUserMetadata(
        p.avatar_url,
        p.name || p.email,
        p.role
      );
      return {
        id: p.id,
        name: p.name || p.email.split("@")[0],
        email: p.email,
        role: (p.role as Role) || "member",
        avatar: employeeCode.slice(0, 2),
        department: getDepartment(p.role),
        active: p.active !== false && !p.deleted_at,
        dailyCapacityUnits,
        employeeCode,
        color,
        deletedAt: p.deleted_at,
      };
    });

    // 3. Fetch active ad creatives from Supabase Ads Management
    const { data: activeAds } = await supabaseAdmin
      .from("ads")
      .select(
        "id, name, status, approval_stage, production_stage, editor_id, creator_id, editing_started_at, shoot_completed_at, submitted_at, approved_at, drive_url, raw_footage_url, script_text, editing_freeze, deadline, notes, created_at, updated_at"
      )
      .or("status.neq.approved,production_stage.neq.approved")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false });

    // Load local overrides for AdFlow creatives
    const localDb = loadLocalDb();
    const adOverrides = localDb.ad_overrides || {};

    // 4. Fetch daily team targets
    const { data: targetRows, error: targetErr } = await supabaseAdmin
      .from("daily_team_targets")
      .select("*")
      .order("target_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (targetErr) {
      console.error("Error fetching daily targets:", targetErr);
      return NextResponse.json({ error: targetErr.message }, { status: 500 });
    }

    // Also fetch any AdFlow ads whose `name` matches a `creativeName` in `targetRows` (even if approved)
    const targetCreativeNames = Array.from(
      new Set(
        (targetRows || [])
          .map((r) => parseNotes(r.notes).creativeName?.trim().toUpperCase())
          .filter((n): n is string => Boolean(n))
      )
    );

    const adsById = new Map<string, Record<string, any>>();
    const adsByName = new Map<string, Record<string, any>>();

    for (const ad of activeAds || []) {
      adsById.set(ad.id, ad);
      if (ad.name) {
        adsByName.set(String(ad.name).trim().toUpperCase(), ad);
      }
    }

    const missingCreativeNames = targetCreativeNames.filter((n) => !adsByName.has(n));
    if (missingCreativeNames.length > 0) {
      try {
        const inList = missingCreativeNames.map((n) => `"${n}"`).join(",");
        const res = await fetch(
          `${ADFLOW_SUPABASE_URL}/rest/v1/ads?name=in.(${encodeURIComponent(inList)})&deleted_at=is.null&select=id,name,status,approval_stage,production_stage,editor_id,creator_id,editing_started_at,shoot_completed_at,submitted_at,approved_at,drive_url,raw_footage_url,script_text,editing_freeze,deadline,notes,created_at,updated_at`,
          { headers: getAdFlowHeaders() }
        );
        if (res.ok) {
          const matchedAds = await res.json();
          if (Array.isArray(matchedAds)) {
            for (const ad of matchedAds) {
              adsById.set(ad.id, ad);
              if (ad.name) {
                adsByName.set(String(ad.name).trim().toUpperCase(), ad);
              }
            }
          }
        }
      } catch {}
    }

    const mergedAdIds = new Set<string>();

    // 5. Fetch recent audit logs for tasks
    const { data: auditRows } = await supabaseAdmin
      .from("audit_logs")
      .select("*")
      .eq("target_type", "daily_team_target")
      .order("created_at", { ascending: false })
      .limit(200);

    const auditLogs: AuditLogEntry[] = (auditRows || []).map((row) => {
      const actor = users.find((u) => u.id === row.actor_id);
      return {
        id: row.id,
        actorId: row.actor_id,
        actorName: actor?.name || "Team Member",
        action: row.action,
        targetType: row.target_type,
        targetId: row.target_id,
        metadata: row.metadata,
        createdAt: row.created_at,
      };
    });

    // 6. Fetch persistent comments map
    const allComments = await getAllCommentsMap();

    // Track user sequential task counts for human-friendly employee code task IDs (e.g. HIM-01, NIK-02)
    const userTargetCounts: Record<string, number> = {};

    // 7. Convert daily targets into Task models with Employee Code IDs
    const targetTasks: Task[] = (targetRows || []).map((row) => {
      const isCarried =
        Boolean(row.carried_from_target_id) ||
        row.task_name?.toLowerCase().includes("(carried forward)");

      const targetQty = Number(row.target_quantity) || 1;
      const completedQty = Number(row.completed_quantity) || 0;
      const parsedNotes = parseNotes(row.notes);
      const isArchived = Boolean(parsedNotes.isArchived);
      const isStandardAdflow = isCanonicalAdflowTask(row.task_name);

      // Determine status based on target vs completed & notes override
      let status: TaskStatus = "todo";
      if (parsedNotes.statusOverride) {
        status = parsedNotes.statusOverride;
      } else if (targetQty > 0 && completedQty >= targetQty) {
        status = "completed";
      } else if (completedQty > 0) {
        status = "in_progress";
      } else if (row.target_date > today) {
        status = "backlog";
      } else {
        status = "todo";
      }

      // Priority (preserve explicit user priority if set, otherwise derive smart default)
      let priority: TaskPriority = parsedNotes.priority || "medium";
      if (!parsedNotes.priority) {
        if (isCarried || (row.target_date < today && completedQty < targetQty)) {
          priority = "urgent";
        } else if (row.target_date === today && targetQty > 4) {
          priority = "high";
        }
      }

      const assignee = users.find((u) => u.id === row.user_id);
      const project = parsedNotes.project || assignee?.department || "Operations";
      const empCode = assignee?.employeeCode || getEmployeeCode(assignee?.name || "EMP");

      userTargetCounts[empCode] = (userTargetCounts[empCode] || 0) + 1;

      const resolvedCreativeName = parsedNotes.creativeName
        ? parsedNotes.creativeName.trim().toUpperCase()
        : undefined;
      const matchedAd = resolvedCreativeName
        ? adsByName.get(resolvedCreativeName)
        : parsedNotes.adId
        ? adsById.get(parsedNotes.adId)
        : undefined;

      if (matchedAd?.id) {
        mergedAdIds.add(matchedAd.id);
      }

      const taskNumber =
        resolvedCreativeName ||
        matchedAd?.name ||
        `${empCode}-${String(userTargetCounts[empCode]).padStart(2, "0")}`;

      // If linked to a live AdFlow creative, synchronize status & productionStage from AdFlow
      const liveProdStage = matchedAd?.production_stage || parsedNotes.productionStage;
      const liveAdStatus = matchedAd?.status;

      if (matchedAd) {
        const stg = String(matchedAd.production_stage || "").toLowerCase();
        const stRaw = String(matchedAd.status || "").toLowerCase();
        if (stg === "approved" || stRaw === "approved") {
          status = "completed";
        } else if (stg === "creator_review" || stg === "final_review" || stRaw === "pending_review") {
          status = "in_review";
        } else if (
          stg === "editing" ||
          stg === "shoot_complete" ||
          stg === "changes_requested" ||
          stg === "creator_changes_requested"
        ) {
          status = "in_progress";
        }
      }

      const tags: string[] =
        parsedNotes.tags && parsedNotes.tags.length > 0
          ? [...parsedNotes.tags]
          : ["Daily Target"];
      if (!parsedNotes.tags || parsedNotes.tags.length === 0) {
        if (isCarried) tags.push("Carried Forward");
        if (row.task_name.toLowerCase().includes("edit")) tags.push("Video Ads");
        if (row.task_name.toLowerCase().includes("script")) tags.push("Creative");
        if (row.task_name.toLowerCase().includes("shoot")) tags.push("Production");
      }
      if (resolvedCreativeName && !tags.includes("AdFlow")) {
        tags.unshift("AdFlow");
      }

      // Generate unit checklist subtasks
      const subtasks: Subtask[] = [];
      if (parsedNotes.customSubtasks && parsedNotes.customSubtasks.length > 0) {
        subtasks.push(...parsedNotes.customSubtasks);
      } else {
        const totalUnits = Math.max(targetQty, completedQty, 1);
        for (let i = 1; i <= totalUnits; i++) {
          const isDone = status === "completed" || i <= completedQty;
          subtasks.push({
            id: `sub-${row.id}-${i}`,
            title: resolvedCreativeName
              ? `Deliver Creative ${resolvedCreativeName}: ${row.task_name}`
              : `Unit ${i} of ${row.task_name.replace(/\s*\(carried forward\)/i, "")}`,
            completed: isDone,
            completedAt: isDone ? row.updated_at : undefined,
            assignedTo: row.user_id,
            sortOrder: i,
            isCustom: false,
          });
        }
      }

      const taskComments = allComments[row.id] || [];
      const fallbackStageHistory: StageHistoryEntry[] = [
        {
          stage: status,
          label: formatStageLabel(status, parsedNotes.subColumnId, liveProdStage),
          timestamp: row.created_at || new Date().toISOString(),
        },
      ];
      const stageHistory =
        parsedNotes.stageHistory && parsedNotes.stageHistory.length > 0
          ? parsedNotes.stageHistory
          : fallbackStageHistory;

      const isAdRevision =
        parsedNotes.isRevisionRequested ||
        liveProdStage === "changes_requested" ||
        liveProdStage === "creator_changes_requested" ||
        liveAdStatus === "rejected";

      return {
        id: row.id,
        taskNumber,
        title: row.task_name,
        description: parsedNotes.description,
        status,
        priority,
        assigneeId: row.user_id,
        creatorId: row.assigned_by || row.user_id,
        dueDate: row.target_date,
        subtasks,
        customSubtasks: parsedNotes.customSubtasks || [],
        project,
        tags,
        createdAt: row.created_at || new Date().toISOString(),
        updatedAt: row.updated_at || new Date().toISOString(),
        comments: taskComments,
        targetQuantity: targetQty,
        completedQuantity: status === "completed" ? targetQty : completedQty,
        manualCompletedQuantity: row.manual_completed_quantity || 0,
        autoCompletedQuantity: row.auto_completed_quantity || 0,
        isCarried,
        carriedFromTargetId: row.carried_from_target_id,
        deliverableUrl:
          matchedAd?.drive_url ||
          parsedNotes.deliverableUrl ||
          parsedNotes.deliverableAsset?.url,
        deliverableAsset: parsedNotes.deliverableAsset,
        isRevisionRequested: isAdRevision,
        revisionReason:
          parsedNotes.revisionReason ||
          (liveAdStatus === "rejected"
            ? "Rejected"
            : liveProdStage === "creator_changes_requested"
            ? "Creator Changes Requested"
            : liveProdStage === "changes_requested"
            ? "Editor Changes Requested"
            : undefined),
        revisionNotes: parsedNotes.revisionNotes,
        blockedByTaskIds: parsedNotes.blockedByTaskIds || [],
        startDate: parsedNotes.startDate,
        dueTime: parsedNotes.dueTime,
        estimatedHours: parsedNotes.estimatedHours,
        actualHours: parsedNotes.actualHours,
        timeTracking: parsedNotes.timeTracking,
        isArchived,
        archivedAt: parsedNotes.archivedAt,
        archivedBy: parsedNotes.archivedBy,
        isCanonicalAdflowTask: isStandardAdflow || Boolean(resolvedCreativeName),
        adId: matchedAd?.id || parsedNotes.adId,
        creativeName: resolvedCreativeName || matchedAd?.name,
        productionStage: liveProdStage,
        adStatus: liveAdStatus,
        approvalStage: matchedAd?.approval_stage,
        rawFootageUrl: matchedAd?.raw_footage_url,
        scriptText: matchedAd?.script_text,
        adCreatorId: matchedAd?.creator_id || row.user_id,
        adEditorId: matchedAd?.editor_id,
        editingFreeze: matchedAd?.editing_freeze,
        subColumnId: parsedNotes.subColumnId,
        parentColumnId: parsedNotes.parentColumnId || status,
        templateRole: parsedNotes.templateRole,
        stageHistory,
        completedAt:
          parsedNotes.completedAt ||
          (status === "completed" ? row.updated_at || row.created_at : undefined),
      };
    });

    // 8. Convert active AdFlow creatives into Task models (skipping any already merged with a Task Manager task)
    const unmergedActiveAds = (activeAds || []).filter((ad) => !mergedAdIds.has(ad.id));
    const adCreativeTasks: Task[] = unmergedActiveAds.map((ad) => {
      const override = adOverrides[ad.id] || adOverrides[`ad-${ad.id}`] || {};
      const stage = (override.productionStage || ad.production_stage || "").toLowerCase();
      const statusRaw = (ad.status || "").toLowerCase();

      const isShootStage =
        stage === "script_writing" ||
        stage === "ready_to_shoot" ||
        stage === "ready_for_shoot" ||
        stage === "shoot_complete" ||
        stage === "shooting" ||
        stage === "creator_changes_requested";
      const isEditStage =
        stage === "ready_for_edit" ||
        stage === "editing" ||
        stage === "changes_requested";

      let defaultAssigneeId = "";
      if (isShootStage) {
        defaultAssigneeId = ad.creator_id || ad.editor_id || (users[0]?.id || "");
      } else {
        defaultAssigneeId = ad.editor_id || ad.creator_id || (users[0]?.id || "");
      }

      let defaultStatus: TaskStatus = "todo";
      let stageLabel = "Ad Creative";
      let defaultSubColumnId = "";
      let defaultTemplateRole: Role = isShootStage ? "content_creator" : "editor";

      if (stage === "approved" || statusRaw === "approved") {
        defaultStatus = "completed";
        stageLabel = "Approved";
        defaultSubColumnId = "ed-final-export";
      } else if (stage === "final_review") {
        defaultStatus = "in_review";
        stageLabel = "Final Review";
        defaultSubColumnId = "ed-final-review";
      } else if (
        stage === "creator_review" ||
        stage === "pending_review" ||
        statusRaw === "pending_review"
      ) {
        defaultStatus = "in_review";
        stageLabel = "Creator Review";
        defaultSubColumnId = "ed-creator-review";
      } else if (stage === "creator_changes_requested") {
        defaultStatus = "in_progress";
        stageLabel = "Changes: Creator";
        defaultSubColumnId = "cc-script-draft";
        defaultTemplateRole = "content_creator";
      } else if (stage === "changes_requested") {
        defaultStatus = "in_progress";
        stageLabel = "Changes: Editor";
        defaultSubColumnId = "ed-primary-cut";
      } else if (stage === "editing") {
        defaultStatus = "in_progress";
        stageLabel = "Video Editing";
        defaultSubColumnId = "ed-primary-cut";
      } else if (stage === "shoot_complete" || stage === "shooting") {
        defaultStatus = "in_progress";
        stageLabel = stage === "shooting" ? "Shooting" : "Shoot Complete";
        defaultSubColumnId = "cc-broll-capture";
        defaultTemplateRole = "content_creator";
      } else if (stage === "ready_for_edit") {
        defaultStatus = "todo";
        stageLabel = "Ready for Editing";
        defaultSubColumnId = "ed-rough-cut";
      } else if (stage === "ready_to_shoot" || stage === "ready_for_shoot") {
        defaultStatus = "todo";
        stageLabel = "Ready to Shoot";
        defaultSubColumnId = "cc-video-shoots";
        defaultTemplateRole = "content_creator";
      } else if (stage === "script_writing") {
        defaultStatus = "todo";
        stageLabel = "Script in Progress";
        defaultSubColumnId = "cc-script-draft";
        defaultTemplateRole = "content_creator";
      } else if (stage === "backlog") {
        defaultStatus = "backlog";
        stageLabel = "Backlog";
        defaultSubColumnId = "ed-ingest-queue";
      } else {
        defaultStatus = ad.editing_started_at ? "in_progress" : "todo";
        stageLabel = ad.production_stage ? ad.production_stage.replace(/_/g, " ") : "Creative";
      }

      const status: TaskStatus = override.status || defaultStatus;
      if (override.status && !override.productionStage) {
        if (override.status === "completed") stageLabel = "Approved";
        else if (override.status === "in_review") stageLabel = "Creator Review";
        else if (override.status === "in_progress") stageLabel = "Video Editing";
        else if (override.status === "todo") stageLabel = "Queued for Edit";
        else if (override.status === "backlog") stageLabel = "Backlog";
      }

      const assigneeId: string = override.assigneeId || defaultAssigneeId;
      const assignee = users.find((u) => u.id === assigneeId);
      const dueDate: string = override.dueDate || ad.deadline || today;
      const defaultPriority: TaskPriority =
        dueDate < today ? "urgent" : status === "in_progress" ? "high" : "medium";
      const priority: TaskPriority = override.priority || defaultPriority;
      const comments = allComments[`ad-${ad.id}`] || [];

      const targetQty = Math.max(1, Number(override.targetQuantity) || 1);
      const completedQty =
        override.completedQuantity !== undefined
          ? Math.max(0, Number(override.completedQuantity))
          : status === "completed"
          ? targetQty
          : 0;

      const customSubtasks: Subtask[] = Array.isArray(override.customSubtasks)
        ? override.customSubtasks
        : [];

      let subtasks: Subtask[] = [];
      if (customSubtasks.length > 0) {
        subtasks = customSubtasks;
      } else {
        const totalUnits = Math.max(targetQty, completedQty, 1);
        for (let i = 1; i <= totalUnits; i++) {
          const isDone = i <= completedQty;
          subtasks.push({
            id: `sub-ad-${ad.id}-${i}`,
            title:
              totalUnits === 1
                ? `Deliver creative: ${ad.name} (${stageLabel})`
                : `Unit ${i} of ${ad.name}`,
            completed: isDone,
            completedAt: isDone ? override.updatedAt || ad.updated_at : undefined,
            assignedTo: assigneeId,
            sortOrder: i,
            isCustom: false,
          });
        }
      }

      const defaultDesc = `AdFlow creative [${ad.name}]. Production Stage: ${stageLabel}.${
        ad.notes ? `\n\nNotes: ${ad.notes}` : ""
      }`;

      return {
        id: `ad-${ad.id}`,
        taskNumber: ad.name,
        title: override.title || `${ad.name} — ${stageLabel}`,
        description: override.description !== undefined ? override.description : defaultDesc,
        status,
        priority,
        assigneeId,
        creatorId: ad.creator_id || (users[0]?.id || ""),
        dueDate,
        subtasks,
        customSubtasks,
        project:
          override.project ||
          assignee?.department ||
          (isEditStage ? "Video Editing" : "Content & Creative"),
        tags:
          Array.isArray(override.tags) && override.tags.length > 0
            ? override.tags
            : ["AdFlow", "Active Creative", stageLabel],
        createdAt: ad.created_at || new Date().toISOString(),
        updatedAt: override.updatedAt || ad.updated_at || new Date().toISOString(),
        comments,
        targetQuantity: targetQty,
        completedQuantity: completedQty,
        manualCompletedQuantity: completedQty,
        autoCompletedQuantity: 0,
        isCarried: false,
        deliverableUrl:
          override.deliverableUrl !== undefined
            ? override.deliverableUrl
            : override.deliverableAsset?.url || ad.drive_url,
        deliverableAsset: override.deliverableAsset,
        isRevisionRequested:
          override.isRevisionRequested !== undefined
            ? override.isRevisionRequested
            : stage === "changes_requested" ||
              stage === "creator_changes_requested" ||
              statusRaw === "rejected",
        revisionReason:
          override.revisionReason ||
          (statusRaw === "rejected"
            ? "Rejected"
            : stage === "creator_changes_requested"
            ? "Creator Changes Requested"
            : stage === "changes_requested"
            ? "Editor Changes Requested"
            : undefined),
        revisionNotes: override.revisionNotes,
        blockedByTaskIds: override.blockedByTaskIds || [],
        startDate: override.startDate,
        dueTime: override.dueTime,
        estimatedHours: override.estimatedHours,
        actualHours: override.actualHours,
        timeTracking: override.timeTracking,
        isArchived: Boolean(override.isArchived),
        archivedAt: override.archivedAt,
        archivedBy: override.archivedBy,
        adId: ad.id,
        creativeName: ad.name,
        productionStage: override.productionStage || ad.production_stage,
        adStatus: override.adStatus || ad.status,
        approvalStage: ad.approval_stage,
        rawFootageUrl: ad.raw_footage_url,
        scriptText: ad.script_text,
        adCreatorId: ad.creator_id,
        adEditorId: ad.editor_id,
        editingFreeze: ad.editing_freeze,
        subColumnId:
          override.subColumnId !== undefined ? override.subColumnId : defaultSubColumnId,
        parentColumnId: override.parentColumnId || status,
        templateRole: override.templateRole || defaultTemplateRole,
        stageHistory:
          Array.isArray(override.stageHistory) && override.stageHistory.length > 0
            ? override.stageHistory
            : [
                {
                  stage: status,
                  label: formatStageLabel(
                    status,
                    override.subColumnId !== undefined ? override.subColumnId : defaultSubColumnId,
                    override.productionStage || ad.production_stage
                  ),
                  timestamp: ad.created_at || new Date().toISOString(),
                },
              ],
        completedAt:
          override.completedAt ||
          (status === "completed" ? override.updatedAt || ad.updated_at : undefined),
      };
    });

    const allTasks = [...adCreativeTasks, ...targetTasks];
    const tasks = includeArchived ? allTasks : allTasks.filter((t) => !t.isArchived);

    return NextResponse.json({ tasks, users, auditLogs, today });
  } catch (error: any) {
    console.error("GET /api/tasks error:", error);
    return NextResponse.json({ error: error.message || "Unknown error" }, { status: 500 });
  }
}

async function getActorName(actorId?: string | null): Promise<string> {
  if (!actorId) return "Admin";
  try {
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("name, email")
      .eq("id", actorId)
      .single();
    if (data) return data.name || data.email.split("@")[0];
  } catch {}
  return "Team Member";
}

async function sendTargetedNotification(
  userId: string,
  title: string,
  body: string,
  adId?: string
) {
  try {
    await supabaseAdmin.from("notifications").insert({
      user_id: userId,
      title,
      body,
      ad_id: adId || null,
    });
  } catch (err) {
    console.warn("sendTargetedNotification failed:", err);
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const today = dateInTargetTimeZone();

    const auth = await resolveRequestActor(req, body.creatorId);
    const userId = body.assigneeId;
    const taskName = (body.title || "Daily Task").trim();
    const targetDate = body.dueDate || today;
    const targetQuantity = Math.max(1, Number(body.targetQuantity) || 1);
    const assignedBy = auth.actor?.id || body.creatorId || userId || null;

    if (!userId) {
      return NextResponse.json({ error: "Assignee is required" }, { status: 400 });
    }

    const actorName = await getActorName(assignedBy);
    const nowIso = new Date().toISOString();
    const initialStatus: TaskStatus = body.status || "todo";
    const initialStageEntry: StageHistoryEntry = {
      stage: initialStatus,
      label: formatStageLabel(initialStatus, body.subColumnId),
      timestamp: nowIso,
      actorName,
    };

    // If targetQuantity > 1 (e.g. 4 units), split into N individual 1-unit tasks for the user!
    const splitUnitsCount = targetQuantity > 1 ? targetQuantity : 1;
    const createdRows: any[] = [];

    // Check if this task is an AdFlow creative task so we generate sequential Creative IDs (e.g. KRI0036..KRI0039)
    const dbSnapshot = loadLocalDb();
    const assigneeProfile = dbSnapshot.profiles.find((p) => p.id === userId);
    const assigneeRole = String(assigneeProfile?.role || "").toLowerCase();
    const isCreativeTask =
      Boolean(body.generateCreativeId) ||
      isCanonicalAdflowTask(taskName) ||
      assigneeRole === "content_creator" ||
      (Array.isArray(body.tags) &&
        body.tags.some((t: string) =>
          ["adflow", "creative", "video ads"].includes(String(t).toLowerCase())
        ));

    let generatedCreativeIds: string[] = [];
    if (isCreativeTask) {
      const generated = await generateNextCreativeIds(userId, splitUnitsCount);
      generatedCreativeIds = generated.creativeIds;
    }

    for (let i = 1; i <= splitUnitsCount; i++) {
      const assignedCreativeId = generatedCreativeIds[i - 1];
      const baseUnitName =
        splitUnitsCount > 1 ? `${taskName} (${i}/${splitUnitsCount})` : taskName;
      const unitTaskName = assignedCreativeId
        ? `${assignedCreativeId} — ${baseUnitName}`
        : baseUnitName;

      const baseTags: string[] = Array.isArray(body.tags) ? [...body.tags] : [];
      if (assignedCreativeId && !baseTags.includes("AdFlow")) {
        baseTags.unshift("AdFlow");
      }

      const notesMeta: ParsedNotes = {
        description: body.description || "",
        priority: body.priority || "medium",
        project: body.project,
        tags: baseTags.length > 0 ? baseTags : undefined,
        deliverableUrl: body.deliverableUrl,
        deliverableAsset: body.deliverableAsset,
        blockedByTaskIds: body.blockedByTaskIds,
        statusOverride: initialStatus,
        customSubtasks: body.customSubtasks,
        startDate: body.startDate,
        dueTime: body.dueTime,
        estimatedHours: body.estimatedHours,
        subColumnId: body.subColumnId,
        parentColumnId: body.parentColumnId || initialStatus,
        templateRole: body.templateRole,
        stageHistory: [initialStageEntry],
        completedAt: initialStatus === "completed" ? nowIso : undefined,
        creativeName: assignedCreativeId,
        productionStage: assignedCreativeId
          ? body.productionStage || "script_writing"
          : undefined,
      };

      const initialCompleted = initialStatus === "completed" ? 1 : 0;

      const { data: newRow, error } = await supabaseAdmin
        .from("daily_team_targets")
        .insert({
          user_id: userId,
          target_date: targetDate,
          task_name: unitTaskName,
          target_quantity: 1,
          completed_quantity: initialCompleted,
          manual_completed_quantity: initialCompleted,
          auto_completed_quantity: 0,
          notes: stringifyNotes(notesMeta),
          assigned_by: assignedBy,
        })
        .select()
        .single();

      if (error) {
        console.error("Insert target error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      createdRows.push(newRow);

      // Insert audit log per task
      await supabaseAdmin.from("audit_logs").insert({
        actor_id: assignedBy,
        action: "created_task",
        target_type: "daily_team_target",
        target_id: newRow.id,
        metadata: {
          taskName: unitTaskName,
          targetQuantity: 1,
          targetDate,
          assigneeId: userId,
          priority: body.priority || "medium",
        },
      });
    }

    const firstRow = createdRows[0];

    // Deliver notification to targeted assignee
    await sendTargetedNotification(
      userId,
      splitUnitsCount > 1
        ? `${splitUnitsCount} Tasks Assigned: ${taskName}`
        : `New Task Assigned: ${taskName}`,
      splitUnitsCount > 1
        ? `${actorName} assigned "${taskName}" (${splitUnitsCount} units split into ${splitUnitsCount} individual tasks) due on ${targetDate}.`
        : `${actorName} assigned "${taskName}" due on ${targetDate}.`
    );

    dispatchWebhookEvent("task.created", {
      taskId: firstRow.id,
      taskName,
      targetQuantity,
      splitCount: splitUnitsCount,
      targetDate,
      assigneeId: userId,
      createdBy: actorName,
    }).catch(() => {});

    return NextResponse.json({
      ok: true,
      target: firstRow,
      targets: createdRows,
      splitCount: splitUnitsCount,
      creativeIds: generatedCreativeIds,
    });
  } catch (error: any) {
    console.error("POST /api/tasks error:", error);
    return NextResponse.json({ error: error.message || "Failed to create task" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const {
      id,
      status,
      productionStage,
      priority,
      project,
      tags,
      completedQuantity,
      targetQuantity,
      assigneeId,
      dueDate,
      title,
      description,
      deliverableUrl,
      deliverableAsset,
      isRevisionRequested,
      revisionReason,
      revisionNotes,
      blockedByTaskIds,
      customSubtasks,
      startDate,
      dueTime,
      estimatedHours,
      actualHours,
      timeTracking,
      actorId,
      subColumnId,
      parentColumnId,
      templateRole,
    } = body;

    if (!id) {
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
    }

    const auth = await resolveRequestActor(req, actorId);
    const verifiedActorId = auth.actor?.id || actorId || null;
    const actorName = auth.actor?.name || (await getActorName(verifiedActorId));

    // 1. Handle AdFlow creative task updates (`ad-*`) strictly via local `ad_overrides`
    // CRITICAL RULE: NEVER modify `ads` table records!
    if (typeof id === "string" && id.startsWith("ad-")) {
      const realAdId = id.replace(/^ad-/, "");
      const db = loadLocalDb();
      if (!db.ad_overrides) db.ad_overrides = {};

      const existingAd = db.ads.find((a) => a.id === realAdId);
      const currentOverride: Record<string, any> = {
        ...(db.ad_overrides[realAdId] || {}),
      };

      const prevAssignee =
        currentOverride.assigneeId || existingAd?.editor_id || existingAd?.creator_id;

      if (assigneeId !== undefined) currentOverride.assigneeId = assigneeId;
      if (dueDate !== undefined) currentOverride.dueDate = dueDate;
      if (priority !== undefined) currentOverride.priority = priority;
      if (project !== undefined) currentOverride.project = project;
      if (tags !== undefined) currentOverride.tags = tags;
      if (title !== undefined) currentOverride.title = title.trim();
      if (description !== undefined) currentOverride.description = description;
      if (deliverableUrl !== undefined) currentOverride.deliverableUrl = deliverableUrl;
      if (deliverableAsset !== undefined) currentOverride.deliverableAsset = deliverableAsset;
      if (isRevisionRequested !== undefined)
        currentOverride.isRevisionRequested = isRevisionRequested;
      if (revisionReason !== undefined) currentOverride.revisionReason = revisionReason;
      if (revisionNotes !== undefined) currentOverride.revisionNotes = revisionNotes;
      if (blockedByTaskIds !== undefined) currentOverride.blockedByTaskIds = blockedByTaskIds;
      if (customSubtasks !== undefined) currentOverride.customSubtasks = customSubtasks;
      if (startDate !== undefined) currentOverride.startDate = startDate;
      if (dueTime !== undefined) currentOverride.dueTime = dueTime;
      if (estimatedHours !== undefined) currentOverride.estimatedHours = estimatedHours;
      if (actualHours !== undefined) currentOverride.actualHours = actualHours;
      if (timeTracking !== undefined) currentOverride.timeTracking = timeTracking;
      if (subColumnId !== undefined) currentOverride.subColumnId = subColumnId;
      if (parentColumnId !== undefined) currentOverride.parentColumnId = parentColumnId;
      if (templateRole !== undefined) currentOverride.templateRole = templateRole;

      if (body.restore === true || body.isArchived === false) {
        currentOverride.isArchived = false;
        currentOverride.archivedAt = undefined;
        currentOverride.archivedBy = null;
      }

      if (targetQuantity !== undefined) {
        currentOverride.targetQuantity = Math.max(1, Number(targetQuantity));
      }
      const effectiveTargetQty = currentOverride.targetQuantity || 1;
      const prevAdCompletedQty = Number(currentOverride.completedQuantity || 0);

      const prevAdStatus: TaskStatus = currentOverride.status || "todo";
      const prevAdSubCol = currentOverride.subColumnId;
      const prevAdProdStage = currentOverride.productionStage || existingAd?.production_stage;

      if (productionStage !== undefined) {
        currentOverride.productionStage = productionStage;
        const stg = String(productionStage).toLowerCase();
        if (!status) {
          if (stg === "approved") {
            currentOverride.status = "completed";
            currentOverride.isRevisionRequested = false;
            currentOverride.completedQuantity = effectiveTargetQty;
          } else if (
            stg === "creator_review" ||
            stg === "pending_review" ||
            stg === "final_review"
          ) {
            currentOverride.status = "in_review";
          } else if (
            stg === "editing" ||
            stg === "shoot_complete" ||
            stg === "shooting"
          ) {
            currentOverride.status = "in_progress";
          } else if (
            stg === "ready_for_edit" ||
            stg === "ready_to_shoot" ||
            stg === "ready_for_shoot"
          ) {
            currentOverride.status = "todo";
            currentOverride.completedQuantity = 0;
          } else if (stg === "backlog") {
            currentOverride.status = "backlog";
            currentOverride.completedQuantity = 0;
          }
        }
      }

      if (status) {
        currentOverride.status = status;
        if (status === "in_progress") {
          if (productionStage === undefined) currentOverride.productionStage = "editing";
          if (!currentOverride.completedQuantity && effectiveTargetQty > 1) {
            currentOverride.completedQuantity = 1;
          }
        } else if (status === "todo") {
          if (productionStage === undefined) currentOverride.productionStage = "ready_for_edit";
          currentOverride.completedQuantity = 0;
        } else if (status === "backlog") {
          if (productionStage === undefined) currentOverride.productionStage = "backlog";
          currentOverride.completedQuantity = 0;
        } else if (status === "in_review") {
          if (productionStage === undefined) currentOverride.productionStage = "creator_review";
        } else if (status === "completed") {
          if (productionStage === undefined) currentOverride.productionStage = "approved";
          currentOverride.isRevisionRequested = false;
          currentOverride.completedQuantity = effectiveTargetQty;
        }
      }

      if (completedQuantity !== undefined) {
        const safeQty = Math.max(0, Number(completedQuantity));
        currentOverride.completedQuantity = safeQty;
        if (!status && productionStage === undefined) {
          if (safeQty >= effectiveTargetQty) {
            currentOverride.status = "completed";
            currentOverride.productionStage = "approved";
            currentOverride.isRevisionRequested = false;
          } else if (safeQty > 0) {
            currentOverride.status = "in_progress";
            currentOverride.productionStage = "editing";
          } else if (
            currentOverride.status === "completed" ||
            (currentOverride.status === "in_progress" && prevAdCompletedQty > 0)
          ) {
            currentOverride.status = "todo";
            currentOverride.productionStage = "ready_for_edit";
          }
        }
      }

      const nextAdStatus: TaskStatus = currentOverride.status || prevAdStatus;
      if (nextAdStatus === "completed") {
        currentOverride.completedAt = currentOverride.completedAt || new Date().toISOString();
      } else {
        currentOverride.completedAt = undefined;
      }

      if (
        nextAdStatus !== prevAdStatus ||
        (subColumnId !== undefined && subColumnId !== prevAdSubCol) ||
        (productionStage !== undefined && productionStage !== prevAdProdStage)
      ) {
        const existingHist: StageHistoryEntry[] = Array.isArray(currentOverride.stageHistory)
          ? [...currentOverride.stageHistory]
          : [
              {
                stage: prevAdStatus,
                label: formatStageLabel(prevAdStatus, prevAdSubCol, prevAdProdStage),
                timestamp: existingAd?.created_at || new Date().toISOString(),
              },
            ];
        existingHist.push({
          stage: nextAdStatus,
          label: formatStageLabel(
            nextAdStatus,
            currentOverride.subColumnId,
            currentOverride.productionStage
          ),
          timestamp: new Date().toISOString(),
          actorName,
        });
        currentOverride.stageHistory = existingHist;
      }

      currentOverride.updatedAt = new Date().toISOString();
      db.ad_overrides[realAdId] = currentOverride;
      saveLocalDb(db);

      // Sync stage / revision / approval changes to AdFlow (`ads` table)
      if (
        currentOverride.productionStage ||
        status !== undefined ||
        isRevisionRequested !== undefined ||
        deliverableUrl !== undefined
      ) {
        try {
          const targetProdStage =
            currentOverride.productionStage ||
            (isRevisionRequested
              ? "changes_requested"
              : nextAdStatus === "completed"
              ? "approved"
              : nextAdStatus === "in_review"
              ? "final_review"
              : nextAdStatus === "in_progress"
              ? "editing"
              : "ready_for_edit");

          const adPatch: Record<string, any> = {
            production_stage: targetProdStage,
            status: legacyAdStatusForStage(targetProdStage),
            approval_stage:
              targetProdStage === "approved"
                ? "complete"
                : targetProdStage === "final_review"
                ? "admin_final"
                : "manager_review",
            updated_at: new Date().toISOString(),
            workflow_status_changed_at: new Date().toISOString(),
          };
          if (targetProdStage === "approved") {
            adPatch.approved_at = new Date().toISOString();
            adPatch.final_approved_at = new Date().toISOString();
          }
          if (deliverableUrl) {
            adPatch.drive_url = deliverableUrl;
          }

          await fetch(
            `${ADFLOW_SUPABASE_URL}/rest/v1/ads?id=eq.${encodeURIComponent(realAdId)}`,
            {
              method: "PATCH",
              headers: getAdFlowHeaders(),
              body: JSON.stringify(adPatch),
            }
          );
        } catch (err) {
          console.warn("Could not sync ad-* update to AdFlow:", err);
        }
      }

      if (assigneeId && assigneeId !== prevAssignee) {
        await sendTargetedNotification(
          assigneeId,
          `Task Reassigned to You: ${existingAd?.name || id}`,
          `${actorName} reassigned "${existingAd?.name || id}" to you.`,
          realAdId
        );
      }

      try {
        await supabaseAdmin.from("audit_logs").insert({
          actor_id: verifiedActorId,
          action: status ? "status_changed" : "updated_task",
          target_type: "daily_team_target",
          target_id: id,
          metadata: {
            taskName: existingAd?.name || id,
            status: currentOverride.status,
            assigneeId: currentOverride.assigneeId,
          },
        });
      } catch {}

      return NextResponse.json({
        ok: true,
        target: { id, adId: realAdId, ...currentOverride },
      });
    }

    // 2. Regular daily team target updates
    const { data: existing, error: fetchErr } = await supabaseAdmin
      .from("daily_team_targets")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchErr || !existing) {
      return NextResponse.json({ error: "Target not found" }, { status: 404 });
    }

    const currentNotesMeta = parseNotes(existing.notes);
    const prevTargetStatus: TaskStatus =
      currentNotesMeta.statusOverride ||
      (Number(existing.completed_quantity) >= Number(existing.target_quantity || 1)
        ? "completed"
        : Number(existing.completed_quantity) > 0
        ? "in_progress"
        : "todo");
    const prevTargetSubCol = currentNotesMeta.subColumnId;
    if (description !== undefined) currentNotesMeta.description = description;
    if (priority !== undefined) currentNotesMeta.priority = priority;
    if (project !== undefined) currentNotesMeta.project = project;
    if (tags !== undefined) currentNotesMeta.tags = tags;
    if (deliverableUrl !== undefined) currentNotesMeta.deliverableUrl = deliverableUrl;
    if (deliverableAsset !== undefined) currentNotesMeta.deliverableAsset = deliverableAsset;
    if (isRevisionRequested !== undefined)
      currentNotesMeta.isRevisionRequested = isRevisionRequested;
    if (revisionReason !== undefined) currentNotesMeta.revisionReason = revisionReason;
    if (revisionNotes !== undefined) currentNotesMeta.revisionNotes = revisionNotes;
    if (blockedByTaskIds !== undefined) currentNotesMeta.blockedByTaskIds = blockedByTaskIds;
    if (customSubtasks !== undefined) currentNotesMeta.customSubtasks = customSubtasks;
    if (startDate !== undefined) currentNotesMeta.startDate = startDate;
    if (dueTime !== undefined) currentNotesMeta.dueTime = dueTime;
    if (estimatedHours !== undefined) currentNotesMeta.estimatedHours = estimatedHours;
    if (actualHours !== undefined) currentNotesMeta.actualHours = actualHours;
    if (timeTracking !== undefined) currentNotesMeta.timeTracking = timeTracking;
    if (subColumnId !== undefined) currentNotesMeta.subColumnId = subColumnId;
    if (parentColumnId !== undefined) currentNotesMeta.parentColumnId = parentColumnId;
    if (templateRole !== undefined) currentNotesMeta.templateRole = templateRole;

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    let auditAction = "updated_task";
    const auditMeta: Record<string, any> = {};

    if (assigneeId && assigneeId !== existing.user_id) {
      updates.user_id = assigneeId;
      auditAction = "reassigned_task";
      auditMeta.previousAssigneeId = existing.user_id;
      auditMeta.newAssigneeId = assigneeId;

      await sendTargetedNotification(
        assigneeId,
        `Task Reassigned to You: ${existing.task_name}`,
        `${actorName} reassigned "${existing.task_name}" to you.`
      );
    }

    if (dueDate) {
      updates.target_date = dueDate;
    }

    // Canonical pipeline task title locking
    const isStandardTask = isCanonicalAdflowTask(existing.task_name);
    if (title) {
      if (isStandardTask) {
        updates.task_name = existing.task_name;
      } else {
        updates.task_name = title.trim();
      }
    }

    // Handle restore / unarchive
    if (body.restore === true || body.isArchived === false) {
      currentNotesMeta.isArchived = false;
      currentNotesMeta.archivedAt = undefined;
      currentNotesMeta.archivedBy = undefined;
      auditAction = "restored_task";
    }

    if (targetQuantity !== undefined && targetQuantity !== existing.target_quantity) {
      updates.target_quantity = Math.max(1, Number(targetQuantity));
    }

    const currentTargetQty = updates.target_quantity ?? existing.target_quantity ?? 1;
    const autoQty = Number(existing.auto_completed_quantity) || 0;
    const prevCompletedQty = Number(existing.completed_quantity) || 0;

    if (productionStage !== undefined && !status) {
      const stg = String(productionStage).toLowerCase();
      if (stg === "approved") {
        currentNotesMeta.statusOverride = "completed";
        currentNotesMeta.isRevisionRequested = false;
        updates.completed_quantity = currentTargetQty;
        updates.manual_completed_quantity = Math.max(0, currentTargetQty - autoQty);
      } else if (
        stg === "creator_review" ||
        stg === "pending_review" ||
        stg === "final_review"
      ) {
        currentNotesMeta.statusOverride = "in_review";
      } else if (
        stg === "editing" ||
        stg === "shoot_complete" ||
        stg === "shooting"
      ) {
        currentNotesMeta.statusOverride = "in_progress";
      } else if (
        stg === "ready_for_edit" ||
        stg === "ready_to_shoot" ||
        stg === "ready_for_shoot"
      ) {
        currentNotesMeta.statusOverride = "todo";
      } else if (stg === "backlog") {
        currentNotesMeta.statusOverride = "backlog";
      }
    }

    // Handle status changes
    if (status) {
      currentNotesMeta.statusOverride = status;

      if (status === "in_review") {
        auditAction = "submitted_for_review";
        auditMeta.deliverableUrl = deliverableUrl || currentNotesMeta.deliverableUrl;
      } else if (status === "completed") {
        currentNotesMeta.isRevisionRequested = false;
        updates.completed_quantity = currentTargetQty;
        updates.manual_completed_quantity = Math.max(0, currentTargetQty - autoQty);
        auditAction = "completed_task";
      } else if (status === "todo" || status === "backlog") {
        updates.completed_quantity = autoQty;
        updates.manual_completed_quantity = 0;
        auditAction = "status_changed";
        auditMeta.status = status;
      } else if (status === "in_progress") {
        if (Number(existing.completed_quantity) === 0 && currentTargetQty > 1) {
          const startingQty = Math.max(1, autoQty);
          updates.completed_quantity = startingQty;
          updates.manual_completed_quantity = Math.max(0, startingQty - autoQty);
        }
        auditAction = "status_changed";
      }
    }

    if (completedQuantity !== undefined) {
      const safeQty = Math.max(autoQty, Number(completedQuantity));
      updates.completed_quantity = safeQty;
      updates.manual_completed_quantity = Math.max(0, safeQty - autoQty);

      // Keep statusOverride synchronized when progress/subtasks update completedQuantity without explicit `status`
      if (!status && productionStage === undefined) {
        if (safeQty >= currentTargetQty) {
          currentNotesMeta.statusOverride = "completed";
          currentNotesMeta.isRevisionRequested = false;
          auditAction = "completed_task";
        } else if (safeQty > 0) {
          if (
            !currentNotesMeta.statusOverride ||
            currentNotesMeta.statusOverride === "todo" ||
            currentNotesMeta.statusOverride === "backlog" ||
            currentNotesMeta.statusOverride === "completed"
          ) {
            currentNotesMeta.statusOverride = "in_progress";
          }
        } else {
          if (
            currentNotesMeta.statusOverride === "completed" ||
            (currentNotesMeta.statusOverride === "in_progress" && prevCompletedQty > 0)
          ) {
            currentNotesMeta.statusOverride = "todo";
          }
        }
      }
    }

    const nextTargetStatus: TaskStatus = currentNotesMeta.statusOverride || prevTargetStatus;
    if (nextTargetStatus === "completed") {
      currentNotesMeta.completedAt = currentNotesMeta.completedAt || new Date().toISOString();
    } else {
      currentNotesMeta.completedAt = undefined;
    }

    if (
      nextTargetStatus !== prevTargetStatus ||
      (subColumnId !== undefined && subColumnId !== prevTargetSubCol)
    ) {
      const existingHist: StageHistoryEntry[] =
        Array.isArray(currentNotesMeta.stageHistory) &&
        currentNotesMeta.stageHistory.length > 0
          ? [...currentNotesMeta.stageHistory]
          : [
              {
                stage: prevTargetStatus,
                label: formatStageLabel(prevTargetStatus, prevTargetSubCol),
                timestamp: existing.created_at || new Date().toISOString(),
              },
            ];
      existingHist.push({
        stage: nextTargetStatus,
        label: formatStageLabel(nextTargetStatus, currentNotesMeta.subColumnId),
        timestamp: new Date().toISOString(),
        actorName,
      });
      currentNotesMeta.stageHistory = existingHist;
    }

    if (productionStage !== undefined) {
      currentNotesMeta.productionStage = productionStage;
    }

    updates.notes = stringifyNotes(currentNotesMeta);

    const { data: updatedRow, error: updateErr } = await supabaseAdmin
      .from("daily_team_targets")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (updateErr) {
      console.error("Update target error:", updateErr);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    // If this task is linked to an AdFlow creative (by adId or creativeName), sync stage/status to AdFlow
    if (
      (currentNotesMeta.adId || currentNotesMeta.creativeName) &&
      (productionStage !== undefined || status !== undefined || isRevisionRequested !== undefined)
    ) {
      try {
        const targetStage =
          currentNotesMeta.productionStage ||
          (isRevisionRequested
            ? "changes_requested"
            : nextTargetStatus === "completed"
            ? "approved"
            : nextTargetStatus === "in_review"
            ? "final_review"
            : nextTargetStatus === "in_progress"
            ? "editing"
            : "script_writing");

        const adPatch: Record<string, any> = {
          production_stage: targetStage,
          status: legacyAdStatusForStage(targetStage),
          approval_stage:
            targetStage === "approved"
              ? "complete"
              : targetStage === "final_review"
              ? "admin_final"
              : "manager_review",
          updated_at: new Date().toISOString(),
          workflow_status_changed_at: new Date().toISOString(),
        };
        if (targetStage === "approved") {
          adPatch.approved_at = new Date().toISOString();
          adPatch.final_approved_at = new Date().toISOString();
        }
        if (deliverableUrl) {
          adPatch.drive_url = deliverableUrl;
        }

        const filterQuery = currentNotesMeta.adId
          ? `id=eq.${encodeURIComponent(currentNotesMeta.adId)}`
          : `name=ilike.${encodeURIComponent(currentNotesMeta.creativeName!)}&deleted_at=is.null`;

        await fetch(`${ADFLOW_SUPABASE_URL}/rest/v1/ads?${filterQuery}`, {
          method: "PATCH",
          headers: getAdFlowHeaders(),
          body: JSON.stringify(adPatch),
        });
      } catch (err) {
        console.warn("Could not sync linked target task to AdFlow:", err);
      }
    }

    // Insert audit log
    try {
      await supabaseAdmin.from("audit_logs").insert({
        actor_id: verifiedActorId || existing.assigned_by || null,
        action: auditAction,
        target_type: "daily_team_target",
        target_id: id,
        metadata: {
          taskName: existing.task_name,
          ...auditMeta,
        },
      });
    } catch {}

    // Dispatch outbound webhooks for key lifecycle transitions
    if (isRevisionRequested === true) {
      dispatchWebhookEvent("task.revision_requested", {
        taskId: id,
        taskName: existing.task_name,
        revisionReason,
        revisionNotes,
        actorName,
      }).catch(() => {});
    } else if (status === "in_review") {
      dispatchWebhookEvent("task.review_submitted", {
        taskId: id,
        taskName: existing.task_name,
        deliverableUrl: deliverableUrl || currentNotesMeta.deliverableUrl,
        actorName,
      }).catch(() => {});
    } else if (status === "completed") {
      dispatchWebhookEvent("task.completed", {
        taskId: id,
        taskName: existing.task_name,
        completedQuantity: updates.completed_quantity ?? existing.completed_quantity,
        targetQuantity: currentTargetQty,
        actorName,
      }).catch(() => {});
    }

    return NextResponse.json({ ok: true, target: updatedRow });
  } catch (error: any) {
    console.error("PATCH /api/tasks error:", error);
    return NextResponse.json({ error: error.message || "Failed to update task" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    const actorId = searchParams.get("actorId");

    if (!id) {
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
    }

    const auth = await resolveRequestActor(req, actorId);
    const verifiedActorId = auth.actor?.id || actorId || null;

    // If AdFlow creative task: archive locally in `ad_overrides` (NEVER touch `ads` table!)
    if (id.startsWith("ad-")) {
      const realAdId = id.replace(/^ad-/, "");
      const db = loadLocalDb();
      if (!db.ad_overrides) db.ad_overrides = {};

      db.ad_overrides[realAdId] = {
        ...(db.ad_overrides[realAdId] || {}),
        isArchived: true,
        archivedAt: new Date().toISOString(),
        archivedBy: verifiedActorId,
        updatedAt: new Date().toISOString(),
      };
      saveLocalDb(db);

      dispatchWebhookEvent("task.archived", {
        taskId: id,
        archivedBy: auth.actor?.name || verifiedActorId,
      }).catch(() => {});

      return NextResponse.json({ ok: true, archived: true });
    }

    // Regular daily team target soft-delete
    const { data: existing } = await supabaseAdmin
      .from("daily_team_targets")
      .select("*")
      .eq("id", id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const currentNotesMeta = parseNotes(existing.notes || null);
    currentNotesMeta.isArchived = true;
    currentNotesMeta.archivedAt = new Date().toISOString();
    currentNotesMeta.archivedBy = verifiedActorId;

    const { error: updateErr } = await supabaseAdmin
      .from("daily_team_targets")
      .update({
        notes: stringifyNotes(currentNotesMeta),
        updated_at: new Date().toISOString(),
      })
      .eq("id", id);

    if (updateErr) {
      console.error("Soft-delete target error:", updateErr);
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    dispatchWebhookEvent("task.archived", {
      taskId: id,
      taskName: existing.task_name,
      archivedBy: auth.actor?.name || verifiedActorId,
    }).catch(() => {});

    return NextResponse.json({ ok: true, archived: true });
  } catch (error: any) {
    console.error("DELETE /api/tasks error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete task" }, { status: 500 });
  }
}
