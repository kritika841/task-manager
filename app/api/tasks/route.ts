import { NextResponse } from "next/server";
import { supabaseAdmin, dateInTargetTimeZone, isCanonicalAdflowTask } from "@/lib/supabase";
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
} from "@/lib/types";
import { getAllCommentsMap } from "@/lib/comments-store";
import { getEmployeeCode, getUserColor } from "@/lib/utils";

function getDepartment(role: string): string {
  switch (role) {
    case "admin":
      return "Executive & Admin";
    case "manager":
      return "Operations & Review";
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

interface ParsedNotes {
  description: string;
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
}

function parseNotes(raw: string | null): ParsedNotes {
  if (!raw) return { description: "" };
  try {
    if (raw.startsWith("{") && raw.includes('"__meta__":true')) {
      const parsed = JSON.parse(raw);
      return {
        description: parsed.desc || "",
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
      };
    }
  } catch {}
  return { description: raw };
}

function stringifyNotes(meta: ParsedNotes): string {
  const hasExtra =
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
    meta.archivedBy;

  if (!hasExtra) {
    return meta.description || "";
  }

  return JSON.stringify({
    __meta__: true,
    desc: meta.description || "",
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
  });
}

function parseUserMetadata(avatarUrl: string | null, name: string) {
  let color: string | undefined;
  let employeeCode: string | undefined;

  if (avatarUrl) {
    try {
      if (avatarUrl.startsWith("{") && avatarUrl.endsWith("}")) {
        const parsed = JSON.parse(avatarUrl);
        color = parsed.color;
        employeeCode = parsed.employeeCode;
      } else if (avatarUrl.startsWith("#")) {
        color = avatarUrl;
      }
    } catch {}
  }

  const code = getEmployeeCode(name, employeeCode);
  const resolvedColor = getUserColor(code, color);

  return { employeeCode: code, color: resolvedColor };
}

export async function GET(req: Request) {
  try {
    const today = dateInTargetTimeZone();
    const url = new URL(req.url);
    const includeArchived = url.searchParams.get("includeArchived") === "true";

    // 1. Ensure recurring delegator rules are materialized for today
    try {
      await supabaseAdmin.rpc("materialize_daily_task_rules", {
        p_start: today,
        p_end: today,
      });
    } catch (e) {
      console.warn("Could not auto-materialize delegator rules:", e);
    }

    // 2. Fetch active profiles (Filter out soft-deleted profiles!)
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
      const { employeeCode, color } = parseUserMetadata(p.avatar_url, p.name || p.email);
      return {
        id: p.id,
        name: p.name || p.email.split("@")[0],
        email: p.email,
        role: (p.role as Role) || "member",
        avatar: employeeCode.slice(0, 2),
        department: getDepartment(p.role),
        active: p.active !== false && !p.deleted_at,
        dailyCapacityUnits: getDailyCapacity(p.role),
        employeeCode,
        color,
        deletedAt: p.deleted_at,
      };
    });

    // 3. Fetch active ad creatives from Supabase Ads Management
    const { data: activeAds } = await supabaseAdmin
      .from("ads")
      .select(
        "id, name, status, production_stage, editor_id, creator_id, editing_started_at, shoot_completed_at, submitted_at, approved_at, drive_url, deadline, notes, created_at, updated_at"
      )
      .or("status.neq.approved,production_stage.neq.approved")
      .is("deleted_at", null)
      .order("updated_at", { ascending: false });

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

      // Priority
      let priority: TaskPriority = "medium";
      if (isCarried || (row.target_date < today && completedQty < targetQty)) {
        priority = "urgent";
      } else if (row.target_date === today && targetQty > 4) {
        priority = "high";
      }

      const assignee = users.find((u) => u.id === row.user_id);
      const project = assignee?.department || "Operations";
      const empCode = assignee?.employeeCode || getEmployeeCode(assignee?.name || "EMP");

      userTargetCounts[empCode] = (userTargetCounts[empCode] || 0) + 1;
      const taskNumber = `${empCode}-${String(userTargetCounts[empCode]).padStart(2, "0")}`;

      const tags: string[] = ["Daily Target"];
      if (isCarried) tags.push("Carried Forward");
      if (row.task_name.toLowerCase().includes("edit")) tags.push("Video Ads");
      if (row.task_name.toLowerCase().includes("script")) tags.push("Creative");
      if (row.task_name.toLowerCase().includes("shoot")) tags.push("Production");

      // Generate unit checklist subtasks
      const subtasks: Subtask[] = [];
      if (parsedNotes.customSubtasks && parsedNotes.customSubtasks.length > 0) {
        subtasks.push(...parsedNotes.customSubtasks);
      } else {
        const totalUnits = Math.max(targetQty, completedQty, 1);
        for (let i = 1; i <= totalUnits; i++) {
          const isDone = i <= completedQty;
          subtasks.push({
            id: `sub-${row.id}-${i}`,
            title: `Unit ${i} of ${row.task_name.replace(/\s*\(carried forward\)/i, "")}`,
            completed: isDone,
            completedAt: isDone ? row.updated_at : undefined,
            assignedTo: row.user_id,
            sortOrder: i,
            isCustom: false,
          });
        }
      }

      const taskComments = allComments[row.id] || [];

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
        completedQuantity: completedQty,
        manualCompletedQuantity: row.manual_completed_quantity || 0,
        autoCompletedQuantity: row.auto_completed_quantity || 0,
        isCarried,
        carriedFromTargetId: row.carried_from_target_id,
        deliverableUrl: parsedNotes.deliverableUrl || parsedNotes.deliverableAsset?.url,
        deliverableAsset: parsedNotes.deliverableAsset,
        isRevisionRequested: parsedNotes.isRevisionRequested,
        revisionReason: parsedNotes.revisionReason,
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
        isCanonicalAdflowTask: isStandardAdflow,
      };
    });

    // 8. Convert active AdFlow creatives into Task models
    // Rules:
    // - Current editing or actively worked creatives (editing_started_at or stage === 'editing') -> "in_progress"
    // - Not actively being worked upon -> "todo"
    // - Submitted for review / pending review -> "in_review"
    // - Task ID is the exact creative code: HIM0223, TAM0225, etc.
    const adCreativeTasks: Task[] = (activeAds || []).map((ad) => {
      // Determine assignee: if editing stage or editor assigned, assign to editor; else creator
      const isEditingStage =
        ad.production_stage === "editing" ||
        ad.production_stage === "ready_for_edit" ||
        Boolean(ad.editing_started_at);

      const assigneeId = (isEditingStage && ad.editor_id) ? ad.editor_id : (ad.creator_id || ad.editor_id || users[0]?.id || "");
      const assignee = users.find((u) => u.id === assigneeId);

      // Determine task status according to user specification:
      // Active editing creatives ONLY in in_progress; others in todo
      let status: TaskStatus = "todo";
      if (ad.status === "pending_review" || ad.production_stage === "creator_review" || ad.submitted_at) {
        status = "in_review";
      } else if (ad.editing_started_at || ad.production_stage === "editing") {
        status = "in_progress";
      } else if (ad.status === "approved" || ad.production_stage === "approved") {
        status = "completed";
      } else {
        status = "todo";
      }

      const priority: TaskPriority = (ad.deadline && ad.deadline < today) ? "urgent" : (status === "in_progress" ? "high" : "medium");

      const stageLabel =
        ad.production_stage === "editing"
          ? "Video Edit"
          : ad.production_stage === "ready_for_edit"
          ? "Queued for Edit"
          : ad.production_stage === "shoot_complete"
          ? "Raw Footage Review"
          : "Creative Shoot";

      const comments = allComments[`ad-${ad.id}`] || [];

      return {
        id: `ad-${ad.id}`,
        taskNumber: ad.name, // Real AdFlow creative code e.g. HIM0223, TAM0225
        title: `${ad.name} — ${stageLabel}`,
        description: `AdFlow creative [${ad.name}]. Production Stage: ${ad.production_stage || "Draft"}.${ad.notes ? `\n\nNotes: ${ad.notes}` : ""}`,
        status,
        priority,
        assigneeId,
        creatorId: ad.creator_id || users[0]?.id || "",
        dueDate: ad.deadline || today,
        subtasks: [
          {
            id: `sub-ad-${ad.id}-1`,
            title: `Produce & deliver creative: ${ad.name}`,
            completed: status === "completed",
            assignedTo: assigneeId,
            sortOrder: 1,
            isCustom: false,
          },
        ],
        project: assignee?.department || "Video Editing",
        tags: ["AdFlow", "Active Creative", ad.production_stage || "Production"],
        createdAt: ad.created_at || new Date().toISOString(),
        updatedAt: ad.updated_at || new Date().toISOString(),
        comments,
        targetQuantity: 1,
        completedQuantity: status === "completed" ? 1 : (status === "in_progress" ? 0 : 0),
        manualCompletedQuantity: 0,
        autoCompletedQuantity: status === "completed" ? 1 : 0,
        isCarried: false,
        deliverableUrl: ad.drive_url,
        adId: ad.id,
        creativeName: ad.name,
        productionStage: ad.production_stage,
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

    const userId = body.assigneeId;
    const taskName = (body.title || "Daily Task").trim();
    const targetDate = body.dueDate || today;
    const targetQuantity = Math.max(1, Number(body.targetQuantity) || 1);
    const assignedBy = body.creatorId || null;

    if (!userId) {
      return NextResponse.json({ error: "Assignee is required" }, { status: 400 });
    }

    const notesMeta: ParsedNotes = {
      description: body.description || "",
      deliverableUrl: body.deliverableUrl,
      deliverableAsset: body.deliverableAsset,
      blockedByTaskIds: body.blockedByTaskIds,
      statusOverride: body.status || "todo",
      customSubtasks: body.customSubtasks,
      startDate: body.startDate,
      dueTime: body.dueTime,
      estimatedHours: body.estimatedHours,
    };

    const initialCompleted = body.status === "completed" ? targetQuantity : 0;

    // Insert into daily_team_targets
    const { data: newRow, error } = await supabaseAdmin
      .from("daily_team_targets")
      .insert({
        user_id: userId,
        target_date: targetDate,
        task_name: taskName,
        target_quantity: targetQuantity,
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

    const actorName = await getActorName(assignedBy);

    // Deliver notification to targeted assignee
    await sendTargetedNotification(
      userId,
      `New Task Assigned: ${taskName}`,
      `${actorName} assigned "${taskName}" (${targetQuantity} units) due on ${targetDate}.`
    );

    // Insert audit log
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: assignedBy,
      action: "created_task",
      target_type: "daily_team_target",
      target_id: newRow.id,
      metadata: {
        taskName,
        targetQuantity,
        targetDate,
        assigneeId: userId,
      },
    });

    return NextResponse.json({ ok: true, target: newRow });
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
    } = body;

    if (!id) {
      return NextResponse.json({ error: "Task ID is required" }, { status: 400 });
    }

    // 1. Handle ad creative task updates (id starts with 'ad-')
    if (typeof id === "string" && id.startsWith("ad-")) {
      const realAdId = id.replace("ad-", "");
      const adUpdates: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (assigneeId) {
        adUpdates.editor_id = assigneeId;
      }

      if (dueDate) {
        adUpdates.deadline = dueDate;
      }

      if (deliverableUrl) {
        adUpdates.drive_url = deliverableUrl;
      }

      // Handle status mappings directly to Supabase ads table
      if (status === "in_progress") {
        adUpdates.production_stage = "editing";
        adUpdates.editing_started_at = new Date().toISOString();
      } else if (status === "todo") {
        adUpdates.production_stage = "ready_for_edit";
        adUpdates.editing_started_at = null;
      } else if (status === "in_review") {
        adUpdates.production_stage = "creator_review";
        adUpdates.status = "pending_review";
        adUpdates.submitted_at = new Date().toISOString();
      } else if (status === "completed") {
        adUpdates.production_stage = "approved";
        adUpdates.status = "approved";
        adUpdates.approved_at = new Date().toISOString();
      }

      const { data: updatedAd, error: adErr } = await supabaseAdmin
        .from("ads")
        .update(adUpdates)
        .eq("id", realAdId)
        .select()
        .single();

      if (adErr) {
        console.error("Update ad error:", adErr);
        return NextResponse.json({ error: adErr.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true, target: updatedAd });
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
    if (description !== undefined) currentNotesMeta.description = description;
    if (deliverableUrl !== undefined) currentNotesMeta.deliverableUrl = deliverableUrl;
    if (deliverableAsset !== undefined) currentNotesMeta.deliverableAsset = deliverableAsset;
    if (isRevisionRequested !== undefined) currentNotesMeta.isRevisionRequested = isRevisionRequested;
    if (revisionReason !== undefined) currentNotesMeta.revisionReason = revisionReason;
    if (revisionNotes !== undefined) currentNotesMeta.revisionNotes = revisionNotes;
    if (blockedByTaskIds !== undefined) currentNotesMeta.blockedByTaskIds = blockedByTaskIds;
    if (customSubtasks !== undefined) currentNotesMeta.customSubtasks = customSubtasks;
    if (startDate !== undefined) currentNotesMeta.startDate = startDate;
    if (dueTime !== undefined) currentNotesMeta.dueTime = dueTime;
    if (estimatedHours !== undefined) currentNotesMeta.estimatedHours = estimatedHours;
    if (actualHours !== undefined) currentNotesMeta.actualHours = actualHours;
    if (timeTracking !== undefined) currentNotesMeta.timeTracking = timeTracking;

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    let auditAction = "updated_task";
    const auditMeta: Record<string, any> = {};
    const actorName = await getActorName(actorId || existing.assigned_by);

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

    // Insert audit log
    try {
      await supabaseAdmin.from("audit_logs").insert({
        actor_id: actorId || existing.assigned_by || null,
        action: auditAction,
        target_type: "daily_team_target",
        target_id: id,
        metadata: {
          taskName: existing.task_name,
          ...auditMeta,
        },
      });
    } catch {}

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

    // If ad creative task: soft-delete in ads table
    if (id.startsWith("ad-")) {
      const realAdId = id.replace("ad-", "");
      const { error: adErr } = await supabaseAdmin
        .from("ads")
        .update({
          deleted_at: new Date().toISOString(),
          deleted_by: actorId || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", realAdId);

      if (adErr) {
        return NextResponse.json({ error: adErr.message }, { status: 500 });
      }

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
    currentNotesMeta.archivedBy = actorId || null;

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

    return NextResponse.json({ ok: true, archived: true });
  } catch (error: any) {
    console.error("DELETE /api/tasks error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete task" }, { status: 500 });
  }
}
