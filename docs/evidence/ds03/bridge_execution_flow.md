# Bridge Execution Flow Specification (Phase 3)

本ドキュメントは、AIOS Canvas Automation Platform における **メッセージキュー・非同期実行制御・トランザクションフロー仕様書** である。

---

## ⚡ Execution Flow Control & Reliability

### 1. Request Lifecycle
1. **Command Generation**: AI Agent が抽象モデル `CanvasCommand` を生成。
2. **AIOS Ledger Registration**: `traceId` を発番し、AIOS 実行台帳 (Execution Ledger) に記録。
3. **Adapter Translation**: `FigmaPluginAdapter` が抽象コマンドを `figma.createFrame()` などの命令へ変換。
4. **Queue Push & Dispatch**: メッセージキュー経由で Figma Plugin Runtime へ送信。
5. **Atomic Execution**: プラグイン側でノード生成・レイアウト設定を一括適用。失敗時は `TransactionRollback` を発生。
6. **Result Verification**: レスポンスを Bridge Core へ返し、AIOS 台帳へ結果を最終書き込み。

---

## 🛡️ Reliability & Heartbeat Policy
* **Heartbeat Interval**: 5,000ms ごとに `Ping/Pong` パケットを送信。切断時はステータスを `SUSPENDED` へ移行。
* **Timeout & Retry Policy**:
  * タイムアウト閾値: 10,000ms
  * 最大再試行回数: 3回
  * バックオフ間隔: `1000ms * (2 ^ attempt)`
