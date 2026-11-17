// やさしい線のイラスト（画面の中に直接描く SVG。外部の画像は使わない）。
// 線は丸みのある濃いグレー、塗りは淡い色でそろえる。

type P = { className?: string };

// 線の書き方（塗りは各図形で指定し、指定のない線は塗らない）
const L = { stroke: "#475569", strokeWidth: 2.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
const C = { blue: "#dbeafe", yellow: "#fef3c7", green: "#dcfce7", pink: "#fce7f3", orange: "#ffedd5", gray: "#f1f5f9", purple: "#ede9fe" };

function Svg({ className, children, vb = "0 0 96 96", label }: P & { children: React.ReactNode; vb?: string; label?: string }) {
  return (
    <svg viewBox={vb} className={className ?? "h-16 w-16"} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <g fill="none">{children}</g>
    </svg>
  );
}

/** ハガキ（控除証明書） */
export function Postcard({ className }: P) {
  return (
    <Svg className={className}>
      <rect x="14" y="20" width="68" height="52" rx="6" fill={C.yellow} {...L} />
      <rect x="62" y="27" width="13" height="15" rx="2" fill={C.pink} {...L} />
      <path d="M22 50h32M22 58h24M22 34h22" {...L} />
    </Svg>
  );
}

/** 盾（保険） */
export function Shield({ className }: P) {
  return (
    <Svg className={className}>
      <path d="M48 14l28 10v20c0 18-12 30-28 38C32 74 20 62 20 44V24z" fill={C.blue} {...L} />
      <path d="M36 48l9 9 16-18" {...L} />
    </Svg>
  );
}

/** 家（住宅ローン・地震保険） */
export function House({ className, quake }: P & { quake?: boolean }) {
  return (
    <Svg className={className}>
      <path d="M18 46L48 20l30 26" fill="none" {...L} />
      <path d="M26 40v34h44V40" fill={C.orange} {...L} />
      <rect x="42" y="54" width="12" height="20" rx="2" fill="#fff" {...L} />
      {quake && <path d="M8 82l8-6 6 6 8-6 6 6 8-6 6 6 8-6 6 6 8-6 6 6" {...L} stroke="#f97316" />}
    </Svg>
  );
}

/** 家族 */
export function Family({ className }: P) {
  return (
    <Svg className={className}>
      <circle cx="32" cy="30" r="9" fill={C.pink} {...L} />
      <circle cx="62" cy="30" r="9" fill={C.blue} {...L} />
      <circle cx="47" cy="52" r="7" fill={C.yellow} {...L} />
      <path d="M18 74c0-12 6-20 14-20s14 8 14 20M48 74c0-12 6-20 14-20s14 8 14 20" fill="none" {...L} />
      <path d="M38 80c0-8 4-13 9-13s9 5 9 13" fill={C.yellow} {...L} />
    </Svg>
  );
}

/** 戻ってくるお金 */
export function Refund({ className }: P) {
  return (
    <Svg className={className}>
      <rect x="14" y="34" width="56" height="38" rx="6" fill={C.green} {...L} />
      <circle cx="42" cy="53" r="9" fill="#fff" {...L} />
      <path d="M42 48v10M38 51h8M38 55h8" {...L} />
      <path d="M78 22a18 18 0 0 1-6 24M78 22l-8 1M78 22l2 8" {...L} stroke="#16a34a" />
    </Svg>
  );
}

/** 会社 */
export function Office({ className }: P) {
  return (
    <Svg className={className}>
      <rect x="24" y="18" width="48" height="60" rx="4" fill={C.gray} {...L} />
      <path d="M34 30h8M54 30h8M34 42h8M54 42h8M34 54h8M54 54h8" {...L} />
      <rect x="42" y="64" width="12" height="14" fill="#fff" {...L} />
    </Svg>
  );
}

/** カレンダー */
export function Calendar({ className }: P) {
  return (
    <Svg className={className}>
      <rect x="18" y="22" width="60" height="54" rx="6" fill="#fff" {...L} />
      <path d="M18 36h60" {...L} />
      <rect x="18" y="22" width="60" height="14" rx="6" fill={C.pink} {...L} />
      <path d="M32 16v12M64 16v12" {...L} />
      <circle cx="58" cy="58" r="7" fill={C.yellow} {...L} />
    </Svg>
  );
}

/** お給料（封筒） */
export function Salary({ className }: P) {
  return (
    <Svg className={className}>
      <rect x="16" y="28" width="64" height="44" rx="5" fill={C.yellow} {...L} />
      <path d="M16 32l32 22 32-22" fill="none" {...L} />
      <circle cx="70" cy="66" r="10" fill={C.green} {...L} />
      <path d="M70 61v10M66 64h8M66 68h8" {...L} />
    </Svg>
  );
}

/** 年金手帳 */
export function Pension({ className }: P) {
  return (
    <Svg className={className}>
      <rect x="24" y="16" width="46" height="62" rx="5" fill={C.blue} {...L} />
      <path d="M34 32h26M34 42h18" {...L} />
      <circle cx="56" cy="60" r="8" fill="#fff" {...L} />
      <path d="M52 60l3 3 6-6" {...L} />
    </Svg>
  );
}

/** 病院（健康保険） */
export function Health({ className }: P) {
  return (
    <Svg className={className}>
      <path d="M48 76S20 60 20 40a14 14 0 0 1 28-6 14 14 0 0 1 28 6c0 20-28 36-28 36z" fill={C.pink} {...L} />
      <path d="M48 40v16M40 48h16" {...L} />
    </Svg>
  );
}

/** 貯金箱（iDeCo） */
export function PiggyBank({ className }: P) {
  return (
    <Svg className={className}>
      <ellipse cx="46" cy="54" rx="28" ry="20" fill={C.pink} {...L} />
      <path d="M30 72v6M58 72v6M72 50l8-4" {...L} />
      <circle cx="60" cy="48" r="2" fill="#475569" />
      <rect x="40" y="22" width="14" height="10" rx="2" fill={C.yellow} {...L} />
      <path d="M38 36h16" {...L} />
    </Svg>
  );
}

/** カバン（転職） */
export function Bag({ className }: P) {
  return (
    <Svg className={className}>
      <rect x="16" y="34" width="64" height="40" rx="6" fill={C.purple} {...L} />
      <path d="M36 34v-8a4 4 0 0 1 4-4h16a4 4 0 0 1 4 4v8M16 52h64" {...L} />
    </Svg>
  );
}

/** カメラ */
export function Camera({ className }: P) {
  return (
    <Svg className={className}>
      <rect x="14" y="30" width="68" height="44" rx="8" fill={C.blue} {...L} />
      <path d="M34 30l6-10h16l6 10" fill="#fff" {...L} />
      <circle cx="48" cy="52" r="12" fill="#fff" {...L} />
      <circle cx="48" cy="52" r="5" fill={C.blue} {...L} />
    </Svg>
  );
}

/** チェックリスト（確認） */
export function Checklist({ className }: P) {
  return (
    <Svg className={className}>
      <rect x="22" y="14" width="52" height="66" rx="6" fill="#fff" {...L} />
      <path d="M32 32l4 4 7-8M32 50l4 4 7-8M32 68l4 4 7-8" {...L} stroke="#16a34a" />
      <path d="M50 32h14M50 50h14M50 68h10" {...L} />
    </Svg>
  );
}

/** 申告書とペン（お手本） */
export function FormPen({ className }: P) {
  return (
    <Svg className={className}>
      <rect x="18" y="14" width="48" height="64" rx="5" fill={C.gray} {...L} />
      <path d="M28 30h28M28 40h28M28 50h18" {...L} />
      <path d="M58 72l20-26 6 5-20 26-8 2z" fill={C.yellow} {...L} />
    </Svg>
  );
}

/** 子ども（学生） */
export function Student({ className }: P) {
  return (
    <Svg className={className}>
      <circle cx="48" cy="40" r="12" fill={C.yellow} {...L} />
      <path d="M30 30l18-10 18 10-18 8z" fill={C.blue} {...L} />
      <path d="M28 80c0-14 9-24 20-24s20 10 20 24" fill={C.green} {...L} />
    </Svg>
  );
}

/** はてな（分からない） */
export function Question({ className }: P) {
  return (
    <Svg className={className}>
      <circle cx="48" cy="48" r="30" fill={C.gray} {...L} />
      <path d="M40 40a8 8 0 1 1 12 7c-3 2-4 3-4 7" {...L} />
      <circle cx="48" cy="64" r="2" fill="#475569" />
    </Svg>
  );
}

/** ガイドの本 */
export function Book({ className }: P) {
  return (
    <Svg className={className}>
      <path d="M48 26c-8-6-20-8-30-6v52c10-2 22 0 30 6 8-6 20-8 30-6V20c-10-2-22 0-30 6z" fill={C.green} {...L} />
      <path d="M48 26v52" {...L} />
    </Svg>
  );
}

/** トップ画面：会社 → 申告書 → お金が戻る */
export function HeroFlow({ className }: P) {
  return (
    <svg viewBox="0 0 320 110" className={className ?? "w-full"} aria-hidden>
      <g fill="none">
      <g transform="translate(0,8)">
        <rect x="20" y="22" width="56" height="64" rx="8" fill={C.yellow} {...L} />
        <path d="M32 40h32M32 52h24M32 64h28" {...L} />
      </g>
      <path d="M90 60h40M122 52l8 8-8 8" {...L} />
      <g transform="translate(138,8)">
        <rect x="6" y="18" width="52" height="68" rx="6" fill={C.blue} {...L} />
        <path d="M16 36h32M16 48h32M16 60h20" {...L} />
        <path d="M44 78l14-18 5 4-14 18-7 2z" fill="#fff" {...L} />
      </g>
      <path d="M210 60h40M242 52l8 8-8 8" {...L} />
      <g transform="translate(250,18)">
        <rect x="6" y="22" width="56" height="40" rx="6" fill={C.green} {...L} />
        <circle cx="34" cy="42" r="9" fill="#fff" {...L} />
        <path d="M34 37v10M30 40h8M30 44h8" {...L} />
      </g>
      <text x="48" y="108" textAnchor="middle" fontSize="12" fill="#475569">ハガキ</text>
      <text x="172" y="108" textAnchor="middle" fontSize="12" fill="#475569">申告書に書く</text>
      <text x="284" y="108" textAnchor="middle" fontSize="12" fill="#475569">税金が戻る</text>
      </g>
    </svg>
  );
}
