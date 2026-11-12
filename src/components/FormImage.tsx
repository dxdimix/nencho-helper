"use client";

import { useEffect, useState } from "react";
import type { Calculation } from "@/lib/calc";
import { buildOps, PAGE_H, PAGE_W, type Op } from "@/lib/formOps";
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
    // 欄の幅に収まるまで文字を小さくする
    let size = op.size ?? 6.5;
    ctx.font = `${size * sy}px ${FONT}`;
    while (ctx.measureText(op.s).width > op.w * sx && size > 3.5) {
      size -= 0.25;
      ctx.font = `${size * sy}px ${FONT}`;
    }
    ctx.textAlign = op.align ?? "left";
    ctx.fillText(op.s, op.x * sx, op.y * sy, op.w * sx);
  }
  return canvas.toDataURL("image/png");
}

export function FormImage({ data, calc, under23 }: { data: ReadResult; calc: Calculation; under23: boolean }) {
  const [src, setSrc] = useState("");
  const [failed, setFailed] = useState(false);
  const { ops, overflow } = buildOps(data, calc, under23);
  const key = JSON.stringify(ops);

  useEffect(() => {
    const img = new Image();
    img.onload = () => setSrc(draw(img, JSON.parse(key)));
    img.onerror = () => setFailed(true);
    img.src = "forms/hoken-r8.png";
  }, [key]);

  if (failed) return <p className="text-sm text-red-700">申告書の画像を読み込めませんでした。</p>;
  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-600">
        青い文字が記入する内容です。○は、その項目を○で囲むという意味です。画像は2本指で拡大できます。長押し（PCでは右クリック）で保存もできます。
      </p>
      {overflow.map((o) => (
        <p key={o} className="rounded bg-yellow-50 p-2 text-sm">{o}</p>
      ))}
      <div className="overflow-x-auto rounded border border-gray-300 bg-white">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src} alt="保険料控除申告書の記入例" className="block w-full min-w-[720px]" />
        ) : (
          <p className="p-4 text-sm text-gray-500">申告書の画像を作っています…</p>
        )}
      </div>
      <p className="text-[10px] text-gray-500">申告書の画像：国税庁「令和８年分 給与所得者の保険料控除申告書」を加工して作成</p>
    </div>
  );
}
