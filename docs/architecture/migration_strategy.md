# Migration Strategy: POSTING MAP Backend Architecture Transition

- **Strategy Version**: 1.0 (Phase 2 Approved Strategy)
- **Date**: 2026-08-01
- **Status**: SSOT (Architecture Governance Document)
- **Target File**: `active/api/v2_api.js` (5,235 lines / 66 Sections: `SEC-001` ~ `SEC-066`)
- **Evidence Base**: Phase 1 Architecture Audit (`docs/audit/*`), P2-1 Strategy, P2-2 Roadmap, & P2-3 Target Architecture Blueprint (`docs/architecture/*`)

---

## 1. Core Principles & Migration Freeze Policy

### 1.1 7 Core Migration Principles
1. **SSOT First**: 移行判断の唯一の根拠は Phase 1 監査結果、P2-2 Roadmap、P2-3 Blueprint とし、推測による変更を排斥する。
2. **Zero Downtime**: 既存 Web App の稼働を停止させない無停止移行を行う。
3. **Zero Regression**: 既存の挙動・レスポンスフォーマット・仕様に対する先祖返り (Regression) を発生させない。
4. **Backward Compatibility**: クライアント (LINE LIFF, Dashboard UI) との互換性を 100% 維持する。
5. **Strangler Fig Pattern**: 既存コードを一括置換せず、新旧モジュールを安全に併存・段階切り替えする。
6. **One Sprint = One Responsibility**: 1スプリントの改修上限を最小の物理単位に限定する。
7. **Rollback First**: 切り替え前に、いつでも前状態へ安全に戻せるロールバック手順を先に確立する。

### 1.2 Migration Freeze Policy (移行期間中機能凍結原則)
> **「リファクタリング移行期間中、いかなる新機能の追加・仕様変更も固く禁止する。」**

本 Phase 2 移行プロジェクトの目的は構造改善に特化するものであり、移行作業中の「ついで機能追加」や「仕様調整」はアーキテクチャ破壊および回帰リスクの主原因となるため**完全禁止**とする。

---

## 2. Migration Phases & Sequence

依存関係の最下流（実行基盤・受信口）から最上流（業務ドメイン）へ向かって安全に移行する 5段階の Wave 構成を固定適用する。

| Wave | レイヤー / 責務 | 移行対象 | 開始条件 |
|:---:|:---|:---|:---|
| **W1** | **Platform Layer** | エントリ (`doGet`/`doPost`), レスポンス生成 | P2-6 計画完了 & W1 Stop Gate クリア |
| **W2** | **Runtime Layer** | コンテキスト, `CONFIG` リゾルバ, ログ基盤 | W1 完了 Exit Review 承認 |
| **W3** | **Infrastructure Layer** | スプレッドシート, Drive, Cache, Lock アダプタ | W2 完了 Exit Review 承認 |
| **W4** | **Framework Layer** | ルーティング, パイプライン, 検証, 認証 | W3 完了 Exit Review 承認 |
| **W5** | **Business Layer** | 地区, 配布, スタッフ, チラシ純粋ドメイン | W4 完了 Exit Review 承認 |

---

## 3. Migration Stop Gate Protocol (移行停止ゲート規約)

各 Migration Wave の実行スプリントを開始する直前において、以下の **5つの Stop Gate 条件** をすべて満たさない限り、いかなるコード改修・リファクタリング作業も**開始してはならない**。

```
┌────────────────────────────────────────────────────────┐
│               Migration Stop Gate Checklist            │
├────────────────────────────────────────────────────────┤
│ [ ] 1. Deployment Registry が最新（同期済み）である    │
│ [ ] 2. Rollback 手順が事前文書化されている             │
│ [ ] 3. Validation 項目および検証スクリプトが確定している │
│ [ ] 4. ユーザーによる実行前承認 (Proceed) を獲得している │
│ [ ] 5. 前 Wave の Exit Criteria が 100% 達成されている  │
└────────────────────────────────────────────────────────┘
```

