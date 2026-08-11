# Architecture Improvement Strategy: `active/api/v2_api.js`

- **Version**: 1.0 (Phase 2 Strategy Approved)
- **Date**: 2026-08-01
- **Status**: SSOT (Architecture Governance Document)
- **Target File**: `active/api/v2_api.js` (5,235 lines / 66 Sections: `SEC-001` ~ `SEC-066`)
- **Evidence Base**: Phase 1 Architecture Audit (`docs/audit/*`)

---

## 1. Executive Summary & Improvement Scope

### 1.1 Purpose
本ドキュメントは、Phase 1 で確立した監査結果（SSOT）を唯一の根拠とし、単一ファイル内に肥大化した `active/api/v2_api.js` (5,235行) を、長期運用に耐えうる拡張性・保守性・安全性を備えたマルチモジュール構造へ安全に移行するための**アーキテクチャ改善戦略**を定義する。

### 1.2 Target Scope
- **対象ファイル**: `active/api/v2_api.js`
- **対象構造**: `SEC-001` から `SEC-066` までの全 66 セクション
- **対象課題**: Phase 1 で抽出および正式採番された 7つの課題（`ISS-001` 〜 `ISS-007`）

### 1.3 Out of Scope
- 新機能の追加および既存レスポンス仕様の変更
- GAS（Google Apps Script）実行環境以外へのプラットフォーム移設
- クライアント側（LINE LIFF / フロントエンド UI）のインターフェース変更
- データベース・スプレッドシートの物理データ構造改変

### 1.4 Phase 2 Position & Roadmap
Phase 2 において、コード実装（`First Refactoring Sprint`）は設計と移行計画が完了した **P2-7** でのみ解禁される。「設計が先、実装は後」の原則を厳格に遵守する。

| Sprint | 名称 | コード変更 | 目的 |
|:---|:---|:---:|:---|
| **P2-1** | **Architecture Improvement Strategy** | ❌ | 改善原則・5レイヤー分離・禁止事項・品質ゲートの定義（本文書） |
| **P2-2** | **Refactoring Roadmap** | ❌ | 66セクションの移行順序および段階的分割ロードマップ策定 |
| **P2-3** | **Target Architecture Blueprint** | ❌ | ターゲットとなる5レイヤーの詳細インターフェース・クラス設計 |
| **P2-4** | **Migration Strategy** | ❌ | Strangler Fig パターンに基づく新旧共存・切り替え戦略の策定 |
| **P2-5** | **Validation Strategy** | ❌ | 回帰テスト・品質検証プロトコルおよび自動化検証手順の確立 |
| **P2-6** | **Sprint Implementation Plan** | ❌ | P2-7 以降の個別の実装スプリント計画の策定 |
| **P2-7** | **First Refactoring Sprint** | ✅ | 最初の責務モジュールのリファクタリング実行 |

---

## 2. Core Improvement Principles (Phase 2 開発憲法)

### 2.1 長期運用構造への改善唯一原則
> **「新機能の追加ではなく、長期運用できる構造への改善を唯一の目的とする。」**

コード変更の動機は「保守性向上」「凝集度向上」「結合度低減」「テスト容易性向上」に限定され、いかなる機能追加・暫定機能拡張も目的としてはならない。

### 2.2 Improvement Budget 憲法
1スプリントあたりの変更範囲を物理的に厳格制限し、巨大リグレッションや原因不明の障害発生を構造的に防ぐ。

```
1 Sprint  ➔  1 Responsibility  ➔  1 Folder  ➔  1 Validation
```

- **1 Sprint**: 1つのスプリントで扱うテーマは1つのみ。
- **1 Responsibility**: 1スプリントで移動・リファクタリングする責務は1つのみ。
- **1 Folder**: 改修対象の出力先モジュールフォルダは1つのみ。
- **1 Validation**: 単一の定義された検証ステップをパスして完了とする。
- 上記を超える広範囲・複数レイヤーにまたがる一括変更は**固く禁止**する。

---

## 3. 5-Layer Decomposition Policy (5大責務分離方針)

Phase 1 の監査結果（`docs/audit/framework_platform_mapping.md`, `business_domain_mapping.md` 等）に基づき、単一ファイル `v2_api.js` を以下の 5つの独立したレイヤーへ分離する。

```
┌─────────────────────────────────────────────────────────┐
│                      Platform Layer                     │  GAS Entry (doGet/doPost), Client I/F
└────────────────────────────┬────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────┐
│                      Framework Layer                    │  Routing Dispatcher, Pipeline, Response Builder
└────────────────────────────┬────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────┐
│                      Runtime Layer                      │  Stateless Context, CONFIG Resolver, Logger
└────────────────────────────┬────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────┐
│                     Business Layer                      │  Domain Services, Address/Posting Logic (GAS Pure)
└────────────────────────────┬────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────┐
│                   Infrastructure Layer                  │  Spreadsheet Adapter, External API Wrapper
└─────────────────────────────────────────────────────────┘
```

