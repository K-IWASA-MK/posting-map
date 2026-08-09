# Legacy Cleanup Rule

## Purpose

新規実装による旧コード肥大化を防止する。

## Requirement

AI Agent は新機能、新API、新モジュール、新処理を追加した場合、
既存コードへの影響確認を必須とする。

確認項目:

- 既存処理で代替可能になったコード
- 重複実装
- 未使用API
- Dead Code候補
- 古い認証・通信処理
- 不要になった設定・フック

## Cleanup Report

実装完了報告時、以下を提示する。

Legacy Cleanup Check:

- 対象:
- 判定:
  - KEEP
  - REVIEW
  - REMOVE候補

- 理由:
- 推奨対応:

## Removal Rule

AI Agent は不要コードを発見した場合でも、
承認なしに削除してはいけない。

必ず Removal Plan を提示し、
明示承認後に削除する。

## Prohibited

不要コードをコメントアウトして保存することは禁止する。

Git履歴を唯一の保存場所とする。

## Scope

本ルールは以下を対象とする。

- API
- UI
- Business Logic
- GAS Script
- Configuration
- Test Code
- Documentation
