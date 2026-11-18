import { NextResponse } from "next/server";
import { ADFLOW_SUPABASE_URL } from "@/lib/supabase";
import {
  getAdFlowHeaders,
  ADFLOW_PRODUCTION_STAGES,
  mapAdFlowStageToTaskStatus,
  legacyAdStatusForStage,
} from "@/lib/adflow-bridge";
import { loadLocalDb, saveLocalDb } from "@/lib/local-supabase-fallback";
import { canReviewTasks, resolveRequestActor } from "@/lib/auth-server";
import { StageHistoryEntry, TaskStatus } from "@/lib/types";
import { parseGoogleDriveVideoFileUrl } from "@/lib/drive-urls";

function parseDriveId(url: string | undefined | null): {
  fileId: string | null;
  previewUrl: string | null;
  thumbnailUrl: string | null;
} {
  if (!url || !url.trim()) {
    return { fileId: null, previewUrl: null, thumbnailUrl: null };
  }
  const trimmed = url.trim();
  const match =
    trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) ||
    trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (!match) {
    return { fileId: null, previewUrl: null, thumbnailUrl: null };
  }
  const fileId = match[1];
  return {
    fileId,
    previewUrl: `https://drive.google.com/file/d/${fileId}/preview`,
    thumbnailUrl: `https://drive.google.com/thumbnail?id=${fileId}&sz=w640`,
  };
}

function getStageLabel(stageId: string): string {
  const found = ADFLOW_PRODUCTION_STAGES.find((s) => s.id === stageId);
  return found ? found.label : stageId.replace(/_/g, " ");
}