### 3.1 Business Layer (業務ドメイン層)
- **責務**: 地区マスター、配布記録、ユーザー権限、事業所情報などの業務純粋ロジック。
- **原則**: **GAS ネイティブ API (`SpreadsheetApp`, `DriveApp`, `UrlFetchApp`) の直接呼び出しを完全禁止**する。データアクセスは Infrastructure Layer のインターフェース経由でのみ行う。

### 3.2 Framework Layer (フレームワーク層)
- **責務**: ルーティング・ディスパッチ、多段パイプライン実行制御、標準レスポンスフォーマット整形、エラーハンドリング。
- **原則**: 特定の業務ドメイン知識を持たず、リクエストの受渡と制御フローのみを担当する。

### 3.3 Infrastructure Layer (インフラストラクチャ層)
- **責務**: `SpreadsheetApp` によるシートデータ読み書き、`DriveApp` によるファイル操作、`UrlFetchApp` による外部通信のアダプタ実装。
- **原則**: 外部依存をカプセル化し、Business Layer へ抽象データ操作インターフェースを提供する。

### 3.4 Runtime Layer (ランタイム層)
- **責務**: GAS のステートレス実行環境における設定 (`CONFIG`) リゾルバ、リクエストごとの実行コンテキスト管理、システムログ出力。
- **原則**: グローバル状態への直接アクセスを抑止し、安全な依存注入とライフサイクル管理を行う。

### 3.5 Platform Layer (プラットフォーム層)
- **責務**: GAS のエントリーポイント (`doGet`, `doPost`)、Web App レスポンス返却、LINE/LIFF やクライアントからのリクエスト受信口。
- **原則**: 薄いエントリーポイントとして機能し、即座に Framework Layer のディスパッチャーへ処理を委譲する。

---

## 4. Issue Mapping & Traceability (Issue 追跡性)

Phase 1 の監査成果物 (`docs/audit/architecture_issue_inventory.md`) で正式採番された Issue ID を**そのまま引用し、改変・再採番を一切行わない**。

| Issue ID | Category | 課題の定義 (Fact Based) | 影響レイヤー | 改善ターゲット方針 |
|:---|:---|:---|:---|:---|
| **ISS-001** | Routing | 3重ルーティングによるアクション定義の重複 (`registerStaff` 等) | Framework / Platform | Framework Layer のディスパッチレジストリへ一本化し、重複ルーティングを全廃 |
| **ISS-002** | Framework | 巨大単一ファイルへの責務集中とインフラ占有 (5,235行) | 全5レイヤー | 5大レイヤー構成のマルチファイル・モジュール構造へ物理分割 |
| **ISS-003** | Shared Infrastructure | 共有ユーティリティ `getSS()` への広範な密結合 (24セクション) | Business / Infrastructure | Infrastructure Layer の `SpreadsheetAdapter` にカプセル化し、呼び出しを置換 |
| **ISS-004** | Business | 業務ドメイン層の物理的な細切れ分断 (L677-1574 / L2229-2429) | Business | 業務ドメイン配下に同一バウンダリとして統合配置 |
| **ISS-005** | External Dependency | 外部 API (`DriveApp`, `UrlFetchApp`) への直接結合 | Business / Infrastructure | Infrastructure Layer に `DriveApiWrapper`, `ExternalHttpAdapter` を設置 |
| **ISS-006** | Runtime | サーバーレス環境での共有状態リセットと IO 偏重 (`CONFIG` アクセス31箇所) | Runtime / Infrastructure | Runtime Layer の `ConfigResolver` によるキャッシュおよびコンテキスト注入で最適化 |
| **ISS-007** | Framework | 多段パイプラインのハードコード順序と状態結合 (`Context` 依存) | Framework / Runtime | Framework Layer の `PipelineExecutor` による明示的インターフェース化 |

---

## 5. SSOT (Single Source of Truth) Architecture

Phase 2 のすべての設計および実装判定は、以下の SSOT を絶対の根拠として実行される。

```
                    ┌──────────────────────────────────────────┐
                    │        Data Domain Master SSOT           │
                    │  data/MIE03_ADDRESS_MASTER_858.csv (858件)   │
                    └────────────────────┬─────────────────────┘
                                         │
┌────────────────────────────────────────┼────────────────────────────────────────┐
│                                        │                                        │
│  ┌──────────────────────────────────┐  │  ┌──────────────────────────────────┐  │
│  │     Framework Specs SSOT         │  │  │   Infrastructure Storage SSOT    │  │
│  │   docs/audit/entry_point_        │  │  │     docs/audit/shared_         │  │
│  │   routing_mapping.md             │  │  │     infrastructure_analysis.md   │  │
│  └──────────────────────────────────┘  │  └──────────────────────────────────┘  │
│                                        │                                        │
│  ┌──────────────────────────────────┐  │  ┌──────────────────────────────────┐  │
│  │     Business Domain SSOT         │  │  │     Deployment Registry SSOT     │  │
│  │   docs/audit/business_           │  │  │   DEPLOYMENT_REGISTRY.md /       │  │
│  │   domain_mapping.md              │  │  │   AGENTS.md                      │  │
│  └──────────────────────────────────┘  │  └──────────────────────────────────┘  │
└────────────────────────────────────────┴────────────────────────────────────────┘
```

