# 年末調整 記入お手本

保険料控除証明書（ハガキ）をスマホで撮影すると、保険料控除申告書のどの欄に何を書けばよいかを表示するアプリです。
読み取りは自宅PCの Claude Code が行うため、API の料金はかかりません（Claude の有料プランの範囲で動きます）。

## 使い方（毎回）
1. 自宅のPCで、デスクトップの「年末調整お手本」をダブルクリックします。黒い画面にアドレスと QR コードが出ます。
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

## PCを使わないとき
https://dxdimix.github.io/nencho-helper/ を開くと、ChatGPT などのAIのチャットに写真と依頼文を送り、その回答を貼り付ける方法で使えます。

## 開発者向け
- `npm run dev` / `npm run build` / `npm run lint` / `npm test`
- `npm run local`: ビルドして自宅PC用サーバーを起動（`PORT`, `CLAUDE_MODEL`（既定 sonnet）, `CLAUDE_BIN` で変更可）
