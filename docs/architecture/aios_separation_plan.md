# AIOS Separation Plan

**Document Version**: 1.0.0  
**Status**: APPROVED  
**Scope**: Project Root (`/Volumes/SSD_DATA/AI Development OS/projects/posting-map`)  
**Execution Mode**: READ ONLY DESIGN MODE (Code Modifications: 0)  

---

## 1. Executive Summary & Purpose

本ドキュメントは、POSTING MAP を AIOS（AI Operating System）から完全独立した単独商品リポジトリとして再構築するための「正式分離計画書」です。SM-1（構造監査）および SM-2（スリム化計画）で確立した結論に基づき、本分離の責務境界、アセット分類、新リポジトリ移行手順、および厳格な非依存ルールを規定します。

---

## 2. Separation Principles (分離原則)

POSTING MAP と AIOS の分離において厳守する 6 大原則です。

1. **Product First**: リポジトリのすべての構造・コード・ドキュメントは、ポスティングマップ商品およびダッシュボードの価値提供を最優先とする。
2. **No Runtime Dependency**: 本番ランタイム (`active/`) において、AIOS への実行時依存を 100% 排除する。
3. **No Shared Source**: ソースコードレベルでの共有モジュールや二重参照を一切廃止する。
4. **Independent Release Cycle**: POSTING MAP と AIOS のデプロイ・リリースサイクルを完全分離する。
5. **Independent Repository**: Git リポジトリを完全独立させ、履歴・アクセス権・運用を分断する。
6. **Independent Versioning**: POSTING MAP 独自のセマンティックバージョニング体系を適用する。

---

## 3. Separation Boundary Definition

POSTING MAP と AIOS の正式なアセット分離境界定義です。

### 🟢 POSTING MAP に残す資産 (Retained Assets)
```
posting-map/
├── active/                    ← GAS Backend / LIFF / Dashboard / Business Logic
├── data/                      ← SSOT (MIE03_ADDRESS_MASTER_858.csv) & 空間マスターデータ
├── docs/                      ← 仕様書・アーキテクチャ設計書・監査レポート
├── scripts/                   ← 開発・検証・運用テストスクリプト
├── tests/                     ← テストコード・テストランナー
├── AGENTS.md                  ← プロジェクト開発ガバナンスルール
├── DEPLOYMENT_REGISTRY.md     ← デプロイ環境レジストリ
├── package.json               ← npm 設定
├── appsscript.json            ← GAS マニフェスト
├── .clasp.json                ← clasp 接続設定
└── .claspignore               ← clasp デプロイ除外定義
```

### 🔴 AIOS へ移管する資産 (Transferred Assets)
```
aios/
├── agents/                    ← 12 ドメインの AI エージェント定義
├── AI社員/                    ← AI 社員ロール定義
├── skills/                    ← AIOS スキル定義
├── knowledge/                 ← AIOS ナレッジベース
├── AI_WORKFORCE_CONSTITUTION* ← AI 社員憲法 (v1.0〜v1.6.0 の 7 ファイル)
├── CLAUDE.md / GPT.md         ← 旧プロンプト設定ファイル
├── HANDOVER.md                ← 過去の AIOS 引継ぎ文書
├── aios-manifest.json         ← AIOS マニフェスト
└── deployment.json / project.json ← AIOS 連携用プロパティファイル
```

---

## 4. Runtime Separation Plan

`active/api/v2_api.js` 内に存在する AIOS Bridge 関連コードの整理計画です。現時点では READ ONLY であり、コード切除は SM-5 で実施します。

### 整理対象クラス群 (`v2_api.js` L3453〜L3884, 約 430 行)
- `BridgeMessage`, `BridgeResult`, `BridgePolicy`, `BridgeEvent`
- `BridgeEventDispatcher`, `BridgeMessageMapper`, `BridgeContext`, `BridgeException`
- `AIOSBridgeMode`, `resolveBridgeMode()`, `CapabilityMappingRegistry`, `CapabilityResolver`
- `AIOSBridgeTaskAdapter`, `MockAIOSClient`, `LiveAIOSClient`, `AIOSClientFactory`
- `AIOSBridgeProvider`, `AIOSBridgePipeline`

