# Target Architecture Blueprint: POSTING MAP Backend

- **Blueprint Version**: 1.0 (Phase 2 Approved Blueprint)
- **Date**: 2026-08-01
- **Status**: SSOT (Target Architecture Design Specification)
- **Target Scope**: `active/api/v2_api.js` (5,235 lines / 66 Sections: `SEC-001` ~ `SEC-066`)
- **Evidence Base**: Phase 1 Architecture Audit (`docs/audit/*`), P2-1 Strategy (`docs/architecture/architecture_improvement_strategy.md`), & P2-2 Roadmap (`docs/architecture/refactoring_roadmap.md`)

---

## 1. Document Control & Stability Governance

### 1.1 Revision History
| Version | Date | Author | Description |
|:---:|:---:|:---:|:---|
| **1.0** | 2026-08-01 | Architecture Agent | 初期確定ターゲットアーキテクチャ設計図 (P2-3 承認版) |

### 1.2 Backward Compatibility Policy
- 本 Blueprint は、既存のフロントエンド / クライアント (LINE LIFF / Dashboard UI) に対する HTTP レスポンス互換性を 100% 維持することを保証する。
- 内部のフォルダ・モジュール・クラス構造を変更しても、公開 API 契約 (Request/Response JSON Schema) は破壊しない。

---

## 2. Target Architecture Overview: Call Flow vs. Dependency Rule

完成形アーキテクチャにおいて、**「Call Flow (実行制御フロー)」** と **「Dependency Rule (依存方向)」** を明確に区別して定義する。

```
[Call Flow (実行制御フロー)]
Platform (doGet/doPost) ──► Framework (Router/Pipeline) ──► Business (Domain Service) ──► Infrastructure (Adapter)
                                                                                                  │
                                                                                                  ▼
                                                                                           Spreadsheet / Drive

─────────────────────────────────────────────────────────────────────────────────────────────────────────────

[Dependency Rule (依存方向: 依存性逆転の原則 DIP)]
Platform Layer ──────► Framework Layer ──────► Business Layer (Domain / Interface) ◄────── Infrastructure Layer
                                                          ▲
                                                          │
                                                    Runtime Layer
```

### 2.1 Call Flow (実行制御フロー)
1. **Platform Layer**: リクエスト (`doGet`/`doPost`) を受領。
2. **Framework Layer**: パイプライン通過 (認証・認可・検証) 後、`EndpointRegistry` 経由で適切な `Business Service` を呼び出す。
3. **Business Layer**: 純粋な業務ドメインロジックを実行し、データが必要な場合は抽象 `Infrastructure Interface` を呼び出す。
4. **Infrastructure Layer**: インターフェースを具現化し、`SpreadsheetApp` や `DriveApp` と通信してデータを返却する。

### 2.2 Dependency Rule (依存関係原則)
- **Business Layer の純粋性**: Business Layer は自ら定義した **Interface** にのみ依存し、具象クラスや GAS ネイティブ API (`SpreadsheetApp` 等) へは一切依存しない。
- **Infrastructure の逆転依存 (DIP)**: Infrastructure Layer が Business Layer の定義する Interface を実装 (Implements) する。
- **上位から下位への直接飛び越し禁止**: Platform が Infrastructure を直接参照したり、Business から Platform を呼び戻す逆流・スキップ依存を**完全禁止**する。

---

## 3. Directory Blueprint & Folder Rules

### 3.1 Folder Governance Rule: "1 Folder = 1 Responsibility"
- **原則**: 1つのフォルダは単一のドメインまたは明確に定義された1つの責務のみを格納する。
- **禁止**: `util/`, `common/`, `helpers/` といった抽象的な名称のフォルダを作成し、雑多なロジックを集積することを**固く禁止**する。

### 3.2 Target Directory Blueprint (設計図)
※ 本スプリント (P2-3) では物理的なフォルダ作成を行いません。完成形における配置図面です。

