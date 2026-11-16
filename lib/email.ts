import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY || "";
const RESEND_FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL || "support@satmi.in";

export const resend = new Resend(RESEND_API_KEY || "placeholder_resend_key");

/**
 * Dynamically resolves the Developer email (`to`) and CC email (`cc`)
 * directly from the workspace `profiles` table (synced from adflow.satmi.in)
 * without hardcoding user email addresses.
 */
export function resolveDeveloperAndCcFromUsers(
  profiles: Record<string, any>[]
): { developerEmails: string[]; ccEmails: string[] } {
  const activeProfiles = (profiles || []).filter(
    (p) => p && p.active !== false && !p.deleted_at && typeof p.email === "string" && p.email.trim()
  );

  // 1. Pick up Developer user(s): first check role === 'developer', otherwise match Kritika's user profile from users
  let devProfiles = activeProfiles.filter(
    (p) => String(p.role || "").toLowerCase() === "developer"
  );
  if (devProfiles.length === 0) {
    devProfiles = activeProfiles.filter((p) =>
      String(p.name || "")
        .toLowerCase()
        .includes("kritika")
    );
  }
  if (devProfiles.length === 0) {
    devProfiles = activeProfiles.filter(
      (p) => String(p.role || "").toLowerCase() === "admin"
    );
  }

  const developerEmails = Array.from(
    new Set(devProfiles.map((p) => String(p.email).trim().toLowerCase()))
  );

  // 2. Pick up CC user(s) for mails directed to the developer (Kartavya's user profile from users)
  const ccProfiles = activeProfiles.filter((p) => {
    const emailLower = String(p.email).trim().toLowerCase();
    if (developerEmails.includes(emailLower)) return false;
    const nameLower = String(p.name || "").toLowerCase();
    return nameLower.includes("kartavya");
  });

  const ccEmails = Array.from(
    new Set(ccProfiles.map((p) => String(p.email).trim().toLowerCase()))
  );

  return { developerEmails, ccEmails };
}

/**
 * Checks whether a target user profile is the Developer (either has `developer` role
 * or is the designated developer user in `profiles`).
 */
export function isDeveloperUserProfile(
  profile: Record<string, any> | null | undefined,
  profiles: Record<string, any>[]
): boolean {
  if (!profile) return false;
  if (String(profile.role || "").toLowerCase() === "developer") return true;
  const { developerEmails } = resolveDeveloperAndCcFromUsers(profiles);
  const emailLower = String(profile.email || "").trim().toLowerCase();
  return Boolean(emailLower && developerEmails.includes(emailLower));
}

async function dispatchResendMail(params: {
  to: string[];
  cc?: string[];
  subject: string;
  html: string;
}) {
  const cleanTo = Array.from(new Set(params.to.filter(Boolean)));
  const cleanCc = Array.from(
    new Set((params.cc || []).filter((e) => Boolean(e) && !cleanTo.includes(e)))
  );

  if (cleanTo.length === 0) {
    return { ok: false, error: "No recipient email resolved from users list" };
  }

  try {
    // Primary send from support@satmi.in to target user email(s) with optional CC
    const primary = await resend.emails.send({
      from: RESEND_FROM_EMAIL,
      to: cleanTo,
      ...(cleanCc.length > 0 ? { cc: cleanCc } : {}),
      subject: params.subject,
      html: params.html,
    });

    if (!primary.error) {
      return {
        ok: true,
        from: RESEND_FROM_EMAIL,
        to: cleanTo,
        cc: cleanCc,
        result: primary,
      };
    }

    // If satmi.in domain is still pending verification on Resend's side, fallback cleanly so mail still delivers
    if (
      primary.error.message?.toLowerCase().includes("not verified") ||
      (primary.error as any).statusCode === 403
    ) {
      const fallback = await resend.emails.send({
        from: "onboarding@resend.dev",
        replyTo: RESEND_FROM_EMAIL,
        to: RESEND_FROM_EMAIL,
        subject: `${params.subject} [To: ${cleanTo.join(", ")}${
          cleanCc.length > 0 ? ` | CC: ${cleanCc.join(", ")}` : ""
        }]`,
        html: params.html,
      });

      return {
        ok: !fallback.error,
        from: RESEND_FROM_EMAIL,
        to: cleanTo,
        cc: cleanCc,
        result: fallback,
        fallbackUsed: true,
      };
    }

    return {
      ok: false,
      from: RESEND_FROM_EMAIL,
      to: cleanTo,
      cc: cleanCc,
      error: primary.error,
    };
  } catch (error) {
    console.error("Resend dispatch error:", error);
    return { ok: false, error };
  }
}

