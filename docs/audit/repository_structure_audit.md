# Repository Structure Audit

**Date**: 2026-08-01  
**Audit Mode**: READ ONLY Fact Inspection Mode  
**Scope**: Project Root (`/Volumes/SSD_DATA/AI Development OS/projects/posting-map`)  
**Code Modifications**: 0 Files  

---

## 1. Audit Scope & Summary

本レポートは、AIOS と POSTING MAP の完全分離および商品開発専用リポジトリ構造への再構築（Phase 3: Structure Management）における事前事実監査結果を記録したドキュメントです。

### 監査サマリー
- **総ファイル数 / ディレクトリ数**: 1,575 ファイル / 399 ディレクトリ（`node_modules`, `.git` 除外）
- **ルート直下ディレクトリ数**: 38 個
- **プロジェクトサイズ**: 59 MB
- **結論**: `active/` を中心とする本番稼働に必要なアセットは全体の **約 4〜8%** であり、残りの **90% 以上** は AIOS 連携資産、開発試行の残骸、および重複構造です。

---

## 2. Repository Inventory & Categorization

全 38 ディレクトリおよびルート直下ファイルを 5 つのカテゴリに確定分類しました。

```
Category A: Production Essential            (本番必須 / clasp push 対象 / SSOT)
Category B: Agent Development Infrastructure (エージェント開発環境 / ルール定義)
Category C: AIOS Separation Target           (AIOS 分離・移管対象)
Category D: Historical / Temporary Assets    (開発残骸 / 削除・アーカイブ対象)
Category E: Application Boundary Audit       (過去アプリ・重複構造・研究資産)
```

---

## 3. Production Essential Assets (Category A)

本番環境 (GAS デプロイ / MIE-03 実機稼働) の維持に 100% 必須のアセット一覧です。**削除・変更は厳禁**です。

| ディレクトリ / ファイル | 用途 | 備考 |
| :--- | :--- | :--- |
| **`active/`** | 5-Layer Architecture 本番ソースコード | `clasp push` の唯一の送信対象 |
| **`active/api/`** | `v2_api.js` (Facade / 入口), `AssetRegistry.js` | API エンドポイント |
| **`active/platform/`** | HTTP Entry (`get_entry.js`, `post_entry.js`) | 入口分離レイヤー (Wave-1) |
| **`active/runtime/`** | ExecutionContext, ConfigProvider, Lifecycle | ランタイム層 (Wave-2) |
| **`active/infrastructure/`** | Spreadsheet, Drive, Lock, Cache Adapters | インフラ層 (Wave-3) |
| **`active/framework/`** | Router, Pipeline, Validator, ResponseBuilder | フレームワーク層 (Wave-4) |
| **`active/business/`** | `staff/`, `distribution/` モジュール | ビジネスロジック層 (Wave-5) |
| **`active/dashboard/`** | LIFF / Web ダッシュボード HTML・JS 群 | HTML サービス描画対象 |
| **`active/gas/`** | GAS 互換レイヤー (`v2_core.js`, `v2_kernel.js` 等) | レガシーコア関数群 |
| **`data/`** | `MIE03_ADDRESS_MASTER_858.csv` (859行) | 住所マスターデータ SSOT |
| **`.clasp.json`** / **`.clasp.mie03.json`** | clasp プロジェクト接続設定 | MIE-03 デプロイ必須 |
| **`.claspignore`** | clasp アップロード除外定義 | |
| **`appsscript.json`** | GAS プロジェクトマニフェスト | |
| **`package.json`** | Node.js / npm 依存パッケージ定義 | |
| **`DEPLOYMENT_REGISTRY.md`** | 各環境 (MIE-03等) デプロイ ID レジストリ | AGENTS.md 参照必須 |
| **`AGENTS.md`** (ルート) | GAS SOP / SSOT 厳守開発規則 | プロジェクトガバナンス |

---

## 4. Agent Development Infrastructure (Category B)

AI エージェントによる開発を継続するために必要なインフラ・設定ファイルです。**AIOS から独立させた POSTING MAP 専用資産**として保持します。

