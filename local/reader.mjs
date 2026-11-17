// 写真を Claude Code（claude -p）で読み取る部分。自宅ネットワーク経由（server.mjs）と
// Supabase 経由（cloud.mjs）の両方から使う。
//
// 個人情報の扱い:
// - 写真は Claude Code に渡すため一時フォルダに保存し、読み取りが終わったらすぐ削除する。
// - Claude Code は会話の記録を残さない設定（--no-session-persistence）で動かし、
//   使えるのはファイルを読む機能だけ（--tools Read）。--allowedTools を付けないので、読めるのは一時フォルダの中だけ。
// - 写真の中身や読み取り結果はログに出さない。

import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { buildFilePrompt } from "../src/lib/prompt.mjs";

export const MAX_IMAGES = 6;
const TIMEOUT_MS = 4 * 60 * 1000;
const EXT = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };

/**
 * Claude Code の場所を探す。デスクトップのアイコンから起動すると PATH が古いことがあるため、
 * セットアップ時に記録した場所（.claude-path）とよくある場所を順に確認する。
 */
export function findClaude(root) {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;
  const candidates = [];
  const recorded = path.join(root, ".claude-path");
  if (fs.existsSync(recorded)) candidates.push(fs.readFileSync(recorded, "utf8").replace(/^﻿/, "").trim());
  if (process.platform === "win32") {
    const home = process.env.USERPROFILE || os.homedir();
    candidates.push(path.join(home, ".local", "bin", "claude.exe"));
    if (process.env.APPDATA) candidates.push(path.join(process.env.APPDATA, "npm", "claude.cmd"));
  }
  return candidates.find((c) => c && fs.existsSync(c)) || "claude";
}

function runClaude(bin, model, dir, files) {
  return new Promise((resolve, reject) => {
    const args = [
      "-p",
      "--output-format", "text",
      "--model", model,
      "--tools", "Read",
      "--no-session-persistence",
      "--strict-mcp-config",
    ];
    // Windows の .cmd や、場所が分からない "claude" はコマンドプロンプト経由で起動する。
    // そのときは空白を含む場所に備えて引用符で囲む。.exe は直接起動する。
    const useShell = process.platform === "win32" && !/\.exe$/i.test(bin);
    const command = useShell && bin.includes(" ") ? `"${bin}"` : bin;
    const child = spawn(command, args, { cwd: dir, shell: useShell, windowsHide: true, stdio: ["pipe", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error("時間内に読み取りが終わりませんでした。もう一度試してください。"));
    }, TIMEOUT_MS);
    child.stdout.on("data", (d) => (stdout += d));
    child.stderr.on("data", (d) => (stderr += d));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(new Error(e.code === "ENOENT" ? "このPCで Claude Code（claude コマンド）が見つかりません。" : `Claude Code を起動できませんでした（${e.code || e.message}）。`));
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) return resolve(stdout);
      // 標準エラーにはログイン切れなどの理由が出る。写真の内容は含まれない。
      console.error(`  Claude Code がエラーで終了しました（終了コード ${code}）: ${stderr.trim().slice(0, 300)}`);
      reject(new Error("Claude Code がエラーで終了しました。PCの画面に表示された理由を確認してください。"));
    });
    child.stdin.end(buildFilePrompt(files));
  });
}

/**
 * 写真を読み取る。同時に2つは動かさない（1つずつ順番に処理する）。
 * @param {{ bin: string, model: string }} opts
 */
export function createReader({ bin, model }) {
  let chain = Promise.resolve();
  let busy = 0;
  /**
   * @param {{ type: string, data: string }[]} images base64 の写真
   * @returns {Promise<string>} Claude Code の回答（JSON を含む文字列）
   */
  function read(images) {
    busy++;
    const job = chain.then(async () => {
      const list = Array.isArray(images) ? images.slice(0, MAX_IMAGES) : [];
      if (list.length === 0) throw new Error("写真が届いていません。");
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), "nencho-"));
      try {
        const files = list.map((img, i) => {
          const ext = EXT[img?.type];
          if (!ext || typeof img.data !== "string") throw new Error("写真の形式に対応していません。");
          const name = `photo${i + 1}${ext}`;
          fs.writeFileSync(path.join(dir, name), Buffer.from(img.data, "base64"));
          return name;
        });
        const started = Date.now();
        console.log(`写真 ${files.length} 枚を読み取っています…`);
        const text = await runClaude(bin, model, dir, files);
        console.log(`  完了（${Math.round((Date.now() - started) / 1000)} 秒）`);
        return text;
      } finally {
        fs.rmSync(dir, { recursive: true, force: true });
      }
    });
    chain = job.catch(() => {}).finally(() => busy--);
    return job;
  }
  return { read, get busy() { return busy > 0; } };
}
