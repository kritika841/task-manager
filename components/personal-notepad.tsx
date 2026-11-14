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
} from "lucide-react";
import { useTasks } from "@/lib/store";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

export interface PersonalNoteEntry {
  id: string;
  title: string;
  content: string;
  updatedAt: string;
}

interface PersonalNotepadProps {
  isOpen: boolean;
  onClose: () => void;
}

export function PersonalNotepad({ isOpen, onClose }: PersonalNotepadProps) {
  const { currentUser, currentUserId, createTask } = useTasks();

  const [notes, setNotes] = useState<PersonalNoteEntry[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">(
    "idle"
  );
  const [taskCreatedToast, setTaskCreatedToast] = useState(false);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadedUserRef = useRef<string | null>(null);

  const storageKey = `satmi_private_notepad_${currentUserId}`;

  const createDefaultNote = (): PersonalNoteEntry => ({
    id: `note-${Date.now()}`,
    title: "Quick Notes",
    content: "",
    updatedAt: new Date().toISOString(),
  });

  const loadNotepad = useCallback(async (uid: string) => {
    if (!uid) return;
    setLoading(true);
    try {
      const res = await fetch(
        `/api/notepad?userId=${encodeURIComponent(uid)}`,
        {
          headers: { "x-user-id": uid },
        }
      );
      if (res.ok) {
        const data = await res.json();
        const pad = data?.notepad || data;
        let fetchedNotes: PersonalNoteEntry[] = Array.isArray(pad?.notes)
          ? pad.notes
          : [];
        if (fetchedNotes.length === 0 && typeof pad?.content === "string" && pad.content.trim()) {
          fetchedNotes = [
            {
              id: "note-main",
              title: "Quick Notes",
              content: pad.content,
              updatedAt: pad.updatedAt || new Date().toISOString(),
            },
          ];
        }
        if (fetchedNotes.length === 0) {
          // Check local backup scoped strictly to uid
          try {
            const raw = localStorage.getItem(`satmi_private_notepad_${uid}`);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed?.notes) && parsed.notes.length > 0) {
                fetchedNotes = parsed.notes;
              }
            }
          } catch {
            // ignore
          }
        }
        if (fetchedNotes.length === 0) {
          fetchedNotes = [createDefaultNote()];
        }
        setNotes(fetchedNotes);
        setActiveNoteId(fetchedNotes[0].id);
        loadedUserRef.current = uid;
        return;
      }
    } catch {
      // Fallback to per-user localStorage
    } finally {
      setLoading(false);
    }

    try {
      const raw = localStorage.getItem(`satmi_private_notepad_${uid}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed?.notes) && parsed.notes.length > 0) {
          setNotes(parsed.notes);
          setActiveNoteId(parsed.notes[0].id);
          loadedUserRef.current = uid;
          return;
        }
      }
    } catch {
      // ignore
    }
    const fallback = [createDefaultNote()];
    setNotes(fallback);
    setActiveNoteId(fallback[0].id);
    loadedUserRef.current = uid;
  }, []);

  // Reload whenever modal opens or user switches account
  useEffect(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (isOpen && currentUserId) {
      loadNotepad(currentUserId);
    }
  }, [isOpen, currentUserId, loadNotepad]);

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
      } catch {
        // ignore storage quota errors
      }

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
        // local copy already saved
      } finally {
        setSaveState("saved");
      }
    },
    []
  );

  const scheduleSave = (updatedNotes: PersonalNoteEntry[]) => {
    setNotes(updatedNotes);
    setSaveState("saving");
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
    }
    const uid = currentUserId;
    saveTimerRef.current = setTimeout(() => {
      persistNotes(updatedNotes, uid);
    }, 450);
  };

  if (!isOpen) return null;

  const activeNote =
    notes.find((n) => n.id === activeNoteId) || notes[0] || createDefaultNote();

  const handleUpdateActiveNote = (
    field: "title" | "content",
    value: string
  ) => {
    const updated = notes.map((n) =>
      n.id === activeNote.id
        ? { ...n, [field]: value, updatedAt: new Date().toISOString() }
        : n
    );
    scheduleSave(updated);
  };

  const handleAddNote = () => {
    const newNote: PersonalNoteEntry = {
      id: `note-${Date.now()}`,
      title: `Note ${notes.length + 1}`,
      content: "",
      updatedAt: new Date().toISOString(),
    };
    const updated = [...notes, newNote];
    setActiveNoteId(newNote.id);
    scheduleSave(updated);
  };

  const handleDeleteNote = (id: string) => {
    if (notes.length <= 1) {
      const reset = [{ ...activeNote, title: "Quick Notes", content: "" }];
      setActiveNoteId(reset[0].id);
      scheduleSave(reset);
      return;
    }
    const updated = notes.filter((n) => n.id !== id);
    if (activeNote.id === id) {
      setActiveNoteId(updated[0].id);
    }
    scheduleSave(updated);
  };

  const handleCreateSelfTaskFromNote = async () => {
    const titleText =
      activeNote.title.trim() && activeNote.title !== "Quick Notes"
        ? activeNote.title.trim()
        : activeNote.content.split("\n")[0]?.trim() || "Personal task";
    if (!titleText) return;
    const today = new Date().toISOString().split("T")[0];
    await createTask({
      title: titleText.slice(0, 100),
      description: activeNote.content.trim(),
      priority: "medium",
      status: "todo",
      assigneeId: currentUserId,
      dueDate: today,
      targetQuantity: 1,
    });
    setTaskCreatedToast(true);
    setTimeout(() => setTaskCreatedToast(false), 1800);
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-foreground/20 backdrop-blur-xs">
      <div className="relative flex h-full w-full max-w-md flex-col border-l border-border bg-card text-card-foreground shadow-float animate-in slide-in-from-right duration-150">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2 min-w-0">
            <StickyNote className="size-4 text-primary shrink-0" />
            <h2 className="text-sm font-semibold text-foreground truncate">
              Personal Notepad
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/25 px-2 py-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 shrink-0">
              <Lock className="size-2.5" />
              <span>Only {currentUser.name.split(" ")[0]}</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              {saveState === "saving" && (
                <>
                  <Loader2 className="size-3 animate-spin" />
                  <span>Saving</span>
                </>
              )}
              {saveState === "saved" && (
                <>
                  <Check className="size-3 text-emerald-500" />
                  <span>Saved</span>
                </>
              )}
            </span>
            <button
              type="button"
              onClick={() => {
                if (saveTimerRef.current) {
                  clearTimeout(saveTimerRef.current);
                  persistNotes(notes, currentUserId);
                }
                onClose();
              }}
              className="rounded-lg p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition cursor-pointer"
            >
              <X className="size-4" />
            </button>
          </div>
        </div>

        {/* Note Tabs Bar */}
        <div className="flex items-center gap-1.5 border-b border-border bg-muted/30 px-3 py-2 overflow-x-auto">
          {notes.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => setActiveNoteId(n.id)}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-medium truncate max-w-[130px] transition cursor-pointer shrink-0",
                n.id === activeNote.id
                  ? "bg-card text-foreground shadow-2xs border border-border font-semibold"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
            >
              {n.title || "Untitled"}
            </button>
          ))}
          <button
            type="button"
            onClick={handleAddNote}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition cursor-pointer shrink-0"
            title="New note tab"
          >
            <Plus className="size-3.5" />
            <span>New</span>
          </button>
        </div>

        {/* Editor Area */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground gap-2">
            <Loader2 className="size-4 animate-spin" />
            <span>Loading private notes...</span>
          </div>
        ) : (
          <div className="flex-1 flex flex-col p-4 gap-3 min-h-0">
            <div className="flex items-center justify-between gap-2">
              <input
                type="text"
                value={activeNote.title}
                onChange={(e) => handleUpdateActiveNote("title", e.target.value)}
                placeholder="Note title..."
                className="flex-1 bg-transparent text-sm font-semibold text-foreground placeholder:text-muted-foreground focus:outline-none border-b border-transparent focus:border-border pb-1"
              />
              <button
                type="button"
                onClick={() => handleDeleteNote(activeNote.id)}
                className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition cursor-pointer"
                title="Clear or delete note"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>

            <textarea
              value={activeNote.content}
              onChange={(e) => handleUpdateActiveNote("content", e.target.value)}
              placeholder="Write private notes, links, daily scratchpad, or checklists here..."
              className="flex-1 w-full resize-none rounded-xl border border-border bg-background/60 p-3.5 text-xs leading-relaxed text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />

            {taskCreatedToast && (
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/25 px-3 py-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                Added to your tasks!
              </div>
            )}

            <div className="flex items-center justify-between pt-1 border-t border-border">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleCreateSelfTaskFromNote}
                disabled={!activeNote.content.trim() && !activeNote.title.trim()}
                className="gap-1.5 text-xs h-8"
              >
                <ListPlus className="size-3.5 text-primary" />
                <span>Convert to My Task</span>
              </Button>

              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => persistNotes(notes, currentUserId)}
                className="text-xs h-8"
              >
                Save Note
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
