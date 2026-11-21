"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  X,
  Sparkles,
  MessageSquarePlus,
  Bug,
  CheckCircle2,
  Clock,
  Trash2,
  ShieldAlert,
  Send,
  RefreshCw,
  Upload,
  FileImage,
  FileText,
  ExternalLink,
  Loader2,
  Paperclip,
} from "lucide-react";
import { useTasks } from "@/lib/store";
import { FeatureRequestAttachment, Role, TaskPriority } from "@/lib/types";
import { Button } from "./ui/button";
import { cn, sanitizeUrl } from "@/lib/utils";

export interface FeatureRequestItem {
  id: string;
  authorId: string;
  authorName: string;
  authorRole: Role;
  type: "feature" | "feedback" | "bug";
  title: string;
  details: string;
  attachments?: FeatureRequestAttachment[];
  priority?: TaskPriority;
  status: "open" | "in_progress" | "resolved";
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
}

interface FeatureRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: "submit" | "manage";
}

export function FeatureRequestModal({
  isOpen,
  onClose,
  initialTab = "submit",
}: FeatureRequestModalProps) {
  const { currentUser, isAdmin } = useTasks();
  const userEmailLower = (currentUser?.email || "").trim().toLowerCase();
  const isDeveloper =
    currentUser?.role === "developer" || userEmailLower === "kritika@satmi.in";
  const isKartavya = userEmailLower === "kartavya@satmi.in";
  const isAdminOrDeveloper = isAdmin || isDeveloper || isKartavya;

  const [activeTab, setActiveTab] = useState<"submit" | "manage">(
    isAdminOrDeveloper ? initialTab : "submit"
  );

  // Form state
  const [type, setType] = useState<"feature" | "feedback" | "bug">("feature");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [attachments, setAttachments] = useState<FeatureRequestAttachment[]>([]);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Admin/Developer management state
  const [requests, setRequests] = useState<FeatureRequestItem[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [statusFilter, setStatusFilter] = useState<
    "all" | "open" | "in_progress" | "resolved"
  >("all");
  const [editingNotesId, setEditingNotesId] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState<string>("");

  const extractList = (data: unknown): FeatureRequestItem[] => {
    if (Array.isArray(data)) return data as FeatureRequestItem[];
    if (data && typeof data === "object") {
      const obj = data as Record<string, unknown>;
      if (Array.isArray(obj.requests)) return obj.requests as FeatureRequestItem[];
      if (Array.isArray(obj.feedback)) return obj.feedback as FeatureRequestItem[];
      if (Array.isArray(obj.items)) return obj.items as FeatureRequestItem[];
      if (Array.isArray(obj.data)) return obj.data as FeatureRequestItem[];
    }
    return [];
  };

  const fetchRequests = useCallback(async () => {
    if (!isAdminOrDeveloper || !currentUser?.id) return;
    setLoadingRequests(true);
    try {
      const res = await fetch(
        `/api/feedback?userId=${encodeURIComponent(currentUser.id)}&role=${encodeURIComponent(currentUser.role)}`,
        {
          headers: {
            "x-user-id": currentUser.id,
            "x-user-role": currentUser.role,
          },
        }
      );
      if (res.ok) {
        const data = await res.json();
        setRequests(extractList(data));
      }
    } catch {
      // ignore network error cleanly
    } finally {
      setLoadingRequests(false);
    }
  }, [isAdminOrDeveloper, currentUser?.id, currentUser?.role]);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null);
    setSubmittedSuccess(false);
    if (!isAdminOrDeveloper) {
      setActiveTab("submit");
    } else {
      fetchRequests();
    }
  }, [isOpen, isAdminOrDeveloper, fetchRequests]);

  if (!isOpen) return null;

  const uploadFiles = async (files: FileList | File[]) => {
    const fileList = Array.from(files);
    if (fileList.length === 0) return;

    const remainingSlots = Math.max(0, 5 - attachments.length);
    if (remainingSlots === 0) {
      setErrorMsg("You can attach up to 5 screenshots or files per request.");
      return;
    }

    setErrorMsg(null);
    setIsUploadingAttachment(true);
    try {
      const uploaded: FeatureRequestAttachment[] = [];
      for (const file of fileList.slice(0, remainingSlots)) {
        if (file.size > 20 * 1024 * 1024) {
          throw new Error(`${file.name} exceeds the 20MB file size limit.`);
        }
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.asset) {
          throw new Error(data.error || `Failed to upload ${file.name}`);
        }
        uploaded.push({
          name: data.asset.name || file.name,
          url: data.asset.url,
          size: data.asset.size,
          type: data.asset.type,
          uploadedAt: data.asset.uploadedAt,
        });
      }
      if (uploaded.length > 0) {
        setAttachments((prev) => [...prev, ...uploaded].slice(0, 5));
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to upload attachment");
    } finally {
      setIsUploadingAttachment(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    setErrorMsg(null);

    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": currentUser.id,
          "x-user-role": currentUser.role,
        },
        body: JSON.stringify({
          authorId: currentUser.id,
          authorName: currentUser.name,
          authorRole: currentUser.role,
          type,
          title: title.trim(),
          details: details.trim(),
          attachments,
          priority,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to submit feedback");
      }

      setTitle("");
      setDetails("");
      setAttachments([]);
      setType("feature");
      setPriority("medium");
      setSubmittedSuccess(true);
      if (isAdminOrDeveloper) {
        fetchRequests();
      }
      setTimeout(() => {
        setSubmittedSuccess(false);
        if (!isAdminOrDeveloper) {
          onClose();
        }
      }, 1400);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateStatus = async (
    id: string,
    status: "open" | "in_progress" | "resolved",
    adminNotes?: string
  ) => {
    if (!isAdminOrDeveloper) return;
    setRequests((prev) =>
      prev.map((r) =>
        r.id === id
          ? {
              ...r,
              status,
              ...(adminNotes !== undefined ? { adminNotes } : {}),
              updatedAt: new Date().toISOString(),
            }
          : r
      )
    );
    try {
      await fetch("/api/feedback", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-user-id": currentUser.id,
          "x-user-role": currentUser.role,
        },
        body: JSON.stringify({
          id,
          status,
          ...(adminNotes !== undefined ? { adminNotes } : {}),
          userId: currentUser.id,
          role: currentUser.role,
        }),
      });
    } catch {
      fetchRequests();
    }
  };

  const handleDeleteRequest = async (id: string) => {
    if (!isAdminOrDeveloper) return;
    setRequests((prev) => prev.filter((r) => r.id !== id));
    try {
      await fetch(
        `/api/feedback?id=${encodeURIComponent(id)}&userId=${encodeURIComponent(currentUser.id)}&role=${encodeURIComponent(currentUser.role)}`,
        {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": currentUser.id,
            "x-user-role": currentUser.role,
          },
          body: JSON.stringify({
            id,
            userId: currentUser.id,
            role: currentUser.role,
          }),
        }
      );
    } catch {
      fetchRequests();
    }
  };

  const filteredRequests = requests.filter((r) =>
    statusFilter === "all" ? true : r.status === statusFilter
  );

  const openCount = requests.filter((r) => r.status === "open").length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/30 backdrop-blur-sm p-4 sm:p-6 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl rounded-2xl border border-border bg-card text-card-foreground shadow-float overflow-hidden animate-in fade-in zoom-in-95 duration-150"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
              <Sparkles className="size-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-foreground">
                Developer Feedback & Feature Requests
              </h2>
              <p className="text-xs text-muted-foreground">
                Sent from support@satmi.in to kritika@satmi.in (CC: kartavya@satmi.in)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="size-8 rounded-xl border border-border text-muted-foreground hover:bg-muted hover:text-foreground flex items-center justify-center transition cursor-pointer"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Admin / Developer Tabs */}
        {isAdminOrDeveloper && (
          <div className="flex items-center justify-between border-b border-border bg-muted/30 px-5 py-2">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setActiveTab("submit")}
                className={cn(
                  "rounded-lg px-3 py-1 text-xs font-medium transition cursor-pointer",
                  activeTab === "submit"
                    ? "bg-card text-foreground shadow-2xs border border-border"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                Submit New
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveTab("manage");
                  fetchRequests();
                }}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-medium transition cursor-pointer",
                  activeTab === "manage"
                    ? "bg-card text-foreground shadow-2xs border border-border"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span>Inbox (Admin/Dev)</span>
                {openCount > 0 && (
                  <span className="rounded-full bg-primary/15 px-1.5 py-0.2 text-[10px] font-mono font-bold text-primary">
                    {openCount}
                  </span>
                )}
              </button>
            </div>
            {activeTab === "manage" && (
              <button
                type="button"
                onClick={fetchRequests}
                className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
                title="Refresh"
              >
                <RefreshCw
                  className={cn("size-3.5", loadingRequests && "animate-spin")}
                />
              </button>
            )}
          </div>
        )}

        {/* Body */}
        {activeTab === "submit" || !isAdminOrDeveloper ? (
          <form
            onSubmit={handleSubmit}
            onPaste={(e) => {
              const items = Array.from(e.clipboardData?.items || []);
              const imageFiles = items
                .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
                .map((item) => item.getAsFile())
                .filter((f): f is File => Boolean(f));
              if (imageFiles.length > 0) {
                void uploadFiles(imageFiles);
              }
            }}
            className="p-5 space-y-4 max-h-[75vh] overflow-y-auto"
          >
            {/* Type selector */}
            <div className="grid grid-cols-3 gap-2">
              {(
                [
                  { id: "feature", label: "Feature Request", icon: Sparkles },
                  {
                    id: "feedback",
                    label: "UX Feedback",
                    icon: MessageSquarePlus,
                  },
                  { id: "bug", label: "Bug Report", icon: Bug },
                ] as const
              ).map((item) => {
                const Icon = item.icon;
                const active = type === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setType(item.id)}
                    className={cn(
                      "flex items-center justify-center gap-1.5 rounded-lg border px-2.5 py-2 text-xs font-medium transition cursor-pointer",
                      active
                        ? "border-primary bg-primary/10 text-primary font-semibold"
                        : "border-border bg-muted/30 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="size-3.5 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Title */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">
                Summary
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Short summary of your request or feedback..."
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
              />
            </div>

            {/* Details */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground">
                Details
              </label>
              <textarea
                rows={4}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="What would make your workflow faster or better?"
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none resize-none"
              />
            </div>

            {/* Screenshot / Attachment Box (Drag & Drop + Browse + Paste) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                  <Paperclip className="size-3.5 text-primary" />
                  <span>Screenshots / Attachments</span>
                </label>
                <span className="text-[10px] text-muted-foreground">
                  {attachments.length}/5 · Max 20MB
                </span>
              </div>

              <div
                role="button"
                tabIndex={0}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  if (e.dataTransfer.files?.length) {
                    void uploadFiles(e.dataTransfer.files);
                  }
                }}
                onClick={() => fileInputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                className={cn(
                  "rounded-xl border-2 border-dashed p-3.5 text-center transition cursor-pointer select-none",
                  dragOver
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50 hover:bg-muted/30"
                )}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*,.pdf,.png,.jpg,.jpeg,.webp,.gif"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files?.length) {
                      void uploadFiles(e.target.files);
                    }
                    e.target.value = "";
                  }}
                />
                {isUploadingAttachment ? (
                  <div className="flex items-center justify-center gap-2 py-1 text-xs font-medium text-primary">
                    <Loader2 className="size-4 animate-spin" />
                    <span>Uploading screenshot...</span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1">
                    <Upload className="size-4 text-muted-foreground" />
                    <p className="text-xs font-medium text-foreground">
                      Drag &amp; drop screenshots here, <span className="text-primary underline">browse files</span>, or paste (Ctrl/Cmd+V)
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      PNG, JPG, WEBP, GIF, PDF up to 20MB
                    </p>
                  </div>
                )}
              </div>

              {attachments.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {attachments.map((att, idx) => {
                    const isImage =
                      att.type?.startsWith("image/") ||
                      /\.(png|jpe?g|webp|gif)$/i.test(att.name || att.url);
                    return (
                      <div
                        key={`${att.url}-${idx}`}
                        className="flex items-center justify-between gap-2 rounded-lg border border-border bg-muted/25 p-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          {isImage ? (
                            <img
                              src={sanitizeUrl(att.url)}
                              alt={att.name}
                              className="size-9 rounded object-cover border border-border shrink-0"
                            />
                          ) : (
                            <div className="size-9 rounded bg-muted flex items-center justify-center shrink-0">
                              <FileText className="size-4 text-muted-foreground" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="text-[11px] font-medium text-foreground truncate">
                              {att.name}
                            </div>
                            {typeof att.size === "number" && (
                              <div className="text-[10px] text-muted-foreground">
                                {Math.max(1, Math.round(att.size / 1024))} KB
                              </div>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setAttachments((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="size-6 rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive flex items-center justify-center transition cursor-pointer shrink-0"
                          title="Remove attachment"
                        >
                          <X className="size-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Priority */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Priority
              </span>
              <div className="flex items-center gap-1.5">
                {(["low", "medium", "high", "urgent"] as TaskPriority[]).map(
                  (p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPriority(p)}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-[11px] font-medium capitalize transition cursor-pointer border",
                        priority === p
                          ? "border-primary bg-primary/15 text-primary font-semibold"
                          : "border-border bg-muted/30 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {p}
                    </button>
                  )
                )}
              </div>
            </div>

            {errorMsg && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2 text-xs text-destructive">
                {errorMsg}
              </div>
            )}

            {submittedSuccess && (
              <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/25 px-3 py-2 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="size-4 shrink-0" />
                <span>Sent directly to Developer / Admin inbox.</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-border">
              <span className="text-[11px] text-muted-foreground">
                Visible only to Admin & Developer
              </span>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="text-xs h-8"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={submitting || !title.trim()}
                  className="gap-1.5 text-xs h-8"
                >
                  <Send className="size-3.5" />
                  <span>{submitting ? "Sending..." : "Submit"}</span>
                </Button>
              </div>
            </div>
          </form>
        ) : (
          /* Admin / Developer Inbox */
          <div className="p-4 space-y-3 max-h-[68vh] overflow-y-auto">
            {/* Filter pills */}
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                {(["all", "open", "in_progress", "resolved"] as const).map(
                  (st) => (
                    <button
                      key={st}
                      type="button"
                      onClick={() => setStatusFilter(st)}
                      className={cn(
                        "rounded-md px-2.5 py-1 text-[11px] font-medium capitalize transition cursor-pointer",
                        statusFilter === st
                          ? "bg-primary text-primary-foreground font-semibold"
                          : "bg-muted/50 text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {st.replace("_", " ")}
                    </button>
                  )
                )}
              </div>
              <span className="text-[11px] text-muted-foreground font-mono">
                {filteredRequests.length} item
                {filteredRequests.length === 1 ? "" : "s"}
              </span>
            </div>

            {filteredRequests.length === 0 ? (
              <div className="py-10 text-center text-xs text-muted-foreground">
                No feedback or feature requests in this view.
              </div>
            ) : (
              <div className="space-y-2.5">
                {filteredRequests.map((req) => (
                  <div
                    key={req.id}
                    className="rounded-xl border border-border bg-muted/20 p-3.5 space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span
                            className={cn(
                              "rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                              req.type === "bug"
                                ? "bg-destructive/15 text-destructive"
                                : req.type === "feature"
                                  ? "bg-primary/15 text-primary"
                                  : "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                            )}
                          >
                            {req.type}
                          </span>
                          {req.priority && (
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-mono uppercase text-muted-foreground">
                              {req.priority}
                            </span>
                          )}
                          <h3 className="text-xs font-semibold text-foreground">
                            {req.title}
                          </h3>
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          From{" "}
                          <span className="font-medium text-foreground">
                            {req.authorName}
                          </span>{" "}
                          ({req.authorRole}) •{" "}
                          {new Date(req.createdAt).toLocaleDateString()}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <select
                          value={req.status}
                          onChange={(e) =>
                            handleUpdateStatus(
                              req.id,
                              e.target.value as
                                | "open"
                                | "in_progress"
                                | "resolved"
                            )
                          }
                          className={cn(
                            "rounded-md border border-border px-2 py-1 text-[11px] font-medium bg-card cursor-pointer",
                            req.status === "resolved"
                              ? "text-emerald-600 dark:text-emerald-400"
                              : req.status === "in_progress"
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-foreground"
                          )}
                        >
                          <option value="open">Open</option>
                          <option value="in_progress">In Progress</option>
                          <option value="resolved">Resolved</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => handleDeleteRequest(req.id)}
                          className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition cursor-pointer"
                          title="Delete request"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    </div>

                    {req.details && (
                      <p className="text-xs text-foreground/90 whitespace-pre-wrap bg-card/60 rounded-lg p-2.5 border border-border/60">
                        {req.details}
                      </p>
                    )}

                    {Array.isArray(req.attachments) && req.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-0.5">
                        {req.attachments.map((att, idx) => {
                          const isImage =
                            att.type?.startsWith("image/") ||
                            /\.(png|jpe?g|webp|gif)$/i.test(att.name || att.url);
                          const safeHref = sanitizeUrl(att.url);
                          return (
                            <a
                              key={`${att.url}-${idx}`}
                              href={safeHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-2 rounded-lg border border-border bg-card px-2 py-1.5 text-[11px] font-medium text-foreground hover:border-primary/50 hover:text-primary transition"
                            >
                              {isImage ? (
                                <img
                                  src={safeHref}
                                  alt={att.name}
                                  className="size-6 rounded object-cover border border-border shrink-0"
                                />
                              ) : (
                                <FileImage className="size-3.5 text-primary shrink-0" />
                              )}
                              <span className="max-w-[140px] truncate">{att.name}</span>
                              <ExternalLink className="size-3 opacity-60 shrink-0" />
                            </a>
                          );
                        })}
                      </div>
                    )}

                    {/* Developer / Admin Notes */}
                    {editingNotesId === req.id ? (
                      <div className="flex items-center gap-1.5 pt-1">
                        <input
                          type="text"
                          value={notesDraft}
                          onChange={(e) => setNotesDraft(e.target.value)}
                          placeholder="Add developer note..."
                          className="flex-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs text-foreground focus:border-primary focus:outline-none"
                        />
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          onClick={() => {
                            handleUpdateStatus(req.id, req.status, notesDraft);
                            setEditingNotesId(null);
                          }}
                          className="h-7 text-[11px] px-2.5"
                        >
                          Save
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingNotesId(null)}
                          className="h-7 text-[11px] px-2"
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between pt-0.5">
                        {req.adminNotes ? (
                          <span className="text-[11px] text-muted-foreground italic">
                            Dev note: {req.adminNotes}
                          </span>
                        ) : (
                          <span />
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setEditingNotesId(req.id);
                            setNotesDraft(req.adminNotes || "");
                          }}
                          className="text-[11px] text-primary hover:underline cursor-pointer"
                        >
                          {req.adminNotes ? "Edit note" : "+ Dev note"}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
