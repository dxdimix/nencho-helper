import type { ReadResult } from "./schema";

// アンケートで聞く「あてはまるもの」と、それぞれに必要な書類。

export type DocId = "life" | "earthquake" | "pension" | "health" | "smallbiz" | "housing" | "housingFirst" | "previousJob";

export const DOC_OPTIONS: { id: DocId; label: string; hint: string }[] = [
  { id: "life", label: "生命保険・医療保険・がん保険・学資保険・個人年金保険に入っている", hint: "共済（県民共済など）も含みます。給料から天引きの団体保険も、ハガキが届いていれば対象です。" },
  { id: "earthquake", label: "地震保険に入っている", hint: "火災保険と一緒に入っていることが多いです。火災保険だけの場合は対象外です。" },
  { id: "pension", label: "自分や家族の国民年金・国民年金基金の保険料を、自分で払った", hint: "会社員の給料から天引きされる厚生年金は対象外です（書く必要はありません）。学生の子や、会社を辞めた配偶者の分などが対象です。" },
  { id: "health", label: "家族の国民健康保険・介護保険・後期高齢者医療の保険料を、自分で払った", hint: "給料から天引きされている健康保険は書きません。" },
  { id: "smallbiz", label: "iDeCo（個人型確定拠出年金）や小規模企業共済に入っている", hint: "給料から天引きで払っている場合は、勤務先に確認してください。" },
  { id: "housing", label: "住宅ローンがあり、住み始めて2年目以降", hint: "1年目の人は、下の「住宅ローン（今年住み始めた）」を選んでください。" },
  { id: "housingFirst", label: "住宅ローンがあり、今年住み始めた（1年目）", hint: "1年目は年末調整では受けられず、確定申告が必要です。" },
  { id: "previousJob", label: "今年、別の会社から転職した", hint: "前の会社の源泉徴収票を、今の会社に出す必要があります。" },
];

export type RequiredDoc = {
  id: DocId;
  /** 書類の名前 */
  title: string;
  /** どこから届くか・どれを撮るか */
  how: string;
  /** 撮影が必要か（必要なければ案内だけ） */
  photo: boolean;
};

const REQUIRED: Record<DocId, RequiredDoc> = {
  life: { id: "life", title: "生命保険料控除証明書（保険会社のハガキ）", how: "10月〜11月ごろに保険会社から届きます。保険ごとに1枚ずつ届くので、全部登録してください。", photo: true },
  earthquake: { id: "earthquake", title: "地震保険料控除証明書", how: "損害保険会社から届きます。火災保険の証明書と一緒になっていることがあります。", photo: true },
  pension: { id: "pension", title: "社会保険料（国民年金保険料）控除証明書", how: "日本年金機構から11月ごろに届くハガキです。国民年金基金の場合は、基金から届きます。", photo: true },
  health: {
    id: "health",
    title: "家族の国民健康保険料などの金額",
    how: "証明書は届かないことが多いです。市区町村からの納付通知書や領収書を撮影するか、「手で入力」で1年分の金額を入力してください。",
    photo: true,
  },
  smallbiz: { id: "smallbiz", title: "小規模企業共済等掛金払込証明書", how: "iDeCo は国民年金基金連合会から、小規模企業共済は中小機構から届きます。", photo: true },
  housing: {
    id: "housing",
    title: "住宅借入金等特別控除申告書 と 年末残高等証明書",
    how: "申告書は税務署から（1年目の確定申告のあと、数年分がまとめて）、年末残高等証明書は銀行などから届きます。両方登録してください。",
    photo: true,
  },
  housingFirst: {
    id: "housingFirst",
    title: "住宅ローン控除（1年目）は年末調整ではできません",
    how: "来年の2月〜3月に、自分で確定申告をしてください。2年目からは年末調整で受けられます。登録は不要です。",
    photo: false,
  },
  previousJob: {
    id: "previousJob",
    title: "前の会社の源泉徴収票は、今の会社に渡します",
    how: "申告書に書き写すものではありません。まだ渡していなければ、勤務先の担当者に渡してください。登録は不要です。",
    photo: false,
  },
};

export function requiredDocs(selected: DocId[]): RequiredDoc[] {
  return DOC_OPTIONS.map((o) => o.id)
    .filter((id) => selected.includes(id))
    .map((id) => REQUIRED[id]);
}

/** その種類の書類を何件読み取ったか */
export function readCount(d: ReadResult | null, id: DocId): number {
  if (!d) return 0;
  switch (id) {
    case "life":
      return d.life.length;
    case "earthquake":
      return d.earthquake.length;
    case "pension":
      return d.social.filter((i) => /年金/.test(i.kind)).length;
    case "health":
      return d.social.filter((i) => /健康保険|介護|後期高齢/.test(i.kind)).length;
    case "smallbiz":
      return d.smallBiz.length;
    case "housing":
      return d.housing.length;
    default:
      return 0;
  }
}