export async function GET(req: Request) {
  try {
    const { actor } = await resolveRequestActor(req);
    if (!actor) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    const { searchParams } = new URL(req.url);
    const adId = searchParams.get("adId")?.replace(/^ad-/, "") || "";
    const creativeName = searchParams.get("creativeName")?.trim() || "";
    const headers = getAdFlowHeaders();

    const [campaignsRes, productsRes, profilesRes] = await Promise.all([
      fetch(`${ADFLOW_SUPABASE_URL}/rest/v1/campaigns?active=eq.true&select=id,name&order=name.asc`, {
        headers,
      }),
      fetch(`${ADFLOW_SUPABASE_URL}/rest/v1/products?active=eq.true&select=id,name,sku&order=name.asc`, {
        headers,
      }),
      fetch(`${ADFLOW_SUPABASE_URL}/rest/v1/profiles?active=eq.true&deleted_at=is.null&select=id,name,email,role&order=name.asc`, {
        headers,
      }),
    ]);

    const campaigns = campaignsRes.ok ? await campaignsRes.json() : [];
    const products = productsRes.ok ? await productsRes.json() : [];
    const profiles = profilesRes.ok ? await profilesRes.json() : [];

    let ad: Record<string, any> | null = null;
    if (adId) {
      const adRes = await fetch(
        `${ADFLOW_SUPABASE_URL}/rest/v1/ads?id=eq.${encodeURIComponent(adId)}&select=*`,
        { headers }
      );
      if (adRes.ok) {
        const rows = await adRes.json();
        ad = Array.isArray(rows) && rows[0] ? rows[0] : null;
      }
    } else if (creativeName) {
      const adRes = await fetch(
        `${ADFLOW_SUPABASE_URL}/rest/v1/ads?name=ilike.${encodeURIComponent(creativeName)}&deleted_at=is.null&select=*`,
        { headers }
      );
      if (adRes.ok) {
        const rows = await adRes.json();
        ad = Array.isArray(rows) && rows[0] ? rows[0] : null;
      }
    }

    let reviews: Record<string, any>[] = [];
    let activityLogs: Record<string, any>[] = [];

    if (ad?.id) {
      const [revRes, actRes] = await Promise.all([
        fetch(
          `${ADFLOW_SUPABASE_URL}/rest/v1/review_actions?ad_id=eq.${encodeURIComponent(ad.id)}&select=*&order=created_at.desc&limit=20`,
          { headers }
        ),
        fetch(
          `${ADFLOW_SUPABASE_URL}/rest/v1/activity_logs?ad_id=eq.${encodeURIComponent(ad.id)}&select=*&order=created_at.desc&limit=25`,
          { headers }
        ),
      ]);
      reviews = revRes.ok ? await revRes.json() : [];
      activityLogs = actRes.ok ? await actRes.json() : [];
    }

    return NextResponse.json({
      ok: true,
      ad,
      campaigns,
      products,
      profiles,
      reviews,
      activityLogs,
      stages: ADFLOW_PRODUCTION_STAGES,
    });
  } catch (error: any) {
    console.error("GET /api/adflow/control error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to load AdFlow details" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      action,
      adId: rawAdId,
      taskId,
      creativeName,
      note = "",
      target = "editor", // "creator" | "editor"
      productionStage,
      editorId,
      creatorId,
      campaignId,
      productId,
      scriptText,
      rawFootageUrl,
      driveUrl,
      deadline,
      notes,
      platforms,
      editingFreeze,
    } = body;

    const { actor } = await resolveRequestActor(req);
    if (!actor) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    const isEditorAction = action === "start_editing" || action === "submit_edit";
    const isCreatorStageHandoff =
      action === "update_stage" &&
      ["ready_to_shoot", "shoot_complete", "ready_for_edit"].includes(String(productionStage || ""));
    const isCreatorReviewAction =
      (action === "approve" || action === "request_changes") &&
      actor.role === "content_creator";
    if (!canReviewTasks(actor.role) && !isEditorAction && !isCreatorStageHandoff && !isCreatorReviewAction) {
      return NextResponse.json({ error: "Review permissions are required." }, { status: 403 });
    }
    const { id: actorId, name: actorName } = actor;
    const headers = {
      ...getAdFlowHeaders(),
      Prefer: "return=representation",
    };

    const nowIso = new Date().toISOString();

    // Action 0: Create a new Creative in AdFlow (linked to Task Manager's Creative ID)
    if (action === "create_creative") {
      if (!creativeName || !creatorId) {
        return NextResponse.json(
          { error: "creativeName and creatorId are required to create an AdFlow creative" },
          { status: 400 }
        );
      }

      // Resolve campaign & product defaults if not provided
      let resolvedCampaignId = campaignId;
      let resolvedProductId = productId;

      if (!resolvedCampaignId) {
        const cRes = await fetch(
          `${ADFLOW_SUPABASE_URL}/rest/v1/campaigns?active=eq.true&select=id&limit=1`,
          { headers: getAdFlowHeaders() }
        );
        const cRows = cRes.ok ? await cRes.json() : [];
        resolvedCampaignId = cRows[0]?.id || "246b4cb9-c725-4c45-b6bd-6b1b8604bc50";
      }

      if (!resolvedProductId) {
        const pRes = await fetch(
          `${ADFLOW_SUPABASE_URL}/rest/v1/products?active=eq.true&select=id&limit=1`,
          { headers: getAdFlowHeaders() }
        );
        const pRows = pRes.ok ? await pRes.json() : [];
        resolvedProductId = pRows[0]?.id || "c5eb1ae4-5333-4a35-be3f-a5a7b7b984c6";
      }

      const initialStage = productionStage || "script_writing";
      const stageIdx = ADFLOW_PRODUCTION_STAGES.findIndex((s) => s.id === initialStage);
      const driveParsed = parseDriveId(driveUrl);
      const cleanScript = (scriptText || `Creative script for ${creativeName}`).trim();

      const insertPayload: Record<string, any> = {
        name: creativeName.trim().toUpperCase(),
        campaign_id: resolvedCampaignId,
        product_id: resolvedProductId,
        creator_id: creatorId,
        editor_id: editorId || null,
        assigned_at: editorId ? nowIso : null,
        production_stage: initialStage,
        status: legacyAdStatusForStage(initialStage),
        approval_stage: initialStage === "approved" ? "complete" : initialStage === "final_review" ? "admin_final" : "manager_review",
        script_text: cleanScript,
        script_html: `<p>${cleanScript.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>")}</p>`,
        raw_footage_url: rawFootageUrl || null,
        drive_url: driveUrl || null,
        drive_file_id: driveParsed.fileId,
        preview_url: driveParsed.previewUrl,
        thumbnail_url: driveParsed.thumbnailUrl,
        ad_type: "video",
        platforms: Array.isArray(platforms) && platforms.length > 0 ? platforms : ["Meta Ads", "Social Media"],
        deadline: deadline || null,
        notes: notes || null,
        script_ready_at: stageIdx >= 1 ? nowIso : null,
        shoot_completed_at: stageIdx >= 2 ? nowIso : null,
        raw_footage_shared_at: stageIdx >= 3 && rawFootageUrl ? nowIso : null,
        editing_started_at: stageIdx >= 4 ? nowIso : null,
        submitted_at: stageIdx >= 5 ? nowIso : null,
        creator_reviewed_at: stageIdx >= 6 ? nowIso : null,
        final_approved_at: initialStage === "approved" ? nowIso : null,
        approved_at: initialStage === "approved" ? nowIso : null,
      };

      const createRes = await fetch(`${ADFLOW_SUPABASE_URL}/rest/v1/ads`, {
        method: "POST",
        headers,
        body: JSON.stringify(insertPayload),
      });

      if (!createRes.ok) {
        const errText = await createRes.text();
        return NextResponse.json(
          { error: `Failed to create AdFlow creative: ${errText}` },
          { status: 400 }
        );
      }

      const createdRows = await createRes.json();
      const createdAd = Array.isArray(createdRows) ? createdRows[0] : createdRows;

      // Log activity in AdFlow
      await fetch(`${ADFLOW_SUPABASE_URL}/rest/v1/activity_logs`, {
        method: "POST",
        headers: getAdFlowHeaders(),
        body: JSON.stringify({
          ad_id: createdAd.id,
          actor_id: actorId,
          action: "creator_item_created",
          metadata: {
            production_stage: initialStage,
            new_stage: initialStage,
            source: "task_manager",
            creative_id: createdAd.name,
          },
        }),
      }).catch(() => {});

      // Sync linked Task Manager task if present
      syncTaskManagerWithAdFlowCreative(createdAd, actorName);

      return NextResponse.json({
        ok: true,
        ad: createdAd,
        message: `Creative ${createdAd.name} created in AdFlow (${getStageLabel(initialStage)}).`,
      });
    }

    // Resolve existing AdFlow creative by adId or creativeName
    const cleanAdId = rawAdId ? String(rawAdId).replace(/^ad-/, "") : "";
    let existingAd: Record<string, any> | null = null;

    if (cleanAdId) {
      const res = await fetch(
        `${ADFLOW_SUPABASE_URL}/rest/v1/ads?id=eq.${encodeURIComponent(cleanAdId)}&select=*`,
        { headers: getAdFlowHeaders() }
      );
      if (res.ok) {
        const rows = await res.json();
        existingAd = Array.isArray(rows) && rows[0] ? rows[0] : null;
      }
    }

    if (!existingAd && creativeName) {
      const res = await fetch(
        `${ADFLOW_SUPABASE_URL}/rest/v1/ads?name=ilike.${encodeURIComponent(creativeName.trim())}&deleted_at=is.null&select=*`,
        { headers: getAdFlowHeaders() }
      );
      if (res.ok) {
        const rows = await res.json();
        existingAd = Array.isArray(rows) && rows[0] ? rows[0] : null;
      }
    }

    if (!existingAd) {
      return NextResponse.json(
        { error: "AdFlow creative not found. Create it in AdFlow first or materialize it from Task Manager." },
        { status: 404 }
      );
    }

    const prevStage = existingAd.production_stage;
    if (
      !canReviewTasks(actor.role) &&
      (action === "approve" || action === "request_changes")
    ) {
      const canCreatorReview =
        String(existingAd.production_stage || "").toLowerCase() === "creator_review" &&
        (actor.id === existingAd.creator_id || actor.role === "content_creator");
      if (!canCreatorReview) {
        return NextResponse.json(
          { error: "Review permissions are required." },
          { status: 403 }
        );
      }
    }
    const patch: Record<string, any> = {
      updated_at: nowIso,
      ...(action !== "assign_editor" && { workflow_status_changed_at: nowIso }),
    };

    let reviewDecision: "approve" | "request_changes" | "reject" | null = null;
    let activityAction = "admin_creative_override";
    let activityMeta: Record<string, any> = {
      previous_stage: prevStage,
      source: "task_manager",
    };
    let notifyUserIds: string[] = [];
    let notifyTitle = "";
    let notifyBody = "";

    if (action === "approve") {
      reviewDecision = "approve";
      const isFinalReviewStage =
        canReviewTasks(actor.role) &&
        (existingAd.production_stage === "final_review" ||
          existingAd.approval_stage === "admin_final" ||
          (actor.role === "admin" && body.finalApprove === true));

      if (!isFinalReviewStage) {
        patch.production_stage = "final_review";
        patch.status = "pending_review";
        patch.approval_stage = "admin_final";
        patch.creator_reviewed_at = nowIso;
        activityAction = "creator_review_approved";
        activityMeta = {
          ...activityMeta,
          production_stage: "final_review",
          new_stage: "final_review",
          approval_stage: "admin_final",
          note: note.trim() || null,
        };
        notifyUserIds = [existingAd.creator_id, existingAd.editor_id].filter(Boolean);
        notifyTitle = "Moved to final review";
        notifyBody = note.trim()
          ? `${actorName} approved ${existingAd.name} for Final Review: "${note.trim()}"`
          : `${actorName} approved ${existingAd.name} to Final Review.`;
      } else {
        patch.production_stage = "approved";
        patch.status = "approved";
        patch.approval_stage = "complete";
        patch.approved_at = nowIso;
        patch.final_approved_at = nowIso;
        patch.creator_reviewed_at = existingAd.creator_reviewed_at || nowIso;
        activityAction = "final_approval_granted";
        activityMeta = {
          ...activityMeta,
          production_stage: "approved",
          new_stage: "approved",
          approval_stage: "complete",
          note: note.trim() || null,
        };
        notifyUserIds = [existingAd.creator_id, existingAd.editor_id].filter(Boolean);
        notifyTitle = "Ad approved";
        notifyBody = note.trim()
          ? `${actorName} approved ${existingAd.name}: "${note.trim()}"`
          : `${actorName} approved ${existingAd.name} from Task Manager.`;
      }
    } else if (action === "request_changes") {
      if (!note.trim()) {
        return NextResponse.json(
          { error: "Revision feedback note is required when requesting changes." },
          { status: 400 }
        );
      }
      reviewDecision = "request_changes";
      const resolvedTarget: "creator" | "editor" =
        target === "creator" ? "creator" : "editor";
      const nextStage =
        resolvedTarget === "creator"
          ? "creator_changes_requested"
          : "changes_requested";

      patch.production_stage = nextStage;
      patch.status = "changes_requested";
      patch.approval_stage = "manager_review";
      patch.approved_at = null;
      patch.final_approved_at = null;

      const isReopen = prevStage === "approved";
      activityAction = isReopen
        ? "approved_ad_reopened"
        : resolvedTarget === "creator"
        ? "final_changes_requested_to_creator"
        : "final_changes_requested_to_editor";

      activityMeta = {
        ...activityMeta,
        production_stage: nextStage,
        new_stage: nextStage,
        target: resolvedTarget,
        note: note.trim(),
        ...(isReopen ? { reopened: true } : {}),
      };

      notifyUserIds =
        resolvedTarget === "creator"
          ? [existingAd.creator_id].filter(Boolean)
          : [existingAd.editor_id || existingAd.creator_id].filter(Boolean);
      notifyTitle =
        resolvedTarget === "creator"
          ? "Changes requested (Creator)"
          : "Changes requested (Editor)";
      notifyBody = `${existingAd.name}: ${note.trim()}`;
    } else if (action === "reject") {
      if (!note.trim()) {
        return NextResponse.json(
          { error: "A rejection reason is required when rejecting a creative." },
          { status: 400 }
        );
      }
      reviewDecision = "reject";
      const resolvedTarget: "creator" | "editor" =
        target === "creator" ? "creator" : "editor";
      const nextStage =
        resolvedTarget === "creator"
          ? "creator_changes_requested"
          : "changes_requested";

      patch.production_stage = nextStage;
      patch.status = "rejected";
      patch.approval_stage = "complete";
      patch.approved_at = null;
      patch.final_approved_at = null;

      activityAction = "creative_rejected";
      activityMeta = {
        ...activityMeta,
        production_stage: nextStage,
        new_stage: nextStage,
        target: resolvedTarget,
        note: note.trim(),
        rejected: true,
      };

      notifyUserIds = [existingAd.creator_id, existingAd.editor_id].filter(Boolean);
      notifyTitle = `Creative Rejected: ${existingAd.name}`;
      notifyBody = note.trim();
    } else if (action === "assign_editor") {
      if (editorId !== null && (typeof editorId !== "string" || !editorId.trim())) {
        return NextResponse.json({ error: "Select an editor or clear the assignment." }, { status: 400 });
      }
      patch.editor_id = editorId;
      if (editorId !== existingAd.editor_id) patch.assigned_at = editorId ? nowIso : null;
      activityMeta = { ...activityMeta, editor_id: editorId };
    } else if (action === "update_stage") {
      const nextStage = productionStage;
      if (
        !ADFLOW_PRODUCTION_STAGES.some((stage) => stage.id === nextStage) ||
        ["approved", "creator_changes_requested", "changes_requested"].includes(nextStage)
      ) {
        return NextResponse.json({ error: "Choose a production stage or use the review actions." }, { status: 400 });
      }
      if (!canReviewTasks(actor.role)) {
        if (
          actor.id !== existingAd.creator_id ||
          !["ready_to_shoot", "shoot_complete", "ready_for_edit"].includes(nextStage)
        ) {
          return NextResponse.json(
            { error: "Only the assigned content creator or a manager can advance this creative stage." },
            { status: 403 }
          );
        }
      }
      const stageIdx = ADFLOW_PRODUCTION_STAGES.findIndex((s) => s.id === nextStage);
      patch.production_stage = nextStage;
      patch.status = legacyAdStatusForStage(nextStage);
      patch.approval_stage =
        nextStage === "approved"
          ? "complete"
          : nextStage === "final_review"
          ? "admin_final"
          : "manager_review";

      if (stageIdx >= 1 && !existingAd.script_ready_at) patch.script_ready_at = nowIso;
      if (stageIdx >= 2 && !existingAd.shoot_completed_at) patch.shoot_completed_at = nowIso;
      if (stageIdx >= 3 && !existingAd.raw_footage_shared_at) patch.raw_footage_shared_at = nowIso;
      if (stageIdx >= 4 && !existingAd.editing_started_at) patch.editing_started_at = nowIso;
      if (stageIdx >= 5 && !existingAd.submitted_at) patch.submitted_at = nowIso;
      if (stageIdx >= 6 && !existingAd.creator_reviewed_at) patch.creator_reviewed_at = nowIso;
      if (nextStage === "approved") {
        patch.approved_at = existingAd.approved_at || nowIso;
        patch.final_approved_at = existingAd.final_approved_at || nowIso;
      }

      if (canReviewTasks(actor.role) && editorId !== undefined) {
        patch.editor_id = editorId || null;
        if (editorId && editorId !== existingAd.editor_id) {
          patch.assigned_at = nowIso;
        }
      }
      if (rawFootageUrl !== undefined) {
        if (typeof rawFootageUrl === "string" && rawFootageUrl.trim()) {
          const trimmedRaw = rawFootageUrl.trim();
          if (!/^https?:\/\//i.test(trimmedRaw)) {
            return NextResponse.json(
              { error: "rawFootageUrl must be a valid http:// or https:// URL." },
              { status: 400 }
            );
          }
          patch.raw_footage_url = trimmedRaw;
        } else {
          patch.raw_footage_url = null;
        }
      }
      if (canReviewTasks(actor.role) && driveUrl !== undefined) {
        if (typeof driveUrl === "string" && driveUrl.trim() && !/^https?:\/\//i.test(driveUrl.trim())) {
          return NextResponse.json(
            { error: "driveUrl must be a valid http:// or https:// URL." },
            { status: 400 }
          );
        }
        patch.drive_url = driveUrl || null;
        const parsedDrive = parseDriveId(driveUrl);
        if (parsedDrive.fileId) {
          patch.drive_file_id = parsedDrive.fileId;
          patch.preview_url = parsedDrive.previewUrl;
          patch.thumbnail_url = parsedDrive.thumbnailUrl || existingAd.thumbnail_url;
        }
      }
      if (scriptText !== undefined && scriptText.trim()) {
        const cleanScript = scriptText.trim();
        patch.script_text = cleanScript;
        patch.script_html = `<p>${cleanScript.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\n/g, "<br/>")}</p>`;
      }
      if (canReviewTasks(actor.role) && deadline !== undefined) {
        patch.deadline = deadline || null;
      }
      if (canReviewTasks(actor.role) && notes !== undefined) {
        patch.notes = notes || null;
      }
      if (canReviewTasks(actor.role) && editingFreeze !== undefined) {
        patch.editing_freeze = editingFreeze;
      }

      activityAction = canReviewTasks(actor.role)
        ? "admin_creative_override"
        : "creator_stage_updated";
      activityMeta = {
        ...activityMeta,
        production_stage: nextStage,
        new_stage: nextStage,
        editor_id: patch.editor_id ?? existingAd.editor_id,
        note: note.trim() || null,
      };
    } else if (action === "start_editing") {
      if (actor.id !== existingAd.editor_id && !canReviewTasks(actor.role)) {
        return NextResponse.json(
          { error: "Only the assigned editor or a manager can start editing." },
          { status: 403 }
        );
      }
      if (existingAd.editing_freeze === "frozen") {
        return NextResponse.json(
          { error: "Editing is frozen for this creative by a manager." },
          { status: 409 }
        );
      }
      patch.production_stage = "editing";
      patch.status = "draft";
      patch.editing_started_at = nowIso;
      activityAction = "editing_started";
      activityMeta = {
        ...activityMeta,
        previous_stage: prevStage,
        production_stage: "editing",
      };
      notifyUserIds = [existingAd.creator_id].filter(Boolean);
      notifyTitle = "Editing started";
      notifyBody = `${actorName} started editing ${existingAd.name}.`;
    } else if (action === "submit_edit") {
      if (actor.id !== existingAd.editor_id && !canReviewTasks(actor.role)) {
        return NextResponse.json(
          { error: "Only the assigned editor or a manager can submit this video." },
          { status: 403 }
        );
      }
      if (existingAd.editing_freeze === "frozen") {
        return NextResponse.json(
          { error: "Editing is frozen for this creative by a manager." },
          { status: 409 }
        );
      }
      if (!driveUrl || typeof driveUrl !== "string" || !driveUrl.trim()) {
        return NextResponse.json(
          { error: "A Google Drive video file URL is required." },
          { status: 400 }
        );
      }
      const driveResult = parseGoogleDriveVideoFileUrl(driveUrl);
      if (driveResult.error || !driveResult.result) {
        return NextResponse.json(
          { error: driveResult.error || "Please provide a valid single Google Drive video file URL." },
          { status: 400 }
        );
      }
      if (existingAd.production_stage === "changes_requested" && !body.changesConfirmed) {
        return NextResponse.json(
          { error: "Please confirm that all requested changes were addressed before submitting." },
          { status: 400 }
        );
      }
      patch.drive_url = driveUrl.trim();
      patch.drive_file_id = driveResult.result.fileId;
      patch.preview_url = driveResult.result.previewUrl;
      patch.thumbnail_url = driveResult.result.thumbnailUrl || existingAd.thumbnail_url;
      patch.editor_notes = (note || "").trim() || null;
      patch.production_stage = "creator_review";
      patch.approval_stage = "manager_review";
      patch.submitted_at = nowIso;
      patch.creator_reviewed_at = null;
      patch.final_approved_at = null;
      activityAction =
        prevStage === "changes_requested"
          ? "edited_video_resubmitted"
          : "edited_video_submitted";
      activityMeta = {
        ...activityMeta,
        previous_stage: prevStage,
        production_stage: "creator_review",
        drive_url: driveUrl.trim(),
      };
      notifyUserIds = [existingAd.creator_id].filter(Boolean);
      notifyTitle = "Video submitted for review";
      notifyBody = `${actorName} submitted the edited video for ${existingAd.name}.`;
    } else if (action === "unfreeze_editing") {
      patch.editing_freeze = "unfrozen";
      activityAction = "editor_unfreeze_override";
      activityMeta = { ...activityMeta, editing_freeze: "unfrozen" };
    } else if (action === "freeze_editing") {
      patch.editing_freeze = "frozen";
      activityAction = "editor_freeze_override";
      activityMeta = { ...activityMeta, editing_freeze: "frozen" };
    } else {
      return NextResponse.json({ error: `Unsupported action: ${action}` }, { status: 400 });
    }

    // 1. Update AdFlow `ads` table
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
      return NextResponse.json(
        { error: `Failed to update AdFlow creative: ${errText}` },
        { status: 400 }
      );
    }

    const updatedRows = await updateRes.json();
    let updatedAd = Array.isArray(updatedRows) && updatedRows[0] ? updatedRows[0] : { ...existingAd, ...patch };

    // If action === "reject", ensure `status` stays "rejected" if DB trigger set it to "changes_requested"
    if (action === "reject") {
      updatedAd.status = "rejected";
    }

    // 2. Insert into `review_actions` if approve / request_changes / reject
    if (reviewDecision) {
      await fetch(`${ADFLOW_SUPABASE_URL}/rest/v1/review_actions`, {
        method: "POST",
        headers: getAdFlowHeaders(),
        body: JSON.stringify({
          ad_id: existingAd.id,
          reviewer_id: actorId,
          decision: reviewDecision,
          note: note.trim() || null,
        }),
      }).catch(() => {});
    }

    // 3. Insert into `activity_logs`
    await fetch(`${ADFLOW_SUPABASE_URL}/rest/v1/activity_logs`, {
      method: "POST",
      headers: getAdFlowHeaders(),
      body: JSON.stringify({
        ad_id: existingAd.id,
        actor_id: actorId,
        action: activityAction,
        metadata: activityMeta,
      }),
    }).catch(() => {});

    // 4. Send notifications in AdFlow
    const uniqueNotifyIds = Array.from(new Set(notifyUserIds));
    for (const uid of uniqueNotifyIds) {
      await fetch(`${ADFLOW_SUPABASE_URL}/rest/v1/notifications`, {
        method: "POST",
        headers: getAdFlowHeaders(),
        body: JSON.stringify({
          user_id: uid,
          ad_id: existingAd.id,
          title: notifyTitle,
          body: notifyBody,
        }),
      }).catch(() => {});
    }

    // 5. Synchronize Task Manager state (`ad_overrides` & linked `daily_team_targets` row)
    if (action !== "assign_editor") {
      syncTaskManagerWithAdFlowCreative(updatedAd, actorName, {
        action,
        note: note.trim(),
        target,
        taskId,
      });
    } else {
      const db = loadLocalDb();
      const override = db.ad_overrides[updatedAd.id];
      if (override?.assigneeId && override.assigneeId === existingAd.editor_id) {
        override.assigneeId = updatedAd.editor_id || updatedAd.creator_id;
      }
      for (const row of db.daily_team_targets) {
        let meta;
        try {
          meta = typeof row.notes === "string" && row.notes.startsWith("{") ? JSON.parse(row.notes) : {};
        } catch {
          continue;
        }
        if (
          (meta?.adId === updatedAd.id ||
            String(meta?.creativeName || "").toUpperCase() === String(updatedAd.name).toUpperCase()) &&
          row.user_id === existingAd.editor_id
        ) {
          row.user_id = updatedAd.editor_id || updatedAd.creator_id || row.user_id;
        }
      }
      saveLocalDb(db);
    }

    return NextResponse.json({
      ok: true,
      ad: updatedAd,
      action,
      message:
        action === "approve"
          ? `Approved ${updatedAd.name} in AdFlow.`
          : action === "request_changes"
          ? `Sent revision request to ${target} for ${updatedAd.name}.`
          : action === "reject"
          ? `Rejected ${updatedAd.name} in AdFlow.`
          : action === "assign_editor"
          ? `Updated the editor assignment for ${updatedAd.name}.`
          : action === "start_editing"
          ? `Started editing ${updatedAd.name}.`
          : action === "submit_edit"
          ? `Submitted edited video for ${updatedAd.name} for review.`
          : action === "unfreeze_editing"
          ? `Unfroze editing limit for ${updatedAd.name}.`
          : action === "freeze_editing"
          ? `Frozen editing for ${updatedAd.name}.`
          : `Updated ${updatedAd.name} stage to ${getStageLabel(updatedAd.production_stage)}.`,
    });
  } catch (error: any) {
    console.error("POST /api/adflow/control error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to execute AdFlow control action" },
      { status: 500 }
    );
  }
}

