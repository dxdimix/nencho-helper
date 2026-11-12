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
// Claude Code の場所を探す。デスクトップのアイコンから起動すると PATH が古いことがあるため、
// セットアップ時に記録した場所（.claude-path）とよくある場所を順に確認する。
function findClaude() {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;
  const candidates = [];
  const recorded = path.join(ROOT, ".claude-path");
  if (fs.existsSync(recorded)) candidates.push(fs.readFileSync(recorded, "utf8").replace(/^\uFEFF/, "").trim());
  if (process.platform === "win32") {
    const home = process.env.USERPROFILE || os.homedir();
    candidates.push(path.join(home, ".local", "bin", "claude.exe"));
    if (process.env.APPDATA) candidates.push(path.join(process.env.APPDATA, "npm", "claude.cmd"));
  }
  return candidates.find((c) => c && fs.existsSync(c)) || "claude";
}
const CLAUDE_BIN = findClaude();
// 自動更新で記録した版（GitHub のコミット番号の先頭7文字）。画面に表示して、更新できたかを確かめられるようにする。
const VERSION_FILE = path.join(ROOT, ".version");
const VERSION = fs.existsSync(VERSION_FILE) ? fs.readFileSync(VERSION_FILE, "utf8").trim().slice(0, 7) : "";
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
  fs.createReadStream(file).on("error", () => res.end()).pipe(res);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new Error("写真のデータが大きすぎます。枚数を減らして送ってください。"));
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
      // 使えるのはファイルを読む機能だけ。--allowedTools を付けないことで、
      // 読めるのは作業フォルダ（写真だけを入れた一時フォルダ）の中に限られる。
      "--tools", "Read",
      "--no-session-persistence",
      "--strict-mcp-config",
    ];
    // Windows の .cmd や、場所が分からない "claude" はコマンドプロンプト経由で起動する。
    // そのときは空白を含む場所に備えて引用符で囲む。.exe は直接起動する。
    const useShell = process.platform === "win32" && !/\.exe$/i.test(CLAUDE_BIN);
    const command = useShell && CLAUDE_BIN.includes(" ") ? `"${CLAUDE_BIN}"` : CLAUDE_BIN;
    const child = spawn(command, args, {
      cwd: dir,
      shell: useShell,
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
  try {
    route(req, res);
  } catch {
    // 不正なアドレスなどでサーバーが止まらないようにする
    if (!res.headersSent) sendJson(res, 400, { error: "bad request" });
    else res.end();
  }
});

function route(req, res) {
  const url = new URL(req.url, "http://x");
  if (url.pathname.startsWith("/api/")) {
    if (req.headers["x-local-token"] !== TOKEN) return sendJson(res, 401, { error: "URL が正しくありません。PCの画面に出ているアドレスを開き直してください。" });
    if (url.pathname === "/api/health" && req.method === "GET") return sendJson(res, 200, { ok: true, version: VERSION });
    if (url.pathname === "/api/read" && req.method === "POST") return void handleRead(req, res);
    return sendJson(res, 404, { error: "not found" });
  }
  serveStatic(req, res);
}

// Tailscale のアドレス（100.64.0.0〜100.127.255.255）かどうか
function isTailscale(ip) {
  const [a, b] = ip.split(".").map(Number);
  return a === 100 && b >= 64 && b <= 127;
}

server.listen(PORT, "0.0.0.0", () => {
  const ips = Object.values(os.networkInterfaces())
    .flat()
    .filter((n) => n && n.family === "IPv4" && !n.internal)
    .map((n) => n.address);
  const ts = ips.find(isTailscale);
  const lan = ips.filter((ip) => !isTailscale(ip));
  const url = (ip) => `http://${ip}:${PORT}/?t=${TOKEN}`;

  console.log("\n年末調整 記入お手本 を起動しました。");
  console.log(`（Claude Code: ${CLAUDE_BIN === "claude" ? "claude コマンドを PATH から探します" : CLAUDE_BIN}）\n`);
  if (ts) {
    console.log("■ 家でも外出先でも使えるアドレス（スマホの Tailscale をオンにして開く）");
    console.log(`  ${url(ts)}`);
    console.log("\n■ 家の Wi-Fi だけで使えるアドレス（Tailscale がオフのとき）");
    for (const ip of lan) console.log(`  ${url(ip)}`);
    console.log("\nスマホのカメラでこの QR コードを読み取ると、家でも外出先でも使えるアドレスが開きます。");
    qrcode.generate(url(ts), { small: true });
  } else {
    console.log("スマホを PC と同じ Wi-Fi につないで、次のアドレスを開いてください。");
    for (const ip of lan) console.log(`  ${url(ip)}`);
    console.log("（外出先でも使うには、PC とスマホに Tailscale を入れてログインしてください）");
    if (lan[0]) {
      console.log("\nスマホのカメラでこの QR コードを読み取っても開けます。");
      qrcode.generate(url(lan[0]), { small: true });
    }
  }
  console.log(`■ この PC のブラウザで使うアドレス\n  http://localhost:${PORT}/?t=${TOKEN}\n`);
  console.log("このアプリを使う間は、PC の電源を入れたまま（スリープしない状態）にしてください。");
  console.log("終了するときは、この画面で Ctrl + C を押してください。\n");
});
