# Workflow: Verification (実機検証手順)

## Git操作前
1. `git status` を実行し、未コミット変更や意図しないファイル追加がないか確認する。
2. `git diff` を実行し、変更対象外への修正がないか確認する。

## GAS操作後
1. `npx clasp status` および `npx clasp deployments` を実行し、ローカルと同期されているか確認する。

## 公開環境確認
1. 公開URLへアクセスし、レスポンスが正しいか、設定値が一致しているかを確認する。
