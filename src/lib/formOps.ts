import type { Calculation } from "./calc";
import type { ReadResult } from "./schema";
import { calculate } from "./calc";
import { basicForm, classify, dependentsForm, totalIncome, toWareki, under23DependentFor, type Family, type Person } from "./family";

// 国税庁「令和8年分 給与所得者の保険料控除申告書」の画像に書く内容と位置。
// 座標は PDF の座標（ポイント、用紙の幅 841.89 × 高さ 595.276）。位置は様式 PDF の文字の座標から求めた。

export const PAGE_W = 841.89;
export const PAGE_H = 595.276;

export type Op =
  | { t: "text"; s: string; x: number; y: number; w: number; size?: number; align?: "left" | "right" | "center" }
  | { t: "circle"; x: number; y: number; r: number }
  /** あなたが自分で書く欄（お手本にない情報）。欄を薄い赤で塗り、赤字で何を書くかを示す */
  | { t: "fill"; s: string; x: number; y: number; w: number; h: number; size?: number };

/** 自分で書く欄 */
const fill = (s: string, x: number, y: number, w: number, h: number, size = 5.5): Op => ({ t: "fill", s, x, y, w, h, size });

/** 和暦の元号・年・月・日に分ける（例：1988-12-12 → 昭和, 63, 12, 12） */
export function warekiParts(birth: string): { era: string; year: string; month: string; day: string } | null {
  const m = /^(明治|大正|昭和|平成|令和)(元|\d+)年(\d+)月(\d+)日$/.exec(toWareki(birth));
  return m ? { era: m[1], year: m[2] === "元" ? "1" : m[2], month: m[3], day: m[4] } : null;
}

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

// ---------------------------------------------------------------------------
// 行が足りないとき：書ける行数のハガキだけで控除額が変わらない（上限に達する）なら、残りは書かない

/** items から n 件を選ぶ組み合わせのうち、score が最大のもの（件数が多いときは金額の大きい順） */
function bestSubset<T extends { amount: number }>(items: T[], n: number, score: (sub: T[]) => number): T[] {
  if (items.length > 14) return [...items].sort((a, b) => b.amount - a.amount).slice(0, n);
  let best: T[] = items.slice(0, n);
  let bestScore = -1;
  const pick = (start: number, cur: T[]) => {
    if (cur.length === n) {
      const sc = score(cur) * 1e9 + cur.reduce((a, i) => a + i.amount, 0); // 同じ控除額なら、金額の合計が大きい方
      if (sc > bestScore) [best, bestScore] = [cur, sc];
      return;
    }
    for (let i = start; i <= items.length - (n - cur.length); i++) pick(i + 1, [...cur, items[i]]);
  };
  pick(0, []);
  return best;
}

const LIFE_LABEL = { 一般: "一般の生命保険料", 介護医療: "介護医療保険料", 個人年金: "個人年金保険料" } as const;

/**
 * 申告書の行より多いハガキがあるとき、行に収まる分だけで控除額が変わらないか調べる。
 * 変わらない（上限に達している）なら、書く分だけに絞ったデータと、その説明を返す。
 * 変わるなら、データはそのまま（buildOps が「余白か別紙に書いてください」と知らせる）。
 */
