# サクッとねんちょー

撮って、答えて、書き写すだけ。

保険料控除証明書（ハガキ）をスマホで撮影すると、保険料控除申告書のどの欄に何を書けばよいかを表示するアプリです。
読み取りは自宅PCの Claude Code が行うため、API の料金はかかりません（Claude の有料プランの範囲で動きます）。

## 使い方（毎回）
1. 自宅のPCで、デスクトップの「サクッとねんちょー」をダブルクリックします。黒い画面にアドレスと QR コードが出ます。
2. スマホをPCと同じ Wi-Fi につなぎ、QR コードを読み取ってアプリを開きます。
3. 「ハガキを撮影」を押して撮影します。30 秒〜1 分ほどでお手本が表示されます。
4. 終わったら、黒い画面で Ctrl + C を押すか、画面を閉じます。

写真は読み取りが終わるとすぐにPCから削除されます。Claude Code の会話記録も残りません。

## 最初の1回だけの準備（Windows）
スタートメニューで「PowerShell」と入力して開き、次の1行を貼り付けて Enter を押します。

```
irm https://raw.githubusercontent.com/dxdimix/nencho-helper/main/setup-windows.ps1 | iex
```

Node.js と Claude Code の確認・インストール、アプリのダウンロード、デスクトップへのショートカット作成、Claude Code のログイン確認、起動までを自動で行います。
アプリを最新版に更新したいときも、同じ1行を実行します。

「Windows セキュリティの重要な警告」が出たら、「プライベート ネットワーク」にチェックを入れて「アクセスを許可する」を押してください。許可しないとスマホからつながりません。

## 外出先で使う（Tailscale）
セットアップの1行で、PC に Tailscale（無料）も入ります。表示に従ってログインしてください。
スマホにも「Tailscale」アプリを入れ、PC と同じアカウントでログインしてオンにします。
PC の黒い画面に出る「家でも外出先でも使えるアドレス」の QR コードを読み取り、ホーム画面に追加すれば、家でも外でも同じアイコンで使えます。
外出先で使うときは、家の PC の電源を入れたまま、スリープしない設定にしておいてください。

## 画面の使い方
画面の上に「①アンケート → ②書類の撮影 → ③確認 → ④お手本」と今の手順が出ます。上から順に進むだけです。
1. **アンケート**：年末調整の時期、あなたの収入と家族、入っている保険などに答えます（氏名やマイナンバーは不要）。
2. **ハガキの登録**：アンケートの答えから、登録するハガキの一覧が出ます。「写真で登録」か「手で入力」を選んで、1枚ずつ続けて登録します。登録したハガキは一覧で確認でき、間違えたら消せます。
3. **確認**：空欄の補足、自信がない金額の見比べ、撮り忘れの確認をします。
4. **お手本**：勤務先に出す申告書（保険料控除・住宅ローン・基礎控除・扶養控除）のお手本を、1ページにまとめて表示します。「申告書の画像で見る」「表で見る」を切り替えられます。

## 実物で確認すること（最初の1回）
1. 起動したら、画面のいちばん下に「自宅PCモード・版 ○○○○○○○」と出ることを確認します。次に更新があったとき、起動時に黒い画面へ「新しい版があります。更新しています…」と出て、この番号が変われば自動更新が動いています。
2. 「②書類の撮影」の画面の下にある「動作チェック（見本のハガキで試す）」を開き、「動作チェックを実行」を押します。「正しく読み取れました」と出れば、PC側の準備はできています。
3. 手元のハガキを1枚撮影し、お手本の内容（保険会社名・新旧・金額）がハガキと一致するかを確認します。
4. お手本の「基礎控除申告書」「扶養控除等申告書」の内容が、勤務先から配られた申告書の記載例と合っているかを確認します。

## 外出先から「写真で登録」を使う（Supabase、任意）
DIMY と同じ仕組みです。スマホの画面（GitHub Pages 版）→ Supabase → 自宅PC の順に写真を届け、自宅PCの Claude Code が読み取ります（追加の料金はかかりません）。
写真は読み取りが終わるまでの間だけ Supabase に置かれ、読み取り後すぐに消えます（消し忘れも15分で自動で消します）。

### 1. Supabase（最初の1回だけ）
1. https://supabase.com/dashboard で「New project」を押し、プロジェクトを作ります（名前は `nencho` など、Region は Tokyo）。
2. 左のメニューの「SQL Editor」を開き、このリポジトリの `supabase/migrations/20261117000000_read_jobs.sql` の中身を貼り付けて「Run」を押します。
3. 「Authentication」→「Users」→「Add user」→「Create new user」で、メールアドレスとパスワードを入れ、「Auto Confirm User」にチェックを入れて作ります。奥さんなども使う場合は、同じように追加します。
4. 「Authentication」→「Sign In / Providers」で「Allow new users to sign up」をオフにします（他人が登録できないようにするため）。
5. 「Project Settings」→「Data API」で **Project URL**、「API Keys」で **Publishable key**（`sb_publishable_`）と **Secret key**（`sb_secret_`）を控えます。

### 2. GitHub（画面に Supabase の場所を教える）
1. https://github.com/dxdimix/nencho-helper/settings/variables/actions を開きます。
2. 「New repository variable」で次の2つを追加します（どちらも公開されてよい値です）。
   - `NEXT_PUBLIC_SUPABASE_URL` = Project URL
   - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` = Publishable key
3. https://github.com/dxdimix/nencho-helper/actions で「Deploy to GitHub Pages」を開き、「Run workflow」を押して公開し直します。

### 3. 自宅PC
いつもの1行（セットアップ）をもう一度実行します。途中でメモ帳が開くので、次の2行に値を貼り付けて保存し、メモ帳を閉じます。
```
SUPABASE_URL=（Project URL）
SUPABASE_SECRET_KEY=（Secret key）
```
**Secret key は強い権限を持つキーです。この PC の `.env.local` 以外（GitHub など）には書かないでください。**
起動したときの黒い画面に「Supabase とつながりました」と出れば準備完了です。

### 使い方
GitHub Pages 版（https://dxdimix.github.io/nencho-helper/）を開き、「②ハガキの登録」でログインすると「写真で登録」が使えます。
画面に「自宅PC：オンライン」と出ている間（自宅PCでアプリが起動している間）だけ使えます。

## PCを使わないとき
https://dxdimix.github.io/nencho-helper/ を開くと、ハガキの内容を手で入力して使えます。上の Supabase の設定をすると、ここからも「写真で登録」が使えます。

## 開発者向け
- `npm run dev` / `npm run build` / `npm run lint` / `npm test`
- `npm run local`: ビルドして自宅PC用サーバーを起動（`PORT`, `CLAUDE_MODEL`（既定 sonnet）, `CLAUDE_BIN` で変更可）
