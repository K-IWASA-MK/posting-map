# Operations Guide: Chatwork API Token & Room ID Setup

本ガイドは、POSTING MAP から現場の Chatwork ルームへ通知（レポート、障害警告、新地区完了等）を自動送信するための環境変数設定手順書です。

---

## 1. 接続情報の取得手順

### ① Chatwork API トークンの取得:
1. Chatwork にログインし、右上のユーザー名アイコン ➔ 「サービス連携」をクリックします。
2. 「API設定」を選択し、APIトークンを発行（または確認）し、コピーします。

### ② 送信先ルーム ID の取得:
1. 通知を送信させたい Chatwork のチャットルームを開きます。
2. ブラウザの URL バーを確認し、末尾の `#!ridXXXXXX` の `XXXXXX`（数字部分のみ）をコピーします。これがルームID（例：`1234567`）です。

---

## 2. 環境変数の適用手順

通知エンジンを実行するサーバー、またはローカル環境で以下の環境変数を設定してください。

### macOS / Linux の設定例 (`~/.zshrc` 等に追記):
```bash
export CHATWORK_API_TOKEN="あなたのコピーしたAPIトークン"
export CHATWORK_ROOM_ID="あなたのチャットルームID"
```
適用するにはターミナルで `source ~/.zshrc` を実行するか、ターミナルを再起動します。

---

## 3. 送信テストの実行

接続が正しく確立されているかを検証するため、以下の疎通確認コマンドを実行します。

```bash
node development/notification-engine.js --type test
```

### 結果確認:
* 設定した Chatwork のルームに `[info][title]🔌 POSTING MAP Chatwork notification test connection[/title]...[/info]` というテスト通知が投稿されていれば、連携設定は完了です。
* `clients/notifications-history.json` を開き、送信履歴（`status: SUCCESS`）が記録されていることを確認してください。
* *※ 環境変数が設定されていない、あるいは API Token に `mock` を設定した場合は、自動的に Mock モードになり、コンソールに送信メッセージが擬似表示されます。*
