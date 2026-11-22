import { createHash, randomBytes } from "crypto";
import sharp from "sharp";
import { classifyStory, type ImageType } from "./classify";
import { getStore } from "./store";
import type { QueuedLink, Story } from "./types";

const MIN = 60 * 1000;
// A link waits up to this long for the story it belongs to.
const LINK_BEFORE_STORY = 60 * MIN;
// A link that arrives after its story still finds it within this window.
const LINK_AFTER_STORY = 15 * MIN;

const newId = () => Date.now().toString(36) + randomBytes(4).toString("hex");

const EXT: Record<ImageType, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

/** Reads the real type from the file's first bytes; the phone's label can't be trusted. */
export function sniffImage(buf: Buffer): ImageType | null {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length > 12 && buf.toString("ascii", 0, 4) === "RIFF" && buf.toString("ascii", 8, 12) === "WEBP") return "image/webp";
  if (buf.length > 6 && buf.toString("ascii", 0, 3) === "GIF") return "image/gif";
  return null;
}

/** Runs one stage of saving and names the stage in the error, so a failure says where it happened. */
async function step<T>(label: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.error(label + " failed", err);
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(label + " 실패: " + msg.slice(0, 200));
  }
}

export type IngestResult =
  | { kind: "duplicate"; story: Story }
  | { kind: "created"; story: Story };

/**
 * Turns any accepted picture into a JPEG no larger than 1920px on its long side:
 * small enough to store cheaply and to send to the AI, still sharp on a phone.
 */
export async function normalizeImage(input: Buffer): Promise<Buffer> {
  // Cut away plain black bands along the edges (letterboxing), so the story fills the viewer.
  let trimmed = input;
  try {
    const t = await sharp(input, { failOn: "none" }).rotate().trim({ background: "#000000", threshold: 24 }).toBuffer({ resolveWithObject: true });
    const meta = await sharp(input, { failOn: "none" }).rotate().metadata();
    // keep the trim only if something real is left (not a mostly black picture)
    if (meta.width && meta.height && t.info.width * t.info.height > meta.width * meta.height * 0.4) trimmed = t.data;
  } catch {
    // nothing to trim, or a picture that is all one colour
  }
  return sharp(trimmed, { failOn: "none" })
    .rotate()
    .resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85, mozjpeg: true })
    .toBuffer();
}

export async function ingestStory(original: Buffer, originalType: ImageType, takenAt: Date | null): Promise<IngestResult> {
  const store = await step("데이터베이스 연결", () => getStore());
  // The hash is taken from the file as sent, so the shortcut resending the same photo is recognised.
  const hash = createHash("sha256").update(original).digest("hex");
  const existing = await step("기록 확인", () => store.findByHash(hash));
  if (existing) return { kind: "duplicate", story: existing };

  let image = original;
  let type = originalType;
  try {
    image = await normalizeImage(original);
    type = "image/jpeg";
  } catch (err) {
    // An image sharp can't read is kept as sent; the size check before this keeps it within limits.
    console.error("normalizeImage failed", err);
  }

  const now = new Date();
  // A creation time far in the future or before Instagram existed is a broken value: use now.
  const when = takenAt && takenAt.getTime() <= now.getTime() + 5 * MIN && takenAt.getFullYear() > 2010 ? takenAt : now;
  const id = newId();
  const imageUrl = await step("이미지 저장", () => store.putImage(id + "-" + hash.slice(0, 12) + "." + EXT[type], image, type));

  const story: Story = {
    id,
    imageUrl,
    imageHash: hash,
    takenAt: when.toISOString(),
    createdAt: now.toISOString(),
    category: "etc",
    itemName: "",
    priceText: "",
    sure: false,
    altCategory: null,
    reason: "",
    link: null,
    hidden: false,
    checked: false,
    status: "pending",
    linkBox: null,
    stickerChecked: false,
  };
  try {
    await step("기록 저장", () => store.insertStory(story));
  } catch (err) {
    // The same picture sent twice at the same moment: keep the first one.
    const again = await store.findByHash(hash);
    if (again) return { kind: "duplicate", story: again };
    throw err;
  }

  await attachWaitingLink(story);

  const c = await classifyStory(image, type);
  const updated = await store.updateStory(id, {
    category: c.category,
    itemName: c.itemName,
    priceText: c.priceText,
    sure: c.sure,
    altCategory: c.altCategory,
    reason: c.reason,
    status: c.ok ? "done" : "failed",
    linkBox: c.linkBox,
    stickerChecked: c.ok,
  });
  return { kind: "created", story: updated ?? story };
}

/** Story first, link already copied: take the newest unused link from shortly before the story. */
async function attachWaitingLink(story: Story) {
  const store = await getStore();
  const t = Date.parse(story.takenAt);
  const candidates = (await store.listLinks())
    .filter((l) => !l.storyId)
    .filter((l) => {
      const lt = Date.parse(l.createdAt);
      return lt <= t + 2 * MIN && lt >= t - LINK_BEFORE_STORY;
    })
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  const link = candidates[0];
  if (!link) return;
  await store.updateLink(link.id, { storyId: story.id });
  await store.updateStory(story.id, { link: link.url });
  story.link = link.url;
}

/** Link arrives: give it to a recent story that has none, otherwise keep it waiting for the next story. */
export async function addLink(url: string): Promise<{ link: QueuedLink; story: Story | null }> {
  const store = await getStore();
  const now = Date.now();
  const link: QueuedLink = { id: newId(), url, createdAt: new Date(now).toISOString(), storyId: null };

  const recent = (await store.listStories())
    .filter((s) => !s.link && !s.hidden)
    .filter((s) => {
      const t = Date.parse(s.takenAt);
      return t <= now && t >= now - LINK_AFTER_STORY;
    })
    .sort((a, b) => Date.parse(b.takenAt) - Date.parse(a.takenAt));
  const story = recent[0] ?? null;
  if (story) {
    link.storyId = story.id;
    await store.updateStory(story.id, { link: url });
  }
  await store.insertLink(link);
  return { link, story: story ? { ...story, link: url } : null };
}

export function cleanUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  // A shared link often comes with text around it: take the first http(s) address.
  const m = raw.match(/https?:\/\/[^\s<>"']+/);
  if (!m) return null;
  try {
    const u = new URL(m[0]);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Finds the link sticker for stories saved before that was read. Returns how many were handled and how many remain. */
export async function locateStickers(limit: number): Promise<{ done: number; found: number; left: number }> {
  const store = await getStore();
  const todo = (await store.listStories()).filter((s) => !s.linkBox && !s.stickerChecked);
  let found = 0;
  const batch = todo.slice(0, limit);
  for (const s of batch) {
    let box = null;
    try {
      const img = await store.getImage(s.imageUrl);
      const c = await classifyStory(img, sniffImage(img) ?? "image/jpeg");
      if (!c.ok) continue;
      box = c.linkBox;
    } catch (err) {
      console.error("locateStickers failed for " + s.id, err);
      continue;
    }
    if (box) found += 1;
    await store.updateStory(s.id, { linkBox: box, stickerChecked: true });
  }
  return { done: batch.length, found, left: todo.length - batch.length };
}
