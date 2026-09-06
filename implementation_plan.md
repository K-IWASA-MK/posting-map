# SYSTEM_INFO 自動同期 実装計画

## 目的
GAS 側で `SYSTEM_INFO` を現在の実態から自動生成し、地区コピー後も手動編集なしで最新状態を保持する。

## SSOT
- 地区名: `Spreadsheet.getName()`
- 端末・契約数: `DeviceManagementService.getDeviceStatus()` / `端末管理`
- Dashboard URL: 共通本番 URL `https://postingmap.jp/active/manager/`
- H-App URL: 共通本番 URL `https://postingmap.jp/`
- LIFF: `deployment.json` の `productionLiffUrl` を起点にした地区設定（GAS 実行時は Script Properties `PRODUCTION_LIFF_URL` を優先し、未設定時は既存設定値を使用）

## 実装
1. `active/business/system/system_info_service.js` を追加。
2. `syncSystemInfo()` で `SYSTEM_INFO` を直接同期・整形。
3. `v2_api.js` に `syncSystemInfo` POST action を追加。
4. 同期は `LockService` で直列化し、既存の `SYSTEM_INFO` を全消去して canonical な key/value 表へ再生成する。
5. `端末管理` は `DeviceManagementService` の既存実装を利用し、端末キー等の秘密値は SYSTEM_INFO に書かない。
6. API 実行は既存の safe-deploy 手順で GAS に反映後、`syncSystemInfo` を1回実行して実シートを最新化する。

## 出力項目
`key | value`
- districtName
- dashboardUrl
- hAppUrl
- liffUrl
- liffId
- contractedPlanCount
- activeContractCount
- pcDeviceIds
- mobileDeviceIds
- syncedAt

## 非対象
- Dashboard UI / H-App UI
- LINE API 動作
- 端末認証方式
- Stripe 台帳
- 月次シート生成
- `端末管理` 自体の構造変更

## 検証
- 静的 diff / SSOT gate
- GAS 構文・API action 確認
- `syncSystemInfo` 実行結果確認
- `SYSTEM_INFO` の地区名・URL・LIFF・契約数・端末一覧確認
- H-App / Dashboard の既存 gate を再実行
