import { NextResponse } from "next/server";
import {
  getWebhookConfig,
  saveWebhookConfig,
  dispatchWebhookEvent,
} from "@/lib/webhooks-store";
import { resolveRequestActor } from "@/lib/auth-server";

export async function GET() {
  try {
    const config = await getWebhookConfig();
    return NextResponse.json({ ok: true, config });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to load webhook config" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const auth = await resolveRequestActor(req, body.actorId);
    if (
      auth.authenticated &&
      auth.actor &&
      auth.actor.role !== "admin" &&
      auth.actor.role !== "manager"
    ) {
      return NextResponse.json(
        { ok: false, error: "Forbidden: Only Managers or Admins can configure webhooks." },
        { status: 403 }
      );
    }

    const updated = await saveWebhookConfig({
      enabled: body.enabled !== undefined ? Boolean(body.enabled) : undefined,
      url: body.url !== undefined ? String(body.url) : undefined,
      events: Array.isArray(body.events) ? body.events : undefined,
      secret: body.secret !== undefined ? String(body.secret) : undefined,
    });

    return NextResponse.json({ ok: true, config: updated });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Failed to save webhook config" },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const result = await dispatchWebhookEvent(
      "webhook.test",
      {
        message: "Test ping from Satmi Task Manager",
        triggeredBy: body.actorName || "Workspace Admin",
      },
      {
        forceTest: true,
        overrideUrl: body.url,
      }
    );

    const config = await getWebhookConfig();
    return NextResponse.json({
      ok: result.ok,
      status: result.status,
      latencyMs: result.latencyMs,
      error: result.error,
      config,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Webhook test failed" },
      { status: 500 }
    );
  }
}
