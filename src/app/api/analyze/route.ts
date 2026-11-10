import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { claude, MODEL } from "@/lib/claude";
import { CertificateSchema } from "@/lib/schema";

// 個人情報の扱い:
// - 受け取った画像はメモリ上でだけ扱い、ファイル・DB・ログに一切書き出さない。
// - 応答を返した時点で変数は破棄される（参照が残らないようにする）。
// - 画像の中身や読み取り結果を console.log しない。
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
type AllowedType = (typeof ALLOWED)[number];

export async function POST(req: Request) {
  const form = await req.formData();
  const file = form.get("image");
  if (!(file instanceof File) || !ALLOWED.includes(file.type as AllowedType)) {
    return Response.json({ error: "画像ファイル（JPEG/PNG/WebP）を送ってください" }, { status: 400 });
  }

  try {
    const data = Buffer.from(await file.arrayBuffer()).toString("base64");
    const response = await claude.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: "high", format: zodOutputFormat(CertificateSchema) },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: file.type as AllowedType, data } },
            {
              type: "text",
              text: "これは年末調整用の保険料控除証明書（ハガキ）の写真です。記載されている控除証明の内容をすべて読み取ってください。読めない箇所は推測せず confidence を「低」にしてください。",
            },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      return Response.json({ error: "読み取りを完了できませんでした" }, { status: 422 });
    }
    return Response.json(response.parsed_output);
  } catch (error) {
    if (error instanceof Anthropic.AuthenticationError) {
      return Response.json({ error: "APIキーが正しく設定されていません" }, { status: 500 });
    }
    if (error instanceof Anthropic.RateLimitError) {
      return Response.json({ error: "混み合っています。少し待ってから再送してください" }, { status: 429 });
    }
    if (error instanceof Anthropic.APIError) {
      return Response.json({ error: `読み取りに失敗しました（${error.status}）` }, { status: 502 });
    }
    throw error;
  }
}
