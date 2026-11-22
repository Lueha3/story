import { promises as fs } from "fs";
import path from "path";
import { blobConfigured, databaseUrl } from "@/lib/env";
import { IMAGE_DIR } from "@/lib/store-local";
import { readPrivateImage } from "@/lib/store-vercel";

export const dynamic = "force-dynamic";

const TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };
// Saved pictures never change under the same name, so browsers and Vercel's CDN may keep them for good.
const CACHE = "public, max-age=31536000, s-maxage=31536000, immutable";

// Serves story pictures: from a private Vercel Blob store in production, from .data/images locally.
export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  if (!/^[a-z0-9-]+\.(jpg|png|webp|gif)$/.test(name)) return new Response("Not found", { status: 404 });

  if (databaseUrl()) {
    if (!blobConfigured()) return new Response("Not found", { status: 404 });
    try {
      const r = await readPrivateImage(name);
      if (!r) return new Response("Not found", { status: 404 });
      return new Response(r.stream, { headers: { "Content-Type": r.blob.contentType || TYPES[name.split(".").pop() as string], "Cache-Control": CACHE } });
    } catch (err) {
      console.error("readPrivateImage failed", err);
      return new Response("Not found", { status: 404 });
    }
  }

  try {
    const data = await fs.readFile(path.join(IMAGE_DIR, name));
    return new Response(new Uint8Array(data), { headers: { "Content-Type": TYPES[name.split(".").pop() as string], "Cache-Control": CACHE } });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
