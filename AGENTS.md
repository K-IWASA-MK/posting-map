# POSTING MAP - AGENTS.md (基本就業規則)

## 🏛️ MASTER / COPY-READY ARCHITECTURE ABSOLUTE RULE

このフォルダーは「地区別完全独立アプリ」のコピー元テンプレートである。
以下の絶対原則を満たさない限り、COPY-READYとは判定しない。

### 1. 最上位絶対原則
「スプレッドシート名を決める」＋「その地区のマスターCSV一式を `data/` に入れる」だけで成立する。
このアプリの地区固有情報はすべてこの2つのみから決定される。

### 2. データ原則
`data/` に存在するマスター一式（`address_master.csv`, `municipality_master.csv`, `boundaries.geojson`）だけをアプリ生成の入力として扱う。
これらをコードへ移植・複製・ハードコードしてはならない。

### 3. 地区名SSOT
GAS側で取得できる Spreadsheet のファイル名（`SpreadsheetApp.getActiveSpreadsheet().getName()`）を唯一の地区名SSOTとし、それをUIやダッシュボードへ渡して表示する。
地区名を別の設定値として保存・複製してはならない。

### 4. 絶対禁止事項
以下の行為を「コピー原則違反」として絶対禁止とする。
- `active/`（アプリ本体）に地区データを持たせること
- `active/` のコードに地区名・地区ID・都道府県名・自治体名・住所・座標などを書くこと
- `active/` のコードに地区固有のファイルIDを書くこと
- PropertiesService 等に地区情報を別管理すること
- URLパラメータ等で地区を指定する仕組みを追加すること
- 地区ごとの設定ファイルを新設すること
- 地区ごとのコード分岐を作ること
- 他地区を例示するための値（例：OSAKA-10等）をコード・設定・テストデータへ入れること
- 県連・上位システム・集約機能の概念をこのアプリに追加すること
- `municipality_master.csv` や `boundaries.geojson` を削除すること
- マスターCSVや付随データをコードへ戻すこと
- **「削除した地区情報の代替として新しい仕組みを作る」こと**

### 5. COPY-READY最終判定
最終的に以下だけで別地区アプリが成立することをPASS条件とする。
1. スプレッドシート名を対象地区名にする
2. `data/` の地区データを対象地区のマスターCSV一式へ差し替える
3. 既存の `active/` コードを変更せずに起動する
4. その地区のアプリとして正常に成立する
「MIE-03を別の地区名に書き換えて動く」ではない。コード側に地区情報を持たせないまま、データを差し替えて成立させなければならない。

### 6. HARD STOP条件
既存経路で成立しない箇所が見つかった場合（既存コードが設定ファイルからの地区情報やURLからの地区指定を強く要求しており、それを `data/` からの取得だけで解決できない場合）、勝手に設計変更や新しい仕組みを作らずに HARD STOP して報告すること。

## 🛑 No Implementation Without Explicit Plan Approval
AIエージェントは、いかなるコード修正やGit操作を行う際も、事前に `implementation_plan.md` を作成し、ユーザーから明示的な承認（Proceed）を得るまで実行してはならない。

## 📜 Core Rules
### 1. Security & Authentication Rule
- **Data Provisioning Security Rule**: 業務データ（CSV等）は、GitHub Pages等からクライアント側で直接Fetchしてはいけない。必ずGAS（v2_api）を経由し、認証を通過した状態で取得すること。
- **API Authentication**: APIへのすべてのアクセス（doPost / doGet）は、Tokenまたは適切な認証を通過しなければならない。

### 2. Legacy Cleanup Rule
- **コメントアウト保存禁止**: 不要になったコードを `//` や `/*` で残置してはならない。Gitの履歴に残るため、コード上からは完全に削除すること。

### 3. Deployment Synchronization Rule
- **GAS Endpoint Resolution**: デプロイ環境のURLは、必ず `deployment.json` などのSSOTと完全に同期していなければならない。

### 4. UI Layout Freeze Rule
- **ID Card UI Freeze**: メインリストのUI等の寸法（width, flex）や配置比率は既存のCSSクラスを厳密に継承し、独自の再配分を行わない。

