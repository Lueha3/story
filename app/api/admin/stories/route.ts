import { isOwner, unauthorized } from "@/lib/auth";
import { getStore } from "@/lib/store";
import { unifyTerms } from "@/lib/terms";
import { byNewest, orderTime } from "@/lib/types";

export const dynamic = "force-dynamic";

// Everything, hidden stories and internal notes included. Owner only.
export async function GET(req: Request) {
  if (!isOwner(req)) return unauthorized(req);
  let all;
  try {
    all = await (await getStore()).listStories();
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "목록을 불러오지 못했어요." }, { status: 503 });
  }
  // the time shown is the one the list is ordered by
  // and names use one spelling per term (older stories included)
  const stories = all.sort(byNewest).map((s) => ({ ...s, itemName: unifyTerms(s.itemName), takenAt: new Date(orderTime(s)).toISOString() }));
  return Response.json({ stories });
}
