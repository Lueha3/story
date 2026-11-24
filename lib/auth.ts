import { timingSafeEqual } from "crypto";

/** The owner's secret (ADMIN_TOKEN). The phone shortcuts and the admin page both send it. */
export function isOwner(req: Request): boolean {
  // Spaces or a line break pasted around the value in Vercel are ignored.
  const secret = (process.env.ADMIN_TOKEN || "").trim().normalize("NFC");
  if (secret.length < 12) return false;
  const header = req.headers.get("authorization") || "";
  // A password saved together with its "Bearer " prefix arrives as "Bearer Bearer ..."; accept that too.
  const given = /^bearer\s+/i.test(header)
    ? safeDecode(header.replace(/^(bearer\s+)+/i, "")).trim().normalize("NFC")
    : "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

// The admin page sends the password URI-encoded so any character survives the header.
function safeDecode(v: string): string {
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

export function unauthorized(req?: Request) {
  const raw = process.env.ADMIN_TOKEN;
  const secret = raw === undefined ? undefined : raw.trim();
  // tells "no password came with the request" apart from "a password came but it is not this one"
  const sent = req ? /^bearer\s+\S/i.test(req.headers.get("authorization") || "") : true;
  let error = sent ? "비밀번호가 맞지 않아요." : "비밀번호가 함께 오지 않았어요.";
  if (secret === undefined) error = "서버에서 ADMIN_TOKEN을 찾지 못했어요. 이름 철자와 Production 체크를 확인하고 다시 배포해 주세요.";
  else if (secret.length < 12) error = "서버의 ADMIN_TOKEN이 " + secret.length + "자예요. 12자 이상으로 바꾸고 다시 배포해 주세요.";
  return Response.json({ error }, { status: 401 });
}
