# Validation Strategy: POSTING MAP Quality Assurance Framework

- **Strategy Version**: 1.0 (Phase 2 Approved Quality Framework)
- **Date**: 2026-08-01
- **Status**: SSOT (Architecture Quality Governance Specification)
- **Target Scope**: `active/api/v2_api.js` (5,235 lines / 66 Sections: `SEC-001` ~ `SEC-066`)
- **Evidence Base**: Phase 1 Audit (`docs/audit/*`), P2-1 Strategy, P2-2 Roadmap, P2-3 Blueprint, & P2-4 Migration Strategy (`docs/architecture/*`)

---

## 1. Core Principles & Validation Independence

### 1.1 6 Core Validation Principles
1. **Evidence First**: 証跡 (Evidence) が伴わない報告は無効とし、客観的事実のみで合否を判定する。
2. **Zero Assumption**: 「動くだろう」「影響はないはず」という推測・主観的判断を完全に排除する。
3. **Repeatable Validation**: 同一手順で誰もが再実験・再現可能な検証プロトコルを定義する。
4. **Objective Pass/Fail**: 明確な定量的判定基準を定め、合否の曖昧さを排する。
5. **Regression Prevention**: 既存機能・互換性・トレースログに対する非破壊・回帰防止を絶対条件とする。
6. **Production Reality Validation**: 抽象コード検査ではなく、実機・本番環境での実動作結果を最終合格基準とする。

### 1.2 Validation Independence (役割分離原則)
検証の客観性と透明性を担保するため、以下の 4つの独立した役割を明確に区別し、記録台帳に明記する。

| 役割名 (Role) | 主な責務 (Responsibility) |
|:---|:---|
| **Implementer (実装者)** | コード改修、一次動作確認、およびビルドチェックの実行 |
| **Validator (検証者)** | 検証プロトコルの実行、実環境動作キャプチャおよび証跡 (Evidence) の採取 |
| **Reviewer (監査者)** | 採択証跡とコード差分の整合性、Blueprint 準拠性の第三者チェック |
| **Approver (承認者)** | 最終 Pass 判定の確定、および次 Wave への開放承認 |

---

## 2. 5-Level Validation Framework

リファクタリングの影響範囲に応じ、以下の 5段階の検証レベルを設定する。

```
[Level-1: Unit] ──► [Level-2: Module] ──► [Level-3: Integration] ──► [Level-4: Regression] ──► [Level-5: Production Reality]
```

### 2.1 Level-1: Unit Validation
- **対象**: 個別の純粋関数・ドメイン計算ロジック（`SEC-013` 幾何計算、`SEC-017` 文字列正規化等）。
- **内容**: 引数に対する戻り値の正確性を単体検証する。

### 2.2 Level-2: Module Validation
- **対象**: 単一モジュールおよび Interface 境界（`SpreadsheetAdapter`, `StaffService` 等）。
- **内容**: モジュール内部のカプセル化、例外スロー、Interface 契約の遵守を検証する。

### 2.3 Level-3: Integration Validation
- **対象**: パイプライン・ルーティングディスパッチャー (`EndpointRegistry`, `ApiRouter`).
- **内容**: HTTP リクエストから該当ハンドラ・パイプラインステージを経由したレスポンス返却を検証する。

### 2.4 Level-4: Regression Validation
- **対象**: システム全体の 12大回帰保護領域。
- **内容**: 既存機能への影響、エラーログ消失、型崩れがないかを完全検証する。

### 2.5 Level-5: Deployment & Production Reality Validation
- **対象**: 本番 Script ID / Web App エンドポイントでの実環境動作。
- **内容**: クライアント (LINE LIFF / Dashboard UI) からの実際の呼び出し、TraceLog への書き込み、データ更新を実機証跡をもって検証する。

---

## 3. Validation Gates & Execution Flow

各スプリント・Wave の移行作業において、以下の Gate フローを通過しない限り次の作業へ進んではならない。

```
[コード改修] ──► [Level 1-3 検証] ──► [Level 4-5 検証] ──► [Evidence 採取] ──► [Walkthrough レビュー] ──► [Approver 承認]
```

---

## 4. Evidence Classification Protocol (証跡分類規定)

提出される検証証跡 (Evidence) を以下の 5つに分類し、管理する。

