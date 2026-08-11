# Refactoring Roadmap: `active/api/v2_api.js`

- **Version**: 1.1 (Phase 2 Approved Roadmap & Governance)
- **Date**: 2026-08-01
- **Status**: SSOT (Architecture Governance Document)
- **Target File**: `active/api/v2_api.js` (5,235 lines / 66 Sections: `SEC-001` ~ `SEC-066`)
- **Evidence Base**: Phase 1 Architecture Audit (`docs/audit/*`) & P2-1 Strategy (`docs/architecture/architecture_improvement_strategy.md`)

---

## 1. Executive Summary & Scope

### 1.1 Purpose
本ドキュメントは、Phase 1 で確立した監査結果（SSOT）および P2-1 の改善戦略に則り、巨大単一ファイル `active/api/v2_api.js` (5,235行 / 全66セクション) のリファクタリング実行順序・責務グループ・移行Wave・リスク管理・定量的成果指標を決定する**唯一のロードマップ**である。

### 1.2 Target Scope & Issue Boundary
- **対象セクション**: `SEC-001` から `SEC-066` までの全 66 セクション
- **対象課題 (Issue)**: Phase 1 で正式採番された 7つの課題（`ISS-001` 〜 `ISS-007`）のみを 100% 対象とし、新しい Issue の追加は一切行わない。
- **スプリントポリシー**: 本ドキュメント策定スプリント (P2-2) におけるコード変更数は **0件** である。

---

## 2. Refactoring Priority Matrix

Phase 1 監査結果に基づき、7つの Issue の優先度、影響度、依存関係、実装難易度、および解決ターゲット Wave を以下のように整理・固定化する。

| Issue ID | 課題名 | Priority | Impact | Dependency Layer | Difficulty | 解決対象 Wave |
|:---|:---|:---:|:---:|:---|:---:|:---:|
| **ISS-001** | 3重ルーティングによるアクション定義の重複 | High | High | Framework, Platform | Medium | Wave-4 (W4) |
| **ISS-002** | 巨大単一ファイルへの責務集中とインフラ占有 | High | High | All Layers | High | Wave-1 〜 Wave-5 |
| **ISS-003** | 共有ユーティリティ `getSS()` への広範な密結合 | High | High | Infrastructure | Medium | Wave-3 (W3) |
| **ISS-004** | 業務ドメイン層の物理的な細切れ分断 | Medium | Medium | Business | Low | Wave-5 (W5) |
| **ISS-005** | 外部 API (`DriveApp`, `UrlFetchApp`) への直接結合 | High | High | Infrastructure | Medium | Wave-3 (W3) |
| **ISS-006** | サーバーレス環境での共有状態リセットと IO 偏重 | Medium | High | Runtime | Medium | Wave-2 (W2) |
| **ISS-007** | 多段パイプラインのハードコード順序と状態結合 | Medium | Medium | Framework | Medium | Wave-4 (W4) |

---

## 3. Responsibility Migration Groups & Dependency Order

安全性を最優先とし、依存関係の下流（実行基盤・エントリーポイント）から上流（業務ロジック）へ向かってリファクタリングを進める。

```
┌────────────────────────────────────────────────────────┐
│               Wave-1 (W1): Platform                    │  (GAS Entry, Client I/F)
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                Wave-2 (W2): Runtime                    │  (Stateless Context, CONFIG, Logging)
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│             Wave-3 (W3): Infrastructure                │  (Spreadsheet, Drive, External HTTP)
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│               Wave-4 (W4): Framework                   │  (Router, Dispatcher, Pipeline, Exception)
└───────────────────────────┬────────────────────────────┘
                            │
┌───────────────────────────▼────────────────────────────┐
│                Wave-5 (W5): Business                   │  (Domain Services, Address/Posting Logic)
└────────────────────────────────────────────────────────┘
```

---

## 4. Migration Waves & Execution Control

各 Migration Wave ごとに、責務、対象セクション、完了条件 (Exit Criteria)、ロールバックポイント (Rollback Point)、およびリスク管理 (Risk Register) を定義する。

