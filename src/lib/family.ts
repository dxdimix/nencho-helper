// 本人・配偶者・家族の情報と、所得・控除の判定（令和8年分の基礎控除申告書、令和9年分の扶養控除等申告書）。
// 金額や年齢の基準は、国税庁の令和8年分「年末調整のしかた」と各申告書の裏面の説明に基づく。
// 入力された情報は画面の状態（メモリ）にだけ持ち、保存しない。

export type Disability = "なし" | "障害者" | "特別障害者";

export type Person = {
  /** 画面で区別するための呼び名（例: 長男）。氏名は入れなくてよい */
  label: string;
  /** 続柄 */
  relation: string;
  /** 生年月日（YYYY-MM-DD） */
  birth: string;
  /** 1年間の給与の収入金額（見込み、円） */
  salary: number;
  /** 給与以外の所得の合計（年金・事業など。所得金額で、円） */
  otherIncome: number;
  /** 同居しているか */
  livingTogether: boolean;
  disability: Disability;
};

export type Self = {
  salary: number;
  otherIncome: number;
  disability: Disability;
  /** 寡婦・ひとり親 */
  widow: "なし" | "寡婦" | "ひとり親";
  /** 勤労学生 */
  workingStudent: boolean;
};

export type Family = {
  self: Self;
  spouse: Person | null;
  dependents: Person[];
};

export const emptySelf = (): Self => ({ salary: 0, otherIncome: 0, disability: "なし", widow: "なし", workingStudent: false });

export const newPerson = (relation = "子"): Person => ({
  label: "",
  relation,
  birth: "",
  salary: 0,
  otherIncome: 0,
  livingTogether: true,
  disability: "なし",
});

// ---------------------------------------------------------------------------
// 所得の計算

/**
 * 給与所得の金額（令和8・9年分）。基礎控除申告書の裏面「給与所得金額の計算方法」の表のとおり。
 */
export function salaryIncome(a: number): number {
  if (a < 741_000) return 0;
  if (a < 2_191_000) return a - 740_000;
  if (a < 2_193_000) return 1_451_000;
  if (a < 2_196_000) return 1_453_000;
  if (a < 2_200_000) return 1_456_000;
  const q = Math.floor(a / 4 / 1000) * 1000; // ÷4（千円未満切捨て）
  if (a < 3_600_000) return (q * 28) / 10 - 80_000;
  if (a < 6_600_000) return (q * 32) / 10 - 440_000;
  if (a < 8_500_000) return Math.floor(a * 0.9) - 1_100_000;
  return a - 1_950_000;
}

/** 合計所得金額の見積額（給与所得＋給与以外の所得） */
export function totalIncome(p: { salary: number; otherIncome: number }): number {
  return salaryIncome(p.salary) + p.otherIncome;
}

// ---------------------------------------------------------------------------
// 年齢（その年の12月31日現在。法律上、誕生日の前日に年齢が上がるため、1月1日生まれは1歳多く数える）

export function ageAtYearEnd(birth: string, year: number): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birth);
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  return year - y + (mo === 1 && d === 1 ? 1 : 0);
}

// ---------------------------------------------------------------------------
// 令和8年分 基礎控除申告書

export type BasicDeduction = {
  salaryIncome: number;
  otherIncome: number;
  adjustment: number; // 所得金額調整控除の額（見込み）
  total: number; // 合計所得金額の見積額
  judgeRow: string; // 「判定」欄でチェックを付ける行
  kubun1: "A" | "B" | "C" | null; // 区分Ⅰ
  amount: number; // 基礎控除の額
};

const BASIC_ROWS: { max: number; row: string; amount: number }[] = [
  { max: 4_890_000, row: "489万円以下", amount: 1_040_000 },
  { max: 6_550_000, row: "489万円超 655万円以下", amount: 670_000 },
  { max: 9_000_000, row: "655万円超 900万円以下", amount: 620_000 },
  { max: 9_500_000, row: "900万円超 950万円以下", amount: 620_000 },
  { max: 10_000_000, row: "950万円超 1,000万円以下", amount: 620_000 },
  { max: 23_500_000, row: "1,000万円超 2,350万円以下", amount: 620_000 },
  { max: 24_000_000, row: "2,350万円超 2,400万円以下", amount: 480_000 },
  { max: 24_500_000, row: "2,400万円超 2,450万円以下", amount: 320_000 },
  { max: 25_000_000, row: "2,450万円超 2,500万円以下", amount: 160_000 },
];

