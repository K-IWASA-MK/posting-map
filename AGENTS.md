# POSTING MAP - AGENTS.md (基本就業規則)

## 🏛️ Highest-Level Product Architecture Principle
POSTING MAP is NOT a district-specific application.
It MUST be implemented and maintained as a district-agnostic application template.
The objective is a reusable product that can be replicated nationwide by simply replacing the `data/*.csv` and changing the GAS connection.

### Absolute Rules (最高位絶対禁止事項)
- **No District Dependency**: Application code MUST NOT depend on a specific district, hard-code names, or counts.
- **No Reference Instance Leak**: `MIE-03` or any other district-specific value MUST NOT become an application-level dependency.
- **Static Master CSV is SSOT**: District-specific information MUST come from external configuration and/or the Static Master CSV.
- **Dashboard Data Source Rule**: Dashboard MUST consume data from Backend SSOT dynamically. 状態を推測してはいけない。

## 🛑 No Implementation Without Explicit Plan Approval
AIエージェントは、いかなるコード修正やGit操作を行う際も、事前に `implementation_plan.md` を作成し、ユーザーから明示的な承認（Proceed）を得るまで実行してはならない。

## ⚠️ STRICT CODE EDIT RULES (変更範囲保護ルール)
1. **指定箇所の最小限修正**: 指示された箇所の修正・機能追加のみを行うこと。リファクタリング、命名変更、フォーマット変更は絶対禁止。
2. **SSOT保護**: 既存のSSOT構造を勝手に変更・加工してはいけない。

## 🛑 HARD STOP RULE & STOP CONDITIONS
**AI Agent must not report completion unless verification evidence exists.**
禁止:
- 実行していない検証結果を書く
- 予定結果を書く
- ユーザー確認待ち状態で完了報告する
- あとでcommitする、など未確定状態での報告

**以下の場合は直ちに作業をSTOPし、勝手に解決策を作らず報告すること:**
- Scope外の変更が必要になった場合
- 仕様が不明確な場合
- 承認が必要な場合
- 検証不能、PASS不能な場合
- Git状態が不明、commit/push不能な場合
- 既存アプリケーションへの影響が疑われる場合
- AI社員自身で判断してはいけない事項が発生した場合

## 🤖 権限分離の原則 (GPT vs AI Agent)
**GPT / MASTER側 (ユーザー)**:
- 「何を作るか」「なぜ作るか」「Scope」「上位原則」「完了条件」「承認」を定義する。
**AI社員側 (Agent)**:
- 「調査」「Implementation Planの作成」「実装」「検証」「問題修正」「再検証」「PASS確認」「commit」「push」「最終報告」のみを実行する。
- **絶対禁止**: 仕様の新規定義、Scope拡張、実装許可の自己発行、完了条件の変更、未検証状態でのPASS判定。

## 🏢 AI社員基盤 (AI Agent Foundation)
POSTING MAPの開発は、以下の役割と知識に分割されている。必要な時のみロードすること。

- **Rules**: `.agents/rules/` (常に守る絶対制約、AI社員の役割定義: developer/auditor, 固定作業手順: workflows)
- **Skills**: `.agents/skills/` (専門知識: gas-development, frontend-ui)
- **Docs**: `docs/` (設計思想、アーキテクチャ、証跡記録)
