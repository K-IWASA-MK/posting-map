/**
 * GAS v2 - バッチ処理モジュール
 * - 大規模データ展開用のバッチエンジン
 * - トリガー管理
 */

// =============================
// ③ バッチ処理 (gas.gs 完全移植)
// =============================

function forceStartBatch() {
  const props = PropertiesService.getScriptProperties();
  props.setProperty("BATCH_STATUS", "running");
  props.setProperty("BATCH_INDEX", "0");
  
  const ss = getSS(); // Web APIでも安全に取得できるよう getSS() を使用
  props.setProperty("SPREADSHEET_ID", ss.getId()); // アクティブなスプレッドシートIDをプロパティサービスに同期
  
  // 0. 古いエリアシートを徹底的に全削除して完全クリーン化（フェイルセーフ保護）
  const baseSheet = ss.getSheetByName(CONFIG.get("SHEET_TEMPLATE"));
  if (baseSheet) {
    try {
      baseSheet.showSheet();
      ss.setActiveSheet(baseSheet);
    } catch (bErr) {}
  }

  const allCurrentSheets = ss.getSheets();
  allCurrentSheets.forEach(s => {
    if (!isProtectedSheet(s.getName())) {
      try {
        Logger.log("DELETE SHEET: " + s.getName());
        ss.deleteSheet(s);
      } catch (e) {}
    }
  });
  SpreadsheetApp.flush();

  // 1. extractDistrictAddresses() を直接呼び出して確定住所データを抽出
  ss.toast("確定住所マスターデータを抽出中...", "準備中", 5);
  const targetDistrict = "三重第3区";
  const targetPrefecture = "三重県";
  const addresses = extractDistrictAddresses(targetDistrict, targetPrefecture);

  // 【Step 1 強化版 監査ログ】
  Logger.log("=== 【Step 1 抽出監査ログ】 ===");
  Logger.log("対象地区: " + targetDistrict + " (" + targetPrefecture + ")");
  Logger.log("総抽出件数: " + (addresses ? addresses.length : 0) + "件");

  if (addresses && addresses.length > 0) {
    Logger.log("--- [先頭5件] ---");
    const top5 = addresses.slice(0, 5);
    top5.forEach((item, idx) => {
      Logger.log(`[${idx + 1}] 〒${item.postalCode || ''} | ${item.city || ''} | ${item.address || ''} | ${item.townKana || ''}`);
    });

    Logger.log("--- [末尾5件] ---");
    const last5 = addresses.slice(-5);
    last5.forEach((item, idx) => {
      const realIndex = addresses.length - 5 + idx + 1;
      Logger.log(`[${realIndex}] 〒${item.postalCode || ''} | ${item.city || ''} | ${item.address || ''} | ${item.townKana || ''}`);
    });
  } else {
    Logger.log("⚠️ 抽出件数が0件です！");
  }
  

  
  // デバッグ用トースト：抽出件数を画面に表示
  ss.toast(`【デバッグ】住所データを ${addresses.length} 件抽出しました。ソート中...`, "デバッグ", 10);
  


  /**
   * Area Metadata Foundation (SSOT)
   *
   * cityKana
   * townKana
   * を生成・保持する唯一のマスタ。
   *
   * 他モジュールはこのデータを参照するのみ.
   *
   * DO NOT REGENERATE.
   */
  let tempSheet = ss.getSheetByName("__TEMP_ADDRESSES__");
  if (!tempSheet) {
    tempSheet = ss.insertSheet("__TEMP_ADDRESSES__");
    tempSheet.hideSheet();
  }
  tempSheet.clear();
  tempSheet.getRange(1, 1, 1, 3).setValues([["postal_code", "city_name", "full_address"]]);
  
  // MIE03_SHEET_GENERATION_RULE.md に準拠: MIE03_MUNICIPALITY_ORDER.csv (SSOT) の priority 順にソート
  const cityOrderPriority = getMunicipalityOrder();

  addresses.sort((a, b) => {
    const idxA = cityOrderPriority.indexOf(a.city);
    const idxB = cityOrderPriority.indexOf(b.city);

    const pA = idxA === -1 ? 999 : idxA;
    const pB = idxB === -1 ? 999 : idxB;

    if (pA !== pB) return pA - pB;

    // 同一自治体内での郵便番号数値昇順
    const numA = parseInt((a.postalCode || "0").replace(/-/g, ""), 10) || 0;
    const numB = parseInt((b.postalCode || "0").replace(/-/g, ""), 10) || 0;
    return numA - numB;
  });

  if (addresses.length > 0) {
    const rows = addresses.map(addr => [
      addr.postalCode || "",
      addr.city || "",
      addr.address || ""
    ]);
    tempSheet.getRange(2, 1, rows.length, 3).setValues(rows);
  }
  SpreadsheetApp.flush();

  // 既存のバッチトリガーをクリーンアップし、新しく1分おきの時間駆動トリガーをセットアップ
  deleteTriggers("generateAreaSheetsBatch");
  ScriptApp.newTrigger("generateAreaSheetsBatch")
    .timeBased()
    .everyMinutes(1)
    .create();

  // 初回のバッチ処理をその場で即時実行（進捗のフリーズを回避）
  generateAreaSheetsBatch();
}

