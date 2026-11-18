"use client";

import { useState } from "react";
import { buildDetails, type DetailsInput } from "@/lib/details";

/** 「結果の詳細」：お手本の元になった計算の内訳（途中の式・上限・除外の理由）をすべて表示する */
export function ResultDetails(props: DetailsInput) {
  const [open, setOpen] = useState(false);
  return (
    <section id="details" className="scroll-mt-24 space-y-3">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-center gap-2 rounded-full border-2 border-gray-700 bg-white px-4 py-3 font-bold text-gray-800"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
          <rect x="4" y="3" width="16" height="18" rx="2" />
          <path d="M8 8h8M8 12h8M8 16h5" />
        </svg>
        {open ? "結果の詳細を閉じる" : "結果の詳細（計算の内訳をすべて見る）"}
      </button>
      {open && (
        <div className="space-y-4">
          <p className="text-xs text-gray-600">
            お手本の金額を、どの書類から、どの計算式で出したかを順に並べています。上限で抑えた金額や、計算に入れなかった書類とその理由も載せています。
          </p>
          {buildDetails(props).map((s) => (
            <div key={s.title} className="rounded-2xl border border-gray-300 bg-white p-3">
              <h3 className="font-bold">{s.title}</h3>
              {s.intro && <p className="mt-1 text-xs text-gray-600">{s.intro}</p>}
              <ul className="mt-2 divide-y divide-gray-100 text-sm">
                {s.rows.map((r, i) => (
                  <li key={i} className={`py-2 ${r.strong ? "rounded bg-blue-50 px-2" : ""}`}>
                    <div className="flex items-start justify-between gap-3">
                      <span className={r.strong ? "font-bold" : ""}>{r.label}</span>
                      {r.value && <span className={`shrink-0 text-right ${r.strong ? "font-bold text-blue-800" : ""}`}>{r.value}</span>}
                    </div>
                    {r.note && <p className="mt-0.5 text-xs leading-relaxed text-gray-600">{r.note}</p>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
