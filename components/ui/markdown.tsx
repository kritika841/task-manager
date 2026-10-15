"use client";

import React, { useMemo } from "react";
import { cn } from "@/lib/utils";

interface MarkdownProps {
  content: string;
  className?: string;
}

export function Markdown({ content, className }: MarkdownProps) {
  const rendered = useMemo(() => {
    if (!content) return null;

    // Split lines
    const lines = content.split("\n");
    const elements: React.ReactNode[] = [];

    let inCodeBlock = false;
    let codeBuffer: string[] = [];
    let codeKey = 0;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Code block
      if (line.trim().startsWith("```")) {
        if (inCodeBlock) {
          elements.push(
            <pre
              key={`code-${codeKey++}`}
              className="my-2 p-2.5 rounded-lg bg-muted font-mono text-[11px] overflow-x-auto text-foreground border border-border"
            >
              <code>{codeBuffer.join("\n")}</code>
            </pre>
          );
          codeBuffer = [];
          inCodeBlock = false;
        } else {
          inCodeBlock = true;
        }
        continue;
      }

      if (inCodeBlock) {
        codeBuffer.push(line);
        continue;
      }

      // Headers
      if (line.startsWith("### ")) {
        elements.push(
          <h3 key={i} className="text-xs font-bold text-foreground mt-2 mb-1">
            {formatInline(line.slice(4))}
          </h3>
        );
        continue;
      }
      if (line.startsWith("## ")) {
        elements.push(
          <h2 key={i} className="text-sm font-bold text-foreground mt-2.5 mb-1">
            {formatInline(line.slice(3))}
          </h2>
        );
        continue;
      }
      if (line.startsWith("# ")) {
        elements.push(
          <h1 key={i} className="text-base font-bold text-foreground mt-3 mb-1.5">
            {formatInline(line.slice(2))}
          </h1>
        );
        continue;
      }

      // Checklists
      if (line.trim().startsWith("- [ ] ") || line.trim().startsWith("- [x] ")) {
        const checked = line.trim().startsWith("- [x] ");
        const text = line.trim().slice(6);
        elements.push(
          <div key={i} className="flex items-center gap-2 my-1 text-xs">
            <input
              type="checkbox"
              checked={checked}
              readOnly
              className="rounded border-border text-primary size-3.5"
            />
            <span className={cn(checked && "line-through text-muted-foreground")}>
              {formatInline(text)}
            </span>
          </div>
        );
        continue;
      }

      // Bullet points
      if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
        elements.push(
          <div key={i} className="flex items-start gap-1.5 my-0.5 text-xs text-muted-foreground">
            <span className="text-primary mt-1">•</span>
            <span>{formatInline(line.trim().slice(2))}</span>
          </div>
        );
        continue;
      }

      // Empty line
      if (!line.trim()) {
        elements.push(<div key={i} className="h-1.5" />);
        continue;
      }

      // Standard paragraph
      elements.push(
        <p key={i} className="text-xs text-muted-foreground leading-relaxed my-0.5">
          {formatInline(line)}
        </p>
      );
    }

    if (inCodeBlock && codeBuffer.length > 0) {
      elements.push(
        <pre
          key={`code-${codeKey}`}
          className="my-2 p-2.5 rounded-lg bg-muted font-mono text-[11px] overflow-x-auto text-foreground border border-border"
        >
          <code>{codeBuffer.join("\n")}</code>
        </pre>
      );
    }

    return elements;
  }, [content]);

  return <div className={cn("space-y-0.5", className)}>{rendered}</div>;
}

// Inline formatting: bold (**text**), inline code (`code`), @mentions (@Name), and links ([text](url))
function formatInline(text: string): React.ReactNode {
  // Regex splitting for tokens
  const tokenRegex = /(\*\*[^*]+\*\*|`[^`]+`|@[\w.-]+|\[[^\]]+\]\([^)]+\))/g;
  const parts = text.split(tokenRegex);

  return parts.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={idx} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={idx}
          className="px-1 py-0.5 rounded bg-muted font-mono text-[11px] text-primary font-medium"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("@")) {
      return (
        <span
          key={idx}
          className="inline-flex items-center px-1.5 py-0.2 rounded-full text-[11px] font-semibold bg-primary/15 text-primary border border-primary/20 mx-0.5"
        >
          {part}
        </span>
      );
    }
    const linkMatch = part.match(/\[([^\]]+)\]\(([^)]+)\)/);
    if (linkMatch) {
      return (
        <a
          key={idx}
          href={linkMatch[2]}
          target="_blank"
          rel="noreferrer"
          className="text-primary hover:underline font-medium inline-flex items-center gap-0.5"
        >
          {linkMatch[1]}
        </a>
      );
    }
    return part;
  });
}
