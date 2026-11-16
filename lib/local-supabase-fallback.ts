const nodeRequire = typeof window === "undefined" ? eval("require") : null;
const fs = nodeRequire ? nodeRequire("fs") : null;
const path = nodeRequire ? nodeRequire("path") : null;
const crypto = nodeRequire ? nodeRequire("crypto") : null;

const DATA_DIR = path ? path.join(process.cwd(), "data") : "";
const LOCAL_DB_FILE = path ? path.join(DATA_DIR, "local-db.json") : "";

export interface LocalDbSchema {
  profiles: Record<string, any>[];
  profile_overrides?: Record<string, Record<string, any>>;
  local_profiles?: Record<string, any>[];
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
  return {
    profiles: [
      {
        id: "4a206a68-c5a4-4d12-be76-90468ea3df44",
        name: "Kritika",
        email: "kritika@satmi.in",
        role: "admin",
        avatar_url: null,
        active: true,
        deleted_at: null,
        created_at: "2026-07-15T10:23:43.168482+00:00",
        updated_at: "2026-07-23T05:25:01.091308+00:00",
      },
      {
        id: "20ec7ea7-6033-4109-bfc6-6a3c1c09df17",
        name: "Kartavya",
        email: "kartavya@satmi.in",
        role: "admin",
        avatar_url: null,
        active: true,
        deleted_at: null,
        created_at: "2026-07-15T12:30:30.797432+00:00",
        updated_at: "2026-10-07T10:06:21.64587+00:00",
      },
      {
        id: "360a1a7a-258a-4591-aee1-7bce60eaee4b",
        name: "Himik",
        email: "himik@satmi.in",
        role: "content_creator",
        avatar_url: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQ-hnT6iGEfDt9tn9wl66uxAi27H8xHb3IQ3tZQTtgAFA&s",
        active: true,
        deleted_at: null,
        created_at: "2026-07-16T10:02:08.551518+00:00",
        updated_at: "2026-10-15T05:01:56.276033+00:00",
      },
      {
        id: "3c8db14b-0e23-40e7-8fab-2c9b7664e588",
        name: "Nikhil",
        email: "nikhil@satmi.in",
        role: "editor",
        avatar_url: null,
        active: true,
        deleted_at: null,
        created_at: "2026-07-15T11:02:41.763669+00:00",
        updated_at: "2026-07-18T06:55:01.144475+00:00",
      },
      {
        id: "2444c7f2-b531-497b-959b-e47d492ea542",
        name: "Priya",
        email: "priya@satmi.in",
        role: "content_creator",
        avatar_url: null,
        active: true,
        deleted_at: null,
        created_at: "2026-07-21T11:21:47.765453+00:00",
        updated_at: "2026-07-21T11:21:48.09883+00:00",
      },
      {
        id: "4e3bdd23-8b64-4bcd-a790-ca7b17024e82",
        name: "Kunal",
        email: "kunal@satmi.in",
        role: "editor",
        avatar_url: null,
        active: true,
        deleted_at: null,
        created_at: "2026-07-16T10:14:23.630349+00:00",
        updated_at: "2026-07-18T07:56:14.166739+00:00",
      },
      {
        id: "6154c289-84bb-4d0d-8543-70bcaf418b9b",
        name: "Tamanna",
        email: "tamanna@satmi.in",
        role: "content_creator",
        avatar_url: null,
        active: true,
        deleted_at: null,
        created_at: "2026-07-16T10:17:33.21603+00:00",
        updated_at: "2026-07-18T07:01:05.291949+00:00",
      },
      {
        id: "1927e832-b695-475d-922a-8ea4040fb50e",
        name: "Yash",
        email: "yash@satmi.in",
        role: "content_creator",
        avatar_url: null,
        active: true,
        deleted_at: null,
        created_at: "2026-09-22T07:06:54.076006+00:00",
        updated_at: "2026-09-22T07:06:54.31323+00:00",
      },
      {
        id: "eaf203fc-569b-4735-a7c8-99a3566dc4c3",
        name: "ishika",
        email: "ishika@satmi.in",
        role: "manager",
        avatar_url: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcR5Mt77nt88UPEkTYmjtTHZhgtYHhF2JVCOQo_KK999T12BRh2vnl37sqe8&s=10",
        active: true,
        deleted_at: null,
        created_at: "2026-07-15T10:57:36.918884+00:00",
        updated_at: "2026-10-15T05:11:15.632381+00:00",
      },
      {
        id: "c4259f60-f408-4a4b-8dbf-81e94c0f9a64",
        name: "kritika test",
        email: "smvkritika@gmail.com",
        role: "content_creator",
        avatar_url: null,
        active: true,
        deleted_at: null,
        created_at: "2026-07-24T08:47:41.473777+00:00",
        updated_at: "2026-11-16T10:47:56.290375+00:00",
      },
    ],
    profile_overrides: {},
    local_profiles: [],
    daily_team_targets: [],
    ads: [],
    ad_overrides: {},
    audit_logs: [],
    notifications: [],
    daily_task_rules: [],
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
      profile_overrides:
        parsed.profile_overrides && typeof parsed.profile_overrides === "object"
          ? parsed.profile_overrides
          : {},
      local_profiles: Array.isArray(parsed.local_profiles) ? parsed.local_profiles : [],
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
        const qty = Math.max(1, Number(rule.target_quantity) || 1);
        for (let i = 1; i <= qty; i++) {
          const splitTaskName =
            qty > 1 ? `${rule.task_name} (${i}/${qty})` : rule.task_name;
          const exists = db.daily_team_targets.some(
            (t) =>
              t.user_id === rule.user_id &&
              t.target_date === startDate &&
              (t.task_name === splitTaskName || t.task_name === rule.task_name)
          );
          if (!exists) {
            db.daily_team_targets.push({
              id: crypto.randomUUID(),
              user_id: rule.user_id,
              assigned_by: rule.created_by || rule.user_id,
              target_date: startDate,
              task_name: splitTaskName,
              target_quantity: 1,
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
      if (tableName === "profiles") {
        if (!db.local_profiles) db.local_profiles = [];
        if (!db.profile_overrides) db.profile_overrides = {};
        for (const row of inserted) {
          db.profile_overrides[row.id] = {
            ...(db.profile_overrides[row.id] || {}),
            ...row,
          };
          const lIdx = db.local_profiles.findIndex(
            (lp) => lp.id === row.id || String(lp.email || "").toLowerCase() === String(row.email || "").toLowerCase()
          );
          if (lIdx !== -1) {
            db.local_profiles[lIdx] = row;
          } else {
            db.local_profiles.push(row);
          }
        }
      }
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
          if (tableName === "profiles") {
            if (!db.profile_overrides) db.profile_overrides = {};
            db.profile_overrides[tableRows[i].id] = {
              ...(db.profile_overrides[tableRows[i].id] || {}),
              ...(bodyObj || {}),
              updated_at: bodyObj?.updated_at || now,
            };
          }
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
let lastProfilesSyncAt = 0;

async function syncUpstreamAdFlowProfiles(url: URL, init?: RequestInit) {
  if (Date.now() < supabaseOfflineUntil) return;
  if (Date.now() - lastProfilesSyncAt < 8_000) return;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);
  try {
    const upstreamProfilesUrl = `${url.origin}/rest/v1/profiles?select=*`;
    const res = await fetch(upstreamProfilesUrl, {
      ...init,
      method: "GET",
      headers: {
        ...(init?.headers || {}),
        accept: "application/json",
      },
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) return;

    const upstreamRows = await res.json();
    if (!Array.isArray(upstreamRows) || upstreamRows.length === 0) return;

    const db = loadLocalDb();
    const overrides = db.profile_overrides || {};
    const localCreated = Array.isArray(db.local_profiles) ? db.local_profiles : [];

    // Merge upstream AdFlow profiles with any local dashboard overrides (e.g. developer role assignment)
    const merged: Record<string, any>[] = upstreamRows.map((upRow: Record<string, any>) => {
      const ov = overrides[upRow.id];
      if (!ov) return upRow;
      return {
        ...upRow,
        ...(ov.role ? { role: ov.role } : {}),
        ...(ov.name ? { name: ov.name } : {}),
        ...(ov.avatar_url !== undefined ? { avatar_url: ov.avatar_url } : {}),
        ...(ov.active !== undefined ? { active: ov.active } : {}),
        ...(ov.deleted_at !== undefined ? { deleted_at: ov.deleted_at } : {}),
      };
    });

    // Append any locally created dashboard profiles (e.g. a new Developer account added in Task Manager)
    const existingIds = new Set(merged.map((m) => m.id));
    const existingEmails = new Set(
      merged.map((m) => String(m.email || "").toLowerCase())
    );
    for (const lp of localCreated) {
      const lpEmail = String(lp.email || "").toLowerCase();
      if (!existingIds.has(lp.id) && !existingEmails.has(lpEmail)) {
        const ov = overrides[lp.id] || {};
        merged.push({ ...lp, ...ov });
      }
    }

    db.profiles = merged;
    saveLocalDb(db);
    lastProfilesSyncAt = Date.now();
  } catch {
    clearTimeout(timeout);
    supabaseOfflineUntil = Date.now() + 30_000;
  }
}

export async function resilientSupabaseFetch(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<Response> {
  const urlStr =
    typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  const method = (init?.method || "GET").toUpperCase();
  const url = new URL(urlStr);

  // Allow read-only sign-in token verification against AdFlow Auth (/auth/v1/token),
  // falling back to local auth if user has local credentials or upstream is unreachable.
  if (url.pathname.endsWith("/auth/v1/token") && method === "POST") {
    if (Date.now() >= supabaseOfflineUntil) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2500);
      try {
        const res = await fetch(input, {
          ...init,
          signal: controller.signal,
        });
        clearTimeout(timeout);
        if (res.ok) {
          return res;
        }
      } catch {
        clearTimeout(timeout);
      }
    }
    return handleLocalSupabaseRequest(urlStr, init);
  }

  // CRITICAL RULE: NEVER send write/mutation/RPC/auth-admin requests to upstream AdFlow Supabase!
  // All mutations and local Task Manager state operate strictly against the local persistent store.
  if (method !== "GET" && method !== "HEAD") {
    return handleLocalSupabaseRequest(urlStr, init);
  }

  if (urlStr.includes("/rest/v1/rpc/") || urlStr.includes("/auth/v1/")) {
    return handleLocalSupabaseRequest(urlStr, init);
  }

  // Sync live users from AdFlow (`profiles`) while preserving local dashboard role overrides (e.g. `developer`)
  if (url.pathname === "/rest/v1/profiles") {
    await syncUpstreamAdFlowProfiles(url, init);
    return handleLocalSupabaseRequest(urlStr, init);
  }

  // Only attempt read-only GET sync of `ads` from upstream if online; all other local state tables
  // (`daily_team_targets`, `notifications`, `audit_logs`, `daily_task_rules`, etc.)
  // are served with 0ms read-after-write consistency from the local DB.
  const isAdsRead = url.pathname === "/rest/v1/ads";
  if (!isAdsRead) {
    return handleLocalSupabaseRequest(urlStr, init);
  }

  if (Date.now() < supabaseOfflineUntil) {
    return handleLocalSupabaseRequest(urlStr, init);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2000);

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
