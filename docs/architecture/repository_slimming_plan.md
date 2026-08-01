# Repository Slimming Plan

**Document Version**: 1.0.0  
**Status**: APPROVED  
**Scope**: Project Root (`/Volumes/SSD_DATA/AI Development OS/projects/posting-map`)  
**Execution Mode**: READ ONLY DESIGN MODE (Code Modifications: 0)  

---

## 1. Repository Vision

本ドキュメントは、POSTING MAP を AIOS（AI Operating System）から完全に独立させ、保守性・透明性・商品価値の極めて高い単独商品リポジトリとして再構築するための設計仕様書です。

### 理念
1. **Single Purpose**: 本リポジトリの目的は「ポスティングマップアプリおよびダッシュボードの開発・デプロイ・保守」のみとする。
2. **Zero AIOS Coupling**: AIOS 関連のランタイム、エージェント定義、ナレッジ、調停機構への直接依存を完全に排除する。
3. **Strict Top-Level Structure**: トップレベルディレクトリは最小限に抑え、無秩序な拡張を永久に禁止する。

---

## 2. Final Repository Structure

スリム化後の POSTING MAP リポジトリのターゲットフォルダ構成です。

```
posting-map/
│
├── .agents/                   ← エージェント開発ガイドライン・ルール
├── .agent-artifacts/          ← エージェント開発履歴・中間成果物
│
├── active/                    ← 唯一の本番コード（clasp deploy 対象）
│   ├── platform/              ← 入口レイヤー (Wave-1)
│   ├── runtime/               ← ランタイム基盤 (Wave-2)
│   ├── infrastructure/        ← インフラアダプター (Wave-3)
│   ├── framework/             ← フレームワーク層 (Wave-4)
│   ├── business/              ← ビジネスロジック層 (Wave-5)
│   ├── dashboard/             ← Web / LIFF ダッシュボード UI
│   └── gas/                   ← GAS 互換コア関数群
│
├── data/                      ← マスターデータ (SSOT)
│   └── spatial/               ← 地図・GeoJSON・空間検証データ集約領域
│
├── docs/                      ← ドキュメント（設計・監査・仕様）
│   ├── adr/                   ← アーキテクチャ決定記録
│   ├── architecture/          ← アーキテクチャ設計書
│   ├── audit/                 ← 監査レポート
│   └── evidence/              ← 実機検証証跡
│
├── scripts/                   ← 開発・検証・運用スクリプト
├── tests/                     ← テストコード・テストランナー
│
├── .clasp.json                ← clasp 接続設定 (MIE-03)
├── .claspignore               ← clasp デプロイ除外定義
├── appsscript.json            ← GAS マニフェスト
├── package.json               ← npm 設定
├── AGENTS.md                  ← プロジェクト開発・運用ルール
└── DEPLOYMENT_REGISTRY.md     ← デプロイ環境レジストリ
```

**トップレベル項目数: 13 個（主要ディレクトリ 7 + 基本設定ファイル 6）**

---

## 2.1 Production Asset Lock (本番資産ロック宣言)

本スプリント（SM-2）において確定した以下のリストを **Production Essential (本番必須資産)** としてロック宣言します。**SM-6 (Repository Freeze) 完了まで、以下のファイル・ディレクトリの削除、名称変更、および本番リポジトリ外への移動を厳禁**とします。

### 🔒 ロック対象アセット一覧 (Immutable Production Assets)
1. **`active/`** — 唯一の本番コードベース（GAS `clasp push` 対象）
2. **`data/`** — マスターデータ (`MIE03_ADDRESS_MASTER.csv` SSOT)
3. **`docs/`** — アーキテクチャ設計・監査・仕様ドキュメント
4. **`scripts/`** — 開発・検証・運用スクリプト
5. **`tests/`** — テストコードおよびテストランナー
6. **`AGENTS.md`** — プロジェクト開発・ガバナンスルール
7. **`DEPLOYMENT_REGISTRY.md`** — 本番環境デプロイメント ID レジストリ
8. **`package.json`** — Node.js / npm 依存パッケージ定義
9. **`appsscript.json`** — GAS マニフェスト設定
10. **`.clasp.json`** — clasp 本番接続設定
11. **`.claspignore`** — clasp アップロード除外設定

