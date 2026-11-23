import { getStore } from "@/lib/store";
import { dayBefore, deviceOf, isBot, kstDay, sourceOf, visitorId, type VisitEvent } from "@/lib/stats";

export const dynamic = "force-dynamic";

const TYPES = new Set(["visit", "view", "click"]);

// The visitor page reports a visit, a story opened, or a product link tapped. Always answers 204,
// so counting can never get in the way of the page.
export async function POST(req: Request) {
  const ua = req.headers.get("user-agent") || "";
  if (isBot(ua)) return new Response(null, { status: 204 });
  let body: { type?: unknown; storyId?: unknown; referrer?: unknown } = {};
  try {
    body = JSON.parse(await req.text());
  } catch {
    return new Response(null, { status: 204 });
  }
  if (typeof body.type !== "string" || !TYPES.has(body.type)) return new Response(null, { status: 204 });
  const now = Date.now();
  const day = kstDay(now);
  const ip = (req.headers.get("x-forwarded-for") || "").split(",")[0].trim() || req.headers.get("x-real-ip") || "";
  const e: VisitEvent = {
    ts: new Date(now).toISOString(),
    day,
    type: body.type as VisitEvent["type"],
    storyId: typeof body.storyId === "string" ? body.storyId.slice(0, 40) : null,
    visitor: visitorId(ip, ua, day),
    source: sourceOf(ua, typeof body.referrer === "string" ? body.referrer : ""),
    device: deviceOf(ua),
  };
  try {
    const store = await getStore();
    await store.addEvent(e);
    // now and then, drop records older than 90 days (daily totals are worked out from what is kept)
    if (Math.random() < 0.01) await store.pruneEvents(dayBefore(day, 90));
  } catch (err) {
    console.error("track failed", err);
  }
  return new Response(null, { status: 204 });
}
