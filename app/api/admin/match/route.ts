import { isOwner, unauthorized } from "@/lib/auth";
import { matchLinks, type LinkIn } from "@/lib/match";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Asks the AI which story each pasted link belongs to. Nothing is saved here; the admin page shows
// the pairs for checking and saves them through /api/admin/stories/links.
// Body: { "links": [{ "url": "...", "hint": "..." }], "storyIds": ["..."] }
export async function POST(req: Request) {
  if (!isOwner(req)) return unauthorized(req);
  let body: { links?: unknown; storyIds?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "요청 형식이 맞지 않아요." }, { status: 400 });
  }
  const links = Array.isArray(body.links) ? body.links : [];
  const ids = Array.isArray(body.storyIds) ? body.storyIds.filter((v): v is string => typeof v === "string") : [];
  const clean: LinkIn[] = links
    .filter((l): l is { url: unknown; hint: unknown } => Boolean(l) && typeof l === "object")
    .map((l) => ({ url: String(l.url ?? ""), hint: String(l.hint ?? "").slice(0, 300) }));
  if (!clean.length || !ids.length) return Response.json({ error: "링크와 스토리가 모두 있어야 해요." }, { status: 400 });
  if (clean.length > 120 || ids.length > 120) return Response.json({ error: "한 번에 120개까지 짝지을 수 있어요." }, { status: 400 });
  try {
    return Response.json({ matches: await matchLinks(clean, ids) });
  } catch (err) {
    console.error("matchLinks failed", err);
    return Response.json({ error: err instanceof Error ? err.message : "짝을 찾지 못했어요." }, { status: 500 });
  }
}