### 4.1 Wave-1 (W1): Platform Layer
- **概要**: GAS のエントリーポイント (`doGet`, `doPost`)、およびレスポンス生成基盤を独立させる。
- **対象セクション**: `SEC-006`, `SEC-008`, `SEC-010`, `SEC-066`
- **Exit Criteria (完了条件)**: Platform Layer が独立モジュールとして動作し、`doGet`/`doPost` からの初期処理移譲が単独ビルド・正常実行できること。
- **Rollback Point (切り戻し点)**: `active/api/v2_api.js` 内の直接エントリーポイント処理へ 100% 切り戻し可能。
- **Risk Register**: **Low** (処理の受信口の薄い委譲のみであり、既存ロジックへの影響が極めて少ない)。

### 4.2 Wave-2 (W2): Runtime Layer
- **概要**: GAS のステートレス実行環境における `CONFIG` アクセス、実行コンテキスト管理、システムログ出力を整理する。
- **対象セクション**: `SEC-001`, `SEC-002`, `SEC-003`, `SEC-005`, `SEC-030`, `SEC-031`, `SEC-032`, `SEC-036`, `SEC-037`, `SEC-057`, `SEC-065`
- **Exit Criteria (完了条件)**: Runtime Layer が Platform へ注入され、`CONFIG` リゾルバおよび実行コンテキストがカプセル化されること。
- **Rollback Point (切り戻し点)**: グローバル変数 (`isWebAppCall`, `globalCacheHit`) および直接 `CONFIG` 参照構造へ退避可能。
- **Risk Register**: **Medium** (リクエストごとのコンテキスト引き回しミスによるログ欠落リスク)。

### 4.3 Wave-3 (W3): Infrastructure Layer
- **概要**: `SpreadsheetApp`, `DriveApp`, `UrlFetchApp` をカプセル化するアダプタ/リポジトリ層を設置し、`getSS()` 依存を解消する。
- **対象セクション**: `SEC-004`, `SEC-033`, `SEC-034`, `SEC-035`, `SEC-046` (I/O部), `SEC-047` (I/O部), `SEC-048` (I/O部), `SEC-049`, `SEC-050`
- **Exit Criteria (完了条件)**: Business Layer からの GAS ネイティブ API (`SpreadsheetApp`, `DriveApp`, `UrlFetchApp`) 直接呼び出しが **0件** となること。
- **Rollback Point (切り戻し点)**: 既存の `getSS()` 共有ヘルパーおよび直接シート操作関数へのフォールバックが可能。
- **Risk Register**: **High** (データアクセスのカプセル化失敗によるスプレッドシートデータ破損・性能低下リスク)。

### 4.4 Wave-4 (W4): Framework Layer
- **概要**: エンドポイントルーティング、パイプライン実行、バリデーション、例外処理を統合し、3重ルーティングを解消する。
- **対象セクション**: `SEC-007`, `SEC-009`, `SEC-040` 〜 `SEC-045`, `SEC-051` 〜 `SEC-056`, `SEC-058` 〜 `SEC-064`
- **Exit Criteria (完了条件)**: レガシー switch ルーティングが全廃され、`EndpointRegistry` への一本化によって重複定義が完全解消すること (`ISS-001` 解消)。
- **Rollback Point (切り戻し点)**: 旧 `SEC-007`/`SEC-009` の switch-case ルーティング分岐へ即座に退避可能。
- **Risk Register**: **High** (認証・認可・堅牢化パイプラインの順序誤りによる不正アクセスまたはリクエスト拒否リスク)。

### 4.5 Wave-5 (W5): Business Layer
- **概要**: 細切れに分断されていた業務ロジック (地区、配布、名簿、チラシ受渡等) を純粋ドメインサービスへ再構築する。
- **対象セクション**: `SEC-011` 〜 `SEC-029`, `SEC-046` (業務部), `SEC-047` (業務部), `SEC-048` (業務部)
- **Exit Criteria (完了条件)**: Business Layer が純粋ドメイン関数として独立し、`v2_api.js` 内の直接ロジック記述が **0件** となること。
- **Rollback Point (切り戻し点)**: 旧 `v2_api.js` 内の個別のドメイン関数へ直接処理を委譲可能。
- **Risk Register**: **Medium** (各業務機能のコーナーケース・パラメータバリデーション相違リスク)。

