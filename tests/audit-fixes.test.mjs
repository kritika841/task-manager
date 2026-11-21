import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import http from "node:http";
import crypto from "node:crypto";
import { spawn } from "node:child_process";

const REPO_ROOT = process.cwd();
const DATA_DIR = path.join(REPO_ROOT, "data");
const DB_PATH = path.join(DATA_DIR, "local-db.json");
const BACKUP_TMP = fs.mkdtempSync(path.join(os.tmpdir(), "task-mgr-test-"));
const TEST_PASS = "VerifyFixPass!2026";

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${derived}`;
}

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = http.createServer();
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      srv.close(() => resolve(addr.port));
    });
    srv.on("error", reject);
  });
}

let mockServer;
let nextProc;
let baseUrl;
let mockPort;
let capturedEmails = [];
let mockAds = [];
let mockUpstreamProfiles = null;
let capturedProfilePatches = [];

async function api(urlPath, opts = {}) {
  const res = await fetch(`${baseUrl}${urlPath}`, opts);
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}
  return { status: res.status, headers: res.headers, json, text };
}

test.before(async () => {
  // Back up existing data directory cleanly
  fs.cpSync(DATA_DIR, path.join(BACKUP_TMP, "data"), { recursive: true });

  // Seed test accounts (including developer, admin, manager, editor, member, deactivated) cleanly in local-db.json
  const db = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  db.profile_overrides = db.profile_overrides || {};
  db.local_profiles = db.local_profiles || [];
  db.revoked_tokens = {};
  const nowIso = new Date().toISOString();

  const seededUsers = [
    { id: "22222222-2222-4222-8222-222222222201", name: "=Test Admin", email: "t-admin@test.local", role: "admin", active: true },
    { id: "22222222-2222-4222-8222-222222222202", name: "Test Developer", email: "t-dev@test.local", role: "developer", active: true },
    { id: "22222222-2222-4222-8222-222222222203", name: "Test Manager", email: "t-mgr@test.local", role: "manager", active: true },
    { id: "22222222-2222-4222-8222-222222222204", name: "Test Editor", email: "t-ed@test.local", role: "editor", active: true },
    { id: "22222222-2222-4222-8222-222222222205", name: "Test Member", email: "t-mem@test.local", role: "member", active: true },
    { id: "22222222-2222-4222-8222-222222222206", name: "Test Deactivated", email: "t-deact@test.local", role: "member", active: false },
  ];

  for (const u of seededUsers) {
    const row = {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      avatar_url: JSON.stringify({
        color: "#3b82f6",
        employeeCode: "TST",
        dailyCapacityUnits: 6,
        passwordHash: hashPassword(TEST_PASS),
      }),
      active: u.active,
      deleted_at: null,
      created_at: nowIso,
      updated_at: nowIso,
    };
    db.profiles = db.profiles.filter((p) => p.id !== u.id);
    db.local_profiles = db.local_profiles.filter((p) => p.id !== u.id);
    db.profiles.push(row);
    db.local_profiles.push(row);
    db.profile_overrides[u.id] = row;
  }
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2), "utf8");

  // Start isolated local mock AdFlow + Resend server
  mockAds = [
    {
      id: "aaaa1111-1111-4111-8111-111111111111",
      name: "TST0001",
      status: "pending_review",
      approval_stage: "manager_review",
      production_stage: "creator_review",
      creator_id: "c4259f60-f408-4a4b-8dbf-81e94c0f9a64",
      editor_id: "22222222-2222-4222-8222-222222222204",
      drive_url: "https://drive.google.com/file/d/1QxJy7v95whSv50tnN5b-xEsVrZ2UIJbK/view",
      editing_freeze: "unfrozen",
      deleted_at: null,
      created_at: nowIso,
      updated_at: nowIso,
    },
  ];
  capturedEmails = [];

  mockPort = await getFreePort();
  mockServer = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString("utf8");
    const body = raw ? JSON.parse(raw) : null;
    const urlObj = new URL(req.url || "/", `http://127.0.0.1:${mockPort}`);

    const send = (code, data) => {
      const s = JSON.stringify(data);
      res.writeHead(code, { "Content-Type": "application/json", "Content-Length": Buffer.byteLength(s) });
      res.end(s);
    };

    if (urlObj.pathname === "/auth/v1/token") {
      return send(400, { error: "invalid_grant" });
    }
    if (urlObj.pathname.startsWith("/__resend/")) {
      capturedEmails.push(body);
      return send(200, { id: "mock-email" });
    }
    if (urlObj.pathname === "/rest/v1/profiles") {
      if (req.method === "PATCH") {
        capturedProfilePatches.push({
          id: urlObj.searchParams.get("id"),
          body,
        });
        return send(200, []);
      }
      if (mockUpstreamProfiles) {
        return send(200, mockUpstreamProfiles);
      }
      const curDb = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
      return send(200, curDb.profiles);
    }
    if (urlObj.pathname === "/rest/v1/ads") {
      const idFilter = urlObj.searchParams.get("id")?.replace(/^eq\./, "");
      const nameIlike = urlObj.searchParams.get("name")?.replace(/^ilike\./, "");
      const deletedNull = urlObj.searchParams.get("deleted_at") === "is.null";
      if (req.method === "GET") {
        let rows = mockAds;
        if (idFilter) rows = rows.filter((a) => a.id === idFilter);
        if (nameIlike) {
          const prefix = nameIlike.replace(/\*$/, "").toUpperCase();
          rows = rows.filter((a) => String(a.name || "").toUpperCase().startsWith(prefix));
        }
        if (deletedNull) rows = rows.filter((a) => !a.deleted_at);
        return send(200, rows);
      }
      if (req.method === "POST") {
        const created = {
          id: crypto.randomUUID(),
          deleted_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...(body || {}),
        };
        mockAds.push(created);
        return send(201, [created]);
      }
      if (req.method === "PATCH") {
        const updated = [];
        for (let i = 0; i < mockAds.length; i++) {
          if (!idFilter || mockAds[i].id === idFilter) {
            mockAds[i] = { ...mockAds[i], ...(body || {}), updated_at: new Date().toISOString() };
            updated.push(mockAds[i]);
          }
        }
        return send(200, updated);
      }
    }
    if (urlObj.pathname === "/rest/v1/campaigns") return send(200, [{ id: "camp-1", name: "Camp", active: true }]);
    if (urlObj.pathname === "/rest/v1/products") return send(200, [{ id: "prod-1", name: "Prod", active: true }]);
    return send(200, [{ id: crypto.randomUUID(), ...(body || {}) }]);
  });
  await new Promise((r) => mockServer.listen(mockPort, "127.0.0.1", r));

  // Create throwaway preload script in temp dir to isolate all external calls and .env.local
  const preloadPath = path.join(BACKUP_TMP, "preload.cjs");
  const envTestPath = path.join(BACKUP_TMP, ".env.test");
  fs.writeFileSync(
    envTestPath,
    [
      "NODE_ENV=production",
      `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:${mockPort}`,
      "NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key",
      "SUPABASE_SERVICE_ROLE_KEY=test-service-key",
      "SESSION_SECRET=test-session-secret-key-2026",
      "RESEND_API_KEY=",
      "RESEND_FROM_EMAIL=support@satmi.in",
    ].join("\n"),
    "utf8"
  );

  fs.writeFileSync(
    preloadPath,
    `
const fs = require("node:fs");
const path = require("node:path");
const envTest = ${JSON.stringify(envTestPath)};
const envLocal = path.resolve(process.cwd(), ".env.local");
process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:${mockPort}";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
process.env.SESSION_SECRET = "test-session-secret-key-2026";
process.env.RESEND_API_KEY = "";
const origReadSync = fs.readFileSync.bind(fs);
fs.readFileSync = function(p, ...r) {
  if (typeof p === "string" && path.resolve(p) === envLocal) return origReadSync(envTest, ...r);
  return origReadSync(p, ...r);
};
const origFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = async function(input, init) {
  const urlStr = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const u = new URL(urlStr);
  if (u.hostname === "api.resend.com") {
    return origFetch("http://127.0.0.1:${mockPort}/__resend" + u.pathname + u.search, init);
  }
  if (u.hostname === "ads.satmi.in" || ((u.hostname === "127.0.0.1" || u.hostname === "localhost") && u.port === "3000")) {
    return origFetch("http://127.0.0.1:${mockPort}" + u.pathname + u.search, init);
  }
  if (u.hostname !== "127.0.0.1" && u.hostname !== "localhost") {
    throw new Error("Blocked external host in test: " + u.hostname);
  }
  return origFetch(input, init);
};
`,
    "utf8"
  );

  const appPort = await getFreePort();
  baseUrl = `http://127.0.0.1:${appPort}`;
  nextProc = spawn(
    path.join(REPO_ROOT, "node_modules", ".bin", "next"),
    ["start", "-H", "127.0.0.1", "-p", String(appPort)],
    {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        NODE_ENV: "production",
        NODE_OPTIONS: `--require "${preloadPath}"`,
      },
      stdio: ["ignore", "pipe", "pipe"],
    }
  );

  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    try {
      const r = await fetch(`${baseUrl}/api/health`);
      if (r.ok) break;
    } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }
});

