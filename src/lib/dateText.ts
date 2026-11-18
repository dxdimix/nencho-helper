// 生年月日の手入力。「19881212」の8桁、または「1988/12/12」「1988-12-12」「1988.12.12」の形を受け付ける。
// 正しい日付なら "YYYY-MM-DD" を返し、そうでなければ null。

export function parseDateText(text: string): string | null {
  const t = text.trim().replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  let m = /^(\d{4})(\d{2})(\d{2})$/.exec(t);
  if (!m) m = /^(\d{4})\s*[/\-.年]\s*(\d{1,2})\s*[/\-.月]\s*(\d{1,2})\s*日?$/.exec(t);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  if (y < 1900 || y > 2100 || mo < 1 || mo > 12 || d < 1) return null;
  const last = new Date(Date.UTC(y, mo, 0)).getUTCDate();
  if (d > last) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

/** "YYYY-MM-DD" を入力欄に出す形（1988/12/12）にする */
export function formatDateText(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[1]}/${m[2]}/${m[3]}` : "";
}