| ディレクトリ / ファイル | 用途 | 保全理由 |
| :--- | :--- | :--- |
| **`.agents/`** | プロジェクト固有ルール (`AGENTS.md` 等) | エージェントのガバナンス維持 |
| **`.agent-artifacts/`** | エージェントの作業成果物・履歴保存領域 | 開発コンテキストの保持 |
| **`templates/`** | 画面・ドキュメントの基本テンプレート (`golden_splash.html`) | 開発効率化 |

---

## 5. AIOS Separation Targets (Category C)

AIOS 固有のマルチエージェント基盤定義および不要となった関連構成物です。**新リポジトリ `aios/` への移管、または削除対象**とします。

### ルート直下フォルダ・ファイル

| 対象 | 内容 | 分離理由 |
| :--- | :--- | :--- |
| **`agents/`** | 12 ドメインの AI エージェント定義 | AIOS マルチエージェント専用 |
| **`AI社員/`** | AI 社員ロール定義 | AIOS 専用 |
| **`skills/`** | 5 つの AIOS スキル定義 | AIOS 専用 |
| **`knowledge/`** | AIOS ナレッジベース | AIOS 専用 |
| **`AI_WORKFORCE_CONSTITUTION_v*.md`** | AI 社員憲法 (v1.0〜v1.6.0 の 7 ファイル) | AIOS 専用 |
| **`CLAUDE.md`** / **`GPT.md`** | 旧モデル別プロンプト設定 | AIOS 専用 |
| **`HANDOVER.md`** | 過去の AIOS 引継ぎ文書 (25KB) | AIOS 専用 |
| **`aios-manifest.json`** | AIOS マニフェスト | AIOS 専用 |
| **`deployment.json`** / **`project.json`** | AIOS 連携用プロパティ | AIOS 専用 |

### ソースコード内デッドコード (`active/`)

| ファイル | 対象範囲 | 内容 | 状態 |
| :--- | :--- | :--- | :--- |
| **`active/api/v2_api.js`** | L3453〜L3884 (約430行) | `AIOSBridgePipeline`, `AIOSBridgeProvider`, `MockAIOSClient` 等 | **100% デッドコード** (`aiosBridge: false` で固定) |
| **`active/runtime/config/config_provider.js`** | L56, L74, L87, L105 | `aiosBridge`, `bridgeProvider`, `bridgeMode` フラグ | 未使用フラグ |
| **`active/api/AssetRegistry.js`** | L3 コメント | `Static workspace locator for AIOS Core` | ヘッダーコメントのみ |

---

## 6. Historical & Temporary Debris Inventory (Category D)

開発過程で発生した一次ファイル、過去の検証スクリプト、バックアップ群です。**本番動作には一切関与せず、削除対象**とします。

| 対象 | ファイル数 / サイズ | 削除理由 |
| :--- | :--- | :--- |
| **`development/`** | 56 ファイル | 一度きりの環境構築・検証用使い捨てスクリプト群 |
| **`scratch/`** | 20 ファイル | 一時デバッグスクリプトおよびテキスト出力 |
| **`temp/`** | 10 ファイル | clasp テンポラリおよび一時検証 TS ファイル |
| **`deprecated/`** | 2 ディレクトリ | 非推奨コード群 |
| **`legacy/`** | 3 ファイル | 旧 `admin-app` / `manager.html` (48KB) / `stock.html` |
| **`active_backup/`** | ディレクトリ | 旧 active バックアップ (Git で履歴保持済み) |
| **`v2_api.js.bak`** | 170 KB | 旧 v2_api.js 単体バックアップ |
| **`*.bak`** (`.clasp.json.bak` 等) | 3 ファイル | clasp 設定バックアップ |
| **`posting-map-system-runtime-foundation-v4.31.zip`** | 6.7 MB | プロジェクト内保管の不要 zip アーカイブ |

---

## 7. Duplicate / Overlapping Structure Analysis (Category E)

ルート直下に機能別に散乱しているディレクトリの分析と、`active/` への移行状況の評価です。

