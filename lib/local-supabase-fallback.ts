const nodeRequire = typeof window === "undefined" ? eval("require") : null;
const fs = nodeRequire ? nodeRequire("fs") : null;
const path = nodeRequire ? nodeRequire("path") : null;
const crypto = nodeRequire ? nodeRequire("crypto") : null;

const DATA_DIR = path ? path.join(process.cwd(), "data") : "";
const LOCAL_DB_FILE = path ? path.join(DATA_DIR, "local-db.json") : "";

export interface LocalDbSchema {
  profiles: Record<string, any>[];
  daily_team_targets: Record<string, any>[];
  ads: Record<string, any>[];
  ad_overrides: Record<string, Record<string, any>>;
  audit_logs: Record<string, any>[];
  notifications: Record<string, any>[];
  daily_task_rules: Record<string, any>[];
  auth_users: Record<string, any>[];
  personal_notes: Record<string, any>[];
  reminders: Record<string, any>[];
  feature_requests: Record<string, any>[];
}

function todayIST(): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function createInitialSeed(): LocalDbSchema {
  const today = todayIST();
  const now = new Date().toISOString();

  return {
    profiles: [
      {
        id: "011c1a7a-258a-4591-aee1-7bce60eaee01",
        name: "Kritika",
        email: "kritika@satmi.in",
        role: "admin",
        avatar_url: JSON.stringify({
          employeeCode: "KRI",
          color: "#2563eb",
          dailyCapacityUnits: 10,
        }),
        active: true,
        deleted_at: null,
        created_at: "2026-10-01T00:00:00.000Z",
        updated_at: now,
      },
      {
        id: "360a1a7a-258a-4591-aee1-7bce60eaee4b",
        name: "Himik",
        email: "himik@satmi.in",
        role: "editor",
        avatar_url: JSON.stringify({
          employeeCode: "HIM",
          color: "#10b981",
          dailyCapacityUnits: 6,
        }),
        active: true,
        deleted_at: null,
        created_at: "2026-10-01T00:00:00.000Z",
        updated_at: now,
      },
      {
        id: "022c1a7a-258a-4591-aee1-7bce60eaee02",
        name: "Nikhil",
        email: "nikhil@satmi.in",
        role: "manager",
        avatar_url: JSON.stringify({
          employeeCode: "NIK",
          color: "#8b5cf6",
          dailyCapacityUnits: 8,
        }),
        active: true,
        deleted_at: null,
        created_at: "2026-10-01T00:00:00.000Z",
        updated_at: now,
      },
      {
        id: "033c1a7a-258a-4591-aee1-7bce60eaee03",
        name: "Priya",
        email: "priya@satmi.in",
        role: "content_creator",
        avatar_url: JSON.stringify({
          employeeCode: "PRI",
          color: "#f59e0b",
          dailyCapacityUnits: 4,
        }),
        active: true,
        deleted_at: null,
        created_at: "2026-10-01T00:00:00.000Z",
        updated_at: now,
      },
    ],
    daily_team_targets: [
      {
        id: "6445364a-7871-4826-8794-589f284d15b9",
        user_id: "360a1a7a-258a-4591-aee1-7bce60eaee4b",
        assigned_by: "011c1a7a-258a-4591-aee1-7bce60eaee01",
        target_date: today,
        task_name: "Quarterly Operations Review & QA Checklist",
        target_quantity: 4,
        completed_quantity: 2,
        manual_completed_quantity: 2,
        auto_completed_quantity: 0,
        notes: JSON.stringify({
          __meta__: true,
          desc: "Verify all daily targets, review workflow deliverables, and audit team capacity.",
          statusOverride: "in_progress",
          priority: "medium",
          estimatedHours: 3,
          actualHours: 1.5,
        }),
        carried_from_target_id: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: "7555364a-7871-4826-8794-589f284d15c0",
        user_id: "022c1a7a-258a-4591-aee1-7bce60eaee02",
        assigned_by: "011c1a7a-258a-4591-aee1-7bce60eaee01",
        target_date: today,
        task_name: "Campaign Performance Audit & Weekly Reporting",
        target_quantity: 2,
        completed_quantity: 0,
        manual_completed_quantity: 0,
        auto_completed_quantity: 0,
        notes: JSON.stringify({
          __meta__: true,
          desc: "Prepare weekly ROAS breakdown and creative velocity metrics for leadership.",
          statusOverride: "todo",
          priority: "medium",
          estimatedHours: 2,
        }),
        carried_from_target_id: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: "8665364a-7871-4826-8794-589f284d15c1",
        user_id: "033c1a7a-258a-4591-aee1-7bce60eaee03",
        assigned_by: "011c1a7a-258a-4591-aee1-7bce60eaee01",
        target_date: today,
        task_name: "Brand Storyboard & Hook Variations Pack",
        target_quantity: 3,
        completed_quantity: 3,
        manual_completed_quantity: 3,
        auto_completed_quantity: 0,
        notes: JSON.stringify({
          __meta__: true,
          desc: "Three high-converting hook variations ready for final manager approval.",
          deliverableUrl: "https://drive.google.com/file/d/satmi-hooks-pack",
          statusOverride: "in_review",
          priority: "high",
          estimatedHours: 2.5,
          actualHours: 2.5,
        }),
        carried_from_target_id: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: "9775364a-7871-4826-8794-589f284d15c2",
        user_id: "011c1a7a-258a-4591-aee1-7bce60eaee01",
        assigned_by: "011c1a7a-258a-4591-aee1-7bce60eaee01",
        target_date: today,
        task_name: "Executive Sprint Planning & Resource Allocation",
        target_quantity: 1,
        completed_quantity: 1,
        manual_completed_quantity: 1,
        auto_completed_quantity: 0,
        notes: JSON.stringify({
          __meta__: true,
          desc: "Finalize daily capacity targets and SLA thresholds.",
          statusOverride: "completed",
          priority: "medium",
          estimatedHours: 1,
          actualHours: 1,
        }),
        carried_from_target_id: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: "a885364a-7871-4826-8794-589f284d15c3",
        user_id: "360a1a7a-258a-4591-aee1-7bce60eaee4b",
        assigned_by: "011c1a7a-258a-4591-aee1-7bce60eaee01",
        target_date: today,
        task_name: "Ad video edits",
        target_quantity: 5,
        completed_quantity: 3,
        manual_completed_quantity: 3,
        auto_completed_quantity: 0,
        notes: "Canonical AdFlow daily video editing quota.",
        carried_from_target_id: null,
        created_at: now,
        updated_at: now,
      },
    ],
    ads: [
      {
        id: "ad01364a-7871-4826-8794-589f284d15d1",
        name: "SATMI Festive Glow Serum — Hook A",
        status: "editing",
        production_stage: "editing",
        editor_id: "360a1a7a-258a-4591-aee1-7bce60eaee4b",
        creator_id: "033c1a7a-258a-4591-aee1-7bce60eaee03",
        editing_started_at: now,
        shoot_completed_at: now,
        submitted_at: null,
        approved_at: null,
        drive_url: "https://drive.google.com/drive/folders/satmi-ad-01",
        deadline: today,
        notes: "Primary 9:16 vertical reel creative for Meta campaign.",
        deleted_at: null,
        created_at: now,
        updated_at: now,
      },
      {
        id: "ad02364a-7871-4826-8794-589f284d15d2",
        name: "SATMI Founder Story — Testimonial Cut",
        status: "pending_review",
        production_stage: "creator_review",
        editor_id: "360a1a7a-258a-4591-aee1-7bce60eaee4b",
        creator_id: "033c1a7a-258a-4591-aee1-7bce60eaee03",
        editing_started_at: now,
        shoot_completed_at: now,
        submitted_at: now,
        approved_at: null,
        drive_url: "https://drive.google.com/drive/folders/satmi-ad-02",
        deadline: today,
        notes: "Awaiting final review sign-off.",
        deleted_at: null,
        created_at: now,
        updated_at: now,
      },
    ],
    ad_overrides: {},
    audit_logs: [
      {
        id: "log-seed-01",
        actor_id: "011c1a7a-258a-4591-aee1-7bce60eaee01",
        action: "created_task",
        target_type: "daily_team_target",
        target_id: "6445364a-7871-4826-8794-589f284d15b9",
        metadata: {
          taskName: "Quarterly Operations Review & QA Checklist",
          targetQuantity: 4,
          targetDate: today,
        },
        created_at: now,
      },
    ],
    notifications: [
      {
        id: "notif-seed-01",
        user_id: "011c1a7a-258a-4591-aee1-7bce60eaee01",
        title: "Deliverable Submitted for Review",
        body: "Priya submitted Brand Storyboard & Hook Variations Pack for review.",
        read_at: null,
        ad_id: null,
        created_at: now,
      },
    ],
    daily_task_rules: [
      {
        id: "rule-seed-01",
        user_id: "360a1a7a-258a-4591-aee1-7bce60eaee4b",
        task_name: "Ad video edits",
        target_quantity: 5,
        notes: "Daily AdFlow editing quota",
        active: true,
        starts_on: "2026-10-01",
        ends_on: null,
        created_by: "011c1a7a-258a-4591-aee1-7bce60eaee01",
        created_at: now,
        updated_at: now,
      },
      {
        id: "rule-seed-02",
        user_id: "033c1a7a-258a-4591-aee1-7bce60eaee03",
        task_name: "Script writing",
        target_quantity: 4,
        notes: "Daily creative script writing target",
        active: true,
        starts_on: "2026-10-01",
        ends_on: null,
        created_by: "011c1a7a-258a-4591-aee1-7bce60eaee01",
        created_at: now,
        updated_at: now,
      },
    ],
    auth_users: [],
    personal_notes: [],
    reminders: [],
    feature_requests: [],
  };
}

