export const CATEGORIES = ["top", "bottom", "outer", "shoes", "acc", "etc"] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABEL: Record<Category, string> = {
  top: "상의",
  bottom: "하의",
  outer: "아우터",
  shoes: "신발",
  acc: "ACC",
  etc: "기타",
};

/** Where the "상품링크" sticker sits in the picture, as fractions (0..1) of its width and height. */
export interface LinkBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type StoryStatus = "pending" | "done" | "failed";

export interface Story {
  id: string;
  imageUrl: string;
  imageHash: string;
  /** When the story was posted (the photo's creation time), ISO string. */
  takenAt: string;
  /** When the server received it, ISO string. */
  createdAt: string;
  category: Category;
  itemName: string;
  priceText: string;
  /** false = the AI was not sure; shows up as "확인 필요" in the admin page. */
  sure: boolean;
  altCategory: Category | null;
  reason: string;
  link: string | null;
  hidden: boolean;
  /** true once the owner confirmed or changed the category by hand. */
  checked: boolean;
  status: StoryStatus;
  linkBox: LinkBox | null;
  /** true once the AI has looked for the sticker (found or not), so it is not asked again. */
  stickerChecked: boolean;
}

export interface QueuedLink {
  id: string;
  url: string;
  createdAt: string;
  storyId: string | null;
}

/** What visitors get: no hashes, no internal notes. */
export interface PublicStory {
  id: string;
  imageUrl: string;
  takenAt: string;
  category: Category;
  itemName: string;
  priceText: string;
  link: string | null;
  linkBox: LinkBox | null;
}

export function toPublic(s: Story): PublicStory {
  return {
    id: s.id,
    imageUrl: s.imageUrl,
    takenAt: s.takenAt,
    category: s.category,
    itemName: s.itemName,
    priceText: s.priceText,
    link: s.link,
    linkBox: s.linkBox ?? null,
  };
}

export function isCategory(v: unknown): v is Category {
  return typeof v === "string" && (CATEGORIES as readonly string[]).includes(v);
}
