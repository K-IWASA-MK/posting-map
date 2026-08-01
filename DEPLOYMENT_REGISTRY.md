# POSTING MAP Deployment Registry
Version: 1.1
Status: SSOT

## Fundamental Rule

**Production の Web App URL はシステム資産である。**

更新対象は URL ではなく、Deployment のコードのみとする。
AI社員は URL を変更してはならない。

---

## Purpose

本番環境の Script ID・Deployment ID・Web App URL を一元管理する。
AI社員は本ファイルを唯一の正しい情報源（SSOT）として参照すること。

---

## Environment List

| Environment | Status | Script ID | Deployment ID | Web App URL | Notes |
|-------------|--------|-----------|---------------|-------------|-------|
| MIE-03 | Production | `158Avw8hAtZx-c9yW10DE0NzB1NYngwv31eroqn-IAmHh_eKHN_fR58sa` | `AKfycbwgiOFU5iudUS6UscNU-MZhnxZJaqJHywVA9ivA-GE0uLe02fi7mmBU474lWa1TD7-R` | 固定 | 三重第3区 |
| MIE-04 | Production | （未発行/MIE-03共有中） | （未発行） | 固定 | 三重第4区 |
| MIE-05 | Production | （未発行） | （未発行） | 固定 | 三重第5区 |

---

## Standard Deployment Procedure (SOP)

AI社員は「知っている」ではなく「手順通り実行する」こと。

1. Script ID を確認
2. `clasp login` 状態を確認
3. `clasp status`
4. `clasp push`
5. `clasp deploy -i <Deployment ID>`
6. Web App の動作確認
7. TraceLog / API の動作確認
8. 完了報告（指定テンプレートを使用）

---

## Emergency Prohibitions

AI社員は以下を禁止する。

- Deployment ID を新規作成しない（`clasp deploy` のみの実行禁止）
- Web App URL を変更しない
- `config.js` を変更しない
- Script ID を変更しない
- CEO承認なしに Production を変更しない

---

## Deployment Report Template

デプロイ完了後、AI社員は必ず以下のフォーマットを用いて完了報告を行うこと。

```text
## Deployment Report

Environment:
[環境名]

Script ID:
[確認済み]

Deployment ID:
[確認済み]

Push:
✅

Deploy:
✅

URL変更:
なし

config.js変更:
なし

実機確認:
☐ 未実施
☑ 実施

TraceLog:
☐ 未確認
☑ 停止確認

CEO確認:
☐ 未
☑ 完了
```
