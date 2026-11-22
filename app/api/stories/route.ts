import { getStore } from "@/lib/store";
import { toPublic } from "@/lib/types";

export const dynamic = "force-dynamic";

// Public list for the site: visible, sorted stories, newest first.
export async function GET() {
  let all;
  let avatar: string | null = null;
  try {
    const store = await getStore();
    all = await store.listStories();
    avatar = await store.getSetting("avatar");
  } catch (err) {
    console.error("listStories failed", err);
    return Response.json({ error: "스토리를 불러오지 못했어요." }, { status: 503 });
  }
  const stories = all
    .filter((s) => !s.hidden && s.status !== "pending")
    .sort((a, b) => Date.parse(b.takenAt) - Date.parse(a.takenAt))
    .map(toPublic);
  return Response.json(
    { stories, updatedAt: stories[0]?.takenAt ?? null, instagram: (process.env.IG_HANDLE || "").replace(/^@/, ""), avatar },
    { headers: { "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=60" } },
  );
}