**現状判定**: 
- Status: **Dead Code** (実行経路なし)
- Default: **STUB Mode** (`aiosBridge: false` によりパイプラインスキップ)
- SM-5 にて safe-guard を維持しつつ全切除。

---

## 5. Feature Flag Separation

`active/runtime/config/config_provider.js` 内の AIOS 関連機能フラグの整理計画です。

```javascript
// 整理・削除対象プロパティ (Default: false / STUB)
- aiosBridge
- bridgeEnabled
- bridgeHeartbeat
- bridgeTimeout
- bridgeProvider
- bridgeMode
```

---

## 6. Repository Migration Map & Creation Plan

### リポジトリ移行マップ
```
[現 POSTING MAP リポジトリ (混在状態)]
        │
        ├─── (分離・移管) ───► [新 AIOS リポジトリ (aios)]
        │                         ├── agents/
        │                         ├── AI社員/
        │                         ├── skills/
        │                         └── knowledge/
        │
        └─── (純粋化) ──────► [新 POSTING MAP リポジトリ (posting-map)]
                                  ├── active/
                                  ├── data/
                                  ├── docs/
                                  ├── scripts/
                                  └── tests/
```

### Git History 保持方針の比較検討 (SM-4 採用案決定用)

| 方針 | 概要 | メリット | デメリット・リスク | 判定 |
| :--- | :--- | :--- | :--- | :--- |
| **Option A: Full History Retain** | 既存 Git 履歴をそのまま保持し、不要ファイルを `git rm` | 過去のコミットログや blame が 100% 保持される | 過去のコミット内に巨大データや不要コードが残りリポジトリ容量が小さくならない | 🟡 候補 |
| **Option B: Clean Fresh Start** | 新規 `git init` を行い、スリム化後の資産のみをコミット | リポジトリサイズが最小・完全クリーン・責務が明快 | 過去コミット履歴の blame 参照に別アーカイブが必要 | 🟢 **推奨** |

---

## 7. Protection Lock Declarations

分離作業中の誤操作を防ぐ二重保護宣言です。

### 🔒 Production Asset Lock (本番必須資産の変更・削除禁止)
SM-6 完了まで、以下の 11 アセットの削除・移動・名称変更を厳禁とします。
`active/`, `data/`, `docs/`, `scripts/`, `tests/`, `AGENTS.md`, `DEPLOYMENT_REGISTRY.md`, `package.json`, `appsscript.json`, `.clasp.json`, `.claspignore`

### 🔒 AIOS Asset Lock (AIOS 資産の安全保護)
AIOS 資産（`agents/`, `AI社員/`, `skills/`, `knowledge/` 等）は、AIOS プロジェクトで引き続き利用するため、**無断消去・破壊を厳禁**とし、SM-4 にて確実に新 `aios/` 領域へ退避・移管します。

---

## 8. Shared Asset Policy & Reverse Dependency Rule

### 🚫 Shared Asset Policy (共有資産ルール)
- **原則**: POSTING MAP と AIOS 間の直接共有資産は **「なし（完全独立）」** とする。
- 共通ライブラリが必要となった場合は、本リポジトリ内に保持せず、独立した npm パッケージ / 外部モジュールとして分離管理する。

### 🚫 Reverse Dependency Rule (逆方向依存禁止規則)
- **`POSTING MAP → AIOS` の依存を禁止する**。
- **`AIOS → POSTING MAP` の依存を禁止する**。
- 両者間の直接的な呼び出し・依存関係を完全に断絶する。

---

## 9. Repository Independence Checklist

SM-6 (Repository Freeze) 宣言時に確認する完全独立チェックリストです。

