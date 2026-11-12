// 架空のハガキ（tests/cards）を Claude Code で読み取り、期待どおりに分類・金額が出るかを確かめる。
// 使い方: node local/check-reading.mjs   （Claude Code にログイン済みの PC で実行。プランの利用枠を少し使います）
// 依頼文（src/lib/prompt.mjs）を変えたときや、年が変わったときの確認用。

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildFilePrompt } from "../src/lib/prompt.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CARDS = path.join(ROOT, "tests", "cards");
const expected = JSON.parse(fs.readFileSync(path.join(CARDS, "expected.json"), "utf8"));
const bin = process.env.CLAUDE_BIN || "claude";

const num = (v) => (v === null || v === undefined || v === "" ? null : Number(String(v).replace(/[,円%％]/g, "")));
const norm = (r) => {
  const out = {};
  if (r.life?.length) out.life = r.life.map((i) => [i.category, i.system, i.amount]);
  if (r.earthquake?.length) out.earthquake = r.earthquake.map((i) => [i.category, i.amount]);
  if (r.social?.length) out.social = r.social.map((i) => i.amount);
  if (r.smallBiz?.length) out.smallBiz = r.smallBiz.map((i) => i.amount);
  if (r.housing?.length) out.housing = r.housing.map((i) => [i.docKind, num(i.yearEndBalance), num(i.ratePercent), num(i.limit)]);
  if (r.otherDocs?.length) out.otherDocs = r.otherDocs.map((i) => i.docType);
  for (const k of Object.keys(out)) out[k] = out[k].map((x) => JSON.stringify(x)).sort();
  return out;
};

let failed = 0;
for (const [name, want] of Object.entries(expected)) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nencho-check-"));
  try {
    fs.copyFileSync(path.join(CARDS, `${name}.jpg`), path.join(dir, "photo1.jpg"));
    const r = spawnSync(bin, ["-p", "--output-format", "text", "--model", process.env.CLAUDE_MODEL || "sonnet", "--tools", "Read", "--no-session-persistence", "--strict-mcp-config"], {
      cwd: dir,
      input: buildFilePrompt(["photo1.jpg"]),
      encoding: "utf8",
      shell: process.platform === "win32",
      timeout: 4 * 60 * 1000,
    });
    const m = /\{[\s\S]*\}/.exec(r.stdout || "");
    const got = m ? norm(JSON.parse(m[0])) : null;
    // expected.json は [区分, 新旧, 金額] などの配列で書いてある
    const wantN = Object.fromEntries(Object.entries(want).filter(([k]) => k !== "excluded_or_other").map(([k, v]) => [k, v.map((x) => JSON.stringify(x)).sort()]));
    // 自動車保険など：控除の項目には入らず、「書かないもの」（excluded）か otherDocs に入ること
    const raw = m ? JSON.parse(m[0]) : {};
    const noDeduction = got && !got.life && !got.earthquake && !got.social && !got.smallBiz && !got.housing;
    const ok = want.excluded_or_other
      ? noDeduction && ((raw.excluded?.length ?? 0) > 0 || (raw.otherDocs?.length ?? 0) > 0)
      : got && JSON.stringify(got) === JSON.stringify(wantN);
    if (!ok) failed++;
    console.log(`${ok ? "OK" : "NG"}  ${name}${ok ? "" : `\n    期待: ${JSON.stringify(wantN)}\n    結果: ${JSON.stringify(got)} ${r.stderr ? r.stderr.slice(0, 200) : ""}`}`);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
console.log(failed ? `${failed} 件が期待と違いました。` : "すべて期待どおりです。");
process.exit(failed ? 1 : 0);
