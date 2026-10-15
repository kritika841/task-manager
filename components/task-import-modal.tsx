"use client";

import React, { useState } from "react";
import { Upload, X, FileText, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "./ui/button";
import { Textarea } from "./ui/field";
import { useTasks } from "@/lib/store";
import { TaskPriority, TaskStatus } from "@/lib/types";

interface TaskImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TaskImportModal({ isOpen, onClose }: TaskImportModalProps) {
  const { importTasksFromCSV, users } = useTasks();
  const [csvText, setCsvText] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const sampleCsv = `Title,Priority,TargetUnits,DueDate,DeliverableUrl
Ad Hook Cut 1,high,4,2026-10-15,https://drive.google.com/sample
UGC Script Writing,urgent,2,2026-10-14,
Color Grading Reel,medium,6,2026-10-16,https://drive.google.com/sample2`;

  const handleImport = async () => {
    if (!csvText.trim()) return;

    try {
      setIsImporting(true);
      setStatusMessage(null);

      const lines = csvText.trim().split("\n");
      if (lines.length < 2) {
        throw new Error("CSV must have a header row and at least one data row.");
      }

      const headers = lines[0].split(",").map((h) => h.trim().toLowerCase());
      const titleIdx = headers.findIndex((h) => h.includes("title") || h.includes("name"));
      const priorityIdx = headers.findIndex((h) => h.includes("priority"));
      const unitsIdx = headers.findIndex((h) => h.includes("unit") || h.includes("target") || h.includes("quantity"));
      const dueDateIdx = headers.findIndex((h) => h.includes("date") || h.includes("due"));
      const deliverableIdx = headers.findIndex((h) => h.includes("url") || h.includes("deliverable") || h.includes("link"));

      if (titleIdx === -1) {
        throw new Error("Could not find 'Title' column in header.");
      }

      const tasksToImport: any[] = [];

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Basic CSV line parser handling commas
        const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
        const title = cols[titleIdx];
        if (!title) continue;

        const priorityRaw = priorityIdx !== -1 ? cols[priorityIdx]?.toLowerCase() : "medium";
        const priority: TaskPriority = ["urgent", "high", "medium", "low"].includes(priorityRaw)
          ? (priorityRaw as TaskPriority)
          : "medium";

        const units = unitsIdx !== -1 ? parseInt(cols[unitsIdx]) || 1 : 1;
        const dueDate = dueDateIdx !== -1 && cols[dueDateIdx] ? cols[dueDateIdx] : undefined;
        const deliverableUrl = deliverableIdx !== -1 ? cols[deliverableIdx] : undefined;

        tasksToImport.push({
          title,
          priority,
          targetQuantity: units,
          dueDate,
          deliverableUrl,
          status: "todo" as TaskStatus,
        });
      }

      await importTasksFromCSV(tasksToImport);
      setStatusMessage(`Successfully imported ${tasksToImport.length} tasks!`);
      setTimeout(() => {
        onClose();
        setCsvText("");
        setStatusMessage(null);
      }, 1500);
    } catch (err: any) {
      setStatusMessage(`Error: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setCsvText((event.target?.result as string) || "");
    };
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-foreground/20 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl max-w-lg w-full shadow-float p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-border/60 pb-3">
          <div className="flex items-center gap-2">
            <Upload className="size-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Import Tasks from CSV</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-md"
          >
            <X className="size-4" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          Paste CSV rows below or upload a .csv file. Columns supported: <code>Title, Priority, TargetUnits, DueDate, DeliverableUrl</code>.
        </p>

        <div className="flex items-center justify-between">
          <label className="text-xs text-primary font-semibold hover:underline cursor-pointer flex items-center gap-1.5">
            <Upload className="size-3.5" />
            <span>Select .csv file from computer</span>
            <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
          </label>

          <button
            type="button"
            onClick={() => setCsvText(sampleCsv)}
            className="text-[11px] text-muted-foreground hover:text-foreground underline"
          >
            Insert Sample Template
          </button>
        </div>

        <Textarea
          rows={8}
          placeholder="Title,Priority,TargetUnits,DueDate,DeliverableUrl..."
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          className="text-xs font-mono bg-muted/20"
        />

        {statusMessage && (
          <div
            className={`text-xs p-2.5 rounded-lg flex items-center gap-2 ${
              statusMessage.startsWith("Error")
                ? "bg-destructive/10 text-destructive border border-destructive/20"
                : "bg-success/10 text-success border border-success/20"
            }`}
          >
            {statusMessage.startsWith("Error") ? (
              <AlertCircle className="size-4 shrink-0" />
            ) : (
              <CheckCircle2 className="size-4 shrink-0" />
            )}
            <span>{statusMessage}</span>
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-border/60">
          <Button variant="ghost" size="sm" onClick={onClose} className="text-xs">
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleImport}
            disabled={!csvText.trim() || isImporting}
            className="text-xs"
          >
            {isImporting ? "Importing..." : "Process Import"}
          </Button>
        </div>
      </div>
    </div>
  );
}
