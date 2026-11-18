import { NextResponse } from "next/server";
import { createPasswordAuthClient, supabaseAdmin } from "@/lib/supabase";
import { Role, User } from "@/lib/types";
import { getEmployeeCode, getUserColor } from "@/lib/utils";
import {
  SESSION_COOKIE_NAME,
  extractSessionCookie,
  revokeSessionToken,
  signSessionToken,
  verifyPasswordHash,
  resolveRequestActor,
} from "@/lib/auth-server";

const LOGIN_RATE_LIMIT_MAX = 8;
const LOGIN_RATE_LIMIT_WINDOW_MS = 60_000;
const loginAttempts = new Map<string, number[]>();

function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim() || "unknown";
  return req.headers.get("x-real-ip")?.trim() || "local";
}

function isLoginRateLimited(key: string): boolean {
  const now = Date.now();
  const timestamps = (loginAttempts.get(key) || []).filter(
    (t) => now - t < LOGIN_RATE_LIMIT_WINDOW_MS
  );
  if (timestamps.length >= LOGIN_RATE_LIMIT_MAX) {
    loginAttempts.set(key, timestamps);
    return true;
  }
  loginAttempts.set(key, timestamps);
  return false;
}

function recordFailedLoginAttempt(key: string): void {
  const now = Date.now();
  const timestamps = (loginAttempts.get(key) || []).filter(
    (t) => now - t < LOGIN_RATE_LIMIT_WINDOW_MS
  );
  timestamps.push(now);
  loginAttempts.set(key, timestamps);
}

function clearLoginAttempts(key: string): void {
  loginAttempts.delete(key);
}

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

  if (avatarUrl) {
    try {
      if (avatarUrl.startsWith("{") && avatarUrl.endsWith("}")) {
        const parsed = JSON.parse(avatarUrl);
        color = parsed.color;
        employeeCode = parsed.employeeCode;
        dailyCapacityUnits = parsed.dailyCapacityUnits;
        passwordHash = parsed.passwordHash;
      } else if (avatarUrl.startsWith("#")) {
        color = avatarUrl;
      }
    } catch {}
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
  };
}

function formatProfileToUser(profile: any): User {
  const { employeeCode, color, dailyCapacityUnits } = parseUserMetadata(
    profile.avatar_url,
    profile.name || profile.email,
    profile.role
  );

  return {
    id: profile.id,
    name: profile.name || profile.email.split("@")[0],
    email: profile.email,
    role: (profile.role as Role) || "member",
    avatar: employeeCode.slice(0, 2),
    department: getDepartment(profile.role),
    active: profile.active !== false && !profile.deleted_at,
    dailyCapacityUnits,
    employeeCode,
    color,
    deletedAt: profile.deleted_at || null,
  };
}

function secureCookie(req: Request) {
  return new URL(req.url).protocol === "https:" || req.headers.get("x-forwarded-proto") === "https";
}

function attachSessionCookie(req: Request, res: NextResponse, user: User) {
  const token = signSessionToken({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });

  res.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    secure: secureCookie(req),
  });

}

export async function GET(req: Request) {
  try {
    const resolved = await resolveRequestActor(req);
    if (!resolved.actor) {
      return NextResponse.json({ ok: false, authenticated: false }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("id", resolved.actor.id)
      .maybeSingle();

    if (!profile || profile.active === false || profile.deleted_at) {
      return NextResponse.json({ ok: false, authenticated: false }, { status: 401 });
    }

    const user = formatProfileToUser(profile);
    return NextResponse.json({ ok: true, authenticated: true, user }, { headers: { "Cache-Control": "no-store" } });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err?.message || "Session check failed" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const cleanEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const cleanPassword = typeof body.password === "string" ? body.password.trim() : "";

    if (!cleanEmail || !cleanPassword) {
      return NextResponse.json(
        { ok: false, error: "Email address and password are required." },
        { status: 400 }
      );
    }

    const clientIp = getClientIp(req);
    const emailRateKey = `${clientIp}:${cleanEmail}`;
    const ipRateKey = `ip:${clientIp}`;
    if (isLoginRateLimited(emailRateKey) || isLoginRateLimited(ipRateKey)) {
      return NextResponse.json(
        { ok: false, error: "Too many login attempts. Please wait 60 seconds and try again." },
        { status: 429, headers: { "Retry-After": "60" } }
      );
    }

    // 1. Primary Authentication: Authenticate against Supabase Auth (Shared Org Identity)
    let authenticatedUserId: string | null = null;

    try {
      const { data: authData, error: authErr } =
        await createPasswordAuthClient().auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword,
        });

      if (!authErr && authData?.user?.id) {
        authenticatedUserId = authData.user.id;
      }
    } catch {}

    // 2. Fetch the corresponding profile from public.profiles
    const { data: resolvedProfile } = await supabaseAdmin
      .from("profiles")
      .select("*")
      .eq("email", cleanEmail)
      .maybeSingle();

    if (!resolvedProfile) {
      recordFailedLoginAttempt(emailRateKey);
      recordFailedLoginAttempt(ipRateKey);
      return NextResponse.json({ ok: false, error: "Invalid email or password." }, { status: 401 });
    }

    // 3. Fallback: If Supabase Auth didn't match, check local password override in Task Manager metadata
    if (!authenticatedUserId) {
      const meta = parseUserMetadata(
        resolvedProfile.avatar_url,
        resolvedProfile.name || resolvedProfile.email,
        resolvedProfile.role
      );

      if (meta.passwordHash && verifyPasswordHash(cleanPassword, meta.passwordHash)) {
        authenticatedUserId = resolvedProfile.id;
      } else {
        recordFailedLoginAttempt(emailRateKey);
        recordFailedLoginAttempt(ipRateKey);
        return NextResponse.json({ ok: false, error: "Invalid email or password." }, { status: 401 });
      }
    }

    if (resolvedProfile.active === false || resolvedProfile.deleted_at) {
      recordFailedLoginAttempt(emailRateKey);
      recordFailedLoginAttempt(ipRateKey);
      return NextResponse.json({ ok: false, error: "Invalid email or password." }, { status: 401 });
    }

    clearLoginAttempts(emailRateKey);
    const user = formatProfileToUser(resolvedProfile);
    const res = NextResponse.json({ ok: true, user }, { headers: { "Cache-Control": "no-store" } });
    attachSessionCookie(req, res, user);
    return res;
  } catch (err: any) {
    console.error("Auth login route error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Authentication failed." },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  const token = extractSessionCookie(req);
  if (token) {
    revokeSessionToken(token);
  }
  const res = NextResponse.json({ ok: true });
  res.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    secure: secureCookie(req),
  });
  return res;
}
