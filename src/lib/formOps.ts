import type { Calculation } from "./calc";
import type { ReadResult } from "./schema";

// 国税庁「令和8年分 給与所得者の保険料控除申告書」の画像に書く内容と位置。
// 座標は PDF の座標（ポイント、用紙の幅 841.89 × 高さ 595.276）。位置は様式 PDF の文字の座標から求めた。

export const PAGE_W = 841.89;
export const PAGE_H = 595.276;

export type Op =
  | { t: "text"; s: string; x: number; y: number; w: number; size?: number; align?: "left" | "right" }
  | { t: "circle"; x: number; y: number; r: number };

const yen = (n: number) => n.toLocaleString("ja-JP");

// 欄の位置（PDF の座標）
const LIFE_COLS = { insurer: [61, 72], type: [136, 40], period: [179, 19], contractor: [201, 63], beneficiary: [267, 81], amountRight: 425 };
const ROWS = {
  一般: [152.5, 172, 191.7, 212.3],
  介護医療: [288.5, 309, 330],
  個人年金: [373.5, 396, 418],
};
const QUAKE_ROWS = [155, 193]; // 各行の上端
const SOCIAL_ROWS = [374, 397];
const SMALL_BIZ_Y = [471, 495, 518, 541];
const SMALL_BIZ_ORDER = [
  "独立行政法人中小企業基盤整備機構の共済契約の掛金",
  "確定拠出年金法に規定する企業型年金加入者掛金",
  "確定拠出年金法に規定する個人型年金加入者掛金",
  "心身障害者扶養共済制度に関する契約の掛金",
];

/** 金額を「円」の左に右寄せで書く */
const amount = (n: number, right: number, baseline: number): Op => ({ t: "text", s: yen(n), x: right, y: baseline, w: 70, align: "right", size: 7.5 });