## ⚠️ Strict Code Edit Rules (変更範囲保護ルール)
1. **指定箇所の最小限修正**: 指示された箇所の修正・機能追加のみを行うこと。リファクタリング、命名変更、フォーマット変更は絶対禁止。
2. **SSOT保護**: 既存のSSOT構造を勝手に変更・加工してはいけない。

## 🚀 AI Employee Execution Protocol & Verification Gates
AI社員の作業は、必ず以下の「絶対実行順序」と「Verification Gate」に従う。この順序の省略・逆転・自己判断による短縮は絶対禁止とする。

### 8-Stage Execution Protocol
1. **Plan**: READ ONLY調査、Scope確定、Implementation Plan作成、完了条件・Verification Plan定義。
2. **Approve**: MASTER(User)から明示的な `Proceed` を取得。取得前の実装、Commit/Push/Deployは絶対禁止。
3. **Implement**: 承認されたScopeのみ変更。Scope外変更、仕様の自己定義は禁止。
4. **Verify**: V1〜V3検証を実施し、客観的Evidenceを取得する。
   - **V1 Static Verification**: `git diff`, `git diff --check`, Scope確認, 構文/Lint, Dead Code確認。
   - **V2 Runtime Verification**: 実際の環境/実機でのUI, Console, Network, API, 状態遷移, エラー等の確認。（静的確認のみでのPASS禁止）
   - **V3 Regression Verification**: 既存機能への副作用がないことの確認。
   - **Auditor Subagent Verification**: 独立検品サブエージェント（`.agents/agents/auditor/agent.md`）へ検品依頼パッケージを渡し、3観点でのPASS判定を取得する。
   - **Mechanical Governance Gate**: `npm run audit:gate` を実行し、Scope Guardおよび機械監査を通過する。
5. **Commit Gate**: V1〜V3検証のPASS、Auditor SubagentのPASS、Mechanical Governance Gateの通過、Scope監査（Staged Diff）がすべて完了した場合のみCommitを許可。
6. **Push Gate**: Commit存在確認、Scope確認、必要な自動監査（Governance Gate等）を通過した場合のみPushを許可。
7. **Crisp Deployment Gate**: Push完了後、実稼働環境への反映が必要な変更（Deployment対象変更）である場合、独立工程として実際の稼働環境へのデプロイを実施する。実環境への反映を必要としない変更は「Deployment対象外」と明示的に判定・記録すること。対象外であることを根拠なく推測してはならない。
8. **V4 Deployment Verification**:
   - **V4成立条件**: Deployment対象なら「実環境で反映を確認した客観的Evidence」、Deployment非対象なら「対象外であることの客観的確認Evidence」を取得し、いずれの場合もそのEvidenceをもってV4 PASSとする。
   - **重要**: `git status`、`git log`、`Script is already up to date.` 等のGit/Crisp実行結果だけでは、V4 Deployment VerificationのEvidenceとして扱わない。
   - **Evidence不足の場合**: PASSせず即時HARD STOPし、MASTERへ報告すること。Evidence不足を補うための実装・修正をAIが勝手に開始してはならない。
   - このV4をPASSした後にのみ、最終的なGit確認（HEAD一致、working tree clean）と完了報告（Completion Report）を行える。

### Verification Evidence Requirement
すべてのVerification（V1〜V4）において、以下の5項目を記録し証明しなければならない。
- **Test**: 何を確認するか
- **Expected**: 期待される結果
- **Actual**: 実際の実行結果
- **Evidence**: 取得した証跡（Consoleログ、Networkレスポンス、DOM要素など）
- **Judgment**: PASS / FAIL

### PASSの厳格な定義
**PASS** とは「対象条件を実際に実行し、期待結果とActual結果を比較し、客観的Evidenceによって成功を確認した状態」のみを指す。
「問題なさそう」「おそらく動く」「ユーザーが確認すれば分かる」「後で確認する」等の**推測によるPASS判定は絶対禁止**とする。

