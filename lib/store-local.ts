import { promises as fs } from "fs";
import path from "path";
import type { Store } from "./store";
import { dayBefore, type DayCount, type Stats, type VisitEvent } from "./stats";
import type { QueuedLink, Story } from "./types";

// Local development only: everything sits in .data/ next to the project.
const DIR = path.join(process.cwd(), ".data");
const DB = path.join(DIR, "db.json");
export const IMAGE_DIR = path.join(DIR, "images");

interface Db {
  stories: Story[];
  links: QueuedLink[];
  settings?: Record<string, string>;
  events?: VisitEvent[];
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
    addEvent: (e) =>
      locked(async () => {
        const db = await load();
        (db.events ??= []).push(e);
        await save(db);
      }),
    pruneEvents: (beforeDay) =>
      locked(async () => {
        const db = await load();
        db.events = (db.events ?? []).filter((e) => e.day >= beforeDay);
        await save(db);
      }),
    stats: (today) => locked(async () => localStats((await load()).events ?? [], today)),
    getSetting: (key) => locked(async () => (await load()).settings?.[key] ?? null),
    setSetting: (key, value) =>
      locked(async () => {
        const db = await load();
        db.settings = { ...(db.settings ?? {}), [key]: value };
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

// The same totals the database works out, done in memory for local development.
function localStats(events: VisitEvent[], today: string): Stats {
  const yesterday = dayBefore(today, 1);
  const count = (day: string): DayCount => {
    const ev = events.filter((e) => e.day === day);
    return {
      visitors: new Set(ev.map((e) => e.visitor)).size,
      visits: ev.filter((e) => e.type === "visit").length,
      views: ev.filter((e) => e.type === "view").length,
      clicks: ev.filter((e) => e.type === "click").length,
    };
  };
  const since = (n: number) => dayBefore(today, n - 1);
  const dailyVisitors = (from: string) => {
    const per = new Map<string, Set<string>>();
    events.filter((e) => e.day >= from).forEach((e) => {
      if (!per.has(e.day)) per.set(e.day, new Set());
      per.get(e.day)!.add(e.visitor);
    });
    return per;
  };
  const sum = (m: Map<string, Set<string>>) => Array.from(m.values()).reduce((a, s) => a + s.size, 0);
  const m30 = dailyVisitors(since(30));
  const group = (key: "source" | "device") => {
    const per = new Map<string, Set<string>>();
    events.filter((e) => e.day >= since(30)).forEach((e) => {
      if (!per.has(e[key])) per.set(e[key], new Set());
      per.get(e[key])!.add(e.day + e.visitor);
    });
    return Array.from(per, ([k, v]) => ({ key: k, visitors: v.size })).sort((a, b) => b.visitors - a.visitors);
  };
  const per = new Map<string, { views: number; clicks: number }>();
  events.filter((e) => e.storyId && e.day >= since(30)).forEach((e) => {
    const t = per.get(e.storyId as string) ?? { views: 0, clicks: 0 };
    if (e.type === "view") t.views += 1;
    if (e.type === "click") t.clicks += 1;
    per.set(e.storyId as string, t);
  });
  const now = Date.now() - 5 * 60 * 1000;
  return {
    now: new Set(events.filter((e) => Date.parse(e.ts) >= now).map((e) => e.visitor)).size,
    today: count(today),
    yesterday: count(yesterday),
    week: sum(dailyVisitors(since(7))),
    month: sum(m30),
    sources: group("source"),
    devices: group("device"),
    top: Array.from(per, ([storyId, v]) => ({ storyId, ...v }))
      .sort((a, b) => b.clicks - a.clicks || b.views - a.views)
      .slice(0, 10),
    days: Array.from({ length: 30 }, (_, i) => dayBefore(today, 29 - i)).map((d) => ({ day: d, visitors: m30.get(d)?.size ?? 0 })),
  };
}
