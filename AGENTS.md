# POSTING MAP - AGENTS.md (Repository Governance Rules)

## 🛡️ GAS Deployment SOP (GAS デプロイ運用ルール)

GASのコード変更後、以下の確認を必須とする。これを怠ると、クライアント（実機）が古いデプロイを参照し続け、デバッグが無限ループに陥る原因となる。

### GAS変更時 必須確認リスト
- [ ] `clasp push` 済みであること
- [ ] `clasp deploy` またはデプロイメントが完了していること (`npx clasp deploy -i AKfycbyjNwgZ_6CCv258lqKMrCXJYi0wDR23ZCyyzOQIV1R_WcCF5TQxYXOzZWWSJd_vMyu_ -d "description"`)
- [ ] Web App URL が更新されていること（デプロイメントIDの変更有無の確認）
- [ ] `config.js` （各種クライアント用設定ファイル）内の `gasWebAppUrl` が同期（最新のURLへ更新）済みであること
- [ ] 実機接続先が更新された新しいエンドポイントを向いているか確認済みであること

---

## 🛡️ 起動時非再帰ルール (No Recursive Startup Rule)

アプリ起動処理（Startup Runtime: LIFF初期化から Dashboard Ready / ID表示完了まで）における循環参照や排他デッドロックを防止するため、以下の実装規則を厳守すること。

* **`loadData()` の再帰呼び出し禁止**:
  * `loadData()` の内部、および `loadData()` から呼び出されるすべての下流関数（例: `syncOfflineQueue()`, `triggerBackgroundRegistration()` 等）の内部から、`loadData()` を直接・間接的に再呼び出し（再帰）してはならない。

---

## 📊 データSSOT（Single Source of Truth）厳守ルール

* **MIE-03 住所マスターデータSSOT**:
  * 必須参照パス: `data/MIE03_ADDRESS_MASTER.csv`
  * 確定データ総数: **ヘッダー1行 ＋ 実データ858件（計859行）**

---

## 🛑 開発実行規制ルール (No Implementation Without Explicit Plan Approval)

AIエージェントは、いかなるコードの修正、コミット、プッシュ、またはその他の実行環境への変更を行う際も、事前に以下のステップを100%遵守しなければならない。

1. **設計・計画の明記**: 必ず `implementation_plan.md` を作成または更新する。
2. **明示的な承認（Proceed）の獲得**: ユーザーから明示的な実行許可（「Proceed」等）を得るまで、コード変更・Git/clasp 操作を行わない。

---

## 🔒 Repository Freeze v1.0 Rules (リポジトリ構造凍結規則)

Phase 3 Structure Management (SM-6B) にて確定・凍結された、本プロダクトリポジトリの永久ガバナンスルールである。

### 1. Rule-1: Top-Level Directory Freeze (トップレベル追加禁止)
POSTING MAP 商品リポジトリのトップレベルディレクトリは、以下の **5 ディレクトリ** のみに永久固定する。新しいトップレベルディレクトリの無秩序な追加は原則禁止する。
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

---

## ⚙️ Client Configuration Rule (マルチテナント設定分離原則)

全国289地区展開を可能にするため、以下の設定分離規約を厳守すること。

* **唯一の設定点**: `clients/{clientId}/config.js` は地区展開における唯一の設定点（SSOT）とする。
* **直書きの全面禁止**:
  * UI/JSコード内への 地区ID（`districtId`）の直書き禁止
  * UI/JSコード内への GAS Web App URL の直書き禁止
  * UI/JSコード内への Spreadsheet ID の直書き禁止
* **新地区追加手続**: 新規地区の追加は `clients/{clientId}/config.js` の追加・設定のみで完結させること（共通コードの修正禁止）。

---

## 🔄 Deployment Synchronization Rule (設定レイヤー同期原則)

POSTING MAPは以下の設定レイヤーを同期状態として管理する。

1. LINE LIFF Entry
2. GitHub Pages Frontend
3. clients/{client}/config.js
4. GAS Deployment
5. Google Spreadsheet

### 同期完了条件
- LIFF ID一致
- Client ID一致
- Frontend公開ファイル一致
- GAS Web App URL一致
- Spreadsheet ID一致

### 禁止事項
- 同期対象レイヤー間で異なるURL・ID・設定値を保持しないこと
- 本番利用前に設定レイヤー同期確認を完了すること

### 注意事項
- 実機通信確認は同期条件に含めない。
- 実機通信確認は別工程の Production Verification として実施する。

---

## ⚙️ GAS Endpoint Resolution Rule (GAS エンドポイント解像原則)

