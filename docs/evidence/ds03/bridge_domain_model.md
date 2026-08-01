# Canvas Automation Platform: Bridge Domain Model Specification (Phase 0)

本ドキュメントは、AIOS (AI Operating System) における **Canvas Automation Platform** の抽象ドメインモデル（Ubiquitous Language）の仕様書である。

---

## 🏛️ Domain Model Entities & Value Objects

### 1. `CanvasSession`
* **責務**: AIOS Execution Runtime とデザインツール（Figma等）のプラグインランタイム間の接続セッション管理。
* **プロパティ**:
  * `sessionId`: UUIDv4
  * `toolAdapter`: `"FigmaPluginAdapter"` | `"CanvaAdapter"` | `"SketchAdapter"`
  * `status`: `"CONNECTED"` | `"DISCONNECTED"` | `"SUSPENDED"`
  * `createdAt`: ISO 8601 Timestamp
  * `lastHeartbeat`: ISO 8601 Timestamp

### 2. `CanvasCommand`
* **責務**: AIOS Agent から発行される抽象操作命令。
* **プロパティ**:
  * `commandId`: UUIDv4
  * `traceId`: UUIDv4 (AIOS Execution Ledger 連携用)
  * `correlationId`: UUIDv4
  * `action`: `"CREATE_NODE"` | `"UPDATE_NODE"` | `"DELETE_NODE"` | `"APPLY_LAYOUT"` | `"SET_VARIABLE"`
  * `targetRef`: Node ID または Selector
  * `payload`: 抽象モデル JSON

### 3. `CanvasEvent`
* **責務**: キャンバス上で発生した変更通知イベント。
* **プロパティ**:
  * `eventId`: UUIDv4
  * `eventType`: `"NODE_CREATED"` | `"SELECTION_CHANGED"` | `"CANVAS_SAVED"` | `"TRANSACTION_COMMITTED"`
  * `timestamp`: ISO 8601 Timestamp

### 4. `CanvasNode`
* **責務**: 特定ツールの描画オブジェクト（Figma Frame/Rectangle等）を抽象化したモデル。
* **プロパティ**:
  * `id`: 抽象 Node ID
  * `type`: `"FRAME"` | `"RECTANGLE"` | `"TEXT"` | `"COMPONENT"` | `"INSTANCE"`
  * `name`: レヤー名 (例: `Frame_Header`)
  * `bounds`: `{ x, y, width, height }`
  * `style`: `{ fill, stroke, cornerRadius }`
  * `layout`: `{ autoLayoutMode, padding, gap }`

### 5. `CanvasSelection`
* **責務**: 現在キャンバス上でフォーカスされているノード集合。

### 6. `CanvasTransaction`
* **責務**: 複数の `CanvasCommand` をアトミック（全成功またはロールバック）に実行する変更単位。

### 7. `CanvasError`
* **責務**: 全ツール共通の統一構造化エラー表現。

### 8. `CanvasCapability`
* **責務**: 各ツールアダプター（FigmaAdapter等）が提供可能な抽象機能の定義。