function generateAreaSheetsBatch() {
  const props = PropertiesService.getScriptProperties();
  if (props.getProperty("BATCH_STATUS") !== "running") return;
  const startTime = new Date().getTime();
  const ss = getSS();
  const baseSheet = ss.getSheetByName(CONFIG.get("SHEET_TEMPLATE"));

  // 2. CSV読み込みの代わりに一時シートから高速ロード
  const tempSheet = ss.getSheetByName("__TEMP_ADDRESSES__");
  if (!tempSheet) {
    ss.toast("一時データが見つかりません。一括作成を最初からやり直してください。", "エラー", 5);
    return;
  }
  
  const allValues = tempSheet.getDataRange().getValues();
  if (!allValues || allValues.length < 2) return;

  const tempValues = allValues.slice(1);
  const addresses = tempValues.map(r => ({
    postalCode: r[0],
    areaKey: r[1] || "Unknown",
    address: r[2]
  }));
  
  const startIndex = parseInt(props.getProperty("BATCH_INDEX")) || 0;
  const chunkSize = CONFIG.get("CHUNK_SIZE") || 10;

  // 3. 再開時の状態シミュレーション
  let cityCounts = {};
  let cityNameCounts = {}; // 市町村名ごとのシート枚数カウント (シート名(2)(3)付与用)
  let lastCity = "";
  let itemsInBlock = 0; // 1シート内の何件目か (0-9)

  for (let i = 0; i < startIndex; i++) {
    const key = addresses[i].areaKey;
    const cityName = addresses[i].areaKey;
    if (key !== lastCity || itemsInBlock >= chunkSize) {
      cityCounts[key] = (cityCounts[key] || 0) + 1;
      cityNameCounts[cityName] = (cityNameCounts[cityName] || 0) + 1;
      itemsInBlock = 0;
      lastCity = key;
    }
    itemsInBlock++;
  }

  // 4. メインループ (1回で最大30件処理してタイムアウト回避)
  const limit = Math.min(startIndex + 150, addresses.length);
  const writeBuffer = {};

  for (
    let currentIndex = startIndex;
    currentIndex < limit;
    currentIndex++
  ) {
    const currentAddr = addresses[currentIndex];
    const currentKey = currentAddr.areaKey;
    const cityName = currentAddr.areaKey;

    // 地区が切り替わった、または10件に達した場合
    if (currentKey !== lastCity || itemsInBlock >= chunkSize) {
      cityCounts[currentKey] = (cityCounts[currentKey] || 0) + 1;
      cityNameCounts[cityName] = (cityNameCounts[cityName] || 0) + 1;
      itemsInBlock = 0;
      lastCity = currentKey;
    }

    let sheetName =
      cityNameCounts[cityName] === 1
        ? cityName
        : `${cityName}(${cityNameCounts[cityName]})`;
    
    // シートの取得/作成ロジックを堅牢化
    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      if (baseSheet) {
        try {
          sheet = baseSheet.copyTo(ss).setName(sheetName);
        } catch (e) {
          sheet = ss.insertSheet(sheetName);
        }
      } else {
        sheet = ss.insertSheet(sheetName);
      }
    }
    sheet.showSheet();

    // シートの初期化とデザイン適用（新しいシートの開始時のみ）
    if (itemsInBlock === 0) {
      sheet.getRange("A2:L11").clearContent(); // L列（通し番号）まで確実にクリア
      applyProDesign(sheet);
      SpreadsheetApp.flush(); // 初期化を確定
    }

    const displayAddress = currentAddr.postalCode
      ? `〒${currentAddr.postalCode}\n${currentAddr.address}`
      : currentAddr.address;
    const mapsUrl =
      "https://www.google.com/maps/search/?api=1&query=" +
      encodeURIComponent(currentAddr.address);

    if (!writeBuffer[sheetName]) {
      writeBuffer[sheetName] = {
        sheet: sheet,
        rows: []
      };
    }

    writeBuffer[sheetName].rows.push({
      offset: itemsInBlock,
      address: displayAddress,
      mapsUrl: mapsUrl,
      originIndex: currentIndex + 2
    });

    itemsInBlock++;
  }

  // バッファされたデータをシートごとに書き込み
  Object.keys(writeBuffer).forEach(sName => {
    const buf = writeBuffer[sName];
    const sheet = buf.sheet;
    buf.rows.forEach(r => {
      const targetRow = r.offset + 2;
      // A列 (住所) と B列 (地図リンク) を 1回の setValues で書き込む
      sheet.getRange(targetRow, 1, 1, 2).setValues([[
        r.address,
        `=HYPERLINK("${r.mapsUrl}","📍")`
      ]]);
      // L列 (元行番号) を書き込む
      sheet.getRange(targetRow, 12).setValue(r.originIndex);
    });
  });

  SpreadsheetApp.flush();

  // BATCHの進行状況を更新または完了処理を実行
  if (limit >= addresses.length) {
    // 完了処理
    props.deleteProperty("BATCH_STATUS");
    props.deleteProperty("BATCH_INDEX");
    
    // 一時シートの削除
    const tempSheetToDelete = ss.getSheetByName("__TEMP_ADDRESSES__");
    

    
    if (tempSheetToDelete) {
      try {
        ss.deleteSheet(tempSheetToDelete);
        SpreadsheetApp.flush();
      } catch (e) {
        // 削除エラーは無視
      }
    }
    
    // 6. タブを自治体順・連番順に物理的に整列
    sortAllAreaSheetTabs();

    // シャドウシートを最新のリストで更新
    createSystemCacheSheet();
    SpreadsheetApp.flush();
    
    ss.toast(
      "すべてのエリアシートの展開（市町村境界考慮・10件分割版）が完了しました！",
      "完了",
      10,
    );
    refreshAreaSummaryCache();
    
    // 全処理が完了したので、バッチ用の一時トリガーを削除してクリーンアップ
    deleteTriggers("generateAreaSheetsBatch");
  } else {
    props.setProperty("BATCH_INDEX", limit.toString());
  }
}

