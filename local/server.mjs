// 自宅PCで動かすサーバー。
// - out/ に書き出したアプリ画面を、同じ Wi-Fi（または Tailscale）のスマホに配信する。
// - スマホから届いた写真を Claude Code（claude -p）に読み取らせ、結果を返す（読み取りは reader.mjs）。
// - .env.local に Supabase の設定があれば、外出先の画面（GitHub Pages 版）からの写真も読み取る（cloud.mjs）。
//
// 個人情報の扱いは reader.mjs と cloud.mjs の説明を参照。写真の中身や読み取り結果はログに出さない。

import { randomBytes } from "node:crypto";
import fs from "node:fs";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import qrcode from "qrcode-terminal";
import { createAdmin } from "./admin.mjs";
import { startCloud } from "./cloud.mjs";
import { createReader, findClaude, MAX_IMAGES } from "./reader.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const OUT = path.join(ROOT, "out");
const PORT = Number(process.env.PORT || 5173);
// .env.local（Supabase の設定など）を読み込む。すでに環境変数にあるものは上書きしない。
const ENV_FILE = path.join(ROOT, ".env.local");
if (fs.existsSync(ENV_FILE)) {
  for (const line of fs.readFileSync(ENV_FILE, "utf8").replace(/^\uFEFF/, "").split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (m && !line.trim().startsWith("#") && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
}
const CLAUDE_BIN = findClaude(ROOT);
// 自動更新で記録した版（GitHub のコミット番号の先頭7文字）。画面に表示して、更新できたかを確かめられるようにする。
const VERSION_FILE = path.join(ROOT, ".version");
const VERSION = fs.existsSync(VERSION_FILE) ? fs.readFileSync(VERSION_FILE, "utf8").trim().slice(0, 7) : "";
const MODEL = process.env.CLAUDE_MODEL || "sonnet";
const MAX_BODY = 40 * 1024 * 1024;

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
  ".webmanifest": "application/manifest+json",
};


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

const reader = createReader({ bin: CLAUDE_BIN, model: MODEL });
// 招待の管理（Supabase の設定があるときだけ）
const admin = createAdmin({ url: process.env.SUPABASE_URL, secretKey: process.env.SUPABASE_SECRET_KEY, appUrl: process.env.NENCHO_APP_URL });

async function handleAdmin(req, res, pathname) {
  if (!admin) return sendJson(res, 400, { error: "Supabase の設定がないため、招待は使えません。" });
  try {
    if (pathname === "/api/admin/members" && req.method === "GET") return sendJson(res, 200, { members: await admin.members() });
    const body = req.method === "POST" ? JSON.parse((await readBody(req)).toString("utf8") || "{}") : {};
    if (pathname === "/api/admin/invite" && req.method === "POST") return sendJson(res, 200, await admin.invite(body.email));
    if (pathname === "/api/admin/remove" && req.method === "POST") {
      await admin.remove(String(body.userId ?? ""));
      return sendJson(res, 200, { ok: true });
    }
    return sendJson(res, 404, { error: "not found" });
  } catch (e) {
    sendJson(res, 400, { error: e instanceof Error ? e.message : "処理できませんでした。" });
  }
}

async function handleRead(req, res) {
  if (reader.busy) return sendJson(res, 429, { error: "前の写真を読み取り中です。終わってから送ってください。" });
  try {
    const body = JSON.parse((await readBody(req)).toString("utf8"));
    const images = Array.isArray(body.images) ? body.images.slice(0, MAX_IMAGES) : [];
    const text = await reader.read(images);
    sendJson(res, 200, { text });
  } catch (e) {
    sendJson(res, e instanceof Error && e.message === "写真が届いていません。" ? 400 : 500, { error: e instanceof Error ? e.message : "読み取りに失敗しました。" });
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
    if (url.pathname === "/api/health" && req.method === "GET") return sendJson(res, 200, { ok: true, version: VERSION, admin: !!admin });
    if (url.pathname.startsWith("/api/admin/")) return void handleAdmin(req, res, url.pathname);
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

  console.log("\nサクッとねんちょー を起動しました。");
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
  const stopCloud = startCloud({ url: process.env.SUPABASE_URL, secretKey: process.env.SUPABASE_SECRET_KEY, reader });
  if (!stopCloud) console.log("（Supabase の設定がないため、外出先の画面からの写真の読み取りはオフです）");
  console.log("このアプリを使う間は、PC の電源を入れたまま（スリープしない状態）にしてください。");
  console.log("終了するときは、この画面で Ctrl + C を押してください。\n");
});
