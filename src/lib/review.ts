import type { OtherDoc, ReadResult } from "./schema";

// お手本を出す前の「確認ステップ」で使う問いかけを作る。
// 初めて年末調整をする人を想定し、分かりやすい言葉で書く。

/** 控除証明書ではない書類が届いたときの案内 */
export const OTHER_DOC_ADVICE: Record<OtherDoc["docType"], string> = {
  源泉徴収票:
    "今年、前の勤務先を辞めて今の勤務先に入った人は、前の勤務先の源泉徴収票を今の勤務先に出す必要があります。申告書に書き写すものではありません。勤務先の担当者に渡してください。",
  "医療費の領収書・通知":
    "医療費控除は、年末調整では受けられません。受けたい場合は、来年の2月〜3月に自分で確定申告をします。領収書は捨てずに保管してください。",
  "ふるさと納税・寄附金の受領証明書":
    "ふるさと納税などの寄附金は、年末調整では申告できません。ワンストップ特例の申請をしていない場合は、来年の2月〜3月に確定申告をします。",
  "株・投資信託などの書類": "株や投資信託の書類は、年末調整では使いません。必要な場合は、確定申告で使います。",
  "保険の満期・解約・契約内容の通知":
    "保険のお知らせ（満期・解約・契約内容）は、控除証明書ではありません。同じ保険会社から「生命保険料控除証明書」というハガキが別に届いていないか確認してください。",
  年金の通知: "年金の通知は、年末調整の保険料控除には使いません。家族の年金収入は「家族と収入」タブの「給与以外の所得」の参考にしてください。",
  "自動車保険・火災保険などの案内": "自動車保険や、地震保険が付いていない火災保険は、控除の対象外です。申告書には書きません。",
  その他: "年末調整で使う書類ではないようです。分からない場合は、勤務先の担当者に確認してください。",
};

export type ChecklistItem = {
  id: string;
  /** 問いかけ */
  question: string;
  /** 補足（どんなときに届くか） */
  hint: string;
  /** すでに読み取ったか */
  done: boolean;
};

/** 撮り忘れ・読み取り忘れがないかの問いかけ */
export function buildChecklist(d: ReadResult): ChecklistItem[] {
  const has = (pred: boolean) => pred;
  return [
    {
      id: "life",
      question: "生命保険・医療保険・がん保険・学資保険・個人年金保険のハガキ",
      hint: "10月〜11月ごろに保険会社から届きます。保険ごとに1枚ずつ届くことが多いので、加入している保険の数だけあるか数えてください。共済（県民共済など）も対象です。",
      done: has(d.life.length > 0),
    },
    {
      id: "earthquake",
      question: "地震保険のハガキ",
      hint: "火災保険と一緒に入っていることが多い保険です。持ち家でも賃貸でも、地震保険に入っていれば届きます。",
      done: has(d.earthquake.length > 0),
    },
    {
      id: "pension",
      question: "国民年金・国民年金基金のハガキ（自分や家族の分）",
      hint: "会社員は給料から天引きされているので通常は届きません。学生の子や、会社を辞めた配偶者の国民年金をあなたが払った場合は、日本年金機構から届くハガキで申告できます。",
      done: has(d.social.some((i) => /年金/.test(i.kind))),
    },
    {
      id: "health",
      question: "家族の分の国民健康保険・介護保険・後期高齢者医療の保険料",
      hint: "あなたが家族の分を払っている場合に申告できます。証明書は届かないことが多いので、領収書や通帳で1年分の金額を確認してください。給料から天引きされている分は書きません。",
      done: has(d.social.some((i) => /健康保険|介護|後期高齢/.test(i.kind))),
    },
    {
      id: "smallbiz",
      question: "iDeCo（個人型確定拠出年金）・小規模企業共済の証明書",
      hint: "国民年金基金連合会などから届きます。給料から天引きで払っている場合は、勤務先が把握しているので書かなくてよいこともあります。",
      done: has(d.smallBiz.length > 0),
    },
    {
      id: "housing",
      question: "住宅ローンの書類（2年目以降の人）",
      hint: "税務署から届く「住宅借入金等特別控除申告書」と、銀行から届く「年末残高等証明書」の2つが必要です（最近の借入れでは、銀行の証明書が不要な場合もあります）。",
      done: has(d.housing.length > 0),
    },
    {
      id: "previousJob",
      question: "前の勤務先の源泉徴収票（今年転職した人）",
      hint: "今年、別の会社から転職した人は、前の会社からもらった源泉徴収票を今の会社に出します。",
      done: has(d.otherDocs.some((o) => o.docType === "源泉徴収票")),
    },
  ];
}

