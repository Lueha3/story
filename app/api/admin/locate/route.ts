import { isOwner, unauthorized } from "@/lib/auth";
import { locateStickers } from "@/lib/stories";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Looks for the link sticker in a few older stories per call; the admin page calls it until none are left.
export async function POST(req: Request) {
  if (!isOwner(req)) return unauthorized();
  try {
    return Response.json(await locateStickers(3));
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "실패했어요." }, { status: 500 });
  }
}
