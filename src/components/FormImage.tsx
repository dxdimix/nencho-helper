"use client";

import { useEffect, useState } from "react";
import type { Calculation } from "@/lib/calc";
import type { Family } from "@/lib/family";
import { buildBasicOps, buildOps, PAGE_H, PAGE_W, type Op } from "@/lib/formOps";
import type { ReadResult } from "@/lib/schema";

// 国税庁の「令和8年分 給与所得者の保険料控除申告書」の画像に、記入する内容を重ねて描く。
// 書く内容と位置は src/lib/formOps.ts。
// 画像は public/forms/hoken-r8.png（国税庁の様式 PDF を 150dpi で画像にしたもの）。
// 描いた画像は画面の中だけで作り、どこにも送らない。

const INK = "#1d4ed8";
const FONT = '"Hiragino Sans","Noto Sans JP","Yu Gothic","Meiryo",sans-serif';

function draw(img: HTMLImageElement, ops: Op[]): string {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const sx = canvas.width / PAGE_W;
  const sy = canvas.height / PAGE_H;
  ctx.fillStyle = INK;
  ctx.strokeStyle = INK;
  ctx.textBaseline = "alphabetic";
  for (const op of ops) {
    if (op.t === "circle") {
      ctx.lineWidth = 1.2 * sx;
      ctx.beginPath();
      ctx.ellipse(op.x * sx, op.y * sy, op.r * sx, op.r * sy, 0, 0, Math.PI * 2);
      ctx.stroke();
      continue;
    }
    if (!op.s) continue;
    ctx.textAlign = op.align ?? "left";
    // 欄の幅に収まるまで文字を小さくする。小さくしすぎると読めないので、
    // 1行で収まらない長い文字は2行に分けて書く（数字は分けない）。
    const fit = (text: string, min: number) => {
      let size = op.size ?? 6.5;
      ctx.font = `${size * sy}px ${FONT}`;
      while (ctx.measureText(text).width > op.w * sx && size > min) {
        size -= 0.25;
        ctx.font = `${size * sy}px ${FONT}`;
      }
      return size;
    };
    const size = fit(op.s, 4.8);
    if (ctx.measureText(op.s).width > op.w * sx && op.align !== "right" && op.s.length >= 4) {
      const half = Math.ceil(op.s.length / 2);
      const lines = [op.s.slice(0, half), op.s.slice(half)];
      const s2 = Math.min(fit(lines[0], 3.6), fit(lines[1], 3.6));
      ctx.font = `${s2 * sy}px ${FONT}`;
      ctx.fillText(lines[0], op.x * sx, (op.y - s2 * 0.55) * sy, op.w * sx);
      ctx.fillText(lines[1], op.x * sx, (op.y + s2 * 0.55) * sy, op.w * sx);
    } else {
      ctx.font = `${size * sy}px ${FONT}`;
      ctx.fillText(op.s, op.x * sx, op.y * sy, op.w * sx);
    }
  }
  return canvas.toDataURL("image/png");
}

/** 申告書の画像に ops を描いて表示する */
/**
 * お手本の画像を端末に保存する。
 * スマホでは共有の画面を開き、「画像を保存」で写真アプリに保存できるようにする。
 * PC（共有の画面がない、またはマウス操作の端末）では、そのままファイルとしてダウンロードする。
 * 保存するかどうかは利用者が決める（アプリが勝手に保存することはない）。
 */
async function saveImage(dataUrl: string, fileName: string): Promise<"shared" | "downloaded" | "cancelled"> {
  const blob = await (await fetch(dataUrl)).blob();
  const file = new File([blob], fileName, { type: "image/png" });
  const touch = typeof window !== "undefined" && window.matchMedia?.("(pointer: coarse)").matches;
  if (touch && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName });
      return "shared";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
      // 共有できなかったときは、ダウンロードに切り替える
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "downloaded";
}

function SaveButton({ src, fileName }: { src: string; fileName: string }) {
  const [msg, setMsg] = useState("");
  return (
    <div>
      <button
        onClick={async () => {
          try {
            const r = await saveImage(src, fileName);
            setMsg(r === "downloaded" ? "保存しました（ダウンロードのフォルダを確認してください）。" : r === "shared" ? "保存しました。" : "");
          } catch {
            setMsg("保存できませんでした。画像を長押し（PCでは右クリック）して保存してください。");
          }
        }}
        className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-blue-600 bg-white px-4 py-3 font-bold text-blue-700"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />
        </svg>
        この画像を端末に保存する
      </button>
      <p className="mt-1 text-center text-xs text-gray-600">
        {msg || "スマホでは、開いた画面で「画像を保存」を選ぶと写真アプリに入ります。"}
      </p>
    </div>
  );
}

export function FormCanvas({ image, ops, overflow, alt, credit, fileName }: { image: string; ops: Op[]; overflow: string[]; alt: string; credit: string; fileName: string }) {
  const [src, setSrc] = useState("");
  const [failed, setFailed] = useState(false);
  const key = JSON.stringify(ops);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setSrc(draw(img, JSON.parse(key)));
    img.onerror = () => setFailed(true);
    img.src = image;
  }, [key, image]);

  if (failed) return <p className="text-sm text-red-700">申告書の画像を読み込めませんでした。</p>;
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-600">
        青い文字が記入する内容です。○はその項目を○で囲む、✓はチェックを付けるという意味です。画像は2本指で拡大できます。
      </p>
      {overflow.map((o) => (
        <p key={o} className="rounded bg-yellow-50 p-2 text-sm">{o}</p>
      ))}
      <div className="overflow-x-auto rounded border border-gray-300 bg-white">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt={alt} className="block w-full min-w-[720px]" />
        ) : (
          <p className="p-4 text-sm text-gray-500">申告書の画像を作っています…</p>
        )}
      </div>
      {src && <SaveButton src={src} fileName={fileName} />}
      <p className="text-[10px] text-gray-500">申告書の画像：国税庁「{credit}」を加工して作成</p>
    </div>
  );
}

export function FormImage({ data, calc, under23 }: { data: ReadResult; calc: Calculation; under23: boolean }) {
  const { ops, overflow } = buildOps(data, calc, under23);
  return (
    <FormCanvas
      image="forms/hoken-r8.png"
      ops={ops}
      overflow={overflow}
      alt="保険料控除申告書の記入例"
      fileName="nencho-hoken-otehon.png"
      credit="令和８年分 給与所得者の保険料控除申告書"
    />
  );
}

export function BasicFormImage({ family }: { family: Family }) {
  const { ops, overflow } = buildBasicOps(family);
  return (
    <FormCanvas
      image="forms/kiso-r8.png"
      ops={ops}
      overflow={overflow}
      alt="基礎控除申告書の記入例"
      fileName="nencho-kiso-otehon.png"
      credit="令和８年分 給与所得者の基礎控除申告書 兼 給与所得者の配偶者控除等申告書 兼 給与所得者の特定親族特別控除申告書 兼 所得金額調整控除申告書"
    />
  );
}
