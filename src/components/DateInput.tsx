"use client";

import { useEffect, useState } from "react";
import { formatDateText, parseDateText } from "@/lib/dateText";
import { toWareki } from "@/lib/family";

/**
 * 生年月日の入力。数字8桁（例：19881212）で手入力するか、右のカレンダーのボタンで選ぶ。
 * value / onChange は "YYYY-MM-DD"（入力途中や正しくない日付のときは ""）。
 */
export function DateInput({ value, onChange, className = "" }: { value: string; onChange: (v: string) => void; className?: string }) {
  const [text, setText] = useState(formatDateText(value));
  // カレンダーで選んだときなど、外から値が変わったら入力欄にも反映する
  useEffect(() => {
    if (value && parseDateText(text) !== value) setText(formatDateText(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const parsed = parseDateText(text);
  const digits = text.replace(/\D/g, "");
  const problem = text.trim() === "" || parsed ? "" : digits.length >= 8 ? "この日付はありません。もう一度確認してください。" : "数字8桁で入れてください（例：1988年12月12日 → 19881212）";

  return (
    <div className={className}>
      <div className="flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="例：19881212"
          aria-label="生年月日（数字8桁）"
          className="min-w-0 flex-1 rounded-xl border-2 border-gray-300 p-3 text-base"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onChange(parseDateText(e.target.value) ?? "");
          }}
          onBlur={() => parsed && setText(formatDateText(parsed))}
        />
        {/* カレンダーから選ぶ（透明な日付の入力欄をボタンの上に重ねる） */}
        <label className="relative flex w-14 shrink-0 cursor-pointer items-center justify-center rounded-xl border-2 border-gray-300 bg-white" aria-label="カレンダーから選ぶ">
          <svg viewBox="0 0 24 24" className="h-6 w-6 text-gray-700" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden>
            <rect x="3" y="5" width="18" height="16" rx="2" />
            <path d="M3 10h18M8 3v4M16 3v4" />
          </svg>
          <input
            type="date"
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            value={value}
            onChange={(e) => {
              onChange(e.target.value);
              setText(formatDateText(e.target.value));
            }}
            onClick={(e) => {
              try {
                e.currentTarget.showPicker?.();
              } catch {
                // showPicker が使えないブラウザは、そのまま標準の動きにまかせる
              }
            }}
          />
        </label>
      </div>
      <p className={`mt-1 text-xs ${problem ? "text-red-700" : "text-gray-600"}`}>
        {problem || (parsed ? `${toWareki(parsed)}（${parsed.slice(0, 4)}年）` : "数字8桁で入れるか、右のボタンでカレンダーから選べます。")}
      </p>
    </div>
  );
}
