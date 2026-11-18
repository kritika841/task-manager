import { randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { NextResponse } from "next/server";
import { canManageWorkspace, resolveRequestActor } from "@/lib/auth-server";
import type { WorkspaceSettings } from "@/lib/workspace-settings";

const dataDir = join(process.cwd(), "data");
const settingsPath = join(dataDir, "workspace-settings.json");

function readSettings(): WorkspaceSettings {
  const defaults: WorkspaceSettings = { adflowSyncEnabled: true, defaultView: null, density: null };
  try {
    const parsed = JSON.parse(readFileSync(settingsPath, "utf8"));
    return {
      ...defaults,
      ...parsed,
      adflowSyncEnabled:
        typeof parsed?.adflowSyncEnabled === "boolean"
          ? parsed.adflowSyncEnabled
          : true,
    };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return defaults;
    throw err;
  }
}

function saveSettings(settings: WorkspaceSettings) {
  mkdirSync(dataDir, { recursive: true });
  const tempPath = settingsPath + "." + randomUUID();
  try {
    writeFileSync(tempPath, JSON.stringify(settings, null, 2), { mode: 0o600 });
    renameSync(tempPath, settingsPath);
  } finally {
    rmSync(tempPath, { force: true });
  }
}

function respond(settings: WorkspaceSettings) {
  return NextResponse.json({ settings }, { headers: { "Cache-Control": "no-store" } });
}

export async function GET(req: Request) {
  const { actor } = await resolveRequestActor(req);
  if (!actor) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  try {
    return respond(readSettings());
  } catch (err) {
    console.error("Failed to read workspace settings:", err);
    return NextResponse.json({ error: "Could not load workspace settings." }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  const { actor } = await resolveRequestActor(req);
  if (!actor) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!canManageWorkspace(actor.role)) {
    return NextResponse.json({ error: "Only workspace admins can change these settings." }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid workspace settings." }, { status: 400 });
  }

  const { adflowSyncEnabled, defaultView, density, initializeSync } = body;
  if (
    (adflowSyncEnabled !== undefined && typeof adflowSyncEnabled !== "boolean") ||
    (defaultView !== undefined && !["board", "table", "list", "calendar", "analytics"].includes(defaultView)) ||
    (density !== undefined && density !== "comfortable" && density !== "compact") ||
    (initializeSync !== undefined && typeof initializeSync !== "boolean")
  ) {
    return NextResponse.json({ error: "Invalid workspace settings." }, { status: 400 });
  }

  try {
    const settings = readSettings();
    if (adflowSyncEnabled !== undefined && (!initializeSync || settings.adflowSyncEnabled === null)) {
      settings.adflowSyncEnabled = adflowSyncEnabled;
    }
    if (defaultView !== undefined) settings.defaultView = defaultView;
    if (density !== undefined) settings.density = density;
    saveSettings(settings);
    return respond(settings);
  } catch (err) {
    console.error("Failed to save workspace settings:", err);
    return NextResponse.json({ error: "Could not save workspace settings." }, { status: 500 });
  }
}
