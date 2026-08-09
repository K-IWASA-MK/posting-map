# Security Rules

## Data Provisioning Security Rule (SSOTデータ供給セキュリティ規則)
MIE03_ADDRESS_MASTER 等の業務SSOTデータは、会社の競争力そのものであるため、「読める場所に置く」のではなく「管理された経路で供給する」ことを絶対原則とする。

### 📌 許可されるデータフロー (The Only Allowed Flow)
以下の経路でのみデータを供給すること。
1. `CSV` (Repository SSOT)
2. `Provisioning処理` (Local/CI scripts)
3. `GAS管理Spreadsheet内 MIE03_ADDRESS_MASTER` (Secured Endpoint)
4. `Tier1 / Tier2 / Tier3` (Application Logic)

### 🚫 絶対禁止事項
- GitHub Pages等の公開Web配信データパスを経由して GAS から CSV を fetch すること。
- GitHub Pages は UI 公開用途に限定し、SSOTデータ供給経路として利用してはならない。
- 今後の Implementation Plan、コード変更案、設計提案において、`MIE03_ADDRESS_MASTER` を外部公開URLから取得する設計を提示してはならない。

## API Authentication & Authorization Rule
- すべての GAS エンドポイント (`doGet`, `doPost`) は `authenticateRequest` を経由して LINE Token を検証しなければならない。
- `liffToken` なしのリクエストや、偽装されたトークンによるアクセスは `401 Unauthorized` 相当として処理し、後続のビジネスロジックへ到達させてはならない。
- 外部から管理操作が可能なAPIルート（例: 初期設定、削除系操作）は原則としてAPIとして公開せず、GAS管理画面など別の安全な経路からのみ実行可能にすること。
