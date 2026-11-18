import { NextResponse } from "next/server";
import {
  getTemplates,
  createTemplate,
  updateTemplate,
  deleteTemplate,
} from "@/lib/templates-store";
import { canReviewTasks, resolveRequestActor } from "@/lib/auth-server";

export async function GET(req: Request) {
  try {
    const { actor } = await resolveRequestActor(req);
    let templates = await getTemplates();
    if (actor && !canReviewTasks(actor.role)) {
      templates = templates.filter(
        (t) => t.userId === actor.id || t.role === actor.role
      );
    }
    return NextResponse.json({ templates });
  } catch (error: any) {
    console.error("GET /api/templates error:", error);
    return NextResponse.json({ error: error.message || "Failed to fetch templates" }, { status: 500 });
  }
}

function sanitizeStatusLabels(raw: unknown): Partial<Record<"backlog" | "todo" | "in_progress" | "in_review" | "completed", string>> | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const allowed = ["backlog", "todo", "in_progress", "in_review", "completed"] as const;
  const out: Partial<Record<(typeof allowed)[number], string>> = {};
  for (const key of allowed) {
    const val = (raw as Record<string, unknown>)[key];
    if (typeof val === "string" && val.trim()) {
      out[key] = val.trim().slice(0, 60);
    }
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    if (!body.name || !body.role) {
      return NextResponse.json({ error: "Template name and role are required" }, { status: 400 });
    }

    const customStatusLabelsEnabled = Boolean(body.customStatusLabelsEnabled);
    const template = await createTemplate({
      name: body.name,
      role: body.role,
      userId: body.userId || undefined,
      userName: body.userName || undefined,
      description: body.description || "",
      isDefault: Boolean(body.isDefault),
      customStatusLabelsEnabled,
      statusLabels: customStatusLabelsEnabled ? sanitizeStatusLabels(body.statusLabels) : undefined,
      parentColumns: body.parentColumns || [],
    });

    return NextResponse.json({ template }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/templates error:", error);
    return NextResponse.json({ error: error.message || "Failed to create template" }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    if (!body.id) {
      return NextResponse.json({ error: "Template ID is required" }, { status: 400 });
    }

    const sanitizedUpdates = { ...body };
    if (body.customStatusLabelsEnabled !== undefined) {
      sanitizedUpdates.customStatusLabelsEnabled = Boolean(body.customStatusLabelsEnabled);
      sanitizedUpdates.statusLabels = sanitizedUpdates.customStatusLabelsEnabled
        ? sanitizeStatusLabels(body.statusLabels)
        : undefined;
    } else if (body.statusLabels !== undefined) {
      sanitizedUpdates.statusLabels = sanitizeStatusLabels(body.statusLabels);
    }

    const updated = await updateTemplate(body.id, sanitizedUpdates);
    if (!updated) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    return NextResponse.json({ template: updated });
  } catch (error: any) {
    console.error("PUT /api/templates error:", error);
    return NextResponse.json({ error: error.message || "Failed to update template" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  return PUT(req);
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Template ID is required" }, { status: 400 });
    }

    const success = await deleteTemplate(id);
    if (!success) {
      return NextResponse.json({ error: "Template not found" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    console.error("DELETE /api/templates error:", error);
    return NextResponse.json({ error: error.message || "Failed to delete template" }, { status: 500 });
  }
}