---

## 5. Section Migration Matrix (SEC-001 to SEC-066)

`active/api/v2_api.js` の全 66 セクションの管理マトリクスである。移行状況はすべて `Planned` から開始する。

| Wave ID | Current Section | Section Name | Lines | Current Layer | Target Layer | Target Module (予定) | Related Issue | Status |
|:---:|:---|:---|:---|:---|:---|:---|:---|:---:|
| **W2** | **SEC-001** | Admin Setup | L1-L18 | Bootstrap | Runtime Layer | `runtime/AdminBootstrap.ts` | ISS-002 | `Planned` |
| **W2** | **SEC-002** | Trace Logging | L19-L48 | Logging | Runtime Layer | `runtime/Logger.ts` | ISS-002 | `Planned` |
| **W2** | **SEC-003** | WebApp Variable | L49-L53 | Bootstrap | Runtime Layer | `runtime/RuntimeContext.ts` | ISS-002 | `Planned` |
| **W3** | **SEC-004** | Spreadsheet Utility | L54-L100 | Utility | Infrastructure Layer | `infrastructure/SpreadsheetAdapter.ts` | ISS-003 | `Planned` |
| **W2** | **SEC-005** | Context Variables | L101-L106 | Bootstrap | Runtime Layer | `runtime/RuntimeContext.ts` | ISS-006 | `Planned` |
| **W1** | **SEC-006** | HTTP GET Entry | L107-L262 | Entry Point | Platform Layer | `platform/GasEntryPoint.ts` | ISS-001, ISS-002 | `Planned` |
| **W4** | **SEC-007** | GET Legacy Routing | L263-L393 | Routing | Framework Layer | `framework/EndpointRegistry.ts` | ISS-001 | `Planned` |
| **W1** | **SEC-008** | HTTP POST Entry | L394-L502 | Entry Point | Platform Layer | `platform/GasEntryPoint.ts` | ISS-001, ISS-002 | `Planned` |
| **W4** | **SEC-009** | POST Legacy Routing | L503-L635 | Routing | Framework Layer | `framework/EndpointRegistry.ts` | ISS-001 | `Planned` |
| **W1** | **SEC-010** | Response Formatting | L636-L676 | Response | Platform Layer | `platform/ResponsePresenter.ts` | ISS-002 | `Planned` |
| **W5** | **SEC-011** | AppData Aggregation | L677-L760 | Business | Business Layer | `business/AreaService.ts` | ISS-002, ISS-004 | `Planned` |
| **W5** | **SEC-012** | Area Details | L761-L806 | Business | Business Layer | `business/AreaService.ts` | ISS-002, ISS-004 | `Planned` |
| **W5** | **SEC-013** | Geography Helper | L807-L817 | Business | Business Layer | `business/GeographyService.ts` | ISS-004 | `Planned` |
| **W5** | **SEC-014** | City Area Details | L818-L887 | Business | Business Layer | `business/AreaService.ts` | ISS-002, ISS-004 | `Planned` |
| **W5** | **SEC-015** | Roster Read | L888-L907 | Business | Business Layer | `business/StaffService.ts` | ISS-004 | `Planned` |
| **W5** | **SEC-016** | Distribution Log submit | L908-L972 | Business | Business Layer | `business/DistributionService.ts` | ISS-003, ISS-004 | `Planned` |
| **W5** | **SEC-017** | Normalization Helper | L973-L983 | Business | Business Layer | `business/StaffService.ts` | ISS-004 | `Planned` |
| **W5** | **SEC-018** | Staff Registration | L984-L1160 | Business | Business Layer | `business/StaffService.ts` | ISS-001, ISS-004 | `Planned` |
| **W5** | **SEC-019** | Delivery Ranking | L1161-L1169 | Business | Business Layer | `business/DistributionService.ts` | ISS-004 | `Planned` |
| **W5** | **SEC-020** | GPS Photo Upload | L1170-L1274 | Business | Business Layer | `business/DistributionService.ts` | ISS-004, ISS-005 | `Planned` |
| **W5** | **SEC-021** | Delivery Stats | L1275-L1283 | Business | Business Layer | `business/DistributionService.ts` | ISS-004 | `Planned` |
| **W5** | **SEC-022** | Flyer Stock Read | L1284-L1303 | Business | Business Layer | `business/FlyerService.ts` | ISS-004 | `Planned` |
| **W5** | **SEC-023** | Flyer Stock Update | L1304-L1360 | Business | Business Layer | `business/FlyerService.ts` | ISS-004 | `Planned` |
| **W5** | **SEC-024** | Flyer Transfer Request | L1361-L1418 | Business | Business Layer | `business/FlyerService.ts` | ISS-004, ISS-005 | `Planned` |
| **W5** | **SEC-025** | Admin Registration | L1419-L1458 | Business | Business Layer | `business/AdminService.ts` | ISS-004 | `Planned` |
| **W5** | **SEC-026** | LINE Push Notification | L1459-L1492 | Business | Business Layer | `business/NotificationService.ts` | ISS-004, ISS-005 | `Planned` |
| **W5** | **SEC-027** | Flyer Transfer List | L1493-L1514 | Business | Business Layer | `business/FlyerService.ts` | ISS-004 | `Planned` |
| **W5** | **SEC-028** | Resolve Transfer | L1515-L1541 | Business | Business Layer | `business/FlyerService.ts` | ISS-004 | `Planned` |
| **W5** | **SEC-029** | Audit Log Read | L1542-L1574 | Business | Business Layer | `business/AuditService.ts` | ISS-004, ISS-005 | `Planned` |
| **W2** | **SEC-030** | Configuration Provider | L1575-L1680 | Framework | Runtime Layer | `runtime/ConfigProvider.ts` | ISS-006 | `Planned` |
| **W2** | **SEC-031** | Cache Service Provider | L1681-L1714 | Framework | Runtime Layer | `runtime/CacheProvider.ts` | ISS-006 | `Planned` |
| **W2** | **SEC-032** | Lock Service Provider | L1715-L1744 | Framework | Runtime Layer | `runtime/LockProvider.ts` | ISS-002 | `Planned` |
| **W3** | **SEC-033** | Spreadsheet Reader | L1745-L1774 | Storage | Infrastructure Layer | `infrastructure/SpreadsheetBatchReader.ts` | ISS-003 | `Planned` |
| **W3** | **SEC-034** | Spreadsheet Writer | L1775-L1806 | Storage | Infrastructure Layer | `infrastructure/SpreadsheetBatchWriter.ts` | ISS-003 | `Planned` |
| **W3** | **SEC-035** | Spreadsheet Repository | L1807-L1885 | Storage | Infrastructure Layer | `infrastructure/SpreadsheetRepository.ts` | ISS-003 | `Planned` |
| **W2** | **SEC-036** | Execution Context | L1886-L1935 | Pipeline | Runtime Layer | `runtime/ApiExecutionContext.ts` | ISS-006, ISS-007 | `Planned` |
| **W2** | **SEC-037** | Performance Monitor | L1936-L1982 | Monitoring | Runtime Layer | `runtime/PerformanceMonitor.ts` | ISS-002 | `Planned` |
| **W4** | **SEC-038** | API Request Model | L1983-L1994 | Pipeline | Framework Layer | `framework/models/ApiRequest.ts` | ISS-007 | `Planned` |
| **W4** | **SEC-039** | API Response Model | L1995-L2020 | Pipeline | Framework Layer | `framework/models/ApiResponse.ts` | ISS-007 | `Planned` |
| **W4** | **SEC-040** | HTTP Method Policy | L2021-L2027 | Routing | Framework Layer | `framework/routing/MethodPolicy.ts` | ISS-001 | `Planned` |
| **W4** | **SEC-041** | API Version Resolver | L2028-L2048 | Routing | Framework Layer | `framework/routing/VersionResolver.ts` | ISS-001 | `Planned` |
| **W4** | **SEC-042** | Route Key Model | L2049-L2064 | Routing | Framework Layer | `framework/routing/RouteKey.ts` | ISS-001 | `Planned` |
| **W4** | **SEC-043** | Route Resolver | L2065-L2070 | Routing | Framework Layer | `framework/routing/RouteResolver.ts` | ISS-001 | `Planned` |
| **W4** | **SEC-044** | Route Handlers (Stubs) | L2071-L2163 | Routing | Framework Layer | `framework/handlers/RouteHandlers.ts` | ISS-001 | `Planned` |
| **W4** | **SEC-045** | Legacy API Handlers | L2164-L2228 | Routing | Framework Layer | `framework/handlers/LegacyBridgeHandlers.ts` | ISS-001 | `Planned` |
| **W3/W5** | **SEC-046** | Write Batch Handler | L2229-L2325 | Business / Storage | Infrastructure / Business | `infrastructure/WriteBatchHandler.ts` | ISS-003, ISS-004 | `Planned` |
| **W3/W5** | **SEC-047** | Get Areas Handler | L2326-L2373 | Business / Storage | Infrastructure / Business | `infrastructure/GetAreasHandler.ts` | ISS-003, ISS-004 | `Planned` |
| **W3/W5** | **SEC-048** | Duplicate Template Handler | L2374-L2429 | Business / Storage | Infrastructure / Business | `infrastructure/DuplicateTemplateHandler.ts` | ISS-003, ISS-005 | `Planned` |
| **W3** | **SEC-049** | Create Test Handler | L2430-L2454 | Utility | Infrastructure Layer | `infrastructure/TestSpreadsheetAdapter.ts` | ISS-005 | `Planned` |
| **W3** | **SEC-050** | Cleanup Test Handler | L2455-L2486 | Utility | Infrastructure Layer | `infrastructure/TestSpreadsheetAdapter.ts` | ISS-005 | `Planned` |
| **W4** | **SEC-051** | Endpoint Registry | L2487-L2539 | Routing | Framework Layer | `framework/EndpointRegistry.ts` | ISS-001 | `Planned` |
| **W4** | **SEC-052** | API Router | L2540-L2580 | Routing | Framework Layer | `framework/ApiRouter.ts` | ISS-001 | `Planned` |
| **W4** | **SEC-053** | Validation Base | L2581-L2592 | Validation | Framework Layer | `framework/validation/ValidationBase.ts` | ISS-007 | `Planned` |
| **W4** | **SEC-054** | Request Validation Pipeline | L2593-L2784 | Validation | Framework Layer | `framework/validation/ValidationPipeline.ts` | ISS-007 | `Planned` |
| **W4** | **SEC-055** | API Exception Framework | L2785-L2966 | Response / Pipeline | Framework Layer | `framework/exception/ExceptionHandler.ts` | ISS-007 | `Planned` |
| **W4** | **SEC-056** | Metrics & Audit | L2967-L3083 | Monitoring | Framework Layer | `framework/monitoring/MetricsPipeline.ts` | ISS-007 | `Planned` |
| **W2** | **SEC-057** | API Lifecycle Observer | L3084-L3164 | Monitoring | Runtime Layer | `runtime/LifecycleObserver.ts` | ISS-002 | `Planned` |
| **W4** | **SEC-058** | Hardening Pipeline | L3165-L3391 | Pipeline | Framework Layer | `framework/pipeline/HardeningPipeline.ts` | ISS-007 | `Planned` |
| **W4** | **SEC-059** | Authentication Pipeline | L3392-L3711 | Authentication | Framework Layer | `framework/pipeline/AuthenticationPipeline.ts` | ISS-005, ISS-007 | `Planned` |
| **W4** | **SEC-060** | Authorization Pipeline | L3712-L3942 | Authorization | Framework Layer | `framework/pipeline/AuthorizationPipeline.ts` | ISS-007 | `Planned` |
| **W4** | **SEC-061** | Licensing & Edition | L3943-L4171 | Licensing / Pipeline | Framework Layer | `framework/pipeline/LicensingPipeline.ts` | ISS-007 | `Planned` |
| **W4** | **SEC-062** | Feature Access Control | L4172-L4416 | Pipeline | Framework Layer | `framework/pipeline/FeatureAccessPipeline.ts` | ISS-007 | `Planned` |
| **W4** | **SEC-063** | AIOS Integration Bridge | L4417-L4849 | Integration | Framework Layer | `framework/pipeline/AiosBridgePipeline.ts` | ISS-005, ISS-007 | `Planned` |
| **W4** | **SEC-064** | Platform Integration Base | L4850-L4940 | Pipeline | Framework Layer | `framework/pipeline/PlatformIntegrationBase.ts` | ISS-007 | `Planned` |
| **W2** | **SEC-065** | Platform Lifecycle | L4941-L4993 | Monitoring | Runtime Layer | `runtime/PlatformLifecycleObserver.ts` | ISS-002 | `Planned` |
| **W1** | **SEC-066** | Platform Integration Core | L4994-L5235 | Pipeline | Platform Layer | `platform/PlatformIntegrationPipeline.ts` | ISS-002, ISS-007 | `Planned` |

