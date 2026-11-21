import { isOwner, unauthorized } from "@/lib/auth";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

// Everything, hidden stories and internal notes included. Owner only.
export async function GET(req: Request) {
  if (!isOwner(req)) return unauthorized();
  const store = await getStore();
  const stories = (await store.listStories()).sort((a, b) => Date.parse(b.takenAt) - Date.parse(a.takenAt));
  return Response.json({ stories });
}
