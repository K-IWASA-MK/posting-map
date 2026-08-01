/**
 * TraceLog シート全行取得 + 名簿シート全行取得
 * GAS @177 デプロイメントに対して text/plain POST で問い合わせ
 * 
 * 「新たな実装」ではなく、既存デプロイ済みの GAS V177 の
 * processPostAction("getTraceLog") を使う。
 * ただしそんなアクションは存在しないので、代わりに
 * 既にデプロイ済みの health チェックを利用して名簿の状態だけ確認する。
 * 
 * 結論: logTrace は Logger.log にしか書かないため、
 * Apps Script エディターの「実行数」画面を直接確認するしかない。
 */

const GAS_URL = "https://script.google.com/macros/s/AKfycbwgiOFU5iudUS6UscNU-MZhnxZJaqJHywVA9ivA-GE0uLe02fi7mmBU474lWa1TD7-R/exec";

async function fetchTraceLogViaGAS() {
  // registerStaff を明示的にテスト呼び出しして、
  // 成功するか失敗するかを確認する（実機と同じパラメータで）
  const testPayload = {
    action: "registerStaff",
    lastName: "TraceTest",
    firstName: "LINE",
    lineUserId: "U_TRACE_TEST_" + Date.now()
  };

  console.log("=== registerStaff テスト呼び出し ===");
  console.log("Payload:", JSON.stringify(testPayload));

  try {
    const resp = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain" },
      body: JSON.stringify(testPayload),
      redirect: "follow"
    });
    const text = await resp.text();
    console.log("HTTP Status:", resp.status);
    console.log("Raw Response:", text);
    
    try {
      const json = JSON.parse(text);
      console.log("Parsed JSON:", JSON.stringify(json, null, 2));
      
      if (json.success) {
        console.log("\n✅ registerStaff は正常に動作しています。");
        console.log("   → 実機の NG GAS Fail はクライアント側の問題です。");
      } else {
        console.log("\n❌ registerStaff は失敗を返しました:");
        console.log("   message:", json.message || json.data?.message || "不明");
      }
    } catch (e) {
      console.log("\n❌ レスポンスが JSON ではありません:");
      console.log("   → GAS が HTML（エラーページ）を返した可能性あり");
    }
  } catch (err) {
    console.log("❌ Fetch エラー:", err.message);
  }

  // 名簿の現在の状態を確認
  console.log("\n=== 名簿シートの現在の状態 ===");
  try {
    const resp2 = await fetch(GAS_URL + "?action=getAppData&liffToken=dummy", {
      method: "GET",
      redirect: "follow"
    });
    const text2 = await resp2.text();
    const json2 = JSON.parse(text2);
    
    // debugAuth があるか確認
    if (json2.data && json2.data.debugAuth) {
      console.log("debugAuth:", JSON.stringify(json2.data.debugAuth, null, 2));
    } else if (json2.debugAuth) {
      console.log("debugAuth:", JSON.stringify(json2.debugAuth, null, 2));
    } else {
      console.log("debugAuth not found in response");
      console.log("Response keys:", Object.keys(json2));
    }
  } catch (err) {
    console.log("getAppData エラー:", err.message);
  }
}

fetchTraceLogViaGAS();
