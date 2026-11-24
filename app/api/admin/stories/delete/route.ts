import { isOwner, unauthorized } from "@/lib/auth";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Deletes several stories, pictures included. Body: { "ids": ["...", ...] }
export async function POST(req: Request) {
  if (!isOwner(req)) return unauthorized(req);
  let ids: unknown;
  try {
    ids = ((await req.json()) as { ids?: unknown }).ids;
  } catch {
    ids = null;
  }
  if (!Array.isArray(ids) || !ids.length || ids.some((v) => typeof v !== "string")) {
    return Response.json({ error: "지울 스토리를 골라주세요." }, { status: 400 });
  }
  const store = await getStore();
  const deleted: string[] = [];
  for (const id of ids as string[]) {
    const s = await store.getStory(id);
    if (!s) continue;
    await store.deleteStory(id);
    await store.deleteImage(s.imageUrl).catch((err) => console.error("deleteImage failed", err));
    deleted.push(id);
  }
  return Response.json({ deleted });
}
