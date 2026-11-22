import { databaseUrl, onVercel } from "./env";
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

  getImage(url: string): Promise<Buffer>;
  putImage(name: string, data: Buffer, contentType: string): Promise<string>;
  deleteImage(url: string): Promise<void>;
}

let cached: Promise<Store> | null = null;

export const NO_DATABASE =
  "데이터베이스가 연결되지 않았어요. Vercel › Storage에서 Neon(Postgres)을 이 프로젝트에 연결하고 다시 배포해 주세요.";

export function getStore(): Promise<Store> {
  if (!cached) {
    const url = databaseUrl();
    if (url) cached = import("./store-vercel").then((m) => m.createVercelStore(url));
    // On Vercel the project folder is read-only, so the local file store can never work there.
    else if (onVercel()) return Promise.reject(new Error(NO_DATABASE));
    else cached = import("./store-local").then((m) => m.createLocalStore());
  }
  return cached;
}