1条件でも未達成が存在する場合、作業を直ちに停止し、理由をレビュー報告しなければならない。

---

## 4. Exit Review Protocol (Wave 終了レビュー規定)

各 Migration Wave が終了した際、次の Wave へ進む前に以下の 5段階フローズンフローを順序通りに全通過しなければならない。

```
[Wave 開発完了] ──► [1. Review] ──► [2. Validation] ──► [3. Walkthrough] ──► [4. Approve] ──► [5. Next Wave 解禁]
```

1. **Review**: コード変更差分および Blueprint 準拠性の確認。
2. **Validation**: API レスポンス・回帰確認テストの実行と証跡取得。
3. **Walkthrough**: ユーザーへの成果物・検証結果の提示。
4. **Approve**: ユーザーからの明示的な終了承認の獲得。
5. **Next Wave 解禁**: 次の Wave の Stop Gate 判定へ進む。

---

## 5. Strangler Fig Strategy & Preservation Policy

既存の単一巨大ファイル `active/api/v2_api.js` (5,235行) を安全に解体するため、**Strangler Fig パターン**を適用する。

```
[旧リクエスト] ────► [v2_api.js (レガシー関数)] (既存動作維持)
                           ▲
                           │ (切り替えファサード / EndpointRegistry)
[新リクエスト] ────► [New Layer Modules] ──────► [新ビジネスドメイン]
```

### 5.1 旧コード完全保存原則
- 移行中および検証中において、`v2_api.js` 内の旧ロジックコードを物理的に削除することを**固く禁止**する。
- 旧関数はファサードのフォールバック先として一定期間完全に保持し、全 Wave (W1〜W5) の最終検証が完了した後にのみ削除を許可する。

---

## 6. Migration Unit (移行憲法)

すべての移行スプリントにおいて、改修の影響範囲を以下の最小物理単位に固定・制限する。

```
1 Sprint  ➔  1 Responsibility  ➔  1 Target Folder  ➔  1 Validation Step  ➔  1 Rollback Point
```

- **1 Sprint**: 単一のスプリント。
- **1 Responsibility**: 単一の定義された責務。
- **1 Target Folder**: 単一のターゲットフォルダ（P2-3 Blueprint 準拠）。
- **1 Validation Step**: 確証を得られる単一の検証手続。
- **1 Rollback Point**: 単独で旧実装に戻せる明確なポイント。

---

## 7. Compatibility Policy (互換性維持基準)

移行作業中および移行完了後において、以下の 6大領域に対する 100% の互換性維持を義務付ける。

| 対象 | 互換性要求 | 違反時の扱い |
|:---|:---|:---|
| **HTTP API Interface** | URL パラメータ, HTTP メソッド, ヘッダー仕様を 100% 維持 | 重大障害として即時 Rollback |
| **JSON Response Schema** | キー名, データ型, ネスト構造, エラーメッセージ形式を 100% 維持 | 重大障害として即時 Rollback |
| **GAS Entry Point** | `doGet(e)` / `doPost(e)` グローバル関数シグネチャの維持 | ビルドエラー / 即時 Rollback |
| **`config.js` 接続設定** | `gasWebAppUrl` を最新デプロイ URL と 100% 同期固定維持 | ガバナンス違反として作業中断 |
| **Deployment URL** | 本番 Web App URL を一切変更・差し替えしない | ガバナンス違反として作業中断 |
| **Spreadsheet Schema** | `data/MIE03_ADDRESS_MASTER_858.csv` (858件) 等のシート構造維持 | 即時 Rollback |

---

## 8. Feature Switch & Rollback Strategy

### 8.1 Feature Switch (切り替えスイッチ)
移行したモジュールへのルーティングは、`EndpointRegistry` 内の単一スイッチ（フラグまたはマッピング）により制御する。切り替え前および異常発生時には、フラグをオフにすることで旧実装へミリ秒単位で退避可能とする。

