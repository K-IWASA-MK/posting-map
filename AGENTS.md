# POSTING MAP - AGENTS.md (AI Contract)

## 🏛️ Highest-Level Product Architecture Principle: District-Agnostic Template Architecture

POSTING MAP is NOT a district-specific application.

POSTING MAP MUST be implemented and maintained as a district-agnostic application template that can be independently deployed to any district by:
1. **Copying the entire application folder.**
2. **Replacing the district Static Master CSV.**
3. **Configuring the destination Runtime Backend / GAS connection.**

The copied application MUST operate as an independent district instance without modifying application logic.

### Absolute Rules (最高位絶対禁止事項)
- **No District Dependency**: Application code MUST NOT depend on a specific district.
- **No Hard-coded Names**: Application code MUST NOT hard-code district names or municipality names.
- **No Hard-coded Counts**: Application code MUST NOT hard-code address counts or population numbers.
- **No District Address Masters in Code**: Application code MUST NOT hard-code district-specific address masters.
- **No District Backend Sheets**: Application code MUST NOT require a district-specific Backend Sheet.
- **No Reference Instance Leak**: `MIE-03`, `MIE03_ADDRESS_MASTER`, `858`, or any other district-specific value MUST NOT become an application-level dependency. MIE-03 is strictly a Reference Instance and MUST NOT be conflated with the product template itself.
- **Static Master CSV is SSOT**: District-specific information MUST come from external configuration and/or the Static Master CSV (`data/*.csv`). The Static Master CSV is the SSOT for district geography, municipalities, towns, coordinates, and map pin population.
- **Standardized Backend Contract**: Runtime Backend MUST expose only the standardized POSTING MAP operational contract (the 5 standard sheets: `名簿`, `配布実績`, `保有チラシ枚数`, `受渡要請履歴`, `PinStatus`).
- **Dynamic Consumption**: Dashboard and application logic MUST consume district data dynamically.
- **No District If/Else**: Adding `if/else` branching for other districts is strictly forbidden.

### Replication Requirement (レプリケーション要件)
The canonical deployment model is:
```
POSTING MAP Template → Copy entire folder → Replace district CSV → Configure Runtime Backend connection → Launch independent district instance
```
A district replication test MUST require:
- Application code changes: **0**
- District-specific source-code modifications: **0**
- Existing district instance: **unaffected**

### Development Gate (開発ゲート)
Any implementation that introduces a dependency on a specific district, municipality, address master, fixed population, or district-specific Backend structure MUST be rejected before implementation.
This principle has higher priority than individual Phase-level implementation convenience.

---

## 🛑 No Implementation Without Explicit Plan Approval
AIエージェントは、いかなるコードの修正、コミット、プッシュ、またはその他の実行環境への変更を行う際も、事前に以下のステップを100%遵守しなければならない。
1. **設計・計画の明記**: 必ず `implementation_plan.md` を作成または更新する。
2. **明示的な承認（Proceed）の獲得**: ユーザーから明示的な実行許可（「Proceed」等）を得るまで、コード変更・Git/clasp 操作を行わない。

## ⚠️ STRICT CODE EDIT RULES (コード変更に関する絶対禁止事項)
1. **指定箇所の最小限修正**: 指示された箇所の修正・機能追加のみを行うこと。リファクタリング、命名変更、フォーマット変更は禁止。
2. **勝手な最適化・設計変更の禁止**: 処理順序、通信方式など動作に影響する設計変更は禁止。
3. **差分の明確化**: 変更対象のファイル・箇所を事前に明示し、指定箇所以外の変更を行ってはならない。
4. **影響範囲の事前報告**: 指示されていない処理に影響する可能性がある場合は、実装を中止して承認を求めること。

## ⚠️ Change Scope Protection Rule (変更範囲保護ルール)
- 指示されたファイル・関数・処理以外は一切変更してはならない。
- 「ついでの修正」「リファクタリング」「最適化」「命名変更」「コード整理」「フォーマット変更」を禁止する。
- 違反した場合は実装失敗（FAILED）とする。

## ⚠️ Mandatory Diff Verification (差分監査必須)
Commit および Push の前に必ず以下を実施すること。
- `git diff` により変更差分を確認する。
- Implementation Plan に記載された変更対象のみが差分に含まれていることを確認する。
- 変更対象外のファイル・関数・ロジックに差分が存在する場合は Commit・Push を禁止する。

## 🛑 HARD STOP RULE
**AI Agent must not report completion unless verification evidence exists.**

禁止:
- 実行していない検証結果を書く
- 予定結果を書く
- ユーザー確認待ち状態で完了報告する

Completion requires:
1. Command executed
2. Result captured
3. Target confirmed
4. Pass/Fail judgement recorded

## Detailed Rules
Detailed engineering rules are maintained separately.

Reference:
- **Architecture**: `.agents/rules/architecture-rule.md`
- **Data**: `.agents/rules/data-rule.md`
- **Security**: `.agents/rules/security-rule.md`
- **UI**: `.agents/rules/ui-rule.md`
- **Deployment**: `.agents/rules/deployment-rule.md`
- **Verification**: `.agents/rules/verify-first.md`
- **Legacy Cleanup**: `.agents/rules/legacy-cleanup-rule.md`
- **Report Governance**: `.agents/rules/report-governance-rule.md`

## Completion Reporting

AI社員の完了報告は
Report Governance Ruleに従う。

参照:

- .agents/rules/report-governance-rule.md
- .agents/auditor/report-auditor.js
- .agents/auditor/report-schema.json