function createAddressLinks(targetSheet) {
  const sheet =
    targetSheet || getSS().getActiveSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  const values = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  const formulas = values.map((v) => {
    let addr = v[0];
    if (!addr) return [""];
    if (addr.includes("\n")) addr = addr.split("\n")[1];
    const url =
      "https://www.google.com/maps/search/?api=1&query=" +
      encodeURIComponent(addr);
    return ['=HYPERLINK("' + url + '","📍")'];
  });
  sheet.getRange(2, 2, formulas.length, 1).setFormulas(formulas);
}

function deleteTriggers(name) {
  ScriptApp.getProjectTriggers().forEach((t) => {
    if (t.getHandlerFunction() === name) ScriptApp.deleteTrigger(t);
  });
}

/**
 * 毎月末（翌月1日の深夜）に自動的に前月のデータを自動消去し、自動ローテーションまたは契約終了を行う
 */
function checkEndOfMonthAndReset() {
  const now = new Date();
  
  // 1日になった日付（午前0時〜1時頃）に実行された場合のみ処理
  if (now.getDate() === 1) {
    const props = PropertiesService.getScriptProperties();
    const disableRollover = props.getProperty("DISABLE_ROLLOVER") === "true";
    
    // 1. 前月データをすべてクリア（リセット。在庫一覧はdeleteAllAreaSheets内では消去されず維持されます）
    deleteAllAreaSheets();
    // シャドウシートも即座に再構築（旧エリア名が残らないよう空状態にする）
    createSystemCacheSheet();
    
    if (disableRollover) {
      /*
       * Business Data Protection Rule:
       * 保有チラシ枚数（SHEET_STORAGE）は配布員本人が現在値を更新するSSOT業務データです。
       * 月次リセット、契約状態切り替え、自動バッチ等による自動削除・自動クリアは全面禁止します。
       */
      
      // 自動更新トリガーを全削除
      deleteTriggers("checkEndOfMonthAndReset");
      // 各種管理用プロパティをクリア
      props.deleteProperty("DISABLE_ROLLOVER");
      props.deleteProperty("BATCH_STATUS");
      props.deleteProperty("BATCH_INDEX");
      
      console.warn("ご契約終了に伴い、データを完全消去し、システムを自動停止しました。");
    } else {
      // 【契約継続（通常）の場合】 ➔ 在庫一覧は継続したまま、翌月分のエリアシートを自動で一括再展開
      props.setProperty("BATCH_STATUS", "running");
      props.setProperty("BATCH_INDEX", "0");
      props.setProperty("BATCH_CITY_COUNTS", JSON.stringify({}));
      
      generateAreaSheetsBatch();
      
      console.warn("毎月の自動データ切り替えを実行しました。旧データ消去＆翌月シート自動展開開始。");
    }
  }
}

