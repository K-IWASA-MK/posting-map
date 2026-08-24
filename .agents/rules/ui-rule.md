# UI Rules

## ID Card UI Freeze v1.0 Rule（IDカードUI永久固定規則）
IDカード画面（`settings`）は **Completed v1.0** としてデザイン・レイアウト・配色が完全固定（UI Freeze）されています。
以下の要素に対する **色・レイアウト・余白・サイズ・配置の変更は原則絶対禁止** とし、内部機能追加・バグ修正のみを許可します。

### 確定・固定仕様 (ID Card Completed v1.0)
* **ヘッダー**: 「全体エリア」, `0 / 858` 表示, `ONLINE` インジケーター, 同期率表示（`0%`）
* **配布員情報**: 「公式配布員」, `STAFF ID`（ブランドカラー `#EA5F08` / オレンジ枠 ＋ 控えめな Glow）
* **IDカード本体**: `AUTHORIZED STAFF`, プロフィール画像（円形）, 氏名, 支部名, `FIELD OPERATIONS`, `TERMS` / `PRIVACY` / `LICENSE` モーダルリンク
* **下部ナビゲーション**: 「在庫登録」「在庫一覧」「ID」「次へ」

### 🔒 ID Card 専用機能スコープ (Dedicated Scope Rule)
`TERMS`, `PRIVACY`, `LICENSE` の3つのリンク・機能は **ID Card 専用機能** として UI Specification に永久固定します。他画面への移設・重複配置・他用途での再利用を禁止します。

## UI Domain Separation & Responsibility Governance Rule (UIドメイン分離・責務統制規則)
POSTING MAP の全画面は以下の2つのドメインに明確に分離・統制し、責務が混在する実装を禁止する。

### Private Domain（本人専用）
- 🪪 IDカード (LINEプロフィール, STAFF ID, 氏名, 所属支部, 認証状態 ※自動表示・編集不可)
- 📦 保有枚数 (保管場所, 保有枚数, 更新日時 ※ログイン本人のみ更新可能)
- 責務: 本人の識別情報のみ扱い、本人の入力・更新のみ許可する。他ユーザーの情報を表示しない。

### Shared Operations Domain（全員共通）
- 📊 在庫一覧 (支部全員の保有枚数, 保管場所, 更新日時)
- 🗺 エリア (Tier1 市町村, Tier2 町名, Tier3 住所, 配布状況)
- 🏆 ランキング (配布枚数, 配布率, 順位, 支部全体実績)
- 責務: 支部全体の業務データを扱う。本人専用の編集UIを配置しない。

### 🚫 Prohibited (絶対禁止事項)
- Private Domain に他人のデータを表示すること。
- Shared Operations Domain に本人専用の編集UIを配置すること。
- 同一データを Private と Shared で重複保持すること。
- 個人情報を Shared Domain の状態管理へコピーすること。
- 責務を跨ぐ実装・画面設計を行うこと。

## Header Policy (ヘッダー表示固定規則)
ヘッダー表示項目は以下の **4要素** に永久固定する。
1. 全体エリア
2. 完了数 / 総数 (`header-count`)
3. ONLINE インジケーター
4. 配布率 (`header-pct`)

*※最終更新時刻などの不要な追加情報をヘッダーに表示してはならない。*

## UI Verification Policy
UI修正は影響範囲に応じて検証レベルを判断する。
- Level 1: CSS class / text only → Static review only
- Level 2: Layout / input / positioning change → Browser screenshot verification required
- Level 3: Logic / API / data flow change → Browser verification + functional test required
不要な全面調査は禁止し、最小検証で完了すること。

## UI Data Display Rule
入力フォームでは表示用文字列と保存データを混在させない。
- 禁止: input.valueへ単位文字を追加、数値入力欄へ「枚」「円」「人」等を保存
- 原則: input.value = raw data, unit label = separate DOM element
スマホ入力欄はiOS Safariの削除操作を必ず確認する。

## UI Control Rule
カード内要素は役割に応じて配置規則を統一する。
- 数値＋単位 ➔ 中央一体表示（例: `6,000枚`）
- 市町村名 ➔ 中央表示（例: `桑名市`）
- 選択矢印 ➔ 右固定（`absolute right-6`）
- 編集操作 ➔ 透明レイヤー（`absolute inset-0 opacity-0`）

## 🏛️ POSTING MAP KPI Header Visual SSOT（ダッシュボード計器BAR固定規則）

統括管制ダッシュボード（`scripts/operations/index.html`）のヘッダー計器BAR（`#situation-bar`）は、**以下の確定寸法比率を Visual SSOT として完全固定（UI Freeze）** とする。

### 確定寸法比率
```
①配布状況 (195px) : ②エリア内訳 (310px) : ③配布実績 (200px) : ④保有チラシ (200px) : ⑤名簿 (135px)
```

### 絶対遵守規則
1. **外形寸法・視覚比率の固定**: 5カードの外形寸法・視覚比率は完全固定とする。
2. **自動伸縮・再配分の禁止**: データ桁数によるカード幅変更、自動伸縮（`min-w-0` 等）、`flex-1` による動的再配分は絶対禁止。
3. **桁数増加の内部吸収原則**: 桁数増加（3桁 ➔ 4桁、6桁枚数等）は、カード内部の `padding`、`gap`、配置、等幅数字フォント（`font-mono`）等の内部設計で吸収し、カード幅を変更してはならない。
4. **フォントサイズ縮小の禁止**: 桁数を収めるために数字フォントサイズ（`text-lg font-bold font-mono text-white`）を小さくして帳尻を合わせる行為は絶対禁止。
5. **変更判定基準**: 変更時は「数値が収まったか」だけでなく、確定 Visual SSOT スクリーンショットとの**視覚比率・重量感・アライメント**を基準に判定する。

### 禁止されたアンチパターン
- ❌ 「②だけ巨大化（flex-1 放置で 347px 等）」
- ❌ 「他カードを削って帳尻合わせ（3・4枚目を170pxにする等）」
- ❌ 「数字を小さくして収める（text-sm / text-xs への縮小）」
- ❌ 「均等幅にして窮屈（grid-cols-5 等）」
- ❌ 「4桁対応のたびに寸法変更」
