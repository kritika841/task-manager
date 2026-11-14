import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { RoleTemplate, Role, TaskStatus } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const TEMPLATES_FILE = path.join(DATA_DIR, "task-templates.json");

export const DEFAULT_ROLE_TEMPLATES: RoleTemplate[] = [
  {
    id: "tpl-developer",
    name: "Full-Stack Developer Pipeline",
    role: "developer",
    description: "End-to-end engineering workflow from PRD spec to production release",
    isDefault: true,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-22T00:00:00.000Z",
    parentColumns: [
      {
        id: "backlog",
        label: "Backlog",
        subColumns: [
          {
            id: "dev-backlog-ideas",
            label: "Product Ideas & RFCs",
            description: "Feature requests, technical RFCs, and user feedback",
            defaultTargetQuantity: 1,
            slaHours: 48,
            defaultChecklist: ["Review user request & problem statement", "Draft brief RFC document"],
            color: "#64748b",
          },
          {
            id: "dev-tech-debt",
            label: "Tech Debt & Refactor",
            description: "Codebase hygiene, dependency updates, and architectural fixes",
            defaultTargetQuantity: 1,
            slaHours: 72,
            defaultChecklist: ["Identify bottlenecks", "Write cleanup plan"],
            color: "#94a3b8",
          },
        ],
      },
      {
        id: "todo",
        label: "To Do",
        subColumns: [
          {
            id: "dev-spec-review",
            label: "PRD & Architecture",
            description: "Review specs, design API contracts and DB schemas",
            defaultTargetQuantity: 1,
            slaHours: 24,
            defaultChecklist: ["Validate API contracts", "Finalize database schema", "Align edge-cases"],
            color: "#3b82f6",
          },
          {
            id: "dev-sprint-backlog",
            label: "Sprint Backlog",
            description: "Prioritized sprint tasks ready for immediate coding",
            defaultTargetQuantity: 2,
            slaHours: 24,
            defaultChecklist: ["Pull latest main branch", "Setup local feature branch"],
            color: "#6366f1",
          },
        ],
      },
      {
        id: "in_progress",
        label: "In Progress",
        subColumns: [
          {
            id: "dev-frontend-ui",
            label: "Frontend & UI",
            description: "Interactive components, responsiveness, accessibility & state",
            defaultTargetQuantity: 2,
            slaHours: 18,
            defaultChecklist: ["Build responsive layout", "Add micro-animations", "Test mobile/desktop viewports"],
            color: "#06b6d4",
          },
          {
            id: "dev-backend-api",
            label: "Backend & Logic",
            description: "Database queries, API routes, security and server mutations",
            defaultTargetQuantity: 2,
            slaHours: 18,
            defaultChecklist: ["Write clean API endpoints", "Add input validations", "Ensure DB transactions safety"],
            color: "#8b5cf6",
          },
          {
            id: "dev-testing-qa",
            label: "Unit & Integration Tests",
            description: "Local test suites, coverage, and performance benchmarks",
            defaultTargetQuantity: 1,
            slaHours: 12,
            defaultChecklist: ["Write test cases", "Verify edge cases and errors"],
            color: "#ec4899",
          },
        ],
      },
      {
        id: "in_review",
        label: "In Review",
        subColumns: [
          {
            id: "dev-pr-review",
            label: "Code Review (PR)",
            description: "Peer code review, linting, and CI checks",
            defaultTargetQuantity: 1,
            slaHours: 8,
            defaultChecklist: ["Create clean Pull Request", "Request review from lead", "Address comments"],
            color: "#f59e0b",
          },
          {
            id: "dev-staging-qa",
            label: "Staging QA & UAT",
            description: "Verify on staging environment and perform user acceptance tests",
            defaultTargetQuantity: 1,
            slaHours: 6,
            defaultChecklist: ["Deploy to staging environment", "Perform end-to-end smoke test"],
            color: "#d97706",
          },
        ],
      },
      {
        id: "completed",
        label: "Done",
        subColumns: [
          {
            id: "dev-production-deployed",
            label: "Production Deployed",
            description: "Merged to main, deployed to production server",
            defaultTargetQuantity: 1,
            slaHours: 2,
            defaultChecklist: ["Production deploy executed", "Verify live endpoint health"],
            color: "#10b981",
          },
          {
            id: "dev-monitored-closed",
            label: "Monitored & Closed",
            description: "Logs monitored, analytics tracked, deliverable accepted",
            defaultTargetQuantity: 1,
            slaHours: 1,
            defaultChecklist: ["Check telemetry/Sentry logs", "Update documentation & changelog"],
            color: "#059669",
          },
        ],
      },
    ],
  },
  {
    id: "tpl-content-creator",
    name: "Content Creator Production",
    role: "content_creator",
    description: "Creative ideation, script writing, video shoots, and raw footage delivery",
    isDefault: true,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-22T00:00:00.000Z",
    parentColumns: [
      {
        id: "backlog",
        label: "Backlog",
        subColumns: [
          {
            id: "cc-angle-research",
            label: "Angle & Hook Research",
            description: "Discover trending formats, viral angles, competitor creative review",
            defaultTargetQuantity: 2,
            slaHours: 48,
            defaultChecklist: ["Compile 5 hook variations", "Identify product selling propositions"],
            color: "#64748b",
          },
        ],
      },
      {
        id: "todo",
        label: "To Do",
        subColumns: [
          {
            id: "cc-scriptwriting",
            label: "Script Writing",
            description: "Drafting punchy video scripts with hooks and calls to action",
            defaultTargetQuantity: 3,
            slaHours: 24,
            defaultChecklist: ["Write 3-second visual hook", "Body copy with problem/solution", "Strong CTA"],
            color: "#3b82f6",
          },
          {
            id: "cc-prep-props",
            label: "Props & Scene Setup",
            description: "Prepare lighting, audio mics, camera gear, and product props",
            defaultTargetQuantity: 1,
            slaHours: 8,
            defaultChecklist: ["Charge camera batteries", "Clean product packaging", "Setup studio backdrop"],
            color: "#06b6d4",
          },
        ],
      },
      {
        id: "in_progress",
        label: "In Progress",
        subColumns: [
          {
            id: "cc-video-shoots",
            label: "Video Shoots (A-Roll)",
            description: "Recording on-camera talking head and principal takes",
            defaultTargetQuantity: 2,
            slaHours: 12,
            defaultChecklist: ["Record 3 take variations per line", "Verify crisp audio capture"],
            color: "#8b5cf6",
          },
          {
            id: "cc-broll-capture",
            label: "B-Roll & Action Clips",
            description: "Close-up product shots, texture zooms, unboxing moments",
            defaultTargetQuantity: 4,
            slaHours: 8,
            defaultChecklist: ["Film 4K close-up textures", "Capture dynamic movement shots"],
            color: "#ec4899",
          },
        ],
      },
      {
        id: "in_review",
        label: "In Review",
        subColumns: [
          {
            id: "cc-internal-review",
            label: "Creative Lead Review",
            description: "Team review of recorded footage, hooks, and audio sync",
            defaultTargetQuantity: 1,
            slaHours: 6,
            defaultChecklist: ["Review takes for clarity & pacing", "Approve for video editor handoff"],
            color: "#f59e0b",
          },
        ],
      },
      {
        id: "completed",
        label: "Done",
        subColumns: [
          {
            id: "cc-footage-delivered",
            label: "Raw Clips Handed Off",
            description: "Upload raw footage to Google Drive and link in task",
            defaultTargetQuantity: 1,
            slaHours: 2,
            defaultChecklist: ["Upload high-res footage to Drive", "Paste drive link into task"],
            color: "#10b981",
          },
        ],
      },
    ],
  },
  {
    id: "tpl-video-editor",
    name: "Video Editor Pipeline",
    role: "editor",
    description: "Post-production pipeline from raw footage ingest to final polished export",
    isDefault: true,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-22T00:00:00.000Z",
    parentColumns: [
      {
        id: "backlog",
        label: "Backlog",
        subColumns: [
          {
            id: "ed-ingest-queue",
            label: "Ingest Queue",
            description: "Incoming raw footage waiting for project setup",
            defaultTargetQuantity: 2,
            slaHours: 24,
            defaultChecklist: ["Download drive footage", "Import to Premiere/After Effects"],
            color: "#64748b",
          },
        ],
      },
      {
        id: "todo",
        label: "To Do",
        subColumns: [
          {
            id: "ed-rough-cut",
            label: "Rough Assembly",
            description: "Selecting best takes, syncing audio, and building rough storyline",
            defaultTargetQuantity: 2,
            slaHours: 12,
            defaultChecklist: ["Sync audio tracks", "Assemble narrative A-roll timeline"],
            color: "#3b82f6",
          },
        ],
      },
      {
        id: "in_progress",
        label: "In Progress",
        subColumns: [
          {
            id: "ed-primary-cut",
            label: "Fast Pacing & Cuts",
            description: "Trimming dead air, matching rhythm to viral pacing standards",
            defaultTargetQuantity: 2,
            slaHours: 8,
            defaultChecklist: ["Tighten jump cuts", "Insert B-roll overlays"],
            color: "#8b5cf6",
          },
          {
            id: "ed-sound-vfx",
            label: "Sound FX & Audio Mixing",
            description: "Voice EQ, background music ducking, whoosh & pop sound effects",
            defaultTargetQuantity: 2,
            slaHours: 6,
            defaultChecklist: ["Normalize loudness (-14 LUFS)", "Add sound effects to transitions"],
            color: "#06b6d4",
          },
          {
            id: "ed-motion-captions",
            label: "Motion Graphics & Captions",
            description: "Kinetic animated captions, stickers, callouts, and brand color grade",
            defaultTargetQuantity: 2,
            slaHours: 8,
            defaultChecklist: ["Animate keyword captions", "Apply cinematic LUT color grading"],
            color: "#ec4899",
          },
        ],
      },
      {
        id: "in_review",
        label: "In Review",
        subColumns: [
          {
            id: "ed-creator-review",
            label: "Creator Review",
            description: "Content creator checks edit against original vision",
            defaultTargetQuantity: 1,
            slaHours: 6,
            defaultChecklist: ["Review export preview link", "Mark timestamps for tweaks"],
            color: "#f59e0b",
          },
          {
            id: "ed-final-review",
            label: "Manager Final Approval",
            description: "Operations/Admin approval of final creative before release",
            defaultTargetQuantity: 1,
            slaHours: 4,
            defaultChecklist: ["Check text spelling & brand compliance", "Sign off for ad release"],
            color: "#d97706",
          },
        ],
      },
      {
        id: "completed",
        label: "Done",
        subColumns: [
          {
            id: "ed-final-export",
            label: "Rendered & Delivered",
            description: "Final 1080x1920 MP4 rendered, uploaded to Google Drive deliverable link",
            defaultTargetQuantity: 1,
            slaHours: 1,
            defaultChecklist: ["Upload final render to Drive", "Attach deliverable link to task"],
            color: "#10b981",
          },
        ],
      },
    ],
  },
  {
    id: "tpl-media-buyer",
    name: "Media Buyer Performance",
    role: "media_buyer",
    description: "Paid growth, audience targeting, ad set launches, and ROAS optimization",
    isDefault: true,
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-22T00:00:00.000Z",
    parentColumns: [
      {
        id: "backlog",
        label: "Backlog",
        subColumns: [
          {
            id: "mb-market-research",
            label: "Audience & Competitor Ads",
            description: "Analyze competitor libraries and trending angles",
            defaultTargetQuantity: 1,
            slaHours: 48,
            defaultChecklist: ["Inspect Facebook Ad Library", "List 3 target personas"],
            color: "#64748b",
          },
        ],
      },
      {
        id: "todo",
        label: "To Do",
        subColumns: [
          {
            id: "mb-budget-plan",
            label: "Budget & Angle Planning",
            description: "Plan test budgets and target CPA thresholds",
            defaultTargetQuantity: 1,
            slaHours: 24,
            defaultChecklist: ["Set daily campaign budget", "Define CPA kill metric"],
            color: "#3b82f6",
          },
        ],
      },
      {
        id: "in_progress",
        label: "In Progress",
        subColumns: [
          {
            id: "mb-campaign-setup",
            label: "Campaign Launch & Setup",
            description: "Building ad sets, pixel tracking, and UTM links",
            defaultTargetQuantity: 2,
            slaHours: 8,
            defaultChecklist: ["Configure Meta pixel events", "Set UTM tracking parameters"],
            color: "#8b5cf6",
          },
          {
            id: "mb-creative-testing",
            label: "Split Testing (A/B)",
            description: "Live split test of hooks, thumbnails, and copy variations",
            defaultTargetQuantity: 3,
            slaHours: 48,
            defaultChecklist: ["Launch 3 ad sets", "Track 24h spend pacing"],
            color: "#ec4899",
          },
        ],
      },
      {
        id: "in_review",
        label: "In Review",
        subColumns: [
          {
            id: "mb-metric-audit",
            label: "ROAS & Metric Review",
            description: "Review conversion rates, CTR, CPM, and ROAS",
            defaultTargetQuantity: 1,
            slaHours: 6,
            defaultChecklist: ["Audit ROAS >= benchmark", "Identify winning creatives"],
            color: "#f59e0b",
          },
        ],
      },
      {
        id: "completed",
        label: "Done",
        subColumns: [
          {
            id: "mb-live-scaling",
            label: "Scaling Active Campaign",
            description: "Scaling budget on profitable winners",
            defaultTargetQuantity: 1,
            slaHours: 2,
            defaultChecklist: ["Scale budget by 20%", "Archive losing ad sets"],
            color: "#10b981",
          },
        ],
      },
    ],
  },
];

