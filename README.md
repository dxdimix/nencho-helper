# 年末調整 記入お手本

保険料控除証明書（ハガキ）をスマホで撮影すると、保険料控除申告書のどの欄に何を書けばよいかを表示するアプリです。
読み取りは自宅PCの Claude Code が行うため、API の料金はかかりません（Claude の有料プランの範囲で動きます）。

## 使い方（毎回）
1. 自宅のPCで `start-windows.bat` をダブルクリックします。黒い画面にアドレスと QR コードが出ます。
2. スマホをPCと同じ Wi-Fi につなぎ、QR コードを読み取ってアプリを開きます。
3. 「ハガキを撮影」を押して撮影します。30 秒〜1 分ほどでお手本が表示されます。
4. 終わったら、黒い画面で Ctrl + C を押すか、画面を閉じます。

写真は読み取りが終わるとすぐにPCから削除されます。Claude Code の会話記録も残りません。

## 最初の1回だけの準備（Windows）
1. **Node.js を入れる**: https://nodejs.org/ja から「LTS」版をダウンロードしてインストールします。
2. **Claude Code を入れる**: PowerShell を開き、次を実行します。
   ```
   irm https://claude.ai/install.ps1 | iex
   ```
   続けて `claude` と入力し、表示に従って Claude のアカウントでログインします。ログインできたら `/exit` で終了します。
3. **このアプリをダウンロードする**: https://github.com/dxdimix/nencho-helper の「Code」→「Download ZIP」でダウンロードし、好きな場所に展開します。
4. 展開したフォルダの `start-windows.bat` をダブルクリックします。初回は準備に数分かかります。
5. 「Windows セキュリティの重要な警告」が出たら、「プライベート ネットワーク」にチェックを入れて「アクセスを許可する」を押します。これを許可しないと、スマホからつながりません。

## PCを使わないとき
https://dxdimix.github.io/nencho-helper/ を開くと、ChatGPT などのAIのチャットに写真と依頼文を送り、その回答を貼り付ける方法で使えます。

## 開発者向け
- `npm run dev` / `npm run build` / `npm run lint` / `npm test`
- `npm run local`: ビルドして自宅PC用サーバーを起動（`PORT`, `CLAUDE_MODEL`（既定 sonnet）, `CLAUDE_BIN` で変更可）