export async function sendReminderEmail(params: {
  title: string;
  note?: string;
  remindAt: string;
  targetEmails: string[];
  ccEmails?: string[];
  targetUserName?: string;
  createdByName?: string;
  isDueAlert?: boolean;
}) {
  const formattedDate = new Date(params.remindAt).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const badgeText = params.isDueAlert
    ? "REMINDER DUE NOW"
    : "NEW REMINDER SCHEDULED";
  const subject = params.isDueAlert
    ? `⏰ Reminder Due: ${params.title}`
    : `🔔 Reminder Scheduled: ${params.title}`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e4e4e7; border-radius: 12px; background: #ffffff; color: #18181b;">
      <div style="display: inline-block; padding: 4px 10px; border-radius: 9999px; background: #fef3c7; color: #b45309; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; margin-bottom: 12px;">
        ${badgeText}
      </div>
      <h2 style="margin: 0 0 12px; font-size: 18px; font-weight: 700; color: #09090b;">
        ${params.title}
      </h2>
      ${
        params.note
          ? `<p style="margin: 0 0 16px; padding: 12px; border-radius: 8px; background: #f4f4f5; font-size: 14px; line-height: 1.5; color: #3f3f46;">${params.note}</p>`
          : ""
      }
      <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #52525b;">
        <tr>
          <td style="padding: 6px 0; font-weight: 600;">From:</td>
          <td style="padding: 6px 0;">${RESEND_FROM_EMAIL}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: 600;">To:</td>
          <td style="padding: 6px 0;">${params.targetEmails.join(", ")}</td>
        </tr>
        ${
          params.ccEmails && params.ccEmails.length > 0
            ? `<tr><td style="padding: 6px 0; font-weight: 600;">CC:</td><td style="padding: 6px 0;">${params.ccEmails.join(", ")}</td></tr>`
            : ""
        }
        <tr>
          <td style="padding: 6px 0; font-weight: 600;">Scheduled For:</td>
          <td style="padding: 6px 0;">${formattedDate} (IST)</td>
        </tr>
        ${
          params.targetUserName
            ? `<tr><td style="padding: 6px 0; font-weight: 600;">Assigned To:</td><td style="padding: 6px 0;">${params.targetUserName}</td></tr>`
            : ""
        }
        ${
          params.createdByName
            ? `<tr><td style="padding: 6px 0; font-weight: 600;">Created By:</td><td style="padding: 6px 0;">${params.createdByName}</td></tr>`
            : ""
        }
      </table>
      <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 18px 0 12px;" />
      <p style="margin: 0; font-size: 11px; color: #71717a;">
        Satmi Task Manager • Automated Reminder Notification (From: ${RESEND_FROM_EMAIL})
      </p>
    </div>
  `;

  return dispatchResendMail({
    to: params.targetEmails,
    cc: params.ccEmails,
    subject,
    html,
  });
}

export async function sendFeedbackEmail(params: {
  type: "feature" | "feedback" | "bug";
  title: string;
  details: string;
  priority?: string;
  authorName: string;
  authorRole: string;
  profiles: Record<string, any>[];
}) {
  const { developerEmails, ccEmails } = resolveDeveloperAndCcFromUsers(
    params.profiles
  );

  const typeLabel =
    params.type === "bug"
      ? "Bug Report"
      : params.type === "feedback"
        ? "Developer / UX Feedback"
        : "Feature Request";

  const subject = `[Satmi ${typeLabel}] ${params.title}`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e4e4e7; border-radius: 12px; background: #ffffff; color: #18181b;">
      <div style="display: inline-block; padding: 4px 10px; border-radius: 9999px; background: #dbeafe; color: #1d4ed8; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">
        ${typeLabel} • ${(params.priority || "medium").toUpperCase()} PRIORITY
      </div>
      <h2 style="margin: 0 0 12px; font-size: 18px; font-weight: 700; color: #09090b;">
        ${params.title}
      </h2>
      <div style="margin: 0 0 16px; padding: 14px; border-radius: 8px; background: #f4f4f5; font-size: 14px; line-height: 1.6; color: #27272a; white-space: pre-wrap;">${params.details || params.title}</div>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #52525b;">
        <tr>
          <td style="padding: 6px 0; font-weight: 600;">From:</td>
          <td style="padding: 6px 0;">${RESEND_FROM_EMAIL}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: 600;">To (Developer):</td>
          <td style="padding: 6px 0;">${developerEmails.join(", ")}</td>
        </tr>
        ${
          ccEmails.length > 0
            ? `<tr><td style="padding: 6px 0; font-weight: 600;">CC:</td><td style="padding: 6px 0;">${ccEmails.join(", ")}</td></tr>`
            : ""
        }
        <tr>
          <td style="padding: 6px 0; font-weight: 600;">Submitted By:</td>
          <td style="padding: 6px 0;">${params.authorName} (${params.authorRole})</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: 600;">Category:</td>
          <td style="padding: 6px 0;">${typeLabel}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: 600;">Priority:</td>
          <td style="padding: 6px 0; text-transform: capitalize;">${params.priority || "medium"}</td>
        </tr>
      </table>
      <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 18px 0 12px;" />
      <p style="margin: 0; font-size: 11px; color: #71717a;">
        Satmi Task Manager • Developer Feedback & Feature Request (From: ${RESEND_FROM_EMAIL})
      </p>
    </div>
  `;

  return dispatchResendMail({
    to: developerEmails,
    cc: ccEmails,
    subject,
    html,
  });
}
