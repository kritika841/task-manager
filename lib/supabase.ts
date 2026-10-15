import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  "https://qexjnswuvbyjenfrbwvj.supabase.co";
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFleGpuc3d1dmJ5amVuZnJid3ZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM1ODUyOTEsImV4cCI6MjA5OTE2MTI5MX0.XX3-wmCGYy1W2dEEOg62T3XcHoztuprllQKO7N8CmV4";
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFleGpuc3d1dmJ5amVuZnJid3ZqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzU4NTI5MSwiZXhwIjoyMDk5MTYxMjkxfQ._8u5uwq4Vcy8up-O-pjXez_AyKKFnLpBRdIYnnkx4bk";

// Browser client for realtime subscriptions
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Server/Admin client with service role key for API routes (bypasses RLS)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

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

export function taskOptionsForRole(role: string | undefined): readonly string[] {
  if (role === "content_creator") return creatorTaskOptions;
  if (role === "editor") return editorTaskOptions;
  return [...creatorTaskOptions, ...editorTaskOptions];
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