test.after(async () => {
  if (nextProc) nextProc.kill("SIGTERM");
  if (mockServer) mockServer.close();
  // Restore clean pre-test data state
  fs.cpSync(path.join(BACKUP_TMP, "data"), DATA_DIR, { recursive: true });
  fs.rmSync(path.join(DATA_DIR, "local-db.backup.json"), { force: true });
  fs.rmSync(BACKUP_TMP, { recursive: true, force: true });
});

async function loginAs(email) {
  const r = await api("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: TEST_PASS }),
  });
  assert.equal(r.status, 200);
  const cookie = (r.headers.get("set-cookie") || "").split(";")[0];
  assert.ok(cookie.startsWith("satmi_session_v2="));
  return cookie;
}

test("smvkritika@gmail.com local scrypt hash fallback is configured", () => {
  const db = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  const profile = db.profiles.find((p) => p.email === "smvkritika@gmail.com");
  assert.ok(profile?.avatar_url);
  const meta = JSON.parse(profile.avatar_url);
  assert.ok(typeof meta.passwordHash === "string" && meta.passwordHash.startsWith("scrypt:"));
  assert.ok(db.profile_overrides["c4259f60-f408-4a4b-8dbf-81e94c0f9a64"]?.avatar_url);
});

test("Auth: server-side token revocation on logout, uniform 401 enumeration prevention, and 429 rate limiting", async () => {
  const memCookie = await loginAs("t-mem@test.local");
  const delRes = await api("/api/auth", { method: "DELETE", headers: { cookie: memCookie } });
  assert.equal(delRes.status, 200);

  // Replay pre-logout token: must now fail with 401
  const replayAuth = await api("/api/auth", { headers: { cookie: memCookie } });
  const replayTasks = await api("/api/tasks", { headers: { cookie: memCookie } });
  assert.equal(replayAuth.status, 401);
  assert.equal(replayTasks.status, 401);

  // Deactivated user must return 401 identical to wrong password (not 403 enumeration)
  const deactRes = await api("/api/auth", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "t-deact@test.local", password: TEST_PASS }),
  });
  assert.equal(deactRes.status, 401);

  // Rate limiting after repeated failures
  let got429 = false;
  for (let i = 0; i < 10; i++) {
    const bad = await api("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-forwarded-for": "198.51.100.77" },
      body: JSON.stringify({ email: "t-admin@test.local", password: `Wrong_${i}` }),
    });
    if (bad.status === 429) {
      got429 = true;
      assert.equal(bad.headers.get("retry-after"), "60");
      break;
    }
  }
  assert.ok(got429, "Expected HTTP 429 rate limiting on brute-force login attempts");
});

