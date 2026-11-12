import { describe, expect, it } from "vitest";
import { buildOps } from "../src/lib/formOps";
import { calculate } from "../src/lib/calc";
import { ReadResult } from "../src/lib/schema";

const life = (category: "一般" | "介護医療" | "個人年金", system: "新" | "旧", amount: number) => ({
  insurer: "A生命", policyType: "終身", period: "終身", contractor: "本人", beneficiary: "本人", category, system, amount, confidence: "高" as const,
});

describe("申告書の画像に書く内容", () => {
  it("23歳未満の特例では ②⑤ 欄、そうでなければ ①④ 欄に書く", () => {
    const r = ReadResult.parse({ life: [life("一般", "新", 80000)] });
    const texts = (u23: boolean) => buildOps(r, calculate(r, { under23: u23 }), u23).ops.flatMap((o) => (o.t === "text" ? [[o.s, o.y]] : []));
    expect(texts(false)).toContainEqual(["40,000", 238.5]); // ①
    expect(texts(true)).toContainEqual(["50,000", 256.8]); // ②
  });
  it("行が足りないときは知らせる", () => {
    const r = ReadResult.parse({ life: Array.from({ length: 5 }, () => life("一般", "新", 1000)) });
    expect(buildOps(r, calculate(r), false).overflow[0]).toContain("1件");
  });
});

import { emptySelf, newPerson } from "../src/lib/family";
import { buildBasicOps } from "../src/lib/formOps";

describe("基礎控除申告書の画像に書く内容", () => {
  it("区分Ⅰ・区分Ⅱ・配偶者特別控除の額・特定親族・所得金額調整控除のチェックを書く", () => {
    const f = {
      self: { ...emptySelf(), salary: 9_000_000 },
      spouse: { ...newPerson("配偶者"), birth: "1985-03-03", salary: 1_750_000 },
      dependents: [{ ...newPerson(), birth: "2015-06-01" }, { ...newPerson(), birth: "2006-06-01", salary: 1_700_000 }],
    };
    const texts = buildBasicOps(f).ops.flatMap((o) => (o.t === "text" ? [o.s] : []));
    expect(texts).toEqual(expect.arrayContaining(["7,000,000", "620,000", "A", "④", "310,000", "960,000", "410,000"]));
    expect(texts.filter((t) => t === "✓")).toHaveLength(3); // 判定・区分Ⅱ・所得金額調整控除の要件
  });
});

describe("配偶者控除等を受けないときは、配偶者の欄と区分Ⅰを書かない", () => {
  it("配偶者の所得が133万円を超える", () => {
    const f = { self: { ...emptySelf(), salary: 6_000_000 }, spouse: { ...newPerson("配偶者"), birth: "1985-01-01", salary: 3_000_000 }, dependents: [] };
    const texts = buildBasicOps(f).ops.flatMap((o) => (o.t === "text" ? [o.s] : []));
    expect(texts).not.toContain("A");
    expect(texts).not.toContain("3,000,000");
    expect(texts.filter((t) => t === "✓")).toHaveLength(1); // 基礎控除の判定だけ
  });
});