function syncTaskManagerWithAdFlowCreative(
  ad: Record<string, any>,
  actorName: string,
  opts?: {
    action?: string;
    note?: string;
    target?: "creator" | "editor";
    taskId?: string;
  }
) {
  const db = loadLocalDb();
  if (!db.ad_overrides) db.ad_overrides = {};

  const nowIso = new Date().toISOString();
  const mappedStatus: TaskStatus = mapAdFlowStageToTaskStatus(ad.production_stage, ad.status);
  const stageLabel = getStageLabel(ad.production_stage);

  const isShootOrCreatorStage = [
    "script_writing",
    "ready_to_shoot",
    "shoot_complete",
    "creator_changes_requested",
  ].includes(ad.production_stage);

  const resolvedAssigneeId = isShootOrCreatorStage
    ? ad.creator_id || ad.editor_id
    : ad.editor_id || ad.creator_id;

  const isRevision =
    opts?.action === "request_changes" ||
    opts?.action === "reject" ||
    ad.production_stage === "changes_requested" ||
    ad.production_stage === "creator_changes_requested";

  const revisionReason =
    opts?.action === "reject"
      ? "Rejected in Review"
      : ad.production_stage === "creator_changes_requested"
      ? "Creator Changes Requested"
      : ad.production_stage === "changes_requested"
      ? "Editor Changes Requested"
      : undefined;

  // 1. Update `ad_overrides[ad.id]`
  const existingOverride = db.ad_overrides[ad.id] || {};
  const existingHist: StageHistoryEntry[] = Array.isArray(existingOverride.stageHistory)
    ? [...existingOverride.stageHistory]
    : [];

  existingHist.push({
    stage: mappedStatus,
    label: `${stageLabel}${opts?.action === "reject" ? " (Rejected)" : ""}`,
    timestamp: nowIso,
    actorName,
  });

  db.ad_overrides[ad.id] = {
    ...existingOverride,
    status: mappedStatus,
    productionStage: ad.production_stage,
    adStatus: ad.status,
    assigneeId: resolvedAssigneeId || existingOverride.assigneeId,
    deliverableUrl: ad.drive_url || existingOverride.deliverableUrl,
    isRevisionRequested: isRevision,
    revisionReason: isRevision ? revisionReason : undefined,
    revisionNotes: isRevision ? opts?.note || existingOverride.revisionNotes : undefined,
    stageHistory: existingHist,
    completedQuantity: mappedStatus === "completed" ? 1 : 0,
    completedAt: mappedStatus === "completed" ? nowIso : undefined,
    updatedAt: nowIso,
  };

  // 2. Also update any linked `daily_team_targets` row matching `creativeName === ad.name` or `opts.taskId`
  const adNameUpper = String(ad.name || "").trim().toUpperCase();
  for (const row of db.daily_team_targets || []) {
    let notesObj: Record<string, any> = {};
    if (row.notes && String(row.notes).startsWith("{")) {
      try {
        notesObj = JSON.parse(row.notes);
      } catch {}
    }

    const rowCreativeName = String(notesObj.creativeName || "").trim().toUpperCase();
    const matchesById = opts?.taskId && row.id === opts.taskId;
    const matchesByCreativeName = adNameUpper && rowCreativeName === adNameUpper;

    if (matchesById || matchesByCreativeName) {
      const rowHist: StageHistoryEntry[] = Array.isArray(notesObj.stageHistory)
        ? [...notesObj.stageHistory]
        : [];
      rowHist.push({
        stage: mappedStatus,
        label: `${stageLabel}${opts?.action === "reject" ? " (Rejected)" : ""}`,
        timestamp: nowIso,
        actorName,
      });

      notesObj.__meta__ = true;
      notesObj.creativeName = adNameUpper;
      notesObj.adId = ad.id;
      notesObj.productionStage = ad.production_stage;
      notesObj.statusOverride = mappedStatus;
      notesObj.deliverableUrl = ad.drive_url || notesObj.deliverableUrl;
      notesObj.isRevisionRequested = isRevision;
      notesObj.revisionReason = isRevision ? revisionReason : undefined;
      notesObj.revisionNotes = isRevision ? opts?.note || notesObj.revisionNotes : undefined;
      notesObj.stageHistory = rowHist;
      notesObj.completedAt = mappedStatus === "completed" ? nowIso : undefined;

      if (resolvedAssigneeId) {
        row.user_id = resolvedAssigneeId;
      }
      row.completed_quantity = mappedStatus === "completed" ? Number(row.target_quantity || 1) : 0;
      row.manual_completed_quantity = row.completed_quantity;
      row.notes = JSON.stringify(notesObj);
      row.updated_at = nowIso;
    }
  }

  saveLocalDb(db);
}
