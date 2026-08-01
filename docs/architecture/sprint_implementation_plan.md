# Sprint Implementation Plan: POSTING MAP Architecture Migration

- **Plan Version**: 1.0 (Phase 2 Approved Master Implementation Plan)
- **Date**: 2026-08-01
- **Status**: SSOT (Master Implementation Plan Specification)
- **Target Scope**: `active/api/v2_api.js` (5,235 lines / 66 Sections: `SEC-001` ~ `SEC-066`)
- **Evidence Base**: Phase 1 Audit (`docs/audit/*`), P2-1 Strategy, P2-2 Roadmap, P2-3 Blueprint, P2-4 Migration, & P2-5 Validation (`docs/architecture/*`)

---

## 1. Executive Summary & Design Phase Completion

本ドキュメントは、Phase 2 設計フェーズ (P2-1 〜 P2-5) の成果物を唯一の根拠とし、`active/api/v2_api.js` (5,235行 / 全66セクション) を完成形マルチモジュール構造へ安全に分離・移行するための**最終マスター実装スプリント計画書**である。

### 1.1 Phase 2 Design Status (設計フェーズ完了状況)
| Sprint | 名称 | 状態 | 目的 |
|:---:|:---|:---:|:---|
| **P2-1** | **Architecture Improvement Strategy** | ✅ 完了 | 改善原則・5レイヤー分離・禁止事項・品質ゲートの定義 |
| **P2-2** | **Refactoring Roadmap** | ✅ 完了 | 66セクションの移行順序および 5段階 Wave 定義 |
| **P2-3** | **Target Architecture Blueprint** | ✅ 完了 | 完成形フォルダ構成・I/F・クラス・モジュール境界設計 |
| **P2-4** | **Migration Strategy** | ✅ 完了 | Migration Stop Gate・Strangler Fig・Rollback・互換性規定 |
| **P2-5** | **Validation Strategy** | ✅ 完了 | 5段階 Validation Level・証跡分類・Production Reality 基準 |
| **P2-6** | **Sprint Implementation Plan** | ✅ 本承認 | マスター実装スプリント計画の策定 (本ドキュメント) |

---

## 2. Sprint Implementation Principles (実装スプリント憲法)

すべてのコード実装スプリント (P2-7 以降) において、以下の基本憲法を 100% 遵守しなければならない。

```
1 Sprint  ➔  1 Responsibility  ➔  1 Target Folder  ➔  1 Validation  ➔  1 Rollback Point
```

1. **1 Sprint**: 1つのスプリントで扱うテーマ・範囲は単一とする。
2. **1 Responsibility**: 扱える責務は単一のレイヤー/コンポーネントのみとする。
3. **1 Target Folder**: コードを出力する先は P2-3 Blueprint で決定された 1フォルダのみとする。
4. **1 Validation**: P2-5 Validation Strategy で指定された検証レベルを 100% クリアする。
5. **1 Rollback Point**: 万が一の際に単独で旧実装に戻せる明確な切戻し点を事前に確保する。

---

## 3. Implementation Wave Schedule (P2-7 ~ P2-11E)

P2-2 Roadmap で確定した依存関係順序に従い、以下のスケジュールで実装スプリントを実行する。

```
[Phase 2 Design Phase: P2-1 ~ P2-6 (コード変更: 0件)]
                           │
                           ▼
[Sprint P2-7: Wave-1 Platform Entry] ──► [Sprint P2-8: Wave-2 Runtime Context]
                                              │
[Sprint P2-10: Wave-4 Framework Routing] ◄─── [Sprint P2-9: Wave-3 Infrastructure Adapters]
      │
      ├──► [Sprint P2-11A: Business Staff]
      ├──► [Sprint P2-11B: Business Distribution]
      ├──► [Sprint P2-11C: Business Area]
      ├──► [Sprint P2-11D: Business Flyer]
      └──► [Sprint P2-11E: Business GPS]
```

---

## 4. Sprint Breakdown & Specifications

### 4.1 Sprint P2-7: Platform Entry Foundation (Wave-1)
- **目的**: GAS の本番入口 (`doGet`/`doPost`) を分離し、後続移行の安全な受け皿を確定する。
- **対象セクション**: `SEC-006` (HTTP GET Entry), `SEC-008` (HTTP POST Entry)
- **Target Folder**: `platform/entry/`
- **成果物**: `platform/entry/doGetHandler`, `platform/entry/doPostHandler`
- **Validation**: Level-5 Production Reality Validation (Web App URL 維定, LIFF 通信確認, TraceLog 正常出力)
- **Rollback Point**: 旧 `v2_api.js` 直列エントリーポイントへの即時復帰
- **P2-7 開始時の禁止事項**:
  - ❌ Routing 変更
  - ❌ Business ロジック移動
  - ❌ Spreadsheet 処理変更
  - ❌ TraceLog 仕様変更
  - ❌ API 仕様変更
  - ❌ 新機能追加
  - ❌ `v2_api.js` の削除

### 4.2 Sprint P2-8: Runtime Context Foundation (Wave-2)
- **目的**: ステートレス実行環境における `CONFIG` リゾルバ、ログ、実行コンテキストの統一。
- **対象セクション**: `SEC-001`〜`SEC-005`, `SEC-030`〜`SEC-032`, `SEC-036`, `SEC-037`, `SEC-057`, `SEC-065`
- **Target Folder**: `runtime/`
- **成果物**: `runtime/context/ApiExecutionContext`, `runtime/config/ConfigProvider`, `runtime/logging/Logger`
- **Validation**: Level-2 Module Test & Level-5 Production Reality Validation

