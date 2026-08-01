# Figma Dev Mode Investigation Report

## 1. 概要 (Overview)

本レポートは、Figma Dev Mode を **閲覧・取得用インターフェース** として活用し、Figma をプロジェクトの **Design SSOT（Single Source of Truth）** と定義した際、Dev Mode 経由で取得・解読可能な設計情報一覧を調査・集約した技術報告書です。

Dev Mode を使用することで、デザインファイル上の視覚要素（色・文字・余白・構造）を、開発者が誤認することなく 100% 正確な数値および CSS スニペットとして取得できます。

---

## 2. 取得可能情報一覧 (Dev Mode Inspection Capabilities)

| カテゴリ | Dev Mode 取得項目 | 単位 / 形式 | コード変換の容易さ | 備考 / 用途 |
|---|---|---|:---:|---|
| **Color Tokens** | HEX, RGBA, HSL, Local Variable名 | `#f4700f`, `rgba(...)`, `--color-primary` | 🟢 容易 | CSS変数および `design-tokens.json` への即時転記が可能 |
| **Typography** | Font Family, Size, Weight, Line Height, Letter Spacing | `Inter`, `16px`, `700`, `140%`, `0.05em` | 🟢 容易 | フォントクラス（`.text-heading`, `.text-body`）への直結マッピング |
| **Spacing** | Padding (T/R/B/L), Gap (Auto Layout), Margin | `24px`, `16px`, `8px` | 🟢 容易 | 8px Grid スケール（`--space-8`, `--space-16`, `--space-24`）の照合 |
| **Radius** | Uniform Radius, Independent Corners | `24px`, `16px 16px 0 0` | 🟢 容易 | `--radius-card`, `--radius-btn` へのマッピング |
| **Shadows & Effects** | Drop Shadow, Inner Shadow, Layer Blur, Backdrop Blur | `box-shadow: 0 4px 12px rgba(0,0,0,0.5)`, `backdrop-filter` | 🟢 容易 | グラスモーフィズム (`--color-bg-card`) および立体影の正確なコード化 |
| **Auto Layout** | Direction (Row/Col), Alignment, Resizing (Fixed/Hug/Fill) | `flex-direction`, `align-items`, `flex: 1` | 🟢 容易 | CSS Flexbox (`display: flex`) / Grid への直接対応関係 |
| **Component Props** | Variant Name, Boolean Switch, Instance Property, Text Prop | `variant="Primary"`, `disabled=true`, `label="保存"` | 🟢 容易 | JS コンポーネント関数の `options` / `props` 引数設計へ直接マッピング |
| **CSS Snippets** | Raw CSS, Tailwind CSS, Swift UI, Android Compose | Standard CSS3 code block | 🟢 容易 | コピペおよびクラスリファクタリングの基礎コード |

---

## 3. Dev Mode 画面における可視化表現 (Inspection Output)

### ① Color & Fill Inspector
Figma上で定義された `Primary Orange` をクリックすると、Dev ModeのInspectorパネルには以下が出力されます：
```css
/* Color Token Output */
color: var(--Primary-Orange, #f4700f);
background: var(--Card-Backdrop, rgba(28, 28, 30, 0.65));
```

### ② Auto Layout to Flexbox Mapping
FigmaのAuto Layout設定は、CSS Flexboxへ1対1で直結します：
* `Direction: Vertical` ➔ `flex-direction: column;`
* `Gap: 16px` ➔ `gap: 16px;`
* `Resizing: Fill container` ➔ `flex: 1; width: 100%;`
* `Resizing: Hug contents` ➔ `width: fit-content;`

---

## 4. 結論 (Conclusion)

Figma Dev Mode は、デザイナーの意図（Variableトークン名、Auto Layoutの伸縮性、バリアント状態）を**一切の曖昧さなく100%コード表現へ変換するための必要十分な情報を備えている**ことが確認されました。

これにより、Plugin Bridgeなどの高度な自動化を行わずとも、Dev Modeを閲覧ツールとして固定することで、Figmaを絶対的な Design SSOT として機能させることが可能です。
