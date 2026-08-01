# Specification: Headquarters Operations Platform

本仕様書は、全国 289 選挙区・支部に分散するポスティングの戦況データ・進行データを非同期並列で合算し、本部にリアルタイム戦術指標を提供する「Headquarters Operations Platform」の仕様を定義します。

---

## 1. Data Aggregation Pipeline (national-aggregator.js)

### 1.1. 接続モデル
* インデックスレジストリ（`registry.json`）に登録された稼働中地区（`status: READY`）に対して非同期並行で GET リクエストを投げ、データを取得します。
* エンドポイント: `[webAppUrl]?action=getAppData`

### 1.2. KPI 集約指標定義
* **総エリア数 ($A_{total}$)**:
  $$A_{total} = \sum_{i=1}^{N} A_i \quad (A_i \text{ は地区 } i \text{ の総エリア数})$$
* **完了エリア数 ($A_{completed}$)**:
  $$A_{completed} = \sum_{i=1}^{N} C_i \quad (C_i \text{ は地区 } i \text{ の進捗100\%以上のエリア数})$$
* **全国平均進捗率 ($P_{national}$)**:
  $$P_{national} = \frac{1}{N} \sum_{i=1}^{N} P_i \quad (P_i \text{ は地区 } i \text{ の平均進捗率})$$

### 1.3. 都道府県・ブロック集計 (Region Aggregation)
* 地区ID（例：`MIE-03`）の先頭3文字を取得し、地域別コードでグループ化。
* 三重県（`MIE`）、東京都（`TOK`）などの地域ごとに、地区数、総エリア数、平均進捗を統合。

---

## 2. Operational Alert Monitor (alert-monitor.js)

本エンジンは、各地区のインデックス情報から動作リスク要因を自動スキャンし、`alerts.json` に動的警告を保存します。

### 2.1. 警告トリガー定義

| 警告タイプ | 深刻度 | 発生条件 |
| :--- | :--- | :--- |
| **STATE_BLOCKED** | 🔴 CRITICAL | 地区の `status` が `BLOCKED` に遷移した場合（OAuth認可期限切れ、インフラ削除等） |
| **VERSION_MISMATCH**| 🟡 WARNING | `deployment.version` が推奨バージョン（v61）より古い場合 |
| **HEARTBEAT_LOST** | 🔴 CRITICAL | 最終ハートビート `lastHeartbeat` 記録から 12 時間以上通信が途絶した場合 |