export function buildOps(data: ReadResult, calc: Calculation, under23: boolean): { ops: Op[]; overflow: string[] } {
  const ops: Op[] = [];
  const overflow: string[] = [];

  // 生命保険料（区分ごとの行）
  for (const cat of ["一般", "介護医療", "個人年金"] as const) {
    const items = data.life.filter((i) => i.category === cat);
    const rows = ROWS[cat];
    if (items.length > rows.length) overflow.push(`${cat}の生命保険料：${items.length - rows.length}件（申告書の行が足りません。続きは余白か別紙に書いてください）`);
    items.slice(0, rows.length).forEach((i, k) => {
      const y = rows[k] + 2.5;
      const c = LIFE_COLS;
      ops.push({ t: "text", s: i.insurer, x: c.insurer[0], y, w: c.insurer[1] });
      ops.push({ t: "text", s: i.policyType, x: c.type[0], y, w: c.type[1] });
      ops.push({ t: "text", s: i.period, x: c.period[0], y, w: c.period[1] });
      ops.push({ t: "text", s: i.contractor, x: c.contractor[0], y, w: c.contractor[1] });
      ops.push({ t: "text", s: i.beneficiary + (i.beneficiaryRelation ? `（${i.beneficiaryRelation}）` : ""), x: c.beneficiary[0], y, w: c.beneficiary[1] });
      if (cat !== "介護医療") ops.push({ t: "circle", x: i.system === "新" ? 355.4 : 366.9, y: rows[k], r: 4.2 });
      ops.push(amount(i.amount, c.amountRight, y + 2));
    });
  }

  // 一般の生命保険料の計算欄
  const g = calc.general;
  if (data.life.some((i) => i.category === "一般")) {
    if (g.newTotal > 0) ops.push(amount(g.newTotal, 154, 238.5)); // Ａ
    if (g.oldTotal > 0) ops.push(amount(g.oldTotal, 167, 276)); // Ｂ
    ops.push({ t: "circle", x: 170.6, y: under23 ? 249.3 : 227, r: 4.5 }); // 23歳未満の扶養親族の有無
    if (g.newTotal > 0) {
      if (under23) {
        ops.push(amount(g.newDeduction, 339.5, 256.8)); // ②
        ops.push(amount(g.combined, 455.8, 256.8)); // ⑤
      } else {
        ops.push(amount(g.newDeduction, 339.5, 238.5)); // ①
        ops.push(amount(g.combined, 455.8, 238.5)); // ④
      }
    }
    if (g.oldTotal > 0) ops.push(amount(g.oldDeduction, 339.5, 275.8)); // ③
    ops.push(amount(g.deduction, 455.8, 275.8)); // ㋑
  }
  // 介護医療保険料
  if (calc.care.total > 0) {
    ops.push(amount(calc.care.total, 167, 360.6)); // Ｃ
    ops.push(amount(calc.care.deduction, 455.8, 360.7)); // ㋺
  }
  // 個人年金保険料
  const p = calc.pension;
  if (p.newTotal + p.oldTotal > 0) {
    if (p.newTotal > 0) ops.push(amount(p.newTotal, 167, 447.3)); // Ｄ
    if (p.oldTotal > 0) ops.push(amount(p.oldTotal, 167, 467.5)); // Ｅ
    if (p.newTotal > 0) ops.push(amount(p.newDeduction, 339.5, 448.2)); // ⑥
    if (p.oldTotal > 0) ops.push(amount(p.oldDeduction, 339.5, 467.5)); // ⑦
    ops.push(amount(p.combined, 455.8, 447.6)); // ⑧
    ops.push(amount(p.deduction, 455.8, 467)); // ㋩
  }
  if (data.life.length > 0) ops.push(amount(calc.lifeDeduction, 455.8, 509.6)); // 生命保険料控除額

  // 地震保険料
  if (data.earthquake.length > QUAKE_ROWS.length) overflow.push(`地震保険料：${data.earthquake.length - QUAKE_ROWS.length}件（行が足りません）`);
  data.earthquake.slice(0, QUAKE_ROWS.length).forEach((i, k) => {
    const top = QUAKE_ROWS[k];
    const mid = top + 19 + 2.5;
    ops.push({ t: "text", s: i.insurer, x: 485, y: mid, w: 49 });
    ops.push({ t: "text", s: i.policyType, x: 540, y: mid, w: 38 });
    ops.push({ t: "text", s: i.period, x: 582, y: mid, w: 15 });
    ops.push({ t: "text", s: i.contractor, x: 600, y: top + 11, w: 75 });
    ops.push({ t: "text", s: i.resident + (i.residentRelation ? `（${i.residentRelation}）` : ""), x: 600, y: top + 30, w: 75 });
    ops.push({ t: "circle", x: 688.7, y: i.category === "地震" ? top + 11.5 : top + 26, r: i.category === "地震" ? 8 : 10 });
    ops.push(amount(i.amount, 749.5, mid + 1));
  });
  if (data.earthquake.length > 0) {
    const e = calc.earthquake;
    ops.push(amount(e.quakeTotal, 779, 255.6)); // Ⓑ
    ops.push(amount(e.oldLongTotal, 779.5, 277)); // Ⓒ
    ops.push(amount(e.quakePart, 609, 300)); // Ⓑの金額（最高5万円）
    ops.push(amount(e.oldLongPart, 774, 300)); // Ⓒの計算
    ops.push(amount(e.deduction, 777.6, 332)); // 地震保険料控除額
  }

  // 社会保険料
  if (data.social.length > SOCIAL_ROWS.length) overflow.push(`社会保険料：${data.social.length - SOCIAL_ROWS.length}件（行が足りません）`);
  data.social.slice(0, SOCIAL_ROWS.length).forEach((i, k) => {
    const y = SOCIAL_ROWS[k] + 2.5;
    ops.push({ t: "text", s: i.kind, x: 486, y, w: 49 });
    ops.push({ t: "text", s: i.payee, x: 541, y, w: 66 });
    ops.push({ t: "text", s: i.burdenPerson + (i.burdenRelation ? `（${i.burdenRelation}）` : ""), x: 613, y, w: 101 });
    ops.push(amount(i.amount, 780, y + 1));
  });
  if (data.social.length > 0) ops.push(amount(calc.social.deduction, 779.8, 425));

  // 小規模企業共済等掛金（種類ごとに決まった行）
  SMALL_BIZ_ORDER.forEach((kind, k) => {
    const sum = data.smallBiz.filter((i) => i.kind === kind).reduce((a, i) => a + i.amount, 0);
    if (sum > 0) ops.push(amount(sum, 779.5, SMALL_BIZ_Y[k]));
  });
  if (data.smallBiz.length > 0) ops.push(amount(calc.smallBiz.deduction, 777.6, 571));

  return { ops, overflow };
}