export function loadLocalDb(): LocalDbSchema {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(LOCAL_DB_FILE)) {
      const initial = createInitialSeed();
      fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(initial, null, 2), "utf8");
      return initial;
    }
    const raw = fs.readFileSync(LOCAL_DB_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<LocalDbSchema>;
    if (!parsed.profiles || parsed.profiles.length === 0) {
      const initial = createInitialSeed();
      fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(initial, null, 2), "utf8");
      return initial;
    }
    return {
      profiles: parsed.profiles || [],
      daily_team_targets: parsed.daily_team_targets || [],
      ads: parsed.ads || [],
      ad_overrides:
        parsed.ad_overrides && typeof parsed.ad_overrides === "object"
          ? parsed.ad_overrides
          : {},
      audit_logs: parsed.audit_logs || [],
      notifications: parsed.notifications || [],
      daily_task_rules: parsed.daily_task_rules || [],
      auth_users: parsed.auth_users || [],
      personal_notes: parsed.personal_notes || [],
      reminders: parsed.reminders || [],
      feature_requests: parsed.feature_requests || [],
    };
  } catch {
    return createInitialSeed();
  }
}

export function saveLocalDb(db: LocalDbSchema) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(db, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to write local fallback DB:", err);
  }
}

function matchesCondition(rowValue: any, expr: string): boolean {
  if (expr === "is.null") {
    return rowValue === null || rowValue === undefined;
  }
  if (expr === "not.is.null") {
    return rowValue !== null && rowValue !== undefined;
  }
  if (expr.startsWith("eq.")) {
    const target = expr.slice(3);
    if (target === "true") return rowValue === true;
    if (target === "false") return rowValue === false;
    return String(rowValue ?? "") === target;
  }
  if (expr.startsWith("neq.")) {
    const target = expr.slice(4);
    if (target === "true") return rowValue !== true;
    if (target === "false") return rowValue !== false;
    return String(rowValue ?? "") !== target;
  }
  if (expr.startsWith("ilike.")) {
    const pattern = expr.slice(6).toLowerCase();
    const clean = pattern.replace(/^%/, "").replace(/%$/, "");
    const val = String(rowValue ?? "").toLowerCase();
    if (pattern.startsWith("%") && pattern.endsWith("%")) {
      return val.includes(clean);
    }
    if (pattern.startsWith("%")) {
      return val.endsWith(clean);
    }
    if (pattern.endsWith("%")) {
      return val.startsWith(clean);
    }
    return val === clean;
  }
  if (expr.startsWith("in.(") && expr.endsWith(")")) {
    const inner = expr.slice(4, -1);
    const items = inner
      .split(",")
      .map((s) => s.trim().replace(/^"|"$/g, ""));
    return items.includes(String(rowValue ?? ""));
  }
  if (expr.startsWith("gte.")) {
    return String(rowValue ?? "") >= expr.slice(4);
  }
  if (expr.startsWith("gt.")) {
    return String(rowValue ?? "") > expr.slice(3);
  }
  if (expr.startsWith("lte.")) {
    return String(rowValue ?? "") <= expr.slice(4);
  }
  if (expr.startsWith("lt.")) {
    return String(rowValue ?? "") < expr.slice(3);
  }
  return true;
}

