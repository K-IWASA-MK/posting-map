# POSTING MAP - AGENTS.md (Repository Governance Rules)

## 🛡️ GAS Deployment SOP (GAS デプロイ運用ルール)

GASのコード変更後、以下の確認を必須とする。これを怠ると、クライアント（実機）が古いデプロイを参照し続け、デバッグが無限ループに陥る原因となる。

### GAS変更時 必須確認リスト
- [ ] `clasp push` 済みであること
- [ ] `clasp deploy` またはデプロイメントが完了していること (`npx clasp deploy -i AKfycbwgiOFU5iudUS6UscNU-MZhnxZJaqJHywVA9ivA-GE0uLe02fi7mmBU474lWa1TD7-R -d "description"`)
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
