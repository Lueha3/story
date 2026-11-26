import { isOwner, unauthorized } from "@/lib/auth";
import { CURATOR_ONLY, cleanUrl, isCuratorLink } from "@/lib/stories";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Gives many stories their product links at once. Body: { "pairs": [{ "id": "...", "link": "https://..." }, ...] }
export async function POST(req: Request) {
  if (!isOwner(req)) return unauthorized(req);
  let pairs: unknown;
  try {
    pairs = ((await req.json()) as { pairs?: unknown }).pairs;
  } catch {
    pairs = null;
  }
  if (!Array.isArray(pairs) || !pairs.length) return Response.json({ error: "넣을 링크가 없어요." }, { status: 400 });
  const clean: { id: string; link: string }[] = [];
  for (const p of pairs) {
    const id = p && typeof p === "object" && typeof (p as { id?: unknown }).id === "string" ? (p as { id: string }).id : null;
    const link = cleanUrl(p && typeof p === "object" ? (p as { link?: unknown }).link : null);
    if (!id || !link) return Response.json({ error: "링크 형식이 맞지 않는 줄이 있어요." }, { status: 400 });
    if (!isCuratorLink(link)) return Response.json({ error: CURATOR_ONLY + " 아닌 링크: " + link }, { status: 400 });
    clean.push({ id, link });
  }
  const store = await getStore();
  let saved = 0;
  for (const p of clean) {
    if (await store.updateStory(p.id, { link: p.link })) saved += 1;
  }
  return Response.json({ saved });
}
