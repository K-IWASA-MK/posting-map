# Repository Freeze Manifest v1.0

**Freeze Date**: 2026-08-01  
**Status**: FROZEN & LOCKED  
**Scope**: Project Root (`/Volumes/SSD_DATA/AI Development OS/projects/posting-map`)  
**Product Version**: POSTING MAP Product Version 1.0.0 (v1.0.0)  

---

## 1. Allowed Top-Level Directories

POSTING MAP プロダクトリポジトリのトップレベル構造は以下の **5 ディレクトリ** に凍結宣言されました。

```
posting-map/
├── active/                    ← 唯一の本番コードベース (clasp deploy 対象)
├── data/                      ← マスターデータ (SSOT MIE03_ADDRESS_MASTER_858.csv & 空間データ)
├── docs/                      ← 仕様書・アーキテクチャ・監査・研究・アーカイブ
├── scripts/                   ← 開発・検証・運用補助スクリプト
└── tests/                     ← テストコード
```

---

## 2. Forbidden Directory & Asset List

以下のディレクトリおよびアセットの本リポジトリへの存在・作成を永久に禁止します。

- **AIOS 資産**: `agents/`, `skills/`, `knowledge/`, `AI社員/`, `/runtime` (ルート直下)
- **重複アプリルート**: `app/`, `field/`, `dashboard/` (ルート直下), `src/` (TS版)
- **一時ファイル・残骸**: `development/`, `scratch/`, `temp/`, `deprecated/`, `legacy/`, `*.bak`, `*.zip`

---

## 3. Business Extension Policy (P2-11D 以降の拡張規則)

P2-11D Area Domain Service 以降のビジネスロジック拡張は、すべて以下のパスへ配置しなければならない。

```
active/business/
├── staff/           ← P2-11A 完了
├── distribution/    ← P2-11C 完了
├── area/            ← P2-11D 予定
├── flyer/           ← P2-11E 予定
└── gps/             ← P2-11F 予定
```

---

## 4. Verification Check Log

- [x] **Top-Level Scan**: `find . -maxdepth 1 -type d` -> 5 ディレクトリのみ (`active`, `data`, `docs`, `scripts`, `tests`) 🟢
- [x] **Anti-AIOS Scan**: `grep -rn "AIOS" .` (docs/archive/ 以外 0件) 🟢
- [x] **Active Dependency Scan**: `grep -rn "app/" active/` / `grep -rn "src/" active/` -> 0件 🟢
- [x] **Production Deployment**: MIE-03 `@220` clasp deploy 成功 🟢
- [x] **Production Reality Validation**: GET / POST / Staff / Distribution / Ranking 全レベル PASS 🟢
