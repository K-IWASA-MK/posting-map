# POSTING MAP 製品憲法 (Product Architecture Constitution)
## マルチ地区展開アーキテクチャ仕様

本仕様書は、POSTING MAP を全国289地区へスムーズかつ安全に展開するための一元管理・マルチテナント・製品アーキテクチャの永久ガバナンス憲法である。

---

## 1. 基本方針

POSTING MAP は、**「1つの共通アプリケーションを、地区単位の設定差分によって全国展開する」** アーキテクチャ方式を採用する。

- 1 コードベース (Single Codebase)
- 1 フロントエンド配信 (Single GitHub Pages)
- 1 バックエンド実行環境 (Single GAS Web App Deployment)
- 1 LIFF アプリ登録 (Single LINE LIFF ID)

---

## 2. システム分離方針

### 【共通資産】(全国すべての地区で共有・変更禁止領域)
- **Frontend Layer**: UI, JavaScript, Components, Client Loader (`client-loader.js`)
- **Backend Layer**: GAS Runtime, API Engine (`v2_api.js`), Business Logic Services (`AreaService`, `StaffService` 等), Infrastructure Adapters

### 【地区固有資産】
```text
clients/
├── MIE-03/
│   └── config.js   <-- 三重第3区 設定ファイル
├── MIE-02/
│   └── config.js   <-- 三重第2区 設定ファイル
└── AICHI-01/
    └── config.js   <-- 愛知第1区 設定ファイル
```
*※ 各地区の契約ごとに `config.js` のみを個別に保持・ロードする。*

---

## 3. Client ID (テナント識別子) の定義と役割

`client` パラメータ（Client ID）は、画面切替の引数ではなく、**契約地区（Tenant）を特定・識別し、その地区固有設定をロードするための最高優先度識別子** である。

```text
client=MIE-03
    ↓ (Client Loader / Resolver)
clients/MIE-03/config.js
    ↓ (Spreadsheet ID 取得)
Spreadsheet_MIE03 (MIE-03 専用データ領域)
```

---

## 4. データ分離要件 (Data Partitioning Principle)

### 原則: 1 地区 ＝ 1 Spreadsheet (1 Tenant = 1 Spreadsheet)

#### 採用理由:
1. **契約単位管理**: 顧客契約ごとの明確なデータ独立
2. **サブスク解約時のデータ処理**: 解約地区のスプレッドシートのみアーカイブ・削除が可能
3. **データ所有権分離**: 顧客企業の所有権とデータ保護
4. **権限・アクセス制御**: GAS プロパティおよび Google 権限管理の容易化
5. **情報混入（データリーク）防止**: 他地区データとの混在を構造的に遮断

---

## 5. URL 設計 & 構造的禁止事項

### LIFF URL 仕様 (固定一元化)
`https://liff.line.me/{LIFF_ID}?client={CLIENT_ID}`

### 🛑 構造的禁止事項 (Permanent Prohibitions)
- ❌ **地区ごとの LIFF アプリ作成の禁止**
- ❌ **地区ごとの GitHub Pages リポジトリ・ブランチ作成の禁止**
- ❌ **地区ごとの GAS プロジェクト作成の禁止**
- ❌ **フロントエンド・バックエンドコード複製の禁止**

---

## 6. 新地区追加プロシージャ (Standard Provisioning Procedure)

新規地区（例: `MIE-04`）の契約・追加時の標準運用手順：

```text
Step 1: config ディレクトリ複製
        clients/MIE-03/ → clients/MIE-04/
          ↓
Step 2: config.js 設定変更
        { clientId: "MIE-04", spreadsheetId: "新規ID" }
          ↓
Step 3: 新地区スプレッドシート作成・初期化
          ↓
Step 4: LINE URL 発行
        https://liff.line.me/{LIFF_ID}?client=MIE-04
```

---

## 7. 商品アーキテクチャ構成図

```text
                 LINE LIFF (単一エントリ)
                     |
                     | ?client=MIE-03 (または liff.state)
                     ↓
             Client Resolver (client-loader.js)
                     |
                     ↓
             clients/MIE-03/config.js
                     |
          +----------+----------+
          |                     |
          ↓                     ↓
       GAS API              Spreadsheet
 (共通単一バックエンド)   (MIE-03 専用データ領域)
```

---

## 8. 得られるビジネス・運用上のメリット

1. **全国 289 選挙区・自治体へのシームレス展開可能**
2. **開発・修正対象コードは常に 1 つのみ（保守工数の最小化）**
3. **バグ修正・機能追加の即時全国一斉反映**
4. **地区契約単位でのデータ独立・解約処理の簡便化**
5. **完全なマルチテナント分離による高いセキュリティと信頼性の確立**
