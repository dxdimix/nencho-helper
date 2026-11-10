import { z } from "zod";

// ハガキ（控除証明書）から読み取る項目。開発を進めながら項目を増やす。
export const CertificateSchema = z.object({
  certificates: z.array(
    z.object({
      insurer: z.string().describe("保険会社名"),
      category: z
        .enum([
          "一般生命保険",
          "介護医療保険",
          "個人年金保険",
          "地震保険",
          "旧長期損害保険",
          "社会保険",
          "小規模企業共済等掛金",
          "不明",
        ])
        .describe("控除の区分"),
      system: z.enum(["新", "旧", "該当なし"]).describe("新制度か旧制度か"),
      policyType: z.string().describe("保険の種類（終身保険、学資保険など）"),
      contractor: z.string().describe("契約者"),
      insured: z.string().describe("被保険者"),
      beneficiary: z.string().describe("受取人"),
      amount: z.number().describe("申告に使う金額（円）。12月末見込額があればそちらを使う"),
      amountBasis: z.string().describe("どの金額を採用したか（証明額／12月末見込額など）"),
      confidence: z.enum(["高", "中", "低"]).describe("読み取りの確からしさ"),
    }),
  ),
});
export type CertificateResult = z.infer<typeof CertificateSchema>;
