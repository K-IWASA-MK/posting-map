# Deployment Guide: New District Setup

本ガイドは、新しい選挙区・地区（支部）に向けて POSTING MAP インフラ（GAS Web App / Spreadsheet / Drive）をゼロから複製し、デプロイ検証を行って稼働（READY）状態にするまでの標準手順書です。

---

## 1. 前提条件

1. 管理者アカウント（Google Workspace または専用 Gmail アカウント）が準備されていること。
2. ローカル開発環境に `node`、`clasp` および git リモートがセットアップされていること。

---

## 2. デプロイ手順（5つのステップ）

### ステップ 1: スプレッドシートと Drive フォルダのコピー
1. マスターテンプレートとなる「ポスティングエリアマップ」スプレッドシートをコピーします。
2. 配布員が現場で撮影した写真や GPS 情報をアップロードするための専用フォルダを Google ドライブ上に作成します。
3. 作成したフォルダおよびスプレッドシートに対し、**API実行ユーザー（例: `postingareamap@gmail.com`）に「編集者」以上の権限を共有** してください。

### ステップ 2: Apps Script プロジェクトのクローンと `clasp` の紐付け
1. 新しい地区用の Apps Script プロジェクトを作成し、その Script ID をコピーします。
2. プロジェクトのルートディレクトリで `.clasp.json` を開き、`scriptId` をコピーしたものに書き換えます。
   ```json
   {
     "scriptId": "YOUR_NEW_SCRIPT_ID",
     "rootDir": "./active"
   }
   ```

### ステップ 3: `deployment.json` の作成と初期設定
1. プロジェクトルートにある `deployment.json` に新地区の物理 ID 情報を転記します。
   ```json
   {
     "district": "NEW-DISTRICT-NAME",
     "spreadsheetId": "YOUR_SPREADSHEET_ID",
     "storageFolderId": "YOUR_DRIVE_FOLDER_ID",
     "scriptId": "YOUR_NEW_SCRIPT_ID",
     "webAppUrl": "YOUR_WEBAPP_URL_AFTER_DEPLOY",
     "version": 1
   }
   ```

### ステップ 4: スクリプトプロパティの初期化と Clasp Push
1. ターミナルから `clasp push` を実行し、GAS 側へコードをアップロードします。
2. Apps Script エディタのプロジェクト設定を開き、スクリプトプロパティに以下を設定します。
   * `SPREADSHEET_ID` = `YOUR_SPREADSHEET_ID`
   * `STORAGE_PARENT_ID` = `YOUR_DRIVE_FOLDER_ID`

### ステップ 5: Web App デプロイと OAuth 手動承認
1. エディタの「デプロイ」->「新しいデプロイ」から以下を選択してデプロイを実行します。
   * **種類**: ウェブアプリ
   * **次のユーザーとして実行**: 自分（デプロイするユーザー）
   * **アクセスできるユーザー**: 全員
2. 取得した Web App URL を `deployment.json` の `webAppUrl` に記載します。
3. **【最重要】エディタ上で適当な関数を1度「実行」し、Google アカウントによる「承認（OAuth 許可）」を完了させます。**

---

## 3. デプロイ検証と READY 判定

最後に、ローカルから以下の検証コマンドを実行します。
```bash
node development/deploy-verify.js
```

出力されるレポートに **`FINAL CERTIFICATION: [ READY ]`** が表示されれば、デプロイは正常完了し、フロントエンドアプリを公開可能な状態となります。
もし `NOT READY` が表示された場合は、エラー詳細および `DeploymentTroubleshooting.md` を参照して設定を確認してください。
