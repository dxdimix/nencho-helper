# 年末調整 記入お手本ジェネレーター

保険料控除証明書（ハガキ）の写真から内容を読み取り、年末調整の申告書のどの欄に何を書くかを示したお手本画像を作るWebアプリ。利用者は本人のみ。スマホのブラウザで使う。

## 仕組み（API費用ゼロ）
アプリ画面は静的サイト（next.config.ts の output: "export"）。2つの使い方がある。

1. 自宅PCモード（メイン）: 利用者のWindows PCで local/server.mjs を起動する。
   スマホは同じ Wi-Fi から PC の画面を開き、撮影した写真を送る。
   サーバーは写真を一時フォルダに書き、`claude -p`（Claude Code のヘッドレスモード、利用者の有料プラン）で読み取らせ、JSON を返す。
   URL の ?t= の合言葉（.local-token）で、同じ Wi-Fi の他人の利用を防ぐ。
   外出先からは Tailscale（PC とスマホだけの私設ネットワーク）経由で使う。インターネットへの公開（トンネル等）はしない。
2. 貼り付けモード（予備）: GitHub Pages 版。利用者が任意のAIチャットに写真と依頼文を送り、回答を貼り付ける。

画面は api/health に問い合わせて、どちらのモードかを判定する。
claude.ai などのブラウザ画面の自動操作は規約違反なので行わない。Claude API も使わない（利用者の希望）。

## 個人情報の扱い（必ず守る）
- データベースは使わない。写真と読み取り結果は React の状態（メモリ）にだけ持つ。
- localStorage / IndexedDB / Cookie に保存しない。画面を閉じたら消える状態にする。
- 画面からの通信は、自宅PCサーバー（同一オリジンの api/*）だけ。解析ツールや外部フォントなどを追加しない。
- 自宅PCサーバーは写真を一時フォルダにだけ書き、読み取り後すぐ削除する。claude は --no-session-persistence と --tools Read で動かし、--allowedTools は付けない（読めるのを一時フォルダ内に限るため）。
- 写真の中身や読み取り結果をログ（console.log）に出さない。

## 技術構成
- Next.js 15（App Router, TypeScript, Tailwind）
- zod で読み取り結果の形を定義し、貼り付けた内容を検証する
- 依頼文: src/lib/prompt.mjs（画面とサーバーの両方が使うため .mjs）
- 読み取り項目の定義と貼り付けの解析: src/lib/schema.ts（prompt.mjs の出力形式と必ずそろえる）
- 自宅PCサーバー: local/server.mjs、Windows 起動用: start-windows.bat
- 控除額の計算: src/lib/calc.ts（国税庁の計算式。テストは tests/calc.test.ts）
  - 令和8年分の特例: 23歳未満の扶養親族がいると、一般生命保険料（新）の計算式が変わり、新＋旧の上限が6万円になる（画面のチェックで切り替え）。
  - 計算式や上限は年分ごとに変わるので、毎年、国税庁の「年末調整のしかた」と照らし合わせる。
- お手本の表示: src/components/Guide.tsx（保険料控除）、src/components/FamilyGuides.tsx（基礎控除・扶養控除）
- 家族と収入の入力: src/components/FamilyForm.tsx、判定と計算: src/lib/family.ts（テストは tests/family.test.ts）
  - 年末に書くのは「令和8年分」の保険料控除申告書・基礎控除申告書と、「令和9年分」の扶養控除等申告書。
  - 令和8年度改正（基礎控除の引上げ、給与所得控除の最低保障額74万円、扶養親族の所得要件62万円）を反映済み。

## 対象書類
- 保険料控除申告書（生命保険の新旧・一般/介護医療/個人年金、地震保険、旧長期損害保険、社会保険、小規模企業共済等掛金＝iDeCo）
- 扶養控除等申告書
- 基礎控除申告書 兼 配偶者控除等申告書 兼 所得金額調整控除申告書

## コマンド
- npm run dev / npm run build / npm run lint / npm test
- npm run local（ビルドして自宅PCサーバーを起動）
