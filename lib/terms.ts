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

// When the product's own name says what it is, that decides the category, whatever else the model in
// the photo is wearing ("치노 팬츠" on a model in a jacket is still 하의). Checked in this order.
const NAMED: [RegExp, "bottom" | "shoes" | "acc"][] = [
  [/(팬츠|바지|슬랙스|청바지|진$|쇼츠|반바지|스커트|치마|조거|트레이닝\s*팬츠|레깅스)/, "bottom"],
  [/(스니커즈|운동화|부츠|워커|로퍼|더비|슬립온|슬리퍼|샌들|뮬|구두|러닝화|에어포스|스페지알|스피드캣)/, "shoes"],
  [/(벨트|가방|백팩|토트백|크로스백|모자|볼캡|비니|양말|목걸이|팔찌|반지|귀걸이|안경|선글라스|시계|머플러|목도리|장갑)/, "acc"],
];

/** The category a product name clearly states, or null when the name does not settle it. */
export function categoryFromName(name: string): "bottom" | "shoes" | "acc" | null {
  // a jacket or padding "with pants" style names are rare; the garment noun at the end wins
  if (/(자켓|재킷|패딩|코트|파카|점퍼|집업|가디건|블루종|아노락|바람막이|베스트|조끼)$/.test(name.trim())) return null;
  for (const [re, cat] of NAMED) if (re.test(name)) return cat;
  return null;
}
