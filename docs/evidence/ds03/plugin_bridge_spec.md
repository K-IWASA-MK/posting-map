# Plugin Bridge Specification (Phase 1)

本ドキュメントは、AIOS Canvas Automation Platform における **Plugin API Bridge インターフェースおよびプロトコル仕様** である。

---

## 🏛️ Layered Architecture (層状アーキテクチャ)

```
AI Agent Layer (Natural Language / Plan)
      │
      ▼
AIOS Execution Runtime (Audit Ledger & Policy Check)
      │
      ▼
Canvas Bridge Engine (Tool-Agnostic Core: ICanvasBridgeEngine)
      │
      ▼
FigmaPluginAdapter (Figma API Adapter)
      │
WebSocket / Message Queue (Protocol: bridge_protocol.json)
      │
      ▼
Figma Plugin Runtime (figma.createFrame(), figma.notify() etc.)
      │
      ▼
Figma Canvas
```

---

## 🔌 Protocol Header & Traceability
AIOS Execution Ledger での完全な追跡可能性を担保するため、すべての通信パケットに以下のヘッダーを必須とする：

* `ProtocolVersion`: `"1.0.0"`
* `RequestId`: 一意な命令ID
* `CorrelationId`: 関連トランザクションID
* `TraceId`: AIOS 全体でのトレーサビリティID (`traceId`)

---

## 🛑 Error Code Enum & Retry Control

* `NodeNotFound`: 指定された抽象ノードがキャンバス上に存在しない
* `PermissionDenied`: 書き込み権限不足
* `PluginUnavailable`: Figma Plugin Runtime が未起動または応答停止
* `CanvasLocked`: キャンバスノードがロック状態
* `Timeout`: 通信タイムアウト (デフォルト10,000ms)
* `ValidationFailed`: パラメータバリデーションエラー
* `TransactionRollback`: トランザクション処理の失敗とロールバック
* `BridgeDisconnected`: メッセージキュー通信切断
