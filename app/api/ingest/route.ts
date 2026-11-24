import { isOwner, unauthorized } from "@/lib/auth";
import { ingestStory, sniffImage } from "@/lib/stories";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Large photos are shrunk on the server before saving. (Vercel itself refuses a request over about 4.5MB,
// so the admin page shrinks pictures before sending and the phone shortcut resizes them first.)
const MAX_BYTES = 25 * 1024 * 1024;

/**
 * The phone shortcut (or the admin page) sends story images here.
 * Form fields: "file" (one or more images), optional "takenAt" (one per file, any date format the phone gives).
 * Images already received are skipped, so the shortcut can safely resend its last few photos.
 */
export async function POST(req: Request) {
  if (!isOwner(req)) return unauthorized(req);

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "이미지를 첨부해서 보내주세요." }, { status: 400 });
  }
  const files = form.getAll("file").filter((f): f is File => typeof f === "object" && f !== null && "arrayBuffer" in f);
  const times = form.getAll("takenAt").map((t) => String(t));
  if (!files.length) return Response.json({ error: "file 항목에 이미지가 없어요." }, { status: 400 });

  const results = [];
  for (let i = 0; i < files.length; i += 1) {
    const f = files[i];
    const buf = Buffer.from(await f.arrayBuffer());
    if (buf.length > MAX_BYTES) {
      results.push({ name: f.name, error: "이미지가 25MB보다 커요." });
      continue;
    }
    const type = sniffImage(buf);
    if (!type) {
      results.push({ name: f.name, error: "JPEG, PNG, WebP 이미지만 받아요. 단축어에서 JPEG로 변환해 주세요." });
      continue;
    }
    const parsed = times[i] ? new Date(times[i]) : null;
    const takenAt = parsed && !Number.isNaN(parsed.getTime()) ? parsed : null;
    let r;
    try {
      r = await ingestStory(buf, type, takenAt);
    } catch (err) {
      results.push({ name: f.name, error: err instanceof Error ? err.message : "저장 중 오류가 났어요." });
      continue;
    }
    results.push({
      name: f.name,
      result: r.kind,
      id: r.story.id,
      category: r.story.category,
      sure: r.story.sure,
      itemName: r.story.itemName,
      link: r.story.link,
    });
  }
  const created = results.filter((r) => "result" in r && r.result === "created").length;
  return Response.json({ created, results });
}