```
active/
├── platform/                     # Owner Layer: Platform Layer
│   ├── entry/                    # doGet / doPost GAS エントリーポイント
│   └── response/                 # WebApp JSON レスポンス整形・出力
├── runtime/                      # Owner Layer: Runtime Layer
│   ├── context/                  # リクエスト別 ExecutionContext 管理
│   ├── config/                   # ConfigResolver / PropertiesService 管理
│   └── lifecycle/                # 実行ログ・性能計測オプザーバー
├── infrastructure/               # Owner Layer: Infrastructure Layer
│   ├── spreadsheet/              # SpreadsheetBatchReader / Writer / Repository
│   ├── drive/                    # DriveApiWrapper (ファイル・写真アップロード)
│   ├── cache/                    # CacheServiceProvider (GAS CacheService)
│   └── lock/                     # LockServiceProvider (GAS LockService)
├── framework/                    # Owner Layer: Framework Layer
│   ├── routing/                  # EndpointRegistry, ApiRouter, RouteKey
│   ├── pipeline/                 # PlatformIntegrationPipeline, Stage ガード
│   ├── validation/               # RequestValidationPipeline
│   └── auth/                     # Authentication & Authorization Pipeline
└── business/                     # Owner Layer: Business Layer
    ├── area/                     # 地区マスター・進捗集計ドメインサービス
    ├── staff/                    # スタッフ名簿・登録・正規化ドメインサービス
    ├── distribution/             # 配布実績・ログ登録・GPSドメインサービス
    └── flyer/                    # チラシ在庫・受渡要請ドメインサービス
```

---

## 4. Module Ownership & Blueprint

主要モジュールの責務、内部コンポーネント、および許可/禁止依存を定義する。

### 4.1 Platform Module (`platform/GasEntryPoint.ts`)
- **Owner Layer**: Platform Layer
- **Responsibility**: GAS の `doGet(e)` / `doPost(e)` エントリーポイントの受領と Framework Dispatcher への移譲。
- **Allowed Dependency**: Framework Layer, Runtime Layer
- **Forbidden Dependency**: Business Layer, Infrastructure Layer, GAS ネイティブ API の直接ロジック呼び出し

### 4.2 Runtime Module (`runtime/ApiExecutionContext.ts`)
- **Owner Layer**: Runtime Layer
- **Responsibility**: リクエストごとのステートレスコンテキスト生成、環境設定解釈、ロギング基盤。
- **Allowed Dependency**: 依存なし (純粋な実行基盤)
- **Forbidden Dependency**: Platform Layer, Framework Layer, Business Layer, Infrastructure Layer

### 4.3 Infrastructure Module (`infrastructure/SpreadsheetRepository.ts`)
- **Owner Layer**: Infrastructure Layer
- **Responsibility**: `SpreadsheetApp` などの物理 IO 操作、バッチ読み書き、データモデル変換。
- **Allowed Dependency**: Business Layer (Interface のみ), Runtime Layer
- **Forbidden Dependency**: Platform Layer, Framework Layer

### 4.4 Framework Module (`framework/EndpointRegistry.ts`)
- **Owner Layer**: Framework Layer
- **Responsibility**: ルーティングキー生成、パイプラインステージ実行制御、例外のハンドリング。
- **Allowed Dependency**: Business Layer (Interface), Runtime Layer
- **Forbidden Dependency**: Infrastructure 具象クラス, Platform Layer

### 4.5 Business Module (`business/AreaService.ts`, `StaffService.ts` 等)
- **Owner Layer**: Business Layer
- **Responsibility**: 業務ルールの適用、バリデーション、進捗計算、純粋ドメイン操作。
- **Allowed Dependency**: 自ドメイン Interface, Runtime Layer (ExecutionContext)
- **Forbidden Dependency**: `SpreadsheetApp`, `DriveApp`, `UrlFetchApp`, Infrastructure 具象クラス, Framework Layer, Platform Layer

---

## 5. Interface Contracts & Blueprint

