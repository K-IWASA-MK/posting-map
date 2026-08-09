# Deployment Rules

## GAS Deployment SOP (GAS デプロイ運用ルール)
GASのコード変更後、以下の確認を必須とする。これを怠ると、クライアント（実機）が古いデプロイを参照し続け、デバッグが無限ループに陥る原因となる。

### GAS変更時 必須確認リスト
- [ ] `clasp push` 済みであること
- [ ] `clasp deploy` またはデプロイメントが完了していること (`npx clasp deploy -i AKfycbyjNwgZ_6CCv258lqKMrCXJYi0wDR23ZCyyzOQIV1R_WcCF5TQxYXOzZWWSJd_vMyu_ -d "description"`)
- [ ] Web App URL が更新されていること（デプロイメントIDの変更有無の確認）
- [ ] `config.js` （各種クライアント用設定ファイル）内の `gasWebAppUrl` が同期（最新のURLへ更新）済みであること
- [ ] 実機接続先が更新された新しいエンドポイントを向いているか確認済みであること

## Client Configuration Rule (マルチテナント設定分離原則)
全国289地区展開を可能にするため、以下の設定分離規約を厳守すること。
* **唯一の設定点**: `clients/{clientId}/config.js` は地区展開における唯一の設定点（SSOT）とする。
* **直書きの全面禁止**:
  * UI/JSコード内への 地区ID（`districtId`）の直書き禁止
  * UI/JSコード内への GAS Web App URL の直書き禁止
  * UI/JSコード内への Spreadsheet ID の直書き禁止
* **新地区追加手続**: 新規地区の追加は `clients/{clientId}/config.js` の追加・設定のみで完結させること（共通コードの修正禁止）。

## Deployment Synchronization Rule (設定レイヤー同期原則)
POSTING MAPは以下の設定レイヤーを同期状態として管理する。
1. LINE LIFF Entry
2. GitHub Pages Frontend
3. clients/{client}/config.js
4. GAS Deployment
5. Google Spreadsheet

### 同期完了条件
- LIFF ID一致, Client ID一致, Frontend公開ファイル一致, GAS Web App URL一致, Spreadsheet ID一致
### 禁止事項
- 同期対象レイヤー間で異なるURL・ID・設定値を保持しないこと
- 本番利用前に設定レイヤー同期確認を完了すること
*注意事項*: 実機通信確認は別工程の Production Verification として実施する。

## GAS Endpoint Resolution Rule (GAS エンドポイント解像原則)
* **唯一のSSOT**: `gasWebAppUrl` は `clients/{client}/config.js` 内でのみ管理・定義する。
* **ランタイムパラメータ追加の許可**: フロントエンドは `page` や `action` などのランタイム引数を付加（Append）してもよい。
* **直書き・置換の禁止**: フロントエンドは GAS デプロイメント URL のベース文字列を直書き・置換（Replace）してはならない。

## Client Directory Governance Rule (地区ディレクトリ追加管理規約)
* `clients/{clientId}/` は契約・開発対象として明示的に承認された地区のみ作成する。未承認 `clientId` の勝手な追加・ディレクトリ作成は厳禁とする。

## Client Identifier Separation Rule
ID種別を明確化する。
- GAS Script ID: .clasp.jsonで管理
- Spreadsheet ID: clients/{clientId}/config.js spreadsheetIdで管理
- 禁止: Script IDをSpreadsheet IDとして利用すること。

## LIFF Entry Flow Rule
- LIFF Endpoint URLでliff.init完了前のURL変更禁止
- liff.login前のdashboard遷移禁止
- Endpoint URLとredirect_uri一致必須

## Frontend Runtime Asset Rule
active/dashboard/index.htmlが参照するRuntime Assetを必須管理対象とする (app.js, db.js, render.js, components/, assets/, CSS)。HTMLのみ移行することを禁止する。
