import { isOwner, unauthorized } from "@/lib/auth";
import { kstDay } from "@/lib/stats";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

// Visitor totals for the admin page.
export async function GET(req: Request) {
  if (!isOwner(req)) return unauthorized(req);
  try {
    return Response.json(await (await getStore()).stats(kstDay(Date.now())));
  } catch (err) {
    console.error("stats failed", err);
    return Response.json({ error: "통계를 불러오지 못했어요." }, { status: 500 });
  }
}
