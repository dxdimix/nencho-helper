import { z } from "zod";

// AIが返す読み取り結果（JSON）の形。依頼文（prompt.mjs）と必ずそろえる。
// AIの書き方の小さな揺れ（null、"36,000円" のような文字の金額など）は受け入れて直す。

/** null や数字を文字列にそろえる */
const Text = z.preprocess((v) => (v == null ? "" : typeof v === "string" ? v.trim() : String(v)), z.string());

/** "36,000円" や 36000.0 を円単位の整数にする。読めない値は null（後で区分不明として扱う） */
const Yen = z.preprocess((v) => {
  if (typeof v === "number") return Math.round(v);
  if (typeof v === "string") {
    const n = Number(v.replace(/[,，円¥￥\s]/g, ""));
    return v.trim() !== "" && Number.isFinite(n) ? Math.round(n) : null;
  }
  return null;
}, z.number().int().nonnegative());

/** 確からしさ。想定外の値は「低」として扱う */
const Confidence = z.preprocess((v) => (v === "高" || v === "中" || v === "低" ? v : "低"), z.enum(["高", "中", "低"]));

export const LifeItem = z.object({
  insurer: Text, // 保険会社等の名称
  policyType: Text, // 保険等の種類（終身、学資、医療など）
  period: Text, // 保険期間又は年金支払期間
  contractor: Text, // 保険等の契約者の氏名
  beneficiary: Text, // 保険金等の受取人 氏名
  beneficiaryRelation: Text, // 受取人の続柄（ハガキに無ければ空）
  category: z.enum(["一般", "介護医療", "個人年金"]),
  system: z.enum(["新", "旧"]),
  amount: Yen, // 申告に使う金額（円）
  amountBasis: Text, // 採用した金額（12月末見込額など）
  confidence: Confidence,
  note: Text,
});

export const EarthquakeItem = z.object({
  insurer: Text,
  policyType: Text, // 保険等の種類（目的）
  period: Text,
  contractor: Text,
  resident: Text, // 家屋等に居住・家財を利用している者
  residentRelation: Text,
  category: z.enum(["地震", "旧長期損害"]),
  amount: Yen,
  confidence: Confidence,
  note: Text,
});

export const SocialItem = z.object({
  kind: Text, // 社会保険の種類（国民年金保険料など）
  payee: Text, // 保険料支払先の名称
  burdenPerson: Text, // 保険料を負担することになっている人
  burdenRelation: Text,
  amount: Yen,
  confidence: Confidence,
  note: Text,
});

export const SMALL_BIZ_KINDS = [
  "独立行政法人中小企業基盤整備機構の共済契約の掛金",
  "確定拠出年金法に規定する企業型年金加入者掛金",
  "確定拠出年金法に規定する個人型年金加入者掛金",
  "心身障害者扶養共済制度に関する契約の掛金",
] as const;

export const SmallBizItem = z.object({
  kind: z.enum(SMALL_BIZ_KINDS),
  amount: Yen,
  confidence: Confidence,
  note: Text,
});

export const ExcludedItem = z.object({
  description: Text,
  reason: Text,
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
  const parsed = ReadResult.safeParse(rescueInvalidItems(json));
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

const SECTIONS = { life: LifeItem, earthquake: EarthquakeItem, social: SocialItem, smallBiz: SmallBizItem } as const;

// 区分や金額が読めなかった1件のために、全体を読み込めなくなるのを防ぐ。
// 形が合わない項目は「申告書に書かないもの」に移し、手で確認するよう案内する。
function rescueInvalidItems(json: unknown): unknown {
  if (!json || typeof json !== "object") return json;
  const src = json as Record<string, unknown>;
  const out: Record<string, unknown> = { ...src };
  const excluded: unknown[] = Array.isArray(src.excluded) ? [...src.excluded] : [];
  for (const [key, schema] of Object.entries(SECTIONS)) {
    const items = src[key];
    if (!Array.isArray(items)) continue;
    out[key] = items.filter((item) => {
      if (schema.safeParse(item).success) return true;
      const o = (item ?? {}) as Record<string, unknown>;
      const name = [o.insurer, o.policyType, o.kind, o.payee].filter(Boolean).join(" ") || "名前を読み取れなかった項目";
      excluded.push({
        description: `${name}（金額: ${o.amount ?? "不明"}）`,
        reason: "区分や金額を判断できませんでした。ハガキを見て、該当する欄に手で記入してください。",
      });
      return false;
    });
  }
  out.excluded = excluded;
  return out;
}
