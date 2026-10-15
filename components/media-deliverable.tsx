"use client";

import React, { useState, useRef } from "react";
import {
  Upload,
  Link as LinkIcon,
  FileVideo,
  FileImage,
  FileText,
  ExternalLink,
  CheckCircle2,
  AlertTriangle,
  X,
  Play,
  Download,
  Trash2,
  HardDrive,
  Loader2,
} from "lucide-react";
import { DeliverableAsset } from "@/lib/types";
import { Button } from "./ui/button";
import { Input } from "./ui/field";
import { cn } from "@/lib/utils";

interface MediaDeliverableProps {
  taskId: string;
  deliverableUrl?: string;
  deliverableAsset?: DeliverableAsset;
  onSave: (url: string, asset?: DeliverableAsset) => Promise<void>;
  disabled?: boolean;
}

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20 MB

export function MediaDeliverable({
  taskId,
  deliverableUrl,
  deliverableAsset,
  onSave,
  disabled = false,
}: MediaDeliverableProps) {
  const [activeTab, setActiveTab] = useState<"upload" | "drive">("upload");
  const [driveUrlInput, setDriveUrlInput] = useState(
    deliverableAsset?.isDriveLink || !deliverableAsset ? deliverableUrl || "" : ""
  );
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showVideoModal, setShowVideoModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check if existing asset is video or image
  const isVideo =
    deliverableAsset?.type?.includes("video") ||
    deliverableUrl?.endsWith(".mp4") ||
    deliverableUrl?.endsWith(".mov") ||
    deliverableUrl?.endsWith(".webm") ||
    deliverableUrl?.includes("youtube.com") ||
    deliverableUrl?.includes("youtu.be") ||
    deliverableUrl?.includes("loom.com");

  const isImage =
    deliverableAsset?.type?.includes("image") ||
    deliverableUrl?.endsWith(".png") ||
    deliverableUrl?.endsWith(".jpg") ||
    deliverableUrl?.endsWith(".jpeg") ||
    deliverableUrl?.endsWith(".webp");

  const isDrive =
    deliverableAsset?.isDriveLink ||
    deliverableUrl?.includes("drive.google.com") ||
    deliverableUrl?.includes("dropbox.com") ||
    deliverableUrl?.includes("onedrive.live.com");

  // Handle local file selection with strict 20MB limit
  const handleFileChange = async (file: File) => {
    setErrorMessage(null);

    // Strict 20MB check
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      setErrorMessage(
        `File is ${sizeMb}MB. Uploads are strictly capped at 20MB. Please compress your media or upload via Google Drive link below.`
      );
      return;
    }

    try {
      setIsUploading(true);
      const formData = new FormData();
      formData.append("file", file);

      // Uploads to local server storage (NEVER to Supabase storage)
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Upload failed");
      }

      const asset: DeliverableAsset = data.asset;
      await onSave(asset.url, asset);
    } catch (err: any) {
      setErrorMessage(err.message || "Failed to upload file");
    } finally {
      setIsUploading(false);
    }
  };

  const handleDriveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driveUrlInput.trim()) return;

    setErrorMessage(null);
    const url = driveUrlInput.trim();
    const asset: DeliverableAsset = {
      name: url.includes("drive.google.com")
        ? "Google Drive Deliverable"
        : "Cloud Asset Link",
      url,
      uploadedAt: new Date().toISOString(),
      isDriveLink: true,
      type: "cloud/drive",
    };

    await onSave(url, asset);
  };

  const handleRemoveAsset = async () => {
    if (confirm("Remove this deliverable asset?")) {
      await onSave("", undefined);
      setDriveUrlInput("");
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <HardDrive className="size-4 text-primary" />
          <span className="text-xs font-bold text-foreground">
            Deliverable & Media Asset
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold">
            Max 20MB / Drive Link
          </span>
        </div>

        {/* Existing Asset Actions */}
        {(deliverableUrl || deliverableAsset) && !disabled && (
          <button
            type="button"
            onClick={handleRemoveAsset}
            className="text-[11px] text-destructive hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Trash2 className="size-3" />
            <span>Remove</span>
          </button>
        )}
      </div>

      {/* Active Deliverable Preview Card */}
      {deliverableUrl ? (
        <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {isVideo ? (
                <FileVideo className="size-4 text-indigo-500 shrink-0" />
              ) : isImage ? (
                <FileImage className="size-4 text-emerald-500 shrink-0" />
              ) : isDrive ? (
                <HardDrive className="size-4 text-amber-500 shrink-0" />
              ) : (
                <FileText className="size-4 text-primary shrink-0" />
              )}
              <span className="text-xs font-semibold text-foreground truncate">
                {deliverableAsset?.name || deliverableUrl}
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {deliverableAsset?.size && (
                <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {(deliverableAsset.size / (1024 * 1024)).toFixed(2)} MB
                </span>
              )}
              <a
                href={deliverableUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary text-xs hover:underline flex items-center gap-1 font-medium"
              >
                <span>{isDrive ? "Open in Drive" : "Open Asset"}</span>
                <ExternalLink className="size-3" />
              </a>
            </div>
          </div>

          {/* Embedded Video Player if direct video file */}
          {isVideo && deliverableUrl.startsWith("/uploads/") && (
            <div className="mt-2 rounded-lg overflow-hidden border border-border bg-black/80">
              <video
                src={deliverableUrl}
                controls
                className="w-full max-h-56 object-contain"
                preload="metadata"
              >
                Your browser does not support the video tag.
              </video>
            </div>
          )}

          {/* Embedded Image Thumbnail if image file */}
          {isImage && (
            <div className="mt-2 rounded-lg overflow-hidden border border-border bg-muted/40 max-h-48 flex items-center justify-center">
              <img
                src={deliverableUrl}
                alt="Deliverable asset"
                className="max-h-48 w-auto object-contain rounded"
              />
            </div>
          )}

          {/* Drive Link Card */}
          {isDrive && (
            <div className="rounded-lg bg-card border border-border p-2.5 flex items-center justify-between text-xs">
              <div className="flex items-center gap-2 text-muted-foreground truncate">
                <span className="size-2 rounded-full bg-emerald-500" />
                <span className="truncate">{deliverableUrl}</span>
              </div>
              <a
                href={deliverableUrl}
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline font-semibold flex items-center gap-1 shrink-0 ml-2"
              >
                <span>Launch Link</span>
                <ExternalLink className="size-3" />
              </a>
            </div>
          )}
        </div>
      ) : (
        /* Deliverable Upload Tabs */
        <div className="space-y-3">
          {/* Tab Selector */}
          <div className="flex items-center border border-border rounded-lg p-0.5 bg-muted/40 text-xs font-medium">
            <button
              type="button"
              onClick={() => setActiveTab("upload")}
              className={cn(
                "flex-1 py-1 rounded-md transition text-center cursor-pointer",
                activeTab === "upload"
                  ? "bg-card text-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Direct Upload (≤ 20MB)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("drive")}
              className={cn(
                "flex-1 py-1 rounded-md transition text-center cursor-pointer",
                activeTab === "drive"
                  ? "bg-card text-foreground font-semibold shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              Cloud / Drive Link
            </button>
          </div>

          {/* Tab 1: Direct Upload */}
          {activeTab === "upload" && (
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleFileChange(e.dataTransfer.files[0]);
                }
              }}
              onClick={() => fileInputRef.current?.click()}
              className={cn(
                "border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition flex flex-col items-center justify-center gap-2",
                dragOver
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/20",
                disabled && "opacity-50 pointer-events-none"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="video/*,image/*,.pdf,.zip"
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleFileChange(e.target.files[0]);
                  }
                }}
              />

              {isUploading ? (
                <div className="flex flex-col items-center gap-2 py-2">
                  <Loader2 className="size-6 text-primary animate-spin" />
                  <span className="text-xs font-medium text-foreground">
                    Uploading asset locally (under 20MB policy)...
                  </span>
                </div>
              ) : (
                <>
                  <div className="size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <Upload className="size-4" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-foreground">
                      Click to upload or drag & drop media
                    </span>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Videos (.mp4, .mov), Images (.png, .jpg), documents (Strictly max 20MB)
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Tab 2: Google Drive / Cloud Link */}
          {activeTab === "drive" && (
            <form onSubmit={handleDriveSubmit} className="space-y-2">
              <div className="flex gap-2">
                <Input
                  placeholder="Paste Google Drive, Dropbox, Loom, or YouTube URL..."
                  value={driveUrlInput}
                  onChange={(e) => setDriveUrlInput(e.target.value)}
                  className="text-xs h-8 flex-1 bg-card"
                  disabled={disabled}
                />
                <Button
                  type="submit"
                  size="sm"
                  variant="primary"
                  className="text-xs h-8"
                  disabled={!driveUrlInput.trim() || disabled}
                >
                  Save Link
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                For video files exceeding 20MB, upload to Google Drive and paste the shareable link here.
              </p>
            </form>
          )}

          {/* Error Banner */}
          {errorMessage && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 flex items-start gap-2 text-xs text-destructive">
              <AlertTriangle className="size-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span>{errorMessage}</span>
              </div>
              <button
                type="button"
                onClick={() => setErrorMessage(null)}
                className="text-destructive/70 hover:text-destructive cursor-pointer"
              >
                <X className="size-3.5" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
