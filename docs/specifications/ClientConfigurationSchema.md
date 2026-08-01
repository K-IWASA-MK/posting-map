# Schema Specification: Client Configuration Schema

クライアント固有の設定ファイル `config.js` において定義すべきパラメータ構造および拡張メタデータのスキーマ仕様です。

---

## 1. Schema Definition (JSON/Javascript Object)

`config.js` は、グローバルオブジェクト `window.PMS_CLIENT_CONFIG` に以下の構造を代入する形式で記述されます。

```javascript
window.PMS_CLIENT_CONFIG = {
  // 地区の基本識別子
  districtId: "MIE-04",
  districtName: "三重県第4区",
  
  // 実行環境区分 (development | production)
  environment: "production",
  
  // 接続先API定義
  api: {
    gasWebAppUrl: "https://script.google.com/macros/s/AKfycbwgiOFU5iudUS6UscNU-MZhnxZJaqJHywVA9ivA-GE0uLe02fi7mmBU474lWa1TD7-R/exec"
  },
  
  // LINE LIFF アプリ連携定義
  line: {
    liffId: "2010177345-tXZIMAJK"
  },
  
  // 地区固有の利用機能フラグ (Feature Flags)
  features: {
    photoUpload: true,  // 写真アップロード報告機能のオンオフ
    gpsTracking: true   // GPSトラッキング軌跡機能のオンオフ
  }
};
```

---

## 2. Parameter Details

| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `districtId` | String | **Yes** | 地区コード（大文字英数とハイフン、例: `MIE-03`, `TOKYO-01`）。 |
| `districtName` | String | **Yes** | 地区の表示名称（高齢のユーザーや管理者が識別しやすい正式名）。 |
| `environment` | String | **Yes** | 実行段階区分（`production` / `development`）。 |
| `api.gasWebAppUrl`| String | **Yes** | 本番デプロイされた Google Apps Script の Web App URL (`/exec` で終わるもの)。 |
| `line.liffId` | String | **Yes** | LINE Developers で発行された LIFF アプリID。 |
| `features.photoUpload`| Boolean| **Yes** | `true` の場合、配布員画面での報告時にGPSカメラ写真の送信を許可。 |
| `features.gpsTracking`| Boolean| **Yes** | `true` の場合、現場歩行時のバックグラウンド軌跡トラッキングを有効化。 |
