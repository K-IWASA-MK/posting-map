# Phase 2 Wave-6B: EventLog & TraceLog Removal Impact Audit Report

**Audit Mode**: READ ONLY AUDIT MODE  
**Audit Date**: 2026-08-01  
**Scope**: Project Workspace (`/Volumes/SSD_DATA/AI Development OS/projects/posting-map/active/`)  
**Source Code Modifications**: 0 lines (READ ONLY)  

---

## 1. Executive Summary

POSTING MAP 商品版（v1.0.0）における `EventLog` および `TraceLog` の実効的利用状況および依存性を解明するため、全ソースコードに対する徹底的な静的解析と呼び出しパス調査（Call Graph / Read-Write Mapping）を実施しました。

### 監査結果概要

1. **`TraceLog` (システム実行ログシート)**:
   - **判定**: 🟢 **`Safe to Remove` (即時撤去可能)**
   - **ファクト**: 書き込みは `active/runtime/lifecycle/runtime_lifecycle.js` (L28) にて無効化済み（`return;`）。読み出しコードは全リポジトリ内で **0 件**。商品機能・表示・API への影響は **0%**。
2. **`EventLog` (イベントログシート & `appendEventLog()`)**:
   - **判定**: 🟡 **`Needs Refactoring` (単純削除不可 / リファクタリング必須)**
   - **ファクト**: `submitDistribution` および `updateRecordWithGPSPhoto` で `EventLog` へ追記書き込み (Write) が行われているだけでなく、**`AreaRepository.findAreaPoints` / `findCityAreaPoints` および `aggregateByBlock` (`getAppData`) において、画面表示・進捗集計・完了フラグ (`isDone`)・完了日時・GPS・写真 URL の主要データソースとして `EventLog` が直に読み出されている (Read)**。
   - **結論**: `EventLog` を事前リファクタリング（Area Sheet 直接参照への統合）なしに単純削除すると、ダッシュボードの進捗表示、ピンの完了状態、完了日時表示が即座に破損する。

---

## 2. Call Graph & Static Scan Results

### 2.1 `appendEventLog()` Write Call Graph

```
API Request (submitDistribution / updateRecordWithGPSPhoto)
  │
  ├─► DistributionRepository.submitDistribution()
  │     └─► appendEventLog(event)  [active/business/distribution/distribution_repository.js:65]
  │           └─► EventLog Sheet Append (active/gas/v2_eventlog_writer.js:6)
  │
  └─► GPSRepository.updateSheetRecordAndLog()
        └─► appendEventLog(event)  [active/business/gps/gps_repository.js:105]
              └─► EventLog Sheet Append (active/gas/v2_eventlog_writer.js:6)
```

### 2.2 `EventLog` Read Call Graph

```
API Request (getAppData / getAreaDetails / getCityAreaDetails / getRankingData)
  │
  ├─► AreaService.getAppData()
  │     └─► AreaRepository.findAllBlocks()
  │           └─► aggregateByBlock()  [active/gas/v2_core.js:69, 106, 131]
  │                 └─► getAllEventLogs()  [EventLog Sheet 読込・ブロック別部数集計]
  │
  ├─► AreaService.getAreaDetails()
  │     └─► AreaRepository.findAreaPoints()  [active/business/area/area_repository.js:83]
  │           └─► getAllEventLogs()  [EventLog から isDone, staffName, gps, photoUrl をマージ]
  │
  └─► AreaService.getCityAreaDetails()
        └─► AreaRepository.findCityAreaDetails()  [active/business/area/area_repository.js:161]
              └─► getAllEventLogs()  [EventLog から 市区町村内全ポイントへ状態マージ]
```

---

## 3. Audit-6: Runtime Invocation Matrix

各 Business API における `EventLog` および `TraceLog` の実効的な書き込み (Write) / 読み出し (Read) マトリクスです。