1. **Data Domain Master SSOT**: `data/MIE03_ADDRESS_MASTER_858.csv` (実データ858件 + ヘッダー1行 = 計859行)
2. **Business Domain SSOT**: `docs/audit/business_domain_mapping.md`
3. **Framework Specs SSOT**: `docs/audit/entry_point_routing_mapping.md`
4. **Infrastructure Storage SSOT**: `docs/audit/shared_infrastructure_analysis.md`
5. **Deployment Registry SSOT**: `DEPLOYMENT_REGISTRY.md` および `AGENTS.md` (デプロイメントID・Web App URL・Script ID管理)

---

## 6. Migration & Strangler Fig Policy (移行・共存方針)

リファクタリングに伴う運用リスクおよび稼働障害を防止するため、**Strangler Fig パターン**を全面適用する。

### 6.1 一括置換の禁止 (No Big Bang Migration)
- 5,235行の既存コードを一度に書き換える一括置換（Big Bang Migration）を**固く禁止**する。
- 1スプリントにつき1つの定義されたモジュールのみを段階的に新アーキテクチャへ移行する。

### 6.2 旧実装と新実装の一定期間の共存許可
- 移行期間中、旧実装（`v2_api.js` 内の既存関数）と新実装（新レイヤーモジュール）が**一定期間共存することを正当な状態として許可**する。
- ルーティングディスパッチャーが、移行済みアクションは新モジュールへ、未移行アクションは旧関数へ振り分けるファサード構造をとることで、段階的移行を安全に実現する。

---

## 7. Prohibited Practices (禁止事項)

Phase 2 の開発において、以下の行為はアーキテクチャガバナンス違反として厳重に禁止される。

| 禁止事項 | 内容と禁止の理由 |
|:---|:---|
| **1. 巨大ファイルの再生産禁止** | 分割後のファイルにおいても単一ファイルへのコード集中を禁止する。1モジュールは単一の責務のみを持つ。 |
| **2. Business層からのGAS API直接呼び出し禁止** | Business Layer から `SpreadsheetApp`, `DriveApp`, `UrlFetchApp` 等の GAS ネイティブ API を直接呼び出すことを禁止する。 |
| **3. Utility 肥大化の禁止** | `util.js` や `common.js` といった抽象的な名称のファイルを作成し、雑多なロジックを溜め込むことを禁止する。 |
| **4. Routing 重複定義の禁止** | 同一アクションに対するルーティングロジックが複数の関数や条件分岐に重複して存在することを禁止する。 |
| **5. Temporary Architecture 禁止** | 「仮設実装」「TODOコメントでの放置」「あとで直すための暫定ロジック」をコード内に埋め込み恒常化させることを禁止する。 |
| **6. Architecture Drift 禁止** | Phase 2（本ドキュメント）で確定した 5レイヤーの責務境界や命名規則を、開発スプリントごとに独断で変更・拡張することを禁止する。 |

---

## 8. Quality Gates & Verification Protocols (品質ゲートと検証規約)

### 8.1 開発スプリント品質ゲートフロー
各スプリント（P2-7 以降）は、以下の品質ゲートフローを100%通過しなければならない。

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  1 Responsibility │ ➔ │ Design & Plan│ ➔ │ Review Ask   │
│  Selection   │     │ Creation     │     │ Submission   │
└──────────────┘     └──────────────┘     └──────┬───────┘
                                                 │
┌──────────────┐     ┌──────────────┐     ┌──────▼───────┐
│ Walkthrough  │ ◄─  │ Sprint       │ ◄─  │ User         │
│ Approval     │     │ Execution    │     │ Approval     │
└──────────────┘     └──────────────┘     └──────────────┘
```

1. **1 Responsibility Selection**: 該当スプリントで変更する単一の責務を選択。
2. **Design & Plan Creation**: `implementation_plan.md` にて詳細設計を定義。
3. **Review Ask Submission**: ユーザーへレビュー・承認を依頼。
4. **User Approval (Proceed)**: ユーザーからの明示的な承認を獲得。
5. **Sprint Execution**: `Improvement Budget` の制約内でコード変更を実行。
6. **Walkthrough Submission**: `walkthrough.md` で結果と検証証拠を提示。

### 8.2 Strategy Document Validation Checklist (P2-1 専用検証リスト)

本 P2-1 スプリント（戦略設計）の完了条件となる検証チェックリスト：

- [x] **Phase 1 Issue ID との対応が 100% 維持されている** (`ISS-001` 〜 `ISS-007` の再採番なし継承)
- [x] **Layer 境界が Phase 1 監査結果と一致している** (Business, Framework, Infrastructure, Runtime, Platform の 5層定義)
- [x] **新しい責務境界を勝手に追加していない** (Phase 1 監査マトリクスを厳格準拠)
- [x] **Improvement Budget 違反が存在しない** (`1 Sprint` -> `1 Responsibility` -> `1 Folder` -> `1 Validation`)
- [x] **コード変更数が 0 件である** (設計・ドキュメント作成のみ実施)
