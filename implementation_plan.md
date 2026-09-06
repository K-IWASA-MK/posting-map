# POSTING MAP セキュリティ強化 実装計画

## 目的
インターネット公開されている GAS Web App の管理・個人情報系 API を、通常の H-App / Dashboard API と明確に分離し、未認証のボットから管理操作・個人情報取得ができない状態にする。

12シート完全自動プロビジョニングの機能仕様は維持する。今回の変更は API の認証境界を強化するものであり、Spreadsheet 名 SSOT、`address_master.csv`、原本5種、当月5種、SYSTEM_INFO、端末管理の生成ロジックは変更しない。

## セキュリティ上の最優先対象

### P0-1 `provisionDistrict`
- 外部 Web App から直接到達できる管理操作。
- 実行には Provisioning 専用 Secret を必須化する。
- Secret は GAS `ScriptProperties` に保存し、ソースコード・`deployment.json`・GitHub には置かない。
- CLI はローカル環境変数から Secret を取得して送信する。
- Secret 未設定・不一致は `401/UNAUTHORIZED` 相当の JSON エラーで即時拒否。
- `addresses` が空配列・不正型の場合も実行拒否する。

### P0-2 `syncSystemInfo`
- `provisionDistrict` と同じ Provisioning 専用 Secret を必須化する。
- SYSTEM_INFO の単独再同期は内部管理用途のみとする。

### P0-3 `resetDeviceManagement`
- Web App の一般公開 API から端末管理リセットを実行できない状態にする。
- 通常の Dashboard / H-App 端末認証では代替しない。
- リセットは明示的な管理操作として扱い、外部からの無認証実行を禁止する。

### P0-4 `getEvidence`
- 個人情報を含み得るため `isReadOnlyAction` の公開枠から除外する。
- 正規の認証済みリクエストだけに限定する。
- 現在の利用経路を壊さないよう、既存の業務認証を利用する。

## API 信頼境界

```text
Public
  └─ 本当に公開してよい最小限の情報のみ

H-App
  └─ LINE LIFF Token 認証

Dashboard
  └─ Dashboard deviceKey 認証

Provisioning
  └─ Provisioning Secret 認証
      ├─ provisionDistrict
      └─ syncSystemInfo

Internal only
  └─ resetDeviceManagement
```

## Secret 管理

### GAS Script Properties
推奨キー:
- `PROVISIONING_TOKEN_HASH`

平文 Secret は保存しない。提示された Provisioning Token を SHA-256 化し、保存済み hash と比較する。

### CLI
- 環境変数 `POSTING_MAP_PROVISIONING_TOKEN` から取得。
- 未設定なら `npm run provision:district` を実行せず終了。
- Token をログ出力しない。

## Provisioning のSSOT

ユーザーが地区展開時に用意する入力は従来どおり2つだけ。

1. 新地区 Spreadsheet（ファイル名 = 地区名/地区コード）
2. `data/address_master.csv`

Provisioning Secret は「地区データ入力」ではなく、GAS 環境を保護するインフラ Secret として扱う。

地区名は必ず `ss.getName()` から取得し、`MIE-03` 等の地区固有値を共通コードへ追加しない。

## 実装対象

### MODIFY
- `active/api/v2_api.js`
- `active/business/device/device_management_service.js`
- `active/business/system/district_provisioner.js`
- `active/business/system/system_info_service.js`
- `scripts/provision-district.mjs`
- `implementation_plan.md`

### TEST
- 特権 API 認証テスト
- `getEvidence` 認証テスト
- 12シート Provisioning 回帰
- Dashboard 7フェーズ gate
- H-App E2E
- `npm run check:ssot`
- `npm run audit:gate`

## 実装方針

### 1. 特権認証を共通化
GAS 側に Provisioning Secret 検証処理を追加する。

- Token を受信
- Script Properties から hash を取得
- SHA-256 比較
- 不一致は即拒否
- Secret の値自体をレスポンス・ログ・SYSTEM_INFO に出さない

### 2. Provisioner 側でも防御
API Gateway だけに依存せず、`DistrictProvisioner.provisionNewDistrict()` 自体でも Provisioning Secret を検証する。

これにより、将来別の呼び出し経路が追加されても管理処理を無防備にしない。

### 3. SystemInfoService 側でも防御
`syncSystemInfo()` も同様に特権操作として保護する。

### 4. DeviceManagementService
`resetSheet()` は Web App から無条件実行できないようにする。
通常の端末登録・Dashboard 認証・QR ペアリングには影響させない。

### 5. `getEvidence`
公開 read-only リストから除外し、LINE 認証済みの業務リクエストとして扱う。

## Google Maps API Key
今回のコード改修とは別に、Google Cloud Console 側で以下を確認する。

- アプリケーション制限: `https://postingmap.jp/*` 等、実際の本番ドメインに限定
- API 制限: 必要な Maps API のみに限定
- 利用量・課金アラートを設定

API Key 自体を GitHub のソースコードへ移す変更は行わない。

## 検証条件

### 未認証
- `provisionDistrict` → BLOCK
- `syncSystemInfo` → BLOCK
- `resetDeviceManagement` → BLOCK
- `getEvidence` → BLOCK

### 正規認証
- 正しい Provisioning Secret + `provisionDistrict` → PASS
- 正しい Provisioning Secret + `syncSystemInfo` → PASS
- 正規 H-App LINE Token + `getEvidence` → PASS
- 正規 Dashboard deviceKey → 既存 Dashboard API PASS

### 回帰
- 12シートが従来どおり生成される
- 858エリアが維持される
- SYSTEM_INFO が Spreadsheet 名 SSOT のまま
- `端末管理` の契約・端末状態が維持される
- Dashboard 7フェーズ ALL PASS
- H-App E2E ALL PASS
- `npm run check:ssot` PASS
- `npm run audit:gate` PASS
- `git diff --check` PASS

## 完了条件

```text
未認証インターネット
        ↓
      GAS API
        ↓
管理操作 / 個人情報
        ↓
     BLOCK

正規認証
        ↓
     ALLOW
        ↓
既存機能は変更なし
```

この状態を「Internet-facing Security Production Ready」とする。