各レイヤー間を繋ぐ公開 Interface について、`Inputs`, `Outputs`, `Exceptions`, `Side Effects` を明確に契約 (Contract) として定義する。

### 5.1 Business Service Interface (`IBusinessService`)
```typescript
interface IBusinessService<TInput, TOutput> {
  execute(input: TInput, context: IExecutionContext): TOutput;
}
```
- **Inputs**: ドメイン入力 DTO (`TInput`), 実行コンテキスト (`IExecutionContext`)
- **Outputs**: 処理結果ドメイン DTO (`TOutput`)
- **Exceptions**: `DomainValidationError`, `BusinessLogicException`
- **Side Effects**: なし (副作用は Infrastructure 呼び出し経由に限定)

### 5.2 Infrastructure Provider Interface (`ISpreadsheetRepository`)
```typescript
interface ISpreadsheetRepository {
  readRows(sheetName: string, range: string): Array<Record<string, any>>;
  writeBatch(sheetName: string, rows: Array<Record<string, any>>): void;
}
```
- **Inputs**: シート名 (`string`), 範囲表記/データ行配列
- **Outputs**: レコードオブジェクト配列 (`Array<Record<string, any>>`)
- **Exceptions**: `StorageIOException`, `SheetNotFoundException`
- **Side Effects**: スプレッドシートへの物理データ書き込み / 更新

### 5.3 Framework Dispatcher Interface (`IApiRouter`)
```typescript
interface IApiRouter {
  dispatch(request: IApiRequest, context: IExecutionContext): IApiResponse;
}
```
- **Inputs**: HTTP リクエストモデル (`IApiRequest`), コンテキスト (`IExecutionContext`)
- **Outputs**: HTTP レスポンスモデル (`IApiResponse`)
- **Exceptions**: `RouteNotFoundException`, `UnauthorizedException`, `PipelineException`
- **Side Effects**: パイプラインログ記録, メトリクス更新

---

## 6. Module Boundary & Isolation Rules

### 6.1 Business Layer 隔離原則
- Business Layer 内のファイルから `SpreadsheetApp`, `DriveApp`, `UrlFetchApp`, `PropertiesService` の文字列が出現することを**完全禁止**する。
- データ操作が必要な場合は、必ず `this.spreadsheetRepository.readRows(...)` のように注入された Interface を使用する。

### 6.2 Infrastructure Layer カプセル化原則
- `SpreadsheetApp` から読み取った 生の `2次元配列 (any[][])` を Business Layer へそのまま返却することを禁止する。
- 必ず Infrastructure 内部で型定義されたドメインオブジェクト / DTO に変換してから上位へ返却する。

---

## 7. Naming Conventions

コードの統一性を保つため、命名規約を固定化する。

| 対象 | 命名規則 | 例 |
|:---|:---|:---|
| **Folder** | ケバブケース (kebab-case) または小文字単語 | `spreadsheet/`, `area/`, `routing/` |
| **Module / Class** | パスカルケース (PascalCase) | `SpreadsheetAdapter`, `AreaService` |
| **Interface** | `I` プレフィックス + パスカルケース | `ISpreadsheetRepository`, `IApiRouter` |
| **Service** | ドメイン名 + `Service` | `StaffService`, `DistributionService` |
| **Provider** | 機能名 + `Provider` | `ConfigProvider`, `CacheProvider` |
| **Repository** | データ名 + `Repository` | `AreaRepository`, `StaffRepository` |
| **Handler** | アクション名 + `Handler` | `RegisterStaffHandler`, `GetAreasHandler` |

---

## 8. Dependency Injection (DI) Policy

1. **Interface 依存の徹底**: すべてのモジュール相互呼び出しは Interface 経由で行う。
2. **コンストラクタ注入 (Constructor Injection)**: 依存関係はモジュールのコンストラクタで受け取る。
3. **ファクトリ注入**: GAS 環境においては、`Runtime` / `Framework` 層の Factory クラスが具象インスタンスを生成・注入する。

---

