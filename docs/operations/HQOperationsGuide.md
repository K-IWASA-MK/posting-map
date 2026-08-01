# Operations Guide: HQ Bulk Operations & Health Monitoring

本ガイドは、本部（Headquarters）のシステム管理者が全国の各地区（支部）の稼働ヘルス監視、および一括でのバージョンアップデート（Bulk clasp Deployment）を管理するための運用手順書です。

---

## 1. 全地区のヘルスチェック（死活監視）

全地区の Web App が正常に機能しているか、応答速度（遅延）に問題がないかを一括確認します。

### 実行コマンド:
```bash
node development/bulk-ops.js --action health
```

### 処理内容:
* 全登録地区に対して非同期並列で診断 API を叩き、結果をコンソールにレポート出力します。
* `clients/registry.json` に最新のレスポンスタイムが保存され、管理ダッシュボードに反映されます。

---

## 2. コア機能の一括アップデート（Bulk clasp Deploy）

新機能の追加やバグ修正など、共通の Apps Script コードを一括して全国の地区プロジェクトへデプロイします。

### 実行コマンド:
```bash
node development/bulk-ops.js --action deploy
```

### 処理内容:
1. `registry.json` を元に、READY 状態の地区一覧を走査。
2. `.clasp.json` を動的に各地区の Script ID に切り替えながら、`clasp push` および `clasp deploy` を順次実行して最新コードをデプロイします。
3. 処理完了後、元のローカル開発環境設定を自動復元します。

---

## 3. 本部監視ダッシュボードの表示

ブラウザで以下のファイルを直接開く（または開発サーバー経由でアクセスする）ことで、全国の稼働マトリクスをビジュアルに監視できます。

```
【ダッシュボードの場所】
active/dashboard/admin-registry.html
```

* **監視可能な項目**:
  * 各地区の稼働状況（READY / WARNING / BLOCKED）
  * 各地区の API レスポンス遅延（Latency）
  * 各地区のスプレッドシート・Apps Script エディタ・Web App 診断結果へのワンクリック直行リンク。