test("AdFlow: two-stage approve (creator_review -> final_review -> approved), freeze blocks submit_edit, and rawFootageUrl blocks javascript:", async () => {
  const mgrCookie = await loginAs("t-mgr@test.local");
  const admCookie = await loginAs("t-admin@test.local");
  const edCookie = await loginAs("t-ed@test.local");
  const adId = "aaaa1111-1111-4111-8111-111111111111";

  // Freeze blocks submit_edit with 409
  const freezeRes = await api("/api/adflow/control", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: mgrCookie },
    body: JSON.stringify({ action: "freeze_editing", adId }),
  });
  assert.equal(freezeRes.status, 200);

  const submitFrozen = await api("/api/adflow/control", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: edCookie },
    body: JSON.stringify({ action: "submit_edit", adId, driveUrl: "https://drive.google.com/file/d/1QxJy7v95whSv50tnN5b-xEsVrZ2UIJbK/view" }),
  });
  assert.equal(submitFrozen.status, 409);

  // Unfreeze & test rawFootageUrl javascript: rejection
  await api("/api/adflow/control", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: mgrCookie },
    body: JSON.stringify({ action: "unfreeze_editing", adId }),
  });
  const badRawUrl = await api("/api/adflow/control", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: mgrCookie },
    body: JSON.stringify({ action: "update_stage", adId, productionStage: "ready_for_edit", rawFootageUrl: "javascript:alert(1)" }),
  });
  assert.equal(badRawUrl.status, 400);

  // Move to creator_review and verify 2-step approve
  await api("/api/adflow/control", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: edCookie },
    body: JSON.stringify({ action: "submit_edit", adId, driveUrl: "https://drive.google.com/file/d/1QxJy7v95whSv50tnN5b-xEsVrZ2UIJbK/view" }),
  });
  const stage1 = await api("/api/adflow/control", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: mgrCookie },
    body: JSON.stringify({ action: "approve", adId }),
  });
  assert.equal(stage1.status, 200);
  assert.equal(stage1.json.ad.production_stage, "final_review");
  assert.equal(stage1.json.ad.approval_stage, "admin_final");

  const stage2 = await api("/api/adflow/control", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: admCookie },
    body: JSON.stringify({ action: "approve", adId }),
  });
  assert.equal(stage2.status, 200);
  assert.equal(stage2.json.ad.production_stage, "approved");
  assert.equal(stage2.json.ad.approval_stage, "complete");
});

