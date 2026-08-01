# Operations Guide: Automated Report Generation & Secondary Processing

本ガイドは、本部管理者が日次・週次ポスティング報告レポートを手動で発行する手順、および出力された CSV データを二次加工する方法について説明します。

---

## 1. レポートの手動発行手順

通常、データ集計（`national-aggregator.js`）の実行時に日次（daily）レポートが自動生成されますが、特定のタイミングで週次（weekly）や月次（monthly）レポートを個別に作成することも可能です。

### 日次レポート（daily）の手動作成:
```bash
node development/report-generator.js --type daily
```

### 週次レポート（weekly）の手動作成:
```bash
node development/report-generator.js --type weekly
```

### 月次レポート（monthly）の手動作成:
```bash
node development/report-generator.js --type monthly
```

---

## 2. 生成されたレポートアセットの確認方法

生成されたすべてのファイルは以下のディレクトリに格納されます。

```
【レポート格納先】
active/dashboard/clients/reports/
```

* **`.md` (Markdown)**:
  ファイルをエディタで開き、中身をコピーしてチャットツール（Chatwork等）のメッセージ欄にそのまま貼り付けて送信できます。
* **`.html` (HTML)**:
  ダブルクリックしてブラウザで開くことで、本部の戦況コックピットに準拠した美麗なグラフィカルレポートを確認・印刷できます。
* **`.csv` (CSV)**:
  Excel や Google スプレッドシートにインポートして、独自のグラフ作成やピボットテーブル分析などの二次加工データとして利用可能です。

---

## 3. レポート発行履歴の確認

`clients/reports/history.json` をロードすることで、過去 100 件分のレポートファイルへの相対パス一覧をいつでもトレース・取得できます。
