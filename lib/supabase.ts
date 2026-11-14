import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://qexjnswuvbyjenfrbwvj.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFleGpuc3d1dmJ5amVuZnJid3ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1ODUyOTEsImV4cCI6MjA5OTE2MTI5MX0.XX3-wmCGYy1W2dEEOg62T3XcHoztuprllQKO7N8CmV4";

// Browser client for realtime subscriptions
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server/Admin client with service role key for API routes (never instantiated in browser)
function createServerAdminClient(): SupabaseClient {
  if (typeof window !== "undefined") {
    return supabase;
  }
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    supabaseAnonKey;

  // Use resilient fetch wrapper on the server so if Supabase DNS/network is offline,
  // API routes seamlessly fall back to the persistent local database store.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { resilientSupabaseFetch } = require("./local-supabase-fallback");

  return createClient(supabaseUrl, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
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
