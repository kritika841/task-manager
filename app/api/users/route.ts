import { NextResponse } from "next/server";
import { ADFLOW_SUPABASE_URL, supabaseAdmin } from "@/lib/supabase";
import { getAdFlowHeaders } from "@/lib/adflow-bridge";
import { Role, User } from "@/lib/types";
import { getEmployeeCode, getUserColor } from "@/lib/utils";
import { canReviewTasks, hashPassword, resolveRequestActor } from "@/lib/auth-server";

async function syncProfilePatchToAdFlow(id: string, patch: Record<string, any>) {
  if (!id || Object.keys(patch).length === 0) return;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    await fetch(
      `${ADFLOW_SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(id)}`,
      {
        method: "PATCH",
        headers: getAdFlowHeaders(),
        body: JSON.stringify(patch),
        signal: controller.signal,
      }
    );
  } catch (err) {
    console.warn("AdFlow profile sync skipped:", err);
  } finally {
    clearTimeout(timeout);
  }
}

const VALID_ROLES = new Set<Role>([
  "admin",
  "manager",
  "developer",
  "editor",
  "content_creator",
  "media_buyer",
  "member",
]);

function getDepartment(role: string): string {
  switch (role) {
    case "admin":
      return "Executive & Admin";
    case "manager":
      return "Operations & Review";
    case "editor":
      return "Video Editing";
    case "content_creator":
      return "Content & Creative";
    case "media_buyer":
      return "Media & Growth";
    case "developer":
      return "Engineering & Product";
    default:
      return "Operations";
  }
}

function getDailyCapacity(role: string): number {
  switch (role) {
    case "editor":
      return 6;
    case "content_creator":
      return 4;
    case "media_buyer":
      return 5;
    case "developer":
      return 6;
    case "manager":
      return 8;
    case "admin":
      return 10;
    default:
      return 5;
  }
}

function parseUserMetadata(avatarUrl: string | null, name: string, role: string) {
  let color: string | undefined;
  let employeeCode: string | undefined;
  let dailyCapacityUnits: number | undefined;
  let passwordHash: string | undefined;
  let realAvatarUrl: string | undefined;

  if (avatarUrl) {
    try {
      if (avatarUrl.startsWith("{") && avatarUrl.endsWith("}")) {
        const parsed = JSON.parse(avatarUrl);
        color = parsed.color;
        employeeCode = parsed.employeeCode;
        dailyCapacityUnits = parsed.dailyCapacityUnits;
        passwordHash = parsed.passwordHash;
        realAvatarUrl = parsed.realAvatarUrl;
      } else if (avatarUrl.startsWith("#")) {
        color = avatarUrl;
      } else if (avatarUrl.startsWith("http") || avatarUrl.startsWith("/")) {
        realAvatarUrl = avatarUrl;
      }
    } catch {
      if (avatarUrl.startsWith("http") || avatarUrl.startsWith("/")) {
        realAvatarUrl = avatarUrl;
      }
    }
  }

  const code = getEmployeeCode(name, employeeCode);
  const resolvedColor = getUserColor(code, color);
  const resolvedCapacity =
    typeof dailyCapacityUnits === "number" && dailyCapacityUnits > 0
      ? dailyCapacityUnits
      : getDailyCapacity(role);

  return {
    employeeCode: code,
    color: resolvedColor,
    dailyCapacityUnits: resolvedCapacity,
    passwordHash,
    realAvatarUrl,
  };
}

