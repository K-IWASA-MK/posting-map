/**
 * GAS v2 - マップデータ管理モジュール
 * - 地図表示用データの集計
 * - パフォーマンス向上のためのキャッシュ管理
 */

/**
 * 戦況マップダッシュボード用：全体サマリー取得（爆速キャッシュ版）
 */
function getDashboardData() {
  const cache = CacheService.getScriptCache();
  const fastCached = cache.get("AREA_SUMMARY_FAST_CACHE");
  if (fastCached) return JSON.parse(fastCached);

  const props = PropertiesService.getScriptProperties();
  const cached = props.getProperty("AREA_SUMMARY_CACHE");

  if (cached) {
    try {
      const data = JSON.parse(cached);
      cache.put("AREA_SUMMARY_FAST_CACHE", cached, 1800);
      return data;
    } catch (e) {}
  }
  return refreshAreaSummaryCache();
}

/**
 * 全エリアのサマリーを再計算してキャッシュに保存する (爆速シャドウシート版)
 */
function refreshAreaSummaryCache() {
  // Phase B/C: 集計(done)は必ずEventLogのみで行う(Single Aggregation Rule)
  // マスターデータ(total, repAddress)のみ__SYSTEM_CACHE__から取得し、EventLog実績とマージする
  const ss = getSS();
  let shadowSheet = ss.getSheetByName(CONFIG.get("SHEET_SYSTEM_CACHE"));

  if (!shadowSheet) {
    createSystemCacheSheet();
    shadowSheet = ss.getSheetByName(CONFIG.get("SHEET_SYSTEM_CACHE"));
  }

  const lastRow = shadowSheet.getLastRow();
  let masterMap = {};
  if (lastRow >= 2) {
    // 1回のAPI通信でマスターデータを取得 (A:エリア名, B:(廃止), C:合計数, D:代表住所, E:市町村カナ, F:町域カナ)
    const data = shadowSheet.getRange(2, 1, lastRow - 1, 6).getValues();
    data.forEach((row) => {
      const name = row[0];
      const total = Number(row[2]) || 0;
      const repAddress = row[3] ? String(row[3]).trim() : "";
      const cityKana = row[4] ? String(row[4]).trim() : "";
      const townKana = row[5] ? String(row[5]).trim() : "";
      if (name) {
        masterMap[name] = { total: total, repAddress: repAddress, cityKana: cityKana, townKana: townKana };
      }
    });
  }

  // EventLogから最新の完了実績を取得
  const eventLogs = aggregateByBlock("DEFAULT_TENANT", null);

  let summary = [];
  let totalDone = 0;
  let totalPoints = 0;

  // EventLogに存在するエリアの実績をマスターと結合
  eventLogs.forEach(block => {
    const name = block.name;
    const done = block.done;
    const master = masterMap[name] || { total: 0, repAddress: "" };
    
    let lat = block.lat;
    let lng = block.lng;
    if (!lat || !lng) {
      const coords = getCoordsFromAddress(master.repAddress);
      if (coords) {
        lat = coords.lat;
        lng = coords.lng;
      }
    }

    summary.push({
      version: 1,
      // Future: areaId,
      name: name,
      done: done,
      total: master.total,
      repAddress: master.repAddress,
      lat: lat,
      lng: lng,
      cityKana: master.cityKana || "",
      townKana: master.townKana || ""
    });
    
    totalDone += done;
    totalPoints += master.total;
    
    // 処理済みマーク
    masterMap[name].processed = true;
  });

  // EventLogに存在しないがマスターに存在するエリア（未着手）を補完
  Object.keys(masterMap).forEach(name => {
    const master = masterMap[name];
    if (!master.processed) {
      let lat = null;
      let lng = null;
      const coords = getCoordsFromAddress(master.repAddress);
      if (coords) {
        lat = coords.lat;
        lng = coords.lng;
      }
      summary.push({
        version: 1,
        // Future: areaId,
        name: name,
        done: 0,
        total: master.total,
        repAddress: master.repAddress,
        lat: lat,
        lng: lng,
        cityKana: master.cityKana || "",
        townKana: master.townKana || ""
      });
      totalPoints += master.total;
    }
  });

  const result = {
    summary: summary,
    stats: { done: totalDone, total: totalPoints },
    updatedAt: new Date().getTime(),
  };

  const jsonResult = JSON.stringify(result);
  const cache = CacheService.getScriptCache();
  cache.put("AREA_SUMMARY_FAST_CACHE", jsonResult, 1800);
  PropertiesService.getScriptProperties().setProperty("AREA_SUMMARY_CACHE", jsonResult);

  // API 生成完了監査
  if (typeof auditDataIntegrity === 'function') {
    auditDataIntegrity("API", result.summary);
  }

  return result;
}

/**
 * 集計用シャドウシート (__SYSTEM_CACHE__) を生成/更新する
 * エリアシートが増えた時などに呼び出す
 */
