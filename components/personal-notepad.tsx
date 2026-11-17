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
  Palette,
  CheckSquare,
  Bell,
  Archive,
  Undo2,
  Redo2,
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
  { id: "default", label: "Default", hex: "#52525b", cardClass: "border-border/80 bg-card/95" },
  { id: "blue", label: "Blue", hex: "#3b82f6", cardClass: "border-blue-500/35 bg-blue-500/10" },
  { id: "emerald", label: "Emerald", hex: "#10b981", cardClass: "border-emerald-500/35 bg-emerald-500/10" },
  { id: "amber", label: "Amber", hex: "#f59e0b", cardClass: "border-amber-500/35 bg-amber-500/10" },
  { id: "violet", label: "Violet", hex: "#8b5cf6", cardClass: "border-violet-500/35 bg-violet-500/10" },
  { id: "rose", label: "Rose", hex: "#f43f5e", cardClass: "border-rose-500/35 bg-rose-500/10" },
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

  // Google Keep Top Composer State ("Take a note...")
  const [isComposerExpanded, setIsComposerExpanded] = useState(false);
  const [composerTitle, setComposerTitle] = useState("");
  const [composerContent, setComposerContent] = useState("");
  const [composerColor, setComposerColor] = useState("default");
  const [composerPinned, setComposerPinned] = useState(false);
  const [showComposerPalette, setShowComposerPalette] = useState(false);
  const composerRef = useRef<HTMLDivElement>(null);
  const composerTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Lightbox Modal State (Google Keep style overlay when clicking Edit button or expanding)
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");
  const [draftContent, setDraftContent] = useState("");
  const [draftColor, setDraftColor] = useState("default");
  const [draftPinned, setDraftPinned] = useState(false);
  const [showLightboxPalette, setShowLightboxPalette] = useState(false);

  // Inline Card Editing State (when clicking directly on a note card in the grid)
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [inlineField, setInlineField] = useState<"title" | "content">("content");
  const [inlineTitle, setInlineTitle] = useState("");
  const [inlineContent, setInlineContent] = useState("");
  const [inlineColor, setInlineColor] = useState("default");
  const [inlinePinned, setInlinePinned] = useState(false);
  const [cardPaletteOpenId, setCardPaletteOpenId] = useState<string | null>(null);
  const activeCardRef = useRef<HTMLDivElement>(null);

  const loadedUserRef = useRef<string | null>(null);

  // Refs to latest values so outside-click listeners always save the latest keystrokes
  const notesRef = useRef<PersonalNoteEntry[]>(notes);
  notesRef.current = notes;
  const composerStateRef = useRef({
    isComposerExpanded,
    composerTitle,
    composerContent,
    composerColor,
    composerPinned,
  });
  composerStateRef.current = {
    isComposerExpanded,
    composerTitle,
    composerContent,
    composerColor,
    composerPinned,
  };
  const inlineStateRef = useRef({
    inlineEditId,
    inlineTitle,
    inlineContent,
    inlineColor,
    inlinePinned,
  });
  inlineStateRef.current = {
    inlineEditId,
    inlineTitle,
    inlineContent,
    inlineColor,
    inlinePinned,
  };

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
              title: "",
              content: pad.content,
              color: "default",
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

  // Commit Google Keep Top Composer when clicking outside or pressing Close
  const commitTopComposer = useCallback(async () => {
    const {
      isComposerExpanded: expanded,
      composerTitle: cTitle,
      composerContent: cContent,
      composerColor: cColor,
      composerPinned: cPinned,
    } = composerStateRef.current;

    if (!expanded) return;

    const trimmedTitle = cTitle.trim();
    const trimmedContent = cContent.trim();

    setIsComposerExpanded(false);
    setShowComposerPalette(false);
    setComposerTitle("");
    setComposerContent("");
    setComposerColor("default");
    setComposerPinned(false);

    if (!trimmedTitle && !trimmedContent) return;

    const newNote: PersonalNoteEntry = {
      id: `note-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: trimmedTitle,
      content: cContent,
      color: cColor,
      pinned: cPinned,
      updatedAt: new Date().toISOString(),
    };

    const updated = [newNote, ...notesRef.current];
    setNotes(updated);
    await persistNotes(updated, currentUserId);
  }, [currentUserId, persistNotes]);

  // Commit Inline Card Edit when clicking anywhere outside the active card
  const commitInlineEdit = useCallback(
    async (noteId?: string) => {
      const {
        inlineEditId: activeId,
        inlineTitle: iTitle,
        inlineContent: iContent,
        inlineColor: iColor,
        inlinePinned: iPinned,
      } = inlineStateRef.current;

      const targetId = noteId || activeId;
      if (!targetId || activeId !== targetId) return;

      const target = notesRef.current.find((n) => n.id === targetId);
      setInlineEditId(null);
      setCardPaletteOpenId(null);
      if (!target) return;

      const nextTitle = iTitle.trim();
      const nextContent = iContent;

      // If user cleared both title and content completely, keep previous or remove if empty
      if (
        nextTitle === (target.title || "") &&
        nextContent === target.content &&
        iColor === (target.color || "default") &&
        iPinned === Boolean(target.pinned)
      ) {
        return;
      }

      const now = new Date().toISOString();
      const updated = notesRef.current.map((n) =>
        n.id === targetId
          ? {
              ...n,
              title: nextTitle,
              content: nextContent,
              color: iColor,
              pinned: iPinned,
              updatedAt: now,
            }
          : n
      );
      setNotes(updated);
      await persistNotes(updated, currentUserId);
    },
    [currentUserId, persistNotes]
  );

  // Global mousedown listener: clicking outside the Google Keep composer or active inline card auto-saves
  useEffect(() => {
    const handleDocumentMouseDown = (e: MouseEvent) => {
      const targetNode = e.target as Node | null;
      if (!targetNode) return;

      if (
        composerStateRef.current.isComposerExpanded &&
        composerRef.current &&
        !composerRef.current.contains(targetNode)
      ) {
        commitTopComposer();
      }

      if (
        inlineStateRef.current.inlineEditId &&
        activeCardRef.current &&
        !activeCardRef.current.contains(targetNode)
      ) {
        commitInlineEdit(inlineStateRef.current.inlineEditId);
      }
    };

    document.addEventListener("mousedown", handleDocumentMouseDown);
    return () => {
      document.removeEventListener("mousedown", handleDocumentMouseDown);
    };
  }, [commitTopComposer, commitInlineEdit]);

  if (!isOpen && !asView) return null;

  const openEditNoteLightbox = (note: PersonalNoteEntry) => {
    if (inlineEditId) {
      commitInlineEdit(inlineEditId);
    }
    setEditingNoteId(note.id);
    setDraftTitle(note.title === "Untitled Note" ? "" : note.title);
    setDraftContent(note.content);
    setDraftColor(note.color || "default");
    setDraftPinned(Boolean(note.pinned));
    setShowLightboxPalette(false);
    setIsLightboxOpen(true);
  };

  const startInlineEdit = (
    note: PersonalNoteEntry,
    field: "title" | "content"
  ) => {
    if (inlineEditId && inlineEditId !== note.id) {
      commitInlineEdit(inlineEditId);
    }
    if (inlineEditId === note.id) {
      setInlineField(field);
      return;
    }
    setInlineEditId(note.id);
    setInlineField(field);
    setInlineTitle(note.title === "Untitled Note" ? "" : note.title);
    setInlineContent(note.content);
    setInlineColor(note.color || "default");
    setInlinePinned(Boolean(note.pinned));
  };

  // Save & Close Lightbox Modal (triggered by clicking outside the modal or clicking "Close")
  const saveAndCloseLightbox = async () => {
    const trimmedTitle = draftTitle.trim();
    const trimmedContent = draftContent.trim();

    setIsLightboxOpen(false);
    setShowLightboxPalette(false);

    if (!trimmedTitle && !trimmedContent) {
      setEditingNoteId(null);
      return;
    }

    const now = new Date().toISOString();
    let updated: PersonalNoteEntry[];

    if (editingNoteId) {
      updated = notes.map((n) =>
        n.id === editingNoteId
          ? {
              ...n,
              title: trimmedTitle,
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
        title: trimmedTitle,
        content: draftContent,
        color: draftColor,
        pinned: draftPinned,
        updatedAt: now,
      };
      updated = [newNote, ...notes];
    }

    setEditingNoteId(null);
    setNotes(updated);
    await persistNotes(updated, currentUserId);
  };

  const handleTogglePin = async (e: React.MouseEvent, noteId: string) => {
    e.stopPropagation();
    if (inlineEditId === noteId) {
      setInlinePinned((prev) => !prev);
      return;
    }
    const updated = notes.map((n) =>
      n.id === noteId
        ? { ...n, pinned: !n.pinned, updatedAt: new Date().toISOString() }
        : n
    );
    setNotes(updated);
    await persistNotes(updated, currentUserId);
  };

  const handleChangeCardColor = async (
    e: React.MouseEvent,
    noteId: string,
    colorId: string
  ) => {
    e.stopPropagation();
    setCardPaletteOpenId(null);
    if (inlineEditId === noteId) {
      setInlineColor(colorId);
      return;
    }
    const updated = notes.map((n) =>
      n.id === noteId
        ? { ...n, color: colorId, updatedAt: new Date().toISOString() }
        : n
    );
    setNotes(updated);
    await persistNotes(updated, currentUserId);
  };

  const handleDeleteNote = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (inlineEditId === id) {
      setInlineEditId(null);
    }
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
      (note.title && note.title !== "Untitled Note" ? note.title.trim() : "") ||
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
          (n.title || "").toLowerCase().includes(q) ||
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
    const isInlineEditing = inlineEditId === note.id;
    const effectiveColorId = isInlineEditing
      ? inlineColor
      : note.color || "default";
    const effectivePinned = isInlineEditing ? inlinePinned : Boolean(note.pinned);
    const colorDef =
      NOTE_COLORS.find((c) => c.id === effectiveColorId) || NOTE_COLORS[0];
    const displayTitle =
      note.title && note.title !== "Untitled Note" ? note.title : "";

    return (
      <div
        key={note.id}
        ref={isInlineEditing ? activeCardRef : undefined}
        onClick={() => {
          if (!isInlineEditing) {
            startInlineEdit(note, "content");
          }
        }}
        className={cn(
          "group relative flex flex-col justify-between rounded-xl border p-4 transition-all duration-150 min-h-[140px] cursor-text",
          colorDef.cardClass,
          isInlineEditing
            ? "ring-2 ring-primary/50 shadow-float z-10"
            : "hover:border-muted-foreground/40 hover:shadow-md"
        )}
      >
        {/* Google Keep Corner Checkmark Badge on Hover / Edit */}
        <div
          className={cn(
            "absolute -left-2 -top-2 flex size-5 items-center justify-center rounded-full bg-foreground text-background shadow-sm transition-opacity",
            isInlineEditing
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100"
          )}
          title="Selected note"
        >
          <Check className="size-3 stroke-[3]" />
        </div>

        <div className="flex-1 flex flex-col">
          {/* Card Header: Title + Pin */}
          <div className="flex items-start justify-between gap-2 mb-1.5">
            {isInlineEditing ? (
              <input
                type="text"
                autoFocus={inlineField === "title"}
                value={inlineTitle}
                onChange={(e) => setInlineTitle(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    commitInlineEdit(note.id);
                  }
                }}
                placeholder="Title"
                className="w-full bg-transparent text-sm font-semibold text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
              />
            ) : displayTitle ? (
              <h3
                onClick={(e) => {
                  e.stopPropagation();
                  startInlineEdit(note, "title");
                }}
                className="text-sm font-semibold text-foreground line-clamp-1 flex-1"
              >
                {displayTitle}
              </h3>
            ) : (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  startInlineEdit(note, "title");
                }}
                className="text-xs font-medium text-muted-foreground/0 group-hover:text-muted-foreground/50 transition select-none flex-1"
              >
                Title
              </span>
            )}

            <button
              type="button"
              onClick={(e) => handleTogglePin(e, note.id)}
              className={cn(
                "rounded-full p-1.5 transition cursor-pointer shrink-0",
                effectivePinned
                  ? "text-primary opacity-100 bg-primary/10"
                  : "text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted hover:text-foreground"
              )}
              title={effectivePinned ? "Unpin note" : "Pin note"}
            >
              <Pin className="size-3.5" />
            </button>
          </div>

          {/* Note Body — Google Keep direct inline editing */}
          {isInlineEditing ? (
            <textarea
              autoFocus={inlineField === "content"}
              rows={Math.max(3, Math.min(8, inlineContent.split("\n").length + 1))}
              value={inlineContent}
              onChange={(e) => setInlineContent(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  commitInlineEdit(note.id);
                } else if (e.key === "Escape") {
                  commitInlineEdit(note.id);
                }
              }}
              placeholder="Take a note..."
              className="w-full flex-1 resize-none bg-transparent text-[13px] text-foreground leading-relaxed placeholder:text-muted-foreground/60 focus:outline-none"
            />
          ) : (
            <p
              onClick={(e) => {
                e.stopPropagation();
                startInlineEdit(note, "content");
              }}
              className="text-[13px] text-foreground/90 whitespace-pre-wrap line-clamp-6 leading-relaxed flex-1"
            >
              {note.content || (
                <span className="text-muted-foreground/50">Take a note...</span>
              )}
            </p>
          )}
        </div>

        {/* Google Keep Action Toolbar Footer */}
        <div
          className={cn(
            "mt-3 pt-2 flex items-center justify-between gap-2 transition-opacity",
            isInlineEditing
              ? "opacity-100 border-t border-border/50"
              : "opacity-80 group-hover:opacity-100"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="relative flex items-center gap-0.5">
            {/* Color Palette Button */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setCardPaletteOpenId((prev) =>
                  prev === note.id ? null : note.id
                );
              }}
              className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
              title="Background options"
            >
              <Palette className="size-3.5" />
            </button>

            {cardPaletteOpenId === note.id && (
              <div className="absolute bottom-8 left-0 z-30 flex items-center gap-1.5 rounded-xl border border-border bg-popover p-2 shadow-float">
                {NOTE_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={(e) => handleChangeCardColor(e, note.id, c.id)}
                    className={cn(
                      "size-5 rounded-full border transition cursor-pointer flex items-center justify-center",
                      effectiveColorId === c.id
                        ? "ring-2 ring-primary scale-110"
                        : "opacity-80 hover:opacity-100"
                    )}
                    style={{ backgroundColor: c.hex }}
                    title={c.label}
                  >
                    {effectiveColorId === c.id && (
                      <Check className="size-2.5 text-white" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Convert to Task Button */}
            <button
              type="button"
              onClick={(e) => handleConvertNoteToTask(e, note)}
              className="rounded-full p-1.5 text-muted-foreground hover:bg-primary/10 hover:text-primary transition cursor-pointer"
              title="Convert note to task"
            >
              <ListPlus className="size-3.5" />
            </button>

            {/* Open Full Edit Popup Modal Button */}
            <button
              type="button"
              onClick={() => openEditNoteLightbox(note)}
              className="rounded-full p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
              title="Open in popup modal"
            >
              <Edit3 className="size-3.5" />
            </button>

            {/* Delete Note Button */}
            <button
              type="button"
              onClick={(e) => handleDeleteNote(e, note.id)}
              className="rounded-full p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition cursor-pointer"
              title="Delete note"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>

          {isInlineEditing ? (
            <button
              type="button"
              onClick={() => commitInlineEdit(note.id)}
              className="rounded-md px-2.5 py-1 text-xs font-semibold text-foreground hover:bg-muted transition cursor-pointer"
            >
              Close
            </button>
          ) : (
            <span className="text-[10px] text-muted-foreground/70 font-mono">
              {new Date(note.updatedAt).toLocaleDateString([], {
                day: "numeric",
                month: "short",
              })}
            </span>
          )}
        </div>
      </div>
    );
  };

  const composerColorDef =
    NOTE_COLORS.find((c) => c.id === composerColor) || NOTE_COLORS[0];
  const lightboxColorDef =
    NOTE_COLORS.find((c) => c.id === draftColor) || NOTE_COLORS[0];

  return (
    <div className="space-y-6">
      {/* Top Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 items-center justify-center rounded-xl bg-amber-500/15 text-amber-500 border border-amber-500/30">
            <StickyNote className="size-4" />
          </div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground">
              Keep Notes
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
              className="w-44 sm:w-56 rounded-lg border border-border bg-muted/30 pl-8 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
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

      {/* GOOGLE KEEP SKELETON COMPOSER BAR ("Take a note...") */}
      <div className="flex justify-center px-2">
        <div
          ref={composerRef}
          className={cn(
            "w-full max-w-xl rounded-xl border shadow-md transition-all duration-150",
            composerColorDef.cardClass,
            isComposerExpanded
              ? "p-4 ring-1 ring-border"
              : "px-4 py-2.5 hover:border-muted-foreground/50 cursor-text"
          )}
          onClick={() => {
            if (!isComposerExpanded) {
              setIsComposerExpanded(true);
              setTimeout(() => composerTextareaRef.current?.focus(), 20);
            }
          }}
        >
          {!isComposerExpanded ? (
            /* Collapsed Google Keep Skeleton Bar */
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-muted-foreground select-none">
                Take a note...
              </span>
              <div className="flex items-center gap-1 text-muted-foreground">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsComposerExpanded(true);
                    setComposerContent("• ");
                    setTimeout(() => composerTextareaRef.current?.focus(), 20);
                  }}
                  className="rounded-full p-2 hover:bg-muted hover:text-foreground transition cursor-pointer"
                  title="New list"
                >
                  <CheckSquare className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsComposerExpanded(true);
                    setTimeout(() => composerTextareaRef.current?.focus(), 20);
                  }}
                  className="rounded-full p-2 hover:bg-muted hover:text-foreground transition cursor-pointer"
                  title="New note"
                >
                  <Edit3 className="size-4" />
                </button>
              </div>
            </div>
          ) : (
            /* Expanded Google Keep Composer Card (Title + Take a note... + Action Bar + Close) */
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <input
                  type="text"
                  value={composerTitle}
                  onChange={(e) => setComposerTitle(e.target.value)}
                  placeholder="Title"
                  className="w-full bg-transparent text-sm font-semibold text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setComposerPinned((prev) => !prev)}
                  className={cn(
                    "rounded-full p-1.5 transition cursor-pointer shrink-0",
                    composerPinned
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                  title={composerPinned ? "Unpin note" : "Pin note"}
                >
                  <Pin className="size-4" />
                </button>
              </div>

              <textarea
                ref={composerTextareaRef}
                rows={Math.max(3, Math.min(10, composerContent.split("\n").length + 1))}
                value={composerContent}
                onChange={(e) => setComposerContent(e.target.value)}
                onKeyDown={(e) => {
                  if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                    e.preventDefault();
                    commitTopComposer();
                  } else if (e.key === "Escape") {
                    commitTopComposer();
                  }
                }}
                placeholder="Take a note..."
                className="w-full resize-none bg-transparent text-sm text-foreground leading-relaxed placeholder:text-muted-foreground/70 focus:outline-none"
              />

              {/* Bottom Google Keep Toolbar */}
              <div className="flex items-center justify-between pt-1">
                <div className="relative flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setShowComposerPalette((prev) => !prev)}
                    className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
                    title="Background color"
                  >
                    <Palette className="size-4" />
                  </button>

                  {showComposerPalette && (
                    <div className="absolute bottom-10 left-0 z-30 flex items-center gap-1.5 rounded-xl border border-border bg-popover p-2 shadow-float">
                      {NOTE_COLORS.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setComposerColor(c.id);
                            setShowComposerPalette(false);
                          }}
                          className={cn(
                            "size-5 rounded-full border transition cursor-pointer flex items-center justify-center",
                            composerColor === c.id
                              ? "ring-2 ring-primary scale-110"
                              : "opacity-80 hover:opacity-100"
                          )}
                          style={{ backgroundColor: c.hex }}
                          title={c.label}
                        >
                          {composerColor === c.id && (
                            <Check className="size-2.5 text-white" />
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() =>
                      setComposerContent((prev) =>
                        prev ? `${prev}\n• ` : "• "
                      )
                    }
                    className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
                    title="Add bullet item"
                  >
                    <CheckSquare className="size-4" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => commitTopComposer()}
                  className="rounded-lg px-4 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
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

      {/* Notes Grid (Pinned + Others, Google Keep style) */}
      {loading ? (
        <div className="py-20 flex items-center justify-center text-xs text-muted-foreground gap-2">
          <Loader2 className="size-4 animate-spin" />
          <span>Loading notes...</span>
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="py-14 text-center space-y-2 text-muted-foreground">
          <StickyNote className="size-8 mx-auto opacity-40" />
          <p className="text-xs">
            {searchQuery
              ? "No matching notes found."
              : "Notes you add appear here. Click 'Take a note...' above to start typing."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {filterMode === "all" &&
          filteredNotes.some((n) => n.pinned) &&
          filteredNotes.some((n) => !n.pinned) ? (
            <>
              <div className="space-y-2.5">
                <span className="px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Pinned
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-start">
                  {filteredNotes
                    .filter((n) => n.pinned)
                    .map((note) => renderNoteCard(note))}
                </div>
              </div>

              <div className="space-y-2.5">
                <span className="px-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Others
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-start">
                  {filteredNotes
                    .filter((n) => !n.pinned)
                    .map((note) => renderNoteCard(note))}
                </div>
              </div>
            </>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-start">
              {filteredNotes.map((note) => renderNoteCard(note))}
            </div>
          )}
        </div>
      )}

      {/* Google Keep Popup Modal (opens when clicking the Edit button on a card, auto-saves on outside click) */}
      {isLightboxOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-[2px] animate-in fade-in duration-150"
          onClick={saveAndCloseLightbox}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "w-full max-w-xl rounded-xl border p-5 shadow-2xl space-y-3 animate-in zoom-in-95 duration-150",
              lightboxColorDef.cardClass
            )}
          >
            {/* Title + Pin */}
            <div className="flex items-center justify-between gap-3">
              <input
                type="text"
                value={draftTitle}
                onChange={(e) => setDraftTitle(e.target.value)}
                placeholder="Title"
                className="w-full bg-transparent text-base font-semibold text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setDraftPinned(!draftPinned)}
                className={cn(
                  "rounded-full p-2 transition cursor-pointer shrink-0",
                  draftPinned
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
                title={draftPinned ? "Unpin note" : "Pin note"}
              >
                <Pin className="size-4" />
              </button>
            </div>

            {/* Content Area */}
            <textarea
              autoFocus
              rows={8}
              value={draftContent}
              onChange={(e) => setDraftContent(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
                  e.preventDefault();
                  saveAndCloseLightbox();
                } else if (e.key === "Escape") {
                  saveAndCloseLightbox();
                }
              }}
              placeholder="Take a note..."
              className="w-full resize-none bg-transparent text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
            />

            {/* Edited Timestamp */}
            <div className="flex justify-end">
              <span className="text-[11px] text-muted-foreground">
                Edited{" "}
                {new Date().toLocaleDateString([], {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            </div>

            {/* Google Keep Bottom Action Bar */}
            <div className="flex items-center justify-between pt-2 border-t border-border/50">
              <div className="relative flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setShowLightboxPalette((prev) => !prev)}
                  className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
                  title="Background options"
                >
                  <Palette className="size-4" />
                </button>

                {showLightboxPalette && (
                  <div className="absolute bottom-11 left-0 z-30 flex items-center gap-1.5 rounded-xl border border-border bg-popover p-2 shadow-float">
                    {NOTE_COLORS.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setDraftColor(c.id);
                          setShowLightboxPalette(false);
                        }}
                        className={cn(
                          "size-5 rounded-full border transition cursor-pointer flex items-center justify-center",
                          draftColor === c.id
                            ? "ring-2 ring-primary scale-110"
                            : "opacity-80 hover:opacity-100"
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
                )}

                {editingNoteId && (
                  <button
                    type="button"
                    onClick={async (e) => {
                      await handleDeleteNote(e, editingNoteId);
                      setIsLightboxOpen(false);
                      setEditingNoteId(null);
                    }}
                    className="rounded-full p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition cursor-pointer"
                    title="Delete note"
                  >
                    <Trash2 className="size-4" />
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={saveAndCloseLightbox}
                className="rounded-lg px-4 py-1.5 text-xs font-semibold text-foreground hover:bg-muted transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