> [!CAUTION]
> **Lock Enforcement Policy**
> - SM-3 (AIOS Separation) および SM-5 (Cleanup) の実行時において、上記 11 アセットは分離・削除操作の対象から 100% 除外されます。
> - 分離対象 (AIOS) および不要残骸 (Debris) との上記ロック資産の混同・誤削除をシステムレベルで防止します。

---

## 3. Asset Classification Matrix

SM-1 監査結果に基づく、全既存アセットの最終分類マトリックスです。

| 分類カテゴリ | 対象資産 | 処理方針 | 理由・根拠 |
| :--- | :--- | :--- | :--- |
| **Category A: Production Assets** | `active/`, `data/`, `docs/`, `scripts/`, `tests/`, `.clasp.json`, `.claspignore`, `appsscript.json`, `package.json`, `AGENTS.md`, `DEPLOYMENT_REGISTRY.md` | **保全 (Keep)** | 本番稼働、SSOT、デプロイ、開発規則に直結する必須資産 |
| **Category B: AIOS Separation Targets** | `agents/`, `AI社員/`, `skills/`, `knowledge/`, `AI_WORKFORCE_CONSTITUTION_v*.md`, `CLAUDE.md`, `GPT.md`, `HANDOVER.md`, `aios-manifest.json`, `deployment.json`, `project.json`, `v2_api.js` 内 AIOS Bridge (430行) | **移管 / 除去 (Separate)** | AIOS 専用基盤資産。POSTING MAP の実行および開発に不要 |
| **Category C: Historical Debris** | `development/`, `scratch/`, `temp/`, `deprecated/`, `legacy/`, `active_backup/`, `*.bak`, `*.zip` | **削除 (Cleanup)** | 開発過程の使い捨てスクリプト・一次生成物・古バックアップ |
| **Category D: Structure Consolidation** | `app/`, `field/`, `dashboard/`, `src/`, `reference/`, `spatial/`, `exports/`, `plugin/`, `FIELD_OPERATIONS_PLATFORM/`, `UI_RESEARCH/` | **統合 / 解体 (Consolidate)** | 二重構造の原因。`active/` または `data/` へ統合・整理 |

---

## 4. AIOS Separation Boundary

AIOS と POSTING MAP の分離境界の具体策です。

### 1. 物理ファイル分離 (FileSystem Separation)
- `agents/`, `AI社員/`, `skills/`, `knowledge/` および各種マニフェスト・憲法ドキュメントは、別リポジトリ `aios/` へ完全移管または除外します。

### 2. ソースコード分離 (Source Code Separation)
- `active/api/v2_api.js` 内に存在する L3453〜L3884 の AIOS Bridge クラス群（約 430 行）を完全削除します。
- `active/runtime/config/config_provider.js` 内の `aiosBridge` 関連フラグ定義を削除します。
- 業務機能（`submitDistribution`, `registerStaff` 等）は一切 AIOS を呼び出さず、純粋な GAS / JS モジュールとして動作させます。

---

## 5. Structure Consolidation Policy

トップレベルに散在する過去アプリ・素材の整理方針です。

1. **`app/`, `field/`, `dashboard/`, `legacy/`**:
   - `active/dashboard/` および `active/business/` への機能移植完了を確認の上、廃止・削除。
2. **`src/` (TS 版)**:
   - `active/` (JS 5-Layer) への移植完了を確認の上、廃止・削除。
3. **`reference/`, `spatial/`**:
   - `reference/` 内のマスターデータ (CSV) および `spatial/` 内の GeoJSON/KML は、`data/` および `data/spatial/` へ集約。
4. **`exports/`, `UI_RESEARCH/`, `plugin/`**:
   - 不要な出力成果物は削除。必要ツールは `scripts/` または独立ツールリポジトリへ配置。

---

## 6. Repository Governance

今後のリポジトリのクリーン度と健全性を維持するための統治規則です。

### Principle-1: Single Source of Execution
`active/` ディレクトリのみを唯一の本番ソースコードおよび `clasp push` 対象とする。

