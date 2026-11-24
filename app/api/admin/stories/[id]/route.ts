import { isOwner, unauthorized } from "@/lib/auth";
import { cleanUrl } from "@/lib/stories";
import { unifyTerms } from "@/lib/terms";
import { getStore } from "@/lib/store";
import { isCategory, type Story } from "@/lib/types";

export const dynamic = "force-dynamic";

type Ctx = { params: Promise<{ id: string }> };

/** Owner fixes: { category } | { link: string | null } | { hidden: boolean } | { itemName } */
export async function PATCH(req: Request, ctx: Ctx) {
  if (!isOwner(req)) return unauthorized();
  const { id } = await ctx.params;
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "요청 형식이 맞지 않아요." }, { status: 400 });
  }
  const patch: Partial<Story> = {};
  if ("category" in body) {
    if (!isCategory(body.category)) return Response.json({ error: "없는 카테고리예요." }, { status: 400 });
    // Picking a category by hand settles the story, even one the AI could not read.
    Object.assign(patch, { category: body.category, sure: true, checked: true, altCategory: null, status: "done" });
  }
  if ("link" in body) {
    if (body.link === null || body.link === "") patch.link = null;
    else {
      const url = cleanUrl(body.link);
      if (!url) return Response.json({ error: "링크 형식이 맞지 않아요." }, { status: 400 });
      patch.link = url;
    }
  }
  if ("hidden" in body) patch.hidden = Boolean(body.hidden);
  if ("timeSale" in body) patch.timeSale = Boolean(body.timeSale);
  if ("saleState" in body) {
    const v = body.saleState;
    if (v !== null && v !== "soldout" && v !== "expired") return Response.json({ error: "없는 표시예요." }, { status: 400 });
    patch.saleState = v;
  }
  if ("itemName" in body && typeof body.itemName === "string") patch.itemName = unifyTerms(body.itemName).slice(0, 80);

  const store = await getStore();
  const story = await store.updateStory(id, patch);
  if (!story) return Response.json({ error: "스토리를 찾지 못했어요." }, { status: 404 });
  return Response.json({ story });
}

export async function DELETE(req: Request, ctx: Ctx) {
  if (!isOwner(req)) return unauthorized();
  const { id } = await ctx.params;
  const store = await getStore();
  const story = await store.getStory(id);
  if (!story) return Response.json({ error: "스토리를 찾지 못했어요." }, { status: 404 });
  await store.deleteStory(id);
  try {
    await store.deleteImage(story.imageUrl);
  } catch (err) {
    console.error("deleteImage failed", err);
  }
  return Response.json({ deleted: id });
}