| 分類 ID | 分類名 | 必須含まれるべき内容 |
|:---:|:---|:---|
| **EVI-DES** | **Design Evidence** | 承認された `implementation_plan.md` および設計参照リンク |
| **EVI-IMP** | **Implementation Evidence** | Git コード差分, モジュール構造キャプチャ |
| **EVI-VAL** | **Validation Evidence** | API レスポンス JSON, HTTP ステータスコード, 正常/異常系判定結果 |
| **EVI-PRD** | **Production Evidence** | 本番 Web App 実行ログ (TraceLog), スプレッドシート更新結果, 実機画面キャプチャ |
| **EVI-ROL** | **Rollback Evidence** | スイッチオフ時の即時切り戻し動作確認ログ |

---

## 5. Pass / Fail Criteria & Validation Severity

### 5.1 Pass / Fail Criteria (合否判定基準)
- **Pass (合格)**:
  1. API JSON レスポンスが既存仕様と 100% 一致 (キー名、型、構造)
  2. HTTP ステータスコード (`200 OK`) およびエラーレスポンス構造の一致
  3. スプレッドシート / Drive / GPS への物理データ更新の一致
  4. TraceLog への正常なログ書き込みの確認
  5. 必須 Evidence (5分類) の完全採取
- **Fail (不合格)**:
  上記 Pass 条件の 1項目でも不一致・欠落が発生した場合。

### 5.2 Validation Severity (不合格重要度分類)
検証失敗 (Fail) 発生時、その影響度に応じて以下のレスポンスアクションを義務付ける。

| Severity | 判定意味 | 影響と即時アクション |
|:---:|:---|:---|
| **Critical** | システム破壊・データ損壊・認証破綻 | 即時 Rollback 発動, 全 Wave 停止, 原因究明レビュー |
| **Major** | API 仕様不一致・ルーティング欠落 | 当該 Wave 停止, 修正コード実装および Level-1 から再検証 |
| **Minor** | レスポンス整形微差・ログフォーマットズレ | スプリント内での修正および Level-3 以降の再検証 |
| **Observation** | 実行時間微増などの観察項目 | 指摘事項として記録 (Fail 扱いとせず観察継続) |

---

## 6. Regression Protection Matrix (12大回帰保護領域)

移行時において、以下の 12領域に対する回帰テストを必須とする。

| ID | 領域 | 検証内容 | 判定合格条件 |
|:---:|:---|:---|:---|
| **REG-01** | Routing | エンドポイント解決の正確性 | 全 16 重複アクションの正確なディスパッチ |
| **REG-02** | API Interface | HTTP メソッド・クエリパラメータ | パラメータ受取の 100% 互換性維持 |
| **REG-03** | JSON Response | 返却 JSON の構造・型 | レスポンスデータスキーマの 100% 一致 |
| **REG-04** | Spreadsheet | シートへのバッチ書き込み・読み込み | データ破損・行ズレ・ヘッダー破壊の 0件 |
| **REG-05** | Drive | 写真・ファイルアップロード | Drive フォルダ生成および URL 返却の正常性 |
| **REG-06** | GPS | 位置情報・緯度経度登録 | 精度・フォーマットの維持 |
| **REG-07** | Authentication | LINE LIFF / API Key 照合 | 無効キー拒否および有効認証の正常通過 |
| **REG-08** | Authorization | ロール認可マトリクス | MEMBER / LEADER / ADMIN 権限の正常判定 |
| **REG-09** | Pipeline | 堅牢化・サーキットブレイカー | タイムアウト・例外の正常キャッチと整形 |
| **REG-10** | Logging | TraceLog シート書き込み | ログ脱落・文字化けの 0件 |
| **REG-11** | Monitoring | パフォーマンス・実行時間 | レスポンス遅延・メモリリークの非発生 |
| **REG-12** | Deployment | Script ID / Deployment ID 同期 | `config.js` (`gasWebAppUrl`) の正常通信確認 |

---

## 7. Validation Expiration Rules (検証失効規定)

1. **仕様・設計変更時の自動失効**:
   `target_architecture_blueprint.md` または `migration_strategy.md` に対する変更・改訂が行われた場合、影響を受けるセクションの既存 Validation 記録はすべて **`Expired` (失効)** となる。
2. **再検証の義務付け**:
   `Expired` となったセクションは、最新の Blueprint に基づき Level-1 から再検証を行わなければ、移行完了とはみなさない。