| API / 機能 | EventLog Write | EventLog Read | TraceLog Write | TraceLog Read | 依存度 |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **`submitDistribution`** | 🟢 **Write** | ❌ None | ❌ Disabled | ❌ None | 書き込み依存（非同期ログ） |
| **`updateRecordWithGPSPhoto`** | 🟢 **Write** | ❌ None | ❌ Disabled | ❌ None | 書き込み依存（非同期ログ） |
| **`registerStaff`** | ❌ None | ❌ None | ❌ Disabled | ❌ None | 完全独立 |
| **`getAppData`** | ❌ None | 🔴 **Read** | ❌ Disabled | ❌ None | **必須依存 (aggregateByBlock)** |
| **`getAreaDetails`** | ❌ None | 🔴 **Read** | ❌ Disabled | ❌ None | **必須依存 (getAllEventLogs マージ)** |
| **`getCityAreaDetails`** | ❌ None | 🔴 **Read** | ❌ Disabled | ❌ None | **必須依存 (getAllEventLogs マージ)** |
| **`getFlyerStock`** | ❌ None | ❌ None | ❌ Disabled | ❌ None | 完全独立 |
| **`updateFlyerStock`** | ❌ None | ❌ None | ❌ Disabled | ❌ None | 完全独立 |
| **`getDeliveryStats`** | ❌ None | 🟢 Read | ❌ Disabled | ❌ None | 軽微依存（キャッシュあり） |
| **`getRankingData`** | ❌ None | 🟢 Read | ❌ Disabled | ❌ None | 軽微依存（キャッシュあり） |

---

## 4. Audit-7: Removal Impact Classification

| コンポーネント | 分類 | 影響度 | 撤去・リファクタリング方針 |
| :--- | :--- | :--- | :--- |
| **`TraceLog` シート / 機能** | 🟢 **`Safe to Remove`** | **無影響 (0%)** | 書き込みは既に停止しており、参照コードも 0 件。即時撤去可能。 |
| **`appendEventLog()`** | 🟡 **`Needs Refactoring`** | **中影響** | 単純削除すると書き込みは止まるが、過去ログを参照している `getAppData` / `getAreaDetails` の集計・表示が崩れる。 |
| **`EventLog` シート** | 🟡 **`Needs Refactoring`** | **高影響** | `AreaRepository` および `aggregateByBlock` が直接読込に使用中。エリアシート本体へのデータ一元化を行ってから撤去すべき。 |
| **`aggregateByBlock()`** | 🟡 **`Needs Refactoring`** | **高影響** | `EventLog` から集計する現行ロジックを、エリアシート直接集計へ移行してから撤去。 |

---

## 5. Technical Fact Analysis: Why EventLog is Read

開発履歴およびソースコード調査により、以下の二重構造が判明しました。

1. **二重記録の存在**:
   - `submitDistribution` および `updateRecordWithGPSPhoto` 実行時、GAS は **① 対象エリアシート（各町丁目シートの行）への直接更新** と **② `EventLog` シートへのイベント行追記** の両方を実行しています。
2. **読込時のデータ優先度**:
   - `getAreaDetails` 取得時、エリアシートの元データに対して `getAllEventLogs()` の最新ログをオーバーレイマージする設計となっています。
3. **結論**:
   - エリアシート（各町丁目シート）自体には既に `isDone` (完了フラグ), `completedAt` (日時), `staffName`, `count`, `gps`, `photoUrl` の全項目が書き込まれているため、**`AreaRepository` および `aggregateByBlock` の読み出しロジックを「エリアシート直接参照」へリファクタリング（移行）すれば、`EventLog` への依存を 100% 排除して完全撤去可能**となります。

---

## 6. Recommendations & Decision Matrix for Next Sprints

```
Wave-6B Audit (完了)
  │
  ├─► Option A: TraceLog のみの即時削除 (完全安全)
  │
  └─► Wave-6C: EventLog Dependency Refactoring & Total Removal Plan
        │
        ├─ Step 1: AreaRepository / aggregateByBlock をエリアシート直接参照へリファクタリング
        ├─ Step 2: appendEventLog() および EventLog 読込ロジックの完全除去
        └─ Step 3: EventLog / TraceLog シートの完全撤去 & GAS 処理速度の爆速化
```

### 結論と推奨

- **Wave-6B (本スプリント)**: READ ONLY AUDIT 完了。`TraceLog` は 🟢 **Safe to Remove**、`EventLog` は 🟡 **Needs Refactoring** と確定。
- **次スプリント (Wave-6C)**: `EventLog` 依存のリファクタリング（エリアシート直接参照化）を行い、`EventLog` / `TraceLog` の両方を商品リポジトリから完全撤去するスプリントの実施を推奨します。
