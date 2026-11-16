export type Role = 'admin' | 'manager' | 'developer' | 'editor' | 'content_creator' | 'media_buyer' | 'member';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  avatar: string;
  department: string;
  active?: boolean;
  dailyCapacityUnits?: number; // Standard daily target bandwidth
  employeeCode?: string; // e.g. "HIM", "NIK", "TAM", "KUN", "PRI"
  color?: string; // Hex color code e.g. "#10b981"
  deletedAt?: string | null;
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
  completedAt?: string;
  assignedTo?: string; // User ID
  sortOrder?: number;
  isCustom?: boolean;
}

export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'in_review' | 'completed';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface AuditLogEntry {
  id: string;
  actorId: string;
  actorName?: string;
  action: string;
  targetType: string;
  targetId: string;
  metadata?: Record<string, any>;
  createdAt: string;
}

export interface DeliverableAsset {
  name: string;
  url: string;
  size?: number; // In bytes (<= 20MB limit)
  type?: string; // MIME type or extension e.g. "video/mp4", "image/png"
  uploadedAt: string;
  isDriveLink?: boolean;
  previewUrl?: string;
}

export interface TaskTimeTracking {
  isRunning: boolean;
  startedAt?: string;
  totalSeconds: number;
}

export interface StageHistoryEntry {
  stage: string;
  label: string;
  timestamp: string;
  actorName?: string;
}

export interface Task {
  id: string; // Target UUID in daily_team_targets
  taskNumber: string; // Friendly reference e.g. "DT-4E3B"
  title: string; // task_name in daily_team_targets
  description: string; // notes / markdown
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string; // user_id
  creatorId: string; // assigned_by or user_id
  dueDate: string; // target_date (YYYY-MM-DD)
  subtasks: Subtask[]; // Checklist of units and custom subtasks
  customSubtasks?: Subtask[]; // User-added functional steps
  project: string; // Grouping/department
  tags: string[];
  createdAt: string;
  updatedAt: string;
  comments?: TaskComment[];
  // Ads management daily target fields
  targetQuantity: number;
  completedQuantity: number;
  manualCompletedQuantity?: number;
  autoCompletedQuantity?: number;
  isCarried?: boolean;
  carriedFromTargetId?: string | null;
  // Industrial Features:
  deliverableUrl?: string; // Deliverable video / drive link
  deliverableAsset?: DeliverableAsset; // Local file <= 20MB or Cloud Drive link
  isRevisionRequested?: boolean; // When manager requests changes
  revisionReason?: string; // Why revision requested
  revisionNotes?: string;
  blockedByTaskIds?: string[]; // Prerequisites (Blocked By)
  // Scheduling & Timing
  startDate?: string;
  dueTime?: string;
  estimatedHours?: number;
  actualHours?: number;
  timeTracking?: TaskTimeTracking;
  // Soft-Delete / Archival & Adflow Protection:
  isArchived?: boolean;
  archivedAt?: string;
  archivedBy?: string | null;
  isCanonicalAdflowTask?: boolean;
  // AdFlow Creative Ingestion Fields:
  adId?: string;
  creativeName?: string;
  productionStage?: string;
  // Role & Template Workflow Fields:
  subColumnId?: string;
  parentColumnId?: TaskStatus;
  templateRole?: Role;
  // Individual Stage History & Completion Timestamp:
  stageHistory?: StageHistoryEntry[];
  completedAt?: string;
}

export interface SubColumnDef {
  id: string;
  label: string;
  description?: string;
  defaultTargetQuantity?: number;
  slaHours?: number;
  defaultChecklist?: string[];
  color?: string;
}

export interface ParentColumnDef {
  id: TaskStatus;
  label: string;
  subColumns: SubColumnDef[];
}

export interface RoleTemplate {
  id: string;
  name: string;
  role: Role | "general";
  userId?: string; // Optional user-specific override
  userName?: string;
  description: string;
  isDefault?: boolean;
  parentColumns: ParentColumnDef[];
  createdAt: string;
  updatedAt: string;
}

export interface TaskComment {
  id: string;
  taskId?: string;
  userId: string;
  userName?: string;
  userAvatar?: string;
  content: string;
  mentions?: string[];
  reactions?: Record<string, string[]>; // emoji -> array of userIds
  createdAt: string;
}

export interface DailyTaskRule {
  id: string;
  userId: string;
  taskName: string;
  targetQuantity: number;
  notes?: string | null;
  active: boolean;
  startsOn: string;
  endsOn?: string | null;
  createdBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export type ViewMode = 'board' | 'table' | 'list' | 'calendar' | 'analytics';
export type BoardLayout = 'columns' | 'subcolumns' | 'swimlanes';
export type DensityMode = 'comfortable' | 'compact';

export interface OfflineMutation {
  id: string;
  type: 'create' | 'update' | 'delete' | 'restore' | 'progress' | 'subtask';
  taskId: string;
  payload: Record<string, any>;
  createdAt: string;
}

export type DateRangePreset = 'all' | 'today' | 'yesterday' | 'this_week' | 'next_7_days' | 'overdue' | 'custom';
export type SavedFilterPreset = 'all' | 'pending_review' | 'overdue_carried' | 'high_urgent' | 'my_active';

export interface FilterState {
  search: string;
  assigneeId: string; // 'all' or specific user ID
  status: string; // 'all' or specific status
  priority: string; // 'all' or specific priority
  project: string; // 'all' or specific project
  onlyMyTasks: boolean;
  showArchived?: boolean; // Toggle to view soft-deleted / archived pipeline targets
  showCompletedHistory?: boolean; // Toggle to view completed tasks moved out of active overview
  showAdflowTasks?: boolean; // Toggle to view AdFlow creative tasks (default: false)
  targetDate?: string;
  dateFrom?: string;
  dateTo?: string;
  datePreset?: DateRangePreset;
  savedPreset?: SavedFilterPreset;
}

export interface NotificationItem {
  id: string;
  userId: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  adId?: string | null;
}

export interface WebhookConfig {
  enabled: boolean;
  url: string;
  events: string[];
  secret?: string;
  lastTriggeredAt?: string | null;
  lastStatus?: number | null;
  lastError?: string | null;
}

export type AdsSyncMode = "realtime" | "interval" | "manual";

export interface AdsConnectionState {
  connected: boolean;
  syncMode: AdsSyncMode;
  enforceCanonicalLock: boolean;
  autoMaterializeRules: boolean;
  lastSyncedAt: string | null;
  latencyMs?: number;
  statusMessage?: string;
  pendingChangesCount: number;
}

export interface PersonalNoteItem {
  id: string;
  title: string;
  content: string;
  pinned?: boolean;
  updatedAt: string;
  createdAt?: string;
}

export interface PersonalNotepad {
  userId: string;
  content: string;
  notes: PersonalNoteItem[];
  updatedAt: string;
}

export interface Reminder {
  id: string;
  title: string;
  note?: string;
  remindAt: string;
  targetUserId: string;
  createdByUserId: string;
  createdByName: string;
  completed: boolean;
  dismissed?: boolean;
  notified?: boolean;
  createdAt: string;
  updatedAt: string;
}

export type FeatureRequestType = 'feature' | 'feedback' | 'bug';
export type FeatureRequestStatus = 'open' | 'in_progress' | 'resolved';

export interface FeatureRequest {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: Role;
  type: FeatureRequestType;
  title: string;
  details: string;
  priority?: TaskPriority;
  status: FeatureRequestStatus;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}


