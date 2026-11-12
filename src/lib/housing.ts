import type { HousingItem } from "./schema";

// 住宅ローン控除（住宅借入金等特別控除）の計算。年末調整で受けられるのは、入居2年目以降。
// 申告書の様式は入居した年や住宅の区分で変わるため、どの様式にも共通する
//   控除額 ＝ 対象となる年末残高 × 控除率（100円未満切捨て、控除限度額まで）
// の形で計算する。連帯債務・借換え・増改築・店舗併用住宅などは、申告書の記載例で確認するよう案内する。

export type HousingInput = {
  /** 年末残高（金融機関の残高証明書、または申告書に印字された額） */
  balance: number | null;
  /** 家屋・土地の取得対価の額（申告書に記載。分からなければ null） */
  acquisitionCost: number | null;
  /** 居住用の割合（%）。店舗などと兼用でなければ 100 */
  residentialPercent: number;
  /** あなたの負担割合（%）。夫婦の連帯債務やペアローンでなければ 100 */
  sharePercent: number;
  /** 控除率（%）。申告書に印字 */
  ratePercent: number | null;
  /** 控除限度額（円）。申告書に「最高○○円」と印字 */
  limit: number | null;
  /** 居住開始年月日（YYYY-MM-DD など） */
  residenceStart: string;
};

/** 読み取った書類から、計算に使う値を集める */
export function housingInputFrom(items: HousingItem[]): HousingInput {
  const form = items.find((i) => i.docKind === "控除申告書");
  const certs = items.filter((i) => i.docKind === "残高証明書" && i.yearEndBalance !== null);
  const balance = certs.length > 0 ? certs.reduce((a, i) => a + (i.yearEndBalance ?? 0), 0) : (form?.yearEndBalance ?? null);
  const start = items.map((i) => i.residenceStart).find((s) => s) ?? "";
  return {
    balance,
    acquisitionCost: form?.acquisitionCost ?? null,
    residentialPercent: 100,
    sharePercent: 100,
    ratePercent: form?.ratePercent ?? defaultRate(start),
    limit: form?.limit ?? null,
    residenceStart: start,
  };
}

/** 居住開始の年（西暦）。「令和5年」「平成30年」「2023-04-01」などに対応 */
export function residenceYear(start: string): number | null {
  const m = /(\d{4})[-/年]/.exec(start);
  if (m) return Number(m[1]);
  const wa = /(令和|平成)\s*(\d+|元)\s*年/.exec(start);
  if (wa) return (wa[1] === "令和" ? 2018 : 1988) + (wa[2] === "元" ? 1 : Number(wa[2]));
  return null;
}

/** 控除率の目安：令和3年（2021年）までの入居は1%、令和4年（2022年）以後は0.7% */
export function defaultRate(start: string): number | null {
  const y = residenceYear(start);
  if (y === null) return null;
  return y <= 2021 ? 1 : 0.7;
}

export type HousingResult = {
  /** あなたの負担分の年末残高 */
  myBalance: number | null;
  /** 取得対価の額から求めた上限（居住用・負担割合を反映） */
  costCap: number | null;
  /** 計算に使う残高（小さい方） */
  target: number | null;
  /** 残高 × 控除率（100円未満切捨て） */
  raw: number | null;
  /** 控除額（限度額まで） */
  amount: number | null;
  /** 足りない入力 */
  missing: string[];
  /** 注意 */
  warnings: string[];
};

export function calcHousing(input: HousingInput, year = 2026): HousingResult {
  const missing: string[] = [];
  const warnings: string[] = [];
  if (input.balance === null) missing.push("年末残高（金融機関から届く「年末残高等証明書」に書いてあります）");
  if (input.ratePercent === null) missing.push("控除率（税務署から届いた申告書に印字されています。分からなければ居住開始年月日を入れてください）");

  const y = residenceYear(input.residenceStart);
  if (y !== null && y >= year) {
    warnings.push("今年住み始めた場合（1年目）は、年末調整では受けられません。来年の2月〜3月に確定申告をしてください。2年目からは年末調整で受けられます。");
  }
  if (y !== null && y <= 2012) {
    warnings.push("住み始めてから長い年数がたっています。控除を受けられる期間（10年または13年など）が終わっていないか、税務署から届いた申告書の年分を確認してください。");
  }
  if (input.sharePercent < 100) {
    warnings.push("夫婦で借りている（連帯債務・ペアローン）場合の負担割合は、税務署から届いた申告書や、初年度の確定申告の控えで確認してください。");
  }

  const share = input.sharePercent / 100;
  const myBalance = input.balance === null ? null : Math.floor(input.balance * share);
  const costCap = input.acquisitionCost === null ? null : Math.floor(input.acquisitionCost * (input.residentialPercent / 100) * share);
  const target = myBalance === null ? null : costCap === null ? myBalance : Math.min(myBalance, costCap);
  const raw = target === null || input.ratePercent === null ? null : Math.floor((target * input.ratePercent) / 100 / 100) * 100;
  const amount = raw === null ? null : input.limit === null ? raw : Math.min(raw, input.limit);
  if (input.limit === null && raw !== null) {
    warnings.push("控除限度額（申告書の「最高○○円」）が分からないため、限度額で抑える前の金額を表示しています。申告書の印字と見比べてください。");
  }
  return { myBalance, costCap, target, raw, amount, missing, warnings };
}
