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
