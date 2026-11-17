"use client";

import { useId, useState } from "react";

// ⓘ アイコン。押すと、すぐ下に補足の説明が開く（もう一度押すと閉じる）。
export function InfoTip({ children, label = "説明を見る" }: { children: React.ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <span className="inline">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen(!open);
        }}
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        className={`ml-1 inline-flex h-5 w-5 items-center justify-center rounded-full align-middle text-xs font-bold ${open ? "bg-blue-600 text-white" : "bg-blue-100 text-blue-700"}`}
      >
        i
      </button>
      {open && (
        <span id={id} role="note" className="mt-1 block rounded-lg border border-blue-200 bg-blue-50 p-2 text-left text-xs font-normal leading-relaxed text-gray-800">
          {children}
        </span>
      )}
    </span>
  );
}