## 9. Section Migration Blueprint (SEC-001 to SEC-066)

`active/api/v2_api.js` の全 66 セクションの完成形におけるモジュール配置設計図である。

| Section ID | Section Name | Target Layer | Target Folder | Target Module (完成形) | Target Interface |
|:---|:---|:---|:---|:---|:---|
| **SEC-001** | Admin Setup | Runtime Layer | `runtime/bootstrap/` | `AdminBootstrap.ts` | `IRuntimeBootstrap` |
| **SEC-002** | Trace Logging | Runtime Layer | `runtime/logging/` | `Logger.ts` | `ILogger` |
| **SEC-003** | WebApp Variable | Runtime Layer | `runtime/context/` | `RuntimeContext.ts` | `IRuntimeContext` |
| **SEC-004** | Spreadsheet Utility | Infrastructure Layer | `infrastructure/spreadsheet/` | `SpreadsheetAdapter.ts` | `ISpreadsheetAdapter` |
| **SEC-005** | Context Variables | Runtime Layer | `runtime/context/` | `RuntimeContext.ts` | `IRuntimeContext` |
| **SEC-006** | HTTP GET Entry | Platform Layer | `platform/entry/` | `GasEntryPoint.ts` | `IGasEntryPoint` |
| **SEC-007** | GET Legacy Routing | Framework Layer | `framework/routing/` | `EndpointRegistry.ts` | `IEndpointRegistry` |
| **SEC-008** | HTTP POST Entry | Platform Layer | `platform/entry/` | `GasEntryPoint.ts` | `IGasEntryPoint` |
| **SEC-009** | POST Legacy Routing | Framework Layer | `framework/routing/` | `EndpointRegistry.ts` | `IEndpointRegistry` |
| **SEC-010** | Response Formatting | Platform Layer | `platform/response/` | `ResponsePresenter.ts` | `IResponsePresenter` |
| **SEC-011** | AppData Aggregation | Business Layer | `business/area/` | `AreaService.ts` | `IAreaService` |
| **SEC-012** | Area Details | Business Layer | `business/area/` | `AreaService.ts` | `IAreaService` |
| **SEC-013** | Geography Helper | Business Layer | `business/area/` | `GeographyService.ts` | `IGeographyService` |
| **SEC-014** | City Area Details | Business Layer | `business/area/` | `AreaService.ts` | `IAreaService` |
| **SEC-015** | Roster Read | Business Layer | `business/staff/` | `StaffService.ts` | `IStaffService` |
| **SEC-016** | Distribution Log submit | Business Layer | `business/distribution/` | `DistributionService.ts` | `IDistributionService` |
| **SEC-017** | Normalization Helper | Business Layer | `business/staff/` | `StaffService.ts` | `IStaffService` |
| **SEC-018** | Staff Registration | Business Layer | `business/staff/` | `StaffService.ts` | `IStaffService` |
| **SEC-019** | Delivery Ranking | Business Layer | `business/distribution/` | `DistributionService.ts` | `IDistributionService` |
| **SEC-020** | GPS Photo Upload | Business Layer | `business/distribution/` | `GpsPhotoService.ts` | `IGpsPhotoService` |
| **SEC-021** | Delivery Stats | Business Layer | `business/distribution/` | `DistributionService.ts` | `IDistributionService` |
| **SEC-022** | Flyer Stock Read | Business Layer | `business/flyer/` | `FlyerService.ts` | `IFlyerService` |
| **SEC-023** | Flyer Stock Update | Business Layer | `business/flyer/` | `FlyerService.ts` | `IFlyerService` |
| **SEC-024** | Flyer Transfer Request | Business Layer | `business/flyer/` | `FlyerService.ts` | `IFlyerService` |
| **SEC-025** | Admin Registration | Business Layer | `business/staff/` | `AdminService.ts` | `IAdminService` |
| **SEC-026** | LINE Push Notification | Business Layer | `business/distribution/` | `NotificationService.ts` | `INotificationService` |
| **SEC-027** | Flyer Transfer List | Business Layer | `business/flyer/` | `FlyerService.ts` | `IFlyerService` |
| **SEC-028** | Resolve Transfer | Business Layer | `business/flyer/` | `FlyerService.ts` | `IFlyerService` |
| **SEC-029** | Audit Log Read | Business Layer | `business/distribution/` | `AuditService.ts` | `IAuditService` |
| **SEC-030** | Configuration Provider | Runtime Layer | `runtime/config/` | `ConfigProvider.ts` | `IConfigProvider` |
| **SEC-031** | Cache Service Provider | Infrastructure Layer | `infrastructure/cache/` | `CacheProvider.ts` | `ICacheProvider` |
| **SEC-032** | Lock Service Provider | Infrastructure Layer | `infrastructure/lock/` | `LockProvider.ts` | `ILockProvider` |
| **SEC-033** | Spreadsheet Reader | Infrastructure Layer | `infrastructure/spreadsheet/` | `SpreadsheetBatchReader.ts` | `ISpreadsheetBatchReader` |
| **SEC-034** | Spreadsheet Writer | Infrastructure Layer | `infrastructure/spreadsheet/` | `SpreadsheetBatchWriter.ts` | `ISpreadsheetBatchWriter` |
| **SEC-035** | Spreadsheet Repository | Infrastructure Layer | `infrastructure/spreadsheet/` | `SpreadsheetRepository.ts` | `ISpreadsheetRepository` |
| **SEC-036** | Execution Context | Runtime Layer | `runtime/context/` | `ApiExecutionContext.ts` | `IApiExecutionContext` |
| **SEC-037** | Performance Monitor | Runtime Layer | `runtime/lifecycle/` | `PerformanceMonitor.ts` | `IPerformanceMonitor` |
| **SEC-038** | API Request Model | Framework Layer | `framework/routing/` | `ApiRequest.ts` | `IApiRequest` |
| **SEC-039** | API Response Model | Framework Layer | `framework/routing/` | `ApiResponse.ts` | `IApiResponse` |
| **SEC-040** | HTTP Method Policy | Framework Layer | `framework/routing/` | `MethodPolicy.ts` | `IMethodPolicy` |
| **SEC-041** | API Version Resolver | Framework Layer | `framework/routing/` | `VersionResolver.ts` | `IVersionResolver` |
| **SEC-042** | Route Key Model | Framework Layer | `framework/routing/` | `RouteKey.ts` | `IRouteKey` |
| **SEC-043** | Route Resolver | Framework Layer | `framework/routing/` | `RouteResolver.ts` | `IRouteResolver` |
| **SEC-044** | Route Handlers (Stubs) | Framework Layer | `framework/routing/` | `RouteHandlers.ts` | `IRouteHandler` |
| **SEC-045** | Legacy API Handlers | Framework Layer | `framework/routing/` | `LegacyBridgeHandlers.ts` | `ILegacyBridgeHandler` |
| **SEC-046** | Write Batch Handler | Business Layer | `business/area/` | `AreaBatchHandler.ts` | `IAreaBatchHandler` |
| **SEC-047** | Get Areas Handler | Business Layer | `business/area/` | `AreaQueryHandler.ts` | `IAreaQueryHandler` |
| **SEC-048** | Duplicate Template Handler | Business Layer | `business/area/` | `TemplateDuplicateHandler.ts` | `ITemplateDuplicateHandler` |
| **SEC-049** | Create Test Handler | Infrastructure Layer | `infrastructure/spreadsheet/` | `TestSpreadsheetAdapter.ts` | `ITestSpreadsheetAdapter` |
| **SEC-050** | Cleanup Test Handler | Infrastructure Layer | `infrastructure/spreadsheet/` | `TestSpreadsheetAdapter.ts` | `ITestSpreadsheetAdapter` |
| **SEC-051** | Endpoint Registry | Framework Layer | `framework/routing/` | `EndpointRegistry.ts` | `IEndpointRegistry` |
| **SEC-052** | API Router | Framework Layer | `framework/routing/` | `ApiRouter.ts` | `IApiRouter` |
| **SEC-053** | Validation Base | Framework Layer | `framework/validation/` | `ValidationBase.ts` | `IValidationBase` |
| **SEC-054** | Request Validation Pipeline | Framework Layer | `framework/validation/` | `ValidationPipeline.ts` | `IValidationPipeline` |
| **SEC-055** | API Exception Framework | Framework Layer | `framework/pipeline/` | `ExceptionHandler.ts` | `IExceptionHandler` |
| **SEC-056** | Metrics & Audit | Framework Layer | `framework/pipeline/` | `MetricsPipeline.ts` | `IMetricsPipeline` |
| **SEC-057** | API Lifecycle Observer | Runtime Layer | `runtime/lifecycle/` | `LifecycleObserver.ts` | `ILifecycleObserver` |
| **SEC-058** | Hardening Pipeline | Framework Layer | `framework/pipeline/` | `HardeningPipeline.ts` | `IHardeningPipeline` |
| **SEC-059** | Authentication Pipeline | Framework Layer | `framework/auth/` | `AuthenticationPipeline.ts` | `IAuthenticationPipeline` |
| **SEC-060** | Authorization Pipeline | Framework Layer | `framework/auth/` | `AuthorizationPipeline.ts` | `IAuthorizationPipeline` |
| **SEC-061** | Licensing & Edition | Framework Layer | `framework/pipeline/` | `LicensingPipeline.ts` | `ILicensingPipeline` |
| **SEC-062** | Feature Access Control | Framework Layer | `framework/pipeline/` | `FeatureAccessPipeline.ts` | `IFeatureAccessPipeline` |
| **SEC-063** | AIOS Integration Bridge | Framework Layer | `framework/pipeline/` | `AiosBridgePipeline.ts` | `IAiosBridgePipeline` |
| **SEC-064** | Platform Integration Base | Framework Layer | `framework/pipeline/` | `PlatformIntegrationBase.ts` | `IPlatformIntegrationBase` |
| **SEC-065** | Platform Lifecycle | Runtime Layer | `runtime/lifecycle/` | `PlatformLifecycleObserver.ts` | `IPlatformLifecycleObserver` |
| **SEC-066** | Platform Integration Core | Platform Layer | `platform/entry/` | `PlatformIntegrationPipeline.ts` | `IPlatformIntegrationPipeline` |