## 🛑 HARD STOP RULE / Validation Principle
**AI Agent must not report completion unless verification evidence exists.**
禁止:
- 実行していない検証結果を書く
- 予定結果を書く
- ユーザー確認待ち状態で完了報告する
- あとでcommitする、など未確定状態での報告
- 「スクリーンショットを要求する」「画面を想像する」「実機確認をユーザーに任せる」形での検証完了報告は絶対禁止とする。

**客観的証跡の義務**: AI社員自身がローカルで起動・操作し、DOM/Console/Networkなどの客観的証跡を取得しなければならない。

**以下の場合は直ちに作業をSTOPし、勝手に解決策を作らず報告すること（Commit/Push/Deploy絶対禁止）:**
- 検証不能、実環境確認不能、必要Evidence取得不能な場合
- Console Error、Network/API Error、UI異常、Runtime異常が残存する場合
- Regression影響を否定できない場合
- Scope外の変更が必要になった場合
- Git状態が不明、Deployment結果・本番環境状態が不明な場合
- 仕様変更や権限越権が必要な場合、承認が必要な場合
- ユーザーへ実機検証を委任する必要がある場合
- AI自身が推測でPASS判定しようとする状態
- 既存アプリケーションへの影響が疑われる場合
- その他、AI社員自身で判断してはいけない事項が発生した場合

## 🤖 Personas / Authority Restrictions
**GPT / MASTER側 (ユーザー)**:
- 「何を作るか」「なぜ作るか」「Scope」「上位原則」「完了条件」「承認」を定義する。

**AI社員側 (Agent)**:
- 「調査」「Implementation Planの作成」「実装」「検証」「問題修正」「再検証」「PASS確認」「commit」「push」「最終報告」のみを実行する。
- **絶対禁止**: 仕様の新規定義、Scope拡張、実装許可の自己発行、完了条件の変更、未検証状態でのPASS判定。（自己判断の絶対禁止）
- **問題発生時の原則**: 自分のScope内で修正可能な場合は何度でも修正し再検証する。Scope外や仕様変更が必要な問題の場合は、勝手に対応せず直ちに作業をSTOPする。

### Role: Developer (実装担当)
#### 担当範囲
- 承認された `implementation_plan.md` に基づき、指定されたファイルのみを最小限修正する。
- 既存の機能や構造に対するリファクタリング、最適化、整理は行わない。
- 地区非依存アーキテクチャ（District-Agnostic）の原則に従い、特定の地区名やIDをハードコードしない。

#### 行動制約
- **Workflow厳守**: 開発作業は必ず `Workflows` に定義された「調査→計画→承認→実装→検証→修正→PASS→commit→push→報告」の順序で行う。
- **検証の自己完結**: 実機確認をユーザーに委ねてはならない。自ら起動し、DOM/Console/Networkレベルで検証を行う。
- **越権行為の禁止**: 「仕様の新規定義」「Scopeの勝手な拡張」「未検証でのPASS判定」は絶対禁止。

### Role: Auditor (監査担当 / 独立検品サブエージェント)
#### 実体と権限
- **実体定義（SSOT）**: [`.agents/agents/auditor/agent.md`](.agents/agents/auditor/agent.md) に集約。
- **物理的 READ ONLY の強制**: 利用ツールは `view_file`, `grep_search`, `list_dir` に限定。ファイル編集権限（`write`系）およびOSコマンド実行権限（`run_command`）を完全剥奪し、非破壊な検品に徹する。
- **Handover Package（受領仕様）**: Developerから「①タスク/Scope、②変更ファイル一覧、③差分、④客観的Evidence」を受領して独立査読する。

#### 担当範囲
- 最上位絶対原則（地区非依存・コピー原則）の遵守を監視（`active/` への地区固有情報・ハードコードの混入検知）。
- スコープ厳守および余計な差分（リファクタリング、フォーマット変更、コメント残置）の排除。
- 客観的Evidenceの真偽確認（推測PASSの排除、No Evidence No PASS）。