test("Developer RBAC: allowed on /api/delegator & /api/webhooks", async () => {
  const devCookie = await loginAs("t-dev@test.local");
  const delPost = await api("/api/delegator", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: devCookie },
    body: JSON.stringify({ userId: "22222222-2222-4222-8222-222222222205", taskName: "Dev Verified Rule", targetQuantity: 1 }),
  });
  assert.equal(delPost.status, 200);
  const delDel = await api(`/api/delegator?id=${delPost.json.rule.id}`, {
    method: "DELETE",
    headers: { cookie: devCookie },
  });
  assert.equal(delDel.status, 200);

  const whPost = await api("/api/webhooks", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: devCookie },
    body: JSON.stringify({ enabled: false, url: "https://example.com/hook" }),
  });
  assert.equal(whPost.status, 200);
});

test("Tasks & Users: RBAC bounds, validation, deduplication (409), optimistic locking (409), pagination, CSV & email escaping", async () => {
  const admCookie = await loginAs("t-admin@test.local");
  const memCookie = await loginAs("t-mem@test.local");

  // Users role/capacity validation & no plaintext auth_users
  const badRole = await api("/api/users", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: admCookie },
    body: JSON.stringify({ name: "Bad", email: "badrole@test.local", role: "super_hacker", password: "TempPassword123!" }),
  });
  assert.equal(badRole.status, 400);

  const negCap = await api("/api/users", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie: memCookie },
    body: JSON.stringify({ id: "22222222-2222-4222-8222-222222222205", dailyCapacityUnits: -99 }),
  });
  assert.equal(negCap.status, 400);

  // Member blocked from creating task for another user
  const memAssignOther = await api("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: memCookie },
    body: JSON.stringify({ title: "For Admin", assigneeId: "22222222-2222-4222-8222-222222222201" }),
  });
  assert.equal(memAssignOther.status, 403);

  // Validation rejections
  for (const invalidBody of [
    { title: "", assigneeId: "22222222-2222-4222-8222-222222222205" },
    { title: "X".repeat(301), assigneeId: "22222222-2222-4222-8222-222222222205" },
    { title: "<script>alert(1)</script>", assigneeId: "22222222-2222-4222-8222-222222222205" },
    { title: "Neg Qty", assigneeId: "22222222-2222-4222-8222-222222222205", targetQuantity: -5 },
    { title: "Bad URL", assigneeId: "22222222-2222-4222-8222-222222222205", deliverableUrl: "javascript:alert(1)" },
  ]) {
    const res = await api("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: admCookie },
      body: JSON.stringify(invalidBody),
    });
    assert.equal(res.status, 400);
  }

  // Deduplication on double submit
  const dupPayload = JSON.stringify({
    title: "Dedupe Check Task",
    assigneeId: "22222222-2222-4222-8222-222222222205",
    generateCreativeId: false,
  });
  const [c1, c2] = await Promise.all([
    api("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json", cookie: admCookie }, body: dupPayload }),
    api("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json", cookie: admCookie }, body: dupPayload }),
  ]);
  const statuses = [c1.status, c2.status].sort((a, b) => a - b);
  assert.deepEqual(statuses, [200, 409]);

  const createdTask = c1.status === 200 ? c1.json.target : c2.json.target;
  const taskId = createdTask.id;

  // Member cannot self-complete, reassign, or set javascript: URL
  const selfComp = await api("/api/tasks", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie: memCookie },
    body: JSON.stringify({ id: taskId, status: "completed" }),
  });
  assert.equal(selfComp.status, 403);

  const memReassign = await api("/api/tasks", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie: memCookie },
    body: JSON.stringify({ id: taskId, assigneeId: "22222222-2222-4222-8222-222222222201" }),
  });
  assert.equal(memReassign.status, 403);

  const badPatchUrl = await api("/api/tasks", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie: memCookie },
    body: JSON.stringify({ id: taskId, deliverableUrl: "javascript:alert(1)" }),
  });
  assert.equal(badPatchUrl.status, 400);

  // Member blocked from editing deadline, priority, targetQuantity, title, or deleting admin-assigned tasks
  for (const forbiddenBody of [
    { id: taskId, dueDate: "2099-12-31" },
    { id: taskId, priority: "high" },
    { id: taskId, targetQuantity: 9 },
    { id: taskId, title: "Modified By Assignee" },
  ]) {
    const forbiddenPatch = await api("/api/tasks", {
      method: "PATCH",
      headers: { "Content-Type": "application/json", cookie: memCookie },
      body: JSON.stringify(forbiddenBody),
    });
    assert.equal(forbiddenPatch.status, 403);
  }

  const forbiddenDelete = await api(`/api/tasks?id=${taskId}`, {
    method: "DELETE",
    headers: { cookie: memCookie },
  });
  assert.equal(forbiddenDelete.status, 403);

  // Valid deliverable submission succeeds for assignee
  const okDeliverablePatch = await api("/api/tasks", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie: memCookie },
    body: JSON.stringify({ id: taskId, deliverableUrl: "https://drive.google.com/file/d/abc123/view" }),
  });
  assert.equal(okDeliverablePatch.status, 200);

  // Optimistic concurrency check (stale expectedUpdatedAt -> 409)
  const stalePatch = await api("/api/tasks", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie: admCookie },
    body: JSON.stringify({ id: taskId, priority: "high", expectedUpdatedAt: "2000-01-01T00:00:00.000Z" }),
  });
  assert.equal(stalePatch.status, 409);

  // Strict per-assignee isolation for editor & member (tasks + users)
  const edCookie = await loginAs("t-ed@test.local");
  const edTasksRes = await api("/api/tasks", { headers: { cookie: edCookie } });
  assert.equal(edTasksRes.status, 200);
  assert.equal(edTasksRes.json.users.length, 1);
  assert.equal(edTasksRes.json.users[0].id, "22222222-2222-4222-8222-222222222204");
  assert.ok(edTasksRes.json.tasks.every((t) => t.assigneeId === "22222222-2222-4222-8222-222222222204"));
  assert.ok(!edTasksRes.json.tasks.some((t) => t.assigneeId === "22222222-2222-4222-8222-222222222205"));

  const memTasksRes = await api("/api/tasks", { headers: { cookie: memCookie } });
  assert.equal(memTasksRes.status, 200);
  assert.equal(memTasksRes.json.users.length, 1);
  assert.equal(memTasksRes.json.users[0].id, "22222222-2222-4222-8222-222222222205");
  assert.ok(memTasksRes.json.tasks.every((t) => t.assigneeId === "22222222-2222-4222-8222-222222222205"));

  // Pagination check
  const pageRes = await api("/api/tasks?page=1&limit=2", { headers: { cookie: admCookie } });
  assert.equal(pageRes.status, 200);
  assert.ok(pageRes.json.tasks.length <= 2);
  assert.equal(pageRes.json.pagination.page, 1);
  assert.equal(pageRes.json.pagination.limit, 2);

  // CSV formula escaping & email HTML escaping
  const attCsv = await api("/api/attendance?format=csv", { headers: { cookie: admCookie } });
  assert.equal(attCsv.status, 200);
  assert.ok(attCsv.text.includes(`"'=Test Admin"`), "Expected leading = neutralized with ' in CSV");

  await api("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: memCookie },
    body: JSON.stringify({ type: "bug", title: "<script>xss</script>", details: "<img src=x onerror=1>" }),
  });
  const lastEmail = capturedEmails[capturedEmails.length - 1];
  assert.ok(lastEmail?.html.includes("&lt;script&gt;xss&lt;/script&gt;"));
  assert.ok(!lastEmail?.html.includes("<script>xss</script>"));

  // Rolling backup exists
  assert.ok(fs.existsSync(path.join(DATA_DIR, "local-db.backup.json")));
});

