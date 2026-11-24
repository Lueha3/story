// One spelling for each fashion term in product names. The AI and older stories sometimes use another
// spelling for the same thing ("피쉬테일" / "피시테일"); names are shown with the spelling on the right.
// Add a line here to unify another term.
const TERMS: [RegExp, string][] = [
  [/피쉬\s*테일/g, "피시테일"],
  [/피시\s+테일/g, "피시테일"],
  [/스웨드/g, "스웨이드"],
  [/후리스/g, "플리스"],
  [/가디간/g, "가디건"],
  [/카디건/g, "가디건"],
  [/쟈켓|자킷/g, "자켓"],
  [/코르덴|골덴/g, "코듀로이"],
  [/스니커스/g, "스니커즈"],
  [/바람 막이/g, "바람막이"],
  [/후드\s*집업|후드짚업|후드 짚업/g, "후드 집업"],
  [/맨투맨\s*티/g, "맨투맨"],
  [/롱\s+슬리브/g, "롱슬리브"],
  [/덕\s+다운/g, "덕다운"],
  [/구스\s+다운/g, "구스다운"],
  [/셰르파|쉐르파/g, "셰르파"],
];

export function unifyTerms(name: string): string {
  let out = name;
  for (const [re, to] of TERMS) out = out.replace(re, to);
  return out.replace(/\s{2,}/g, " ").trim();
}

/** The same list, written out for the AI's instructions. */
export const TERM_RULES = '"피시테일" (not 피쉬테일), "스웨이드", "플리스", "가디건", "자켓", "코듀로이", "스니커즈", "후드 집업", "롱슬리브", "덕다운", "구스다운"';
