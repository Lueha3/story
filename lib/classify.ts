import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { TERM_RULES, categoryFromName, unifyTerms } from "./terms";
import { CATEGORIES, type Category, type LinkBox } from "./types";

export interface Classification {
  category: Category;
  itemName: string;
  priceText: string;
  sure: boolean;
  altCategory: Category | null;
  reason: string;
  linkBox: LinkBox | null;
  ok: boolean;
}

const Result = z.object({
  is_product: z.boolean(),
  category: z.enum(CATEGORIES),
  item_name: z.string(),
  price_text: z.string(),
  confident: z.boolean(),
  alternative_category: z.enum(CATEGORIES).nullable(),
  reason: z.string(),
  link_sticker: z
    .object({ left: z.number(), top: z.number(), right: z.number(), bottom: z.number() })
    .nullable(),
});

// The owner's own sorting rules. Edit these lines to change how stories are sorted.
const SYSTEM = `You sort Instagram stories from a Korean fashion creator into shopping categories.
Each story shows one product (photo, a short Korean caption, a price box, a "상품링크" sticker) or no product at all.

Categories, in this order:
- top: 상의 (t-shirts, long sleeves, sweatshirts, knits, shirts, blouses)
- bottom: 하의 (pants, jeans, slacks, shorts, skirts)
- outer: 아우터 (jackets, coats, parkas, padding, windbreakers, blazers)
- shoes: 신발 (sneakers, loafers, boots, derby shoes, sandals)
- acc: ACC (bags, caps and hats, belts, socks, jewelry such as bracelets, rings and necklaces, glasses, watches)
- etc: 기타 (grooming, skincare, perfume, other goods, and any story without a product such as notices)

The product is the one the caption and the price box are about. A model in the photo often wears a whole
outfit (a jacket over pants, say): sort by the product the caption names, not by the most visible garment.

Fixed rules from the owner:
- Hood zip-ups, cardigans, shirt jackets and vests are always outer.
- Bags, hats, belts, socks and jewelry are always acc.
- Grooming products, perfume and stories without a product are always etc.

Fill the fields like this:
- link_sticker: the bounding box of the link sticker (a rounded white pill with a chain-link icon and text such as "상품링크" or "상품 링크"), as fractions of the image: left and right are fractions of the image width, top and bottom fractions of the image height, each from 0 to 1, measured from the top-left corner. Be as exact as you can: a button is placed over this box. null when the story has no link sticker.
- is_product: false when the story shows no product.
- item_name: a short Korean product name a shopper would recognise, without the brand when the brand is unclear (e.g. "카고 팬츠", "스케이트 로퍼"). Empty when there is no product.
  Spell fashion terms the same way every time: ${TERM_RULES}.
- price_text: the discount and final price exactly as printed, e.g. "33% 99,830원". Empty when no price is printed.
- confident: false only when the image genuinely allows two categories (for example a thick shirt that may be a shirt jacket). A fixed rule above settles a case, so it is then confident.
- alternative_category: the other plausible category when confident is false, otherwise null.
- reason: one short Korean sentence the owner reads when checking an unsure story, e.g. "셔츠인지 셔츠 자켓인지 사진만으로는 애매해요."`;

const UNSORTED: Classification = {
  category: "etc",
  itemName: "",
  priceText: "",
  sure: false,
  altCategory: null,
  reason: "",
  linkBox: null,
  ok: false,
};

function toBox(b: { left: number; top: number; right: number; bottom: number } | null): LinkBox | null {
  if (!b) return null;
  const c = (v: number) => Math.min(1, Math.max(0, v));
  const x = c(Math.min(b.left, b.right));
  const y = c(Math.min(b.top, b.bottom));
  const w = c(Math.max(b.left, b.right)) - x;
  const h = c(Math.max(b.top, b.bottom)) - y;
  // a real sticker is a small wide pill; anything else is a misread
  if (w < 0.08 || h < 0.015 || w > 0.9 || h > 0.25) return null;
  return { x, y, w, h };
}

const EFFORTS = ["low", "medium", "high", "xhigh", "max"] as const;

export type ImageType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

export async function classifyStory(image: Buffer, mediaType: ImageType): Promise<Classification> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ...UNSORTED, reason: "AI 키가 설정되지 않아 자동 분류를 하지 못했어요." };
  }
  const client = new Anthropic();
  const model = process.env.CLASSIFY_MODEL || "claude-opus-5-5";
  const effort = EFFORTS.find((e) => e === process.env.CLASSIFY_EFFORT) ?? "low";
  // Server-side fallback re-runs a refused request on another model; Haiku has none, so it is only sent for others.
  const fallback = model.includes("haiku") ? {} : { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const };
  try {
    const response = await client.beta.messages.parse({
      model,
      max_tokens: 8000,
      ...fallback,
      output_config: { effort, format: betaZodOutputFormat(Result) },
      system: SYSTEM,
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: image.toString("base64") } },
            { type: "text", text: "Sort this story." },
          ],
        },
      ],
    });
    if (response.stop_reason === "refusal" || !response.parsed_output) {
      return { ...UNSORTED, reason: "AI가 이 스토리를 읽지 못했어요. 직접 골라주세요." };
    }
    const r = response.parsed_output;
    const named = categoryFromName(unifyTerms(r.item_name));
    const category: Category = !r.is_product ? "etc" : named ?? r.category;
    const alt = !r.confident && r.alternative_category && r.alternative_category !== category ? r.alternative_category : null;
    return {
      category,
      itemName: unifyTerms(r.item_name),
      priceText: r.price_text.trim(),
      sure: r.confident || !alt,
      altCategory: alt,
      reason: r.reason.trim(),
      linkBox: toBox(r.link_sticker),
      ok: true,
    };
  } catch (err) {
    console.error("classifyStory failed", err);
    return { ...UNSORTED, reason: "자동 분류 중 오류가 났어요. 직접 골라주세요." };
  }
}
