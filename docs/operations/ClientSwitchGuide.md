# Operations Guide: Client Switching & Loader Integration

本ガイドは、開発時またはテスト運用時に、フロントエンドで接続先クライアント（選挙区）を切り替える手順を定義します。

---

## 1. クライアント切り替え方法

本システムでは、コアコードの書き換えやコピーを行わず、**クライアントローダー**が動的にクライアントを判定して環境アタッチを行います。

### 方法A: URLクエリパラメータでの指定（本番/テスト推奨）
アクセスする URL の末尾に `?client=クライアントID` パラメータを付与します。
* 例（ローカル）: `http://localhost:8000/active/dashboard/index.html?client=MIE-04`
* 例（本番）: `https://k-iwasa-mk.github.io/posting-map-system-dev/?client=MIE-04`

一度このパラメータ付きでアクセスすると、`client-loader.js` が自動でブラウザの `LocalStorage` にアクティブクライアント情報を保存するため、次回以降はパラメータなしでアクセスしても自動的に `MIE-04` 用の画面およびデータベース接続が維持されます。

### 方法B: LocalStorage での直接書き換え（開発検証用）
ブラウザのデベロッパーツール（Console）で以下のコマンドを実行し、リロードします。
```javascript
localStorage.setItem('PMS_ACTIVE_CLIENT', 'MIE-03');
location.reload();
```

---

## 2. LINE LIFF 展開時の注意点

289クライアントに本格展開する際、LINE Developers コンソールにおいて、各クライアント（支部）ごとに異なる LIFF アプリを作成します。その際、LIFF アプリの **「エンドポイント URL」** には必ず以下のクエリパラメータを付与して登録してください。

```
【LIFF エンドポイント URL の設定値】
https://k-iwasa-mk.github.io/posting-map-system-dev/?client=MIE-04
```

LINE 内でユーザーが LIFF を開くと、LINE のブラウザが自動的にこのエンドポイント URL（パラメータ付き）へリダイレクトするため、配布員は一切の切り替え作業を意識することなく、自分の支部のポスティングマップへ自動接続されます。
