import { NextResponse } from "next/server";
import { supabaseAdmin, dateInTargetTimeZone } from "@/lib/supabase";

export async function POST() {
  try {
    const today = dateInTargetTimeZone();
    const { error } = await supabaseAdmin.rpc("materialize_daily_task_rules", {
      p_start: today,
      p_end: today,
    });

    if (error) {
      console.error("Materialize RPC error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true, today });
  } catch (error: any) {
    console.error("POST /api/delegator/materialize error:", error);
    return NextResponse.json({ error: error.message || "Materialize failed" }, { status: 500 });
  }
}