export function kubun1(total: number): "A" | "B" | "C" | null {
  if (total <= 9_000_000) return "A";
  if (total <= 9_500_000) return "B";
  if (total <= 10_000_000) return "C";
  return null;
}

// ---------------------------------------------------------------------------
// 配偶者控除・配偶者特別控除（令和8年分）

export type SpouseResult = {
  income: number;
  kubun2: "①" | "②" | "③" | "④" | null;
  kind: "配偶者控除" | "配偶者特別控除" | null;
  amount: number;
  reason: string;
};

const SPOUSE_DEDUCTION = { A: [480_000, 380_000], B: [320_000, 260_000], C: [160_000, 130_000] } as const;
// 区分Ⅱ③（62万円超95万円以下）と④（95万円超133万円以下）の配偶者特別控除。[配偶者の所得の上限, A, B, C]
const SPOUSE_SPECIAL: [number, number, number, number][] = [
  [950_000, 380_000, 260_000, 130_000],
  [1_000_000, 360_000, 240_000, 120_000],
  [1_050_000, 310_000, 210_000, 110_000],
  [1_100_000, 260_000, 180_000, 90_000],
  [1_150_000, 210_000, 140_000, 70_000],
  [1_200_000, 160_000, 110_000, 60_000],
  [1_250_000, 110_000, 80_000, 40_000],
  [1_300_000, 60_000, 40_000, 20_000],
  [1_330_000, 30_000, 20_000, 10_000],
];

export function spouseDeduction(spouse: Person, selfKubun: "A" | "B" | "C" | null, year = 2026): SpouseResult {
  const income = totalIncome(spouse);
  const age = ageAtYearEnd(spouse.birth, year);
  let kubun2: SpouseResult["kubun2"] = null;
  if (income <= 620_000) kubun2 = age !== null && age >= 70 ? "①" : "②";
  else if (income <= 950_000) kubun2 = "③";
  else if (income <= 1_330_000) kubun2 = "④";

  if (!kubun2) return { income, kubun2, kind: null, amount: 0, reason: "配偶者の所得が133万円を超えるため、配偶者控除も配偶者特別控除も受けられません。" };
  if (!selfKubun) return { income, kubun2, kind: null, amount: 0, reason: "あなたの所得が1,000万円を超えるため、配偶者控除も配偶者特別控除も受けられません。" };

  const col = { A: 1, B: 2, C: 3 }[selfKubun];
  if (kubun2 === "①" || kubun2 === "②") {
    const amount = SPOUSE_DEDUCTION[selfKubun][kubun2 === "①" ? 0 : 1];
    return { income, kubun2, kind: "配偶者控除", amount, reason: "" };
  }
  const row = SPOUSE_SPECIAL.find((r) => income <= r[0])!;
  return { income, kubun2, kind: "配偶者特別控除", amount: row[col], reason: "" };
}

// ---------------------------------------------------------------------------
// 特定親族特別控除（令和8年分）：19歳以上23歳未満で、所得が62万円超123万円以下の親族

const SPECIFIC_RELATIVE: [number, number][] = [
  [850_000, 630_000],
  [900_000, 610_000],
  [950_000, 510_000],
  [1_000_000, 410_000],
  [1_050_000, 310_000],
  [1_100_000, 210_000],
  [1_150_000, 110_000],
  [1_200_000, 60_000],
  [1_230_000, 30_000],
];

export function specificRelativeAmount(income: number): number {
  if (income <= 620_000 || income > 1_230_000) return 0;
  return SPECIFIC_RELATIVE.find((r) => income <= r[0])![1];
}

// ---------------------------------------------------------------------------
// 区分（扶養親族かどうか など）