// =============================================
// Drive写真 自動整理バッチ
// - 90日超: /evidence → /archive へ移動
// - 180日超: /archive 内ファイルをゴミ箱へ
// =============================================

/**
 * Googleドライブの証拠写真を自動整理する。
 * setupCleanupTrigger() で毎日深夜2〜3時に自動実行される。
 */
function cleanupDrivePhotos() {
  const parentFolderId = getStorageFolderId();
  let parentFolder;
  try {
    parentFolder = DriveApp.getFolderById(parentFolderId);
  } catch (e) {
    console.error("cleanupDrivePhotos: parent folder not found:", e);
    return;
  }

  const now = new Date();
  const MS_90_DAYS  = 90  * 24 * 60 * 60 * 1000;
  const MS_180_DAYS = 180 * 24 * 60 * 60 * 1000;

  // --- /evidence フォルダを取得 ---
  const evidenceFolders = parentFolder.getFoldersByName("evidence");
  if (evidenceFolders.hasNext()) {
    const evidenceFolder = evidenceFolders.next();

    // /archive フォルダを取得または作成
    const archiveFolders = parentFolder.getFoldersByName("archive");
    let archiveFolder;
    if (archiveFolders.hasNext()) {
      archiveFolder = archiveFolders.next();
    } else {
      archiveFolder = parentFolder.createFolder("archive");
    }

    // 90日以上経過したファイルを /archive へ移動
    const evidenceFiles = evidenceFolder.getFiles();
    let movedCount = 0;
    while (evidenceFiles.hasNext()) {
      const file = evidenceFiles.next();
      const age = now - file.getDateCreated();
      if (age > MS_90_DAYS) {
        file.moveTo(archiveFolder);
        movedCount++;
      }
    }
    if (movedCount > 0) {
      console.log(`cleanupDrivePhotos: ${movedCount} files moved to /archive`);
    }
  }

  // --- /archive フォルダを取得 ---
  const archiveFolders2 = parentFolder.getFoldersByName("archive");
  if (archiveFolders2.hasNext()) {
    const archiveFolder = archiveFolders2.next();

    // 180日以上経過したファイルをゴミ箱へ
    const archiveFiles = archiveFolder.getFiles();
    let deletedCount = 0;
    while (archiveFiles.hasNext()) {
      const file = archiveFiles.next();
      const age = now - file.getDateCreated();
      if (age > MS_180_DAYS) {
        file.setTrashed(true);
        deletedCount++;
      }
    }
    if (deletedCount > 0) {
      console.log(`cleanupDrivePhotos: ${deletedCount} files trashed from /archive`);
    }
  }
}

