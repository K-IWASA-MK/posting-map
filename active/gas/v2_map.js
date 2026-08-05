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
 * 全エリアのサマリーを再計算してキャッシュに保存する (MIE03_ADDRESS_MASTER 起点 Tier 1 SSOT 版)
 */
function refreshAreaSummaryCache() {
  const ss = getSS();
  const masterSheet = ss.getSheetByName("MIE03_ADDRESS_MASTER");
  if (!masterSheet) {
    throw new Error("MIE03_ADDRESS_MASTER sheet not found");
  }

  const data = masterSheet.getDataRange().getValues();
  if (data.length <= 1) {
    return { summary: [], stats: { done: 0, total: 0 }, updatedAt: new Date().getTime() };
  }

  const header = data[0];
  const cityIdx = header.indexOf('city_name');
  const addrIdx = header.indexOf('full_address');
  const latIdx = header.indexOf('latitude');
  const lngIdx = header.indexOf('longitude');

  if (cityIdx === -1 || addrIdx === -1) {
    throw new Error("Required columns not found in master sheet");
  }

  // 1. 各自治体 (city_name) ごとのマスターデータを構築
  const cityMap = {};
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const cityName = String(row[cityIdx] || "").trim();
    const lat = parseFloat(row[latIdx]) || null;
    const lng = parseFloat(row[lngIdx]) || null;

    if (!cityName) continue;

    if (!cityMap[cityName]) {
      cityMap[cityName] = {
        name: cityName,
        total: 0,
        lat: lat,
        lng: lng
      };
    }

    cityMap[cityName].total++;
    // 最初の有効な座標を保持
    if (cityMap[cityName].lat === null && lat !== null) {
      cityMap[cityName].lat = lat;
      cityMap[cityName].lng = lng;
    }
  }

  // 2. 実シートの一覧を取得して自治体にマッピングし、done実績を合算
  const sheets = ss.getSheets();
  const excludeSheets = [];
  if (typeof CONFIG !== 'undefined' && CONFIG.get) {
    excludeSheets.push(
      CONFIG.get("SHEET_GUIDE"), CONFIG.get("SHEET_ROSTER"), CONFIG.get("SHEET_TEMPLATE"),
      CONFIG.get("SHEET_POSTAL"), CONFIG.get("SHEET_DISTRICT"), CONFIG.get("SHEET_MASTER_EXPORT"),
      CONFIG.get("SHEET_REPORT"), CONFIG.get("SHEET_MANUAL"), CONFIG.get("SHEET_SYSTEM_CACHE"),
      CONFIG.get("SHEET_STORAGE"), "__TEMP_ADDRESSES__", "TraceLog", "原本", "EventLog"
    );
  }

  // 各自治体ごとの done を初期化
  const cityDones = {};
  Object.keys(cityMap).forEach(c => cityDones[c] = 0);

  sheets.forEach(sheet => {
    const sName = sheet.getName();
    if (excludeSheets.includes(sName) || sheet.isSheetHidden()) return;
    if (sName.includes("MASTER") || sName.includes("DATABASE") || sName.includes("EXPORT")) return;

    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return;

    // 2行目A列の代表住所を取得
    let repAddr = String(sheet.getRange(2, 1).getValue() || "").trim();
    if (!repAddr) return;

    // 郵便番号(〒...)が含まれる場合は住所部分のみを取り出す
    repAddr = repAddr.replace(/^〒\d{3}-?\d{4}\s*/, "").replace(/\n/g, " ").trim();

    // MIE03_ADDRESS_MASTER 内でこの住所と前方一致/完全一致する city_name を特定
    let sheetCityName = null;
    for (let i = 1; i < data.length; i++) {
      const masterAddr = String(data[i][addrIdx] || "").trim();
      if (masterAddr && (masterAddr === repAddr || repAddr.indexOf(masterAddr) !== -1 || masterAddr.indexOf(repAddr) !== -1)) {
        sheetCityName = String(data[i][cityIdx] || "").trim();
        break;
      }
    }

    if (sheetCityName && cityMap[sheetCityName]) {
      // D2:D11の範囲から isDone を集計
      const targetRange = sheet.getRange(2, 4, Math.min(lastRow - 1, 10), 1);
      const isDoneValues = targetRange.getValues();
      let sheetDone = 0;
      isDoneValues.forEach(row => {
        const val = row[0];
        if (val === true || val === 'true' || (typeof val === 'string' && val.toLowerCase() === 'true')) {
          sheetDone++;
        }
      });
      cityDones[sheetCityName] += sheetDone;
    }
  });

  // 3. summary配列の構築
  const summary = [];
  let totalDone = 0;
  let totalPoints = 0;

  Object.keys(cityMap).forEach(cityName => {
    const info = cityMap[cityName];
    const done = cityDones[cityName] || 0;
    summary.push({
      version: 1,
      name: cityName,
      done: done,
      total: info.total,
      lat: info.lat,
      lng: info.lng
    });
    totalDone += done;
    totalPoints += info.total;
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

  // 1. MIE03_ADDRESS_MASTER から出現順に自治体名リストを取得
  const masterSheet = ss.getSheetByName("MIE03_ADDRESS_MASTER");
  const orderedCities = [];
  if (masterSheet) {
    const data = masterSheet.getDataRange().getValues();
    if (data.length > 1) {
      const header = data[0];
      const cityIdx = header.indexOf("city_name");
      if (cityIdx !== -1) {
        const citySet = new Set();
        for (let i = 1; i < data.length; i++) {
          const cName = String(data[i][cityIdx] || "").trim();
          if (cName) {
            citySet.add(cName);
          }
        }
        citySet.forEach(c => orderedCities.push(c));
      }
    }
  }

  // 2. 自治体の生成優先順に従ってシートを順次回収 (O(1) 回収)
  const orderedAreaSheets = [];
  orderedCities.forEach(cityName => {
    // 連番なし (例: "四日市市")
    const s1 = ss.getSheetByName(cityName);
    if (s1 && !s1.isSheetHidden() && !exclude.includes(s1.getName())) {
      orderedAreaSheets.push(s1);
    }
    // 連番あり (例: "四日市市(2)", "四日市市(3)"...)
    for (let idx = 2; idx <= 100; idx++) {
      const sN = ss.getSheetByName(`${cityName}(${idx})`);
      if (sN && !sN.isSheetHidden() && !exclude.includes(sN.getName())) {
        orderedAreaSheets.push(sN);
      }
    }
  });

  if (orderedAreaSheets.length === 0) {
    SpreadsheetApp.flush();
    return;
  }

  const rows = orderedAreaSheets.map(s => {
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