- [ ] リポジトリ直下に `agents/`, `AI社員/`, `skills/`, `knowledge/` が存在しないこと (0件)
- [ ] `v2_api.js` 内に AIOS Bridge 関連コードが存在しないこと (0行)
- [ ] `config_provider.js` 内に `aiosBridge` 等の AIOS フラグが存在しないこと (0件)
- [ ] `AssetRegistry.js` 内に AIOS 参照コメントが存在しないこと (0件)
- [ ] POSTING MAP の全 API エンドポイント (`submitDistribution`, `registerStaff` 等) が正常動作すること (Level-5 Validation 100% PASS)
- [ ] `clasp push` および `clasp deploy` が正常完了すること

---

## 10. Migration Order (SM-4〜SM-6)

今後の分離・移行の実行順序です。

```
Sprint SM-4: Repository Creation Plan
  └── 新 POSTING MAP リポジトリ / aios リポジトリの作成計画、Cutover/Archive/Version方針決定

Sprint SM-5: Physical Separation & Cleanup
  └── AIOS 資産の物理退避、v2_api.js コード切除、不要残骸 (development/ 等) の削除

Sprint SM-6: Repository Freeze & Validation
  └── Acceptance Criteria 検証、Level-5 Validation 実行 & Repository Structure v1.0 宣言

Sprint SM-7: Phase 2 Resume
  └── P2-11D Area Domain Service の実装再開
```

---

## 11. Repository Cutover Strategy (切り替え戦略)

旧モノリス構造から新クリーンリポジトリへの安全な移行タイムラインです。

1. **Phase 1: Freeze Day (構造凍結)**: 旧リポジトリへの新規コード追加を完全停止。
2. **Phase 2: Final Sync (最終同期)**: ロックアセット (Category A) および AIOS 資産 (Category B) の最終抽出。
3. **Phase 3: New Repository Start (新リポジトリ起動)**: 新クリーンリポジトリ `posting-map` の稼働開始。
4. **Phase 4: Old Repository Archive (旧リポジトリ非活性化)**: 旧リポジトリのアーカイブ保管。

---

## 12. Repository Acceptance Criteria (新リポジトリ完成判定基準)

新リポジトリを「完成」と認定するための必須判定基準です。

- [ ] **Deployable Scope**: `active/` および `.clasp.json` のみで `npx clasp push -f` および `clasp deploy` が 100% 成功すること。
- [ ] **API Verification**: POST `submitDistribution`, `registerStaff`, GET `getDeliveryStats` 等の主要 API が正常動作すること。
- [ ] **UI Verification**: ダッシュボード (`active/dashboard/`) および LIFF アプリが正常表示・通信できること。
- [ ] **Zero AIOS References**: コードおよびリポジトリ内に AIOS への直接参照・依存が存在しないこと (0件)。
- [ ] **Production Reality Validation**: MIE-03 実機テスト環境での Level-5 Validation が 100% PASS すること。

---

## 13. Archive Policy (旧リポジトリ保管方針)

旧リポジトリ (`posting-map` の現状全歴史) の保管ポリシーです。

- 旧モノリスリポジトリは **`posting-map-monolith`** という名称で読み取り専用（READ ONLY Archive）として永久保管します。
- これにより、過去の検証コード (`development/`) や旧プロトタイプ (`app/`, `field/`) が必要な場合もいつでも参照可能とし、新リポジトリへのノイズ混入を防ぎます。

---

## 14. Version Reset Policy (バージョンリセット方針)

AIOS から完全独立した単独商品としてのバージョン定義方針です。

- 本分離により、POSTING MAP は単独の商品パッケージとして生まれ変わるため、**「POSTING MAP Product Version 1.0.0 (v1.0.0)」** としてバージョンをリセット・新スタートします。
- 以降のバージョン変更は、セマンティックバージョニング (`MAJOR.MINOR.PATCH`) に厳格に従います。
