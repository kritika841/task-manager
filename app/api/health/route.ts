import fs from "node:fs";
import path from "node:path";
import { NextResponse } from "next/server";

export async function GET() {
  const dataDir = path.join(process.cwd(), "data");
  const dbPath = path.join(dataDir, "local-db.json");
  let storageWritable = false;
  let dbPresent = false;

  try {
    fs.mkdirSync(dataDir, { recursive: true });
    fs.accessSync(dataDir, fs.constants.R_OK | fs.constants.W_OK);
    storageWritable = true;
    dbPresent = fs.existsSync(dbPath);
  } catch {}

  const healthy = storageWritable;
  return NextResponse.json(
    {
      ok: healthy,
      status: healthy ? "healthy" : "degraded",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      storageWritable,
      dbPresent,
    },
    { status: healthy ? 200 : 503, headers: { "Cache-Control": "no-store" } }
  );
}
