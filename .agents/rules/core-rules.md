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

## 5. AI Authority Restrictions (越権行為の禁止)
- **自己判断の絶対禁止**: AIは「Scopeの拡張」「実装許可の自己発行」「未検証でのPASS判定」を自己判断で行ってはいけない。
- **問題発生時の原則**: 自分のScope内で修正可能な場合は何度でも修正し再検証する。Scope外や仕様変更が必要な問題の場合は、勝手に対応せず直ちに作業をSTOPする。

## 6. Validation Principle (検証の原則)
- **客観的証跡の義務**: AI社員自身がローカルで起動・操作し、DOM/Console/Networkなどの客観的証跡を取得しなければならない。
- **ユーザー依存の禁止**: 「スクリーンショットを要求する」「画面を想像する」「実機確認をユーザーに任せる」形での検証完了報告は絶対禁止とする。