export type DependentStatus = {
  person: Person;
  age: number | null;
  income: number;
  /** 扶養親族（所得62万円以下） */
  isDependent: boolean;
  /** 控除対象扶養親族（16歳以上の扶養親族） */
  isQualified: boolean;
  /** 特定扶養親族（19歳以上23歳未満の控除対象扶養親族） */
  isSpecialDependent: boolean;
  /** 特定親族（19歳以上23歳未満で所得62万円超123万円以下） */
  isSpecificRelative: boolean;
  /** 老人扶養親族（70歳以上の控除対象扶養親族） */
  isElderly: boolean;
  /** 同居老親等（老人扶養親族のうち、同居している父母・祖父母など） */
  isCoResidentParent: boolean;
  /** 16歳未満の扶養親族 */
  isUnder16: boolean;
  /** 源泉控除対象親族（控除対象扶養親族、または所得100万円以下の特定親族） */
  isWithholdingTarget: boolean;
  /** 23歳未満の扶養親族（生命保険料控除の特例・所得金額調整控除の判定に使う） */
  isUnder23Dependent: boolean;
};

const PARENT_LIKE = ["父", "母", "祖父", "祖母", "配偶者の父", "配偶者の母", "配偶者の祖父", "配偶者の祖母"];

export function classify(person: Person, year: number): DependentStatus {
  const age = ageAtYearEnd(person.birth, year);
  const income = totalIncome(person);
  const isDependent = income <= 620_000;
  const known = age !== null;
  const isQualified = isDependent && known && age >= 16;
  const in19to22 = known && age >= 19 && age <= 22;
  const isSpecialDependent = isQualified && in19to22;
  const isSpecificRelative = in19to22 && income > 620_000 && income <= 1_230_000;
  const isElderly = isQualified && age! >= 70;
  return {
    person,
    age,
    income,
    isDependent,
    isQualified,
    isSpecialDependent,
    isSpecificRelative,
    isElderly,
    isCoResidentParent: isElderly && person.livingTogether && PARENT_LIKE.includes(person.relation),
    isUnder16: isDependent && known && age < 16,
    isWithholdingTarget: isQualified || (isSpecificRelative && income <= 1_000_000),
    isUnder23Dependent: isDependent && known && age < 23,
  };
}

// ---------------------------------------------------------------------------
// 令和8年分 基礎控除申告書 兼 配偶者控除等申告書 兼 特定親族特別控除申告書 兼 所得金額調整控除申告書

export function basicForm(f: Family, year = 2026) {
  const statuses = f.dependents.map((p) => classify(p, year));
  const spouseIncome = f.spouse ? totalIncome(f.spouse) : null;

  // 所得金額調整控除（給与の収入が850万円を超え、特別障害者や23歳未満の扶養親族がいる場合）
  const reasons: string[] = [];
  if (f.self.disability === "特別障害者") reasons.push("あなた自身が特別障害者");
  if (f.spouse && spouseIncome !== null && spouseIncome <= 620_000 && f.spouse.disability === "特別障害者")
    reasons.push("同一生計配偶者が特別障害者");
  if (statuses.some((s) => s.isDependent && s.person.disability === "特別障害者")) reasons.push("扶養親族が特別障害者");
  if (statuses.some((s) => s.isUnder23Dependent)) reasons.push("扶養親族が年齢23歳未満（平16.1.2以後生）");
  const adjustmentApplies = f.self.salary > 8_500_000 && reasons.length > 0;
  const adjustment = adjustmentApplies ? Math.ceil((Math.min(f.self.salary, 10_000_000) - 8_500_000) * 0.1) : 0;

  const sIncome = salaryIncome(f.self.salary) - adjustment;
  const total = sIncome + f.self.otherIncome;
  const row = BASIC_ROWS.find((r) => total <= r.max);
  const k1 = kubun1(total);
  const basic: BasicDeduction = {
    salaryIncome: sIncome,
    otherIncome: f.self.otherIncome,
    adjustment,
    total,
    judgeRow: row ? row.row : "2,500万円超（基礎控除なし）",
    kubun1: k1,
    amount: row ? row.amount : 0,
  };

  const spouse = f.spouse ? spouseDeduction(f.spouse, k1, year) : null;
  const specific = statuses
    .filter((s) => s.isSpecificRelative)
    .map((s) => ({ status: s, amount: specificRelativeAmount(s.income) }));

  return {
    basic,
    spouse,
    specific,
    adjustment: { applies: adjustmentApplies, reasons, amount: adjustment, overSalaryLimit: f.self.salary > 8_500_000 },
  };
}

// ---------------------------------------------------------------------------
// 令和9年分 扶養控除等（異動）申告書（年末調整の時期に、来年分として提出する）