| ディレクトリ | 内容 | 分析結果・推奨アクション |
| :--- | :--- | :--- |
| **`app/`** | LIFF UI プロトタイプ (64KB JS 含む) | `active/dashboard/` に基本機能移管済み。過去プロトタイプ資産。 |
| **`field/`** | 旧型現場アプリ (47KB JS 含む) | `app/` と並列の過去アプリ。`active/` への移植完了確認済み。 |
| **`dashboard/`** | 旧ダッシュボード HTML/JS (22KB) | `active/dashboard/` に完全移行済み。 |
| **`apps/posting-map-generator`** | スタンドアロンジェネレーター | サブアプリケーション。必要に応じ別リポジトリまたは `tools/` へ。 |
| **`src/`** | TS 版アーキテクチャ (15 サブディレクトリ) | `active/` (JS 版) への移植完了。二重構造の原因。 |
| **`reference/`** | 郵便番号 CSV 等 (12MB+) | 参照マスターデータ。`data/` へ集約推奨。 |
| **`spatial/`** | GeoJSON / KML / KML 画像 (1MB+) | 空間データ。`data/spatial/` または `data/` へ集約推奨。 |
| **`exports/`** | テスト出力 JSON/HTML/CSV | 一時エクスポート成果物。`temp/` と同様削除可。 |
| **`plugin/`** | Figma プラグイン (6 ファイル) | Figma デザイン連携ツール。独立ツール。 |
| **`FIELD_OPERATIONS_PLATFORM/`** | 運用プラットフォーム構想 (8 ディレクトリ) | ドキュメント・ディレクトリフレームのみ。 |
| **`UI_RESEARCH/`** | UI リサーチ用 HTML/CSS | デザイン検討一次資料。 |
| **`scripts/`** | テスト・検証スクリプト (19 ファイル) | 必要な検証ランナー (`test-post.js` 等) のみ整理して保持。 |
| **`validation/`** | 空間検証結果 HTML/JSON | 重大検証結果。`docs/evidence/` 等へ移管。 |

---

## 8. Active Dependency Confirmation

`active/` (本番コード) が `active/` 外のファイルにどのような依存を持っているか確認結果です。

1. **`data/MIE03_ADDRESS_MASTER_858.csv`**: **依存あり** (`AGENTS.md` にて SSOT 指定。本番・開発ともに必須)。
2. **`.clasp.mie03.json`**: **依存あり** (`.clasp.json` 同期元としてデプロイ時必須)。
3. **その他ルート直下の全ディレクトリ (`app/`, `field/`, `development/`, `src/`, `agents/` 等)**: **依存ゼロ**。
   - `active/` 内のコードはこれらを一切 `require` または参照していません。

---

## 9. Migration Risk Assessment

AIOS 分離およびリポジトリスリム化におけるリスク評価：

- **GAS デプロイへの影響**: **ゼロ** (`clasp push` は `active/` 配下および `.claspignore` 設定にのみ従うため、ルート直下の不要ファイル削除によるデプロイ障害リスクはありません)。
- **本番動作への影響**: **ゼロ** (`v2_api.js` 内の AIOS Bridge 430 行は元々実行されないデッドコードであり、削除しても互換性・実行速度・メモリ消費すべてに改善をもたらします)。
- **データリスク**: `data/MIE03_ADDRESS_MASTER_858.csv` は SSOT として厳重に保護されるためデータ損失リスクはありません。

---

## 10. SM-2〜SM-5 Execution Roadmap

本 SM-1 監査結果に基づき、以下の順序で Structure Management を実行することを推奨します。

```
Sprint SM-2: Repository Slimming Plan
  ├── 最終フォルダ構成案（Target Directory Tree）の定義
  └── 移動・削除対象の完全マッピングリスト作成

Sprint SM-3: AIOS Separation Plan
  ├── v2_api.js 内 AIOS Bridge (430行) 削除計画
  └── AIOS 資産 (agents/, skills/, knowledge/ 等) の分離手順策定

Sprint SM-4: Clean Repository Migration
  ├── POSTING MAP 単独クリーンリポジトリの作成
  └── 移管検証

Sprint SM-5: Production Cleanup
  └── 不要資産 (development/, scratch/, temp/, *.bak 等) の最終削除

Sprint SM-6: Repository Freeze
  └── Repository Structure v1.0 宣言 & 構造凍結

Sprint SM-7: Phase 2 Resume
  └── P2-11D Area Domain Service の実装再開
```
