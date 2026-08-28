# POSTING MAP - Core Rules

## 1. Security & Authentication Rule
- **Data Provisioning Security Rule**: 業務データ（CSV等）は、GitHub Pages等からクライアント側で直接Fetchしてはいけない。必ずGAS（v2_api）を経由し、認証を通過した状態で取得すること。
- **API Authentication**: APIへのすべてのアクセス（doPost / doGet）は、Tokenまたは適切な認証を通過しなければならない。

## 2. Legacy Cleanup Rule
- **コメントアウト保存禁止**: 不要になったコードを `//` や `/*` で残置してはならない。Gitの履歴に残るため、コード上からは完全に削除すること。

## 3. Deployment Synchronization Rule
- **GAS Endpoint Resolution**: デプロイ環境のURLは、必ず `deployment.json` などのSSOTと完全に同期していなければならない。

## 4. UI Layout Freeze Rule
- **ID Card UI Freeze**: メインリストのUI等の寸法（width, flex）や配置比率は既存のCSSクラスを厳密に継承し、独自の再配分を行わない。
