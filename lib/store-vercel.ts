import { neon } from "@neondatabase/serverless";
import { del, get, put } from "@vercel/blob";
import { blobConfigured, blobStoreId, blobToken } from "./env";
import type { Store } from "./store";
import type { Category, QueuedLink, Story, StoryStatus } from "./types";

// Production: Postgres for records (DATABASE_URL), Vercel Blob for images (BLOB_READ_WRITE_TOKEN).

type Row = Record<string, unknown>;

const iso = (v: unknown) => (v instanceof Date ? v.toISOString() : String(v));

function rowToStory(r: Row): Story {
  return {
    id: String(r.id),
    imageUrl: String(r.image_url),
    imageHash: String(r.image_hash),
    takenAt: iso(r.taken_at),
    createdAt: iso(r.created_at),
    category: r.category as Category,
    itemName: String(r.item_name ?? ""),
    priceText: String(r.price_text ?? ""),
    sure: Boolean(r.sure),
    altCategory: (r.alt_category as Category | null) ?? null,
    reason: String(r.reason ?? ""),
    link: (r.link as string | null) ?? null,
    hidden: Boolean(r.hidden),
    checked: Boolean(r.checked),
    status: r.status as StoryStatus,
  };
}

function rowToLink(r: Row): QueuedLink {
  return {
    id: String(r.id),
    url: String(r.url),
    createdAt: iso(r.created_at),
    storyId: (r.story_id as string | null) ?? null,
  };
}

const STORY_COLS: Record<keyof Story, string> = {
  id: "id",
  imageUrl: "image_url",
  imageHash: "image_hash",
  takenAt: "taken_at",
  createdAt: "created_at",
  category: "category",
  itemName: "item_name",
  priceText: "price_text",
  sure: "sure",
  altCategory: "alt_category",
  reason: "reason",
  link: "link",
  hidden: "hidden",
  checked: "checked",
  status: "status",
};

const LINK_COLS: Record<keyof QueuedLink, string> = {
  id: "id",
  url: "url",
  createdAt: "created_at",
  storyId: "story_id",
};

const NO_BLOB =
  "이미지 저장소가 연결되지 않았어요. Vercel › Storage에서 Blob을 이 프로젝트에 연결하고 다시 배포해 주세요.";

/** A token if the store has one; otherwise the store id, and the SDK signs with Vercel's own OIDC token. */
function blobAuth(): { token?: string; storeId?: string } {
  const token = blobToken();
  const storeId = blobStoreId();
  return storeId ? { storeId, ...(token ? { token } : {}) } : { token };
}

/** Reads a picture saved in a private store, for /api/image. */
export async function readPrivateImage(name: string) {
  const r = await get("stories/" + name, { access: "private", ...blobAuth() });
  return r && r.statusCode === 200 ? r : null;
}

export function createVercelStore(databaseUrl: string): Store {
  const sql = neon(databaseUrl);
  let ready: Promise<unknown> | null = null;

  function init() {
    if (!ready) {
      ready = (async () => {
        await sql`CREATE TABLE IF NOT EXISTS stories (
          id text PRIMARY KEY,
          image_url text NOT NULL,
          image_hash text NOT NULL UNIQUE,
          taken_at timestamptz NOT NULL,
          created_at timestamptz NOT NULL,
          category text NOT NULL,
          item_name text NOT NULL DEFAULT '',
          price_text text NOT NULL DEFAULT '',
          sure boolean NOT NULL DEFAULT true,
          alt_category text,
          reason text NOT NULL DEFAULT '',
          link text,
          hidden boolean NOT NULL DEFAULT false,
          checked boolean NOT NULL DEFAULT false,
          status text NOT NULL
        )`;
        await sql`CREATE TABLE IF NOT EXISTS links (
          id text PRIMARY KEY,
          url text NOT NULL,
          created_at timestamptz NOT NULL,
          story_id text
        )`;
      })().catch((e) => {
        ready = null;
        throw e;
      });
    }
    return ready;
  }

  // Builds "UPDATE t SET a = $1, b = $2 WHERE id = $n" from a patch, using a fixed column map only.
  async function patchRow(table: string, cols: Record<string, string>, id: string, patch: Record<string, unknown>) {
    const sets: string[] = [];
    const vals: unknown[] = [];
    for (const [k, v] of Object.entries(patch)) {
      if (k === "id" || !(k in cols) || v === undefined) continue;
      vals.push(v);
      sets.push(`${cols[k]} = $${vals.length}`);
    }
    if (!sets.length) return [] as Row[];
    vals.push(id);
    return (await sql.query(`UPDATE ${table} SET ${sets.join(", ")} WHERE id = $${vals.length} RETURNING *`, vals)) as Row[];
  }

  return {
    async listStories() {
      await init();
      return ((await sql`SELECT * FROM stories ORDER BY taken_at DESC`) as Row[]).map(rowToStory);
    },
    async getStory(id) {
      await init();
      const rows = (await sql`SELECT * FROM stories WHERE id = ${id}`) as Row[];
      return rows[0] ? rowToStory(rows[0]) : null;
    },
    async findByHash(hash) {
      await init();
      const rows = (await sql`SELECT * FROM stories WHERE image_hash = ${hash}`) as Row[];
      return rows[0] ? rowToStory(rows[0]) : null;
    },
    async insertStory(s) {
      await init();
      await sql`INSERT INTO stories (id, image_url, image_hash, taken_at, created_at, category, item_name, price_text,
        sure, alt_category, reason, link, hidden, checked, status)
        VALUES (${s.id}, ${s.imageUrl}, ${s.imageHash}, ${s.takenAt}, ${s.createdAt}, ${s.category}, ${s.itemName},
        ${s.priceText}, ${s.sure}, ${s.altCategory}, ${s.reason}, ${s.link}, ${s.hidden}, ${s.checked}, ${s.status})`;
    },
    async updateStory(id, patch) {
      await init();
      const rows = await patchRow("stories", STORY_COLS, id, patch as Record<string, unknown>);
      if (rows[0]) return rowToStory(rows[0]);
      return this.getStory(id);
    },
    async deleteStory(id) {
      await init();
      await sql`DELETE FROM stories WHERE id = ${id}`;
      await sql`UPDATE links SET story_id = NULL WHERE story_id = ${id}`;
    },
    async listLinks() {
      await init();
      return ((await sql`SELECT * FROM links ORDER BY created_at DESC LIMIT 500`) as Row[]).map(rowToLink);
    },
    async insertLink(l) {
      await init();
      await sql`INSERT INTO links (id, url, created_at, story_id) VALUES (${l.id}, ${l.url}, ${l.createdAt}, ${l.storyId})`;
    },
    async updateLink(id, patch) {
      await init();
      await patchRow("links", LINK_COLS, id, patch as Record<string, unknown>);
    },
    async putImage(name, data, contentType) {
      if (!blobConfigured()) throw new Error(NO_BLOB);
      const opts = { contentType, addRandomSuffix: false, ...blobAuth() };
      // A private store (the default for new stores) is served through /api/image; a public one directly.
      try {
        await put("stories/" + name, data, { ...opts, access: "private" });
        return "/api/image/" + name;
      } catch (privateErr) {
        try {
          const blob = await put("stories/" + name, data, { ...opts, access: "public" });
          return blob.url;
        } catch {
          throw privateErr;
        }
      }
    },
    async deleteImage(url) {
      if (!blobConfigured()) return;
      const target = url.startsWith("/api/image/") ? "stories/" + url.slice("/api/image/".length) : url;
      await del(target, blobAuth());
    },
  };
}
