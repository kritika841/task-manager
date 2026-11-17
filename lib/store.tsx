"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  useCallback,
  useRef,
} from "react";
import {
  Task,
  User,
  Role,
  Subtask,
  FilterState,
  ViewMode,
  BoardLayout,
  TaskStatus,
  TaskPriority,
  DailyTaskRule,
  AuditLogEntry,
  NotificationItem,
  DeliverableAsset,
  TaskComment,
  DensityMode,
  DateRangePreset,
  SavedFilterPreset,
  AdsSyncMode,
  RoleTemplate,
  OfflineMutation,
  WebhookConfig,
  StageHistoryEntry,
} from "./types";
import { dateInTargetTimeZone, isCanonicalAdflowTask } from "./supabase";
import {
  playNotificationSound,
  isSoundMuted,
  setSoundMuted as setSoundMutedStorage,
  toggleSoundMuted,
} from "./sound";
import {
  DEFAULT_ADFLOW_STAGE_MAPPING,
  type AdFlowStageMappingConfig,
  type AdFlowStageMappingUpdate,
} from "./adflow-bridge";

import type { WorkspaceSettings } from "./workspace-settings";

type TaskWorkflowAction = "approve" | "request_changes" | "submit_for_review";

interface TaskContextType {
  tasks: Task[];
  users: User[];
  currentUser: User;
  currentUserId: string;
  isAdmin: boolean;
  isManager: boolean;
  isDeveloper: boolean;
  isManagerOrAdmin: boolean;
  isAdminOrDeveloper: boolean;
  soundMuted: boolean;
  setSoundMuted: (muted: boolean) => void;
  toggleSound: () => void;
  playNotificationSound: (type?: "task" | "reminder") => void;
  activeSection: "overview" | "notepad" | "reminders";
  setActiveSection: (section: "overview" | "notepad" | "reminders") => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  boardLayout: BoardLayout;
  setBoardLayout: (layout: BoardLayout) => void;
  density: DensityMode;
  setDensity: (density: DensityMode) => void;
  filter: FilterState;
  setFilter: (updates: Partial<FilterState>) => void;
  resetFilter: () => void;
  filteredTasks: Task[];
  baseVisibleTasks: Task[];
  selectedTaskId: string | null;
  setSelectedTaskId: (id: string | null) => void;
  isCreateModalOpen: boolean;
  setIsCreateModalOpen: (open: boolean) => void;
  createModalAssigneeId: string | null;
  createModalStatus: TaskStatus | null;
  openCreateModal: (preselectedUserId?: string, preselectedStatus?: TaskStatus) => void;
  isShortcutsModalOpen: boolean;
  setIsShortcutsModalOpen: (open: boolean) => void;
  isAutoDelegatorOpen: boolean;
  setIsAutoDelegatorOpen: (open: boolean) => void;
  isCommandPaletteOpen: boolean;
  setIsCommandPaletteOpen: (open: boolean) => void;
  isAuthenticated: boolean;
  isAuthLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  updateUserCapacity: (userId: string, units: number) => Promise<void>;
  createUser: (userData: {
    name: string;
    email?: string;
    password?: string;
    role: Role;
    employeeCode?: string;
    color?: string;
    dailyCapacityUnits?: number;
  }) => Promise<User | null>;
  updateUserColor: (userId: string, color: string) => Promise<void>;
  updateUser: (userId: string, updates: Partial<User>) => Promise<void>;
  deleteUser: (userId: string) => Promise<boolean>;
  createTask: (data: {
    title: string;
    description: string;
    priority: TaskPriority;
    status: TaskStatus;
    assigneeId: string;
    dueDate: string;
    targetQuantity?: number;
    deliverableUrl?: string;
    deliverableAsset?: DeliverableAsset;
    blockedByTaskIds?: string[];
    project?: string;
    tags?: string[];
    customSubtasks?: Subtask[];
    startDate?: string;
    dueTime?: string;
    estimatedHours?: number;
    subColumnId?: string;
    parentColumnId?: TaskStatus;
    templateRole?: Role;
  }) => Promise<Task | null>;
  updateTask: (taskId: string, updates: Partial<Task>) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  restoreTask: (taskId: string) => Promise<void>;
  toggleSubtask: (taskId: string, subtaskId: string) => Promise<void>;
  addSubtask: (taskId: string, title: string, assignedTo?: string) => Promise<void>;
  removeSubtask: (taskId: string, subtaskId: string) => Promise<void>;
  reorderSubtasks: (taskId: string, subtasks: Subtask[]) => Promise<void>;
  updateTaskProgress: (taskId: string, completedUnits: number) => Promise<void>;
  addComment: (taskId: string, content: string, mentions?: string[]) => Promise<void>;
  deleteComment: (taskId: string, commentId: string) => Promise<void>;
  toggleReaction: (taskId: string, commentId: string, emoji: string) => Promise<void>;
  // Approval Workflow
  approveTask: (taskId: string) => Promise<void>;
  requestRevision: (
    taskId: string,
    reason: string,
    notes?: string,
    revisionTarget?: "creator" | "editor"
  ) => Promise<void>;
  submitForReview: (taskId: string, deliverableUrl: string, asset?: DeliverableAsset) => Promise<void>;
  // Media Assets
  attachDeliverableAsset: (taskId: string, asset: DeliverableAsset) => Promise<void>;
  // Time Tracking Stopwatch
  startTimeTracking: (taskId: string) => void;
  stopTimeTracking: (taskId: string) => Promise<void>;
  logManualHours: (taskId: string, hours: number) => Promise<void>;
  // Dependencies
  isTaskBlocked: (task: Task) => { blocked: boolean; blockingTasks: Task[] };
  // Capacity calculation
  getMemberCapacity: (userId: string) => {
    max: number;
    current: number;
    isOverAllocated: boolean;
    percent: number;
  };
  // Bulk Multi-Select
  selectedTaskIds: string[];
  toggleSelectTask: (taskId: string) => void;
  selectAllFilteredTasks: (select: boolean) => void;
  selectTasks: (ids: string[], select: boolean) => void;
  clearSelectedTasks: () => void;
  bulkReassign: (userId: string) => Promise<void>;
  bulkMoveStatus: (status: TaskStatus) => Promise<void>;
  bulkReschedule: (dueDate: string) => Promise<void>;
  bulkDelete: () => Promise<void>;
  archiveCompletedTasks: () => Promise<number>;
  // Notifications
  notifications: NotificationItem[];
  unreadNotificationsCount: number;
  fetchNotifications: () => Promise<void>;
  markNotificationAsRead: (id: string) => Promise<void>;
  markAllNotificationsAsRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  // Auto Delegator
  delegatorRules: DailyTaskRule[];
  fetchDelegatorRules: () => Promise<void>;
  saveDelegatorRule: (rule: Partial<DailyTaskRule>) => Promise<boolean>;
  deleteDelegatorRule: (ruleId: string) => Promise<boolean>;
  toggleDelegatorRule: (ruleId: string, active: boolean) => Promise<boolean>;
  materializeDelegatorNow: () => Promise<boolean>;
  // Audit Logs
  auditLogs: AuditLogEntry[];
  getTaskAuditLogs: (taskId: string) => AuditLogEntry[];
  // Import / Export
  exportTasksToCSV: () => void;
  importTasksFromCSV: (tasks: Partial<Task>[]) => Promise<void>;
  refreshAll: () => Promise<void>;
  isSyncing: boolean;
  lastSyncedAt: Date | null;
  // Settings & Ads Management Connection
  isSettingsModalOpen: boolean;
  setIsSettingsModalOpen: (open: boolean) => void;
  isAdsManagementConnected: boolean;
  workspaceSettings: WorkspaceSettings;
  isWorkspaceSettingsLoading: boolean;
  saveWorkspaceSettings: (updates: Partial<WorkspaceSettings>) => Promise<void>;
  adsSyncMode: AdsSyncMode;
  setAdsSyncMode: (mode: AdsSyncMode) => void;
  enforceCanonicalLock: boolean;
  setEnforceCanonicalLock: (enforce: boolean) => void;
  autoMaterializeRulesOnSync: boolean;
  setAutoMaterializeRulesOnSync: (auto: boolean) => void;
  testAdsConnection: () => Promise<{ ok: boolean; latencyMs: number; message: string }>;
  pendingOfflineChangesCount: number;
  offlineQueue: OfflineMutation[];
  clearPendingOfflineChanges: () => void;
  syncPendingChangesToLive: () => Promise<void>;
  // Role & User Templates
  templates: RoleTemplate[];
  activeTemplateId: string | null;
  setActiveTemplateId: (id: string | null) => void;
  isRoleTemplateModalOpen: boolean;
  setIsRoleTemplateModalOpen: (open: boolean) => void;
  fetchTemplates: () => Promise<void>;
  createRoleTemplate: (data: Omit<RoleTemplate, "id" | "createdAt" | "updatedAt">) => Promise<RoleTemplate | null>;
  updateRoleTemplate: (id: string, updates: Partial<RoleTemplate>) => Promise<RoleTemplate | null>;
  deleteRoleTemplate: (id: string) => Promise<boolean>;
  applyTemplateToUser: (templateId: string, userId: string, targetDate?: string) => Promise<void>;
  reassignTask: (taskId: string, targetUserId: string, extraUpdates?: Partial<Task>) => Promise<void>;
  // Webhooks
  webhookConfig: WebhookConfig;
  saveWebhookSettings: (updates: Partial<WebhookConfig>) => Promise<boolean>;
  testWebhookEndpoint: (
    overrideUrl?: string
  ) => Promise<{ ok: boolean; status?: number; latencyMs: number; error?: string }>;
  // AdFlow Stage Mapping Template
  adflowStageMapping: AdFlowStageMappingConfig;
  saveAdflowStageMapping: (
    updates: AdFlowStageMappingUpdate
  ) => Promise<boolean>;
  resetAdflowStageMapping: () => Promise<boolean>;
}

const defaultFilter: FilterState = {
  search: "",
  assigneeId: "all",
  status: "all",
  priority: "all",
  project: "all",
  onlyMyTasks: false,
  showArchived: false,
  showCompletedHistory: false,
  showAdflowTasks: true, // Visible by default so live Ads Management data is immediately accessible!
  dateFrom: "",
  dateTo: "",
  datePreset: "all",
  savedPreset: "all",
};

function formatClientStageLabel(
  status: TaskStatus,
  subColumnId?: string,
  productionStage?: string
): string {
  const baseMap: Record<TaskStatus, string> = {
    backlog: "Backlog",
    todo: "To Do",
    in_progress: "In Progress",
    in_review: "In Review",
    completed: "Done",
  };
  const base = baseMap[status] || status;
  if (productionStage) {
    return `${base} (${productionStage.replace(/_/g, " ")})`;
  }
  if (subColumnId) {
    const cleanSub = subColumnId.replace(/^(dev|cc|ed|mb|mgr|adm|sub)-/, "").replace(/-/g, " ");
    return `${base} · ${cleanSub}`;
  }
  return base;
}

const TaskContext = createContext<TaskContextType | undefined>(undefined);

