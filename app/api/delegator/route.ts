import { NextResponse } from "next/server";
import { supabaseAdmin, dateInTargetTimeZone } from "@/lib/supabase";
import { DailyTaskRule } from "@/lib/types";

export async function GET() {
  try {
    const { data: rules, error } = await supabaseAdmin
      .from("daily_task_rules")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching rules:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const formattedRules: DailyTaskRule[] = (rules || []).map((r) => ({
      id: r.id,
      userId: r.user_id,
      taskName: r.task_name,
      targetQuantity: r.target_quantity,
      notes: r.notes,
      active: r.active,
      startsOn: r.starts_on,
      endsOn: r.ends_on,
      createdBy: r.created_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));

    return NextResponse.json({ rules: formattedRules });
  } catch (error: any) {
    console.error("GET /api/delegator error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch rules" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const today = dateInTargetTimeZone();

    const payload: Record<string, any> = {
      user_id: body.userId,
      task_name: body.taskName.trim(),
      target_quantity: Math.max(1, Number(body.targetQuantity) || 1),
      notes: body.notes || null,
      active: body.active !== undefined ? body.active : true,
      starts_on: body.startsOn || today,
      ends_on: body.endsOn || null,
      updated_at: new Date().toISOString(),
    };

    if (body.createdBy) {
      payload.created_by = body.createdBy;
    }

    let result;
    if (body.id) {
      // Update
      const { data, error } = await supabaseAdmin
        .from("daily_task_rules")
        .update(payload)
        .eq("id", body.id)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } else {
      // Insert
      const { data, error } = await supabaseAdmin
        .from("daily_task_rules")
        .insert({
          ...payload,
          created_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      result = data;
    }

    // Materialize right away so today's daily target appears immediately!
    try {
      await supabaseAdmin.rpc("materialize_daily_task_rules", {
        p_start: today,
        p_end: today,
      });
    } catch (e) {
      console.warn("Materialize error after saving rule:", e);
    }

    return NextResponse.json({ ok: true, rule: result });
  } catch (error: any) {
    console.error("POST /api/delegator error:", error);
    return NextResponse.json({ error: error.message || "Failed to save rule" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "Rule ID is required" }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from("daily_task_rules")
      .delete()
      .eq("id", id);

    if (error) {
      console.error("Delete rule error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("DELETE /api/delegator error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete rule" }, { status: 500 });
  }
}
