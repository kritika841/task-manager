import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import { WebhookConfig } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const WEBHOOKS_FILE = path.join(DATA_DIR, "webhooks.json");

export const DEFAULT_WEBHOOK_EVENTS = [
  "task.created",
  "task.completed",
  "task.review_submitted",
  "task.revision_requested",
  "task.archived",
  "comment.created",
] as const;

const defaultConfig: WebhookConfig = {
  enabled: false,
  url: "",
  events: [...DEFAULT_WEBHOOK_EVENTS],
  secret: "",
  lastTriggeredAt: null,
  lastStatus: null,
  lastError: null,
};

let cachedConfig: WebhookConfig | null = null;

export async function getWebhookConfig(): Promise<WebhookConfig> {
  if (cachedConfig) return cachedConfig;
  try {
    await mkdir(DATA_DIR, { recursive: true });
    const raw = await readFile(WEBHOOKS_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    cachedConfig = {
      ...defaultConfig,
      ...parsed,
      events: Array.isArray(parsed.events) ? parsed.events : [...DEFAULT_WEBHOOK_EVENTS],
    };
    return cachedConfig!;
  } catch {
    cachedConfig = { ...defaultConfig };
    try {
      await writeFile(WEBHOOKS_FILE, JSON.stringify(cachedConfig, null, 2), "utf-8");
    } catch {}
    return cachedConfig!;
  }
}

export async function saveWebhookConfig(
  updates: Partial<WebhookConfig>
): Promise<WebhookConfig> {
  const current = await getWebhookConfig();
  const next: WebhookConfig = {
    ...current,
    ...updates,
    url: updates.url !== undefined ? updates.url.trim() : current.url,
    events: Array.isArray(updates.events) ? updates.events : current.events,
  };
  cachedConfig = next;
  try {
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(WEBHOOKS_FILE, JSON.stringify(next, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save webhook config:", err);
  }
  return next;
}

export async function dispatchWebhookEvent(
  event: string,
  data: Record<string, any>,
  options?: { forceTest?: boolean; overrideUrl?: string }
): Promise<{ ok: boolean; status?: number; latencyMs: number; error?: string }> {
  const start = Date.now();
  const config = await getWebhookConfig();
  const targetUrl = (options?.overrideUrl ?? config.url ?? "").trim();

  if (!options?.forceTest) {
    if (!config.enabled || !targetUrl) {
      return { ok: false, latencyMs: 0, error: "Webhooks disabled or no URL configured" };
    }
    if (!config.events.includes(event)) {
      return { ok: false, latencyMs: 0, error: `Event ${event} not subscribed` };
    }
  } else if (!targetUrl) {
    return { ok: false, latencyMs: 0, error: "Webhook endpoint URL is required" };
  }

  const bodyObj = {
    id: `evt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    event,
    workspace: "Satmi Task Manager",
    timestamp: new Date().toISOString(),
    data,
  };
  const bodyStr = JSON.stringify(bodyObj);

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "Satmi-TaskManager-Webhook/1.0",
    "X-Satmi-Event": event,
  };

  if (config.secret) {
    const signature = crypto
      .createHmac("sha256", config.secret)
      .update(bodyStr)
      .digest("hex");
    headers["X-Satmi-Signature"] = `sha256=${signature}`;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000);

    const res = await fetch(targetUrl, {
      method: "POST",
      headers,
      body: bodyStr,
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const latencyMs = Date.now() - start;
    await saveWebhookConfig({
      lastTriggeredAt: new Date().toISOString(),
      lastStatus: res.status,
      lastError: res.ok ? null : `HTTP ${res.status} ${res.statusText}`,
    });

    return {
      ok: res.ok,
      status: res.status,
      latencyMs,
      error: res.ok ? undefined : `Endpoint returned HTTP ${res.status}`,
    };
  } catch (err: any) {
    const latencyMs = Date.now() - start;
    const errMsg = err?.message || "Failed to reach webhook endpoint";
    await saveWebhookConfig({
      lastTriggeredAt: new Date().toISOString(),
      lastStatus: 0,
      lastError: errMsg,
    });
    return {
      ok: false,
      status: 0,
      latencyMs,
      error: errMsg,
    };
  }
}
