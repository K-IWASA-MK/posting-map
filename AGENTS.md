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

## 🛑 HARD STOP RULE
**AI Agent must not report completion unless verification evidence exists.**
禁止:
- 実行していない検証結果を書く
- 予定結果を書く
- ユーザー確認待ち状態で完了報告する

## 🏢 AI社員基盤 (AI Agent Foundation)
POSTING MAPの開発は、以下の役割と知識に分割されている。必要な時のみロードすること。

- **Rules**: `.agents/rules/core-rules.md` (常に守る絶対制約)
- **Agents**: `.agents/agents/` (AI社員の役割定義: developer, auditor)
- **Skills**: `.agents/skills/` (専門知識: gas-development, frontend-ui)
- **Workflows**: `.agents/workflows/` (固定作業手順: verification, completion-report, deployment)
- **Docs**: `docs/` (設計思想、アーキテクチャ、証跡記録)
