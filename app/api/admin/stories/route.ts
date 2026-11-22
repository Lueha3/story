import { isOwner, unauthorized } from "@/lib/auth";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

// Everything, hidden stories and internal notes included. Owner only.
export async function GET(req: Request) {
  if (!isOwner(req)) return unauthorized();
  let all;
  try {
    all = await (await getStore()).listStories();
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "목록을 불러오지 못했어요." }, { status: 503 });
  }
  const stories = all.sort((a, b) => Date.parse(b.takenAt) - Date.parse(a.takenAt));
  return Response.json({ stories });
}
