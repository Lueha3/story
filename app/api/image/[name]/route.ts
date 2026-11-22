import { promises as fs } from "fs";
import path from "path";
import { databaseUrl } from "@/lib/env";
import { IMAGE_DIR } from "@/lib/store-local";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };

// Local development only: serves images saved under .data/images. In production images come from Vercel Blob.
export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  if (databaseUrl() || !/^[a-z0-9-]+\.(jpg|png|webp|gif)$/.test(name)) {
    return new Response("Not found", { status: 404 });
  }
  try {
    const data = await fs.readFile(path.join(IMAGE_DIR, name));
    return new Response(new Uint8Array(data), {
      headers: { "Content-Type": TYPES[name.split(".").pop() as string], "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
