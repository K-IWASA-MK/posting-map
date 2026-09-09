# POSTING MAP 量産手順書 (COPY RUNBOOK)

本ドキュメントは、POSTING MAP 親機から新しい地区（`<TARGET_DISTRICT_CODE>`）を複製し、独立した本番システムとして完全稼働させるための**確定手順書（全11ステップ）**です。

新地区作成者は、**コードを一切修正することなく**、以下の手順通りに設定・実行するだけで新地区アプリを立ち上げることができます。

---

## 📋 新地区作成 11ステップ

### Step 1: 親機フォルダーの丸ごとコピー
親機フォルダーをローカルまたは作業領域へ丸ごとコピーします：
```bash
cp -r posting-map/ posting-map-<TARGET_DISTRICT_CODE>/
cd posting-map-<TARGET_DISTRICT_CODE>/
```

---

### Step 2: 新規Googleスプレッドシートの作成
Google ドライブ上で新しい Google スプレッドシートを1つ作成します。

---

### Step 3: スプレッドシート名の変更（地区名SSOT）
作成したスプレッドシートのファイル名を、対象地区コード（例: `MIE-02`, `AICHI-01` など）へ変更します。
> ⚠️ **重要**: スプレッドシート名がシステム全体の唯一の地区名SSOT（正本）となります。「無題のスプレッドシート」のままではプロビジョニングできません。

---

### Step 4: `data/address_master.csv` の差し替え
`data/address_master.csv` を、対象地区のエリアマスターCSVへ差し替えます。
- 形式: 3列または指定列（rowId, cityName, townName 等）
- 必要に応じて `data/boundaries.geojson` および `data/municipality_master.csv` も対象地区のものに差し替えます。

---

### Step 5: `deployment.json` の接続先設定
プロジェクト直下の `deployment.json` を開き、対象地区用のリソース情報へ更新します：
```json
{
  "districtId": "<TARGET_DISTRICT_CODE>",
  "resources": {
    "scriptId": "<新地区用GASプロジェクトID>",
    "deploymentId": "<新地区用WebAppデプロイID>",
    "webAppUrl": "https://script.google.com/macros/s/<新地区用WebAppデプロイID>/exec",
    "spreadsheetId": "<Step 2で作成した新地区スプレッドシートID>",
    "productionLiffUrl": "https://liff.line.me/<新地区用LIFF_ID>"
  }
}
```
> ⚠️ **注意**: `active/dashboard/config.js` は直接編集しません。`deployment.json` のみが設定SSOTです。

---

### Step 6: クライアント設定の同期 (`sync:config`)
以下のコマンドを実行し、`deployment.json` の内容を `active/dashboard/config.js` へ一方向同期します：
```bash
npm run sync:config
```
> ✅ `active/dashboard/config.js` が自動更新され、SSOTチェックを通過します。

---

### Step 7: GAS Script Properties にインフラSecretを登録
対象地区の GAS プロジェクト設定（スクリプトプロパティ）に、管理用 Secret の SHA-256 ハッシュを登録します。

1. 任意の安全な管理用トークンを決め、ハッシュを算出：
   ```bash
   echo -n "管理者のみが知る秘密トークン" | shasum -a 256
   ```
2. 対象 GAS プロジェクトの設定画面（プロジェクトの設定 > スクリプト プロパティ）を開き、プロパティを追加：
   - **プロパティ名**: `PROVISIONING_TOKEN_HASH`
   - **値**: 上記で算出した64桁の小文字ハッシュ値

---

### Step 8: 11シート自動プロビジョニングの実行
ターミナルで秘密トークンを環境変数として渡し、プロビジョニングを実行します：
```bash
POSTING_MAP_PROVISIONING_TOKEN="管理者のみが知る秘密トークン" npm run provision:district
```
> 🎉 スプレッドシート上に以下の **全11シートが完全自動生成** されます：
> 1. `SYSTEM_INFO`（人間・管理者向け保護台帳）
> 2. `配布実績の原本`
> 3. `名簿の原本`
> 4. `保有チラシ枚数の原本`
> 5. `受渡要請履歴の原本`
> 6. `PinStatusの原本`
> 7. `配布実績YYYY-MM`（当月運用用）
> 8. `名簿YYYY-MM`
> 9. `保有チラシ枚数YYYY-MM`
> 10. `受渡要請履歴YYYY-MM`
> 11. `PinStatusYYYY-MM`

---

### Step 9: 品質ゲートによる完成確認 (`check:provisioning`)
プロビジョニングが正常に完了したことを、専用ゲートで自動判定します：
```bash
npm run check:provisioning
```
> ✅ 11シート完全性、CSV件数一致、SSOT一致、進捗0%初期化、前地区データ混入ゼロがすべて自動判定されます。

---

### Step 10: Dashboard 動作確認
1. 対象地区の管理コックピット URL（例: `https://<新地区ドメイン>/manager/` またはローカル）を開きます。
2. 端末台数制限なしでコックピット画面が即座に表示されます。
3. エリア件数や地図が対象地区のデータになっていることを確認します。

---

### Step 11: H-App LINE LIFF 動作確認
1. 配布員用スマホ端末から LINE LIFF URL（`https://liff.line.me/<新地区用LIFF_ID>`）を開きます。
2. 対象地区のピン地図と配布画面が正常に表示されることを確認します。

---

## 🔒 親機不変の原則（コピー後の注意）
- コピー先の子機において「この地区だけ特別に動かないから」と共通コード（`active/`）を個別に改変することは絶対禁止です。
- 改善や修正が必要な場合は、**必ず親機側で修正・全ゲートPASSを経て新Baselineを作成し、そこから再展開** します。