export function dependentsForm(f: Family, year = 2027) {
  const selfIncome = totalIncome(f.self);
  const statuses = f.dependents.map((p) => classify(p, year));

  // Ａ 源泉控除対象配偶者：本人の所得900万円以下、配偶者の所得95万円以下
  let spouseA: { show: boolean; income: number; elderly: boolean; reason: string } | null = null;
  if (f.spouse) {
    const income = totalIncome(f.spouse);
    const age = ageAtYearEnd(f.spouse.birth, year);
    const show = selfIncome <= 9_000_000 && income <= 950_000;
    spouseA = {
      show,
      income,
      elderly: age !== null && age >= 70,
      reason: show
        ? ""
        : selfIncome > 9_000_000
          ? "あなたの所得の見積額が900万円を超えるため、Ａ欄には書きません。"
          : "配偶者の所得の見積額が95万円を超えるため、Ａ欄には書きません。",
    };
  }

  // Ｃ 障害者・寡婦・ひとり親・勤労学生
  const c: string[] = [];
  if (f.self.disability !== "なし") c.push(`本人：${f.self.disability === "特別障害者" ? "特別障害者" : "一般の障害者"}`);
  if (f.spouse && totalIncome(f.spouse) <= 620_000 && f.spouse.disability !== "なし")
    c.push(`同一生計配偶者：${f.spouse.disability === "特別障害者" ? (f.spouse.livingTogether ? "同居特別障害者" : "特別障害者") : "一般の障害者"}`);
  for (const s of statuses) {
    if (s.isDependent && s.person.disability !== "なし") {
      const kind = s.person.disability === "特別障害者" ? (s.person.livingTogether ? "同居特別障害者" : "特別障害者") : "一般の障害者";
      c.push(`扶養親族（${s.person.label || s.person.relation}）：${kind}`);
    }
  }
  // 寡婦・ひとり親は、本人の所得の見積額が500万円以下の場合だけ
  if (f.self.widow !== "なし")
    c.push(selfIncome <= 5_000_000 ? f.self.widow : `${f.self.widow}（所得の見積額が500万円を超えるため対象外）`);
  // 勤労学生：所得の見積額が89万円以下で、そのうち給与所得など以外の所得が10万円以下
  const student = f.self.workingStudent
    ? selfIncome <= 890_000 && f.self.otherIncome <= 100_000
      ? "勤労学生"
      : "勤労学生（対象外：所得の見積額が89万円以下で、そのうち給与以外の所得が10万円以下の人だけが対象です）"
    : null;
  if (student) c.push(student);

  return {
    spouseA,
    withholding: statuses.filter((s) => s.isWithholdingTarget),
    under16: statuses.filter((s) => s.isUnder16),
    notListed: statuses.filter((s) => !s.isWithholdingTarget && !s.isUnder16),
    c,
    selfIncome,
  };
}

/** 生年月日を和暦で表す（例：平成18年3月3日） */
export function toWareki(birth: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(birth);
  if (!m) return "";
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const ymd = y * 10000 + mo * 100 + d;
  const [era, base] = ymd >= 20190501 ? ["令和", 2018] : ymd >= 19890108 ? ["平成", 1988] : ["昭和", 1925];
  const n = y - base;
  return `${era}${n === 1 ? "元" : n}年${mo}月${d}日`;
}

/** 保険料控除申告書の「☆年齢23歳未満の扶養親族」欄に書く人（1人でよい） */
export function under23DependentFor(f: Family, year = 2026, incomeLimit = 620_000) {
  const p = f.dependents.find((d) => {
    const age = ageAtYearEnd(d.birth, year);
    return age !== null && age < 23 && totalIncome(d) <= incomeLimit;
  });
  return p ? { person: p, income: totalIncome(p), birthWareki: toWareki(p.birth) } : null;
}

/**
 * 保険料控除申告書の「年齢23歳未満の扶養親族」の判定（令和8年分）。
 * 所得の基準は62万円以下。ただし勤務先が令和8年11月30日以前に年末調整を行う場合は、
 * 国税庁の案内により58万円以下に読み替える（incomeLimit に 580_000 を渡す）。
 */
export function hasUnder23Dependent(f: Family, year = 2026, incomeLimit = 620_000): boolean {
  return f.dependents.some((p) => {
    const age = ageAtYearEnd(p.birth, year);
    return age !== null && age < 23 && totalIncome(p) <= incomeLimit;
  });
}
