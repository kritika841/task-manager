import { createClient, SupabaseClient } from "@supabase/supabase-js";

const DEFAULT_ADFLOW_URL = "https://ads.satmi.in";
const DEFAULT_ADFLOW_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFkZmxvdy12cHMiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTc4MzU4NTI5MSwiZXhwIjoyMDk5MTYxMjkxfQ.PNmYQFpq0Yu7QwCq08JAivVQ9WCS3rWzT09CwPs8xZg";
const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const isLegacyDeadUrl = envUrl.includes("qexjnswuvbyjenfrbwvj");

export const ADFLOW_SUPABASE_URL =
  !envUrl || isLegacyDeadUrl ? DEFAULT_ADFLOW_URL : envUrl;
export const ADFLOW_SUPABASE_ANON_KEY =
  !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || isLegacyDeadUrl
    ? DEFAULT_ADFLOW_ANON_KEY
    : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
export const ADFLOW_SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const supabaseUrl = ADFLOW_SUPABASE_URL;
const supabaseAnonKey = ADFLOW_SUPABASE_ANON_KEY;

// Browser client for realtime subscriptions
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server/Admin client with service role key for API routes (never instantiated in browser)
function createServerAdminClient(): SupabaseClient {
  if (typeof window !== "undefined") {
    return supabase;
  }
  return createServerClient(ADFLOW_SUPABASE_SERVICE_KEY || supabaseAnonKey);
}

// Sign-in must have its own auth state. Server database requests share a separate client.
export function createPasswordAuthClient(): SupabaseClient {
  return createServerClient(supabaseAnonKey);
}

function createServerClient(key: string): SupabaseClient {

  // Use resilient fetch wrapper on the server so if Supabase DNS/network is offline,
  // API routes seamlessly fall back to the persistent local database store.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { resilientSupabaseFetch } = require("./local-supabase-fallback");

  return createClient(supabaseUrl, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
    global: {
      fetch: resilientSupabaseFetch,
    },
  });
}

export const supabaseAdmin: SupabaseClient = createServerAdminClient();

export const targetTimeZone = "Asia/Kolkata";

export function dateInTargetTimeZone(date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: targetTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export const creatorTaskOptions = [
  "Creative creation",
  "Script writing",
  "Video shoots",
  "Raw clip generation",
] as const;

export const editorTaskOptions = [
  "Ad video edits",
  "Social media edits",
] as const;

export const developerTaskOptions = [
  "Frontend UI & Components",
  "Backend API & Database",
  "Bug Fix & QA Testing",
  "Code Review & Deployment",
  "Architecture & Tech Spec",
] as const;

export const mediaBuyerTaskOptions = [
  "Campaign Launch & Setup",
  "Creative A/B Split Testing",
  "ROAS & CPA Optimization",
  "Audience & Competitor Research",
  "Scaling Winning Ad Sets",
] as const;

export const managerTaskOptions = [
  "Daily Team Target Allocation",
  "Creative & Deliverable Review",
  "Pipeline Blocker Resolution",
  "Weekly Sprint & SLA Audit",
] as const;

export const adminTaskOptions = [
  "Workspace & Team Operations",
  "Executive Strategy & OKRs",
  "Feature & Feedback Triage",
  "Campaign & Budget Sign-off",
] as const;

export function taskOptionsForRole(role: string | undefined): readonly string[] {
  if (role === "content_creator") return creatorTaskOptions;
  if (role === "editor") return editorTaskOptions;
  if (role === "developer") return developerTaskOptions;
  if (role === "media_buyer") return mediaBuyerTaskOptions;
  if (role === "manager") return managerTaskOptions;
  if (role === "admin") return adminTaskOptions;
  return [
    ...creatorTaskOptions,
    ...editorTaskOptions,
    ...developerTaskOptions,
    ...mediaBuyerTaskOptions,
  ];
}

export const CANONICAL_ADFLOW_TASKS = [
  "Creative creation",
  "Ad video edits",
  "Social media edits",
  "Script writing",
  "Video shoots",
  "Raw clip generation",
] as const;

export type CanonicalAdflowTask = (typeof CANONICAL_ADFLOW_TASKS)[number];

export function isCanonicalAdflowTask(taskName: string | undefined | null): boolean {
  if (!taskName) return false;
  const trimmed = taskName.trim().toLowerCase();
  if (
    trimmed.includes("creative") ||
    trimmed.includes("script") ||
    trimmed.includes("shoot") ||
    trimmed.includes("raw clip") ||
    trimmed.includes("ad video") ||
    trimmed.includes("video edit")
  ) {
    return true;
  }
  return CANONICAL_ADFLOW_TASKS.some((canonical) => {
    const cLower = canonical.toLowerCase();
    return (
      trimmed === cLower ||
      trimmed.startsWith(cLower + " (carried forward)") ||
      trimmed.startsWith(cLower + " — additional") ||
      trimmed.startsWith(cLower + " - additional") ||
      trimmed.startsWith(cLower + " (")
    );
  });
}
