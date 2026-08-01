# Project Policy

## Project Purpose
- POSTING MAP Version 1.0 を完成させること
- AIOSは完成済みRuntimeとして利用すること
- AIOSはVersion1.0では開発対象ではないこと

## Mandatory Workflow
すべての実装開始前に以下を必須とします。

1. **Read** `POSTING_MAP_FULL_AUDIT_REPORT.md` (Master Audit Document)
2. **Read** `HANDOVER.md`
3. Identify current implementation scope.
4. Verify current priority.
5. Implement only inside current scope.
6. Never implement features outside Version 1.0.

## Development Priority

**P0: Working Product**
・Hアプリ
・GAS
・Spreadsheet
・Dashboard
・Mock撤去

**P1: Asset Cleanup**
・legacy
・dead code
・duplicate directories

**P2: Refactoring**
・God Class
・API整理
・Module化

**P3: AIOS Runtime Integration**
・Monitoring
・Ledger
・Event Bus
・Trust
*Only when actually required.*

## Governance Rules
- Implement only current priority.
- Never skip priorities.
- Never redesign architecture unless requested.
- Never introduce AIOS Runtime before Version1.0 completion.
- AIOS Runtime supports POSTING MAP.
- POSTING MAP is always the primary product.

## Constitution
- Project Policy governs implementation.
- Audit governs priorities.
- Handover governs current status.
- AIOS supports products.
- Products never exist for AIOS.
