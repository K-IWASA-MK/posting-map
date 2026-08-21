# Architecture Rules

## 🏛️ Highest-Level Architecture Principle: District-Agnostic Template Architecture

本リポジトリの全コード・全機能は、**`AGENTS.md`** および **`docs/architecture/DISTRICT_AGNOSTIC_ARCHITECTURE_PRINCIPLE.md`** に規定された「District-Agnostic Template Architecture（地区非依存テンプレート構造）」に完全準拠しなければならない。

### 実装時の絶対禁止事項
- **特定地区への依存禁止**: アプリケーションコード内に `MIE-03` 等の特定地区、`四日市市` 等の自治体名、`858` 等の固定件数・座標をハードコードしてはならない。
- **地区固有Backendの禁止**: Backend Spreadsheet に地区固有の住所マスターシート（旧 `MIE03_ADDRESS_MASTER` 等）を要求してはならない。Backend は実在する標準5シート（`名簿`, `配布実績`, `保有チラシ枚数`, `受渡要請履歴`, `PinStatus`）のみで稼働する。
- **Static Master (data/*.csv) へのSSOT集約**: 地区の地理情報・自治体・町名・座標・ピン生成基盤はすべて Static Master CSV から動的にパース・自動認識されなければならない。
- **フォルダーコピー＋CSV差替による独立稼働**: フォルダーを丸ごとコピーし、CSVを差し替えて接続先を設定するだけで、アプリケーションコードを1行も修正することなく新地区インスタンスとして稼働できなければならない。

---

## 起動時非再帰ルール (No Recursive Startup Rule)
アプリ起動処理（Startup Runtime: LIFF初期化から Dashboard Ready / ID表示完了まで）における循環参照や排他デッドロックを防止するため、以下の実装規則を厳守すること。

* **`loadData()` の再帰呼び出し禁止**:
  * `loadData()` の内部、および `loadData()` から呼び出されるすべての下流関数（例: `syncOfflineQueue()`, `triggerBackgroundRegistration()` 等）の内部から、`loadData()` を直接・間接的に再呼び出し（再帰）してはならない。

## Repository Freeze v1.0 Rules (リポジトリ構造凍結規則)
Phase 3 Structure Management (SM-6B) にて確定・凍結された、本プロダクトリポジトリの永久ガバナンスルールである。

### 1. Rule-1: Top-Level Directory Freeze (トップレベル追加禁止)
POSTING MAP 商品リポジトリのトップレベルディレクトリは、以下の **5 ディレクトリ** のみに永久固定する。
- **`active/`** （唯一の本番コードベース）
- **`data/`** （SSOT マスターデータ & 空間データ）
- **`docs/`** （仕様書・アーキテクチャ・監査・研究）
- **`scripts/`** （開発・検証・運用補助スクリプト）
- **`tests/`** （テストコード）

*※例外規定: 例外的に新しいトップレベルディレクトリが必要となった場合は、事前に Architecture Review を実施し、明確な理由と承認記録を残さなければならない。*

### 2. Rule-2: Mandatory Asset Placement Rule (新規責務配置ルール)
新しい資産やモジュールを作成する場合、以下のマッピングに従って配置しなければならない。
- GAS 本番コード / UI → `active/` 配下
- CSV / GeoJSON / マスターデータ → `data/` 配下
- 仕様書 / 設計書 / 監査レポート → `docs/` 配下
- 自動化 / 運用 / 検証スクリプト → `scripts/` 配下
- テストコード / テストデータ → `tests/` 配下

### 3. Rule-3: Permanent Anti-AIOS Contamination Rule (AIOS 再混入禁止)
以下の AIOS / エージェントランタイム資産を POSTING MAP リポジトリ内に作成・復元することを禁止する。
- **禁止対象**: ルート直下の `/agents`, `/skills`, `/knowledge`, `/AI社員`, `/runtime` (または `/runtime-aios`)
- **許可対象**: `active/runtime/` （POSTING MAP アプリ本体の正常な Runtime Layer）

### 4. Rule-4: Strict Business Domain Expansion Rule (Business 拡張ルール)
Phase 2 (P2-11D 以降) の Business Layer 拡張において、新規ドメインサービスは必ず以下の規則に従って配置しなければならない。
- 配置パス: `active/business/{domain}/`
- 例: `active/business/area/`, `active/business/flyer/`, `active/business/gps/`
- `v2_api.js` への直接的な業務ロジック記述は禁止し、Facade 経由での委譲を義務付ける。

## Ultimate Tiered Lazy Loading Architecture (階層型Lazy Loading戦略)
POSTING MAP は将来のデータ増大（数万件規模）にも初期起動速度（0.1秒）を100%維持するため、以下の 4大設計思想 に基づく段階的オンデマンド取得構造を完成形アーキテクチャとする。

### 4大設計思想
1. **SSOT (Single Source of Truth)**: Googleスプレッドシート（市町村別シート）を唯一の情報源とする。
2. **階層構造 (Tiered Structure)**: Tier 1 (市町村) ➔ Tier 2 (町名) ➔ Tier 3 (住所) の明確な階層分離。
3. **Lazy Loading (遅延読み込み)**: 起動時に全件データを取得せず、段階的に取得。
4. **On-Demand (必要時のみ取得)**: ユーザーの画面操作に応じて必要な範囲のみを非同期リクエスト。

### Generation 2 Tiered API Specification
データ規模拡大時（数万件〜数百万件）における完成形 API 命名・責務分離規約。
- **`getTier1()`**: ログイン時のみ実行。Tier 1（市町村 6件）および Stats のみを最小限取得。
- **`getTier2(cityName)`**: 市町村タップ時に実行。選択された市町村配下の町名サマリーのみを動的取得。
- **`getTier3(cityName, townName)`**: 町名タップ時に実行。選択された町名配下の住所一覧のみを動的取得。

### Migration Policy
Generation 2 API (`getTier1` / `getTier2` / `getTier3`) は将来の完成形アーキテクチャである。現行の `getAppData()` は Generation 1 の安定APIとして維持し、Generation 2 への移行が完了するまでは新旧APIを混在させない。

## System Summary Service Foundation
Generation 2 の階層型 API アーキテクチャに伴い、ヘッダー表示（全体進捗・オンライン状態）を Tier データから完全に独立したサービスとして統制する。

### API 責務分離原則
- **`getSystemSummary()`**: ヘッダー専用 API。全体件数(`total`)、完了数(`done`)、配布率(`percent`)、状態(`online`) のみを取得。Tier データは返さない。
- **`getTier1()`**: 市町村一覧（Tier 1）のみ取得。Stats は返さない。

### フロントエンド統制
- Generation 2 において `updateStats()` は JavaScript 側で計算集計処理を行わない。`getSystemSummary()` のレスポンスをそのまま直接描画する。
- ヘッダーを表示するために階層データ（Tier 1〜3）を全件走査・集計することを禁止する。

## Stability First Governance Rule
POSTING MAP は機能完成フェーズへ移行した。

### 開発統制ルール
- 原則として新規機能の無秩序な追加を禁止する。
- 既存機能で実現可能であるにもかかわらず、新たな抽象化レイヤー・フレームワーク・アーキテクチャを追加することを禁止する。
- アーキテクチャ変更や抽象化レイヤーの追加は、既存機能では実現不可能であることが明確に証明された場合に限り、事前承認を得て検討する。

## Fetch API Standard Data Access Governance Rule
POSTING MAP におけるすべての Fetch API（非同期データ取得関数）は、以下の **7段階の固定シーケンス** に従って実装しなければならない。
1. Guard -> 2. Cache Check -> 3. Loading Start -> 4. API Call -> 5. Cache Update -> 6. Loading Close -> 7. Return
