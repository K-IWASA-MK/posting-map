# MIE-03 確定住所マスターデータ 仕様書 (SSOT)

> [!IMPORTANT]
> **Single Source of Truth (SSOT)**:
> 本ドキュメントは、**三重第3区 (MIE-03)** の確定住所マスターデータの唯一の正（SSOT）を明確に定義する仕様書です。
> 過去の実験段階で生成された中間レポートや試算数値（651件、684件等）はすべてアーカイブされ、本仕様書および実データファイルが運用の絶対基準となります。

---

## 1. マスターデータ情報

* **確定データファイル**: [projects/posting-map/data/MIE03_ADDRESS_MASTER.csv](file:///Volumes/SSD_DATA/AI%20Development%20OS/projects/posting-map/data/MIE03_ADDRESS_MASTER.csv)
* **正規化データファイル**: [projects/posting-map/data/normalized/MIE03_ADDRESS_MASTER.csv](file:///Volumes/SSD_DATA/AI%20Development%20OS/projects/posting-map/data/normalized/MIE03_ADDRESS_MASTER.csv)
* **確定レコード総数**: **実データ 858 件**（ヘッダー1行＋実データ858行＝計859行）
* **データ構造 (8カラム)**:
  1. `municipality_code` (自治体JISコード)
  2. `city_name` (市区町村名)
  3. `town_name` (町域名)
  4. `full_address` (フル住所表記)
  5. `postal_code` (郵便番号 7桁)
  6. `latitude` (緯度)
  7. `longitude` (経度)
  8. `source` (データソース識別子)

---

## 2. 運営・開発ルール

1. **一元参照原則**:
   AIエージェント、GASスクリプト、ダッシュボード、および開発者は、データ件数や住所構造の参照時に**必ず本 `MIE03_ADDRESS_MASTER.csv` (858件) のみを一次情報として使用する**。
2. **旧中間ファイルの非参照化**:
   実験過程の旧レポート群は `projects/posting-map/validation/archive/` へ隔離され、アクティブな運用判断からは除外される。
