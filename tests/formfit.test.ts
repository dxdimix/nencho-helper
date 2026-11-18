import { describe, expect, it } from "vitest";
import { calculate } from "../src/lib/calc";
import { emptySelf, newPerson } from "../src/lib/family";
import { buildDependentsOps, fitRows } from "../src/lib/formOps";
import { ReadResult } from "../src/lib/schema";
import { submitList } from "../src/lib/submit";

const life = (insurer: string, category: string, system: string, amount: number) => ({ insurer, policyType: "終身", period: "", contractor: "", beneficiary: "", beneficiaryRelation: "", category, system, amount, amountBasis: "", confidence: "高", note: "" });
const base = { life: [], earthquake: [], social: [], smallBiz: [], excluded: [], housing: [], otherDocs: [] };

describe("申告書の行が足りないとき", () => {
  it("上限に達しているなら、残りは書かずに済ませる（控除額は変わらない）", () => {
    const data = ReadResult.parse({ ...base, life: ["A", "B", "C", "D", "E"].map((n, i) => life(n, "一般", "新", 30000 + i * 1000)) });
    const r = fitRows(data, false);
    expect(r.data.life).toHaveLength(4);
    expect(r.notes[0]).toContain("書かなくて大丈夫");
    expect(calculate(r.data).general.deduction).toBe(calculate(data).general.deduction);
    // 金額の小さい A を外す
    expect(r.data.life.map((i) => i.insurer)).not.toContain("A");
    const list = submitList(data, false);
    expect(list.submit).toHaveLength(4);
    expect(list.notNeeded[0].label).toContain("A");
  });
  it("上限に達していないなら、全部残す（別紙に書く案内になる）", () => {
    const data = ReadResult.parse({ ...base, life: ["A", "B", "C", "D", "E"].map((n) => life(n, "一般", "新", 5000)) });
    const r = fitRows(data, false);
    expect(r.data.life).toHaveLength(5);
    expect(r.notes).toHaveLength(0);
  });
});

describe("扶養控除等申告書のお手本", () => {
  it("書く家族がいなければ、白紙でよいと案内する", () => {
    const r = buildDependentsOps({ self: { ...emptySelf(), salary: 5_000_000 }, spouse: null, dependents: [] });
    expect(r.overflow[0]).toContain("白紙");
    expect(r.ops.some((o) => o.t === "fill" && o.s === "あなたの氏名")).toBe(true);
  });
  it("家族がいれば、家族の欄を書く", () => {
    const f = { self: { ...emptySelf(), salary: 5_000_000 }, spouse: { ...newPerson("配偶者"), birth: "1990-05-05" }, dependents: [{ ...newPerson("子"), label: "長男", birth: "2008-04-01" }, { ...newPerson("子"), label: "次男", birth: "2016-04-01" }] };
    const r = buildDependentsOps(f);
    expect(r.overflow.join()).not.toContain("白紙");
    const fills = r.ops.filter((o) => o.t === "fill").map((o) => (o as { s: string }).s);
    expect(fills).toContain("配偶者の氏名（フリガナも）");
    expect(fills).toContain("長男の氏名（フリガナも）");
    expect(fills).toContain("次男の氏名（フリガナも）");
  });
});