const STORAGE_KEY_VIEW_MODE = "satmi-view-mode-v1";
const STORAGE_KEY_ACTIVE_SECTION = "satmi-active-section-v1";
const STORAGE_KEY_LAYOUT = "satmi-board-layout-v1";
const STORAGE_KEY_DENSITY = "satmi-view-density-v1";
const STORAGE_KEY_ADS_CONNECTED = "satmi-adflow-sync-enabled-v1";
const STORAGE_KEY_ADS_SYNC_MODE = "satmi-ads-sync-mode-v1";
const STORAGE_KEY_ENFORCE_LOCK = "satmi-ads-enforce-lock-v1";
const STORAGE_KEY_AUTO_RULES = "satmi-ads-auto-rules-v1";
const STORAGE_KEY_OFFLINE_CHANGES = "satmi-ads-offline-changes-v1";
const STORAGE_KEY_ACTIVE_TEMPLATE = "satmi-active-template-id-v1";
const STORAGE_KEY_OFFLINE_QUEUE = "satmi-ads-offline-queue-v1";

export function isAdFlowLinkedTask(task: Task): boolean {
  return Boolean(task.adId || task.creativeName || task.id.startsWith("ad-"));
}

export function isTaskAdflow(task: Task): boolean {
  // Only target actual AdFlow creative entities, NEVER filter out regular daily tasks
  return Boolean(
    isAdFlowLinkedTask(task) ||
    task.tags?.includes("AdFlow") ||
    task.tags?.includes("Active Creative")
  );
}

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [activeSection, setActiveSectionState] = useState<"overview" | "notepad" | "reminders">("overview");
  const [viewMode, setViewModeState] = useState<ViewMode>("board");
  const [boardLayout, setBoardLayoutState] = useState<BoardLayout>("columns");
  const [density, setDensityState] = useState<DensityMode>("comfortable");
  const [filter, setFilterState] = useState<FilterState>(defaultFilter);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedTaskIds, setSelectedTaskIds] = useState<string[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [createModalAssigneeId, setCreateModalAssigneeId] = useState<string | null>(null);
  const [createModalStatus, setCreateModalStatus] = useState<TaskStatus | null>(null);
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState<boolean>(false);
  const [isAutoDelegatorOpen, setIsAutoDelegatorOpen] = useState<boolean>(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState<boolean>(false);
  const [delegatorRules, setDelegatorRules] = useState<DailyTaskRule[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadNotificationsCount, setUnreadNotificationsCount] = useState<number>(0);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState<boolean>(false);
  const [workspaceSettings, setWorkspaceSettings] = useState<WorkspaceSettings>({
    adflowSyncEnabled: null,
    defaultView: null,
    density: null,
  });
  const [isWorkspaceSettingsLoading, setIsWorkspaceSettingsLoading] = useState(true);
  const isAdsManagementConnected = workspaceSettings.adflowSyncEnabled === true;
  const [adsSyncMode, setAdsSyncModeState] = useState<AdsSyncMode>("realtime");
  const [enforceCanonicalLock, setEnforceCanonicalLockState] = useState<boolean>(true);
  const [autoMaterializeRulesOnSync, setAutoMaterializeRulesOnSyncState] = useState<boolean>(true);
  const [pendingOfflineChangesCount, setPendingOfflineChangesCount] = useState<number>(0);
  const [offlineQueue, setOfflineQueue] = useState<OfflineMutation[]>([]);
  const [webhookConfig, setWebhookConfig] = useState<WebhookConfig>({
    enabled: false,
    url: "",
    events: [
      "task.created",
      "task.completed",
      "task.review_submitted",
      "task.revision_requested",
      "task.archived",
      "comment.created",
    ],
    secret: "",
    lastTriggeredAt: null,
    lastStatus: null,
    lastError: null,
  });

  // Role & User Templates State
  const [templates, setTemplates] = useState<RoleTemplate[]>([]);
  const [activeTemplateId, setActiveTemplateIdState] = useState<string | null>(null);
  const [isRoleTemplateModalOpen, setIsRoleTemplateModalOpen] = useState<boolean>(false);
  const [adflowStageMapping, setAdflowStageMapping] =
    useState<AdFlowStageMappingConfig>(DEFAULT_ADFLOW_STAGE_MAPPING);

  // Notification Sound State
  const [soundMuted, setSoundMutedState] = useState<boolean>(false);

  useEffect(() => {
    setSoundMutedState(isSoundMuted());
  }, []);

  const setSoundMuted = useCallback((muted: boolean) => {
    setSoundMutedStorage(muted);
    setSoundMutedState(muted);
  }, []);

  const toggleSound = useCallback(() => {
    const next = toggleSoundMuted();
    setSoundMutedState(next);
  }, []);

  // Track known allotted tasks and unread notifications for active user to play sound on new arrivals
  const currentUserIdRef = useRef<string>("");
  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  const knownUserTasksRef = useRef<{ userId: string; taskIds: Set<string>; initialized: boolean }>({
    userId: "",
    taskIds: new Set(),
    initialized: false,
  });

  const knownUnreadNotifsRef = useRef<{ userId: string; ids: Set<string>; initialized: boolean }>({
    userId: "",
    ids: new Set(),
    initialized: false,
  });

  const lastLocalAllotTimestampRef = useRef<number>(0);

  const setActiveTemplateId = useCallback((id: string | null) => {
    setActiveTemplateIdState(id);
    try {
      if (id) localStorage.setItem(STORAGE_KEY_ACTIVE_TEMPLATE, id);
      else localStorage.removeItem(STORAGE_KEY_ACTIVE_TEMPLATE);
    } catch {}
  }, []);

  // Keep ref of selectedTaskId to prevent overwriting active editing
  const selectedTaskIdRef = useRef<string | null>(null);
  useEffect(() => {
    selectedTaskIdRef.current = selectedTaskId;
  }, [selectedTaskId]);

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    try {
      localStorage.setItem(STORAGE_KEY_VIEW_MODE, mode);
    } catch {}
  }, []);

  const setActiveSection = useCallback((section: "overview" | "notepad" | "reminders") => {
    setActiveSectionState(section);
    try {
      localStorage.setItem(STORAGE_KEY_ACTIVE_SECTION, section);
    } catch {}
  }, []);

  // Base visible tasks in current workspace mode (respects showArchived and AdFlow sync setting)
  const baseVisibleTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (!filter.showArchived && task.isArchived) return false;
      if (filter.showArchived && !task.isArchived) return false;
      if (!isAdsManagementConnected && isTaskAdflow(task)) return false;
      return true;
    });
  }, [tasks, filter.showArchived, isAdsManagementConnected]);

  const openCreateModal = useCallback((preselectedUserId?: string, preselectedStatus?: TaskStatus) => {
    setCreateModalAssigneeId(preselectedUserId || null);
    setCreateModalStatus(preselectedStatus || null);
    setIsCreateModalOpen(true);
  }, []);

  // Fetch targeted notifications for active user
  const fetchNotifications = useCallback(async () => {
    if (!currentUserId) return;
    try {
      const res = await fetch(
        `/api/notifications?userId=${encodeURIComponent(currentUserId)}`,
        { cache: "no-store" }
      );
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.notifications)) {
        const unreadIds = new Set<string>(
          data.notifications.filter((n: NotificationItem) => !n.readAt).map((n: NotificationItem) => n.id)
        );
        if (
          knownUnreadNotifsRef.current.userId !== currentUserId ||
          !knownUnreadNotifsRef.current.initialized
        ) {
          knownUnreadNotifsRef.current = {
            userId: currentUserId,
            ids: unreadIds,
            initialized: true,
          };
        } else {
          let hasNewUnread = false;
          for (const id of unreadIds) {
            if (!knownUnreadNotifsRef.current.ids.has(id)) {
              hasNewUnread = true;
              knownUnreadNotifsRef.current.ids.add(id);
            }
          }
          if (hasNewUnread && Date.now() - lastLocalAllotTimestampRef.current > 2000) {
            playNotificationSound("task");
          }
        }
        setNotifications(data.notifications);
        setUnreadNotificationsCount(data.unreadCount || 0);
      }
    } catch (err) {
      console.error("fetchNotifications error:", err);
    }
  }, [currentUserId]);

  const markNotificationAsRead = useCallback(async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n))
    );
    setUnreadNotificationsCount((prev) => Math.max(0, prev - 1));
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
    } catch (err) {
      console.error("markNotificationAsRead error:", err);
    }
  }, []);

  const markAllNotificationsAsRead = useCallback(async () => {
    setNotifications((prev) =>
      prev.map((n) => ({ ...n, readAt: n.readAt || new Date().toISOString() }))
    );
    setUnreadNotificationsCount(0);
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUserId, markAllRead: true }),
      });
    } catch (err) {
      console.error("markAllNotificationsAsRead error:", err);
    }
  }, [currentUserId]);

  const deleteNotification = useCallback(async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    try {
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "delete" }),
      });
    } catch (err) {
      console.error("deleteNotification error:", err);
    }
  }, []);

  // Initialize view mode, active section, board layout, density, and AdFlow sync from storage
  useEffect(() => {
    try {
      const savedView = localStorage.getItem(STORAGE_KEY_VIEW_MODE) as string;
      if (
        savedView === "board" ||
        savedView === "table" ||
        savedView === "list" ||
        savedView === "calendar" ||
        savedView === "analytics"
      ) {
        setViewModeState(savedView as ViewMode);
      } else if (savedView === "timeline") {
        setViewModeState("board");
      }
      const savedSection = localStorage.getItem(STORAGE_KEY_ACTIVE_SECTION) as
        | "overview"
        | "notepad"
        | "reminders";
      if (
        savedSection === "overview" ||
        savedSection === "notepad" ||
        savedSection === "reminders"
      ) {
        setActiveSectionState(savedSection);
      }
      const savedLayout = localStorage.getItem(STORAGE_KEY_LAYOUT) as BoardLayout;
      if (savedLayout === "columns" || savedLayout === "swimlanes" || savedLayout === "subcolumns") {
        setBoardLayoutState(savedLayout);
      }
      const savedDensity = localStorage.getItem(STORAGE_KEY_DENSITY) as DensityMode;
      if (savedDensity === "comfortable" || savedDensity === "compact") {
        setDensityState(savedDensity);
      }
      const savedMode = localStorage.getItem(STORAGE_KEY_ADS_SYNC_MODE) as AdsSyncMode;
      if (savedMode === "realtime" || savedMode === "interval" || savedMode === "manual") {
        setAdsSyncModeState(savedMode);
      }
      const savedLock = localStorage.getItem(STORAGE_KEY_ENFORCE_LOCK);
      if (savedLock !== null) {
        setEnforceCanonicalLockState(savedLock === "true");
      }
      const savedAutoRules = localStorage.getItem(STORAGE_KEY_AUTO_RULES);
      if (savedAutoRules !== null) {
        setAutoMaterializeRulesOnSyncState(savedAutoRules === "true");
      }
      const savedQueueRaw = localStorage.getItem(STORAGE_KEY_OFFLINE_QUEUE);
      if (savedQueueRaw) {
        const parsedQueue = JSON.parse(savedQueueRaw);
        if (Array.isArray(parsedQueue)) {
          setOfflineQueue(parsedQueue);
          setPendingOfflineChangesCount(parsedQueue.length);
        }
      } else {
        const savedPending = localStorage.getItem(STORAGE_KEY_OFFLINE_CHANGES);
        if (savedPending) {
          setPendingOfflineChangesCount(Number(savedPending) || 0);
        }
      }
      const savedTemplate = localStorage.getItem(STORAGE_KEY_ACTIVE_TEMPLATE);
      if (savedTemplate) {
        setActiveTemplateIdState(savedTemplate);
      }
    } catch {}
  }, []);

  const enqueueOfflineMutation = useCallback(
    (mutation: Omit<OfflineMutation, "id" | "createdAt">) => {
      setOfflineQueue((prev) => {
        let nextQueue = [...prev];

        if (mutation.type === "create") {
          nextQueue.push({
            ...mutation,
            id: `off_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            createdAt: new Date().toISOString(),
          });
        } else if (mutation.taskId.startsWith("temp-")) {
          // If modifying or deleting a task that was created while offline
          const createIdx = nextQueue.findIndex(
            (m) => m.type === "create" && m.taskId === mutation.taskId
          );
          if (createIdx !== -1) {
            if (mutation.type === "delete") {
              nextQueue.splice(createIdx, 1);
            } else {
              nextQueue[createIdx] = {
                ...nextQueue[createIdx],
                payload: {
                  ...nextQueue[createIdx].payload,
                  ...mutation.payload,
                },
              };
            }
          }
        } else {
          // Existing DB task mutation: coalesce updates on same taskId if applicable
          const existingUpdateIdx = nextQueue.findIndex(
            (m) =>
              m.taskId === mutation.taskId &&
              m.type === mutation.type &&
              (mutation.type === "update" ||
                mutation.type === "progress" ||
                mutation.type === "subtask")
          );
          if (existingUpdateIdx !== -1) {
            nextQueue[existingUpdateIdx] = {
              ...nextQueue[existingUpdateIdx],
              payload: {
                ...nextQueue[existingUpdateIdx].payload,
                ...mutation.payload,
              },
              createdAt: new Date().toISOString(),
            };
          } else {
            nextQueue.push({
              ...mutation,
              id: `off_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
              createdAt: new Date().toISOString(),
            });
          }
        }

        try {
          localStorage.setItem(STORAGE_KEY_OFFLINE_QUEUE, JSON.stringify(nextQueue));
          localStorage.setItem(STORAGE_KEY_OFFLINE_CHANGES, String(nextQueue.length));
        } catch {}
        setPendingOfflineChangesCount(nextQueue.length);
        return nextQueue;
      });
    },
    []
  );

  const clearPendingOfflineChanges = useCallback(() => {
    setOfflineQueue([]);
    setPendingOfflineChangesCount(0);
    try {
      localStorage.removeItem(STORAGE_KEY_OFFLINE_QUEUE);
      localStorage.removeItem(STORAGE_KEY_OFFLINE_CHANGES);
    } catch {}
  }, []);

  const replayOfflineQueue = useCallback(async () => {
    let queueToReplay: OfflineMutation[] = [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY_OFFLINE_QUEUE);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) queueToReplay = parsed;
      }
    } catch {}

    if (queueToReplay.length === 0) {
      clearPendingOfflineChanges();
      return;
    }

    setIsSyncing(true);
    try {
      for (const item of queueToReplay) {
        try {
          if (item.type === "create") {
            await fetch("/api/tasks", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(item.payload),
            });
          } else if (item.type === "delete") {
            const actorId = item.payload.actorId || currentUserId;
            await fetch(
              `/api/tasks?id=${encodeURIComponent(item.taskId)}&actorId=${encodeURIComponent(
                actorId
              )}`,
              { method: "DELETE" }
            );
          } else {
            await fetch("/api/tasks", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                id: item.taskId,
                ...item.payload,
              }),
            });
          }
        } catch (replayErr) {
          console.error("Failed to replay offline mutation:", item, replayErr);
        }
      }
      clearPendingOfflineChanges();
    } finally {
      setIsSyncing(false);
    }
  }, [clearPendingOfflineChanges, currentUserId]);

  const setBoardLayout = useCallback((layout: BoardLayout) => {
    setBoardLayoutState(layout);
    try {
      localStorage.setItem(STORAGE_KEY_LAYOUT, layout);
    } catch {}
  }, []);

  const setDensity = useCallback((mode: DensityMode) => {
    setDensityState(mode);
    try {
      localStorage.setItem(STORAGE_KEY_DENSITY, mode);
    } catch {}
  }, []);

  // Fetch tasks, users, and audit logs with intelligent state merge
  const fetchTasks = useCallback(async (showIndicator = false) => {
    try {
      if (showIndicator) setIsSyncing(true);
      const res = await fetch("/api/tasks?includeArchived=true", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch tasks");
      const data = await res.json();

      if (data.users && Array.isArray(data.users)) {
        setUsers((prev) => {
          if (JSON.stringify(prev) === JSON.stringify(data.users)) {
            return prev;
          }
          return data.users;
        });
      }

      if (data.tasks && Array.isArray(data.tasks)) {
        const activeUserId = currentUserIdRef.current;
        if (activeUserId) {
          const myTaskIds = new Set<string>(
            data.tasks
              .filter((t: Task) => t.assigneeId === activeUserId && !t.isArchived)
              .map((t: Task) => t.id)
          );
          if (
            knownUserTasksRef.current.userId !== activeUserId ||
            !knownUserTasksRef.current.initialized
          ) {
            knownUserTasksRef.current = {
              userId: activeUserId,
              taskIds: myTaskIds,
              initialized: true,
            };
          } else {
            let hasNewlyAllotted = false;
            for (const id of myTaskIds) {
              if (!id.startsWith("temp-") && !knownUserTasksRef.current.taskIds.has(id)) {
                hasNewlyAllotted = true;
                knownUserTasksRef.current.taskIds.add(id);
              }
            }
            if (hasNewlyAllotted && Date.now() - lastLocalAllotTimestampRef.current > 2500) {
              playNotificationSound("task");
            }
          }
        }

        setTasks((prev) => {
          // If drawer is currently open on a task, preserve any in-memory comments/subtasks
          const activeId = selectedTaskIdRef.current;
          if (!activeId) return data.tasks;

          const activeTask = prev.find((t) => t.id === activeId);
          if (!activeTask) return data.tasks;

          return data.tasks.map((incoming: Task) => {
            if (incoming.id === activeId) {
              return {
                ...incoming,
                // Preserve local stopwatch if active
                timeTracking: activeTask.timeTracking || incoming.timeTracking,
              };
            }
            return incoming;
          });
        });
      }

      if (data.auditLogs && Array.isArray(data.auditLogs)) {
        setAuditLogs(data.auditLogs);
      }

      setLastSyncedAt(new Date());
    } catch (err) {
      console.error("fetchTasks error:", err);
    } finally {
      if (showIndicator) setIsSyncing(false);
    }
  }, []);

  // Fetch Auto Delegator rules
  const fetchDelegatorRules = useCallback(async () => {
    try {
      const res = await fetch("/api/delegator", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to fetch delegator rules");
      const data = await res.json();
      if (data.rules) {
        setDelegatorRules(data.rules);
      }
    } catch (err) {
      console.error("fetchDelegatorRules error:", err);
    }
  }, []);

  // Fetch Role Templates
  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch("/api/templates", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.templates)) {
        setTemplates(data.templates);
      }
    } catch (err) {
      console.error("fetchTemplates error:", err);
    }
  }, []);

  // Fetch Webhook Configuration
  const fetchWebhookConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/webhooks", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.config) {
        setWebhookConfig(data.config);
      }
    } catch (err) {
      console.error("fetchWebhookConfig error:", err);
    }
  }, []);

  // Fetch AdFlow Stage Mapping Template
  const fetchAdflowStageMapping = useCallback(async () => {
    try {
      const res = await fetch("/api/adflow/stage-mapping", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      if (data.mapping) {
        setAdflowStageMapping(data.mapping);
      }
    } catch (err) {
      console.error("fetchAdflowStageMapping error:", err);
    }
  }, []);

  const saveAdflowStageMapping = useCallback(
    async (updates: AdFlowStageMappingUpdate): Promise<boolean> => {
      try {
        const res = await fetch("/api/adflow/stage-mapping", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updates),
        });
        if (!res.ok) return false;
        const data = await res.json();
        if (data.mapping) {
          setAdflowStageMapping(data.mapping);
        }
        await fetchTasks(false);
        return true;
      } catch (err) {
        console.error("saveAdflowStageMapping error:", err);
        return false;
      }
    },
    [fetchTasks]
  );

  const resetAdflowStageMapping = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch("/api/adflow/stage-mapping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reset: true }),
      });
      if (!res.ok) return false;
      const data = await res.json();
      if (data.mapping) {
        setAdflowStageMapping(data.mapping);
      }
      await fetchTasks(false);
      return true;
    } catch (err) {
      console.error("resetAdflowStageMapping error:", err);
      return false;
    }
  }, [fetchTasks]);

  useEffect(() => {
    if (!isAuthenticated) return;
    fetchTasks(true);
    fetchDelegatorRules();
    fetchTemplates();
    fetchWebhookConfig();
    fetchAdflowStageMapping();
  }, [
    isAuthenticated,
    fetchTasks,
    fetchDelegatorRules,
    fetchTemplates,
    fetchWebhookConfig,
    fetchAdflowStageMapping,
  ]);

  useEffect(() => {
    if (currentUserId) {
      fetchNotifications();
    }
  }, [currentUserId, fetchNotifications]);

  useEffect(() => {
    const controller = new AbortController();
    async function checkAuthSession() {
      try {
        const res = await fetch("/api/auth", { cache: "no-store", signal: controller.signal });
        if (!res.ok) return;
        const { user } = await res.json();
        if (user?.id && !controller.signal.aborted) {
          setUsers([user]);
          setCurrentUserId(user.id);
          setIsAuthenticated(true);
        }
      } catch (err) {
        if (!controller.signal.aborted) console.error("Auth session check error:", err);
      } finally {
        if (!controller.signal.aborted) setIsAuthLoading(false);
      }
    }

    void checkAuthSession();
    return () => controller.abort();
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        const res = await fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });

        const data = await res.json();
        if (!res.ok || !data.ok) {
          return { success: false, error: data.error || "Authentication failed." };
        }

        if (data.user) {
          setUsers((prev) => {
            const exists = prev.some((u) => u.id === data.user.id);
            return exists
              ? prev.map((u) => (u.id === data.user.id ? data.user : u))
              : [...prev, data.user];
          });
          setCurrentUserId(data.user.id);
          setIsAuthenticated(true);
          return { success: true };
        }

        return { success: false, error: "Profile could not be loaded." };
      } catch (err: any) {
        console.error("Login error:", err);
        return { success: false, error: err?.message || "Connection failed. Please retry." };
      }
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      const res = await fetch("/api/auth", { method: "DELETE" });
      if (!res.ok) throw new Error("Could not end your session.");
      window.location.reload();
    } catch (err) {
      console.error("Sign out error:", err);
      window.alert("Could not sign out. Please try again.");
    }
  }, []);

  const createUser = useCallback(
    async (userData: {
      name: string;
      email?: string;
      password?: string;
      role: Role;
      employeeCode?: string;
      color?: string;
      dailyCapacityUnits?: number;
    }) => {
      try {
        const res = await fetch("/api/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(userData),
        });
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to create user");
        }
        const data = await res.json();
        if (data.user) {
          setUsers((prev) => [...prev.filter((u) => u.id !== data.user.id), data.user]);
          return data.user as User;
        }
      } catch (err) {
        console.error("createUser error:", err);
      }
      return null;
    },
    []
  );

  const updateUser = useCallback(async (userId: string, updates: Partial<User>) => {
    try {
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId, ...updates }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Could not save team member changes.");
      setUsers((prev) => prev.map((u) => (u.id === userId ? data.user : u)));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Could not save team member changes.");
    }
  }, []);

  const updateUserColor = useCallback((userId: string, color: string) => {
    return updateUser(userId, { color });
  }, [updateUser]);

  const deleteUser = useCallback(async (userId: string) => {
    try {
      const res = await fetch(`/api/users?id=${encodeURIComponent(userId)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Could not deactivate this team member.");
      }
      setUsers((prev) => prev.filter((u) => u.id !== userId));
      return true;
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Could not deactivate this team member.");
      return false;
    }
  }, []);

  const updateUserCapacity = useCallback((userId: string, units: number) => {
    return updateUser(userId, { dailyCapacityUnits: Math.max(1, Math.min(24, Math.round(units))) });
  }, [updateUser]);

  const writeWorkspaceSettings = useCallback(async (
    updates: Partial<WorkspaceSettings>,
    initializeSync = false,
    signal?: AbortSignal
  ): Promise<WorkspaceSettings> => {
    const res = await fetch("/api/workspace-settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...updates, initializeSync }),
      signal,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not save workspace settings.");
    return data.settings;
  }, []);

  const saveWorkspaceSettings = useCallback(async (updates: Partial<WorkspaceSettings>) => {
    const settings = await writeWorkspaceSettings(updates);
    setWorkspaceSettings(settings);
    if (updates.defaultView && settings.defaultView) {
      setViewModeState(settings.defaultView);
      try { localStorage.removeItem(STORAGE_KEY_VIEW_MODE); } catch {}
    }
    if (updates.density && settings.density) {
      setDensityState(settings.density);
      try { localStorage.removeItem(STORAGE_KEY_DENSITY); } catch {}
    }
    if (updates.adflowSyncEnabled) await fetchTasks(true);
  }, [writeWorkspaceSettings, fetchTasks]);

  const setAdsSyncMode = useCallback((mode: AdsSyncMode) => {
    setAdsSyncModeState(mode);
    try {
      localStorage.setItem(STORAGE_KEY_ADS_SYNC_MODE, mode);
    } catch {}
  }, []);

  const setEnforceCanonicalLock = useCallback((enforce: boolean) => {
    setEnforceCanonicalLockState(enforce);
    try {
      localStorage.setItem(STORAGE_KEY_ENFORCE_LOCK, String(enforce));
    } catch {}
  }, []);

  const setAutoMaterializeRulesOnSync = useCallback((auto: boolean) => {
    setAutoMaterializeRulesOnSyncState(auto);
    try {
      localStorage.setItem(STORAGE_KEY_AUTO_RULES, String(auto));
    } catch {}
  }, []);

  const testAdsConnection = useCallback(async () => {
    const start = performance.now();
    try {
      const res = await fetch("/api/tasks?limit=1", {
        method: "GET",
        cache: "no-store",
      });
      const end = performance.now();
      const latencyMs = Math.round(end - start);
      if (!res.ok) {
        return {
          ok: false,
          latencyMs,
          message: `Server returned HTTP ${res.status}: ${res.statusText}`,
        };
      }
      return {
        ok: true,
        latencyMs,
        message: "Supabase Ads Pipeline connected and operational",
      };
    } catch (err: any) {
      const end = performance.now();
      const latencyMs = Math.round(end - start);
      return {
        ok: false,
        latencyMs,
        message: err?.message || "Failed to reach Ads Management endpoint",
      };
    }
  }, []);

  // Global Keyboard Shortcuts (Cmd+K, C, ?, Esc, 1-6)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
        return;
      }

      if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        setIsSettingsModalOpen((prev) => !prev);
        return;
      }

      if (e.key === "Escape") {
        if (isSettingsModalOpen) {
          setIsSettingsModalOpen(false);
          return;
        }
        if (isCommandPaletteOpen) {
          setIsCommandPaletteOpen(false);
          return;
        }
        if (isShortcutsModalOpen) {
          setIsShortcutsModalOpen(false);
          return;
        }
        if (isCreateModalOpen) {
          setIsCreateModalOpen(false);
          return;
        }
        if (isAutoDelegatorOpen) {
          setIsAutoDelegatorOpen(false);
          return;
        }
        if (selectedTaskId) {
          setSelectedTaskId(null);
          return;
        }
        if (selectedTaskIds.length > 0) {
          setSelectedTaskIds([]);
          return;
        }
      }

      if (!isInput && !e.metaKey && !e.ctrlKey && !e.altKey) {
        if (e.key === "s" || e.key === "S") {
          e.preventDefault();
          setIsSettingsModalOpen((prev) => !prev);
        } else if (e.key === "c" || e.key === "C") {
          e.preventDefault();
          openCreateModal();
        } else if (e.key === "?") {
          e.preventDefault();
          setIsShortcutsModalOpen((prev) => !prev);
        } else if (e.key === "b" || e.key === "B") {
          setViewMode("board");
        } else if (e.key === "t" || e.key === "T") {
          setViewMode("table");
        } else if (e.key === "l" || e.key === "L") {
          setViewMode("list");
        } else if (e.key === "d" || e.key === "D") {
          setViewMode("calendar");
        } else if ((e.key === "o" || e.key === "O") && isAdmin) {
          setViewMode("analytics");
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isSettingsModalOpen,
    isCommandPaletteOpen,
    isShortcutsModalOpen,
    isCreateModalOpen,
    isAutoDelegatorOpen,
    selectedTaskId,
    selectedTaskIds,
    openCreateModal,
    setViewMode,
  ]);

  // Background Heartbeat (only when AdFlow Sync is enabled)
  useEffect(() => {
    if (!isAuthenticated || !isAdsManagementConnected) {
      return;
    }

    if (adsSyncMode === "manual") {
      return;
    }

    let lastFocusFetch = Date.now();
    const handleFocusOrVisibility = () => {
      if (typeof document !== "undefined" && !document.hidden) {
        const now = Date.now();
        // Throttle refetches on focus so rapid tab-switching doesn't spam (min 8 seconds)
        if (now - lastFocusFetch > 8000) {
          lastFocusFetch = now;
          fetchTasks(false);
          fetchNotifications();
        }
      }
    };

    window.addEventListener("focus", handleFocusOrVisibility);
    document.addEventListener("visibilitychange", handleFocusOrVisibility);

    const interval = setInterval(() => {
      if (typeof document !== "undefined" && !document.hidden) {
        fetchTasks(false);
        fetchNotifications();
      }
    }, 60000);

    return () => {
      clearInterval(interval);
      window.removeEventListener("focus", handleFocusOrVisibility);
      document.removeEventListener("visibilitychange", handleFocusOrVisibility);
    };
  }, [isAuthenticated, isAdsManagementConnected, adsSyncMode, fetchTasks, fetchNotifications]);

  const currentUser = useMemo<User>(() => {
    return (
      users.find((u) => u.id === currentUserId) ||
      {
        id: "default",
        name: "Loading...",
        email: "user@satmi.in",
        role: "member",
        avatar: "US",
        department: "Operations",
        dailyCapacityUnits: 6,
      }
    );
  }, [users, currentUserId]);

  const isDeveloper = currentUser.role === "developer";
  // Developer role has all the permissions that Admin has (for full task delegation & workspace management)
  const isAdmin = currentUser.role === "admin" || isDeveloper;
  const isManager = currentUser.role === "manager";
  const isManagerOrAdmin = isAdmin || isManager || isDeveloper;
  const isAdminOrDeveloper = isAdmin || isDeveloper;

  useEffect(() => {
    if (!isAuthenticated) return;
    const controller = new AbortController();

    async function loadWorkspaceSettings() {
      try {
        const res = await fetch("/api/workspace-settings", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("Could not load workspace settings.");
        let { settings }: { settings: WorkspaceSettings } = await res.json();

        if (settings.adflowSyncEnabled === null && isAdmin) {
          const legacySync = localStorage.getItem(STORAGE_KEY_ADS_CONNECTED);
          if (legacySync === "true" || legacySync === "false") {
            settings = await writeWorkspaceSettings(
              { adflowSyncEnabled: legacySync === "true" },
              true,
              controller.signal
            );
          }
        }

        if (controller.signal.aborted) return;
        setWorkspaceSettings(settings);
        if (settings.defaultView && !localStorage.getItem(STORAGE_KEY_VIEW_MODE)) {
          setViewModeState(settings.defaultView === "analytics" && !isAdmin ? "board" : settings.defaultView);
        }
        if (settings.density && !localStorage.getItem(STORAGE_KEY_DENSITY)) {
          setDensityState(settings.density);
        }
      } catch (err) {
        if (!controller.signal.aborted) console.error("Workspace settings error:", err);
      } finally {
        if (!controller.signal.aborted) setIsWorkspaceSettingsLoading(false);
      }
    }

    void loadWorkspaceSettings();
    return () => controller.abort();
  }, [isAuthenticated, isAdmin, writeWorkspaceSettings]);

  const setFilter = useCallback((updates: Partial<FilterState>) => {
    setFilterState((prev) => ({ ...prev, ...updates }));
  }, []);

  const resetFilter = useCallback(() => {
    setFilterState(defaultFilter);
  }, []);

  // Check if a task is blocked by prerequisite tasks
  const isTaskBlocked = useCallback(
    (task: Task) => {
      if (!task.blockedByTaskIds || task.blockedByTaskIds.length === 0) {
        return { blocked: false, blockingTasks: [] };
      }
      const blocking = tasks.filter(
        (t) => task.blockedByTaskIds?.includes(t.id) && t.status !== "completed"
      );
      return { blocked: blocking.length > 0, blockingTasks: blocking };
    },
    [tasks]
  );

  // Capacity calculation per user
  const getMemberCapacity = useCallback(
    (userId: string) => {
      const user = users.find((u) => u.id === userId);
      const max = user?.dailyCapacityUnits || 6;
      const today = dateInTargetTimeZone();
      const current = baseVisibleTasks
        .filter((t) => t.assigneeId === userId && t.dueDate === today)
        .reduce((sum, t) => sum + (t.targetQuantity || 1), 0);
      const percent = Math.round((current / max) * 100);
      return {
        max,
        current,
        isOverAllocated: current > max,
        percent,
      };
    },
    [users, baseVisibleTasks]
  );

  // 1. Create Task
  const createTask = useCallback(
    async (data: {
      title: string;
      description: string;
      priority: TaskPriority;
      status: TaskStatus;
      assigneeId: string;
      dueDate: string;
      targetQuantity?: number;
      deliverableUrl?: string;
      deliverableAsset?: DeliverableAsset;
      blockedByTaskIds?: string[];
      project?: string;
      tags?: string[];
      customSubtasks?: Subtask[];
      startDate?: string;
      dueTime?: string;
      estimatedHours?: number;
      subColumnId?: string;
      parentColumnId?: TaskStatus;
      templateRole?: Role;
    }): Promise<Task | null> => {
      const today = dateInTargetTimeZone();
      const targetQty = Math.max(1, Number(data.targetQuantity) || 1);
      const assignee = users.find((u) => u.id === data.assigneeId);
      const nowIso = new Date().toISOString();
      const initialStatus: TaskStatus = data.status || "todo";
      const initialStageEntry: StageHistoryEntry = {
        stage: initialStatus,
        label: formatClientStageLabel(initialStatus, data.subColumnId),
        timestamp: nowIso,
        actorName: currentUser.name,
      };

      // If targetQty > 1 (e.g. 4 units), split into N individual 1-unit optimistic tasks
      const splitCount = targetQty > 1 ? targetQty : 1;
      const tempIds: string[] = [];
      const optimisticTasks: Task[] = [];

      for (let i = 1; i <= splitCount; i++) {
        const tempId = `temp-${Date.now()}-${i}`;
        tempIds.push(tempId);
        const unitTitle =
          splitCount > 1 ? `${data.title.trim()} (${i}/${splitCount})` : data.title.trim();

        optimisticTasks.push({
          id: tempId,
          taskNumber: `DT-${String(i).padStart(2, "0")}`,
          title: unitTitle,
          description: data.description || "",
          status: initialStatus,
          priority: data.priority || "medium",
          assigneeId: data.assigneeId || currentUserId,
          creatorId: currentUserId,
          dueDate: data.dueDate || today,
          targetQuantity: 1,
          completedQuantity: initialStatus === "completed" ? 1 : 0,
          manualCompletedQuantity: initialStatus === "completed" ? 1 : 0,
          autoCompletedQuantity: 0,
          subtasks:
            data.customSubtasks && data.customSubtasks.length > 0
              ? data.customSubtasks
              : [
                  {
                    id: `sub-${tempId}-1`,
                    title: `Unit 1 of ${unitTitle}`,
                    completed: initialStatus === "completed",
                    isCustom: false,
                  },
                ],
          customSubtasks: data.customSubtasks || [],
          project: data.project || assignee?.department || "Operations",
          tags: data.tags || ["Daily Target"],
          deliverableUrl: data.deliverableUrl || data.deliverableAsset?.url,
          deliverableAsset: data.deliverableAsset,
          blockedByTaskIds: data.blockedByTaskIds || [],
          startDate: data.startDate,
          dueTime: data.dueTime,
          estimatedHours: data.estimatedHours,
          subColumnId: data.subColumnId,
          parentColumnId: data.parentColumnId || initialStatus,
          templateRole: data.templateRole,
          stageHistory: [initialStageEntry],
          completedAt: initialStatus === "completed" ? nowIso : undefined,
          createdAt: nowIso,
          updatedAt: nowIso,
          comments: [],
        });
      }

      setTasks((prev) => [...optimisticTasks, ...prev]);

      const effectiveAssigneeId = data.assigneeId || currentUserId;
      if (effectiveAssigneeId && effectiveAssigneeId === currentUserId) {
        lastLocalAllotTimestampRef.current = Date.now();
        playNotificationSound("task");
      }

      const createPayload = {
        title: data.title,
        description: data.description,
        priority: data.priority,
        status: data.status,
        assigneeId: effectiveAssigneeId,
        creatorId: currentUserId,
        dueDate: data.dueDate,
        targetQuantity: targetQty,
        deliverableUrl: data.deliverableUrl || data.deliverableAsset?.url,
        deliverableAsset: data.deliverableAsset,
        blockedByTaskIds: data.blockedByTaskIds,
        project: data.project,
        tags: data.tags,
        customSubtasks: data.customSubtasks,
        startDate: data.startDate,
        dueTime: data.dueTime,
        estimatedHours: data.estimatedHours,
        subColumnId: data.subColumnId,
        parentColumnId: data.parentColumnId || data.status,
        templateRole: data.templateRole,
      };

      try {
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(createPayload),
        });

        if (!res.ok) throw new Error("Failed to create task");
        const json = await res.json();

        // Refresh to pick up real generated ID and DB timestamps
        await fetchTasks(false);
        return json.target;
      } catch (err) {
        console.error("createTask error:", err);
        setTasks((prev) => prev.filter((t) => !tempIds.includes(t.id)));
        return null;
      }
    },
    [currentUserId, currentUser.name, users, fetchTasks]
  );

  // 2. Update Task
  const updateTask = useCallback(
    async (
      taskId: string,
      updates: Partial<Task>,
      workflowAction?: TaskWorkflowAction,
      revisionTarget?: "creator" | "editor"
    ) => {
      const target = tasks.find((t) => t.id === taskId);
      const changesStatus = updates.status !== undefined || updates.productionStage !== undefined ||
        updates.isRevisionRequested !== undefined || updates.subColumnId !== undefined ||
        updates.parentColumnId !== undefined;
      if (target && isAdFlowLinkedTask(target) && changesStatus && !workflowAction) return;

      // Optimistic state update
      let finalCompletedQuantity: number | undefined;

      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t;

          const isStandardAdflow = isCanonicalAdflowTask(t.title);
          const autoQty = t.autoCompletedQuantity || 0;

          let nextCompleted = t.completedQuantity;
          if (updates.completedQuantity !== undefined) {
            // Respect auto_completed_quantity: manual clicks must never subtract from Adflow auto-work
            nextCompleted = Math.max(autoQty, Math.max(0, updates.completedQuantity));
          } else if (updates.status === "completed") {
            nextCompleted = Math.max(autoQty, updates.targetQuantity ?? t.targetQuantity);
          } else if (updates.status === "todo" || updates.status === "backlog") {
            // Preserving auto_completed_quantity when moving back to todo/backlog
            nextCompleted = autoQty;
          }

          const shouldRecalcCompleted =
            updates.completedQuantity !== undefined || updates.status !== undefined;

          if (shouldRecalcCompleted) {
            finalCompletedQuantity = nextCompleted;
          }

          const targetQty = updates.targetQuantity ?? t.targetQuantity;
          const updatedSubtasks =
            updates.subtasks ??
            (shouldRecalcCompleted
              ? t.subtasks.map((st, i) => ({
                  ...st,
                  completed: i < nextCompleted,
                  completedAt: i < nextCompleted ? new Date().toISOString() : undefined,
                }))
              : t.subtasks);

          const updatedAssignee = updates.assigneeId
            ? users.find((u) => u.id === updates.assigneeId)
            : undefined;

          // If canonical Adflow pipeline task, lock title against renaming
          const safeUpdates = { ...updates };
          if (isStandardAdflow && safeUpdates.title) {
            delete safeUpdates.title;
          }

          const nextStatus: TaskStatus = safeUpdates.status || t.status;
          const nextSubCol =
            safeUpdates.subColumnId !== undefined ? safeUpdates.subColumnId : t.subColumnId;
          const nextProdStage =
            safeUpdates.productionStage !== undefined
              ? safeUpdates.productionStage
              : t.productionStage;

          let nextStageHistory = t.stageHistory || [
            {
              stage: t.status,
              label: formatClientStageLabel(t.status, t.subColumnId, t.productionStage),
              timestamp: t.createdAt,
            },
          ];

          if (
            nextStatus !== t.status ||
            (safeUpdates.subColumnId !== undefined && safeUpdates.subColumnId !== t.subColumnId) ||
            (safeUpdates.productionStage !== undefined &&
              safeUpdates.productionStage !== t.productionStage)
          ) {
            nextStageHistory = [
              ...nextStageHistory,
              {
                stage: nextStatus,
                label: formatClientStageLabel(nextStatus, nextSubCol, nextProdStage),
                timestamp: new Date().toISOString(),
                actorName: currentUser.name,
              },
            ];
          }

          const nextCompletedAt =
            nextStatus === "completed"
              ? t.completedAt || new Date().toISOString()
              : undefined;

          return {
            ...t,
            ...safeUpdates,
            completedQuantity: nextCompleted,
            subtasks: updatedSubtasks,
            project: updatedAssignee ? updatedAssignee.department : t.project,
            stageHistory: nextStageHistory,
            completedAt: nextCompletedAt,
            updatedAt: new Date().toISOString(),
          };
        })
      );

      const isStandard = target ? isCanonicalAdflowTask(target.title) : false;

      if (
        updates.assigneeId &&
        updates.assigneeId === currentUserId &&
        target &&
        target.assigneeId !== currentUserId
      ) {
        lastLocalAllotTimestampRef.current = Date.now();
        playNotificationSound("task");
      }

      const patchPayload = {
        workflowAction,
        revisionTarget,
        status: updates.status,
        productionStage: updates.productionStage,
        priority: updates.priority,
        completedQuantity:
          updates.completedQuantity !== undefined || updates.status !== undefined
            ? finalCompletedQuantity
            : undefined,
        targetQuantity: updates.targetQuantity,
        assigneeId: updates.assigneeId,
        dueDate: updates.dueDate,
        title: isStandard ? undefined : updates.title,
        description: updates.description,
        project: updates.project,
        tags: updates.tags,
        deliverableUrl: updates.deliverableUrl,
        deliverableAsset: updates.deliverableAsset,
        isRevisionRequested: updates.isRevisionRequested,
        revisionReason: updates.revisionReason,
        revisionNotes: updates.revisionNotes,
        blockedByTaskIds: updates.blockedByTaskIds,
        subtasks: updates.subtasks,
        customSubtasks: updates.customSubtasks,
        startDate: updates.startDate,
        dueTime: updates.dueTime,
        estimatedHours: updates.estimatedHours,
        actualHours: updates.actualHours,
        timeTracking: updates.timeTracking,
        subColumnId: updates.subColumnId,
        parentColumnId: updates.parentColumnId || updates.status,
        templateRole: updates.templateRole,
      };

      try {
        const res = await fetch("/api/tasks", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: taskId, ...patchPayload }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || "Could not save task changes.");
        }
      } catch (err) {
        await fetchTasks(false);
        window.alert(err instanceof Error ? err.message : "Could not save task changes.");
      }
    },
    [currentUserId, currentUser.name, users, tasks, fetchTasks]
  );

  // 3. Delete Task (Soft-delete / Archive: ensures pipeline targets are never permanently dropped)
  const deleteTask = useCallback(
    async (taskId: string) => {
      // Soft-delete: mark task as archived in memory
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, isArchived: true, archivedAt: new Date().toISOString() }
            : t
        )
      );
      setSelectedTaskIds((prev) => prev.filter((id) => id !== taskId));
      if (selectedTaskId === taskId) {
        setSelectedTaskId(null);
      }

      try {
        await fetch(
          `/api/tasks?id=${encodeURIComponent(taskId)}&actorId=${encodeURIComponent(
            currentUserId
          )}`,
          { method: "DELETE" }
        );
      } catch (err) {
        console.error("deleteTask sync error:", err);
      }
    },
    [selectedTaskId, currentUserId]
  );

  // Restore Task from Archive
  const restoreTask = useCallback(
    async (taskId: string) => {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, isArchived: false, archivedAt: undefined, archivedBy: null }
            : t
        )
      );

      try {
        await fetch("/api/tasks", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: taskId,
            restore: true,
            isArchived: false,
            actorId: currentUserId,
          }),
        });
      } catch (err) {
        console.error("restoreTask sync error:", err);
      }
    },
    [currentUserId]
  );

  // 4. Toggle Subtask (Supports both custom functional steps and unit checklist)
  const toggleSubtask = useCallback(
    async (taskId: string, subtaskId: string) => {
      let nextCompletedCount = 0;
      let targetCount = 1;
      let nextCustomSubtasks: Subtask[] | undefined;

      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t;

          targetCount = t.targetQuantity || 1;
          const autoQty = t.autoCompletedQuantity || 0;

          // Prevent unchecking units auto-ingested by Adflow pipeline
          const targetSubtask = t.subtasks.find((st) => st.id === subtaskId);
          if (targetSubtask && !targetSubtask.isCustom && targetSubtask.sortOrder) {
            if (targetSubtask.sortOrder <= autoQty && targetSubtask.completed) {
              // Disallow unchecking auto-ingested work
              return t;
            }
          }

          const updatedSubtasks = t.subtasks.map((st) => {
            if (st.id === subtaskId) {
              const nextDone = !st.completed;
              return {
                ...st,
                completed: nextDone,
                completedAt: nextDone ? new Date().toISOString() : undefined,
              };
            }
            return st;
          });

          const checkedUnits = updatedSubtasks.filter((st) => st.completed).length;
          nextCompletedCount = Math.max(autoQty, checkedUnits);
          nextCustomSubtasks = updatedSubtasks.filter((st) => st.isCustom);

          let nextStatus: TaskStatus = t.status;
          if (nextCompletedCount >= targetCount) {
            nextStatus = "completed";
          } else if (nextCompletedCount > 0) {
            nextStatus = "in_progress";
          } else {
            nextStatus = "todo";
          }

          let nextStageHistory = t.stageHistory || [
            {
              stage: t.status,
              label: formatClientStageLabel(t.status, t.subColumnId, t.productionStage),
              timestamp: t.createdAt,
            },
          ];
          if (nextStatus !== t.status) {
            nextStageHistory = [
              ...nextStageHistory,
              {
                stage: nextStatus,
                label: formatClientStageLabel(nextStatus, t.subColumnId, t.productionStage),
                timestamp: new Date().toISOString(),
                actorName: currentUser.name,
              },
            ];
          }

          return {
            ...t,
            subtasks: updatedSubtasks,
            customSubtasks: nextCustomSubtasks.length > 0 ? nextCustomSubtasks : t.customSubtasks,
            completedQuantity: nextCompletedCount,
            status: nextStatus,
            stageHistory: nextStageHistory,
            completedAt:
              nextStatus === "completed" ? t.completedAt || new Date().toISOString() : undefined,
            updatedAt: new Date().toISOString(),
          };
        })
      );

      try {
        await fetch("/api/tasks", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: taskId,
            completedQuantity: nextCompletedCount,
            customSubtasks: nextCustomSubtasks,
            actorId: currentUserId,
          }),
        });
      } catch (err) {
        console.error("toggleSubtask sync error:", err);
      }
    },
    [currentUserId]
  );

  // Add custom subtask checklist item
  const addSubtask = useCallback(
    async (taskId: string, title: string, assignedTo?: string) => {
      if (!title.trim()) return;
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      const newSubtask: Subtask = {
        id: `csub-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: title.trim(),
        completed: false,
        assignedTo: assignedTo || task.assigneeId,
        sortOrder: (task.subtasks?.length || 0) + 1,
        isCustom: true,
      };

      const updatedSubtasks = [...(task.subtasks || []), newSubtask];
      const updatedCustom = [...(task.customSubtasks || []), newSubtask];

      await updateTask(taskId, {
        subtasks: updatedSubtasks,
        customSubtasks: updatedCustom,
      });
    },
    [tasks, updateTask]
  );

  // Remove custom subtask item
  const removeSubtask = useCallback(
    async (taskId: string, subtaskId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      const updatedSubtasks = (task.subtasks || []).filter((s) => s.id !== subtaskId);
      const updatedCustom = (task.customSubtasks || []).filter((s) => s.id !== subtaskId);

      await updateTask(taskId, {
        subtasks: updatedSubtasks,
        customSubtasks: updatedCustom,
      });
    },
    [tasks, updateTask]
  );

  // Reorder subtasks
  const reorderSubtasks = useCallback(
    async (taskId: string, newSubtasks: Subtask[]) => {
      await updateTask(taskId, {
        subtasks: newSubtasks,
        customSubtasks: newSubtasks.filter((s) => s.isCustom),
      });
    },
    [updateTask]
  );

  // 5. Update Task Progress
  const updateTaskProgress = useCallback(
    async (taskId: string, completedUnits: number) => {
      let finalCount = 0;

      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t;

          const autoQty = t.autoCompletedQuantity || 0;
          // Respect auto_completed_quantity: progress must never drop below auto-ingested work
          const cleanCount = Math.max(autoQty, Math.max(0, completedUnits));
          finalCount = cleanCount;

          const updatedSubtasks = t.subtasks.map((st, i) => ({
            ...st,
            completed: i < cleanCount,
            completedAt: i < cleanCount ? new Date().toISOString() : undefined,
          }));

          let nextStatus: TaskStatus = t.status;
          if (cleanCount >= t.targetQuantity) {
            nextStatus = "completed";
          } else if (cleanCount > 0) {
            nextStatus = "in_progress";
          } else {
            nextStatus = "todo";
          }

          if (isAdFlowLinkedTask(t)) nextStatus = t.status;

          let nextStageHistory = t.stageHistory || [
            {
              stage: t.status,
              label: formatClientStageLabel(t.status, t.subColumnId, t.productionStage),
              timestamp: t.createdAt,
            },
          ];
          if (nextStatus !== t.status) {
            nextStageHistory = [
              ...nextStageHistory,
              {
                stage: nextStatus,
                label: formatClientStageLabel(nextStatus, t.subColumnId, t.productionStage),
                timestamp: new Date().toISOString(),
                actorName: currentUser.name,
              },
            ];
          }

          return {
            ...t,
            completedQuantity: cleanCount,
            subtasks: updatedSubtasks,
            status: nextStatus,
            stageHistory: nextStageHistory,
            completedAt:
              nextStatus === "completed" ? t.completedAt || new Date().toISOString() : undefined,
            updatedAt: new Date().toISOString(),
          };
        })
      );

      try {
        await fetch("/api/tasks", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: taskId,
            completedQuantity: finalCount,
            actorId: currentUserId,
          }),
        });
      } catch (err) {
        console.error("updateTaskProgress sync error:", err);
      }
    },
    [currentUserId]
  );

  // 6. Approval Actions
  const approveTask = useCallback(
    async (taskId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;

      await updateTask(taskId, {
        status: "completed",
        productionStage: "approved",
        isRevisionRequested: false,
        revisionReason: undefined,
        revisionNotes: undefined,
        completedQuantity: task.targetQuantity,
      }, "approve");
      await fetchTasks(false);
    },
    [tasks, updateTask, fetchTasks]
  );

  const requestRevision = useCallback(
    async (
      taskId: string,
      reason: string,
      notes?: string,
      revisionTarget?: "creator" | "editor"
    ) => {
      const targetStage =
        revisionTarget === "creator" ||
        reason.toLowerCase().includes("creator")
          ? "creator_changes_requested"
          : "changes_requested";
      await updateTask(taskId, {
        status: "in_progress",
        productionStage: targetStage,
        isRevisionRequested: true,
        revisionReason: reason,
        revisionNotes: notes,
      }, "request_changes", targetStage === "creator_changes_requested" ? "creator" : "editor");
      await fetchTasks(false);
    },
    [updateTask, fetchTasks]
  );

  const submitForReview = useCallback(
    async (taskId: string, deliverableUrl: string, asset?: DeliverableAsset) => {
      await updateTask(taskId, {
        status: "in_review",
        deliverableUrl,
        deliverableAsset: asset,
      }, "submit_for_review");
      await fetchTasks(false);
    },
    [updateTask, fetchTasks]
  );

  const attachDeliverableAsset = useCallback(
    async (taskId: string, asset: DeliverableAsset) => {
      await updateTask(taskId, {
        deliverableAsset: asset,
        deliverableUrl: asset.url,
      });
    },
    [updateTask]
  );

  // Time Tracking Stopwatch
  const startTimeTracking = useCallback((taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id !== taskId) return t;
        const currentTotal = t.timeTracking?.totalSeconds || 0;
        return {
          ...t,
          timeTracking: {
            isRunning: true,
            startedAt: new Date().toISOString(),
            totalSeconds: currentTotal,
          },
        };
      })
    );
  }, []);

  const stopTimeTracking = useCallback(
    async (taskId: string) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task || !task.timeTracking?.isRunning) return;

      const started = task.timeTracking.startedAt
        ? new Date(task.timeTracking.startedAt).getTime()
        : Date.now();
      const elapsed = Math.round((Date.now() - started) / 1000);
      const newTotal = (task.timeTracking.totalSeconds || 0) + elapsed;
      const actualHours = Number((newTotal / 3600).toFixed(2));

      await updateTask(taskId, {
        timeTracking: {
          isRunning: false,
          startedAt: undefined,
          totalSeconds: newTotal,
        },
        actualHours,
      });
    },
    [tasks, updateTask]
  );

  const logManualHours = useCallback(
    async (taskId: string, hours: number) => {
      const task = tasks.find((t) => t.id === taskId);
      if (!task) return;
      const current = task.actualHours || 0;
      const updated = Number((current + hours).toFixed(2));
      const totalSec = Math.round(updated * 3600);
      await updateTask(taskId, {
        actualHours: updated,
        timeTracking: {
          isRunning: false,
          startedAt: undefined,
          totalSeconds: totalSec,
        },
      });
    },
    [tasks, updateTask]
  );

  // 7. Bulk Operations
  const toggleSelectTask = useCallback((taskId: string) => {
    setSelectedTaskIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  }, []);

  const clearSelectedTasks = useCallback(() => {
    setSelectedTaskIds([]);
  }, []);

  const selectTasks = useCallback((ids: string[], select: boolean) => {
    if (select) {
      setSelectedTaskIds((prev) => Array.from(new Set([...prev, ...ids])));
    } else {
      setSelectedTaskIds((prev) => prev.filter((id) => !ids.includes(id)));
    }
  }, []);

  const bulkReassign = useCallback(
    async (userId: string) => {
      if (selectedTaskIds.length === 0) return;
      const ids = [...selectedTaskIds];
      await Promise.all(ids.map((id) => updateTask(id, { assigneeId: userId })));
      clearSelectedTasks();
    },
    [selectedTaskIds, updateTask, clearSelectedTasks]
  );

  const bulkMoveStatus = useCallback(
    async (status: TaskStatus) => {
      if (selectedTaskIds.length === 0) return;
      const ids = [...selectedTaskIds];
      await Promise.all(ids.map((id) => updateTask(id, { status })));
      clearSelectedTasks();
    },
    [selectedTaskIds, updateTask, clearSelectedTasks]
  );

  const bulkReschedule = useCallback(
    async (dueDate: string) => {
      if (selectedTaskIds.length === 0) return;
      const ids = [...selectedTaskIds];
      await Promise.all(ids.map((id) => updateTask(id, { dueDate })));
      clearSelectedTasks();
    },
    [selectedTaskIds, updateTask, clearSelectedTasks]
  );

  const bulkDelete = useCallback(async () => {
    if (selectedTaskIds.length === 0) return;
    const ids = [...selectedTaskIds];
    setTasks((prev) => prev.filter((t) => !ids.includes(t.id)));
    clearSelectedTasks();
    if (selectedTaskId && ids.includes(selectedTaskId)) {
      setSelectedTaskId(null);
    }

    try {
      await Promise.all(
        ids.map((id) =>
          fetch(
            `/api/tasks?id=${encodeURIComponent(id)}&actorId=${encodeURIComponent(currentUserId)}`,
            { method: "DELETE" }
          )
        )
      );
    } catch (err) {
      console.error("bulkDelete error:", err);
    }
    fetchTasks(false);
  }, [selectedTaskIds, currentUserId, selectedTaskId, clearSelectedTasks, fetchTasks]);

  // Move all currently completed ("Done") tasks out of the active Overview (into Archived / Completed History)
  const archiveCompletedTasks = useCallback(async (): Promise<number> => {
    const completedIds = tasks
      .filter((t) => !t.isArchived && t.status === "completed")
      .map((t) => t.id);

    if (completedIds.length === 0) return 0;

    const nowIso = new Date().toISOString();
    setTasks((prev) =>
      prev.map((t) =>
        completedIds.includes(t.id)
          ? { ...t, isArchived: true, archivedAt: nowIso }
          : t
      )
    );
    setSelectedTaskIds((prev) => prev.filter((id) => !completedIds.includes(id)));
    if (selectedTaskId && completedIds.includes(selectedTaskId)) {
      setSelectedTaskId(null);
    }

    try {
      await Promise.all(
        completedIds.map((id) =>
          fetch(
            `/api/tasks?id=${encodeURIComponent(id)}&actorId=${encodeURIComponent(currentUserId)}`,
            { method: "DELETE" }
          )
        )
      );
    } catch (err) {
      console.error("archiveCompletedTasks error:", err);
    }
    return completedIds.length;
  }, [tasks, currentUserId, selectedTaskId]);

  // 8. Comments Engine (Persistent across reloads, mentions, reactions)
  const addComment = useCallback(
    async (taskId: string, content: string, mentions: string[] = []) => {
      if (!content.trim()) return;

      const optimisticComment: TaskComment = {
        id: `cm-${Date.now()}`,
        taskId,
        userId: currentUserId,
        userName: currentUser.name,
        userAvatar: currentUser.avatar,
        content: content.trim(),
        mentions,
        createdAt: new Date().toISOString(),
      };

      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t;
          return {
            ...t,
            comments: [...(t.comments || []), optimisticComment],
            updatedAt: new Date().toISOString(),
          };
        })
      );

      try {
        const res = await fetch(`/api/tasks/${taskId}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId: currentUserId,
            content: content.trim(),
            mentions,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.comment) {
            setTasks((prev) =>
              prev.map((t) => {
                if (t.id !== taskId) return t;
                return {
                  ...t,
                  comments: (t.comments || []).map((c) =>
                    c.id === optimisticComment.id ? data.comment : c
                  ),
                };
              })
            );
          }
        }
      } catch (err) {
        console.error("addComment network error:", err);
      }
    },
    [currentUserId, currentUser]
  );

  const deleteComment = useCallback(
    async (taskId: string, commentId: string) => {
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t;
          return {
            ...t,
            comments: (t.comments || []).filter((c) => c.id !== commentId),
          };
        })
      );

      try {
        await fetch(
          `/api/tasks/${taskId}/comments?commentId=${encodeURIComponent(commentId)}`,
          { method: "DELETE" }
        );
      } catch (err) {
        console.error("deleteComment error:", err);
      }
    },
    []
  );

  const toggleReaction = useCallback(
    async (taskId: string, commentId: string, emoji: string) => {
      if (!currentUserId || !emoji) return;

      // Optimistic toggle
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== taskId) return t;
          return {
            ...t,
            comments: (t.comments || []).map((c) => {
              if (c.id !== commentId) return c;
              const nextReactions: Record<string, string[]> = { ...(c.reactions || {}) };
              const usersForEmoji = Array.isArray(nextReactions[emoji])
                ? [...nextReactions[emoji]]
                : [];
              if (usersForEmoji.includes(currentUserId)) {
                const filtered = usersForEmoji.filter((id) => id !== currentUserId);
                if (filtered.length === 0) {
                  delete nextReactions[emoji];
                } else {
                  nextReactions[emoji] = filtered;
                }
              } else {
                nextReactions[emoji] = [...usersForEmoji, currentUserId];
              }
              return { ...c, reactions: nextReactions };
            }),
          };
        })
      );

      try {
        const res = await fetch(`/api/tasks/${taskId}/comments`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            commentId,
            userId: currentUserId,
            emoji,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.comment) {
            setTasks((prev) =>
              prev.map((t) => {
                if (t.id !== taskId) return t;
                return {
                  ...t,
                  comments: (t.comments || []).map((c) =>
                    c.id === commentId ? data.comment : c
                  ),
                };
              })
            );
          }
        }
      } catch (err) {
        console.error("toggleReaction error:", err);
      }
    },
    [currentUserId]
  );

  const saveWebhookSettings = useCallback(
    async (updates: Partial<WebhookConfig>): Promise<boolean> => {
      try {
        const res = await fetch("/api/webhooks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...updates,
            actorId: currentUserId,
          }),
        });
        if (!res.ok) return false;
        const data = await res.json();
        if (data.config) {
          setWebhookConfig(data.config);
        }
        return true;
      } catch (err) {
        console.error("saveWebhookSettings error:", err);
        return false;
      }
    },
    [currentUserId]
  );

  const testWebhookEndpoint = useCallback(
    async (overrideUrl?: string) => {
      try {
        const res = await fetch("/api/webhooks", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: overrideUrl,
            actorName: currentUser.name,
          }),
        });
        const data = await res.json();
        if (data.config) {
          setWebhookConfig(data.config);
        }
        return {
          ok: Boolean(data.ok),
          status: data.status,
          latencyMs: data.latencyMs || 0,
          error: data.error,
        };
      } catch (err: any) {
        return {
          ok: false,
          latencyMs: 0,
          error: err?.message || "Failed to test webhook",
        };
      }
    },
    [currentUser]
  );

  const getTaskAuditLogs = useCallback(
    (taskId: string) => {
      return auditLogs.filter((log) => log.targetId === taskId);
    },
    [auditLogs]
  );

  // Auto Delegator Actions
  const saveDelegatorRule = useCallback(
    async (rule: Partial<DailyTaskRule>): Promise<boolean> => {
      try {
        const res = await fetch("/api/delegator", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...rule,
            createdBy: currentUserId,
          }),
        });
        if (!res.ok) throw new Error("Failed to save delegator rule");
        await fetchDelegatorRules();
        return true;
      } catch (err) {
        console.error("saveDelegatorRule error:", err);
        return false;
      }
    },
    [currentUserId, fetchDelegatorRules]
  );

  const deleteDelegatorRule = useCallback(
    async (ruleId: string): Promise<boolean> => {
      try {
        const res = await fetch(`/api/delegator?id=${encodeURIComponent(ruleId)}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Failed to delete rule");
        setDelegatorRules((prev) => prev.filter((r) => r.id !== ruleId));
        return true;
      } catch (err) {
        console.error("deleteDelegatorRule error:", err);
        return false;
      }
    },
    []
  );

  const toggleDelegatorRule = useCallback(
    async (ruleId: string, active: boolean): Promise<boolean> => {
      const rule = delegatorRules.find((r) => r.id === ruleId);
      if (!rule) return false;

      setDelegatorRules((prev) =>
        prev.map((r) => (r.id === ruleId ? { ...r, active } : r))
      );

      try {
        const res = await fetch("/api/delegator", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: ruleId,
            userId: rule.userId,
            taskName: rule.taskName,
            targetQuantity: rule.targetQuantity,
            active,
            startsOn: rule.startsOn,
            endsOn: rule.endsOn,
            notes: rule.notes,
          }),
        });
        if (!res.ok) throw new Error("Failed to toggle rule");
        return true;
      } catch (err) {
        console.error("toggleDelegatorRule error:", err);
        await fetchDelegatorRules();
        return false;
      }
    },
    [delegatorRules, fetchDelegatorRules]
  );

  const materializeDelegatorNow = useCallback(async (): Promise<boolean> => {
    try {
      setIsSyncing(true);
      const res = await fetch("/api/delegator/materialize", { method: "POST" });
      if (!res.ok) throw new Error("Materialize failed");
      await fetchTasks(false);
      return true;
    } catch (err) {
      console.error("materializeDelegatorNow error:", err);
      return false;
    } finally {
      setIsSyncing(false);
    }
  }, [fetchTasks]);

  // CSV Export & Import
  const exportTasksToCSV = useCallback(() => {
    if (tasks.length === 0) {
      alert("No tasks available to export.");
      return;
    }
    const headers = [
      "Task Number",
      "Title",
      "Status",
      "Priority",
      "Assignee",
      "Department",
      "Target Units",
      "Completed Units",
      "Due Date",
      "Deliverable URL",
      "Actual Hours",
      "Created At",
    ];

    const rows = tasks.map((t) => {
      const assignee = users.find((u) => u.id === t.assigneeId);
      return [
        t.taskNumber,
        `"${(t.title || "").replace(/"/g, '""')}"`,
        t.status,
        t.priority,
        `"${assignee?.name || "Unassigned"}"`,
        `"${t.project || "Operations"}"`,
        t.targetQuantity || 1,
        t.completedQuantity || 0,
        t.dueDate,
        `"${t.deliverableUrl || ""}"`,
        t.actualHours || 0,
        t.createdAt,
      ].join(",");
    });

    const csvContent =
      "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute(
      "download",
      `satmi_tasks_export_${dateInTargetTimeZone()}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [tasks, users]);

  const importTasksFromCSV = useCallback(
    async (importedTasks: Partial<Task>[]) => {
      for (const t of importedTasks) {
        if (!t.title) continue;
        await createTask({
          title: t.title,
          description: t.description || "",
          priority: t.priority || "medium",
          status: t.status || "todo",
          assigneeId: t.assigneeId || currentUserId,
          dueDate: t.dueDate || dateInTargetTimeZone(),
          targetQuantity: t.targetQuantity || 1,
          deliverableUrl: t.deliverableUrl,
          project: t.project,
        });
      }
    },
    [createTask, currentUserId]
  );

  const refreshAll = useCallback(async () => {
    await Promise.all([fetchTasks(true), fetchDelegatorRules(), fetchNotifications(), fetchTemplates()]);
  }, [fetchTasks, fetchDelegatorRules, fetchNotifications, fetchTemplates]);

  // Role & User Template Actions
  const createRoleTemplate = useCallback(
    async (data: Omit<RoleTemplate, "id" | "createdAt" | "updatedAt">): Promise<RoleTemplate | null> => {
      try {
        const res = await fetch("/api/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!res.ok) throw new Error("Failed to create template");
        const json = await res.json();
        if (json.template) {
          setTemplates((prev) => [json.template, ...prev]);
          return json.template;
        }
      } catch (err) {
        console.error("createRoleTemplate error:", err);
      }
      return null;
    },
    []
  );

  const updateRoleTemplate = useCallback(
    async (id: string, updates: Partial<RoleTemplate>): Promise<RoleTemplate | null> => {
      try {
        const res = await fetch("/api/templates", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, ...updates }),
        });
        if (!res.ok) throw new Error("Failed to update template");
        const json = await res.json();
        if (json.template) {
          setTemplates((prev) => prev.map((t) => (t.id === id ? json.template : t)));
          return json.template;
        }
      } catch (err) {
        console.error("updateRoleTemplate error:", err);
      }
      return null;
    },
    []
  );

  const deleteRoleTemplate = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        const res = await fetch(`/api/templates?id=${encodeURIComponent(id)}`, {
          method: "DELETE",
        });
        if (!res.ok) throw new Error("Failed to delete template");
        setTemplates((prev) => prev.filter((t) => t.id !== id));
        if (activeTemplateId === id) {
          setActiveTemplateId(null);
        }
        return true;
      } catch (err) {
        console.error("deleteRoleTemplate error:", err);
        return false;
      }
    },
    [activeTemplateId, setActiveTemplateId]
  );

  const applyTemplateToUser = useCallback(
    async (templateId: string, userId: string, targetDate?: string) => {
      const tpl = templates.find((t) => t.id === templateId);
      if (!tpl) return;
      const dueDate = targetDate || dateInTargetTimeZone();

      for (const parentCol of tpl.parentColumns) {
        for (const subCol of parentCol.subColumns) {
          await createTask({
            title: `${subCol.label}`,
            description: subCol.description || `Instantiated from template: ${tpl.name}`,
            status: parentCol.id,
            priority: "medium",
            assigneeId: userId,
            dueDate,
            targetQuantity: subCol.defaultTargetQuantity || 1,
            subColumnId: subCol.id,
            parentColumnId: parentCol.id,
            templateRole: tpl.role !== "general" ? tpl.role : undefined,
            customSubtasks: subCol.defaultChecklist?.map((item, idx) => ({
              id: `sub-init-${Date.now()}-${idx}`,
              title: item,
              completed: false,
              assignedTo: userId,
              sortOrder: idx + 1,
              isCustom: true,
            })),
          });
        }
      }
      await fetchTasks(false);
    },
    [templates, createTask, fetchTasks]
  );

  const reassignTask = useCallback(
    async (taskId: string, targetUserId: string, extraUpdates?: Partial<Task>) => {
      await updateTask(taskId, {
        assigneeId: targetUserId,
        ...extraUpdates,
      });
    },
    [updateTask]
  );

  // Enhanced Filtered Tasks (Supports Search, Members, Status, Priority, Presets, Date Ranges, and Daily Production Done Roll-Off)
  const filteredTasks = useMemo(() => {
    const today = dateInTargetTimeZone();
    const todayDate = new Date(today);
    const hasCustomDateRange = Boolean(filter.dateFrom || filter.dateTo);
    const hasExplicitDateFilter =
      hasCustomDateRange || (filter.datePreset && filter.datePreset !== "all");

    return baseVisibleTasks.filter((task) => {
      // 0. Daily Production "Done" Tab Overload Protection:
      // If viewing Completed History specifically, only show completed tasks.
      if (filter.showCompletedHistory) {
        if (task.status !== "completed") return false;
      } else if (
        !filter.showArchived &&
        filter.status !== "completed" &&
        !hasExplicitDateFilter &&
        task.status === "completed"
      ) {
        // Automatically move past-day completed tasks out of the active daily Overview
        // so the Done column only holds today's completed production items!
        const completedDateStr = task.completedAt ? task.completedAt.slice(0, 10) : task.dueDate;
        if (task.dueDate < today && completedDateStr < today) {
          return false;
        }
      }

      // 1. Text Search
      if (filter.search.trim()) {
        const q = filter.search.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(q);
        const matchesDesc = task.description?.toLowerCase().includes(q);
        const matchesNum = task.taskNumber.toLowerCase().includes(q);
        const matchesTags = task.tags?.some((tag) => tag.toLowerCase().includes(q));
        if (!matchesTitle && !matchesDesc && !matchesNum && !matchesTags) {
          return false;
        }
      }

      // 2. Saved Filter Presets
      if (filter.savedPreset && filter.savedPreset !== "all") {
        if (filter.savedPreset === "pending_review" && task.status !== "in_review") {
          return false;
        }
        if (
          filter.savedPreset === "overdue_carried" &&
          !(
            (task.dueDate < today || task.isCarried) &&
            task.status !== "completed"
          )
        ) {
          return false;
        }
        if (
          filter.savedPreset === "high_urgent" &&
          task.priority !== "urgent" &&
          task.priority !== "high"
        ) {
          return false;
        }
        if (
          filter.savedPreset === "my_active" &&
          (task.assigneeId !== currentUserId || task.status === "completed")
        ) {
          return false;
        }
      }

      // 3. Custom Date Range Picker (dateFrom / dateTo)
      if (filter.dateFrom && task.dueDate < filter.dateFrom) {
        return false;
      }
      if (filter.dateTo && task.dueDate > filter.dateTo) {
        return false;
      }

      // 4. Date Presets
      if (filter.datePreset && filter.datePreset !== "all" && filter.datePreset !== "custom") {
        if (filter.datePreset === "today" && task.dueDate !== today) {
          return false;
        }
        if (filter.datePreset === "overdue") {
          if (!(task.dueDate < today && task.status !== "completed")) {
            return false;
          }
        }
        if (filter.datePreset === "yesterday") {
          const y = new Date(todayDate);
          y.setDate(y.getDate() - 1);
          const yStr = y.toISOString().slice(0, 10);
          if (task.dueDate !== yStr) return false;
        }
        if (filter.datePreset === "this_week") {
          const dayOfWeek = todayDate.getDay();
          const startOfWeek = new Date(todayDate);
          startOfWeek.setDate(todayDate.getDate() - dayOfWeek);
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6);
          const startStr = startOfWeek.toISOString().slice(0, 10);
          const endStr = endOfWeek.toISOString().slice(0, 10);
          if (task.dueDate < startStr || task.dueDate > endStr) return false;
        }
        if (filter.datePreset === "next_7_days") {
          const future = new Date(todayDate);
          future.setDate(future.getDate() + 7);
          const futureStr = future.toISOString().slice(0, 10);
          if (task.dueDate < today || task.dueDate > futureStr) return false;
        }
      }

      // 5. Assigned to me toggle
      if (filter.onlyMyTasks && task.assigneeId !== currentUserId) {
        return false;
      }

      // 6. Explicit dropdowns
      if (filter.assigneeId !== "all" && task.assigneeId !== filter.assigneeId) {
        return false;
      }

      if (filter.status !== "all" && task.status !== filter.status) {
        return false;
      }

      if (filter.priority !== "all" && task.priority !== filter.priority) {
        return false;
      }

      if (filter.project !== "all" && task.project !== filter.project) {
        return false;
      }

      return true;
    });
  }, [baseVisibleTasks, filter, currentUserId]);

  const selectAllFilteredTasks = useCallback(
    (select: boolean) => {
      if (select) {
        setSelectedTaskIds(filteredTasks.map((t) => t.id));
      } else {
        setSelectedTaskIds([]);
      }
    },
    [filteredTasks]
  );

  const syncPendingChangesToLive = useCallback(async () => {
    await replayOfflineQueue();
    await refreshAll();
  }, [replayOfflineQueue, refreshAll]);

  return (
    <TaskContext.Provider
      value={{
        tasks,
        baseVisibleTasks,
        users,
        currentUser,
        currentUserId,
        isAdmin,
        isManager,
        isDeveloper,
        isManagerOrAdmin,
        isAdminOrDeveloper,
        soundMuted,
        setSoundMuted,
        toggleSound,
        playNotificationSound,
        activeSection,
        setActiveSection,
        viewMode,
        setViewMode,
        boardLayout,
        setBoardLayout,
        density,
        setDensity,
        filter,
        setFilter,
        resetFilter,
        filteredTasks,
        selectedTaskId,
        setSelectedTaskId,
        isCreateModalOpen,
        setIsCreateModalOpen,
        createModalAssigneeId,
        createModalStatus,
        openCreateModal,
        isShortcutsModalOpen,
        setIsShortcutsModalOpen,
        isAutoDelegatorOpen,
        setIsAutoDelegatorOpen,
        isCommandPaletteOpen,
        setIsCommandPaletteOpen,
        isSettingsModalOpen,
        setIsSettingsModalOpen,
        isAdsManagementConnected,
        workspaceSettings,
        isWorkspaceSettingsLoading,
        saveWorkspaceSettings,
        adsSyncMode,
        setAdsSyncMode,
        enforceCanonicalLock,
        setEnforceCanonicalLock,
        autoMaterializeRulesOnSync,
        setAutoMaterializeRulesOnSync,
        testAdsConnection,
        pendingOfflineChangesCount,
        offlineQueue,
        clearPendingOfflineChanges,
        syncPendingChangesToLive,
        webhookConfig,
        saveWebhookSettings,
        testWebhookEndpoint,
        adflowStageMapping,
        saveAdflowStageMapping,
        resetAdflowStageMapping,
        isAuthenticated,
        isAuthLoading,
        login,
        logout,
        updateUserCapacity,
        createUser,
        updateUserColor,
        updateUser,
        deleteUser,
        createTask,
        updateTask,
        deleteTask,
        restoreTask,
        toggleSubtask,
        addSubtask,
        removeSubtask,
        reorderSubtasks,
        updateTaskProgress,
        addComment,
        deleteComment,
        toggleReaction,
        approveTask,
        requestRevision,
        submitForReview,
        attachDeliverableAsset,
        startTimeTracking,
        stopTimeTracking,
        logManualHours,
        isTaskBlocked,
        getMemberCapacity,
        selectedTaskIds,
        toggleSelectTask,
        selectAllFilteredTasks,
        selectTasks,
        clearSelectedTasks,
        bulkReassign,
        bulkMoveStatus,
        bulkReschedule,
        bulkDelete,
        archiveCompletedTasks,
        notifications,
        unreadNotificationsCount,
        fetchNotifications,
        markNotificationAsRead,
        markAllNotificationsAsRead,
        deleteNotification,
        delegatorRules,
        fetchDelegatorRules,
        saveDelegatorRule,
        deleteDelegatorRule,
        toggleDelegatorRule,
        materializeDelegatorNow,
        auditLogs,
        getTaskAuditLogs,
        exportTasksToCSV,
        importTasksFromCSV,
        refreshAll,
        isSyncing,
        lastSyncedAt,
        // Role & User Templates
        templates,
        activeTemplateId,
        setActiveTemplateId,
        isRoleTemplateModalOpen,
        setIsRoleTemplateModalOpen,
        fetchTemplates,
        createRoleTemplate,
        updateRoleTemplate,
        deleteRoleTemplate,
        applyTemplateToUser,
        reassignTask,
      }}
    >
      {children}
    </TaskContext.Provider>
  );
}

export function useTasks() {
  const context = useContext(TaskContext);
  if (!context) {
    throw new Error("useTasks must be used within a TaskProvider");
  }
  return context;
}

export const useTaskStore = useTasks;