### 4.3 Sprint P2-9: Infrastructure Adapter Foundation (Wave-3)
- **目的**: `SpreadsheetApp`, `DriveApp`, `UrlFetchApp` への直接依存を分離し、`getSS()` 依存を解消する。
- **対象セクション**: `SEC-004`, `SEC-033`〜`SEC-035`, `SEC-049`, `SEC-050`
- **Target Folder**: `infrastructure/`
- **成果物**: `infrastructure/spreadsheet/SpreadsheetRepository`, `infrastructure/drive/DriveApiWrapper`
- **Validation**: Level-3 IO Integration Test & Level-5 Production Reality Validation

### 4.4 Sprint P2-10: Framework Routing Consolidation (Wave-4)
- **目的**: 3重ルーティングを全廃し、`EndpointRegistry` への一本化によって `ISS-001` を完全解消する。
- **対象セクション**: `SEC-007`, `SEC-009`, `SEC-040`〜`SEC-045`, `SEC-051`〜`SEC-056`, `SEC-058`〜`SEC-064`
- **Target Folder**: `framework/`
- **成果物**: `framework/routing/EndpointRegistry`, `framework/routing/ApiRouter`, `framework/pipeline/ValidationPipeline`
- **Validation**: Level-4 Regression Test & Level-5 Production Reality Validation

### 4.5 Sprints P2-11A ~ P2-11E: Business Domain Service Sprints (Wave-5)
- **P2-11A (Staff)**: `SEC-015`, `SEC-017`, `SEC-018`, `SEC-025` ➔ `business/staff/`
- **P2-11B (Distribution)**: `SEC-016`, `SEC-019`, `SEC-021`, `SEC-026`, `SEC-029` ➔ `business/distribution/`
- **P2-11C (Area)**: `SEC-011`~`SEC-014`, `SEC-046`~`SEC-048` ➔ `business/area/`
- **P2-11D (Flyer)**: `SEC-022`~`SEC-024`, `SEC-027`, `SEC-028` ➔ `business/flyer/`
- **P2-11E (GPS)**: `SEC-020` ➔ `business/gps/`

---

## 5. Issue Resolution Mapping (ISS-001 to ISS-007)

Phase 1 で正式採番された 7つの課題の解決担当スプリントマッピングである。

| Issue ID | 課題名 | 解決担当スプリント | 解決のアプローチ |
|:---|:---|:---:|:---|
| **ISS-001** | 3重ルーティングによるアクション定義の重複 | **Sprint P2-10** (Wave-4) | `EndpointRegistry` へ一本化しレガシー switch 全廃 |
| **ISS-002** | 巨大単一ファイルへの責務集中とインフラ占有 | **Sprint P2-7 〜 P2-11E** (全Wave) | 5大レイヤー構成のマルチモジュール物理分離 |
| **ISS-003** | 共有ユーティリティ `getSS()` への広範な密結合 | **Sprint P2-9** (Wave-3) | `SpreadsheetRepository` へのカプセル化 |
| **ISS-004** | 業務ドメイン層の物理的な細切れ分断 | **Sprint P2-11A 〜 P2-11E** (Wave-5) | ドメイン配下 (`staff/`, `area/` 等) への再集約 |
| **ISS-005** | 外部 API (`DriveApp`, `UrlFetchApp`) への直接結合 | **Sprint P2-9** (Wave-3) | `DriveApiWrapper`, `ExternalHttpAdapter` 設置 |
| **ISS-006** | サーバーレス環境での共有状態リセットと IO 偏重 | **Sprint P2-8** (Wave-2) | `ConfigProvider` および Context カプセル化 |
| **ISS-007** | 多段パイプラインのハードコード順序と状態結合 | **Sprint P2-10** (Wave-4) | 明示的な `PipelineExecutor` インターフェース化 |

---

## 6. Mandatory Sprint Lifecycle & Artifacts

各実装スプリント (P2-7 以降) は、以下の 8段階ライフサイクルを順序通りに 100% 実行しなければならない。

```
[1. Implementation Plan] ──► [2. Review] ──► [3. Proceed] ──► [4. Implementation]
                                                                      │
[8. Deployment Evidence] ◄── [7. Git Commit] ◄── [6. Walkthrough] ◄─── [5. Validation]
```

---

## 7. Migration Stop Gate Protocol for Sprint P2-7

初回コード実装スプリント (P2-7) を着手する直前に、以下の **5つの Migration Stop Gate** を全確認し、100% クリアすることを義務付ける。

```
┌────────────────────────────────────────────────────────┐
│           P2-7 Migration Stop Gate Checklist           │
├────────────────────────────────────────────────────────┤
│ [ ] Gate-1: Deployment Registry (DEPLOYMENT_REGISTRY   │
│             / AGENTS.md) の同期・最新性確認            │
│ [ ] Gate-2: Rollback (v2_api.js 旧エントリー復帰) 手順  │
│             の動作確認および文書化                     │
│ [ ] Gate-3: Validation 確認 (doGet/doPost/JSON/LIFF)  │
│ [ ] Gate-4: ユーザーによる明示的な Proceed 承認の獲得   │
│ [ ] Gate-5: Migration Ledger への P2-7 移行ID登録      │
└────────────────────────────────────────────────────────┘
```

---

## 8. Transition Protocol for Sprint P2-7

Phase 2 設計フェーズ (P2-1 〜 P2-6) の完了に伴い、次工程は**コード変更が解禁される初のスプリント P2-7** へ移行する。

- **次工程**: `Phase 2 Sprint P2-7: Wave-1 Platform Entry Foundation`
- **準備状態**: 完全完了 (`Ready for Implementation`)
- **最初のアクション**: Sprint P2-7 専用の `implementation_plan.md` の作成および Proceed 承認獲得。
