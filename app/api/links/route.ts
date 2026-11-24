import { isOwner, unauthorized } from "@/lib/auth";
import { addLink, cleanUrl } from "@/lib/stories";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

/**
 * The "링크 등록" shortcut sends the product link here (body: the link as plain text, or JSON {"url": "..."}).
 * The link joins a story posted in the last 15 minutes that has none, or waits for the next story.
 */
export async function POST(req: Request) {
  if (!isOwner(req)) return unauthorized(req);
  const text = await req.text();
  let raw: unknown = text;
  try {
    const j = JSON.parse(text);
    if (j && typeof j === "object" && "url" in j) raw = (j as { url: unknown }).url;
  } catch {
    // plain text body
  }
  const url = cleanUrl(raw);
  if (!url) return Response.json({ error: "링크를 찾지 못했어요." }, { status: 400 });
  const { link, story } = await addLink(url);
  return Response.json({
    url: link.url,
    attachedTo: story ? { id: story.id, itemName: story.itemName } : null,
    message: story ? "방금 올린 스토리에 연결했어요." : "다음에 올라오는 스토리에 연결할게요.",
  });
}

export async function GET(req: Request) {
  if (!isOwner(req)) return unauthorized(req);
  const store = await getStore();
  return Response.json({ links: await store.listLinks() });
}
