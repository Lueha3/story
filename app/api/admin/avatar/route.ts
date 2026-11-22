import { randomBytes } from "crypto";
import sharp from "sharp";
import { isOwner, unauthorized } from "@/lib/auth";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

// Replaces the profile photo: the picture is cut to a centred 400px square.
export async function POST(req: Request) {
  if (!isOwner(req)) return unauthorized();
  let file: unknown;
  try {
    file = (await req.formData()).get("file");
  } catch {
    file = null;
  }
  if (!file || typeof file !== "object" || !("arrayBuffer" in file)) {
    return Response.json({ error: "사진을 첨부해 주세요." }, { status: 400 });
  }
  try {
    const input = Buffer.from(await (file as File).arrayBuffer());
    const square = await sharp(input, { failOn: "none" }).rotate().resize(400, 400, { fit: "cover" }).jpeg({ quality: 88 }).toBuffer();
    const store = await getStore();
    const old = await store.getSetting("avatar");
    const url = await store.putImage("avatar-" + Date.now().toString(36) + randomBytes(3).toString("hex") + ".jpg", square, "image/jpeg");
    await store.setSetting("avatar", url);
    if (old) await store.deleteImage(old).catch(() => undefined);
    return Response.json({ avatar: url });
  } catch (err) {
    console.error("avatar failed", err);
    return Response.json({ error: "사진을 저장하지 못했어요. 다른 사진으로 해보세요." }, { status: 500 });
  }
}