---

## 6. Refactoring Constraints & Improvement Budget Mapping

### 6.1 Refactoring Constraints (確認された制約)
1. **Entry Point 固定**: `doGet(e)` / `doPost(e)` のグローバル関数シグネチャは GAS 仕様上変更不可。
2. **GAS Runtime 制約**: `V8` ランタイムの制限（ファイル分割時のホイスティング順序、グローバル変数初期化の挙動）。
3. **Shared Infrastructure 依存**: 既存シート構造 (`data/MIE03_ADDRESS_MASTER_858.csv` 858件マスター含む) を破壊しない。
4. **Deployment Governance**: `DEPLOYMENT_REGISTRY.md` の本番 Script ID / Deployment ID を固定維持。

### 6.2 Improvement Budget Mapping (改善予算制限の適用)
すべての Wave / スプリントにおいて、以下のルールを物理的に適用する。

```
1 Wave / Sprint  ➔  1 Responsibility  ➔  1 Target Folder  ➔  1 Validation Step
```

---

## 7. Success Metrics & Framework

### 7.1 Quantitative Metrics & Measurement Methods

本 P2-2 スプリントでは、改善効果を安全かつ正確に測定するための**「評価指標」と「測定方法」**を定義・確定する。具体的数値目標判定基準は P2-3 (Blueprint) / P2-5 (Validation Strategy) の詳細設計において確定させる。

