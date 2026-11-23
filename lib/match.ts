import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import sharp from "sharp";
import { z } from "zod";
import { getStore } from "./store";
import { CATEGORY_LABEL, type Story } from "./types";

export interface LinkIn {
  url: string;
  hint: string;
}

export interface MatchOut {
  /** index into the links sent */
  link: number;
  /** id of the story the link belongs to, or null when no story fits */
  storyId: string | null;
  sure: boolean;
  why: string;
}

const Result = z.object({
  matches: z.array(
    z.object({
      link: z.number().int(),
      story: z.number().int().nullable(),
      sure: z.boolean(),
      why: z.string(),
    }),
  ),
});

const SYSTEM = `You pair product links with Instagram stories for a Korean fashion creator.
Each story is a picture of one product with a short Korean caption and a price. Each link comes with the
line the creator wrote above it in a message (it may be empty). Pair every link with the story it is about.

How to decide:
- Compare the link's line with what the story shows: the product, the brand, the colour, the words of the
  caption, the discount. The line and the caption are often worded differently but describe the same item.
- Each story takes at most one link. The same address can appear more than once: then each copy belongs to
  a different story (for example several stories about the same padding jacket in different colours).
- A link with an empty line has no clue of its own. Pair it only if the remaining stories leave one clear
  choice, and mark it unsure; otherwise leave it unpaired (story: null).
- sure: true only when the line clearly names this story's product. Otherwise false.
- why: a few Korean words on what matched, e.g. "쿠어 코트, 10% 쿠폰". Empty for unpaired links.

Answer with one entry per link, in the order the links were given.`;

/** Small copies are enough to recognise a product and keep the request light. */
async function thumb(store: Awaited<ReturnType<typeof getStore>>, s: Story): Promise<string | null> {
  try {
    const img = await store.getImage(s.imageUrl);
    const small = await sharp(img, { failOn: "none" }).resize({ width: 480, height: 480, fit: "inside" }).jpeg({ quality: 70 }).toBuffer();
    return small.toString("base64");
  } catch {
    return null;
  }
}

export async function matchLinks(links: LinkIn[], storyIds: string[]): Promise<MatchOut[]> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("AI 키가 설정되지 않아 짝을 찾을 수 없어요.");
  const store = await getStore();
  const all = await store.listStories();
  const byId = new Map(all.map((s) => [s.id, s]));
  const stories = storyIds.map((id) => byId.get(id)).filter((s): s is Story => Boolean(s));
  if (!stories.length) throw new Error("짝지을 스토리가 없어요.");

  const images = await Promise.all(stories.map((s) => thumb(store, s)));
  const content: Anthropic.Beta.BetaContentBlockParam[] = [{ type: "text", text: "Stories:" }];
  stories.forEach((s, i) => {
    const facts = [CATEGORY_LABEL[s.category], s.itemName, s.priceText].filter(Boolean).join(" · ");
    content.push({ type: "text", text: `Story ${i}: ${facts || "(not read)"}` });
    if (images[i]) content.push({ type: "image", source: { type: "base64", media_type: "image/jpeg", data: images[i] as string } });
  });
  content.push({
    type: "text",
    text: "Links:\n" + links.map((l, i) => `Link ${i}: ${l.hint ? l.hint : "(no line)"}`).join("\n"),
  });

  const client = new Anthropic();
  const model = process.env.CLASSIFY_MODEL || "claude-opus-5-5";
  const fallback = model.includes("haiku") ? {} : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };
  const response = await client.beta.messages.parse({
    model,
    max_tokens: 16000,
    ...fallback,
    output_config: { effort: "medium", format: betaZodOutputFormat(Result) },
    system: SYSTEM,
    messages: [{ role: "user", content }],
  });
  if (response.stop_reason === "refusal" || !response.parsed_output) throw new Error("AI가 짝을 찾지 못했어요. 순서대로 짝짓기를 써주세요.");

  // Keep the answer honest: one entry per link, each story used once, indexes in range.
  const out: MatchOut[] = links.map((_, i) => ({ link: i, storyId: null, sure: false, why: "" }));
  const taken = new Map<number, number>();
  for (const m of response.parsed_output.matches) {
    if (m.link < 0 || m.link >= links.length) continue;
    const st = m.story !== null && m.story >= 0 && m.story < stories.length ? m.story : null;
    out[m.link] = { link: m.link, storyId: st === null ? null : stories[st].id, sure: st !== null && m.sure, why: m.why.trim() };
    if (st !== null) {
      const prev = taken.get(st);
      if (prev !== undefined) {
        // two links claim one story: neither can be trusted
        out[prev].sure = false;
        out[m.link].sure = false;
      } else taken.set(st, m.link);
    }
  }
  return out;
}
