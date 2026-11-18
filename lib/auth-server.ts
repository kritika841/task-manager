import crypto from "node:crypto";
import { Role } from "./types";
import { ADFLOW_SUPABASE_SERVICE_KEY, supabaseAdmin } from "./supabase";
import { loadLocalDb, saveLocalDb } from "./local-supabase-fallback";

export const SESSION_COOKIE_NAME = "satmi_session_v2";

const SESSION_SECRET =
  process.env.SESSION_SECRET ||
  ADFLOW_SUPABASE_SERVICE_KEY ||
  crypto.randomBytes(32).toString("hex");

const revokedTokenHashes = new Set<string>();

function hashSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export interface SessionPayload {
  id: string;
  email: string;
  name: string;
  role: Role;
  jti?: string;
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
    jti: crypto.randomUUID(),
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

export function revokeSessionToken(token: string | null | undefined): void {
  if (!token || typeof token !== "string") return;
  const tokenHash = hashSessionToken(token);
  revokedTokenHashes.add(tokenHash);
  try {
    const db = loadLocalDb();
    const now = Math.floor(Date.now() / 1000);
    const revoked = db.revoked_tokens || {};
    // Prune expired revocations before persisting
    for (const [k, exp] of Object.entries(revoked)) {
      if (!Number.isFinite(exp) || exp <= now) {
        delete revoked[k];
      }
    }
    const decoded = verifyTokenSignatureOnly(token);
    revoked[tokenHash] = decoded?.exp || now + 60 * 60 * 24 * 7;
    db.revoked_tokens = revoked;
    saveLocalDb(db);
  } catch {}
}

function verifyTokenSignatureOnly(token: string): SessionPayload | null {
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

    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf-8")) as SessionPayload;
  } catch {
    return null;
  }
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    const payload = verifyTokenSignatureOnly(token);
    if (!payload) return null;

    const now = Math.floor(Date.now() / 1000);
    if (!payload.id || !Number.isFinite(payload.exp) || payload.exp <= now) {
      return null;
    }

    const tokenHash = hashSessionToken(token);
    if (revokedTokenHashes.has(tokenHash)) {
      return null;
    }

    try {
      const db = loadLocalDb();
      if (db.revoked_tokens && db.revoked_tokens[tokenHash]) {
        revokedTokenHashes.add(tokenHash);
        return null;
      }
    } catch {}

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
    return match.slice(SESSION_COOKIE_NAME.length + 1);
  }
  return null;
}

export async function resolveRequestActor(req: Request): Promise<{
  actor: { id: string; name: string; email: string; role: Role } | null;
}> {
  const token = extractSessionCookie(req);
  const session = token ? verifySessionToken(token) : null;
  if (!session) return { actor: null };

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("id, name, email, role, active, deleted_at")
    .eq("id", session.id)
    .maybeSingle();

  if (!profile || profile.active === false || profile.deleted_at) return { actor: null };

  return {
    actor: {
      id: profile.id,
      name: profile.name || profile.email.split("@")[0],
      email: profile.email,
      role: (profile.role as Role) || "member",
    },
  };
}

export function canManageWorkspace(role: Role): boolean {
  return role === "admin" || role === "developer";
}

export function canReviewTasks(role: Role): boolean {
  return canManageWorkspace(role) || role === "manager";
}
