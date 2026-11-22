import { promises as fs } from "fs";
import path from "path";
import type { Store } from "./store";
import type { QueuedLink, Story } from "./types";

// Local development only: everything sits in .data/ next to the project.
const DIR = path.join(process.cwd(), ".data");
const DB = path.join(DIR, "db.json");
export const IMAGE_DIR = path.join(DIR, "images");

interface Db {
  stories: Story[];
  links: QueuedLink[];
}

let queue: Promise<unknown> = Promise.resolve();

// Serialise every read-modify-write so two requests can't overwrite each other.
function locked<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

async function load(): Promise<Db> {
  try {
    return JSON.parse(await fs.readFile(DB, "utf8")) as Db;
  } catch {
    return { stories: [], links: [] };
  }
}

async function save(db: Db): Promise<void> {
  await fs.mkdir(DIR, { recursive: true });
  const tmp = DB + ".tmp";
  await fs.writeFile(tmp, JSON.stringify(db, null, 1));
  await fs.rename(tmp, DB);
}

export function createLocalStore(): Store {
  return {
    listStories: () => locked(async () => (await load()).stories),
    getStory: (id) => locked(async () => (await load()).stories.find((s) => s.id === id) ?? null),
    findByHash: (hash) => locked(async () => (await load()).stories.find((s) => s.imageHash === hash) ?? null),
    insertStory: (story) =>
      locked(async () => {
        const db = await load();
        db.stories.push(story);
        await save(db);
      }),
    updateStory: (id, patch) =>
      locked(async () => {
        const db = await load();
        const s = db.stories.find((x) => x.id === id);
        if (!s) return null;
        Object.assign(s, patch, { id });
        await save(db);
        return s;
      }),
    deleteStory: (id) =>
      locked(async () => {
        const db = await load();
        db.stories = db.stories.filter((s) => s.id !== id);
        db.links.forEach((l) => {
          if (l.storyId === id) l.storyId = null;
        });
        await save(db);
      }),
    listLinks: () => locked(async () => (await load()).links),
    insertLink: (link) =>
      locked(async () => {
        const db = await load();
        db.links.push(link);
        await save(db);
      }),
    updateLink: (id, patch) =>
      locked(async () => {
        const db = await load();
        const l = db.links.find((x) => x.id === id);
        if (l) Object.assign(l, patch, { id });
        await save(db);
      }),
    getImage: (url) => fs.readFile(path.join(IMAGE_DIR, path.basename(url))),
    putImage: async (name, data) => {
      await fs.mkdir(IMAGE_DIR, { recursive: true });
      await fs.writeFile(path.join(IMAGE_DIR, name), data);
      return "/api/image/" + name;
    },
    deleteImage: async (url) => {
      const name = path.basename(url);
      await fs.rm(path.join(IMAGE_DIR, name), { force: true });
    },
  };
}