export function fitRows(data: ReadResult, under23: boolean): { data: ReadResult; notes: string[] } {
  let d = data;
  const notes: string[] = [];
  const full = calculate(data, { under23 });
  const yenText = (n: number) => `${n.toLocaleString("ja-JP")}円`;

  for (const cat of ["一般", "介護医療", "個人年金"] as const) {
    const items = d.life.filter((i) => i.category === cat);
    const n = ROWS[cat].length;
    if (items.length <= n) continue;
    const others = d.life.filter((i) => i.category !== cat);
    const block = (r: ReadResult) => {
      const c = calculate(r, { under23 });
      return cat === "一般" ? c.general.deduction : cat === "介護医療" ? c.care.deduction : c.pension.deduction;
    };
    const target = block(d);
    const sub = bestSubset(items, n, (x) => block({ ...d, life: [...others, ...x] }));
    if (block({ ...d, life: [...others, ...sub] }) === target) {
      const rest = items.filter((i) => !sub.includes(i));
      d = { ...d, life: [...others, ...sub] };
      notes.push(
        `${LIFE_LABEL[cat]}のハガキは${items.length}枚ありますが、申告書の${n}行分だけで控除額が上限（${yenText(target)}）に達します。残りの${rest.length}枚（${rest.map((i) => `${i.insurer || "会社名なし"} ${i.amount.toLocaleString("ja-JP")}円`).join("、")}）は、書かなくて大丈夫です。お手本の金額も、書く${n}枚分で計算しています。書かないハガキは会社に出さなくてもかまいません。`,
      );
    }
  }

  if (d.earthquake.length > QUAKE_ROWS.length) {
    const n = QUAKE_ROWS.length;
    const target = full.earthquake.deduction;
    const q = (x: ReadResult["earthquake"]) => calculate({ ...d, earthquake: x }, { under23 }).earthquake.deduction;
    const sub = bestSubset(d.earthquake, n, q);
    if (q(sub) === target) {
      const rest = d.earthquake.filter((i) => !sub.includes(i));
      d = { ...d, earthquake: sub };
      notes.push(
        `地震保険料のハガキは${data.earthquake.length}枚ありますが、申告書の${n}行分だけで控除額が上限（${yenText(target)}）に達します。残りの${rest.length}枚は、書かなくて大丈夫です。お手本の金額も、書く${n}枚分で計算しています。`,
      );
    }
  }
  return { data: d, notes };
}

type Under23Who = ReturnType<typeof under23DependentFor>;

