# POSTING MAP: Stripe Webhook Cloud Run Gateway

## 概要
StripeからのWebhookを受信し、公式のStripe Signature検証を行った上で、POSTING MAPのGAS Web Appへ安全に転送（POSTメソッドによる302明示的ハンドリング対応）するGatewayです。

## デプロイ手順

GCP（Google Cloud Platform）のCloud Runへデプロイします。

### 1. Secret Managerの設定
GCPコンソールの「Security > Secret Manager」にて以下のシークレットを作成してください。
1. `STRIPE_WEBHOOK_SECRET` (Stripe Dashboardから取得したWebhook署名シークレット)
2. `INTERNAL_GATEWAY_TOKEN` (任意の安全なランダム文字列)
3. `GAS_WEBAPP_URL` (POSTING MAPのGASデプロイURL `https://script.google.com/macros/s/.../exec`)
※ GatewayがSecretへアクセスできるよう、Cloud Runのサービスアカウントに `Secret Manager Secret Accessor` ロールを付与してください。

### 2. Cloud Run へのデプロイ
`gcloud` コマンドが使用可能な環境で以下を実行します。

```bash
cd gateways/stripe-webhook-gateway
gcloud run deploy stripe-webhook-gateway \
  --source . \
  --region asia-northeast1 \
  --allow-unauthenticated \
  --set-secrets=STRIPE_WEBHOOK_SECRET=STRIPE_WEBHOOK_SECRET:latest,INTERNAL_GATEWAY_TOKEN=INTERNAL_GATEWAY_TOKEN:latest,GAS_WEBAPP_URL=GAS_WEBAPP_URL:latest
```

※ `.env` ファイル等を用いて環境変数として渡すことも可能ですが、本番環境ではSecret Managerの使用を推奨します。

### 3. Stripe Dashboardの設定変更
Stripe DashboardのWebhook設定画面で、送信先URLを以下に変更してください。
- 変更前: `https://script.google.com/macros/s/.../exec?action=stripeWebhook`
- 変更後: `https://[CLOUD_RUN_URL]/webhook`

### 4. GAS側 (POSTING MAP) のプロパティ設定
POSTING MAPのGASスクリプトプロパティ（PropertiesService）に以下を追加してください。
- `INTERNAL_GATEWAY_TOKEN` = (手順1で設定したランダム文字列と同じもの)
