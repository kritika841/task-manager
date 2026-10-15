"use client";

import React, { useState, useRef, useEffect } from "react";
import { Send, User as UserIcon, Trash2, AtSign, Smile } from "lucide-react";
import { TaskComment, User } from "@/lib/types";
import { Button } from "./ui/button";
import { Input } from "./ui/field";
import { Markdown } from "./ui/markdown";
import { formatDate, cn } from "@/lib/utils";

interface CommentThreadProps {
  taskId: string;
  comments?: TaskComment[];
  users: User[];
  currentUserId: string;
  isAdmin: boolean;
  onAddComment: (content: string, mentions?: string[]) => Promise<void>;
  onDeleteComment: (commentId: string) => Promise<void>;
}

export function CommentThread({
  taskId,
  comments = [],
  users,
  currentUserId,
  isAdmin,
  onAddComment,
  onDeleteComment,
}: CommentThreadProps) {
  const [commentText, setCommentText] = useState("");
  const [mentions, setMentions] = useState<string[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionPosition, setMentionPosition] = useState<number>(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter users matching mention query
  const mentionSuggestions = users.filter((u) => {
    if (mentionQuery === null) return false;
    if (!mentionQuery) return true;
    return (
      u.name.toLowerCase().includes(mentionQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(mentionQuery.toLowerCase())
    );
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCommentText(val);

    // Detect @ symbol before cursor
    const cursor = e.target.selectionStart || 0;
    const textBeforeCursor = val.slice(0, cursor);
    const lastAtIndex = textBeforeCursor.lastIndexOf("@");

    if (lastAtIndex !== -1) {
      const query = textBeforeCursor.slice(lastAtIndex + 1);
      // Only match if no spaces inside mention query
      if (!query.includes(" ")) {
        setMentionQuery(query);
        setMentionPosition(lastAtIndex);
        return;
      }
    }
    setMentionQuery(null);
  };

  const handleSelectMention = (user: User) => {
    const beforeMention = commentText.slice(0, mentionPosition);
    const afterMention = commentText.slice(
      mentionPosition + (mentionQuery ? mentionQuery.length + 1 : 1)
    );
    const newText = `${beforeMention}@${user.name} ${afterMention}`;
    setCommentText(newText);
    setMentions((prev) => Array.from(new Set([...prev, user.id])));
    setMentionQuery(null);
    inputRef.current?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await onAddComment(commentText.trim(), mentions);
      setCommentText("");
      setMentions([]);
      setMentionQuery(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Persistent Discussion & Notes ({comments.length})
        </span>
        <span className="text-[10px] text-muted-foreground font-mono">
          Type @ to mention team members
        </span>
      </div>

      {/* Comment Form */}
      <div className="relative">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Input
              ref={inputRef}
              placeholder="Write an update, question, or type @ to mention..."
              value={commentText}
              onChange={handleInputChange}
              className="text-xs h-8.5 bg-card pr-8"
              disabled={isSubmitting}
            />
            <button
              type="button"
              onClick={() => {
                setCommentText((prev) => prev + "@");
                setMentionQuery("");
                setMentionPosition(commentText.length);
                inputRef.current?.focus();
              }}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-primary transition cursor-pointer"
              title="Mention team member"
            >
              <AtSign className="size-3.5" />
            </button>
          </div>

          <Button
            type="submit"
            size="sm"
            variant="primary"
            className="h-8.5 text-xs gap-1 shadow-xs"
            disabled={!commentText.trim() || isSubmitting}
          >
            <Send className="size-3" />
            <span>Send</span>
          </Button>
        </form>

        {/* Mention Suggestions Popover */}
        {mentionQuery !== null && mentionSuggestions.length > 0 && (
          <div className="absolute left-0 bottom-full mb-1 z-50 w-64 rounded-xl border border-border bg-card p-1.5 shadow-float max-h-48 overflow-y-auto">
            <div className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase">
              Mention Team Member
            </div>
            {mentionSuggestions.slice(0, 5).map((user) => (
              <button
                key={user.id}
                type="button"
                onClick={() => handleSelectMention(user)}
                className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-muted/60 transition flex items-center gap-2 cursor-pointer"
              >
                <div className="size-5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold flex items-center justify-center shrink-0">
                  {user.avatar}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-foreground truncate">
                    {user.name}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {user.role} • {user.department}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Comments List */}
      <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
        {comments.map((c) => {
          const author = users.find((u) => u.id === c.userId);
          const isAuthorOrAdmin = c.userId === currentUserId || isAdmin;

          return (
            <div
              key={c.id}
              className="rounded-xl border border-border/80 bg-muted/20 p-3 text-xs space-y-1 group/comment"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="size-5 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center">
                    {author?.avatar || "TM"}
                  </div>
                  <span className="font-semibold text-foreground">
                    {author?.name || c.userName || "Team Member"}
                  </span>
                  {author?.role && (
                    <span className="text-[9px] uppercase font-mono px-1 py-0.2 rounded bg-muted text-muted-foreground">
                      {author.role}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {formatDate(c.createdAt)}
                  </span>
                  {isAuthorOrAdmin && (
                    <button
                      type="button"
                      onClick={() => onDeleteComment(c.id)}
                      className="opacity-0 group-hover/comment:opacity-100 text-muted-foreground hover:text-destructive transition p-0.5"
                      title="Delete comment"
                    >
                      <Trash2 className="size-3" />
                    </button>
                  )}
                </div>
              </div>

              {/* Comment Content with Markdown & Mentions */}
              <div className="pt-0.5">
                <Markdown content={c.content} />
              </div>
            </div>
          );
        })}

        {comments.length === 0 && (
          <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
            No persistent comments yet. Add a note or @mention to notify someone.
          </div>
        )}
      </div>
    </div>
  );
}