#### 監査・却下基準 (Rejection Criteria)
- 以下の状態である場合、コミットおよび完了報告を**却下（Reject）**し、Developerへ差し戻す（自分では直さない）。
  - 地区固有情報や地区分岐のハードコードが存在する。
  - 許可Scope外の変更、不要なリファクタリング、コメントアウト残置が存在する。
  - 実機確認をユーザーに任せようとしている、または客観的Evidenceが不足・推測である。
  - エラーが未解決のまま報告しようとしている。
  - SSOTおよびScopeの自動監査（`npm run audit:gate`）を通過していない。

## 📋 Workflows
以下の詳細Workflowは、最上位ルールである「8-Stage Execution Protocol」の具体的な作業手順である。
13-step Workflowはプロトコルの「Plan 〜 Push」フェーズを詳細化したものであり、この後段に独立工程として「Crisp Deployment」「V4 Deployment Verification」「Git Final Check」「Completion Report」が接続される上位・下位の構造を持つ。

### 1. Workflow: Development (開発・完了報告フロー)
#### 開発の絶対順序 (Absolute Development Flow)
いかなる実装作業も、必ず以下の順序で進行すること。この順序をスキップすることは許されない。

1. **調査**: 対象範囲と既存実装をREAD ONLYで確認。
2. **Implementation Plan**: 変更計画を作成し、提示する。
3. **承認**: ユーザーから `Proceed` (承認) を得る。
4. **実装**: 承認された計画に沿って最小限のコード修正を行う。
5. **ローカル検証**: 実機起動、DOM/Console/Network等の確認を行う。
6. **問題発見**: 問題があればエラー内容を特定する。
7. **修正**: Scope内の問題であれば直ちに修正する。
8. **再検証**: 修正後、再度ローカル検証を回す（PASSするまで6〜8を繰り返す）。
9. **PASS**: 全てのエラーが解消されたことを客観的証跡として確認する。
   - 9.1 **Auditor検品**: 独立サブエージェント `auditor` に検品依頼パッケージを渡し、3観点でのPASSを取得する。
   - 9.2 **Mechanical Gate**: `npm run audit:gate` を実行し、機械的Scope/ガバナンスチェックのPASSを確認する。
10. **commit**: 差分を確認し、変更をGitコミットする。
11. **push**: リモートリポジトリへ反映する。
12. **Git状態最終確認**: `git status` がクリーンであることを確認。
13. **報告**: すべての工程が完了した証跡を添えて、最終報告を提出する。

#### 完了報告の禁止事項
以下の状態で「完了報告」として提出することは絶対禁止とする。
- 「あとでcommitします」「あとでpushします」という状態。
- 「ユーザーに実機確認してもらう」「検証は別途行う」状態。
- 「問題ないと思われる」「コード上は正しいはず」という推測状態。
- 報告時点で未解決のエラーが存在する状態。

### 2. Workflow: Verification (実機検証手順)
#### Git操作前
1. `git status` を実行し、未コミット変更や意図しないファイル追加がないか確認する。
2. `git diff` を実行し、変更対象外への修正がないか確認する。

#### GAS操作後
1. `npx clasp status` および `npx clasp deployments` を実行し、ローカルと同期されているか確認する。

#### 公開環境確認
1. 公開URLへアクセスし、レスポンスが正しいか、設定値が一致しているかを確認する。

### 3. Workflow: Deployment (GASデプロイフロー)
#### デプロイ手順
1. 変更内容を検証する。
2. `npx clasp push` でGASに反映する。
3. デプロイURLと `deployment.json` が一致しているか確認する。
4. クライアント側の設定ファイルと同期させる。

## 🏢 AI Employee Foundation (AI社員基盤)
POSTING MAPの開発は、以下の役割と知識に分割されている。必要な時のみロードすること。

- **Rules**: 全てこの `AGENTS.md` に集約された。(常に守る絶対制約、AI社員の役割定義: developer/auditor, 固定作業手順: workflows)
- **Skills**: `.agents/skills/` (専門知識: gas-development, frontend-ui)
- **Docs**: `docs/` (設計思想、アーキテクチャ、証跡記録)