---

## 8. Validation Ledger & Dashboard

### 8.1 Validation Ledger Schema (検証台帳スキーマ)
全 66 セクションの検証結果を管理する台帳スキーマである。

| カラム名 | 説明 | 例 |
|:---|:---|:---|
| **Validation ID** | 検証一意識別子 | `VAL-W1-SEC006-01` |
| **Wave / Sprint** | 該当 Wave とスプリント | `Wave-1 / Sprint P2-7` |
| **Section** | 対象セクション ID | `SEC-006` |
| **Validation Level** | 実行検証レベル | `Level-5 (Production Reality)` |
| **Result** | 検証結果 (`Pass` / `Fail` / `Expired` / `Pending`) | `Pass` |
| **Severity** | 不合格時の影響度 (`Critical` / `Major` / `Minor` / `Observation`) | `-` |
| **Evidence Path** | 保存証跡ファイルリンク | `docs/evidence/VAL-SEC006.md` |
| **Implementer** | 実装担当 | `Implementer Agent` |
| **Validator** | 検証担当 | `Validator Agent` |
| **Reviewer / Approver**| 監査および最終承認者 | `User Approved` |

### 8.2 Validation Dashboard Metrics (進捗可視化指標)
移行状況を定量的・即時に把握するためのダッシュボード指標を設定する。

- **Total Sections**: 66 セクション
- **Validated (合格件数)**: `Pass` を獲得したセクション数
- **Pending (未検証件数)**: まだ検証未実施のセクション数
- **Failed (不合格件数)**: 検証不合格で対応中のセクション数
- **Blocked (進行不可件数)**: 前段の依存問題で止まっているセクション数
- **Coverage %**: `(Validated / 66) * 100` (%)

---

## 9. Section Validation Matrix (SEC-001 to SEC-066)

`active/api/v2_api.js` の全 66 セクションに対するターゲット検証マトリクスである。