* **唯一のSSOT**: `gasWebAppUrl` は `clients/{client}/config.js` 内でのみ管理・定義する。
* **ランタイムパラメータ追加の許可**: フロントエンドは `page` や `action` などのランタイム引数を付加（Append）してもよい。
* **直書き・置換の禁止**: フロントエンドは GAS デプロイメント URL のベース文字列を直書き・置換（Replace）してはならない。

---

## 🔒 Client Directory Governance Rule (地区ディレクトリ追加管理規約)

* `clients/{clientId}/` は契約・開発対象として明示的に承認された地区のみ作成する。
* 未承認 `clientId` の勝手な追加・ディレクトリ作成は厳禁とする。

---

## ⚠️ Verification Before Response Rule

実環境確認および完了報告規約の詳細は以下を参照する。

詳細:
`.agents/rules/verify-first.md`

---

## LIFF Entry Flow Rule

内容:

- LIFF Endpoint URLでliff.init完了前のURL変更禁止
- liff.login前のdashboard遷移禁止
- Endpoint URLとredirect_uri一致必須

## Client Identifier Separation Rule

内容:

ID種別を明確化する。

GAS Script ID:
.clasp.jsonで管理

Spreadsheet ID:
clients/{clientId}/config.js spreadsheetIdで管理

禁止:
Script IDをSpreadsheet IDとして利用すること。

## Frontend Runtime Asset Rule

内容:

active/dashboard/index.htmlが参照するRuntime Assetを必須管理対象とする。

対象:

- app.js
- db.js
- render.js
- components/
- assets/
- CSS

HTMLのみ移行することを禁止する。

---

## ⚠️ コード変更に関する絶対禁止事項（STRICT CODE EDIT RULES）

### 1. 指定箇所の最小限修正（Minimal Changes Only）
- 指示された箇所の修正・機能追加のみを行ってください。
- 明示的に指示されていない既存処理のリファクタリング、命名変更、コードスタイル統一、フォーマット変更は禁止します。

### 2. 勝手な最適化・設計変更の禁止
- 「こちらのほうが効率的」「よりモダンな書き方」「高速化」などを理由とした自己判断による変更は禁止します。
- 処理順序、起動シーケンス、通信方式、同期・非同期処理など、アプリの動作に影響する設計変更は禁止します。
- 改善案がある場合はコードを変更せず、提案として別途提示してください。

### 3. 差分（Diff）の明確化
- 変更対象のファイル、関数、変更箇所を事前に明示してください。
- 指定箇所以外の変更を行ってはいけません。

### 4. 影響範囲の事前報告（Impact Analysis Required）
- 変更前に、影響を受ける関数・画面・処理フローを報告してください。
- 指示されていない処理に影響する可能性がある場合は、実装を中止して承認を求めてください。

### 5. 動作シーケンス変更の禁止（Startup / Runtime Protection）
- 起動シーケンス、画面遷移、データ取得順序、イベント発火順序などの実行フローは、明示的な指示がない限り変更してはいけません。
- 既存の同期処理を非同期処理へ変更すること、または非同期処理を同期処理へ変更することは禁止します。

### 6. 承認なき仕様変更の禁止
- 「高速化」「保守性向上」「可読性向上」「共通化」を目的としても、既存仕様やユーザー体験が変わる変更は禁止します。
- 仕様変更が必要と判断した場合は、Implementation Planを提示し、承認後に実装してください。

## Verification Rules

### Principle

既存機能は「壊さないこと」を最優先とする。
機能追加・不具合修正を理由として、承認なく既存の処理順序、起動シーケンス、通信方式、ユーザー体験を変更してはならない。

---

## ⚠️ Change Scope Protection Rule（変更範囲保護ルール）

### 変更対象外コードの変更禁止

- 指示されたファイル・関数・処理以外は一切変更してはならない。
- 「ついでの修正」「リファクタリング」「最適化」「命名変更」「コード整理」「フォーマット変更」を禁止する。
- 変更が必要だと判断した場合は実装せず、提案として報告すること。

違反した場合は実装失敗（FAILED）とする。

---

## ⚠️ Mandatory Diff Verification（差分監査必須）

Commit および Push の前に必ず以下を実施すること。

- `git diff` により変更差分を確認する。
- Implementation Plan に記載された変更対象のみが差分に含まれていることを確認する。
- 変更対象外のファイル・関数・ロジックに差分が存在する場合は Commit・Push を禁止する。
- 差分確認結果を Verify Report に記載すること。

この確認が完了するまで Commit・Push を行ってはならない。

---

