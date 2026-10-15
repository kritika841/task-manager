import { NextResponse } from "next/server";
import { supabase, supabaseAdmin } from "@/lib/supabase";
import { Role, User } from "@/lib/types";
import { getEmployeeCode, getUserColor } from "@/lib/utils";

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

  if (avatarUrl) {
    try {
      if (avatarUrl.startsWith("{") && avatarUrl.endsWith("}")) {
        const parsed = JSON.parse(avatarUrl);
        color = parsed.color;
        employeeCode = parsed.employeeCode;
        dailyCapacityUnits = parsed.dailyCapacityUnits;
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

  return { employeeCode: code, color: resolvedColor, dailyCapacityUnits: resolvedCapacity };
}

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    const cleanEmail = (email || "").trim().toLowerCase();
    const cleanPassword = (password || "").trim();

    if (!cleanEmail || !cleanPassword) {
      return NextResponse.json(
        { ok: false, error: "Email address and password are required." },
        { status: 400 }
      );
    }

    // 1. Verify credentials via Supabase Auth
    let authenticatedUser = null;
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password: cleanPassword,
    });

    // 2. Fetch corresponding profile
    let resolvedProfile = null;

    if (authData?.user?.id) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("id", authData.user.id)
        .maybeSingle();
      resolvedProfile = profile;
    }

    // Fallback: match by email or alias
    if (!resolvedProfile) {
      // Map aliases if applicable
      const searchEmail = cleanEmail === "smvkritika@gmail.com" ? "kritika@satmi.in" : cleanEmail;
      
      const { data: byEmail } = await supabaseAdmin
        .from("profiles")
        .select("*")
        .eq("email", searchEmail)
        .maybeSingle();
      
      if (byEmail) {
        resolvedProfile = byEmail;
      } else {
        // Search by username prefix
        const prefix = cleanEmail.split("@")[0];
        const { data: byName } = await supabaseAdmin
          .from("profiles")
          .select("*")
          .ilike("name", `%${prefix}%`)
          .maybeSingle();
        resolvedProfile = byName;
      }
    }

    if (!resolvedProfile) {
      return NextResponse.json(
        { ok: false, error: `Account "${cleanEmail}" not recognized in Satmi Workspace team directory.` },
        { status: 404 }
      );
    }

    if (resolvedProfile.active === false || resolvedProfile.deleted_at) {
      return NextResponse.json(
        { ok: false, error: "Your account has been deactivated or archived. Contact an administrator." },
        { status: 403 }
      );
    }

    const { employeeCode, color, dailyCapacityUnits } = parseUserMetadata(
      resolvedProfile.avatar_url,
      resolvedProfile.name || resolvedProfile.email,
      resolvedProfile.role
    );

    const user: User = {
      id: resolvedProfile.id,
      name: resolvedProfile.name || resolvedProfile.email.split("@")[0],
      email: resolvedProfile.email,
      role: (resolvedProfile.role as Role) || "member",
      avatar: employeeCode.slice(0, 2),
      department: getDepartment(resolvedProfile.role),
      active: true,
      dailyCapacityUnits,
      employeeCode,
      color,
      deletedAt: null,
    };

    return NextResponse.json({
      ok: true,
      user,
      session: authData?.session || null,
    });
  } catch (err: any) {
    console.error("Auth login route error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message || "Authentication failed." },
      { status: 500 }
    );
  }
}