### 8.2 Rollback Protocol (ロールバック規定)
- **Big Bang Rollback の禁止**: 全体を一括で巻き戻す危険なロールバックを禁止し、当該スプリント/Wave の単独モジュール切り離し（Feature Switch のオフ）による局所ロールバックを実施する。
- **Rollback Trigger**: API エラー率増加、レスポンス形式不一致、認証失敗、データ不整合のいずれかが検出された場合。

---

## 9. Regression Protection (10大検証保護領域)

移行スプリントごとに、以下の 10領域に対する回帰確認テストを義務付ける。

1. **API Response**: JSON レスポンス構造の一致検証
2. **Routing**: エンドポイントディパッチの正当性検証
3. **Spreadsheet**: 読み書きおよびバッチ操作の正確性検証
4. **Drive**: GPS 写真アップロードおよびフォルダ作成動作の検証
5. **GPS**: 位置情報登録・緯度経度フォーマットの検証
6. **Authentication**: LINE LIFF / API Key 照合動作の検証
7. **Authorization**: MEMBER / LEADER / ADMIN 認可権限の検証
8. **Pipeline**: 堅牢化・例外ハンドリングの挙動検証
9. **Logging**: TraceLog およびデバッグログ出力の検証
10. **Metrics**: パフォーマンス・実行時間の検証

---

## 10. Deployment Governance (デプロイメントガバナンス)

1. **Deployment Registry SSOT の厳守**:
   デプロイ情報の変更・確認は、常に `DEPLOYMENT_REGISTRY.md` および `AGENTS.md` のレジストリ情報を唯一の根拠として行う。
2. **`gasWebAppUrl` 変更禁止憲法**:
   各クライアント設定ファイル (`config.js`) 内の `gasWebAppUrl` は、移行作業対象外であり、URL 変更を目的とした改修を**固く禁止**する。本番デプロイメント ID を固定したまま `clasp deploy -i <deployment_id>` で上書き更新する。

---

## 11. Migration Evidence & Migration Ledger Protocol

移行プロセスの完全な追跡性と監査可能性を担保するため、**Migration Ledger (移行台帳)** スキーマを定義し、全 66 セクションの移行状態を記録・管理する。

### 11.1 Migration Ledger Schema (移行台帳スキーマ)
各セクションの移行ごとに以下の台帳項目を記録・保持する。

| カラム名 | 説明 | 例 |
|:---|:---|:---|
| **Migration ID** | 移行一意識別子 | `MIG-W1-SEC006` |
| **Wave** | 該当 Migration Wave | `Wave-1 (W1)` |
| **Section** | 対象セクション ID | `SEC-006` |
| **Status** | 移行状態 (`Planned` / `In Progress` / `Validated` / `Completed` / `Rolled Back`) | `Completed` |
| **Evidence** | テスト・ログ証跡ファイルパス | `docs/evidence/MIG-W1-SEC006.md` |
| **Rollback Point** | 退避ポイント識別子 | `RB-SEC006-LEGACY-ENTRY` |
| **Completed By** | 担当エージェント / スプリント | `Sprint P2-7` |
| **Approved By** | 承認ユーザー | `User Approved` |

---

## 12. Migration Readiness Checklist & Success Criteria

### 12.1 Readiness Checklist (移行着手前チェックリスト)
- [x] **P2-3 Target Architecture Blueprint が承認済みであること**
- [x] **Migration Stop Gate Protocol が明記されていること**
- [x] **Exit Review Protocol が定義されていること**
- [x] **Migration Freeze Policy (機能追加禁止) が明記されていること**
- [x] **Deployment Governance (URL固定) が徹底されていること**

### 12.2 Migration Success Criteria (全 Phase 2 完了条件)
- 全 66 セクション (`SEC-001`〜`SEC-066`) の新アーキテクチャへの 100% 移行完了
- 7つの Phase 1 監査課題 (`ISS-001`〜`ISS-007`) の完全解消
- HTTP API, GAS Entry, UI レスポンス互換性 100% 維持
- 無停止・無事故・ロールバック不要での全 Wave 完了
- 物理コード変更数 **0件** (本 P2-4 スプリントにおける達成)
