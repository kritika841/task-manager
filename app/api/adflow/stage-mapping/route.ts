import { NextResponse } from "next/server";
import { canManageWorkspace, resolveRequestActor } from "@/lib/auth-server";
import { loadLocalDb, saveLocalDb } from "@/lib/local-supabase-fallback";
import {
  ADFLOW_PRODUCTION_STAGES,
  DEFAULT_ADFLOW_STAGE_MAPPING,
  getAdFlowStageMappingConfig,
  type AdFlowStageMappingConfig,
} from "@/lib/adflow-bridge";

export async function GET(req: Request) {
  try {
    const { actor } = await resolveRequestActor(req);
    if (!actor) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    const db = loadLocalDb();
    const mapping = getAdFlowStageMappingConfig(
      db.adflow_stage_mapping as Partial<AdFlowStageMappingConfig> | undefined
    );
    return NextResponse.json({
      ok: true,
      mapping,
      stages: ADFLOW_PRODUCTION_STAGES,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to load stage mapping" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { actor } = await resolveRequestActor(req);
    if (!actor) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    if (!canManageWorkspace(actor.role)) {
      return NextResponse.json({ error: "Only workspace admins can change the stage mapping." }, { status: 403 });
    }
    const body = await req.json();
    const db = loadLocalDb();

    if (body.reset === true) {
      db.adflow_stage_mapping = DEFAULT_ADFLOW_STAGE_MAPPING;
      saveLocalDb(db);
      return NextResponse.json({
        ok: true,
        mapping: DEFAULT_ADFLOW_STAGE_MAPPING,
        stages: ADFLOW_PRODUCTION_STAGES,
      });
    }

    const current = getAdFlowStageMappingConfig(
      db.adflow_stage_mapping as Partial<AdFlowStageMappingConfig> | undefined
    );

    const updated: AdFlowStageMappingConfig = {
      stageToColumn: {
        ...current.stageToColumn,
        ...(body.stageToColumn || {}),
      },
      columnDefaultStage: {
        ...current.columnDefaultStage,
        ...(body.columnDefaultStage || {}),
      },
      autoCreateBlankCreative:
        body.autoCreateBlankCreative !== undefined
          ? Boolean(body.autoCreateBlankCreative)
          : current.autoCreateBlankCreative,
      defaultBlankCreativeStage:
        body.defaultBlankCreativeStage || current.defaultBlankCreativeStage,
    };

    db.adflow_stage_mapping = updated;
    saveLocalDb(db);

    return NextResponse.json({
      ok: true,
      mapping: updated,
      stages: ADFLOW_PRODUCTION_STAGES,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to save stage mapping" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  return POST(req);
}
