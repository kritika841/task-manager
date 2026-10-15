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
} from "./types";
import { supabase, dateInTargetTimeZone, isCanonicalAdflowTask } from "./supabase";

interface TaskContextType {
  tasks: Task[];
  users: User[];
  currentUser: User;
  currentUserId: string;
  isAdmin: boolean;
  isManager: boolean;
  isManagerOrAdmin: boolean;
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
  switchUser: (userId: string) => void;
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
  // Approval Workflow
  approveTask: (taskId: string) => Promise<void>;
  requestRevision: (taskId: string, reason: string, notes?: string) => Promise<void>;
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
  setIsAdsManagementConnected: (connected: boolean) => void;
  toggleAdsManagementConnection: () => void;
  adsSyncMode: AdsSyncMode;
  setAdsSyncMode: (mode: AdsSyncMode) => void;
  enforceCanonicalLock: boolean;
  setEnforceCanonicalLock: (enforce: boolean) => void;
  autoMaterializeRulesOnSync: boolean;
  setAutoMaterializeRulesOnSync: (auto: boolean) => void;
  testAdsConnection: () => Promise<{ ok: boolean; latencyMs: number; message: string }>;
  pendingOfflineChangesCount: number;
  clearPendingOfflineChanges: () => void;
  syncPendingChangesToLive: () => Promise<void>;
}

const defaultFilter: FilterState = {
  search: "",
  assigneeId: "all",
  status: "all",
  priority: "all",
  project: "all",
  onlyMyTasks: false,
  showArchived: false,
  showAdflowTasks: false, // Default is OFF per user instruction
  datePreset: "all",
  savedPreset: "all",
};

const TaskContext = createContext<TaskContextType | undefined>(undefined);

const STORAGE_KEY_USER = "satmi-current-user-id-v2";
const STORAGE_KEY_LAYOUT = "satmi-board-layout-v1";
const STORAGE_KEY_DENSITY = "satmi-view-density-v1";
const STORAGE_KEY_ADS_CONNECTED = "satmi-ads-mgmt-connected-v2";
const STORAGE_KEY_ADS_SYNC_MODE = "satmi-ads-sync-mode-v1";
const STORAGE_KEY_ENFORCE_LOCK = "satmi-ads-enforce-lock-v1";
const STORAGE_KEY_AUTO_RULES = "satmi-ads-auto-rules-v1";
const STORAGE_KEY_OFFLINE_CHANGES = "satmi-ads-offline-changes-v1";