test("Infra: /api/health, Security Headers, and Custom 404 page", async () => {
  const health = await api("/api/health");
  assert.equal(health.status, 200);
  assert.equal(health.json.status, "healthy");
  assert.equal(health.json.storageWritable, true);
  assert.equal(health.headers.get("x-frame-options"), "DENY");
  assert.equal(health.headers.get("x-content-type-options"), "nosniff");
  assert.ok(health.headers.get("strict-transport-security")?.includes("max-age="));
  assert.ok(health.headers.get("content-security-policy")?.includes("default-src 'self'"));

  const notFound = await api("/nonexistent-audit-page-check");
  assert.equal(notFound.status, 404);
  assert.ok(notFound.text.includes("Page Not Found"));
  assert.ok(notFound.text.includes("Back to Dashboard"));
});

test("AdFlow profile role sync & Role Templates custom status nomenclature", async () => {
  const admCookie = await loginAs("t-admin@test.local");

  // 1. Custom status nomenclature toggle persists in /api/templates
  const tplRes = await api("/api/templates", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: admCookie },
    body: JSON.stringify({
      name: "Custom Nomenclature Test",
      role: "editor",
      customStatusLabelsEnabled: true,
      statusLabels: { todo: "Assigned" },
      parentColumns: [
        { id: "backlog", label: "Backlog", subColumns: [] },
        { id: "todo", label: "Assigned", subColumns: [] },
        { id: "in_progress", label: "In Progress", subColumns: [] },
        { id: "in_review", label: "In Review", subColumns: [] },
        { id: "completed", label: "Done", subColumns: [] },
      ],
    }),
  });
  assert.equal(tplRes.status, 201);
  assert.equal(tplRes.json.template.customStatusLabelsEnabled, true);
  assert.equal(tplRes.json.template.statusLabels.todo, "Assigned");

  // 2. Upstream AdFlow profile role updates overwrite stale local role overrides
  await new Promise((r) => setTimeout(r, 1600));
  const curDb = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  curDb.profile_overrides["22222222-2222-4222-8222-222222222205"] = {
    role: "member",
    updated_at: "2020-01-01T00:00:00.000Z",
  };
  fs.writeFileSync(DB_PATH, JSON.stringify(curDb, null, 2), "utf8");

  mockUpstreamProfiles = curDb.profiles.map((p) =>
    p.id === "22222222-2222-4222-8222-222222222205"
      ? { ...p, role: "editor", updated_at: new Date().toISOString() }
      : p
  );

  const usersRes = await api("/api/users", { headers: { cookie: admCookie } });
  mockUpstreamProfiles = null;
  assert.equal(usersRes.status, 200);
  const syncedMember = usersRes.json.users.find(
    (u) => u.id === "22222222-2222-4222-8222-222222222205"
  );
  assert.equal(syncedMember?.role, "editor");

  // 3. Updating user settings in Task Manager syncs PATCH back to AdFlow profiles
  const patchRes = await api("/api/users", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie: admCookie },
    body: JSON.stringify({
      id: "22222222-2222-4222-8222-222222222205",
      role: "member",
    }),
  });
  assert.equal(patchRes.status, 200);
  assert.ok(
    capturedProfilePatches.some(
      (p) =>
        p.id === "eq.22222222-2222-4222-8222-222222222205" &&
        p.body?.role === "member"
    )
  );
});

