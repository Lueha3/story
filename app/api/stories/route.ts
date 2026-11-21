import { getStore } from "@/lib/store";
import { toPublic } from "@/lib/types";

export const dynamic = "force-dynamic";

// Public list for the site: visible, sorted stories, newest first.
export async function GET() {
  const store = await getStore();
  const stories = (await store.listStories())
    .filter((s) => !s.hidden && s.status !== "pending")
    .sort((a, b) => Date.parse(b.takenAt) - Date.parse(a.takenAt))
    .map(toPublic);
  return Response.json(
    { stories, updatedAt: stories[0]?.takenAt ?? null, instagram: (process.env.IG_HANDLE || "").replace(/^@/, "") },
    { headers: { "Cache-Control": "public, max-age=0, s-maxage=30, stale-while-revalidate=60" } },
  );
}