let memoryTemplatesCache: RoleTemplate[] | null = null;

export async function getTemplates(): Promise<RoleTemplate[]> {
  if (memoryTemplatesCache && memoryTemplatesCache.length > 0) {
    return memoryTemplatesCache;
  }
  try {
    await mkdir(DATA_DIR, { recursive: true });
    const content = await readFile(TEMPLATES_FILE, "utf-8");
    const parsed = JSON.parse(content);
    if (Array.isArray(parsed) && parsed.length > 0) {
      memoryTemplatesCache = parsed;
      return parsed;
    }
  } catch {}

  // Initialize with rich defaults
  memoryTemplatesCache = DEFAULT_ROLE_TEMPLATES;
  try {
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(TEMPLATES_FILE, JSON.stringify(DEFAULT_ROLE_TEMPLATES, null, 2), "utf-8");
  } catch (err) {
    console.warn("Could not save initial templates file:", err);
  }
  return memoryTemplatesCache;
}

export async function saveTemplates(templates: RoleTemplate[]): Promise<void> {
  memoryTemplatesCache = templates;
  try {
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(TEMPLATES_FILE, JSON.stringify(templates, null, 2), "utf-8");
  } catch (err) {
    console.error("Error saving templates file:", err);
    throw err;
  }
}

export async function createTemplate(data: Omit<RoleTemplate, "id" | "createdAt" | "updatedAt">): Promise<RoleTemplate> {
  const current = await getTemplates();
  const newTemplate: RoleTemplate = {
    ...data,
    id: `tpl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const updated = [newTemplate, ...current];
  await saveTemplates(updated);
  return newTemplate;
}

export async function updateTemplate(id: string, updates: Partial<RoleTemplate>): Promise<RoleTemplate | null> {
  const current = await getTemplates();
  const index = current.findIndex((t) => t.id === id);
  if (index === -1) return null;

  const existing = current[index];
  const updatedItem: RoleTemplate = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  current[index] = updatedItem;
  await saveTemplates(current);
  return updatedItem;
}

export async function deleteTemplate(id: string): Promise<boolean> {
  const current = await getTemplates();
  const filtered = current.filter((t) => t.id !== id);
  if (filtered.length === current.length) return false;
  await saveTemplates(filtered);
  return true;
}