test("Attendance Ledger: date-range query, per-user check-in/out cells, office-hours gate, and 12:01 PM check-in reminder", async () => {
  const admCookie = await loginAs("t-admin@test.local");
  const memCookie = await loginAs("t-mem@test.local");

  const istParts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const istVals = Object.fromEntries(istParts.map((p) => [p.type, p.value]));
  const istHourRaw = Number(istVals.hour);
  const istHour = istHourRaw === 24 ? 0 : istHourRaw;
  const todayDate = `${istVals.year}-${istVals.month}-${istVals.day}`;
  const inOfficeHours = istHour >= 10 && istHour < 18;

  // Attempt check-in and verify office-hours enforcement (10:00 AM – 6:00 PM IST)
  const checkinRes = await api("/api/attendance", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: memCookie },
    body: JSON.stringify({ action: "checkin" }),
  });
  if (inOfficeHours) {
    assert.equal(checkinRes.status, 200);
    const checkoutRes = await api("/api/attendance", {
      method: "POST",
      headers: { "Content-Type": "application/json", cookie: memCookie },
      body: JSON.stringify({ action: "checkout" }),
    });
    assert.equal(checkoutRes.status, 200);
  } else {
    assert.equal(checkinRes.status, 403);
    assert.match(checkinRes.json.error || "", /office hours|10:00 AM|6:00 PM/i);

    // Seed member check-in/out record for today in local-db.json so ledger tests remain deterministic outside 10–6 IST
    const curDb = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
    curDb.attendance_records = curDb.attendance_records || [];
    const nowIso = new Date().toISOString();
    curDb.attendance_records.push({
      id: `att-${crypto.randomUUID()}`,
      userId: "22222222-2222-4222-8222-222222222205",
      userName: "Test Member",
      userEmail: "t-mem@test.local",
      employeeCode: "TST",
      role: "member",
      department: "Operations",
      date: todayDate,
      status: "present",
      checkInTime: nowIso,
      checkOutTime: nowIso,
      checkoutReminderSent: false,
      checkoutReminderSentAt: null,
      createdAt: nowIso,
      updatedAt: nowIso,
    });
    fs.writeFileSync(DB_PATH, JSON.stringify(curDb, null, 2), "utf8");
  }

  // Clear any earlier automatic 12:01 PM reminder log from prior tests so this test is deterministic at any IST hour
  const dbBeforeRem = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  dbBeforeRem.checkin_reminders_sent = {};
  fs.writeFileSync(DB_PATH, JSON.stringify(dbBeforeRem, null, 2), "utf8");

  // Trigger 12:01 PM check-in reminder (force: true for deterministic test) -> sends to unchecked-in users, skips checked-in member, and is idempotent
  const emailCountBefore = capturedEmails.length;
  const remRes1 = await api("/api/attendance", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: admCookie },
    body: JSON.stringify({ action: "check_checkin_reminders", force: true }),
  });
  assert.equal(remRes1.status, 200);
  assert.ok(remRes1.json.remindedCount >= 1);
  assert.ok(!remRes1.json.remindedUsers.includes("Test Member"));
  assert.ok(capturedEmails.length > emailCountBefore);
  assert.ok(
    capturedEmails
      .slice(emailCountBefore)
      .some((e) => String(e.subject || "").includes("Check-In Reminder"))
  );

  // Second trigger same day must not resend duplicates
  const remRes2 = await api("/api/attendance", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: admCookie },
    body: JSON.stringify({ action: "check_checkin_reminders", force: true }),
  });
  assert.equal(remRes2.status, 200);
  assert.equal(remRes2.json.remindedCount, 0);

  // Build 3-day range ending today
  const [y, m, d] = todayDate.split("-").map(Number);
  const startDt = new Date(Date.UTC(y, m - 1, d));
  startDt.setUTCDate(startDt.getUTCDate() - 2);
  const startDate = startDt.toISOString().slice(0, 10);

  // Non-admin does not receive ledger data or CSV export
  const memLedgerRes = await api(
    `/api/attendance?startDate=${startDate}&endDate=${todayDate}`,
    { headers: { cookie: memCookie } }
  );
  assert.equal(memLedgerRes.status, 200);
  assert.equal(memLedgerRes.json.ledger, undefined);

  const memCsvRes = await api(
    `/api/attendance?startDate=${startDate}&endDate=${todayDate}&format=csv`,
    { headers: { cookie: memCookie } }
  );
  assert.equal(memCsvRes.status, 403);

  // Admin receives ledger with 3 date rows and user columns
  const admLedgerRes = await api(
    `/api/attendance?startDate=${startDate}&endDate=${todayDate}`,
    { headers: { cookie: admCookie } }
  );
  assert.equal(admLedgerRes.status, 200);
  assert.equal(admLedgerRes.json.mode, "ledger");
  assert.equal(admLedgerRes.json.ledger.dates.length, 3);
  assert.equal(admLedgerRes.json.ledger.rows.length, 3);
  assert.equal(admLedgerRes.json.ledger.summary.totalDays, 3);

  const todayRow = admLedgerRes.json.ledger.rows.find((r) => r.date === todayDate);
  assert.ok(todayRow, "Expected today's row in ledger");
  const memCell = todayRow.cells["22222222-2222-4222-8222-222222222205"];
  assert.equal(memCell?.status, "present");
  assert.ok(memCell?.checkInTime);
  assert.ok(memCell?.checkOutTime);

  const priorRow = admLedgerRes.json.ledger.rows.find((r) => r.date === startDate);
  assert.equal(priorRow.cells["22222222-2222-4222-8222-222222222205"]?.status, "absent");

  // Ledger CSV export includes formula-escaped user header and date rows
  const ledgerCsv = await api(
    `/api/attendance?startDate=${startDate}&endDate=${todayDate}&format=csv`,
    { headers: { cookie: admCookie } }
  );
  assert.equal(ledgerCsv.status, 200);
  assert.ok(ledgerCsv.text.includes(`"'=Test Admin`));
  assert.ok(ledgerCsv.text.includes(todayDate));
});

