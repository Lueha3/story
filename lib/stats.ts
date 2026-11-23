import { createHash } from "crypto";

/** One thing a visitor did on the site. Nothing here names a person: no IP address, no cookie. */
export interface VisitEvent {
  ts: string;
  /** Korea-time date, YYYY-MM-DD */
  day: string;
  type: "visit" | "view" | "click";
  storyId: string | null;
  /** an anonymous number that changes every day, so a visitor is counted once a day and never followed */
  visitor: string;
  source: "instagram" | "kakao" | "direct" | "other";
  device: "ios" | "android" | "pc";
}

export interface DayCount {
  visitors: number;
  visits: number;
  views: number;
  clicks: number;
}

export interface Stats {
  now: number;
  today: DayCount;
  yesterday: DayCount;
  /** visitors added up day by day over the last 7 / 30 days */
  week: number;
  month: number;
  sources: { key: string; visitors: number }[];
  devices: { key: string; visitors: number }[];
  top: { storyId: string; views: number; clicks: number }[];
  days: { day: string; visitors: number }[];
  /** visitors by Korea-time hour of day (0-23), last 30 days */
  hours: number[];
  /** views and taps for every story seen in the last 30 days */
  perStory: { storyId: string; views: number; clicks: number }[];
}

export const kstHour = (t: number) => new Date(t + KST).getUTCHours();

const KST = 9 * 3600 * 1000;
export const kstDay = (t: number) => new Date(t + KST).toISOString().slice(0, 10);

export function dayBefore(day: string, n: number): string {
  return kstDay(Date.parse(day + "T12:00:00+09:00") - n * 86400000);
}

/**
 * The anonymous daily visitor number: a one-way hash of the network address and browser with a
 * secret and today's date. The address itself is never stored, and tomorrow's number is unrelated.
 */
export function visitorId(ip: string, ua: string, day: string): string {
  const secret = process.env.ADMIN_TOKEN || "honey";
  return createHash("sha256").update(secret + "|" + day + "|" + ip + "|" + ua).digest("hex").slice(0, 20);
}

export function deviceOf(ua: string): VisitEvent["device"] {
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Android/i.test(ua)) return "android";
  return "pc";
}

/** Where the visit came from: the in-app browsers say so in their name, otherwise the referring page. */
export function sourceOf(ua: string, referrer: string): VisitEvent["source"] {
  if (/Instagram/i.test(ua) || /instagram\.com/i.test(referrer)) return "instagram";
  if (/KAKAOTALK/i.test(ua) || /kakao/i.test(referrer)) return "kakao";
  if (!referrer) return "direct";
  return "other";
}

export const isBot = (ua: string) => !ua || /bot|crawler|spider|preview|facebookexternalhit|vercel|headless|curl|wget/i.test(ua);
