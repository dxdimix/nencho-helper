import { z } from "zod";

// チャットで読み取った結果（JSON）の形。依頼文（prompt.ts）と必ずそろえる。
const Confidence = z.enum(["高", "中", "低"]);

export const LifeItem = z.object({
  insurer: z.string(), // 保険会社等の名称
  policyType: z.string(), // 保険等の種類（終身、学資、医療など）
  period: z.string(), // 保険期間又は年金支払期間
  contractor: z.string(), // 保険等の契約者の氏名
  beneficiary: z.string(), // 保険金等の受取人 氏名
  beneficiaryRelation: z.string().default(""), // 受取人の続柄（ハガキに無ければ空）
  category: z.enum(["一般", "介護医療", "個人年金"]),
  system: z.enum(["新", "旧"]),
  amount: z.number().int().nonnegative(), // 申告に使う金額（円）
  amountBasis: z.string().default(""), // 採用した金額（12月末見込額など）
  confidence: Confidence,
  note: z.string().default(""),
});

export const EarthquakeItem = z.object({
  insurer: z.string(),
  policyType: z.string(), // 保険等の種類（目的）
  period: z.string(),
  contractor: z.string(),
  resident: z.string().default(""), // 家屋等に居住・家財を利用している者
  residentRelation: z.string().default(""),
  category: z.enum(["地震", "旧長期損害"]),
  amount: z.number().int().nonnegative(),
  confidence: Confidence,
  note: z.string().default(""),
});

export const SocialItem = z.object({
  kind: z.string(), // 社会保険の種類（国民年金保険料など）
  payee: z.string(), // 保険料支払先の名称
  burdenPerson: z.string().default(""), // 保険料を負担することになっている人
  burdenRelation: z.string().default(""),
  amount: z.number().int().nonnegative(),
  confidence: Confidence,
  note: z.string().default(""),
});

export const SMALL_BIZ_KINDS = [
  "独立行政法人中小企業基盤整備機構の共済契約の掛金",
  "確定拠出年金法に規定する企業型年金加入者掛金",
  "確定拠出年金法に規定する個人型年金加入者掛金",
  "心身障害者扶養共済制度に関する契約の掛金",
] as const;

export const SmallBizItem = z.object({
  kind: z.enum(SMALL_BIZ_KINDS),
  amount: z.number().int().nonnegative(),
  confidence: Confidence,
  note: z.string().default(""),
});

export const ExcludedItem = z.object({
  description: z.string(),
  reason: z.string(),
});

export const ReadResult = z.object({
  life: z.array(LifeItem).default([]),
  earthquake: z.array(EarthquakeItem).default([]),
  social: z.array(SocialItem).default([]),
  smallBiz: z.array(SmallBizItem).default([]),
  excluded: z.array(ExcludedItem).default([]),
});

export type ReadResult = z.infer<typeof ReadResult>;
export type LifeItem = z.infer<typeof LifeItem>;
export type EarthquakeItem = z.infer<typeof EarthquakeItem>;

// 貼り付けられた文字から JSON 部分を取り出して検証する。
export function parsePasted(text: string):
  | { ok: true; data: ReadResult }
  | { ok: false; error: string } {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  let body = fenced ? fenced[1] : text;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end <= start) {
    return { ok: false, error: "貼り付けた文字の中に読み取り結果（{ から } まで）が見つかりません。" };
  }
  body = body.slice(start, end + 1);
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    return { ok: false, error: "読み取り結果の形式が崩れています。チャットの回答を最初から最後までコピーしてください。" };
  }
  if (json && typeof json === "object" && "error" in json && typeof json.error === "string" && json.error) {
    return { ok: false, error: `読み取れませんでした：${json.error}` };
  }
  const parsed = ReadResult.safeParse(json);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { ok: false, error: `項目「${first.path.join(".")}」の内容が想定と違います（${first.message}）。` };
  }
  return { ok: true, data: parsed.data };
}

// 何回かに分けて読み取った結果を1つにまとめる。
export function mergeResults(a: ReadResult, b: ReadResult): ReadResult {
  return {
    life: [...a.life, ...b.life],
    earthquake: [...a.earthquake, ...b.earthquake],
    social: [...a.social, ...b.social],
    smallBiz: [...a.smallBiz, ...b.smallBiz],
    excluded: [...a.excluded, ...b.excluded],
  };
}