## 🔒 ID Card UI Freeze v1.0 Rule（IDカードUI永久固定規則）

IDカード画面（`settings`）は **Completed v1.0** としてデザイン・レイアウト・配色が完全固定（UI Freeze）されています。
今後の開発において、以下の要素に対する **色・レイアウト・余白・サイズ・配置の変更は原則絶対禁止** とし、内部機能追加・バグ修正のみを許可します。

### 確定・固定仕様 (ID Card Completed v1.0)
* **ヘッダー**:
  - 「全体エリア」
  - `0 / 858` 表示（位置調整済み）
  - `ONLINE` インジケーター
  - 同期率表示（`0%`）
* **配布員情報**:
  - 「公式配布員」
  - `STAFF ID`（ブランドカラー `#EA5F08` / オレンジ枠 ＋ 控えめな Glow）
* **IDカード本体**:
  - `AUTHORIZED STAFF`
  - プロフィール画像（円形）
  - 氏名
  - 支部名
  - `FIELD OPERATIONS`
  - `TERMS` / `PRIVACY` / `LICENSE` モーダルリンク
* **下部ナビゲーション**:
  - 「在庫登録」「在庫一覧」「ID」「次へ」

### 🔒 ID Card 専用機能スコープ (Dedicated Scope Rule)
以下の3つのリンク・機能は **ID Card 専用機能** として UI Specification に永久固定します。他画面への移設・重複配置・他用途での再利用を禁止します。
```
ID CARD
├── TERMS
├── PRIVACY
└── LICENSE
```

今後、明示的な UI リニューアル指示がない限り、上記要素の見た目・配置変更は一切禁止します。

---

## ⚙️ Municipality Single Source of Truth Governance Rule (市町村SSOTガバナンス規約)

市町村一覧は Googleスプレッドシート（市町村別シート）のみを参照すること（SSOT原則）。

Tier 1（市町村）は GAS(`getAppData`) により生成し、以下の機能はすべて同一データを参照する。
- エリアカード Tier 1
- 保管場所ドロップダウン

Tier 2（町名）および Tier 3（住所）は Tier 1 から派生するデータとして扱う。

### 🚫 絶対禁止事項
- `CITY_ORDER` の再導入
- `cityList.push(...)` 等の固定配列
- フォールバック用市町村リストの直書き
- 地区名・市町村名のコード内ハードコード
- 市町村一覧を複製・保持する実装
- エリア画面用と在庫画面用で別々に市町村一覧を生成する実装

### ⚙️ 必須実装ルール
- Tier 1 は毎回 SSOT から動的生成すること。
- 保管場所ドロップダウンは Tier 1 と同じデータを利用すること。
- 市町村の追加・削除・名称変更は Googleスプレッドシートのみ を更新対象とし、JavaScript の修正を必要としてはならない。
- Tier 1 の表示内容と保管場所ドロップダウンの内容は常に一致していなければならない。
- Tier 1 は MIE-03 の市町村構成を定義するマスターレイヤーであり、他画面で市町村を利用する場合は必ず Tier 1 を参照すること。Tier 1 を経由しない市町村取得は禁止する。

### 📐 Tier 1 Municipality Order Governance (市町村表示順序統制規約)

Googleスプレッドシート（`getAppData`）が返す配列の出現順を Tier 1 市町村の唯一の表示順（SSOT順序）とする。

#### 🚫 禁止事項
- `sort()`
- `localeCompare()`
- `CITY_ORDER`
- 固定配列
- 独自ソート
- 配列を Object や Set に変換して順序を再構築する実装
- 重複除去後に順序が変化する実装

エリア Tier 1 カードおよび保管場所ドロップダウンは、必ず同一配列インスタンス（またはその順序を完全保持したコピー）から直接描画しなければならない。

---

## 🛡️ UI Domain Separation & Responsibility Governance Rule (UIドメイン分離・責務統制規則)

POSTING MAP の全画面は以下の2つのドメインに明確に分離・統制し、将来の機能拡張においても責務が混在する実装を禁止する。

```
POSTING MAP 画面構成
│
├── 👤 Private Domain（本人専用）
│   ├── 🪪 IDカード
│   │      ・LINEプロフィール
│   │      ・STAFF ID
│   │      ・氏名
│   │      ・所属支部
│   │      ・認証状態
│   │      ・TERMS / PRIVACY / LICENSE
│   │      ※すべて自動表示・編集不可
│   │
│   └── 📦 保有枚数
│          ・保管場所
│          ・保有枚数
│          ・更新日時
│          ※ログイン本人のみ更新可能
│
└── 🌍 Shared Operations Domain（全員共通）
    ├── 📊 在庫一覧
    │      ・支部全員の保有枚数
    │      ・保管場所
    │      ・更新日時
    │
    ├── 🗺 エリア
    │      ・Tier1 市町村
    │      ・Tier2 町名
    │      ・Tier3 住所
    │      ・配布状況
    │
    └── 🏆 ランキング
           ・配布枚数
           ・配布率
           ・順位
           ・支部全体実績
```

