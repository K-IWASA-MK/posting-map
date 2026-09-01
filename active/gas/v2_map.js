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
  return { success: true, summary: [] };
}

/**
 * 全エリアのサマリーを再計算してキャッシュに保存する (実在Runtimeデータ集計版)
 */
function refreshAreaSummaryCache() {
  const ss = getSS();
  const orderedCities = (typeof getMunicipalityOrder === 'function')
    ? getMunicipalityOrder()
    : [];

  const cityMap = {};
  orderedCities.forEach(cName => {
    cityMap[cName] = {
      name: cName,
      total: 0,
      done: 0,
      lat: null,
      lng: null
    };
  });

  // 1. 実在するエリアシートが存在する場合、エリアシートから集計
  const excludeSheets = [
    "名簿", "原本", "保有チラシ枚数", "受渡要請履歴", "管理者ID",
    "__SYSTEM_CACHE__", "📥 集計用マスターデータ", "郵便番号", "区割り",
    "初めての方「使い方ガイド」", "📖 らくらくマニュアル", "らくらくマニュアル", "📄 活動報告書",
    "__TEMP_ADDRESSES__", "TraceLog", "配布実績", "PinStatus"
  ];
  if (typeof CONFIG !== 'undefined' && CONFIG.get) {
    [
      "SHEET_GUIDE", "SHEET_ROSTER", "SHEET_TEMPLATE", "SHEET_POSTAL",
      "SHEET_DISTRICT", "SHEET_MASTER_EXPORT", "SHEET_REPORT", "SHEET_MANUAL",
      "SHEET_SYSTEM_CACHE", "SHEET_STORAGE", "SHEET_ADMIN", "SHEET_HANDOVER_HISTORY"
    ].forEach(k => {
      const v = CONFIG.get(k);
      if (v && !excludeSheets.includes(v)) excludeSheets.push(v);
    });
  }

  let totalDone = 0;
  let totalPoints = 0;

  if (ss) {
    const sheets = ss.getSheets();
    sheets.forEach(sheet => {
      const sName = sheet.getName();
      if (excludeSheets.includes(sName) || sheet.isSheetHidden()) return;
      if (sName.includes("MASTER") || sName.includes("DATABASE") || sName.includes("EXPORT")) return;

      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return;

      // 自治体名解決（例: "四日市市", "四日市市(2)" -> "四日市市"）
      let baseCity = sName.replace(/\(\d+\)$/, '').trim();
      if (!cityMap[baseCity]) {
        cityMap[baseCity] = { name: baseCity, total: 0, done: 0, lat: null, lng: null };
      }

      const count = lastRow - 1;
      cityMap[baseCity].total += count;
      totalPoints += count;

      // D2:D11 の範囲から isDone を集計
      const targetRange = sheet.getRange(2, 4, Math.min(count, 10), 1);
      const isDoneValues = targetRange.getValues();
      let sheetDone = 0;
      isDoneValues.forEach(row => {
        const val = row[0];
        if (val === true || val === 'true' || (typeof val === 'string' && val.toLowerCase() === 'true')) {
          sheetDone++;
        }
      });
      cityMap[baseCity].done += sheetDone;
      totalDone += sheetDone;
    });

    // エリアシート未展開時の配布実績シート集計
    if (totalDone === 0) {
      const distSheet = ss.getSheetByName("配布実績");
      if (distSheet) {
        const lr = distSheet.getLastRow();
        if (lr > 0) {
          const values = distSheet.getRange(1, 1, lr, 4).getValues();
          const uniqueCompleted = new Set(
            values
              .filter(r => r[0] && r[3] !== "" && r[3] !== null)
              .map(r => parseInt(r[0], 10))
              .filter(id => !isNaN(id))
          );
          totalDone = uniqueCompleted.size;
        }
      }
    }
  }

  // 2. summary 配列の構築
  const summary = Object.keys(cityMap).map(cityName => {
    const info = cityMap[cityName];
    return {
      version: 1,
      name: cityName,
      done: info.done,
      total: info.total,
      lat: info.lat,
      lng: info.lng
    };
  });

  const result = {
    summary: summary,
    stats: { done: totalDone, total: totalPoints },
    updatedAt: new Date().getTime(),
  };

  const jsonResult = JSON.stringify(result);
  if (typeof CacheService !== 'undefined' && CacheService.getScriptCache) {
    const cache = CacheService.getScriptCache();
    cache.put("AREA_SUMMARY_FAST_CACHE", jsonResult, 1800);
  }
  if (typeof PropertiesService !== 'undefined' && PropertiesService.getScriptProperties) {
    PropertiesService.getScriptProperties().setProperty("AREA_SUMMARY_CACHE", jsonResult);
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

  const exclude = [
    CONFIG.get("SHEET_GUIDE"), CONFIG.get("SHEET_ROSTER"), CONFIG.get("SHEET_TEMPLATE"),
    CONFIG.get("SHEET_POSTAL"), CONFIG.get("SHEET_DISTRICT"), CONFIG.get("SHEET_MASTER_EXPORT"),
    CONFIG.get("SHEET_REPORT"), CONFIG.get("SHEET_MANUAL"), CONFIG.get("SHEET_SYSTEM_CACHE"),
    CONFIG.get("SHEET_STORAGE"), CONFIG.get("SHEET_ADMIN"), CONFIG.get("SHEET_HANDOVER_HISTORY"),
    "受渡要請履歴",
    "__TEMP_ADDRESSES__"
  ];

  // 1. municipality_master.csv (SSOT) から自治体順を取得
  const orderedCities = getMunicipalityOrder();

  // 2. 自治体の優先順に従ってシートを順次回収
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

  // 上記順序で漏れたエリアシートがあれば末尾に追加回収
  const existingSheets = ss.getSheets();
  existingSheets.forEach(s => {
    const sName = s.getName();
    if (!s.isSheetHidden() && !exclude.includes(sName) && !orderedAreaSheets.some(item => item.getName() === sName)) {
      orderedAreaSheets.push(s);
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

    return [
      name,
      0,
      `=COUNTA('${escapedName}'!A2:A)`, // マスター件数数式
      repAddress,
      "",
      ""
    ];
  });

  sheet.getRange(2, 1, rows.length, 6).setValues(rows);
  SpreadsheetApp.flush();
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

