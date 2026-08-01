# Runbook: District Deployment Checklist

本チェックリストは、新しい選挙区・地区へのデプロイ作業を行うオペレーターが、各リリースの品質および接続整合性を保証するための確認表です。

---

## ■ デプロイ品質チェックリスト

### 1. Google ドライブ・共有設定
- [ ] 連携先スプレッドシートへの共有設定が「閲覧者」ではなく「編集者」として `postingareamap@gmail.com` に付与されている。
- [ ] 写真保存先フォルダが Google ドライブ上に正常に準備され、API 実行ユーザーに共有されている。

### 2. clasp およびスクリプト紐付け
- [ ] `.clasp.json` の `scriptId` が、対象地区の新しい GAS プロジェクト ID に正しく変更されている。
- [ ] コミット前のテストコードや不要なデバッグエンドポイント（`active/api/v2_api.js` 等）が綺麗に除去されている。

### 3. スクリプトプロパティ (Script Properties)
- [ ] GAS 設定画面で `SPREADSHEET_ID` が正しく設定されている。
- [ ] `STORAGE_PARENT_ID` が、新しく作成した画像フォルダ ID と一致している。

### 4. 初回 OAuth 承認（ゲートウェイ解除）
- [ ] GAS エディタ上で関数（例: `verifyDistrictDeployment`）を一度手動実行し、「承認が必要です」ダイアログを「許可（Allow）」している。
- [ ] 警告画面が出た場合は、「詳細」->「安全ではないページに移動」をクリックして進めている。

### 5. Web App デプロイ設定
- [ ] 「デプロイの管理」画面で、Execute As が `Me` (自分) になっている。
- [ ] Access が `Anyone` (全員) になっている。
- [ ] `deployment.json` の `webAppUrl` のデプロイIDが、エディタ上に表示されている現在のデプロイ URL と一文字違わず完全一致している。

---

## ■ 最終 Certification 検証の実行

ローカルのターミナルで以下を実行します。
```bash
node development/deploy-verify.js
```

### 期待結果:
* すべての項目に `✅ PASS` がついていること。
* `FINAL CERTIFICATION: [ READY ]` がコンソールに表示されること。
* スプレッドシート上に `DeploymentHistory` シートが自動生成され、合格レコードが 1 行追記されていること。
