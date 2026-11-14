import crypto from "node:crypto";
import { Role } from "./types";
import { supabaseAdmin } from "./supabase";

export const SESSION_COOKIE_NAME = "satmi_session";

const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "satmi-task-manager-hmac-session-secret-v1";

export interface SessionPayload {
  id: string;
  email: string;
  name: string;
  role: Role;
  iat: number;
  exp: number;
}

export function signSessionToken(user: {
  id: string;
  email: string;
  name: string;
  role: Role;
}): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: SessionPayload = {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    iat: now,
    exp: now + 60 * 60 * 24 * 7, // 7 days
  };

  const encoded = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
  const signature = crypto
    .createHmac("sha256", SESSION_SECRET)
    .update(encoded)
    .digest("base64url");

  return `${encoded}.${signature}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [encoded, sig] = parts;

    const expectedSig = crypto
      .createHmac("sha256", SESSION_SECRET)
      .update(encoded)
      .digest("base64url");

    const sigBuf = Buffer.from(sig);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length) return null;
    if (!crypto.timingSafeEqual(sigBuf, expectedBuf)) return null;

    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf-8")
    ) as SessionPayload;

    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `scrypt:${salt}:${derived}`;
}

export function verifyPasswordHash(password: string, storedHash?: string | null): boolean {
  if (!storedHash || !storedHash.startsWith("scrypt:")) return false;
  try {
    const [, salt, keyHex] = storedHash.split(":");
    if (!salt || !keyHex) return false;
    const derived = crypto.scryptSync(password, salt, 64);
    const keyBuf = Buffer.from(keyHex, "hex");
    if (derived.length !== keyBuf.length) return false;
    return crypto.timingSafeEqual(derived, keyBuf);
  } catch {
    return false;
  }
}

export function extractSessionCookie(req: Request): string | null {
  const cookieHeader = req.headers.get("cookie") || "";
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
  if (match) {
    return decodeURIComponent(match.slice(SESSION_COOKIE_NAME.length + 1));
  }

  const authHeader = req.headers.get("authorization") || "";
  if (authHeader.toLowerCase().startsWith("bearer ")) {
    return authHeader.slice(7).trim();
  }

  return null;
}

export async function resolveRequestActor(
  req: Request,
  fallbackActorId?: string | null
): Promise<{
  authenticated: boolean;
  fromSignedSession: boolean;
  actor: { id: string; name: string; email: string; role: Role } | null;
  error?: string;
}> {
  // 1. Check signed session cookie or bearer token
  const token = extractSessionCookie(req);
  if (token) {
    const session = verifySessionToken(token);
    if (session?.id) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id, name, email, role, active, deleted_at")
        .eq("id", session.id)
        .maybeSingle();

      if (profile && profile.active !== false && !profile.deleted_at) {
        return {
          authenticated: true,
          fromSignedSession: true,
          actor: {
            id: profile.id,
            name: profile.name || profile.email.split("@")[0],
            email: profile.email,
            role: (profile.role as Role) || "member",
          },
        };
      }
      return {
        authenticated: false,
        fromSignedSession: false,
        actor: null,
        error: "Session user account is inactive or deactivated.",
      };
    }
  }

  // 2. Check explicit header or fallback actorId against live database profiles
  const candidateId =
    req.headers.get("x-satmi-actor-id") || fallbackActorId || null;

  if (candidateId && candidateId !== "default") {
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id, name, email, role, active, deleted_at")
      .eq("id", candidateId)
      .maybeSingle();

    if (!profile) {
      return {
        authenticated: false,
        fromSignedSession: false,
        actor: null,
        error: "Unrecognized actor ID.",
      };
    }

    if (profile.active === false || profile.deleted_at) {
      return {
        authenticated: false,
        fromSignedSession: false,
        actor: null,
        error: "Actor account has been deactivated.",
      };
    }

    return {
      authenticated: true,
      fromSignedSession: false,
      actor: {
        id: profile.id,
        name: profile.name || profile.email.split("@")[0],
        email: profile.email,
        role: (profile.role as Role) || "member",
      },
    };
  }

  return {
    authenticated: false,
    fromSignedSession: false,
    actor: null,
    error: "Authentication required.",
  };
}
