import { fitRows } from "./formOps";
import type { ReadResult } from "./schema";

// 勤務先に出すハガキ・書類の一覧（「出す前のチェック」に表示する）。
// 申告書に書く分だけを出す。上限に達して書かないハガキや、控除の対象外の書類は出さなくてよい。

export type SubmitList = { submit: string[]; notNeeded: { label: string; reason: string }[] };

const yen = (n: number) => `${n.toLocaleString("ja-JP")}円`;

export function submitList(data: ReadResult, under23: boolean): SubmitList {
  const fit = fitRows(data, under23).data;
  const submit: string[] = [];
  const notNeeded: SubmitList["notNeeded"] = [];

  for (const i of data.life) {
    const label = `生命保険：${i.insurer || "会社名なし"} ${i.policyType}（${i.category}・${i.system}契約、${yen(i.amount)}）`;
    if (fit.life.includes(i)) submit.push(label);
    else notNeeded.push({ label, reason: "控除額が上限に達しているため、申告書に書きません。" });
  }
  for (const i of data.earthquake) {
    const label = `地震保険：${i.insurer || "会社名なし"} ${i.policyType}（${yen(i.amount)}）`;
    if (fit.earthquake.includes(i)) submit.push(label);
    else notNeeded.push({ label, reason: "控除額が上限に達しているため、申告書に書きません。" });
  }
  for (const i of data.social) {
    const label = `社会保険：${i.kind}（${yen(i.amount)}）`;
    // 証明書が必要なのは国民年金保険料と国民年金基金の掛金。国民健康保険料などは証明書の添付は不要
    if (/国民年金/.test(i.kind)) submit.push(label);
    else notNeeded.push({ label, reason: "申告書には書きますが、証明書を付ける必要はありません（勤務先から求められたときだけ出します）。" });
  }
  for (const i of data.smallBiz) submit.push(`iDeCo など：${i.kind}（${yen(i.amount)}）`);
  if (data.housing.some((h) => h.docKind === "控除申告書")) submit.push("住宅借入金等特別控除申告書（税務署から届いたもの。記入して出す）");
  if (data.housing.some((h) => h.docKind === "残高証明書")) submit.push("住宅ローンの年末残高等証明書（銀行などから届いたもの）");
  for (const d of data.otherDocs) {
    if (d.docType === "源泉徴収票") submit.push(`前の勤務先の源泉徴収票（今年転職した場合だけ）${d.summary ? `：${d.summary}` : ""}`);
    else notNeeded.push({ label: `${d.docType}${d.summary ? `（${d.summary}）` : ""}`, reason: "年末調整では使いません。" });
  }
  for (const e of data.excluded) notNeeded.push({ label: e.description, reason: e.reason || "控除の対象ではありません。" });
  return { submit, notNeeded };
}