function createSystemCacheSheet() {
  const ss = getSS();
  let sheet = ss.getSheetByName(CONFIG.get("SHEET_SYSTEM_CACHE"));
  
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.get("SHEET_SYSTEM_CACHE"));
    sheet.hideSheet();
  }
  
  sheet.clear();
  sheet.getRange(1, 1, 1, 6).setValues([["エリア名", "完了数", "合計数", "代表住所", "市町村カナ", "町域カナ"]]);

  // __TEMP_ADDRESSES__ からカナ情報を取得し Map 化 (SSOT)
  const tempSheet = ss.getSheetByName("__TEMP_ADDRESSES__");
  const kanaMap = {};
  if (tempSheet) {
    const tempLastRow = tempSheet.getLastRow();
    if (tempLastRow >= 2) {
      // 2列目:住所, 3列目:市町村カナ, 4列目:町域カナ
      const tempValues = tempSheet.getRange(2, 2, tempLastRow - 1, 3).getValues();
      tempValues.forEach(row => {
        const addr = row[0] ? String(row[0]).trim() : "";
        const cityKana = row[1] ? String(row[1]).trim() : "";
        const townKana = row[2] ? String(row[2]).trim() : "";
        if (addr) {
          kanaMap[addr] = { cityKana, townKana };
        }
      });
    }
  }

  const exclude = [
    CONFIG.get("SHEET_GUIDE"), CONFIG.get("SHEET_ROSTER"), CONFIG.get("SHEET_TEMPLATE"),
    CONFIG.get("SHEET_POSTAL"), CONFIG.get("SHEET_DISTRICT"), CONFIG.get("SHEET_MASTER_EXPORT"),
    CONFIG.get("SHEET_REPORT"), CONFIG.get("SHEET_MANUAL"), CONFIG.get("SHEET_SYSTEM_CACHE"),
    CONFIG.get("SHEET_STORAGE"),
    "__TEMP_ADDRESSES__" // バッチ一時シート（完了前に残った場合も除外）
  ];

  const areaSheets = ss.getSheets().filter(s => 
    !exclude.includes(s.getName()) && 
    !s.isSheetHidden() && 
    !s.getName().includes("MASTER") && 
    !s.getName().includes("DATABASE")
  );
  
  if (areaSheets.length === 0) {
    SpreadsheetApp.flush();
    return;
  }

  const rows = areaSheets.map(s => {
    const name = s.getName();
    const lastRow = s.getLastRow();
    let repAddress = "";
    
    if (lastRow >= 2) {
      repAddress = s.getRange(2, 1).getValue() || "";
    }
    
    const escapedName = name.replace(/'/g, "''");
    const kData = kanaMap[name] || { cityKana: "", townKana: "" };

    return [
      name,
      0, // Phase 13: 完了数はEventLogから集計するため、ここはダミー(0)とする
      `=COUNTA('${escapedName}'!A2:A)`, // マスター件数
      repAddress,
      kData.cityKana,
      kData.townKana
    ];
  });

  sheet.getRange(2, 1, rows.length, 6).setValues(rows);
  
  // CACHE 作成完了監査
  const cacheData = rows.map(r => ({
    name: r[0],
    total: r[2],
    repAddress: r[3],
    cityKana: r[4],
    townKana: r[5]
  }));
  if (typeof auditDataIntegrity === 'function') {
    auditDataIntegrity("CACHE", cacheData);
  }
}

/**
 * 特定のエリアの進捗だけをキャッシュ内で更新する（高速）
 */
function updateAreaCache(areaName, isDoneChange = 0) {
  if (isDoneChange === 0) return; // 変化なし: 更新不要
  const props = PropertiesService.getScriptProperties();
  const cache = CacheService.getScriptCache();
  const cached = props.getProperty("AREA_SUMMARY_CACHE");
  if (!cached) {
    // キャッシュなし: FastCacheのみクリアして次回フル再取得を促す
    cache.remove("AREA_SUMMARY_FAST_CACHE");
    return;
  }
  try {
    const data = JSON.parse(cached);
    const area = data.summary.find((s) => s.name === areaName);
    if (area) {
      area.done = Math.max(0, area.done + isDoneChange); // 負数防止
      data.stats.done = Math.max(0, data.stats.done + isDoneChange); // 負数防止
      const updatedJson = JSON.stringify(data);
      props.setProperty("AREA_SUMMARY_CACHE", updatedJson);
      cache.put("AREA_SUMMARY_FAST_CACHE", updatedJson, 1800);
    }
  } catch (e) {
    // JSONパースエラー: 破損キャッシュを全クリアして次回フル再取得を促す
    props.deleteProperty("AREA_SUMMARY_CACHE");
    cache.remove("AREA_SUMMARY_FAST_CACHE");
  }
}

/**
 * 永続座標キャッシュ付きジオコーディング
 * 同じ代表住所に対するジオコーディングをPropertiesServiceで永続化し、高速化・API制限回避を行う
 */
function getCoordsFromAddress(address) {
  if (!address) return null;
  const cleanAddr = address.replace(/\r?\n/g, ' ').trim();
  if (!cleanAddr) return null;

  const propKey = "GEO_" + cleanAddr.replace(/[\s\t]/g, '_');
  const props = PropertiesService.getScriptProperties();
  
  try {
    const cached = props.getProperty(propKey);
    if (cached) {
      const parts = cached.split(',');
      if (parts.length === 2) {
        return { lat: parseFloat(parts[0]), lng: parseFloat(parts[1]) };
      }
    }
  } catch (err) {
    // スクリプトプロパティ取得エラー時はジオコーディングにフォールバック
  }

  try {
    const geocoder = Maps.newGeocoder().setLanguage('ja');
    const response = geocoder.geocode(cleanAddr);
    if (response.status === 'OK' && response.results.length > 0) {
      const location = response.results[0].geometry.location;
      props.setProperty(propKey, `${location.lat},${location.lng}`);
      return { lat: location.lat, lng: location.lng };
    }
  } catch (e) {
    console.error("Geocoding failed for: " + cleanAddr + " error: " + e.toString());
  }
  return null;
}

