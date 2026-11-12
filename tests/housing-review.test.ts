import { describe, expect, it } from "vitest";
import { emptySelf, hasUnder23Dependent, newPerson } from "../src/lib/family";
import { calcHousing, defaultRate, housingInputFrom, residenceYear } from "../src/lib/housing";
import { buildChecklist, fillBlank, findBlanks, lowConfidence } from "../src/lib/review";
import { parsePasted, ReadResult } from "../src/lib/schema";

describe("住宅ローン控除", () => {
  it("居住開始の年を読む", () => {
    expect(residenceYear("2023-04-01")).toBe(2023);
    expect(residenceYear("令和5年4月1日")).toBe(2023);
    expect(residenceYear("令和元年10月1日")).toBe(2019);
    expect(residenceYear("平成30年3月20日")).toBe(2018);
    expect(residenceYear("")).toBe(null);
  });
  it("控除率の目安は、2021年までの入居が1%、2022年以後が0.7%", () => {
    expect(defaultRate("平成30年3月20日")).toBe(1);
    expect(defaultRate("2022-01-10")).toBe(0.7);
  });
  it("年末残高 × 控除率（100円未満切捨て）を、控除限度額までにする", () => {
    const r = calcHousing({ balance: 28_765_432, acquisitionCost: null, residentialPercent: 100, sharePercent: 100, ratePercent: 0.7, limit: 210_000, residenceStart: "2023-04-01" });
    expect(r.raw).toBe(201_300); // 28,765,432 × 0.7% = 201,358 → 201,300
    expect(r.amount).toBe(201_300);
    const capped = calcHousing({ balance: 40_000_000, acquisitionCost: null, residentialPercent: 100, sharePercent: 100, ratePercent: 1, limit: 400_000, residenceStart: "2019-04-01" });
    expect(capped.amount).toBe(400_000);
  });
  it("取得対価の額が残高より小さければ、取得対価の額を使う。負担割合も反映する", () => {
    const r = calcHousing({ balance: 30_000_000, acquisitionCost: 25_000_000, residentialPercent: 100, sharePercent: 50, ratePercent: 0.7, limit: null, residenceStart: "2023-04-01" });
    expect(r.myBalance).toBe(15_000_000);
    expect(r.costCap).toBe(12_500_000);
    expect(r.amount).toBe(87_500);
    expect(r.warnings.join()).toContain("負担割合");
  });
  it("今年入居（1年目）は確定申告が必要と案内する", () => {
    expect(calcHousing({ balance: 1, acquisitionCost: null, residentialPercent: 100, sharePercent: 100, ratePercent: 0.7, limit: 1, residenceStart: "2026-05-01" }).warnings[0]).toContain("確定申告");
  });
  it("読み取った書類から入力を作る（残高証明書が複数なら合計）", () => {
    const d = ReadResult.parse({
      housing: [
        { docKind: "控除申告書", lender: "", yearEndBalance: null, residenceStart: "令和5年4月1日", acquisitionCost: "35,000,000円", ratePercent: "0.7%", limit: 210000, houseType: "省エネ基準適合住宅", confidence: "高" },
        { docKind: "残高証明書", lender: "A銀行", yearEndBalance: 20000000, confidence: "高" },
        { docKind: "残高証明書", lender: "B銀行", yearEndBalance: 5000000, confidence: "中" },
      ],
    });
    const input = housingInputFrom(d.housing);
    expect(input).toMatchObject({ balance: 25_000_000, acquisitionCost: 35_000_000, ratePercent: 0.7, limit: 210_000 });
  });
});

describe("想定外の書類", () => {
  it("控除証明書でない書類は otherDocs に入り、全体はエラーにならない", () => {
    const r = parsePasted(JSON.stringify({ otherDocs: [{ docType: "医療費の領収書・通知", summary: "〇〇病院の領収書" }, { docType: "謎の書類", summary: "?" }] }));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.otherDocs.map((o) => o.docType)).toEqual(["医療費の領収書・通知", "その他"]);
  });
});

describe("確認ステップ", () => {
  const d = ReadResult.parse({
    life: [{ insurer: "A生命", policyType: "終身", period: "終身", contractor: "見本 太郎", beneficiary: "見本 花子", beneficiaryRelation: "", category: "一般", system: "新", amount: 1000, confidence: "中" }],
  });
  it("空欄の項目を見つけ、入力した値を反映する", () => {
    const blanks = findBlanks(d);
    expect(blanks.map((b) => b.field)).toEqual(["beneficiaryRelation"]);
    expect(findBlanks(fillBlank(d, blanks[0], "妻"))).toHaveLength(0);
  });
  it("自信がない項目を挙げる（年末残高のない住宅ローンの申告書は除く）", () => {
    expect(lowConfidence(d)).toHaveLength(1);
    const h = ReadResult.parse({ housing: [{ docKind: "控除申告書", yearEndBalance: null, confidence: "中" }, { docKind: "残高証明書", yearEndBalance: 100, confidence: "中" }] });
    expect(lowConfidence(h).map((x) => x.amount)).toEqual([100]);
  });
  it("撮り忘れの問いかけ：読み取った種類は済みになる", () => {
    const c = buildChecklist(d);
    expect(c.find((x) => x.id === "life")?.done).toBe(true);
    expect(c.find((x) => x.id === "earthquake")?.done).toBe(false);
  });
});

describe("11月30日以前の年末調整の読み替え", () => {
  it("子の所得が60万円なら、12月の年末調整では特例の対象、11月以前では対象外", () => {
    const f = { self: emptySelf(), spouse: null, dependents: [{ ...newPerson(), birth: "2008-05-01", salary: 1_340_000 }] }; // 所得60万円
    expect(hasUnder23Dependent(f)).toBe(true);
    expect(hasUnder23Dependent(f, 2026, 580_000)).toBe(false);
  });
});
