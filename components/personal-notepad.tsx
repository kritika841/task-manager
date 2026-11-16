"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  X,
  Lock,
  Plus,
  Trash2,
  Check,
  StickyNote,
  Loader2,
  ListPlus,
  Pin,
  Search,
  Edit3,
  Clock,
} from "lucide-react";
import { useTasks } from "@/lib/store";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

export interface PersonalNoteEntry {
  id: string;
  title: string;
  content: string;
  pinned?: boolean;
  color?: string;
  updatedAt: string;
}

const NOTE_COLORS = [
  { id: "default", label: "Default", hex: "#64748b", cardClass: "border-border bg-card" },
  { id: "blue", label: "Blue", hex: "#3b82f6", cardClass: "border-blue-500/35 bg-blue-500/5" },
  { id: "emerald", label: "Emerald", hex: "#10b981", cardClass: "border-emerald-500/35 bg-emerald-500/5" },
  { id: "amber", label: "Amber", hex: "#f59e0b", cardClass: "border-amber-500/35 bg-amber-500/5" },
  { id: "violet", label: "Violet", hex: "#8b5cf6", cardClass: "border-violet-500/35 bg-violet-500/5" },
  { id: "rose", label: "Rose", hex: "#f43f5e", cardClass: "border-rose-500/35 bg-rose-500/5" },
];

interface PersonalNotepadProps {
  isOpen?: boolean;
  onClose?: () => void;
  asView?: boolean;
}

