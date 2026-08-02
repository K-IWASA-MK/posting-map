---

# Verification Before Response Rule

## 目的

AIエージェントは、コード変更、Git操作、clasp操作、デプロイ操作、設定変更に関する完了報告を行う前に、必ず実環境確認を実施する。

推測、予定結果、口頭説明による完了報告は禁止する。

## 対象操作

以下を対象とする。

- Git commit
- Git push
- ファイル追加・復元・移動
- clasp push
- clasp deploy
- GitHub Pages公開確認
- Deployment Synchronization確認
- Client Configuration変更
- 本番設定変更

## 必須確認

### Git操作後

実行:

git status

確認:

- 未コミット変更
- 意図しないファイル追加
- 変更対象確認


### GAS操作後

実行:

npx clasp status
npx clasp deployments

確認:

- ローカル同期状態
- Deployment状態
- Version確認
- Web App公開状態


### 公開環境確認後

確認:

- 公開URLレスポンス
- 対象ファイル存在
- 設定値一致
- Endpoint一致


## 報告ルール

完了報告には必ず以下を含める。

- 実行したコマンド
- 実行結果ログ
- 確認対象
- 判定結果


## 禁止事項

以下の状態で完了報告してはならない。

- コマンド未実行
- 確認未実施
- エラー状態
- 推測による判断

以下の表現は禁止。

- 完了しました
- 正常です
- 反映済みです
- 同期済みです

ただし、実行ログおよび確認結果を提示できる場合を除く。


## 適用範囲

本ルールはPOSTING MAP Repositoryにおける全AIエージェント作業へ適用する。

---