---

## 10. Architecture Governance & Stability

1. **Blueprint レビューおよび承認**:
   本 Blueprint に記載された 5レイヤー構成、フォルダ構造、Interface 定義、セクションマッピングを変更する場合は、必ず Architecture Review を実施しユーザーからの承認（Proceed）を得ること。
2. **レイヤー拡張の禁止**:
   新機能追加等を理由に、5つの指定レイヤー (`Platform`, `Runtime`, `Infrastructure`, `Framework`, `Business`) 以外の新しいレイヤーを追加することを禁止する。
3. **逆依存・飛び越しの常時監視**:
   コード実装時に、Business から Infrastructure 具象への直接依存が発生していないかを厳格に検証する。

---

## 11. Blueprint Success Criteria

- [x] **5Layer 構造の確定**: `Platform`, `Runtime`, `Infrastructure`, `Framework`, `Business`
- [x] **全 66 Section の最終配属確定**: `SEC-001` 〜 `SEC-066` の移行先 Target Module / Target Folder 表作成
- [x] **Call Flow と Dependency Rule の明確な分離**: 実行順序と DIP (依存性逆転) の区別
- [x] **Interface Contracts の定立**: Inputs, Outputs, Exceptions, Side Effects の明確な定義
- [x] **1 Folder = 1 Responsibility 憲法化**: 雑多な Utility フォルダ化の完全防止
- [x] **Blueprint Version & Governance 確定**: v1.0 ガバナンス規定完了
- [x] **コード変更数**: **0 件** (設計のみ)