/**
 * cleanupDrivePhotos の時間主導型トリガーを設定する。
 * GASエディタから手動で1回だけ実行すること。
 * 既存トリガーを削除してから新規作成するため、重複しない。
 */
function setupCleanupTrigger() {
  deleteTriggers("cleanupDrivePhotos");
  ScriptApp.newTrigger("cleanupDrivePhotos")
    .timeBased()
    .everyDays(1)
    .atHour(2)
    .create();
  console.log("cleanupDrivePhotos trigger set: daily at 2:00 AM JST");
}

/**
 * すべてのエリアシートのタブを「自治体順 ➔ 連番昇順」でスプレッドシート上に物理的に並び替える
 */
function sortAllAreaSheetTabs() {
  try {
    const ss = getSS();
    const sheets = ss.getSheets();
    const systemSheetNames = ["原本", "名簿", "初めての方「使い方ガイド」", "__SYSTEM_CACHE__", "保有チラシ枚数", "管理者ID", "受渡要請履歴", "📄 活動報告書", "📖 らくらくマニュアル"];

    // MIE03_SHEET_GENERATION_RULE.md に準拠: MIE03_MUNICIPALITY_ORDER.csv (SSOT) の priority 順に整列
    const cityOrderPriority = getMunicipalityOrder();

    const areaSheets = [];
    sheets.forEach(sheet => {
      const name = sheet.getName();
      if (!systemSheetNames.includes(name)) {
        areaSheets.push({ sheet: sheet, name: name });
      }
    });

    // ソート基準: 自治体優先度 ➔ 連番インデックス
    areaSheets.sort((a, b) => {
      const getCityAndIndex = (sheetName) => {
        const clean = (sheetName || "").toString().trim();
        const match = clean.match(/^([^\d()]+?)(?:\s*\(\s*(\d+)\s*\))?$/);
        if (!match) return { city: clean, idx: 1 };
        return { city: match[1].trim(), idx: match[2] ? parseInt(match[2], 10) : 1 };
      };

      const infoA = getCityAndIndex(a.name);
      const infoB = getCityAndIndex(b.name);

      const cityIdxA = cityOrderPriority.indexOf(infoA.city);
      const cityIdxB = cityOrderPriority.indexOf(infoB.city);

      const pA = cityIdxA === -1 ? 999 : cityIdxA;
      const pB = cityIdxB === -1 ? 999 : cityIdxB;

      if (pA !== pB) return pA - pB;
      return infoA.idx - infoB.idx;
    });

    // 物理移動 (ソート順に右端 moveActiveSheet(ss.getNumSheets()) へ順次配置することで左から右へ100%美しく整列)
    areaSheets.forEach((item) => {
      try {
        ss.setActiveSheet(item.sheet);
        ss.moveActiveSheet(ss.getNumSheets());
      } catch (mErr) {}
    });

    SpreadsheetApp.flush();
    console.log(`✅ Tab Physical Sort Complete: ${areaSheets.length} area sheets sorted cleanly.`);
  } catch (err) {
    console.error("Failed sortAllAreaSheetTabs: " + err.toString());
  }
}
