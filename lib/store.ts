import type { QueuedLink, Story } from "./types";

/**
 * Where stories, queued links and images live.
 * - Production (Vercel): Postgres (DATABASE_URL) + Vercel Blob (BLOB_READ_WRITE_TOKEN).
 * - Local development: a JSON file and an image folder under .data/.
 */
export interface Store {
  listStories(): Promise<Story[]>;
  getStory(id: string): Promise<Story | null>;
  findByHash(hash: string): Promise<Story | null>;
  insertStory(story: Story): Promise<void>;
  updateStory(id: string, patch: Partial<Story>): Promise<Story | null>;
  deleteStory(id: string): Promise<void>;

  listLinks(): Promise<QueuedLink[]>;
  insertLink(link: QueuedLink): Promise<void>;
  updateLink(id: string, patch: Partial<QueuedLink>): Promise<void>;

  putImage(name: string, data: Buffer, contentType: string): Promise<string>;
  deleteImage(url: string): Promise<void>;
}

let cached: Promise<Store> | null = null;

export function getStore(): Promise<Store> {
  if (!cached) {
    cached = process.env.DATABASE_URL
      ? import("./store-vercel").then((m) => m.createVercelStore())
      : import("./store-local").then((m) => m.createLocalStore());
  }
  return cached;
}