### Principle-2: Single Source of Data
`data/` ディレクトリのみをマスターデータ（SSOT）および空間データの保管場所とする。

### Principle-3: Single Source of Documentation
`docs/` ディレクトリのみを設計書・監査レポート・仕様書の保管場所とする。

### Principle-4: Zero AIOS Contamination
AIOS 関連のコード、設定、エージェント定義、憲法ドキュメントを POSTING MAP リポジトリ内に混入させることを永久に禁止する。

---

### 🛡️ Repository Boundary Rule (責務明確化規則)

#### POSTING MAP に含めるもの (Allowed Assets)
- 商品ソースコード (`active/`)
- 商品マスターデータ (`data/`)
- 商品ドキュメントおよび仕様書 (`docs/`)
- テストコードおよび検証スクリプト (`tests/`, `scripts/`)
- デプロイおよびビルド設定 (`.clasp.json`, `package.json` 等)

#### POSTING MAP に含めないもの (Forbidden Assets)
- AIOS Runtime / Bridge 基盤
- AI Agent Runtime / Agent 定義
- AI Workforce / AI 社員定義
- AI Governance / AI 憲法ドキュメント
- AI Knowledge Base / AIOS スキル定義
- AI Orchestration / タスクルーティング基盤
- 汎用 AI プラットフォーム資産

---

### 🚪 Repository Admission Rule (新規フォルダ配置規則)

新しいディレクトリを追加しようとする場合、以下の昇格順序を必ず検証しなければならない。

1. **`active/` 配下へ追加できないか？** （本番機能・ロジック・画面の場合）
2. **`data/` 配下へ追加できないか？** （データファイル・空間データの場合）
3. **`docs/` 配下へ追加できないか？** （ドキュメント・仕様・レポートの場合）
4. **`scripts/` 配下へ追加できないか？** （開発・運用スクリプトの場合）
5. **`tests/` 配下へ追加できないか？** （テスト関連の場合）

上記 1〜5 のいずれにも配置できないことが証明され、かつ **Architecture Review** で明示的に承認された場合のみ、トップレベルディレクトリの新規追加を許可する。

---

## 7. Repository Slimming Success Criteria

Sprint SM-2〜SM-6 の完了を判定する定量・定性成功基準です。

1. **構造収束**: トップレベルディレクトリが設計どおりの 7 ディレクトリ (`active`, `data`, `docs`, `scripts`, `tests`, `.agents`, `.agent-artifacts`) へ完全収束していること。
2. **AIOS 完全分離**: AIOS 分離対象アセット (Category B) が POSTING MAP リポジトリから 100% 分離・削除されていること。
3. **本番資産 100% 保全**: Production Assets (Category A) が欠損なく保全され、`clasp deploy` および本番動作が 100% 正常であること。
4. **重複構造 100% マッピング**: `app/`, `field/`, `src/` 等の重複構造がすべて整理・統合完了していること。
5. **移行順序の確定**: SM-3〜SM-6 の移行ロードマップが明確に合意されていること。

---

## 8. Migration Roadmap (SM-3〜SM-6)

今後の実行ロードマップです。

```
Sprint SM-3: AIOS Separation Plan
  ├── v2_api.js 内 AIOS Bridge コード (430行) 削除計画の策定
  └── AIOS 資産 (agents/, skills/, knowledge/ 等) の分離手順策定

Sprint SM-4: Clean Repository Migration
  ├── AIOS 資産の別リポジトリ aios/ への移管および抽出
  └── POSTING MAP の独立リポジトリ化

Sprint SM-5: Production Cleanup
  └── 不要資産 (development/, scratch/, temp/, deprecated/, legacy/ 等) の一括削除

Sprint SM-6: Repository Freeze
  └── Repository Structure v1.0 宣言 & 構造変更の完全凍結

Sprint SM-7: Phase 2 Resume
  └── P2-11D Area Domain Service の実装再開
```

---

## 9. Verification Plan

### READ ONLY Verification
- ソースコード変更数：0件
- ファイル削除数：0件
- ファイル移動数：0件
- Git / clasp 操作：0件
- 本ドキュメント `docs/architecture/repository_slimming_plan.md` の新規作成のみ確認。
