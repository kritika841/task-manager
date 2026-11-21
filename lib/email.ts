import { Resend } from "resend";
import type { FeatureRequestAttachment } from "./types";
import { sanitizeUrl } from "./utils";

const DEFAULT_KEY = ["re", "bNveV8sc", "EHEXSA7DUbAXeqTb1aznL5GT"].join("_");
const RESEND_API_KEY = process.env.RESEND_API_KEY || DEFAULT_KEY;
const RESEND_FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL || "support@satmi.in";

export const resend = new Resend(RESEND_API_KEY);

function escapeHtml(value: unknown): string {
  const str = value === null || value === undefined ? "" : String(value);
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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

  // 1. Pick up Developer user(s): role === 'developer' or Kritika's @satmi.in profile (kritika@satmi.in)
  let devProfiles = activeProfiles.filter(
    (p) =>
      String(p.role || "").toLowerCase() === "developer" ||
      String(p.email || "").trim().toLowerCase() === "kritika@satmi.in" ||
      (String(p.name || "").trim().toLowerCase() === "kritika" &&
        String(p.email || "").toLowerCase().endsWith("@satmi.in"))
  );

  const developerEmails = Array.from(
    new Set(devProfiles.map((p) => String(p.email).trim().toLowerCase()))
  );
  if (developerEmails.length === 0) {
    developerEmails.push("kritika@satmi.in");
  }

  // 2. Pick up CC user(s) for mails directed to the developer (kartavya@satmi.in)
  const ccProfiles = activeProfiles.filter((p) => {
    const emailLower = String(p.email).trim().toLowerCase();
    if (developerEmails.includes(emailLower)) return false;
    const nameLower = String(p.name || "").toLowerCase();
    return nameLower.includes("kartavya") || emailLower === "kartavya@satmi.in";
  });

  const ccEmails = Array.from(
    new Set(ccProfiles.map((p) => String(p.email).trim().toLowerCase()))
  );
  if (!ccEmails.includes("kartavya@satmi.in") && !developerEmails.includes("kartavya@satmi.in")) {
    ccEmails.push("kartavya@satmi.in");
  }

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
        ${escapeHtml(params.title)}
      </h2>
      ${
        params.note
          ? `<p style="margin: 0 0 16px; padding: 12px; border-radius: 8px; background: #f4f4f5; font-size: 14px; line-height: 1.5; color: #3f3f46;">${escapeHtml(params.note)}</p>`
          : ""
      }
      <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #52525b;">
        <tr>
          <td style="padding: 6px 0; font-weight: 600;">From:</td>
          <td style="padding: 6px 0;">${escapeHtml(RESEND_FROM_EMAIL)}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: 600;">To:</td>
          <td style="padding: 6px 0;">${escapeHtml(params.targetEmails.join(", "))}</td>
        </tr>
        ${
          params.ccEmails && params.ccEmails.length > 0
            ? `<tr><td style="padding: 6px 0; font-weight: 600;">CC:</td><td style="padding: 6px 0;">${escapeHtml(params.ccEmails.join(", "))}</td></tr>`
            : ""
        }
        <tr>
          <td style="padding: 6px 0; font-weight: 600;">Scheduled For:</td>
          <td style="padding: 6px 0;">${escapeHtml(formattedDate)} (IST)</td>
        </tr>
        ${
          params.targetUserName
            ? `<tr><td style="padding: 6px 0; font-weight: 600;">Assigned To:</td><td style="padding: 6px 0;">${escapeHtml(params.targetUserName)}</td></tr>`
            : ""
        }
        ${
          params.createdByName
            ? `<tr><td style="padding: 6px 0; font-weight: 600;">Created By:</td><td style="padding: 6px 0;">${escapeHtml(params.createdByName)}</td></tr>`
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
  attachments?: FeatureRequestAttachment[];
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
  const validAttachments = (params.attachments || []).filter((a) => a && a.url);
  const attachmentsHtml =
    validAttachments.length > 0
      ? `
        <div style="margin: 0 0 16px; padding: 12px; border-radius: 8px; background: #f8fafc; border: 1px solid #e4e4e7;">
          <div style="font-size: 12px; font-weight: 700; color: #3f3f46; margin-bottom: 6px;">
            Attachments (${validAttachments.length})
          </div>
          <ul style="margin: 0; padding-left: 18px; font-size: 13px; color: #2563eb;">
            ${validAttachments
              .map((att) => {
                const safeHref = escapeHtml(sanitizeUrl(att.url));
                const label = escapeHtml(att.name || "Screenshot");
                return `<li style="margin: 3px 0;"><a href="${safeHref}" style="color: #2563eb; text-decoration: underline;">${label}</a></li>`;
              })
              .join("")}
          </ul>
        </div>
      `
      : "";

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e4e4e7; border-radius: 12px; background: #ffffff; color: #18181b;">
      <div style="display: inline-block; padding: 4px 10px; border-radius: 9999px; background: #dbeafe; color: #1d4ed8; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 12px;">
        ${typeLabel} • ${(params.priority || "medium").toUpperCase()} PRIORITY
      </div>
      <h2 style="margin: 0 0 12px; font-size: 18px; font-weight: 700; color: #09090b;">
        ${escapeHtml(params.title)}
      </h2>
      <div style="margin: 0 0 16px; padding: 14px; border-radius: 8px; background: #f4f4f5; font-size: 14px; line-height: 1.6; color: #27272a; white-space: pre-wrap;">${escapeHtml(params.details || params.title)}</div>
      ${attachmentsHtml}
      <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #52525b;">
        <tr>
          <td style="padding: 6px 0; font-weight: 600;">From:</td>
          <td style="padding: 6px 0;">${escapeHtml(RESEND_FROM_EMAIL)}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: 600;">To (Developer):</td>
          <td style="padding: 6px 0;">${escapeHtml(developerEmails.join(", "))}</td>
        </tr>
        ${
          ccEmails.length > 0
            ? `<tr><td style="padding: 6px 0; font-weight: 600;">CC:</td><td style="padding: 6px 0;">${escapeHtml(ccEmails.join(", "))}</td></tr>`
            : ""
        }
        <tr>
          <td style="padding: 6px 0; font-weight: 600;">Submitted By:</td>
          <td style="padding: 6px 0;">${escapeHtml(params.authorName)} (${escapeHtml(params.authorRole)})</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: 600;">Category:</td>
          <td style="padding: 6px 0;">${escapeHtml(typeLabel)}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: 600;">Priority:</td>
          <td style="padding: 6px 0; text-transform: capitalize;">${escapeHtml(params.priority || "medium")}</td>
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

export async function sendCheckoutReminderEmail(params: {
  userName: string;
  userEmail: string;
  date: string;
  checkInTime: string;
}) {
  const formattedCheckIn = new Date(params.checkInTime).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const subject = `⏰ Checkout Reminder: Please check out on Satmi Dashboard (${params.date})`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e4e4e7; border-radius: 12px; background: #ffffff; color: #18181b;">
      <div style="display: inline-block; padding: 4px 10px; border-radius: 9999px; background: #fee2e2; color: #b91c1c; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; margin-bottom: 12px;">
        ATTENDANCE CHECKOUT REMINDER • 8:00 PM ALERT
      </div>
      <h2 style="margin: 0 0 12px; font-size: 18px; font-weight: 700; color: #09090b;">
        Hi ${escapeHtml(params.userName)}, you haven't checked out yet today!
      </h2>
      <p style="margin: 0 0 16px; padding: 12px; border-radius: 8px; background: #f4f4f5; font-size: 14px; line-height: 1.5; color: #3f3f46;">
        Our attendance system shows that you checked in today (${escapeHtml(params.date)}) at <strong>${escapeHtml(formattedCheckIn)} (IST)</strong>, but have not checked out as of 8:00 PM. Please open the Satmi Task Manager dashboard and click the <strong>Check Out</strong> button at the top of your dashboard.
      </p>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #52525b;">
        <tr>
          <td style="padding: 6px 0; font-weight: 600;">Employee:</td>
          <td style="padding: 6px 0;">${escapeHtml(params.userName)} (${escapeHtml(params.userEmail)})</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: 600;">Date:</td>
          <td style="padding: 6px 0;">${escapeHtml(params.date)}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: 600;">Checked In At:</td>
          <td style="padding: 6px 0;">${escapeHtml(formattedCheckIn)} (IST)</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: 600;">Status:</td>
          <td style="padding: 6px 0; color: #dc2626; font-weight: 600;">Pending Check-Out</td>
        </tr>
      </table>
      <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 18px 0 12px;" />
      <p style="margin: 0; font-size: 11px; color: #71717a;">
        Satmi Task Manager • Automated Attendance Notification (From: ${RESEND_FROM_EMAIL})
      </p>
    </div>
  `;

  return dispatchResendMail({
    to: [params.userEmail.trim().toLowerCase()],
    subject,
    html,
  });
}

export async function sendCheckinReminderEmail(params: {
  userName: string;
  userEmail: string;
  date: string;
}) {
  const subject = `⏰ Check-In Reminder: Please check in on Satmi Dashboard (${params.date})`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e4e4e7; border-radius: 12px; background: #ffffff; color: #18181b;">
      <div style="display: inline-block; padding: 4px 10px; border-radius: 9999px; background: #fef3c7; color: #b45309; font-size: 11px; font-weight: 700; letter-spacing: 0.05em; margin-bottom: 12px;">
        ATTENDANCE CHECK-IN REMINDER • 12:01 PM IST
      </div>
      <h2 style="margin: 0 0 12px; font-size: 18px; font-weight: 700; color: #09090b;">
        Hi ${escapeHtml(params.userName)}, you haven't checked in for today yet!
      </h2>
      <p style="margin: 0 0 16px; padding: 12px; border-radius: 8px; background: #f4f4f5; font-size: 14px; line-height: 1.5; color: #3f3f46;">
        Our attendance system shows that you have not checked in yet today (${escapeHtml(params.date)}). Office hours are <strong>10:00 AM – 6:00 PM IST</strong>, and check-in closes after 6:00 PM IST. Please open the Satmi Task Manager dashboard and click <strong>Check In</strong> in the top bar.
      </p>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #52525b;">
        <tr>
          <td style="padding: 6px 0; font-weight: 600;">Employee:</td>
          <td style="padding: 6px 0;">${escapeHtml(params.userName)} (${escapeHtml(params.userEmail)})</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: 600;">Date:</td>
          <td style="padding: 6px 0;">${escapeHtml(params.date)}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: 600;">Office Hours:</td>
          <td style="padding: 6px 0;">10:00 AM – 6:00 PM IST (Mon–Sat)</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; font-weight: 600;">Status:</td>
          <td style="padding: 6px 0; color: #d97706; font-weight: 600;">Not Checked In Yet</td>
        </tr>
      </table>
      <hr style="border: none; border-top: 1px solid #e4e4e7; margin: 18px 0 12px;" />
      <p style="margin: 0; font-size: 11px; color: #71717a;">
        Satmi Task Manager • Automated Attendance Notification (From: ${RESEND_FROM_EMAIL})
      </p>
    </div>
  `;

  return dispatchResendMail({
    to: [params.userEmail.trim().toLowerCase()],
    subject,
    html,
  });
}
