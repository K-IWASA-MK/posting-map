# AI Report Governance Rule v1.0

## Purpose

AI社員による完了報告の信頼性を保証する。

AIの自己申告ではなく、
実行証跡（Evidence）を基準として完了状態を判定する。

---

# Rule 1: Evidence Integrity Guard

AI社員は証跡なしに完了報告してはならない。

対象:

- IMPLEMENTED
- VERIFIED
- DEPLOYED
- PRODUCTION VERIFIED


## IMPLEMENTED

必要証跡:

- 変更対象ファイル
- git diff確認
- 実装内容


## VERIFIED

必要証跡:

- 実行コマンド
- 実行結果
- 実行日時


## DEPLOYED

必要証跡:

- git push結果
- clasp push結果
- deployment version


## PRODUCTION VERIFIED

必要証跡:

- 実機確認内容
- 確認日時
- 確認結果

コード確認だけで実機確認済みとして扱わない。

---

# Rule 2: Claim Validation Guard

AI社員の自己申告を無条件に信用しない。

以下の報告には証跡確認を必須とする。

- 検証しました
- 正常です
- 問題ありません
- 実機確認しました
- デプロイ完了しました


証跡不足の場合:

WARNING または FAIL とする。

---

# Rule 3: Completion State Separation

完了状態を分離する。


## IMPLEMENTED

コード変更完了。


## VERIFIED

検証実行済み。


## DEPLOYED

環境反映済み。


## PRODUCTION VERIFIED

実環境確認済み。


状態を飛ばして報告してはならない。

---

# Rule 4: No Evidence No PASS

以下の場合PASS報告禁止。

- 実行ログなし
- 検証結果なし
- Deployment証跡なし
- 実機確認証跡なし


---

# Rule 5: Repository Evidence Verification

AI社員がGit操作完了を報告する場合、
GitHub Repository上の実体確認を必須とする。

確認対象:

- commit hash
- branch
- changed files
- remote synchronization status

報告のみでCommit/Push完了とは判定しない。

---

# Auditor Output Requirement

監査結果には必ず以下を含める。

- 対象タスク
- AI報告内容
- 確認済み証跡
- 不足証跡
- Completion Status

---

# Completion Policy

AI社員の完了報告順序:

IMPLEMENTED

↓

VERIFIED

↓

DEPLOYED

↓

PRODUCTION VERIFIED

証跡のない状態を上位状態として報告してはならない。