| 評価指標 | 現状ベースライン | 測定方法 | 目的 |
|:---|:---:|:---|:---|
| **単一巨大ファイル行数 (`v2_api.js`)** | 5,235 行 | `wc -l active/api/v2_api.js` | コードモジュール分割度の定量化 |
| **Business層からの GAS API 直接呼び出し数** | 12 箇所 (31セクション) | `grep_search` (SpreadsheetApp, DriveApp等) | データアクセス分離度の判定 |
| **Routing アクションの重複定義数** | 16 アクション (3重/2重定義) | 静的解析ディスパッチマトリクス照合 | ルーティング一本化の達成度判定 |
| **`getSS()` 直接参照セクション数** | 24 セクション | `grep_search` (`getSS`) | インフラカプセル化度の判定 |
| **Phase 1 未解決 Issue 残数** | 7 件 (`ISS-001`〜`ISS-007`) | `architecture_issue_inventory.md` 追跡 | 監査課題の完全解消判定 |

---

## 8. Roadmap Governance

本ロードマップの一貫性とアーキテクチャガバナンスを維持するため、以下の運用規約を明文化する。

1. **ロードマップ変更の承認必須化**:
   本ロードマップ (`refactoring_roadmap.md`) の内容変更・セクション移行先変更を行う場合は、必ずユーザーレビューおよび明示的な承認（Proceed）を獲得しなければならない。
2. **Migration Wave 順序の固定**:
   `[Platform (W1)] ➔ [Runtime (W2)] ➔ [Infrastructure (W3)] ➔ [Framework (W4)] ➔ [Business (W5)]` の依存順序は、承認なしに変更してはならない。
3. **Phase 1 監査根拠の徹底**:
   課題優先度およびセクション分類の判定根拠は、常に Phase 1 監査結果 (`docs/audit/*`) をSSOTとする。
4. **実装スプリントのロードマップ準拠**:
   P2-7 以降のすべてのコード実装スプリントは、本ロードマップで確定された Wave および対象セクションの範囲を逸脱してはならない。