export function PersonalNotepad({
  isOpen = true,
  onClose,
  asView = false,
}: PersonalNotepadProps) {
  const { currentUser, currentUserId, createTask } = useTasks();

  const [notes, setNotes] = useState<PersonalNoteEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterMode, setFilterMode] = useState<"all" | "pinned">("all");
  const [taskCreatedToast, setTaskCreatedToast] = useState<string | null>(null);

  // Lightbox Modal State (for adding or editing a note)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [draftColor, setDraftColor] = useState("blue");
  const [draftPinned, setDraftPinned] = useState(false);

  const loadedUserRef = useRef<string | null>(null);

  const loadNotepad = useCallback(async (uid: string) => {
    if (!uid) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/notepad?userId=${encodeURIComponent(uid)}`,
        {
          headers: { "x-user-id": uid },
          cache: "no-store",
        }
      );
      if (res.ok) {
        const data = await res.json();
        const pad = data?.notepad || data;
        let fetchedNotes: PersonalNoteEntry[] = Array.isArray(pad?.notes)
          ? pad.notes
          : [];
        if (
          fetchedNotes.length === 0 &&
          typeof pad?.content === "string" &&
          pad.content.trim()
        ) {
          fetchedNotes = [
            {
              id: "note-main",
              title: "Quick Notes",
              content: pad.content,
              color: "blue",
              pinned: false,
              updatedAt: pad.updatedAt || new Date().toISOString(),
            },
          ];
        }
        if (fetchedNotes.length === 0) {
          try {
            const raw = localStorage.getItem(`satmi_private_notepad_${uid}`);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed?.notes) && parsed.notes.length > 0) {
                fetchedNotes = parsed.notes;
              }
            }
          } catch {}
        }
        // Filter out any completely blank placeholder notes
        fetchedNotes = fetchedNotes.filter(
          (n) =>
            !(
              (n.title === "Quick Notes" || !n.title?.trim()) &&
              !n.content?.trim()
            )
        );
        setNotes(fetchedNotes);
        loadedUserRef.current = uid;
        return;
      }
    } catch {
      // Fallback to localStorage
    } finally {
      setLoading(false);
    }

    try {
      const raw = localStorage.getItem(`satmi_private_notepad_${uid}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.notes)) {
          setNotes(
            parsed.notes.filter(
              (n: PersonalNoteEntry) =>
                !(
                  (n.title === "Quick Notes" || !n.title?.trim()) &&
                  !n.content?.trim()
                )
            )
          );
          loadedUserRef.current = uid;
          return;
        }
      }
    } catch {}
    setNotes([]);
    loadedUserRef.current = uid;
  }, []);

  useEffect(() => {
    if ((isOpen || asView) && currentUserId) {
      loadNotepad(currentUserId);
    }
  }, [isOpen, asView, currentUserId, loadNotepad]);

  const persistNotes = useCallback(
    async (updatedNotes: PersonalNoteEntry[], uid: string) => {
      if (!uid) return;
      setSaveState("saving");
      const primaryContent = updatedNotes[0]?.content || "";
      const payload = {
        userId: uid,
        content: primaryContent,
        notes: updatedNotes,
        updatedAt: new Date().toISOString(),
      };

      try {
        localStorage.setItem(
          `satmi_private_notepad_${uid}`,
          JSON.stringify(payload)
        );
      } catch {}

      try {
        await fetch("/api/notepad", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "x-user-id": uid,
          },
          body: JSON.stringify(payload),
        });
      } catch {
      } finally {
        setSaveState("saved");
        setTimeout(() => setSaveState("idle"), 1500);
      }
    },
    []
  );

  if (!isOpen && !asView) return null;

  const openAddNoteLightbox = () => {
    setEditingNoteId(null);
    setDraftTitle("");
    setDraftContent("");
    setDraftColor("blue");
    setDraftPinned(false);
    setIsLightboxOpen(true);
  };

  const openEditNoteLightbox = (note: PersonalNoteEntry) => {
    setEditingNoteId(note.id);
    setDraftTitle(note.title);
    setDraftContent(note.content);
    setDraftColor(note.color || "default");
    setDraftPinned(Boolean(note.pinned));
    setIsLightboxOpen(true);
  };

  const handleSaveNoteFromLightbox = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftTitle.trim() && !draftContent.trim()) return;

    const now = new Date().toISOString();
    let updated: PersonalNoteEntry[];

    if (editingNoteId) {
      updated = notes.map((n) =>
        n.id === editingNoteId
          ? {
              ...n,
              title: draftTitle.trim() || "Untitled Note",
              content: draftContent,
              color: draftColor,
              pinned: draftPinned,
              updatedAt: now,
            }
          : n
      );
    } else {
      const newNote: PersonalNoteEntry = {
        id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: draftTitle.trim() || "Untitled Note",
        content: draftContent,
        color: draftColor,
        pinned: draftPinned,
        updatedAt: now,
      };
      updated = [newNote, ...notes];
    }

    setNotes(updated);
    setIsLightboxOpen(false);
    await persistNotes(updated, currentUserId);
  };

  const handleTogglePin = async (e: React.MouseEvent, noteId: string) => {
    e.stopPropagation();
    const updated = notes.map((n) =>
      n.id === noteId
        ? { ...n, pinned: !n.pinned, updatedAt: new Date().toISOString() }
        : n
    );
    setNotes(updated);
    await persistNotes(updated, currentUserId);
  };

  const handleDeleteNote = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const updated = notes.filter((n) => n.id !== id);
    setNotes(updated);
    await persistNotes(updated, currentUserId);
  };

  const handleConvertNoteToTask = async (
    e: React.MouseEvent,
    note: PersonalNoteEntry
  ) => {
    e.stopPropagation();
    const titleText =
      note.title.trim() ||
      note.content.split("\n")[0]?.trim() ||
      "Personal task";
    if (!titleText) return;
    const today = new Date().toISOString().split("T")[0];
    await createTask({
      title: titleText.slice(0, 100),
      description: note.content.trim(),
      priority: "medium",
      status: "todo",
      assigneeId: currentUserId,
      dueDate: today,
      targetQuantity: 1,
    });
    setTaskCreatedToast(`Converted "${titleText.slice(0, 32)}" to your tasks`);
    setTimeout(() => setTaskCreatedToast(null), 2500);
  };

  const filteredNotes = notes
    .filter((n) => {
      if (filterMode === "pinned" && !n.pinned) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          n.title.toLowerCase().includes(q) ||
          n.content.toLowerCase().includes(q)
        );
      }
      return true;
    })
    .sort((a, b) => {
      if (Boolean(a.pinned) !== Boolean(b.pinned)) {
        return a.pinned ? -1 : 1;
      }
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

  const renderNoteCard = (note: PersonalNoteEntry) => {
    const colorDef =
      NOTE_COLORS.find((c) => c.id === note.color) || NOTE_COLORS[0];

    return (
      <div
        key={note.id}
        onClick={() => openEditNoteLightbox(note)}
        className={cn(
          "group relative flex flex-col justify-between rounded-2xl border p-4 shadow-xs transition-all duration-150 hover:shadow-md hover:-translate-y-0.5 cursor-pointer min-h-[175px]",
          colorDef.cardClass
        )}
        style={{
          borderTopWidth: "3px",
          borderTopColor: colorDef.hex,
        }}
      >
        <div>
          {/* Card Header */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="text-sm font-bold text-foreground line-clamp-1">
              {note.title || "Untitled Note"}
            </h3>
            <button
              type="button"
              onClick={(e) => handleTogglePin(e, note.id)}
              className={cn(
                "rounded-lg p-1.5 transition cursor-pointer shrink-0",
                note.pinned
                  ? "bg-primary/15 text-primary"
                  : "text-muted-foreground opacity-60 group-hover:opacity-100 hover:bg-muted hover:text-foreground"
              )}
              title={note.pinned ? "Unpin note" : "Pin note"}
            >
              <Pin className="size-3.5" />
            </button>
          </div>

          {/* Note Body */}
          <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-5 leading-relaxed">
            {note.content || "Empty note..."}
          </p>
        </div>

        {/* Card Footer */}
        <div className="mt-4 pt-2.5 border-t border-border/50 flex items-center justify-between gap-2">
          <span className="inline-flex items-center gap-1 text-[10px] font-mono text-muted-foreground">
            <Clock className="size-3" />
            {new Date(note.updatedAt).toLocaleDateString([], {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>

          <div
            className="flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={(e) => handleConvertNoteToTask(e, note)}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary transition cursor-pointer"
              title="Convert note to task"
            >
              <ListPlus className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={() => openEditNoteLightbox(note)}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
              title="Edit note"
            >
              <Edit3 className="size-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => handleDeleteNote(e, note.id)}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition cursor-pointer"
              title="Delete note"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
            <StickyNote className="size-4" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Personal Notepad
            </h1>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
              <Lock className="size-2.5" />
              <span>Private · {currentUser.name.split(" ")[0]}</span>
            </span>
          </div>
          {saveState === "saving" && (
            <span className="text-xs text-muted-foreground flex items-center gap-1 ml-2">
              <Loader2 className="size-3 animate-spin" />
              <span>Saving...</span>
            </span>
          )}
          {saveState === "saved" && (
            <span className="text-xs text-emerald-500 flex items-center gap-1 ml-2">
              <Check className="size-3" />
              <span>Saved</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search notes..."
              className="w-40 sm:w-52 rounded-lg border border-border bg-muted/30 pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          </div>

          {/* Filter Pills */}
          <div className="flex items-center rounded-lg border border-border bg-muted/30 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setFilterMode("all")}
              className={cn(
                "px-2.5 py-1 rounded-md font-medium transition cursor-pointer",
                filterMode === "all"
                  ? "bg-card text-foreground font-semibold shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              All ({notes.length})
            </button>
            <button
              type="button"
              onClick={() => setFilterMode("pinned")}
              className={cn(
                "px-2.5 py-1 rounded-md font-medium transition cursor-pointer",
                filterMode === "pinned"
                  ? "bg-card text-foreground font-semibold shadow-2xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Pinned ({notes.filter((n) => n.pinned).length})
            </button>
          </div>

          {/* Add Note Button -> Opens Lightbox */}
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={openAddNoteLightbox}
            className="gap-1.5 text-xs h-8 shadow-xs cursor-pointer"
          >
            <Plus className="size-3.5" />
            <span>Add Note</span>
          </Button>

          {!asView && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
            >
              <X className="size-4" />
            </button>
          )}
        </div>
      </div>

      {taskCreatedToast && (
        <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/25 px-3.5 py-2 text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center justify-between">
          <span>{taskCreatedToast}</span>
          <button
            type="button"
            onClick={() => setTaskCreatedToast(null)}
            className="text-xs font-bold"
          >
            ✕
          </button>
        </div>
      )}

      {/* Notes Canvas / Flow Grid */}
      {loading ? (
        <div className="py-20 flex items-center justify-center text-xs text-muted-foreground gap-2">
          <Loader2 className="size-4 animate-spin" />
          <span>Loading notes...</span>
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card/40 py-16 px-4 text-center space-y-3">
          <div className="mx-auto flex size-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <StickyNote className="size-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-semibold text-foreground">
              {searchQuery ? "No matching notes found" : "No notes yet"}
            </h3>
            <p className="text-xs text-muted-foreground">
              Click Add Note to create a private note card on your board.
            </p>
          </div>
          <Button
            type="button"
            variant="primary"
            size="sm"
            onClick={openAddNoteLightbox}
            className="gap-1.5 text-xs h-8 cursor-pointer"
          >
            <Plus className="size-3.5" />
            <span>Add Note</span>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredNotes.map((note) => renderNoteCard(note))}
        </div>
      )}

      {/* Lightbox Modal for Adding / Editing Note */}
      {isLightboxOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-sm animate-in fade-in duration-150"
          onClick={() => setIsLightboxOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-2xl border border-border bg-card p-5 shadow-float space-y-4 animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-border pb-3">
              <div className="flex items-center gap-2">
                <StickyNote className="size-4 text-primary" />
                <h2 className="text-sm font-bold text-foreground">
                  {editingNoteId ? "Edit Note" : "Add Note"}
                </h2>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setDraftPinned(!draftPinned)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium transition cursor-pointer border",
                    draftPinned
                      ? "border-primary/40 bg-primary/15 text-primary font-semibold"
                      : "border-border bg-muted/40 text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Pin className="size-3" />
                  <span>{draftPinned ? "Pinned" : "Pin"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsLightboxOpen(false)}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            <form onSubmit={handleSaveNoteFromLightbox} className="space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Title
                </label>
                <input
                  type="text"
                  autoFocus
                  value={draftTitle}
                  onChange={(e) => setDraftTitle(e.target.value)}
                  placeholder="Note title..."
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-xs font-semibold text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-foreground mb-1">
                  Note Content
                </label>
                <textarea
                  rows={6}
                  value={draftContent}
                  onChange={(e) => setDraftContent(e.target.value)}
                  placeholder="Write your note, ideas, links, or checklist..."
                  className="w-full resize-none rounded-xl border border-border bg-background p-3 text-xs leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
                />
              </div>

              {/* Color Accent Picker */}
              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-medium text-muted-foreground mr-1">
                    Color:
                  </span>
                  {NOTE_COLORS.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setDraftColor(c.id)}
                      className={cn(
                        "size-5 rounded-full border transition cursor-pointer flex items-center justify-center",
                        draftColor === c.id
                          ? "ring-2 ring-primary ring-offset-2 scale-110"
                          : "opacity-75 hover:opacity-100"
                      )}
                      style={{ backgroundColor: c.hex }}
                      title={c.label}
                    >
                      {draftColor === c.id && (
                        <Check className="size-2.5 text-white" />
                      )}
                    </button>
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setIsLightboxOpen(false)}
                    className="text-xs h-8"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={!draftTitle.trim() && !draftContent.trim()}
                    className="text-xs h-8 px-4"
                  >
                    Save Note
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
