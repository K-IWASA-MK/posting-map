# Design Token Mapping Specification

## 1. 概要 (Overview)

本仕様書は、Figma Dev Mode から検出・抽出された各種デザイン数値（Colors, Typography, Radius, Spacing, Shadows）を、POSTING MAP プロジェクトの Single Source of Truth である `design-tokens.json` および `style.css` の CSS カスタムプロパティ（`:root` 変数）へマッピングするための階層構造とルールを定義します。

---

## 2. 変換フローアーキテクチャ (Mapping Flow)

```
[Figma Variable / Styles]
          │ (Dev Mode Inspection)
          ▼
[design-tokens.json] (Tokens SSOT)
          │ (Build / Mapping)
          ▼
[style.css (:root Variables)] (CSS Variables)
          │ (Consumer)
          ▼
[H-App UI Components]
```

---

## 3. カテゴリ別マッピング仕様 (Category Mapping)

### ① Color Tokens Mapping

| Figma Variable Name | Figma Raw Value | Token JSON Path | CSS Variable Name | 用途 |
|---|---|---|---|---|
| `Brand / Primary` | `#f4700f` | `color.primary` | `--color-primary` | ブランドプライマリ（メインボタン、アクセント） |
| `Brand / Support` | `#00B7FF` | `color.info` | `--color-info` | 地図、GPS描画、選択アクティブ状態 |
| `Background / Base` | `#000000` | `color.bg-base` | `--color-bg-base` | 最背面背景（OLED漆黒） |
| `Background / Surface`| `#111315` | `color.bg-surface` | `--color-bg-surface` | サブコンテナ背景 |
| `Background / Card` | `rgba(28,28,30,0.65)` | `color.bg-card` | `--color-bg-card` | Glassmorphismカード背景 |
| `Status / Success` | `#22C55E` | `color.success` | `--color-success` | ONLINE、同期良好 |
| `Status / Warning` | `#F59E0B` | `color.warning` | `--color-warning` | SYNCING、警告 |
| `Status / Danger` | `#EF4444` | `color.danger` | `--color-danger` | ERROR、削除 |

### ② Spacing Tokens Mapping (8px Grid System)

| Figma Spacing Value | Token JSON Path | CSS Variable Name | 用途 / 基準 |
|---|---|---|---|
| `4px` | `space.4` | `--space-4` | パディング補正、微細な位置調整 |
| `8px` | `space.8` | `--space-8` | アイコンとテキスト間、子要素間の基本Gap |
| `12px` | `space.12` | `--space-12` | バッジ内パディング、スモールカードの隙間 |
| `16px` | `space.16` | `--space-16` | ボタンパディング、標準カード内部余白 |
| `24px` | `space.24` | `--space-24` | カード間マージン、大規模セクション余白 |
| `32px` | `space.32` | `--space-32` | 画面上下のセーフエリア余白 |

### ③ Radius Tokens Mapping

| Figma Corner Radius | Token JSON Path | CSS Variable Name | 用途 |
|---|---|---|---|
| `12px` | `radius.small` | `--radius-small` | スウォッチ、チップ、入力フィールド |
| `16px` | `radius.btn` | `--radius-btn` | プライマリ・セカンダリボタン |
| `24px` | `radius.card` | `--radius-card` | グラスモーフィズムカード本体 |
| `9999px` | `radius.full` | `--radius-full` | バッジ、円形アバター |

### ④ Typography Tokens Mapping

| Figma Style Name | Size / Weight / Line-Height | CSS Class / Property | 用途 |
|---|---|---|---|
| `Display / Bold` | `28px` / `900` / `1.1` | `.text-display` | タイトルロゴ、完了数字 |
| `Heading / Bold` | `20px` / `700` / `1.2` | `.text-heading` | セクション見出し、スタッフ名 |
| `Body / Regular` | `14px` / `400` / `1.4` | `.text-body` | 本文、住所表示、入力文字 |
| `Caption / Medium` | `11px` / `500` / `1.3` | `.text-caption` | 補助注記、所属ラベル |
| `Numeric / Mono` | `14px` / `700` / `1.0` | `.text-mono` | スタッフID、最終同期時刻、件数 |

---

## 4. `design-tokens.json` 実装定義

```json
{
  "color": {
    "primary": "#f4700f",
    "info": "#00B7FF",
    "bg-base": "#000000",
    "bg-surface": "#111315",
    "bg-card": "rgba(28, 28, 30, 0.65)",
    "success": "#22C55E",
    "warning": "#F59E0B",
    "danger": "#EF4444"
  },
  "space": {
    "4": "4px",
    "8": "8px",
    "12": "12px",
    "16": "16px",
    "24": "24px",
    "32": "32px"
  },
  "radius": {
    "small": "12px",
    "btn": "16px",
    "card": "24px",
    "full": "9999px"
  }
}
```
