import { NextResponse } from "next/server";
import { writeFile, mkdir } from "node:fs/promises";
import path from "node:path";

// Strict 20MB Limit in bytes
const MAX_UPLOAD_SIZE = 20 * 1024 * 1024; // 20 MB

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Strict 20MB limit validation
    if (file.size > MAX_UPLOAD_SIZE) {
      const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
      return NextResponse.json(
        {
          error: `File size (${sizeMb}MB) exceeds the 20MB limit. Enterprise policy: Direct uploads are capped at 20MB. Please compress your file or provide a Google Drive / cloud asset link instead.`,
        },
        { status: 400 }
      );
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Save to public/uploads directory (Never to Supabase)
    const uploadsDir = path.join(process.cwd(), "public", "uploads");
    await mkdir(uploadsDir, { recursive: true });

    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, "_");
    const uniqueName = `${Date.now()}-${safeName}`;
    const filePath = path.join(uploadsDir, uniqueName);

    await writeFile(filePath, buffer);

    const publicUrl = `/uploads/${uniqueName}`;

    return NextResponse.json({
      ok: true,
      asset: {
        name: file.name,
        url: publicUrl,
        size: file.size,
        type: file.type || "application/octet-stream",
        uploadedAt: new Date().toISOString(),
        isDriveLink: false,
      },
    });
  } catch (error: any) {
    console.error("Local media upload error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to upload media file" },
      { status: 500 }
    );
  }
}