function filterRows(rows: Record<string, any>[], searchParams: URLSearchParams): Record<string, any>[] {
  const reserved = new Set(["select", "order", "limit", "offset", "on_conflict", "columns"]);
  let result = [...rows];

  for (const [key, val] of searchParams.entries()) {
    if (reserved.has(key)) continue;
    if (key === "or" && val.startsWith("(") && val.endsWith(")")) {
      const inner = val.slice(1, -1);
      const clauses = inner.split(",");
      result = result.filter((row) =>
        clauses.some((clause) => {
          const dotIdx = clause.indexOf(".");
          if (dotIdx === -1) return true;
          const col = clause.slice(0, dotIdx);
          const cond = clause.slice(dotIdx + 1);
          return matchesCondition(row[col], cond);
        })
      );
      continue;
    }

    result = result.filter((row) => matchesCondition(row[key], val));
  }

  // Apply ordering
  const orderParams = searchParams.getAll("order");
  if (orderParams.length > 0) {
    const orderSpecs = orderParams
      .flatMap((o) => o.split(","))
      .map((spec) => {
        const parts = spec.trim().split(".");
        return {
          col: parts[0],
          asc: parts[1] !== "desc",
        };
      });

    result.sort((a, b) => {
      for (const { col, asc } of orderSpecs) {
        const va = a[col] ?? "";
        const vb = b[col] ?? "";
        if (va < vb) return asc ? -1 : 1;
        if (va > vb) return asc ? 1 : -1;
      }
      return 0;
    });
  }

  // Apply limit
  const limitParam = searchParams.get("limit");
  if (limitParam) {
    const lim = Number(limitParam);
    if (!Number.isNaN(lim) && lim >= 0) {
      result = result.slice(0, lim);
    }
  }

  return result;
}

