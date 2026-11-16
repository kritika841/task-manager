import { NextResponse } from "next/server";
import {
  generateNextCreativeIds,
  getPendingCreativeIdsForCreator,
} from "@/lib/adflow-bridge";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const creatorId = searchParams.get("creatorId") || "";
    const count = Math.max(1, Number(searchParams.get("count")) || 1);

    if (!creatorId) {
      return NextResponse.json(
        { error: "creatorId query parameter is required" },
        { status: 400, headers: corsHeaders }
      );
    }

    const [pendingInfo, generatedInfo] = await Promise.all([
      getPendingCreativeIdsForCreator(creatorId),
      generateNextCreativeIds(creatorId, count),
    ]);

    return NextResponse.json(
      {
        ok: true,
        creatorId,
        prefix: pendingInfo.prefix,
        nextCreativeId: pendingInfo.nextCreativeId,
        pendingCreativeIds: pendingInfo.pendingCreativeIds,
        pendingTasks: pendingInfo.pendingTasks,
        allCreatorTasks: pendingInfo.allCreatorTasks,
        nextSequentialIds: generatedInfo.creativeIds,
        maxExistingNumber: generatedInfo.maxExisting,
      },
      { headers: corsHeaders }
    );
  } catch (error: any) {
    console.error("GET /api/adflow/creative-ids error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to resolve Creative IDs" },
      { status: 500, headers: corsHeaders }
    );
  }
}