export function buildOps(data: ReadResult, calc: Calculation, under23: boolean, u23: Under23Who = null): { ops: Op[]; overflow: string[] } {
  const ops: Op[] = [];
  const overflow: string[] = [];

  // あなたが自分で書く欄（赤）
  ops.push(fill("会社の案内に従う（印字済みなら不要）", 38, 48, 51, 47, 5));
  ops.push(fill("勤務先の会社名（印字済みなら不要）", 154, 35.5, 236, 27));
  ops.push(fill("勤務先の住所（印字済みなら不要）", 154, 86.5, 236, 23));
  ops.push(fill("あなたの氏名のフリガナ", 454, 35.5, 248, 12.5, 5));
  ops.push(fill("あなたの氏名", 454, 48, 248, 36));
  ops.push(fill("あなたの住所", 454, 84, 248, 25));

  // 生命保険料（区分ごとの行）
  for (const cat of ["一般", "介護医療", "個人年金"] as const) {
    const items = data.life.filter((i) => i.category === cat);
    const rows = ROWS[cat];
    if (items.length > rows.length)
      overflow.push(`${LIFE_LABEL[cat]}：ハガキが${items.length}枚あり、申告書の行（${rows.length}行）が足りません。書ききれない${items.length - rows.length}枚の分も控除額に入っているので、余白か別紙に同じ形で書いてください。`);
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
    // ☆ 年齢23歳未満の扶養親族（「有」のときだけ。1人書けばよい）
    if (under23 && u23) {
      const p = u23.person;
      const name = p.label || p.relation;
      ops.push(fill(`${name}の氏名（フリガナも）`, 62, 478, 115, 32));
      ops.push(fill(`${name}のマイナンバー`, 179, 475, 133, 14));
      ops.push(fill("別に住んでいる場合だけ住所", 179, 496, 133, 14, 5));
      ops.push({ t: "text", s: p.relation, x: 329.5, y: 508, w: 30, align: "center" });
      const w = warekiParts(p.birth);
      if (w) {
        ops.push({ t: "circle", x: w.era === "令和" ? 332.5 : 324.5, y: 486.2, r: 3.6 });
        ops.push({ t: "text", s: w.year, x: 367, y: 488, w: 14, align: "right" });
        ops.push({ t: "text", s: w.month, x: 381, y: 488, w: 10, align: "right" });
        ops.push({ t: "text", s: w.day, x: 394, y: 488, w: 10, align: "right" });
      }
      ops.push(amount(u23.income, 391, 507.5));
    }
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
  if (data.earthquake.length > QUAKE_ROWS.length)
    overflow.push(`地震保険料：ハガキが${data.earthquake.length}枚あり、申告書の行が足りません。書ききれない${data.earthquake.length - QUAKE_ROWS.length}枚の分も控除額に入っているので、余白か別紙に書いてください。`);
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
  if (data.social.length > SOCIAL_ROWS.length)
    overflow.push(`社会保険料：${data.social.length}件あり、申告書の行が足りません。社会保険料は全額が控除になるので、書ききれない${data.social.length - SOCIAL_ROWS.length}件も余白か別紙に書いてください。`);
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


// ---------------------------------------------------------------------------
// 令和8年分 基礎控除申告書 兼 配偶者控除等申告書 兼 特定親族特別控除申告書 兼 所得金額調整控除申告書

const check = (x: number, y: number): Op => ({ t: "text", s: "✓", x, y: y + 3, w: 10, size: 9, align: "center" });

// 「判定」欄のチェックボックス（上から順に。基礎控除の行と同じ順）
const BASIC_CHECK_Y = [233.1, 246.3, 259.7, 273.4, 286.8, 300.8, 313.7, 327.4, 340.8];
const BASIC_ROW_LABELS = [
  "489万円以下",
  "489万円超 655万円以下",
  "655万円超 900万円以下",
  "900万円超 950万円以下",
  "950万円超 1,000万円以下",
  "1,000万円超 2,350万円以下",
  "2,350万円超 2,400万円以下",
  "2,400万円超 2,450万円以下",
  "2,450万円超 2,500万円以下",
];
const SPOUSE_CHECK_Y = { "①": 205.8, "②": 230.9, "③": 249.6, "④": 265.9 } as const;
const SPECIFIC_Y = [427.5, 454.5];
const ADJUST_CHECK_Y: Record<string, number> = {
  あなた自身が特別障害者: 519.6,
  同一生計配偶者が特別障害者: 532.7,
  扶養親族が特別障害者: 545.8,
  "扶養親族が年齢23歳未満（平16.1.2以後生）": 559.1,
};

export function buildBasicOps(f: Family): { ops: Op[]; overflow: string[] } {
  const r = basicForm(f);
  const b = r.basic;
  const ops: Op[] = [];
  const overflow: string[] = [];

  // あなたが自分で書く欄（赤）
  ops.push(fill("会社の案内に従う（印字済みなら不要）", 55.5, 48, 52, 36, 5));
  ops.push(fill("勤務先の会社名（印字済みなら不要）", 186, 38.5, 168, 16.5));
  ops.push(fill("勤務先の住所（印字済みなら不要）", 186, 74.5, 168, 19));
  ops.push(fill("あなたの氏名のフリガナ", 414, 38.5, 240, 10.5, 5));
  ops.push(fill("あなたの氏名", 414, 49, 240, 25));
  ops.push(fill("あなたの住所", 414, 74.5, 240, 19));

  // あなたの合計所得金額の見積額
  ops.push(amount(f.self.salary, 209.5, 163));
  ops.push(amount(b.salaryIncome, 304, 163));
  ops.push(amount(b.otherIncome, 304, 190));
  ops.push(amount(b.total, 303, 210));
  const row = BASIC_ROW_LABELS.indexOf(b.judgeRow);
  if (row >= 0) ops.push(check(85.5, BASIC_CHECK_Y[row]));
  // 区分Ⅰと配偶者の欄は、配偶者控除等を受けられるときだけ書く（受けられないときは配偶者控除等申告書を書かない）
  const spouseApplies = !!(f.spouse && r.spouse && r.spouse.kind);
  if (b.kubun1 && spouseApplies) ops.push({ t: "text", s: b.kubun1, x: 280, y: 253, w: 40, size: 11, align: "center" });
  ops.push(amount(b.amount, 305, 308));

  // 配偶者
  if (f.spouse && r.spouse && spouseApplies) {
    const s = r.spouse;
    ops.push(fill("配偶者の氏名（フリガナも）", 335, 150.5, 126, 32));
    ops.push(fill("配偶者のマイナンバー", 463, 134.5, 147, 15.5));
    ops.push(fill("別に住んでいる場合だけ、配偶者の住所", 463, 163, 147, 19.5, 5));
    const w = warekiParts(f.spouse.birth);
    if (w) {
      if (w.era === "昭和" || w.era === "平成") ops.push({ t: "circle", x: w.era === "昭和" ? 630.5 : 642, y: 145, r: 3.6 });
      ops.push({ t: "text", s: w.year, x: 692, y: 147, w: 20, align: "right", size: 7.5 });
      ops.push({ t: "text", s: w.month, x: 728, y: 147, w: 16, align: "right", size: 7.5 });
      ops.push({ t: "text", s: w.day, x: 768, y: 147, w: 16, align: "right", size: 7.5 });
    }
    ops.push(amount(f.spouse.salary, 476.8, 225));
    ops.push(amount(s.income - f.spouse.otherIncome, 563, 225));
    ops.push(amount(f.spouse.otherIncome, 563, 245));
    ops.push(amount(s.income, 562.5, 268));
    if (s.kubun2) {
      ops.push(check(610, SPOUSE_CHECK_Y[s.kubun2]));
      if (s.kind) ops.push({ t: "text", s: s.kubun2, x: 772.2, y: 254, w: 14, size: 10, align: "center" });
    }
    if (s.kind === "配偶者控除") ops.push(amount(s.amount, 767.5, 308.5));
    if (s.kind === "配偶者特別控除") ops.push(amount(s.amount, 767.5, 340.5));
  }

  // 特定親族
  if (r.specific.length > SPECIFIC_Y.length) overflow.push(`特定親族：${r.specific.length - SPECIFIC_Y.length}人（行が足りません。続きは余白か別紙に書いてください）`);
  r.specific.slice(0, SPECIFIC_Y.length).forEach(({ status, amount: a }, k) => {
    const top = [404, 431][k];
    const name = status.person.label || status.person.relation;
    ops.push(fill(`${name}の氏名（フリガナも）`, 60, top, 125, 26));
    ops.push(fill(`${name}のマイナンバー`, 187, top, 147, 26));
    ops.push(fill("別に住んでいる場合だけ住所", 420, top, 132, 26, 5));
    ops.push({ t: "text", s: status.person.relation, x: 344.5, y: top + 15, w: 17, align: "center", size: 6 });
    const w = warekiParts(status.person.birth);
    if (w) {
      ops.push({ t: "text", s: w.year, x: 375, y: top + 14, w: 12, align: "right" });
      ops.push({ t: "text", s: w.month, x: 393.5, y: top + 14, w: 10, align: "right" });
      ops.push({ t: "text", s: w.day, x: 411.5, y: top + 14, w: 10, align: "right" });
    }
    ops.push(amount(status.income, 686, SPECIFIC_Y[k]));
    ops.push(amount(a, 768, SPECIFIC_Y[k]));
  });

  // 所得金額調整控除の要件
  if (r.adjustment.applies) {
    for (const reason of r.adjustment.reasons) {
      const y = ADJUST_CHECK_Y[reason];
      if (y) ops.push(check(79.2, y));
    }
    // ☆欄（配偶者や扶養親族が要件のとき）と★欄は、お手本にない情報なので自分で書く
    if (r.adjustment.reasons.some((x) => x !== "あなた自身が特別障害者")) {
      ops.push(fill("要件にあたる家族の氏名（フリガナも）", 293, 535.5, 101, 30));
      ops.push(fill("その家族のマイナンバー", 396, 521, 144, 18));
      ops.push(fill("別に住んでいる場合だけ住所", 396, 552, 144, 14, 5));
      ops.push(fill("その家族の生年月日（元号に○）", 542, 521, 116, 17, 5));
      ops.push(fill("続柄", 542, 552, 36, 14, 5));
      ops.push(fill("その家族の所得", 579, 552, 79, 14, 5));
    }
    if (r.adjustment.reasons.some((x) => x.includes("特別障害者")))
      ops.push(fill("特別障害者にあたる事実（手帳の種類・等級など）", 682, 526, 105, 26, 5));
  }
  return { ops, overflow };
}

// ---------------------------------------------------------------------------
// 令和9年分 給与所得者の扶養控除等（異動）申告書（年末調整の時期に、来年分として提出する）
// 位置は国税庁の様式 PDF（2027bun_01.pdf）の文字の座標から求めた。

const B_TOPS = [199.2, 239, 278.8, 318.6]; // Ｂ欄の各行の上端
const U16_TOPS = [506, 526]; // 住民税に関する事項（16歳未満）の各行の上端

/** 生年月日（元号の○と年月日）を書く。eras は元号の○の位置 */
function birthOps(birth: string, eras: Record<string, [number, number]>, right: { year: number; month: number; day: number }, baseline: number): Op[] {
  const w = warekiParts(birth);
  if (!w) return [];
  const ops: Op[] = [];
  const pos = eras[w.era];
  if (pos) ops.push({ t: "circle", x: pos[0], y: pos[1], r: 3.4 });
  ops.push({ t: "text", s: w.year, x: right.year, y: baseline, w: 14, align: "right" });
  ops.push({ t: "text", s: w.month, x: right.month, y: baseline, w: 12, align: "right" });
  ops.push({ t: "text", s: w.day, x: right.day, y: baseline, w: 12, align: "right" });
  return ops;
}

const disabilityRow = (d: Person["disability"], together: boolean) => (d === "特別障害者" ? (together ? 407 : 393.7) : 380.3);

export function buildDependentsOps(f: Family, year = 2027): { ops: Op[]; overflow: string[] } {
  const r = dependentsForm(f, year);
  const ops: Op[] = [];
  const overflow: string[] = [];

  // 上の欄（だれでも書く）
  ops.push(fill("会社の案内に従う", 32, 47, 66, 22, 5));
  ops.push(fill("住んでいる市区町村", 32, 84, 66, 18, 5));
  ops.push(fill("勤務先の会社名（印字済みなら不要）", 169, 33, 163, 29));
  ops.push(fill("勤務先の住所（印字済みなら不要）", 169, 89, 163, 25));
  ops.push(fill("あなたの氏名のフリガナ", 386.5, 33, 148, 11.5, 5));
  ops.push(fill("あなたの氏名", 386.5, 44.5, 148, 20.5));
  ops.push(fill("あなたのマイナンバー（12桁）", 386.5, 65, 148, 21.5));
  ops.push(fill("郵便番号とあなたの住所", 386.5, 86.5, 242, 27));
  ops.push(fill("あなたの生年月日（元号に○）", 607, 33, 89, 11.5, 4.8));
  ops.push(fill("世帯主の氏名（あなたが世帯主なら自分の名前）", 578.5, 44.5, 117, 20.5, 5));
  ops.push(fill("世帯主から見たあなたの続柄（世帯主なら「本人」）", 578.5, 65, 117, 21.5, 5));
  // 配偶者の有無（結婚しているか。収入に関係なく「有」）
  ops.push({ t: "circle", x: f.spouse ? 669.5 : 685.6, y: 100.8, r: 5 });

  // Ａ 源泉控除対象配偶者
  if (f.spouse && r.spouseA?.show) {
    ops.push(fill("配偶者の氏名（フリガナも）", 99.5, 163, 102, 35));
    ops.push(fill("配偶者のマイナンバー", 201.6, 163, 153.4, 20));
    ops.push(fill("夫 または 妻", 201.6, 183.5, 51, 14.5, 5));
    ops.push(...birthOps(f.spouse.birth, { 明治: [258.6, 185.7], 大正: [270.6, 185.7], 昭和: [258.6, 192.6], 平成: [270.6, 192.6] }, { year: 296, month: 323, day: 350 }, 193.5));
    ops.push(amount(r.spouseA.income, 458, 195.5));
    ops.push(fill("住所（同居なら「同上」）", 576, 163, 105, 35, 5));
  }

  // Ｂ 源泉控除対象親族（16歳以上）
  if (r.withholding.length > B_TOPS.length) overflow.push(`Ｂ欄：${r.withholding.length}人いますが、申告書の行は${B_TOPS.length}行です。残りの${r.withholding.length - B_TOPS.length}人は余白か別紙に書いてください。`);
  r.withholding.slice(0, B_TOPS.length).forEach((s, k) => {
    const top = B_TOPS[k];
    const p = s.person;
    const name = p.label || p.relation;
    ops.push(fill(`${name}の氏名（フリガナも）`, 108, top, 93.6, 39.8));
    ops.push(fill(`${name}のマイナンバー`, 201.6, top, 153.4, 20));
    ops.push({ t: "text", s: p.relation, x: 227, y: top + 35, w: 45, align: "center" });
    ops.push(...birthOps(p.birth, { 明治: [258.6, top + 26.4], 大正: [270.6, top + 26.4], 昭和: [258.6, top + 33.2], 平成: [270.6, top + 33.2] }, { year: 296, month: 323, day: 350 }, top + 34));
    if (s.isElderly) ops.push(check(362.6, s.isCoResidentParent ? top + 6 : top + 13.9));
    else if (s.isSpecialDependent) ops.push(check(362.6, top + 25.8));
    else if (s.isSpecificRelative) ops.push(check(362.6, top + 33.7));
    ops.push(amount(s.income, 458, top + 36.3));
    ops.push(fill("住所（同居なら「同上」）", 576, top, 105, 39.8, 5));
  });

  // Ｃ 障害者・寡婦・ひとり親・勤労学生
  const selfIncome = r.selfIncome;
  let needDetail = false;
  if (f.self.disability !== "なし") {
    ops.push(check(106.8, 367.1));
    ops.push(check(208, disabilityRow(f.self.disability, false)));
    needDetail = true;
  }
  if (f.spouse && totalIncome(f.spouse) <= 620_000 && f.spouse.disability !== "なし") {
    ops.push(check(106.8, 367.1));
    ops.push(check(243.6, disabilityRow(f.spouse.disability, f.spouse.livingTogether)));
    needDetail = true;
  }
  const counts = new Map<number, number>();
  for (const p of f.dependents) {
    const st = classify(p, year);
    if (st.isDependent && p.disability !== "なし") {
      const y = disabilityRow(p.disability, p.livingTogether);
      counts.set(y, (counts.get(y) ?? 0) + 1);
    }
  }
  for (const [y, n] of counts) {
    ops.push(check(106.8, 367.1));
    ops.push({ t: "text", s: String(n), x: 286, y: y + 2.5, w: 8, align: "center" });
    needDetail = true;
  }
  if (f.self.widow !== "なし" && selfIncome <= 5_000_000) ops.push(check(306.7, f.self.widow === "寡婦" ? 367.1 : 383.3));
  if (f.self.workingStudent && selfIncome <= 890_000 && f.self.otherIncome <= 100_000) {
    ops.push(check(306.7, 399.5));
    needDetail = true;
  }
  if (needDetail) ops.push(fill("障害の内容（手帳の種類・等級など）や、勤労学生の学校名", 356, 369.6, 325, 27.9));

  // 住民税に関する事項（16歳未満の扶養親族）
  if (r.under16.length > U16_TOPS.length) overflow.push(`16歳未満の扶養親族：${r.under16.length}人いますが、申告書の行は${U16_TOPS.length}行です。残りの${r.under16.length - U16_TOPS.length}人は余白か別紙に書いてください。`);
  r.under16.slice(0, U16_TOPS.length).forEach((s, k) => {
    const top = U16_TOPS[k];
    const p = s.person;
    const name = p.label || p.relation;
    ops.push(fill(`${name}の氏名（フリガナも）`, 108, top, 85, 20, 5));
    ops.push(fill(`${name}のマイナンバー`, 193.5, top, 148, 20));
    ops.push({ t: "text", s: p.relation, x: 352, y: top + 13, w: 18, align: "center", size: 6 });
    ops.push(...birthOps(p.birth, { 平成: [365.9, top + 5.7], 令和: [365.9, top + 15] }, { year: 378.5, month: 394, day: 412 }, top + 14));
    ops.push(amount(s.income, 675, top + 16));
    ops.push(fill("住所（同居なら「同上」）", 414, top, 143, 20, 5));
  });

  const blank = !(f.spouse && r.spouseA?.show) && r.withholding.length === 0 && r.under16.length === 0 && !needDetail && !(f.self.widow !== "なし" && selfIncome <= 5_000_000);
  if (blank)
    overflow.unshift("この申告書は、いちばん上の欄（赤い所：氏名・住所・マイナンバーなど）と「配偶者の有無」だけを書いて出します。その下の欄（Ａ〜Ｄ・住民税の欄）は、書く家族がいないので白紙のままで大丈夫です。");
  return { ops, overflow };
}