test("AdFlow creative queue: normal tasks stay non-AdFlow unless ticked, blank creative auto-created when ticked, & deleted ads never reappear", async () => {
  const admCookie = await loginAs("t-admin@test.local");
  const creatorId = "c4259f60-f408-4a4b-8dbf-81e94c0f9a64";

  // 0. Creating a normal task (even for a content creator with "script" in title) WITHOUT ticking isAdflowTask
  //    must NOT generate a Creative ID or create an AdFlow blank creative, and must stay non-AdFlow.
  const adsBeforeNormal = mockAds.length;
  const normalRes = await api("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: admCookie },
    body: JSON.stringify({
      title: "Review script notes for weekly call",
      assigneeId: creatorId,
      description: "Normal operational task",
      dueDate: new Date().toISOString().slice(0, 10),
      isAdflowTask: false,
      generateCreativeId: false,
    }),
  });
  assert.equal(normalRes.status, 200);
  assert.deepEqual(normalRes.json.creativeIds, []);
  assert.equal(mockAds.length, adsBeforeNormal);

  const tasksListRes = await api("/api/tasks", { headers: { cookie: admCookie } });
  assert.equal(tasksListRes.status, 200);
  const createdNormalTask = tasksListRes.json.tasks.find(
    (t) => t.id === normalRes.json.target?.id
  );
  assert.ok(createdNormalTask);
  assert.equal(createdNormalTask.isAdflowTask, false);

  // Non-AdFlow task revision does not stamp AdFlow editor/creator productionStage
  const revNormalRes = await api("/api/tasks", {
    method: "PATCH",
    headers: { "Content-Type": "application/json", cookie: admCookie },
    body: JSON.stringify({
      id: createdNormalTask.id,
      workflowAction: "request_changes",
      revisionReason: "Revision Requested",
      revisionNotes: "Please expand notes",
    }),
  });
  assert.equal(revNormalRes.status, 200);
  const tasksAfterRev = await api("/api/tasks", { headers: { cookie: admCookie } });
  const revisedNormalTask = tasksAfterRev.json.tasks.find(
    (t) => t.id === createdNormalTask.id
  );
  assert.equal(revisedNormalTask?.isRevisionRequested, true);
  assert.equal(revisedNormalTask?.productionStage, undefined);

  // 1. Seed a creative task for creator whose ad in AdFlow was soft-deleted (like KRI0038/39/47)
  const deletedAdId = crypto.randomUUID();
  const deletedCode = "KRI9001";
  mockAds.push({
    id: deletedAdId,
    name: deletedCode,
    status: "approved",
    production_stage: "approved",
    creator_id: creatorId,
    deleted_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  const curDb = JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  curDb.daily_team_targets.push({
    id: crypto.randomUUID(),
    user_id: creatorId,
    assigned_by: "22222222-2222-4222-8222-222222222201",
    target_date: new Date().toISOString().slice(0, 10),
    task_name: `${deletedCode} — Creative creation`,
    target_quantity: 1,
    completed_quantity: 0,
    manual_completed_quantity: 0,
    auto_completed_quantity: 0,
    notes: JSON.stringify({
      __meta__: true,
      desc: "Deleted in AdFlow test",
      creativeName: deletedCode,
      adId: deletedAdId,
      productionStage: "approved",
      statusOverride: "completed",
      isAdflowTask: true,
    }),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  fs.writeFileSync(DB_PATH, JSON.stringify(curDb, null, 2), "utf8");

  // 2. Assign a brand-new AdFlow creative task (with tick box enabled: isAdflowTask: true) -> auto-creates blank creative
  const createRes = await api("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: admCookie },
    body: JSON.stringify({
      title: "Creative creation",
      assigneeId: creatorId,
      description: "Test blank creative auto creation",
      dueDate: new Date().toISOString().slice(0, 10),
      isAdflowTask: true,
      generateCreativeId: true,
    }),
  });
  assert.equal(createRes.status, 200);
  const newCode = createRes.json.creativeIds?.[0];
  assert.ok(newCode, "Expected a generated Creative ID");

  const createdBlankAd = mockAds.find((a) => a.name === newCode && !a.deleted_at);
  assert.ok(createdBlankAd, "Expected blank creative to be created in AdFlow");
  assert.equal(createdBlankAd.creator_id, creatorId);
  assert.equal(createdBlankAd.status, "draft");
  assert.equal(createdBlankAd.production_stage, "script_writing");

  // 3. Query /api/adflow/creative-ids -> neither deleted ad nor newly created blank ad should appear in pendingCreativeIds
  const queueRes = await api(`/api/adflow/creative-ids?creatorId=${creatorId}`);
  assert.equal(queueRes.status, 200);
  assert.ok(
    !queueRes.json.pendingCreativeIds.includes(deletedCode),
    `Deleted creative ${deletedCode} must not reappear in pendingCreativeIds`
  );
  assert.ok(
    !queueRes.json.pendingCreativeIds.includes(newCode),
    `Auto-created creative ${newCode} must not appear in pendingCreativeIds`
  );
});

test("Feedback & Feature Requests: screenshot attachments are sanitized, persisted, and included in email", async () => {
  const memCookie = await loginAs("t-mem@test.local");
  const admCookie = await loginAs("t-admin@test.local");

  const fbRes = await api("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json", cookie: memCookie },
    body: JSON.stringify({
      type: "bug",
      title: "Attachment screenshot test",
      details: "Screenshot attached via drag-and-drop",
      attachments: [
        { name: "screen.png", url: "/uploads/screen-123.png", size: 2048, type: "image/png" },
        { name: "evil.html", url: "javascript:alert(1)", size: 100, type: "text/html" },
      ],
    }),
  });
  assert.equal(fbRes.status, 201);
  assert.equal(fbRes.json.request.attachments?.length, 1);
  assert.equal(fbRes.json.request.attachments[0].url, "/uploads/screen-123.png");

  const lastEmail = capturedEmails[capturedEmails.length - 1];
  assert.ok(lastEmail?.html.includes("/uploads/screen-123.png"));
  assert.ok(!lastEmail?.html.includes("javascript:alert(1)"));

  const inboxRes = await api("/api/feedback", { headers: { cookie: admCookie } });
  assert.equal(inboxRes.status, 200);
  const found = inboxRes.json.requests.find((r) => r.id === fbRes.json.request.id);
  assert.equal(found?.attachments?.length, 1);
});