export type Blank = {
  section: "life" | "earthquake" | "social";
  index: number;
  field: string;
  label: string;
  /** どの項目か（保険会社名など） */
  owner: string;
};

const LIFE_FIELDS: [string, string][] = [
  ["insurer", "保険会社等の名称"],
  ["policyType", "保険の種類"],
  ["contractor", "契約者の氏名"],
  ["beneficiary", "保険金の受取人の氏名"],
  ["beneficiaryRelation", "受取人とあなたとの続柄（例：本人、妻、子）"],
];
const QUAKE_FIELDS: [string, string][] = [
  ["insurer", "保険会社等の名称"],
  ["contractor", "契約者の氏名"],
  ["resident", "その家に住んでいる人（家財を使っている人）の氏名"],
  ["residentRelation", "その人とあなたとの続柄（例：本人、妻）"],
];
const SOCIAL_FIELDS: [string, string][] = [
  ["kind", "社会保険の種類（例：国民年金保険料）"],
  ["payee", "保険料の支払先（例：日本年金機構）"],
  ["burdenPerson", "保険料を払うことになっている人の氏名（例：学生の子の名前）"],
  ["burdenRelation", "その人とあなたとの続柄（例：子）"],
];

/** 申告書に書く必要があるのに空欄の項目 */
export function findBlanks(d: ReadResult): Blank[] {
  const out: Blank[] = [];
  const scan = (section: Blank["section"], items: Record<string, unknown>[], fields: [string, string][], ownerKey: string) =>
    items.forEach((item, index) => {
      for (const [field, label] of fields) {
        const v = item[field];
        if (typeof v === "string" && v.trim() === "") out.push({ section, index, field, label, owner: String(item[ownerKey] || `${index + 1}件目`) });
      }
    });
  scan("life", d.life, LIFE_FIELDS, "insurer");
  scan("earthquake", d.earthquake, QUAKE_FIELDS, "insurer");
  scan("social", d.social, SOCIAL_FIELDS, "kind");
  return out;
}

/** 空欄に入力された値を反映する */
export function fillBlank(d: ReadResult, b: Blank, value: string): ReadResult {
  const list = [...(d[b.section] as Record<string, unknown>[])];
  list[b.index] = { ...list[b.index], [b.field]: value };
  return { ...d, [b.section]: list } as ReadResult;
}

/** 読み取りに自信がない項目（確からしさが「高」でないもの） */
export function lowConfidence(d: ReadResult) {
  return [
    ...d.life.map((i, index) => ({ section: "life" as const, index, title: `${i.insurer || "（名前なし）"}　${i.policyType}`, amount: i.amount, confidence: i.confidence })),
    ...d.earthquake.map((i, index) => ({ section: "earthquake" as const, index, title: `${i.insurer || "（名前なし）"}　${i.policyType}`, amount: i.amount, confidence: i.confidence })),
    ...d.social.map((i, index) => ({ section: "social" as const, index, title: `${i.kind}　${i.payee}`, amount: i.amount, confidence: i.confidence })),
    ...d.smallBiz.map((i, index) => ({ section: "smallBiz" as const, index, title: i.kind, amount: i.amount, confidence: i.confidence })),
    // 住宅ローンは、年末残高が書かれた書類だけ（申告書は「住宅ローン」タブで値を確認する）
    ...d.housing.flatMap((i, index) =>
      i.yearEndBalance === null ? [] : [{ section: "housing" as const, index, title: `住宅ローン　${i.lender || i.docKind}`, amount: i.yearEndBalance, confidence: i.confidence }],
    ),
  ].filter((x) => x.confidence !== "高");
}

/** 金額を直す */
export function setAmount(d: ReadResult, section: "life" | "earthquake" | "social" | "smallBiz" | "housing", index: number, amount: number): ReadResult {
  const list = [...(d[section] as Record<string, unknown>[])];
  const key = section === "housing" ? "yearEndBalance" : "amount";
  list[index] = { ...list[index], [key]: amount };
  return { ...d, [section]: list } as ReadResult;
}