export async function GET(req: Request) {
  try {
    const { actor } = await resolveRequestActor(req);
    if (!actor) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

    const url = new URL(req.url);
    const includeInactive = url.searchParams.get("includeInactive") === "true";

    let query = supabaseAdmin
      .from("profiles")
      .select("id, name, email, role, avatar_url, active, created_at, updated_at, deleted_at")
      .order("name", { ascending: true });

    if (!includeInactive) {
      query = query.is("deleted_at", null).eq("active", true);
    }

    const { data: rows, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const users: User[] = (rows || []).map((p) => {
      const { employeeCode, color, dailyCapacityUnits } = parseUserMetadata(
        p.avatar_url,
        p.name || p.email,
        p.role
      );
      return {
        id: p.id,
        name: p.name || p.email.split("@")[0],
        email: p.email,
        role: (p.role as Role) || "member",
        avatar: employeeCode.slice(0, 2),
        department: getDepartment(p.role),
        active: p.active !== false && !p.deleted_at,
        dailyCapacityUnits,
        employeeCode,
        color,
        deletedAt: p.deleted_at,
      };
    });

    const visibleUsers = canReviewTasks(actor.role)
      ? users
      : users.filter((u) => u.id === actor.id);

    return NextResponse.json({ users: visibleUsers });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to fetch users" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Server-side role check: admins and developers have full member provisioning permissions
    const auth = await resolveRequestActor(req);
    if (!auth.actor) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    if (
      auth.actor.role !== "admin" &&
      auth.actor.role !== "developer"
    ) {
      return NextResponse.json(
        { error: "Forbidden: Only workspace Admins or Developers can provision team members." },
        { status: 403 }
      );
    }

    const name = (body.name || "").trim();
    const email = (body.email || "").trim().toLowerCase();
    const rawRole = body.role !== undefined ? String(body.role).trim() : "member";
    if (!VALID_ROLES.has(rawRole as Role)) {
      return NextResponse.json(
        { error: "Invalid role. Allowed roles: admin, manager, developer, editor, content_creator, media_buyer, member." },
        { status: 400 }
      );
    }
    const role = rawRole as Role;
    const employeeCode = (body.employeeCode || getEmployeeCode(name)).trim().toUpperCase();
    const color = body.color || getUserColor(employeeCode);
    const rawCapacity = body.dailyCapacityUnits !== undefined ? Number(body.dailyCapacityUnits) : getDailyCapacity(role);
    if (!Number.isFinite(rawCapacity) || rawCapacity < 1 || rawCapacity > 100) {
      return NextResponse.json(
        { error: "dailyCapacityUnits must be a number between 1 and 100." },
        { status: 400 }
      );
    }
    const capacityUnits = Math.round(rawCapacity);
    const password = body.password ? String(body.password).trim() : null;

    if (!name || !email) {
      return NextResponse.json({ error: "Name and email are required" }, { status: 400 });
    }

    // 1. Provision user in local auth store if password provided (read-only wrt upstream AdFlow DB)
    let authUserId: string | null = null;
    if (password) {
      const { data: authData, error: authCreateErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name, role },
      });

      if (authData?.user) {
        authUserId = authData.user.id;
      } else if (authCreateErr && authCreateErr.message.toLowerCase().includes("already registered")) {
        const { data: listData } = await supabaseAdmin.auth.admin.listUsers();
        const found = listData?.users?.find((u) => u.email === email);
        if (found) {
          authUserId = found.id;
          await supabaseAdmin.auth.admin.updateUserById(found.id, { password });
        }
      } else if (authCreateErr) {
        console.warn("Auth user creation warning:", authCreateErr.message);
      }
    }

    const metaObj: Record<string, any> = {
      color,
      employeeCode,
      dailyCapacityUnits: capacityUnits,
    };
    if (password) {
      metaObj.passwordHash = hashPassword(password);
    }
    const meta = JSON.stringify(metaObj);

    // 2. Check if user already exists in profiles table
    const { data: existing } = await supabaseAdmin
      .from("profiles")
      .select("id, email, deleted_at")
      .eq("email", email)
      .maybeSingle();

    if (existing) {
      // Reactivate or update local profile override
      const { data: reactivated, error: reactivateErr } = await supabaseAdmin
        .from("profiles")
        .update({
          name,
          role,
          active: true,
          deleted_at: null,
          avatar_url: meta,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id)
        .select()
        .single();

      if (reactivateErr) {
        return NextResponse.json({ error: reactivateErr.message }, { status: 500 });
      }

      const user: User = {
        id: reactivated.id,
        name: reactivated.name,
        email: reactivated.email,
        role: reactivated.role,
        avatar: employeeCode.slice(0, 2),
        department: getDepartment(reactivated.role),
        active: true,
        dailyCapacityUnits: capacityUnits,
        employeeCode,
        color,
        deletedAt: null,
      };

      return NextResponse.json({ ok: true, user });
    }

    // 3. Insert new local profile
    const insertPayload: Record<string, any> = {
      name,
      email,
      role,
      active: true,
      avatar_url: meta,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      deleted_at: null,
    };

    if (authUserId) {
      insertPayload.id = authUserId;
    }

    const { data: newProfile, error: insertErr } = await supabaseAdmin
      .from("profiles")
      .insert(insertPayload)
      .select()
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 });
    }

    const user: User = {
      id: newProfile.id,
      name: newProfile.name,
      email: newProfile.email,
      role: newProfile.role,
      avatar: employeeCode.slice(0, 2),
      department: getDepartment(newProfile.role),
      active: true,
      dailyCapacityUnits: capacityUnits,
      employeeCode,
      color,
      deletedAt: null,
    };

    return NextResponse.json({ ok: true, user });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to create user" }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { id, name, role, active, employeeCode, color, dailyCapacityUnits, password } = body;

    if (!id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    if (role !== undefined && !VALID_ROLES.has(String(role).trim() as Role)) {
      return NextResponse.json(
        { error: "Invalid role. Allowed roles: admin, manager, developer, editor, content_creator, media_buyer, member." },
        { status: 400 }
      );
    }

    if (dailyCapacityUnits !== undefined) {
      const cap = Number(dailyCapacityUnits);
      if (!Number.isFinite(cap) || cap < 1 || cap > 100) {
        return NextResponse.json(
          { error: "dailyCapacityUnits must be a number between 1 and 100." },
          { status: 400 }
        );
      }
    }

    const auth = await resolveRequestActor(req);
    if (!auth.actor) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    if (
      auth.actor.role !== "admin" &&
      auth.actor.role !== "developer" &&
      (auth.actor.id !== id || role !== undefined || active !== undefined)
    ) {
      return NextResponse.json(
        { error: "Forbidden: Only Admins or Developers can change team roles, account access, or other members." },
        { status: 403 }
      );
    }

    const { data: current, error: fetchErr } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchErr || !current) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    // Optional password update in Supabase Auth
    if (password && typeof password === "string" && password.trim()) {
      try {
        await supabaseAdmin.auth.admin.updateUserById(id, { password: password.trim() });
      } catch (authErr) {
        console.warn("Password update error in Auth:", authErr);
      }
    }

    const updates: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (name) updates.name = name.trim();
    if (role) updates.role = role;
    if (active !== undefined) updates.active = active;

    const currentMeta = parseUserMetadata(current.avatar_url, current.name, current.role);
    const finalCode = (employeeCode || currentMeta.employeeCode).trim().toUpperCase();
    const finalColor = color || currentMeta.color;
    const finalCapacity =
      dailyCapacityUnits !== undefined ? Number(dailyCapacityUnits) : currentMeta.dailyCapacityUnits;
    const finalPasswordHash =
      password && typeof password === "string" && password.trim()
        ? hashPassword(password.trim())
        : currentMeta.passwordHash;

    const metaPayload: Record<string, any> = {
      color: finalColor,
      employeeCode: finalCode,
      dailyCapacityUnits: finalCapacity,
    };
    if (finalPasswordHash) {
      metaPayload.passwordHash = finalPasswordHash;
    }
    if (currentMeta.realAvatarUrl) {
      metaPayload.realAvatarUrl = currentMeta.realAvatarUrl;
    }

    updates.avatar_url = JSON.stringify(metaPayload);

    const { data: updated, error: updateErr } = await supabaseAdmin
      .from("profiles")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 500 });
    }

    if (auth.actor.role === "admin" || auth.actor.role === "developer") {
      const adflowPatch: Record<string, any> = {};
      if (updates.name) adflowPatch.name = updates.name;
      if (updates.role) adflowPatch.role = updates.role;
      if (updates.active !== undefined) adflowPatch.active = updates.active;
      if (Object.keys(adflowPatch).length > 0) {
        adflowPatch.updated_at = updates.updated_at;
        await syncProfilePatchToAdFlow(id, adflowPatch);
      }
    }

    const user: User = {
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      avatar: finalCode.slice(0, 2),
      department: getDepartment(updated.role),
      active: updated.active !== false && !updated.deleted_at,
      dailyCapacityUnits: finalCapacity,
      employeeCode: finalCode,
      color: finalColor,
      deletedAt: updated.deleted_at,
    };

    return NextResponse.json({ ok: true, user });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to update user" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const url = new URL(req.url);
    const id = url.searchParams.get("id");

    if (!id) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 });
    }

    const auth = await resolveRequestActor(req);
    if (!auth.actor) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
    if (
      auth.actor.role !== "admin" &&
      auth.actor.role !== "developer"
    ) {
      return NextResponse.json(
        { error: "Forbidden: Only Admins or Developers can deactivate team members." },
        { status: 403 }
      );
    }

    // Soft delete matching AdFlow (sets active = false, deleted_at = now())
    const nowIso = new Date().toISOString();
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        active: false,
        deleted_at: nowIso,
        updated_at: nowIso,
      })
      .eq("id", id);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await syncProfilePatchToAdFlow(id, {
      active: false,
      deleted_at: nowIso,
      updated_at: nowIso,
    });

    return NextResponse.json({ ok: true, message: "User soft-deleted successfully" });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Failed to delete user" }, { status: 500 });
  }
}
