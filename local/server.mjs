// 自宅PCで動かすサーバー。
// - out/ に書き出したアプリ画面を、同じ Wi-Fi のスマホに配信する。
// - スマホから届いた写真を Claude Code（claude -p）に読み取らせ、結果を返す。
//
// 個人情報の扱い:
// - 写真は Claude Code に渡すため一時フォルダに保存し、読み取りが終わったらすぐ削除する。
// - Claude Code は会話の記録を残さない設定（--no-session-persistence）で動かす。
// - 写真の中身や読み取り結果はログに出さない。

import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import qrcode from "qrcode-terminal";
import { buildFilePrompt } from "../src/lib/prompt.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "out");
const PORT = Number(process.env.PORT || 5173);
const CLAUDE_BIN = process.env.CLAUDE_BIN || "claude";
const MODEL = process.env.CLAUDE_MODEL || "sonnet";
const TIMEOUT_MS = 4 * 60 * 1000;
const MAX_BODY = 40 * 1024 * 1024;
const MAX_IMAGES = 6;

if (!fs.existsSync(path.join(OUT, "index.html"))) {
  console.error("アプリ画面がありません。先に npm run build を実行してください。");
  process.exit(1);
}

// 同じ Wi-Fi の他の人が使えないように、合言葉（トークン）を URL に付ける。
// ホーム画面に追加した URL が変わらないよう、ファイルに保存して使い回す。
const TOKEN_FILE = path.join(ROOT, ".local-token");
const TOKEN = fs.existsSync(TOKEN_FILE)
  ? fs.readFileSync(TOKEN_FILE, "utf8").trim()
  : (() => {
      const t = randomBytes(12).toString("hex");
      fs.writeFileSync(TOKEN_FILE, t);
      return t;
    })();

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};

const EXT = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" };

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

function serveStatic(req, res) {
  const urlPath = decodeURIComponent(new URL(req.url, "http://x").pathname);
  let file = path.normalize(path.join(OUT, urlPath));
  if (!file.startsWith(OUT)) return sendJson(res, 403, { error: "forbidden" });
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, "index.html");
  if (!fs.existsSync(file) && fs.existsSync(file + ".html")) file += ".html";
  if (!fs.existsSync(file)) return sendJson(res, 404, { error: "not found" });
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error("too large"));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function runClaude(dir, files) {
  return new Promise((resolve, reject) => {
    const args = [
      "-p",
      "--output-format", "text",
      "--model", MODEL,
      "--tools", "Read",
      "--allowedTools", "Read",
      "--no-session-persistence",
      "--strict-mcp-config",
    ];
    const child = spawn(CLAUDE_BIN, args, {
      cwd: dir,
      shell: process.platform === "win32", // Windows では claude.cmd を探すために必要
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"],
    });
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
      reject(
        new Error(
          e.code === "ENOENT"
            ? "このPCで Claude Code（claude コマンド）が見つかりません。"
            : `Claude Code を起動できませんでした（${e.code || e.message}）。`,
        ),
      );
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

let busy = false;

async function handleRead(req, res) {
  if (busy) return sendJson(res, 429, { error: "前の写真を読み取り中です。終わってから送ってください。" });
  busy = true;
  let dir = "";
  const started = Date.now();
  try {
    const body = JSON.parse((await readBody(req)).toString("utf8"));
    const images = Array.isArray(body.images) ? body.images.slice(0, MAX_IMAGES) : [];
    if (images.length === 0) return sendJson(res, 400, { error: "写真が届いていません。" });

    dir = fs.mkdtempSync(path.join(os.tmpdir(), "nencho-"));
    const files = images.map((img, i) => {
      const ext = EXT[img.type];
      if (!ext || typeof img.data !== "string") throw new Error("写真の形式に対応していません。");
      const name = `photo${i + 1}${ext}`;
      fs.writeFileSync(path.join(dir, name), Buffer.from(img.data, "base64"));
      return name;
    });

    console.log(`写真 ${files.length} 枚を読み取っています…`);
    const text = await runClaude(dir, files);
    console.log(`  完了（${Math.round((Date.now() - started) / 1000)} 秒）`);
    sendJson(res, 200, { text });
  } catch (e) {
    sendJson(res, 500, { error: e instanceof Error ? e.message : "読み取りに失敗しました。" });
  } finally {
    if (dir) fs.rmSync(dir, { recursive: true, force: true });
    busy = false;
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, "http://x");
  if (url.pathname.startsWith("/api/")) {
    if (req.headers["x-local-token"] !== TOKEN) return sendJson(res, 401, { error: "URL が正しくありません。PCの画面に出ているアドレスを開き直してください。" });
    if (url.pathname === "/api/health" && req.method === "GET") return sendJson(res, 200, { ok: true });
    if (url.pathname === "/api/read" && req.method === "POST") return void handleRead(req, res);
    return sendJson(res, 404, { error: "not found" });
  }
  serveStatic(req, res);
});

server.listen(PORT, "0.0.0.0", () => {
  const ips = Object.values(os.networkInterfaces())
    .flat()
    .filter((n) => n && n.family === "IPv4" && !n.internal)
    .map((n) => n.address);
  console.log("\n年末調整 記入お手本 を起動しました。");
  console.log("スマホを PC と同じ Wi-Fi につないで、次のアドレスを開いてください。\n");
  for (const ip of ips) console.log(`  http://${ip}:${PORT}/?t=${TOKEN}`);
  if (ips[0]) {
    console.log("\nスマホのカメラでこの QR コードを読み取っても開けます。");
    qrcode.generate(`http://${ips[0]}:${PORT}/?t=${TOKEN}`, { small: true });
  }
  console.log("終了するときは、この画面で Ctrl + C を押してください。\n");
});
