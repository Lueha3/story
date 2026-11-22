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
  const secret = process.env.ADMIN_TOKEN;
  let error = "비밀번호가 맞지 않아요.";
  if (secret === undefined) error = "서버에서 ADMIN_TOKEN을 찾지 못했어요. 이름 철자와 Production 체크를 확인하고 다시 배포해 주세요.";
  else if (secret.length < 12) error = "서버의 ADMIN_TOKEN이 " + secret.length + "자예요. 12자 이상으로 바꾸고 다시 배포해 주세요.";
  return Response.json({ error }, { status: 401 });
}
