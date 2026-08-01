# Runbook: District Provisioning Checklist

本ランブックは、新規地区の立ち上げ（Provisioning）作業を担当するオペレーターが確認すべきチェックリストです。

---

## ■ 構築開始前チェック
- [ ] ターミナルで `clasp login` が通っており、操作アカウントが `postingareamap@gmail.com` になっていること。
- [ ] 設定対象となる新しい地区ID（例: `MIE-04`）が決まっていること。
- [ ] コピー元のマスターテンプレート（MIE-03版）が最新状態であることを確認している。

---

## ■ プロビジョニング実行時チェック (provision-district.js)

- [ ] `node development/provision-district.js --district ID` コマンドを実行。
- [ ] トランザクション ID (`prov-[Timestamp]-ID`) が正常にコンソール上に発行されている。
- [ ] スプレッドシートの複製が成功し、新しいスプレッドシート ID が取得できている。
- [ ] 写真保存用フォルダの作成が成功し、新しいフォルダ ID が取得できている。
- [ ] `deployment.json` が生成され、新しい ID 情報と `status: PENDING` が正しく記録されている。
- [ ] `clasp push` および `clasp deploy` が成功し、新しい Web App URL がマニフェストへ設定されている。
- [ ] GAS Web App の `bootstrapProperties` により、Script Properties（`SPREADSHEET_ID`, `STORAGE_PARENT_ID`, `DISTRICT_ID`）が自動初期化されている。
- [ ] OAuth チェックが走り、未承認時は正しく一時停止して指示メッセージが表示されている。
- [ ] 手動での OAuth 承認後、エンターキー入力により `deploy-verify.js` のフル診断が自動トリガーされている。
- [ ] すべての項目で `PASS` を取得し、最終判定として **`FINAL STATUS: READY`** が表示されている。

---

## ■ 異常発生時のクリーンアップチェック (ロールバック)
- [ ] 構築が途中で失敗した場合、自動クリーンアップログ（`✓ Deleted file/folder from Drive`）が出力され、作成途中のゴミデータが Drive 上から完全に削除されていること。
- [ ] マニフェスト `deployment.json` のステータスが `ROLLED_BACK` に正常更新されていること。