### ⚙️ Responsibility Rules

#### Private Domain
- 本人の識別情報のみ扱う。
- 本人の入力・更新のみ許可する。
- 他ユーザーの情報を表示しない。

#### Shared Operations Domain
- 支部全体の業務データを扱う。
- 統計・進捗・在庫共有を表示する。
- 本人専用の編集UIを配置しない。

### 🏛️ Single Source of Truth (SSOT)

- **本人情報**: LINE Authentication ＋ STAFF Master
- **保有枚数**: Flyer Stock Sheet
- **エリア**: ADDRESS_MASTER ➔ Googleスプレッドシート（市町村別シート）
- **ランキング**: 配布実績データ

### 🚫 Prohibited (絶対禁止事項)
- Private Domain に他人のデータを表示すること。
- Shared Operations Domain に本人専用の編集UIを配置すること。
- 同一データを Private と Shared で重複保持すること。
- 個人情報を Shared Domain の状態管理へコピーすること。
- 責務を跨ぐ実装・画面設計を行うこと。

---

## 🚀 Ultimate Tiered Lazy Loading Architecture Governance Rule (階層型Lazy Loading戦略)

POSTING MAP は将来のデータ増大（数万件規模）にも初期起動速度（0.1秒）を100%維持するため、以下の 4大設計思想 に基づく段階的オンデマンド取得構造を完成形アーキテクチャとする。

```
POSTING MAP 完成形データ戦略
ADDRESS_MASTER
      │
      ▼
Googleスプレッドシート (SSOT)
      │
      ▼
Tier 1（市町村） ──► ログイン時取得（エリア画面 Tier 1 ＆ 在庫登録 で共有）
      │
      ▼
Tier 2（町名）   ──► 市町村選択時のみオンデマンド取得
      │
      ▼
Tier 3（住所）   ──► 町名選択時のみオンデマンド取得
```

### 🏛️ 4大設計思想
1. **SSOT (Single Source of Truth)**: Googleスプレッドシート（市町村別シート）を唯一の情報源とする。
2. **階層構造 (Tiered Structure)**: Tier 1 (市町村) ➔ Tier 2 (町名) ➔ Tier 3 (住所) の明確な階層分離。
3. **Lazy Loading (遅延読み込み)**: 起動時に全件データを取得せず、段階的に取得。
4. **On-Demand (必要時のみ取得)**: ユーザーの画面操作に応じて必要な範囲のみを非同期リクエスト。

### 🔌 Generation 2 Tiered API Specification (将来API拡張指針)
データ規模拡大時（数万件〜数百万件）における完成形 API 命名・責務分離規約。

- **`getTier1()`**: ログイン時のみ実行。Tier 1（市町村 6件）および Stats のみを最小限取得。
- **`getTier2(cityName)`**: 市町村タップ時に実行。選択された市町村配下の町名サマリーのみを動的取得。
- **`getTier3(cityName, townName)`**: 町名タップ時に実行。選択された町名配下の住所一覧のみを動的取得。

API名そのものに階層と責務を明示することで、保守性および開発エージェントの判断精度を最高水準に維持する。

### 🔄 Migration Policy (新旧API移行原則)
Generation 2 API (`getTier1` / `getTier2` / `getTier3`) は将来の完成形アーキテクチャである。

現行の `getAppData()` は Generation 1 の安定APIとして維持し、Generation 2 への移行が完了するまでは新旧APIを混在させない。

Generation 2 の実装が完了した時点で `getAppData()` を段階的に廃止する。

### ✅ Generation 2 Migration Exit Criteria (旧API廃止統制基準)
Generation 1 (`getAppData()`) を廃止できるのは、以下をすべて満たした場合のみとする。

- `getTier1()` が Tier 1 および初期表示に必要なデータを提供していること。
- `getTier2(cityName)` が全市町村で正常動作すること。
- `getTier3(cityName, townName)` が住所一覧を正常に取得できること。
- エリア画面、保管場所ドロップダウン、在庫登録画面が Generation 2 API のみで正常動作すること。
- Generation 1 と同等以上の性能・機能を維持していること。
- 回帰テスト（Regression Test）に合格していること。

