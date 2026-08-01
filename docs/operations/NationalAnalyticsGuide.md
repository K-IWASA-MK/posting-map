# Operations Guide: HQ National Analytics & Alert Management

本ガイドは、本部選挙戦略室のオペレーターが全国のポスティングデータ集計（National KPI）の可視化、および動作リスク（アラート）に対処するための手順を説明します。

---

## 1. 全国戦況データの収集と集計（データ集約）

### 実行コマンド:
```bash
node development/national-aggregator.js
```

### 処理結果:
* 全地区の現在のポスティング進捗率・エリア数が非同期並列で走査され、`active/dashboard/clients/national-summary.json` に最新集計が書き出されます。
* コンソールに「全国平均進捗率」や「地域別進捗率」の集計レポートが Markdown 形式で表示されます。

---

## 2. 動作リスク（アラート）の自動スキャン

システム異常、バージョン乖離、通信途絶の自動チェックを実行します。

### 実行コマンド:
```bash
node development/alert-monitor.js
```

### 処理結果:
* 異常のある地区（例：OAuthが切れて BLOCKED になった地区や、最終通信から12時間以上経過した地区）が検出され、`active/dashboard/clients/alerts.json` にログ出力されます。
* 検出されたアラートは、管理画面の最上部に赤色警告バナーとして動的表示されます。

---

## 3. 本部ダッシュボードでの監視方法

ブラウザで `active/dashboard/admin-registry.html` にアクセスし、以下の項目を監視します。

1. **National KPI カード**:
   * 全国合計の稼働選挙区数、全国平均進捗、総エリア数、完了エリア数を一目で確認します。
2. **Region Analytics Summary**:
   * 都道府県ごとの進捗状況をチェックします。
3. **HQ Alerts Banner (赤色警告)**:
   * アラートが発生している場合、画面最上部にパルス発光バナーが表示されます。速やかに該当地区の「Spreadsheet」「Apps Script」リンクから状態を確認し、原因（OAuth の再承認など）を解消してください。