| Section ID | Target Layer | Target Level | Validation Type | Required Evidence | Pass Criteria |
|:---|:---|:---:|:---|:---|:---|
| **SEC-001** | Runtime Layer | Level-2 | Module Test | `EVI-VAL`, `EVI-PRD` | 初期化変数および管理者設定の正常保持 |
| **SEC-002** | Runtime Layer | Level-5 | Production Test | `EVI-PRD` (TraceLog) | TraceLog シートへのログ書き込み正常完了 |
| **SEC-003** | Runtime Layer | Level-2 | Context Test | `EVI-VAL` | isWebAppCall フラグの正常解釈 |
| **SEC-004** | Infrastructure | Level-3 | Adapter Test | `EVI-VAL` | スプレッドシート/Drive オブジェクトの正常取得 |
| **SEC-005** | Runtime Layer | Level-2 | Context Test | `EVI-VAL` | グローバルコンテキストの安全なカプセル化 |
| **SEC-006** | Platform Layer | Level-5 | Production Reality | `EVI-VAL`, `EVI-PRD` | GET リクエストの正常受領と 200 返却 |
| **SEC-007** | Framework Layer | Level-3 | Routing Test | `EVI-VAL` | レガシー GET switch 互換ディスパッチ |
| **SEC-008** | Platform Layer | Level-5 | Production Reality | `EVI-VAL`, `EVI-PRD` | POST リクエストの正常受領と 200 返却 |
| **SEC-009** | Framework Layer | Level-3 | Routing Test | `EVI-VAL` | レガシー POST switch 互換ディスパッチ |
| **SEC-010** | Platform Layer | Level-2 | Response Test | `EVI-VAL` | ContentService JSON 出力フォーマット一致 |
| **SEC-011** | Business Layer | Level-4 | Regression Test | `EVI-VAL`, `EVI-PRD` | getAppData 集計数値の 100% 一致 |
| **SEC-012** | Business Layer | Level-4 | Regression Test | `EVI-VAL` | getAreaDetails マージデータの完全一致 |
| **SEC-013** | Business Layer | Level-1 | Unit Test | `EVI-VAL` | 四日市市等の市町村名抽出結果一致 |
| **SEC-014** | Business Layer | Level-4 | Regression Test | `EVI-VAL` | getCityAreaDetails 一括データの完全一致 |
| **SEC-015** | Business Layer | Level-4 | Regression Test | `EVI-VAL` | getRoster スタッフ名簿データ取得一致 |
| **SEC-016** | Business Layer | Level-5 | Production Reality | `EVI-PRD` | 配布完了・取消実績登録および EventLog 更新 |
| **SEC-017** | Business Layer | Level-1 | Unit Test | `EVI-VAL` | normalizeName 文字列正規化処理一致 |
| **SEC-018** | Business Layer | Level-5 | Production Reality | `EVI-PRD` | registerStaff LINE ID 自動登録と重複検証 |
| **SEC-019** | Business Layer | Level-4 | Regression Test | `EVI-VAL` | getRankingData キャッシュランキング一致 |
| **SEC-020** | Business Layer | Level-5 | Production Reality | `EVI-PRD` (Drive) | updateRecordWithGPSPhoto 写真アップロード |
| **SEC-021** | Business Layer | Level-4 | Regression Test | `EVI-VAL` | getDeliveryStats 完了統計数値一致 |
| **SEC-022** | Business Layer | Level-4 | Regression Test | `EVI-VAL` | getFlyerStock 在庫データ読み込み一致 |
| **SEC-023** | Business Layer | Level-4 | Regression Test | `EVI-VAL` | updateFlyerStock チラシ在庫加算更新一致 |
| **SEC-024** | Business Layer | Level-5 | Production Reality | `EVI-PRD` (LINE) | handleRequestFlyerTransfer LINE 通知 |
| **SEC-025** | Business Layer | Level-4 | Regression Test | `EVI-VAL` | registerAdmin 管理者登録上限判定一致 |
| **SEC-026** | Business Layer | Level-5 | Production Reality | `EVI-PRD` (LINE) | sendLinePushMessage メッセージプッシュ送信 |
| **SEC-027** | Business Layer | Level-4 | Regression Test | `EVI-VAL` | getTransferRequests 履歴取得一致 |
| **SEC-028** | Business Layer | Level-4 | Regression Test | `EVI-VAL` | resolveTransferRequest ステータス更新一致 |
| **SEC-029** | Business Layer | Level-4 | Regression Test | `EVI-VAL` | getAuditLogs 02_SYSTEM 監査ログ取得一致 |
| **SEC-030** | Runtime Layer | Level-2 | Config Test | `EVI-VAL` | GasConfigurationProvider 設定供給一致 |
| **SEC-031** | Infrastructure | Level-2 | Cache Test | `EVI-VAL` | CacheServiceProvider キャッシュ読み書き一致 |
| **SEC-032** | Infrastructure | Level-2 | Lock Test | `EVI-VAL` | LockServiceProvider 排他ロック取得・解放 |
| **SEC-033** | Infrastructure | Level-3 | IO Test | `EVI-VAL` | SpreadsheetBatchReader 一括読込一致 |
| **SEC-034** | Infrastructure | Level-3 | IO Test | `EVI-VAL` | SpreadsheetBatchWriter 一括書込一致 |
| **SEC-035** | Infrastructure | Level-3 | Repository Test | `EVI-VAL` | SpreadsheetRepository データカプセル化 |
| **SEC-036** | Runtime Layer | Level-2 | Context Test | `EVI-VAL` | ApiExecutionContext 文脈保持一致 |
| **SEC-037** | Runtime Layer | Level-2 | Performance Test| `EVI-VAL` | GasPerformanceMonitor IO カウント計測 |
| **SEC-038** | Framework Layer | Level-2 | Model Test | `EVI-VAL` | ApiRequest カプセル化モデル一致 |
| **SEC-039** | Framework Layer | Level-2 | Model Test | `EVI-VAL` | ApiResponse モデルフォーマット一致 |
| **SEC-040** | Framework Layer | Level-2 | Policy Test | `EVI-VAL` | RoutePolicy メソッド検証一致 |
| **SEC-041** | Framework Layer | Level-2 | Resolver Test | `EVI-VAL` | ApiVersionResolver バージョン解決一致 |
| **SEC-042** | Framework Layer | Level-2 | Key Test | `EVI-VAL` | RouteKey 一意キー生成一致 |
| **SEC-043** | Framework Layer | Level-2 | Resolver Test | `EVI-VAL` | RouteResolver キー生成ヘルパー一致 |
| **SEC-044** | Framework Layer | Level-3 | Handler Test | `EVI-VAL` | 各ハンドラスタブの正常レスポンス返却 |
| **SEC-045** | Framework Layer | Level-3 | Bridge Test | `EVI-VAL` | レガシーブリッジハンドラ正常ディスパッチ |
| **SEC-046** | Business/Infra | Level-4 | Integration Test | `EVI-VAL` | WriteBatch CSV バリデーション一括書込 |
| **SEC-047** | Business/Infra | Level-4 | Integration Test | `EVI-VAL` | GetAreas 区割りデータバリデーション取得 |
| **SEC-048** | Business/Infra | Level-4 | Integration Test | `EVI-PRD` | DuplicateTemplate 原本複製シート生成 |
| **SEC-049** | Infrastructure | Level-2 | Test Helper | `EVI-VAL` | CreateTestSpreadsheet テストシート生成 |
| **SEC-050** | Infrastructure | Level-2 | Test Helper | `EVI-VAL` | CleanupTestSpreadsheet テストシート削除 |
| **SEC-051** | Framework Layer | Level-3 | Registry Test | `EVI-VAL` | EndpointRegistry ハンドラマッピング解決 |
| **SEC-052** | Framework Layer | Level-3 | Router Test | `EVI-VAL` | ApiRouter ディスパッチ正常制御 |
| **SEC-053** | Framework Layer | Level-2 | Validation Test| `EVI-VAL` | ValidationError 定数マッピング一致 |
| **SEC-054** | Framework Layer | Level-3 | Pipeline Test | `EVI-VAL` | ValidationPipeline 多段検証一致 |
| **SEC-055** | Framework Layer | Level-3 | Exception Test | `EVI-VAL` | ExceptionHandler 例外捕捉JSON変換 |
| **SEC-056** | Framework Layer | Level-3 | Monitoring Test | `EVI-VAL` | MonitoringPipeline 監査イベントディスパッチ |
| **SEC-057** | Runtime Layer | Level-2 | Observer Test | `EVI-VAL` | ApiLifecycleObserver ライフサイクル監視 |
| **SEC-058** | Framework Layer | Level-3 | Hardening Test | `EVI-VAL` | HardeningPipeline サーキットブレイカー |
| **SEC-059** | Framework Layer | Level-3 | Auth Test | `EVI-VAL`, `EVI-PRD` | AuthenticationPipeline LINE LIFF 照合 |
| **SEC-060** | Framework Layer | Level-3 | AuthZ Test | `EVI-VAL` | AuthorizationPipeline 権限マトリクス検証 |
| **SEC-061** | Framework Layer | Level-3 | License Test | `EVI-VAL` | LicensingPipeline エディション検証 |
| **SEC-062** | Framework Layer | Level-3 | Feature Test | `EVI-VAL` | FeatureAccessPipeline 機能フラグ判定 |
| **SEC-063** | Framework Layer | Level-3 | Integration Test | `EVI-VAL` | AIOSBridgePipeline タスクゲートウェイ連携 |
| **SEC-064** | Framework Layer | Level-2 | Platform Test | `EVI-VAL` | PlatformIntegrationBase 基盤例外ハンドリング |
| **SEC-065** | Runtime Layer | Level-2 | Lifecycle Test | `EVI-VAL` | PlatformLifecycleObserver イベント監視 |
| **SEC-066** | Platform Layer | Level-5 | Production Reality | `EVI-PRD` | PlatformIntegrationPipeline 直列コア実行 |

---

## 10. Validation Success Criteria

- [x] **全 66 Section の Validation 仕様の完全定義**: ターゲットレベル、タイプ、証跡、Pass基準の固定
- [x] **Production Reality Validation の規定**: 実動作確認および Evidence 必須化
- [x] **Validation Independence の明文化**: Implementer, Validator, Reviewer, Approver の 4役割分離
- [x] **Evidence 5分類規定**: `EVI-DES`, `EVI-IMP`, `EVI-VAL`, `EVI-PRD`, `EVI-ROL` の体系化
- [x] **Validation Severity の確立**: `Critical`, `Major`, `Minor`, `Observation` の影響度対応
- [x] **Validation Expiration Rules の定義**: Blueprint 変更時の自動失効規定
- [x] **Validation Ledger & Dashboard Metrics の策定**: 追跡台帳および Coverage % 可視化指標
- [x] **コード変更数**: **0 件** (検証戦略・ガバナンス設計のみ)