上記すべてを満たした時点でのみ `getAppData()` を段階的に廃止する。

---

## 📊 System Summary Service Foundation (Generation 2 ヘッダー分離統制規則)

Generation 2 の階層型 API アーキテクチャに伴い、ヘッダー表示（全体進捗・オンライン状態）を Tier データから完全に独立したサービスとして統制する。

### 🏛️ API 責務分離原則 (Responsibility Rules)
- **`getSystemSummary()`**: ヘッダー専用 API。全体件数(`total`)、完了数(`done`)、配布率(`percent`)、状態(`online`) のみを取得。Tier データは返さない。
- **`getTier1()`**: 市町村一覧（Tier 1）のみ取得。Stats は返さない。
- **`getTier2(cityName)`**: 選択された市町村配下の町名一覧のみ取得。
- **`getTier3(cityName, townName)`**: 選択された町名配下の住所一覧のみ取得。

### ⚙️ フロントエンド統制
- Generation 2 において `updateStats()` は JavaScript 側で計算集計処理を行わない。`getSystemSummary()` のレスポンスをそのまま直接描画する。
- ヘッダーを表示するために階層データ（Tier 1〜3）を全件走査・集計することを禁止する。

### 🎨 UI Policy (ヘッダー表示固定規則)
ヘッダー表示項目は以下の **4要素** に永久固定する。
1. 全体エリア
2. 完了数 / 総数 (`header-count`)
3. ONLINE インジケーター
4. 配布率 (`header-pct`)

*※最終更新時刻などの不要な追加情報をヘッダーに表示してはならない。*

---

## 🗺️ Generation 2 Implementation Roadmap (スプリントロードマップ)

### 🚀 Sprint G2-1 : System Summary Foundation ⭐最優先
- **Goal**: ヘッダー表示を Tier データから完全分離する。
- **新API**: `getSystemSummary()` ➔ `{ total: 858, done: 0, percent: 0, online: true }`
- **対象**: GAS API / Dashboard Header UI / `updateStats()` 表示専用化
- **完了条件**: ヘッダーが `areaSummary` に非依存化、858件数・0%計算・ONLINE状態が正常表示されること。

### 📦 Sprint G2-2 : Tier 1 API Foundation
- **Goal**: `getTier1()` を新設（6市町村サマリーのみ取得）。

### 🗺️ Sprint G2-3 : Tier 2 Lazy Loading
- **Goal**: `getTier2(cityName)` （市クリック時オンデマンド取得）。

### 📍 Sprint G2-4 : Tier 3 Lazy Loading
- **Goal**: `getTier3(cityName, townName)` （町クリック時オンデマンド取得）。

---

## ⚓ Stability First Governance Rule (完成フェーズ・安定性最優先原則)

POSTING MAP は機能完成フェーズへ移行した。

### 📌 開発優先順位 (Development Priorities)
1. **バグ修正 (Bug Fixes)**
2. **UI / UX 改善 (UI / UX Enhancements)**
3. **パフォーマンス改善 (Performance Optimization)**
4. **保守性向上 (Maintainability & Clean Architecture)**

### 🚫 開発統制ルール
- 原則として新規機能の無秩序な追加を禁止する。
- 既存機能で実現可能であるにもかかわらず、新たな抽象化レイヤー・フレームワーク・アーキテクチャを追加することを禁止する。
- アーキテクチャ変更や抽象化レイヤーの追加は、既存機能では実現不可能であることが明確に証明された場合に限り、事前承認を得て検討する。

---

## UI Verification Policy

UI修正は影響範囲に応じて検証レベルを判断する。

Level 1:
CSS class / text only
→ Static review only

Level 2:
Layout / input / positioning change
→ Browser screenshot verification required

Level 3:
Logic / API / data flow change
→ Browser verification + functional test required

不要な全面調査は禁止し、最小検証で完了すること。

---

## UI Data Display Rule

入力フォームでは表示用文字列と保存データを混在させない。

禁止:
- input.valueへ単位文字を追加
- 数値入力欄へ「枚」「円」「人」等を保存

原則:
- input.value = raw data
- unit label = separate DOM element

スマホ入力欄はiOS Safariの削除操作を必ず確認する。

---

## UI Control Rule

カード内要素は役割に応じて配置規則を統一する。

種類:
- 数値＋単位 ➔ 中央一体表示（例: `6,000枚`）
- 市町村名 ➔ 中央表示（例: `桑名市`）
- 選択矢印 ➔ 右固定（`absolute right-6`）
- 編集操作 ➔ 透明レイヤー（`absolute inset-0 opacity-0`）