function handleLocalSupabaseRequest(urlStr: string, init?: RequestInit): Response {
  const url = new URL(urlStr);
  const method = (init?.method || "GET").toUpperCase();
  const headers = new Headers(init?.headers || {});
  const accept = headers.get("accept") || "";
  const prefer = headers.get("prefer") || "";
  const isSingleObject = accept.includes("application/vnd.pgrst.object+json");

  let bodyObj: any = null;
  if (init?.body && typeof init.body === "string") {
    try {
      bodyObj = JSON.parse(init.body);
    } catch {}
  }

  const db = loadLocalDb();

  // 1. Auth endpoints (/auth/v1/...)
  if (url.pathname.startsWith("/auth/v1/")) {
    if (url.pathname.endsWith("/token") && method === "POST") {
      const email = String(bodyObj?.email || "").toLowerCase();
      const password = String(bodyObj?.password || "");
      const foundAuth = db.auth_users.find(
        (u) => String(u.email || "").toLowerCase() === email && u.password === password
      );
      if (!foundAuth) {
        return new Response(
          JSON.stringify({ error: "invalid_grant", error_description: "Invalid login credentials" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({
          access_token: `local_token_${foundAuth.id}`,
          token_type: "bearer",
          expires_in: 3600,
          refresh_token: `local_refresh_${foundAuth.id}`,
          user: { id: foundAuth.id, email: foundAuth.email, user_metadata: foundAuth.user_metadata || {} },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (url.pathname.endsWith("/admin/users") && method === "GET") {
      return new Response(
        JSON.stringify({ users: db.auth_users }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (url.pathname.endsWith("/admin/users") && method === "POST") {
      const email = String(bodyObj?.email || "").toLowerCase();
      const existing = db.auth_users.find((u) => String(u.email || "").toLowerCase() === email);
      if (existing) {
        return new Response(
          JSON.stringify({ message: "User already registered" }),
          { status: 422, headers: { "Content-Type": "application/json" } }
        );
      }
      const newUser = {
        id: crypto.randomUUID(),
        email,
        password: bodyObj?.password || "",
        user_metadata: bodyObj?.user_metadata || {},
        created_at: new Date().toISOString(),
      };
      db.auth_users.push(newUser);
      saveLocalDb(db);
      return new Response(
        JSON.stringify({ user: newUser }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    if (url.pathname.includes("/admin/users/") && method === "PUT") {
      const userId = url.pathname.split("/admin/users/")[1];
      const idx = db.auth_users.findIndex((u) => u.id === userId);
      if (idx !== -1) {
        db.auth_users[idx] = {
          ...db.auth_users[idx],
          ...(bodyObj?.email ? { email: bodyObj.email } : {}),
          ...(bodyObj?.password ? { password: bodyObj.password } : {}),
          ...(bodyObj?.user_metadata ? { user_metadata: bodyObj.user_metadata } : {}),
        };
        saveLocalDb(db);
        return new Response(
          JSON.stringify({ user: db.auth_users[idx] }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify({ user: { id: userId } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 2. RPC endpoints (/rest/v1/rpc/...)
  if (url.pathname.startsWith("/rest/v1/rpc/")) {
    const rpcName = url.pathname.replace("/rest/v1/rpc/", "");
    if (rpcName === "materialize_daily_task_rules") {
      const startDate = bodyObj?.p_start || todayIST();
      const activeRules = db.daily_task_rules.filter((r) => {
        if (r.active === false) return false;
        if (r.starts_on && String(r.starts_on) > startDate) return false;
        if (r.ends_on && String(r.ends_on) < startDate) return false;
        return true;
      });
      let createdCount = 0;
      for (const rule of activeRules) {
        const exists = db.daily_team_targets.some(
          (t) =>
            t.user_id === rule.user_id &&
            t.target_date === startDate &&
            t.task_name === rule.task_name
        );
        if (!exists) {
          db.daily_team_targets.push({
            id: crypto.randomUUID(),
            user_id: rule.user_id,
            assigned_by: rule.created_by || rule.user_id,
            target_date: startDate,
            task_name: rule.task_name,
            target_quantity: rule.target_quantity || 1,
            completed_quantity: 0,
            manual_completed_quantity: 0,
            auto_completed_quantity: 0,
            notes: rule.notes || null,
            carried_from_target_id: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          });
          createdCount++;
        }
      }
      if (createdCount > 0) saveLocalDb(db);
      return new Response(JSON.stringify(createdCount), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(null), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  // 3. Standard PostgREST table endpoints (/rest/v1/<table>)
  if (url.pathname.startsWith("/rest/v1/")) {
    const tableName = url.pathname.replace("/rest/v1/", "") as keyof LocalDbSchema;

    // CRITICAL GUARD: AdFlow `ads` table is strictly read-only at all times
    if (tableName === "ads" && method !== "GET" && method !== "HEAD") {
      return new Response(
        JSON.stringify({
          error: "Forbidden: AdFlow ads records are strictly read-only and cannot be modified.",
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    const tableRows: Record<string, any>[] = Array.isArray(db[tableName])
      ? (db[tableName] as Record<string, any>[])
      : [];

    if (method === "GET") {
      const matched = filterRows(tableRows, url.searchParams);
      if (isSingleObject) {
        if (matched.length === 0) {
          return new Response(
            JSON.stringify({
              code: "PGRST116",
              details: "The result contains 0 rows",
              hint: null,
              message: "JSON object requested, multiple (or no) rows returned",
            }),
            { status: 406, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response(JSON.stringify(matched[0]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify(matched), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (method === "POST") {
      const incoming = Array.isArray(bodyObj) ? bodyObj : [bodyObj || {}];
      const onConflict = url.searchParams.get("on_conflict");
      const conflictCols = onConflict ? onConflict.split(",").map((c) => c.trim()) : ["id"];
      const isUpsert = prefer.includes("resolution=merge-duplicates");

      const inserted: Record<string, any>[] = [];
      for (const item of incoming) {
        const now = new Date().toISOString();
        let existingIdx = -1;
        if (isUpsert) {
          existingIdx = tableRows.findIndex((r) =>
            conflictCols.every((col) => r[col] !== undefined && r[col] === item[col])
          );
        }

        if (existingIdx !== -1) {
          tableRows[existingIdx] = {
            ...tableRows[existingIdx],
            ...item,
            updated_at: item.updated_at || now,
          };
          inserted.push(tableRows[existingIdx]);
        } else {
          const newRow: Record<string, any> = {
            id: item.id || crypto.randomUUID(),
            created_at: item.created_at || now,
            updated_at: item.updated_at || now,
            ...item,
          };
          tableRows.push(newRow);
          inserted.push(newRow);
        }
      }

      (db as any)[tableName] = tableRows;
      saveLocalDb(db);

      const responsePayload = isSingleObject ? inserted[0] ?? null : inserted;
      return new Response(JSON.stringify(responsePayload), {
        status: 201,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (method === "PATCH") {
      const matched = filterRows(tableRows, url.searchParams);
      const matchedIds = new Set(matched.map((r) => r.id));
      const updatedRows: Record<string, any>[] = [];
      const now = new Date().toISOString();

      for (let i = 0; i < tableRows.length; i++) {
        if (matchedIds.has(tableRows[i].id)) {
          tableRows[i] = {
            ...tableRows[i],
            ...(bodyObj || {}),
            updated_at: bodyObj?.updated_at || now,
          };
          updatedRows.push(tableRows[i]);
        }
      }

      (db as any)[tableName] = tableRows;
      saveLocalDb(db);

      if (isSingleObject) {
        if (updatedRows.length === 0) {
          return new Response(
            JSON.stringify({
              code: "PGRST116",
              details: "The result contains 0 rows",
              hint: null,
              message: "JSON object requested, multiple (or no) rows returned",
            }),
            { status: 406, headers: { "Content-Type": "application/json" } }
          );
        }
        return new Response(JSON.stringify(updatedRows[0]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify(updatedRows), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (method === "DELETE") {
      const matched = filterRows(tableRows, url.searchParams);
      const matchedIds = new Set(matched.map((r) => r.id));
      const remaining = tableRows.filter((r) => !matchedIds.has(r.id));
      (db as any)[tableName] = remaining;
      saveLocalDb(db);

      const responsePayload = isSingleObject ? matched[0] ?? null : matched;
      return new Response(JSON.stringify(responsePayload), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  return new Response(JSON.stringify([]), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

// Cache network reachability for 60s when DNS/network fails so fallback is instantaneous (<1ms)
let supabaseOfflineUntil = 0;

export async function resilientSupabaseFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const urlStr =
    typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const method = (init?.method || "GET").toUpperCase();

  // CRITICAL RULE: NEVER send write/mutation/RPC/auth-admin requests to upstream Adflow Supabase!
  // All mutations and local Task Manager state operate strictly against the local persistent store.
  if (
    method !== "GET" &&
    method !== "HEAD"
  ) {
    return handleLocalSupabaseRequest(urlStr, init);
  }

  if (urlStr.includes("/rest/v1/rpc/") || urlStr.includes("/auth/v1/")) {
    return handleLocalSupabaseRequest(urlStr, init);
  }

  // Only attempt read-only GET sync of `ads` from upstream if online; all local state tables
  // (`daily_team_targets`, `profiles`, `notifications`, `audit_logs`, `daily_task_rules`, etc.)
  // are served with 0ms read-after-write consistency from the local DB.
  const url = new URL(urlStr);
  const isAdsRead = url.pathname === "/rest/v1/ads";
  if (!isAdsRead) {
    return handleLocalSupabaseRequest(urlStr, init);
  }

  if (Date.now() < supabaseOfflineUntil) {
    return handleLocalSupabaseRequest(urlStr, init);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1500);

  try {
    const res = await fetch(input, {
      ...init,
      method: "GET",
      signal: init?.signal || controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      return handleLocalSupabaseRequest(urlStr, init);
    }
    return res;
  } catch {
    clearTimeout(timeout);
    supabaseOfflineUntil = Date.now() + 60_000;
    return handleLocalSupabaseRequest(urlStr, init);
  }
}
