# Gap Analysis Report (Sprint DS-01)

## 1. 概要 (Overview)

本レポートは、Figma Dev Mode のみを閲覧・取得用インターフェースとして使用した場合の限界および技術的ギャップを特定し、今後のスプリント（Sprint DS-02 〜 DS-04）で導入が必要となる技術コンポーネント（Variables REST API、Figma Plugin API、MCP）との機能比較をまとめた分析報告書です。

---

## 2. 領域別ギャップ分析 (Gap Matrix)

| 機能領域 | Dev Mode 単体（DS-01）の限界 | ギャップの理由 | 解決策となる将来テクノロジー | 導入予定スプリント |
|---|---|---|---|:---:|
| **トークンの自動同期** | 手動でDev Modeの数値を転記する必要がある | Dev Modeは閲覧用であり、ファイル外部へのプッシュ/フック機能がない | **Figma Variables REST API** (CI/CD連携) | **Sprint DS-02** |
| **キャンバスの自動編集** | AIがFigma上にFrameやNodeを描画・レイアウトできない | REST APIもDev Modeもキャンバス書き換え権限を持たない | **Figma Plugin API** (WebSocket Bridge) | **Sprint DS-03** |
| **自動レイアウト生成** | Figma上の Auto Layout 構造を直接手作業で構築する必要がある | キャンバス操作APIが未接続 | **Figma Plugin Bridge + MCP** | **Sprint DS-03** |
| **コンポーネント自動生成** | バリアント作成やコンポーネントセットのプロパティ紐付けが手動 | キャンバス操作APIが未接続 | **Figma Plugin Bridge + MCP** | **Sprint DS-03 / DS-04** |
| **自然言語によるデザイン操作** | チャットからの「ボタンの色を変えて」などの操作がキャンバスへ直接伝播しない | AIエージェントとFigmaキャンバスの双方向接続が未確立 | **Figma MCP Server + AI Automation** | **Sprint DS-04** |

---

## 3. 次フェーズへの技術的ロードマップ (Roadmap Recommendations)

### 1. Sprint DS-02: Variables Sync Foundation
* **目標**: `POST /v1/files/:file_key/variables` (Variables REST API) を利用し、`design-tokens.json` の変更を Figma の Variables へ全自動で書き込み・同期させる。

### 2. Sprint DS-03: Plugin Bridge Foundation
* **目標**: Figma Plugin API と WebSocket 通信を行うローカル Bridge サーバーを構築し、AIエージェント（Flash）から Figma キャンバス上へノードを描画・操作可能にする。

### 3. Sprint DS-04: AI Design Automation
* **目標**: Figma MCP Server と AI エージェントを組み合わせ、自然言語指示からコンポーネント生成・レイアウト調整・Dev Modeコード出力を一気通貫で自動化する。
