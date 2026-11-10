import { describe, expect, it } from "vitest";
import { calculate, lifeNewFormula, lifeOldFormula, oldLongTermFormula } from "../src/lib/calc";
import { ReadResult, mergeResults, parsePasted } from "../src/lib/schema";

describe("計算式", () => {
  it("計算式Ⅰ（新）", () => {
    expect(lifeNewFormula(20000)).toBe(20000);
    expect(lifeNewFormula(30000)).toBe(25000);
    expect(lifeNewFormula(60001)).toBe(35001); // 60001/4=15000.25 → 切り上げ
    expect(lifeNewFormula(100000)).toBe(40000);
  });
  it("計算式Ⅱ（旧）", () => {
    expect(lifeOldFormula(25000)).toBe(25000);
    expect(lifeOldFormula(40000)).toBe(32500);
    expect(lifeOldFormula(80000)).toBe(45000);
    expect(lifeOldFormula(120000)).toBe(50000);
  });
  it("旧長期損害", () => {
    expect(oldLongTermFormula(15000)).toBe(12500);
    expect(oldLongTermFormula(30000)).toBe(15000);
  });
});

describe("控除額の合計", () => {
  const base = ReadResult.parse({});
  const life = (category: "一般" | "介護医療" | "個人年金", system: "新" | "旧", amount: number) => ({
    insurer: "A生命", policyType: "終身", period: "終身", contractor: "本人", beneficiary: "配偶者",
    category, system, amount, confidence: "高" as const,
  });

  it("一般で新旧両方あるときは、旧のみと（新＋旧 上限4万）の大きい方", () => {
    const r = ReadResult.parse({ ...base, life: [life("一般", "新", 30000), life("一般", "旧", 120000)] });
    const c = calculate(r);
    expect(c.general.oldDeduction).toBe(50000);
    expect(c.general.combined).toBe(40000);
    expect(c.general.deduction).toBe(50000);
  });

  it("生命保険料控除は最高12万円", () => {
    const r = ReadResult.parse({
      ...base,
      life: [life("一般", "旧", 200000), life("個人年金", "旧", 200000), life("介護医療", "新", 100000)],
    });
    expect(calculate(r).lifeDeduction).toBe(120000);
  });

  it("地震保険料控除は最高5万円", () => {
    const r = ReadResult.parse({
      ...base,
      earthquake: [
        { insurer: "B損保", policyType: "地震", period: "1年", contractor: "本人", category: "地震", amount: 45000, confidence: "高" },
        { insurer: "C損保", policyType: "長期", period: "10年", contractor: "本人", category: "旧長期損害", amount: 30000, confidence: "高" },
      ],
    });
    expect(calculate(r).earthquake.deduction).toBe(50000);
  });
});

describe("貼り付けの読み込み", () => {
  it("コードブロック付きの回答を読み込める", () => {
    const res = parsePasted('はい。\n```json\n{"life":[],"social":[{"kind":"国民年金保険料","payee":"日本年金機構","amount":203760,"confidence":"高"}]}\n```');
    expect(res.ok).toBe(true);
    if (res.ok) expect(calculate(res.data).social.deduction).toBe(203760);
  });
  it("AIが error を返したときは、その理由を表示する", () => {
    const res = parsePasted('```json\n{"life":[],"error":"写真が添付されていません"}\n```');
    expect(res).toEqual({ ok: false, error: "読み取れませんでした：写真が添付されていません" });
  });
  it("複数の結果をつなげられる", () => {
    const a = ReadResult.parse({ social: [{ kind: "国民年金保険料", payee: "日本年金機構", amount: 1000, confidence: "高" }] });
    const b = ReadResult.parse({ social: [{ kind: "国民年金保険料", payee: "日本年金機構", amount: 2000, confidence: "高" }] });
    expect(calculate(mergeResults(a, b)).social.deduction).toBe(3000);
  });
  it("形式が違えばエラーを返す", () => {
    expect(parsePasted("読み取れませんでした").ok).toBe(false);
  });
});
