import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { CATEGORIES, type Category } from "./types";

export interface Classification {
  category: Category;
  itemName: string;
  priceText: string;
  sure: boolean;
  altCategory: Category | null;
  reason: string;
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

Fixed rules from the owner:
- Hood zip-ups, cardigans, shirt jackets and vests are always outer.
- Bags, hats, belts, socks and jewelry are always acc.
- Grooming products, perfume and stories without a product are always etc.

Fill the fields like this:
- is_product: false when the story shows no product.
- item_name: a short Korean product name a shopper would recognise, without the brand when the brand is unclear (e.g. "카고 팬츠", "스케이트 로퍼"). Empty when there is no product.
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
  ok: false,
};

export type ImageType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

export async function classifyStory(image: Buffer, mediaType: ImageType): Promise<Classification> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ...UNSORTED, reason: "AI 키가 설정되지 않아 자동 분류를 하지 못했어요." };
  }
  const client = new Anthropic();
  try {
    const response = await client.beta.messages.parse({
      model: process.env.CLASSIFY_MODEL || "claude-opus-5-5",
      max_tokens: 8000,
      // A refused request is re-run on Anthropic's recommended fallback model.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      output_config: { effort: "low", format: betaZodOutputFormat(Result) },
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
    const category: Category = r.is_product ? r.category : "etc";
    const alt = !r.confident && r.alternative_category && r.alternative_category !== category ? r.alternative_category : null;
    return {
      category,
      itemName: r.item_name.trim(),
      priceText: r.price_text.trim(),
      sure: r.confident || !alt,
      altCategory: alt,
      reason: r.reason.trim(),
      ok: true,
    };
  } catch (err) {
    console.error("classifyStory failed", err);
    return { ...UNSORTED, reason: "자동 분류 중 오류가 났어요. 직접 골라주세요." };
  }
}
