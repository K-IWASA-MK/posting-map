# Provisioning Guide: Auto-Deploying New Districts

本ガイドは、新しい選挙区・地区向けに POSTING MAP インフラおよび検証証明を CLI ツールを利用して数分で全自動構築する手順書です。

---

## 1. 動作要件

1. ターミナルで `clasp login` が実行され、運用アカウント **`postingareamap@gmail.com`** で認証されていること。
2. コピー元となるマスターテンプレートスプレッドシート（MIE-03版）への読み取り権限があること。

---

## 2. プロビジョニング実行手順（コマンド1発）

新規地区（例: `MIE-04`）を立ち上げる場合、以下のコマンドをターミナルで実行します。

```bash
node development/provision-district.js --district MIE-04
```

### 自動実行されるプロセス:
1. `deployment.json` にトランザクション `prov-xxxx-MIE04` を初期化。
2. テンプレートスプレッドシートのコピー (`MIE-04 支部 ポスティングエリアマップ`) をドライブ上に自動生成。
3. 画像保存先フォルダ (`MIE-04 支部_STORAGE`) を自動生成。
4. `deployment.json` に新規リソース ID を書き込み。
5. `clasp push` および `clasp deploy` を実行し、GAS にコードをデプロイ。
6. Web App 経由で `Script Properties`（スプシID, フォルダID等）を自動セット。
7. OAuth 承認ステータスの自動検証。

---

## 3. OAuth 未承認時の誘導プロセス

もし、新プロジェクトに対する OAuth 手動承認が完了していない場合、CLI は以下のメッセージを出力して一時停止します。

```
🚨 OAuth AUTHORIZATION REQUIRED
The Web App execution is currently blocked by Google's gateway.
Please follow these steps:
1. Open the Apps Script Editor: https://script.google.com/home/projects/YOUR_SCRIPT_ID/edit
2. Login under postingareamap@gmail.com
3. Select any function (e.g. verifyDistrictDeployment) and click '実行' (Run) to trigger the Authorization Dialog.
4. Click 'Allow' (許可) to grant the script access to Google Spreadsheets and Drive.

Once you have completed authorization, press [ENTER] to retry:
```

### オペレーターのアクション:
1. 表示された Apps Script エディタの URL をブラウザで開きます。
2. 関数 `verifyDistrictDeployment` を選択して **「実行」** をクリックします。
3. ポップアップするダイアログを進めてアクセスを **「許可（Allow）」** します。
4. ターミナルに戻り、**[ENTER]** キーを押します。

---

## 4. ロールバック手順

もしスプレッドシートやフォルダの作成後に、ネットワークエラーや GAS デプロイエラー等でプロセスが異常終了した場合、CLI は自動で **ロールバックシーケンス** を実行します。

### 手動ロールバック（中途失敗したクリーンアップを実行したい場合）:
```bash
node development/cleanup-district.js
```
マニフェスト `deployment.json` に登録された作成途中の Spreadsheet ID および Folder ID を Google Drive から自動削除し、マニフェストを安全なクリーン状態にリセットします。
