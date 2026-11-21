import { timingSafeEqual } from "crypto";

/** The owner's secret (ADMIN_TOKEN). The phone shortcuts and the admin page both send it. */
export function isOwner(req: Request): boolean {
  const secret = process.env.ADMIN_TOKEN;
  if (!secret || secret.length < 12) return false;
  const header = req.headers.get("authorization") || "";
  const given = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

export function unauthorized() {
  const configured = (process.env.ADMIN_TOKEN || "").length >= 12;
  return Response.json(
    { error: configured ? "비밀번호가 맞지 않아요." : "서버에 ADMIN_TOKEN(12자 이상)이 설정되지 않았어요." },
    { status: 401 },
  );
}
