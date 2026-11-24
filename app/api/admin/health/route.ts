import { isOwner, unauthorized } from "@/lib/auth";
import { blobConfigured, databaseUrl, onVercel } from "@/lib/env";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

// What is connected, for the status box on the admin page. Never returns the values themselves.
export async function GET(req: Request) {
  if (!isOwner(req)) return unauthorized(req);
  let database = false;
  let databaseError = "";
  try {
    await (await getStore()).listLinks();
    database = true;
  } catch (err) {
    databaseError = err instanceof Error ? err.message.slice(0, 200) : String(err);
  }
  return Response.json({
    database,
    databaseError,
    databaseMode: databaseUrl() ? "postgres" : onVercel() ? "none" : "local",
    imageStorage: databaseUrl() ? blobConfigured() : !onVercel(),
    ai: Boolean(process.env.ANTHROPIC_API_KEY),
    model: process.env.CLASSIFY_MODEL || "claude-opus-5-5",
    effort: process.env.CLASSIFY_EFFORT || "low",
    instagram: Boolean(process.env.IG_HANDLE),
  });
}