export function isTaskAdflow(task: Task): boolean {
  return Boolean(
    task.adId ||
    task.id.startsWith("ad-") ||
    task.tags?.includes("AdFlow") ||
    task.tags?.includes("Active Creative") ||
    task.isCanonicalAdflowTask ||
    isCanonicalAdflowTask(task.title) ||
    (task.title && /^(Raw clip generation|Ad video edits|Social media edits|Script writing|Video shoots)/i.test(task.title)) ||
    (task.tags && task.tags.includes("Video Ads"))
  );
}

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string>("");
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isAuthLoading, setIsAuthLoading] = useState<boolean>(true);
  const [viewMode, setViewMode] = useState<ViewMode>("board");
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
  const [isAdsManagementConnected, setIsAdsManagementConnectedState] = useState<boolean>(true);
  const [adsSyncMode, setAdsSyncModeState] = useState<AdsSyncMode>("realtime");
  const [enforceCanonicalLock, setEnforceCanonicalLockState] = useState<boolean>(true);
  const [autoMaterializeRulesOnSync, setAutoMaterializeRulesOnSyncState] = useState<boolean>(true);
  const [pendingOfflineChangesCount, setPendingOfflineChangesCount] = useState<number>(0);

  // Keep ref of selectedTaskId to prevent overwriting active editing
  const selectedTaskIdRef = useRef<string | null>(null);
  useEffect(() => {
    selectedTaskIdRef.current = selectedTaskId;
  }, [selectedTaskId]);

  // Base visible tasks in current workspace mode (respects showArchived and showAdflowTasks)
  const baseVisibleTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (!filter.showArchived && task.isArchived) return false;
      if (filter.showArchived && !task.isArchived) return false;
      if (!filter.showAdflowTasks && isTaskAdflow(task)) return false;
      return true;
    });
  }, [tasks, filter.showArchived, filter.showAdflowTasks]);

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

  // Initialize board layout and density from storage
  useEffect(() => {
    try {
      const savedLayout = localStorage.getItem(STORAGE_KEY_LAYOUT) as BoardLayout;
      if (savedLayout === "columns" || savedLayout === "swimlanes") {
        setBoardLayoutState(savedLayout);
      }
      const savedDensity = localStorage.getItem(STORAGE_KEY_DENSITY) as DensityMode;
      if (savedDensity === "comfortable" || savedDensity === "compact") {
        setDensityState(savedDensity);
      }
      const savedConnected = localStorage.getItem(STORAGE_KEY_ADS_CONNECTED);
      if (savedConnected !== null) {
        setIsAdsManagementConnectedState(savedConnected === "true");
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
      const savedPending = localStorage.getItem(STORAGE_KEY_OFFLINE_CHANGES);
      if (savedPending) {
        setPendingOfflineChangesCount(Number(savedPending) || 0);
      }
    } catch {}
  }, []);

  const recordOfflineChange = useCallback(() => {
    setPendingOfflineChangesCount((prev) => {
      const next = prev + 1;
      try {
        localStorage.setItem(STORAGE_KEY_OFFLINE_CHANGES, String(next));
      } catch {}
      return next;
    });
  }, []);

  const clearPendingOfflineChanges = useCallback(() => {
    setPendingOfflineChangesCount(0);
    try {
      localStorage.removeItem(STORAGE_KEY_OFFLINE_CHANGES);
    } catch {}
  }, []);

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
        setUsers(data.users);
      }

      if (data.tasks && Array.isArray(data.tasks)) {
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

  // Initial load
  useEffect(() => {
    fetchTasks(true);
    fetchDelegatorRules();
  }, [fetchTasks, fetchDelegatorRules]);

  useEffect(() => {
    if (currentUserId) {
      fetchNotifications();
    }
  }, [currentUserId, fetchNotifications]);

  // Authenticate user session with Supabase Auth & persistent session
  useEffect(() => {
    async function checkAuthSession() {
      try {
        setIsAuthLoading(true);

        // 1. Check Supabase auth session
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user?.email) {
          const userEmail = session.user.email.toLowerCase();
          const matched = users.find((u) => u.email.toLowerCase() === userEmail);
          if (matched && matched.active !== false && !matched.deletedAt) {
            setCurrentUserId(matched.id);
            setIsAuthenticated(true);
            setIsAuthLoading(false);
            return;
          }
        }

        // 2. Check stored authenticated profile
        const storedUser = localStorage.getItem("satmi-auth-user");
        if (storedUser) {
          try {
            const parsed = JSON.parse(storedUser);
            if (parsed?.id) {
              const matched = users.find((u) => u.id === parsed.id);
              if (matched && matched.active !== false && !matched.deletedAt) {
                setCurrentUserId(matched.id);
                setIsAuthenticated(true);
                setIsAuthLoading(false);
                return;
              }
            }
          } catch {}
        }

        // 3. Auto-authenticate workspace admin (Kritika) if no explicit logout
        const explicitLogout = localStorage.getItem("satmi-explicit-logout");
        if (!explicitLogout) {
          const defaultAdmin =
            users.find(
              (u) =>
                (u.email.toLowerCase() === "kritika@satmi.in" ||
                  u.email.toLowerCase() === "smvkritika@gmail.com") &&
                u.active !== false &&
                !u.deletedAt
            ) ||
            users.find((u) => u.role === "admin" && u.active !== false && !u.deletedAt) ||
            users[0];

          if (defaultAdmin) {
            setCurrentUserId(defaultAdmin.id);
            setIsAuthenticated(true);
            try {
              localStorage.setItem("satmi-auth-user", JSON.stringify(defaultAdmin));
              localStorage.setItem(STORAGE_KEY_USER, defaultAdmin.id);
            } catch {}
            setIsAuthLoading(false);
            return;
          }
        }

        // No active verified session
        setIsAuthenticated(false);
      } catch (err) {
        console.error("Auth session check error:", err);
        setIsAuthenticated(false);
      } finally {
        setIsAuthLoading(false);
      }
    }

    if (users.length > 0) {
      checkAuthSession();
    }
  }, [users]);

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
          try {
            localStorage.setItem("satmi-auth-user", JSON.stringify(data.user));
            localStorage.setItem(STORAGE_KEY_USER, data.user.id);
            localStorage.removeItem("satmi-explicit-logout");
          } catch {}
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
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("Sign out error:", err);
    }
    try {
      localStorage.removeItem("satmi-auth-user");
      localStorage.removeItem(STORAGE_KEY_USER);
      localStorage.setItem("satmi-explicit-logout", "true");
    } catch {}
    setCurrentUserId("");
    setIsAuthenticated(false);
  }, []);

  const switchUser = useCallback((userId: string) => {
    setCurrentUserId(userId);
    try {
      localStorage.setItem(STORAGE_KEY_USER, userId);
    } catch {}
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

  const updateUserColor = useCallback(async (userId: string, color: string) => {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, color } : u)));
    try {
      await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId, color }),
      });
    } catch (err) {
      console.error("updateUserColor error:", err);
    }
  }, []);

  const updateUser = useCallback(async (userId: string, updates: Partial<User>) => {
    setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, ...updates } : u)));
    try {
      await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId, ...updates }),
      });
    } catch (err) {
      console.error("updateUser error:", err);
    }
  }, []);

  const deleteUser = useCallback(async (userId: string) => {
    setUsers((prev) => prev.filter((u) => u.id !== userId));
    try {
      const res = await fetch(`/api/users?id=${encodeURIComponent(userId)}`, {
        method: "DELETE",
      });
      return res.ok;
    } catch (err) {
      console.error("deleteUser error:", err);
      return false;
    }
  }, []);

  const updateUserCapacity = useCallback(async (userId: string, units: number) => {
    const validUnits = Math.max(1, Math.min(24, Math.round(units)));
    setUsers((prev) =>
      prev.map((u) => (u.id === userId ? { ...u, dailyCapacityUnits: validUnits } : u))
    );
    try {
      await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId, dailyCapacityUnits: validUnits }),
      });
    } catch (err) {
      console.error("updateUserCapacity error:", err);
    }
  }, []);

  const setIsAdsManagementConnected = useCallback((connected: boolean) => {
    setIsAdsManagementConnectedState(connected);
    try {
      localStorage.setItem(STORAGE_KEY_ADS_CONNECTED, String(connected));
    } catch {}
    if (connected) {
      fetchTasks(true);
      fetchDelegatorRules();
    }
  }, [fetchTasks, fetchDelegatorRules]);

  const toggleAdsManagementConnection = useCallback(() => {
    setIsAdsManagementConnectedState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(STORAGE_KEY_ADS_CONNECTED, String(next));
      } catch {}
      if (next) {
        fetchTasks(true);
        fetchDelegatorRules();
      }
      return next;
    });
  }, [fetchTasks, fetchDelegatorRules]);

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

  // Realtime Supabase Channel + Safe Fallback Heartbeat (only when Ads Management is Connected)
  useEffect(() => {
    if (!isAdsManagementConnected) {
      return;
    }

    if (adsSyncMode === "manual") {
      return;
    }

    const channel = supabase
      .channel("task-manager-live-sync-v3")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "daily_team_targets" },
        () => {
          fetchTasks(false);
          fetchNotifications();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        () => {
          fetchNotifications();
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "daily_task_rules" },
        () => {
          fetchDelegatorRules();
          fetchTasks(false);
        }
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "audit_logs" },
        () => {
          fetchTasks(false);
        }
      )
      .subscribe();

    // 60-second fallback heartbeat (only runs if tab is active and ads connection is active)
    let interval: NodeJS.Timeout | null = null;
    if (adsSyncMode === "realtime" || adsSyncMode === "interval") {
      interval = setInterval(() => {
        if (typeof document !== "undefined" && !document.hidden) {
          fetchTasks(false);
          fetchNotifications();
        }
      }, 60000);
    }

    return () => {
      supabase.removeChannel(channel);
      if (interval) clearInterval(interval);
    };
  }, [isAdsManagementConnected, adsSyncMode, fetchTasks, fetchDelegatorRules, fetchNotifications]);

  const currentUser = useMemo(() => {
    return (
      users.find((u) => u.id === currentUserId) ||
      users[0] || {
        id: "default",
        name: "Loading...",
        email: "user@satmi.in",
        role: "admin",
        avatar: "US",
        department: "Operations",
        dailyCapacityUnits: 6,
      }
    );
  }, [users, currentUserId]);

  const isAdmin = currentUser.role === "admin";
  const isManager = currentUser.role === "manager";
  const isManagerOrAdmin = isAdmin || isManager;

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
    }): Promise<Task | null> => {
      const today = dateInTargetTimeZone();
      const targetQty = Math.max(1, Number(data.targetQuantity) || 1);
      const tempId = `temp-${Date.now()}`;
      const assignee = users.find((u) => u.id === data.assigneeId);

      const optimisticTask: Task = {
        id: tempId,
        taskNumber: `DT-${tempId.slice(-4).toUpperCase()}`,
        title: data.title.trim(),
        description: data.description || "",
        status: data.status || "todo",
        priority: data.priority || "medium",
        assigneeId: data.assigneeId || currentUserId,
        creatorId: currentUserId,
        dueDate: data.dueDate || today,
        targetQuantity: targetQty,
        completedQuantity: data.status === "completed" ? targetQty : 0,
        manualCompletedQuantity: data.status === "completed" ? targetQty : 0,
        autoCompletedQuantity: 0,
        subtasks:
          data.customSubtasks && data.customSubtasks.length > 0
            ? data.customSubtasks
            : Array.from({ length: targetQty }, (_, i) => ({
                id: `sub-${tempId}-${i + 1}`,
                title: `Unit ${i + 1} of ${data.title.trim()}`,
                completed: data.status === "completed",
                isCustom: false,
              })),
        customSubtasks: data.customSubtasks || [],
        project: data.project || assignee?.department || "Operations",
        tags: data.tags || ["Daily Target"],
        deliverableUrl: data.deliverableUrl || data.deliverableAsset?.url,
        deliverableAsset: data.deliverableAsset,
        blockedByTaskIds: data.blockedByTaskIds || [],
        startDate: data.startDate,
        dueTime: data.dueTime,
        estimatedHours: data.estimatedHours,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        comments: [],
      };

      setTasks((prev) => [optimisticTask, ...prev]);

      // If disconnected from Ads Management, keep change locally and do not push to remote database
      if (!isAdsManagementConnected) {
        recordOfflineChange();
        return optimisticTask;
      }

      try {
        const res = await fetch("/api/tasks", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: data.title,
            description: data.description,
            priority: data.priority,
            status: data.status,
            assigneeId: data.assigneeId,
            creatorId: currentUserId,
            dueDate: data.dueDate,
            targetQuantity: targetQty,
            deliverableUrl: data.deliverableUrl || data.deliverableAsset?.url,
            deliverableAsset: data.deliverableAsset,
            blockedByTaskIds: data.blockedByTaskIds,
            customSubtasks: data.customSubtasks,
            startDate: data.startDate,
            dueTime: data.dueTime,
            estimatedHours: data.estimatedHours,
          }),
        });

        if (!res.ok) throw new Error("Failed to create task");
        const json = await res.json();

        // Refresh to pick up real generated ID and DB timestamps
        await fetchTasks(false);
        return json.target;
      } catch (err) {
        console.error("createTask error:", err);
        setTasks((prev) => prev.filter((t) => t.id !== tempId));
        return null;
      }
    },
    [currentUserId, users, fetchTasks]
  );

  // 2. Update Task
  const updateTask = useCallback(
    async (taskId: string, updates: Partial<Task>) => {
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

          finalCompletedQuantity = nextCompleted;

          const targetQty = updates.targetQuantity ?? t.targetQuantity;
          const updatedSubtasks =
            updates.subtasks ??
            t.subtasks.map((st, i) => ({
              ...st,
              completed: i < nextCompleted,
              completedAt: i < nextCompleted ? new Date().toISOString() : undefined,
            }));

          const updatedAssignee = updates.assigneeId
            ? users.find((u) => u.id === updates.assigneeId)
            : undefined;

          // If canonical Adflow pipeline task, lock title against renaming
          const safeUpdates = { ...updates };
          if (isStandardAdflow && safeUpdates.title) {
            delete safeUpdates.title;
          }

          return {
            ...t,
            ...safeUpdates,
            completedQuantity: nextCompleted,
            subtasks: updatedSubtasks,
            project: updatedAssignee ? updatedAssignee.department : t.project,
            updatedAt: new Date().toISOString(),
          };
        })
      );

      // Async backend call
      if (!isAdsManagementConnected) {
        recordOfflineChange();
        return;
      }

      try {
        const target = tasks.find((t) => t.id === taskId);
        const isStandard = target ? isCanonicalAdflowTask(target.title) : false;

        await fetch("/api/tasks", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: taskId,
            actorId: currentUserId,
            status: updates.status,
            completedQuantity: finalCompletedQuantity,
            targetQuantity: updates.targetQuantity,
            assigneeId: updates.assigneeId,
            dueDate: updates.dueDate,
            title: isStandard ? undefined : updates.title,
            description: updates.description,
            deliverableUrl: updates.deliverableUrl,
            deliverableAsset: updates.deliverableAsset,
            isRevisionRequested: updates.isRevisionRequested,
            revisionReason: updates.revisionReason,
            revisionNotes: updates.revisionNotes,
            blockedByTaskIds: updates.blockedByTaskIds,
            customSubtasks: updates.customSubtasks,
            startDate: updates.startDate,
            dueTime: updates.dueTime,
            estimatedHours: updates.estimatedHours,
            actualHours: updates.actualHours,
            timeTracking: updates.timeTracking,
          }),
        });
      } catch (err) {
        console.error("updateTask sync error:", err);
      }
    },
    [currentUserId, users, tasks]
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

      if (!isAdsManagementConnected) {
        recordOfflineChange();
        return;
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

      if (!isAdsManagementConnected) {
        recordOfflineChange();
        return;
      }

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

          return {
            ...t,
            subtasks: updatedSubtasks,
            customSubtasks: nextCustomSubtasks.length > 0 ? nextCustomSubtasks : t.customSubtasks,
            completedQuantity: nextCompletedCount,
            status: nextStatus,
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

          return {
            ...t,
            completedQuantity: cleanCount,
            subtasks: updatedSubtasks,
            status: nextStatus,
            updatedAt: new Date().toISOString(),
          };
        })
      );

      if (!isAdsManagementConnected) {
        recordOfflineChange();
        return;
      }

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
        isRevisionRequested: false,
        revisionReason: undefined,
        revisionNotes: undefined,
        completedQuantity: task.targetQuantity,
      });
    },
    [tasks, updateTask]
  );

  const requestRevision = useCallback(
    async (taskId: string, reason: string, notes?: string) => {
      await updateTask(taskId, {
        status: "in_progress",
        isRevisionRequested: true,
        revisionReason: reason,
        revisionNotes: notes,
      });
    },
    [updateTask]
  );

  const submitForReview = useCallback(
    async (taskId: string, deliverableUrl: string, asset?: DeliverableAsset) => {
      await updateTask(taskId, {
        status: "in_review",
        deliverableUrl,
        deliverableAsset: asset,
      });
    },
    [updateTask]
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
    await Promise.all([fetchTasks(true), fetchDelegatorRules(), fetchNotifications()]);
  }, [fetchTasks, fetchDelegatorRules, fetchNotifications]);

  // Enhanced Filtered Tasks (Supports Search, Members, Status, Priority, Presets, and Date Ranges)
  const filteredTasks = useMemo(() => {
    const today = dateInTargetTimeZone();
    const todayDate = new Date(today);

    return baseVisibleTasks.filter((task) => {

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

      // 3. Date Presets
      if (filter.datePreset && filter.datePreset !== "all") {
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
        if (filter.datePreset === "next_7_days") {
          const future = new Date(todayDate);
          future.setDate(future.getDate() + 7);
          const futureStr = future.toISOString().slice(0, 10);
          if (task.dueDate < today || task.dueDate > futureStr) return false;
        }
      }

      // 4. Assigned to me toggle
      if (filter.onlyMyTasks && task.assigneeId !== currentUserId) {
        return false;
      }

      // 5. Explicit dropdowns
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
    await refreshAll();
    clearPendingOfflineChanges();
  }, [refreshAll, clearPendingOfflineChanges]);

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
        isManagerOrAdmin,
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
        setIsAdsManagementConnected,
        toggleAdsManagementConnection,
        adsSyncMode,
        setAdsSyncMode,
        enforceCanonicalLock,
        setEnforceCanonicalLock,
        autoMaterializeRulesOnSync,
        setAutoMaterializeRulesOnSync,
        testAdsConnection,
        pendingOfflineChangesCount,
        clearPendingOfflineChanges,
        syncPendingChangesToLive,
        switchUser,
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
