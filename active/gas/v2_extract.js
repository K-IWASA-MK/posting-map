/**
 * GAS v2 - 住所抽出モジュール
 * - CSVからの選挙区・住所データの抽出
 * - 住所文字列の正規化
 */

// =============================
// ② データ抽出 (gas.gs 完全移植)
// =============================

function extractDistrictAddresses(targetDistrictName, targetPrefecture) {
  const ss = getSS();
  const results = [];

  if (ss) {
    const masterSheet = ss.getSheetByName("MIE03_ADDRESS_MASTER");
    if (masterSheet) {
      const data = masterSheet.getDataRange().getValues();
      if (data.length > 1) {
        const header = data[0].map(h => String(h || "").toLowerCase().trim());
        const cityIdx = header.findIndex(h => h === "city_name" || h === "city" || h === "municipality");
        const townIdx = header.findIndex(h => h === "town_name" || h === "town");
        const fullAddrIdx = header.findIndex(h => h === "full_address" || h === "address");
        const zipIdx = header.findIndex(h => h === "postal_code" || h === "postalcode" || h === "zip");

        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          const city = String(row[cityIdx !== -1 ? cityIdx : 1] || "").trim();
          const town = String(row[townIdx !== -1 ? townIdx : 2] || "").trim();
          const fullAddress = String(row[fullAddrIdx !== -1 ? fullAddrIdx : 2] || (city + " " + town)).trim();
          const postal = zipIdx !== -1 ? String(row[zipIdx] || "").trim() : "";

          if (city) {
            results.push({
              prefecture: targetPrefecture || "三重県",
              district: matchDistrict(fullAddress, city),
              city: city,
              town: town,
              address: fullAddress,
              postalCode: postal
            });
          }
        }
      }
    }
  }

  return results;
}
/**
 * 指定したキーワード（パターン）を含むファイルをドライブから検索する。
 * なければ fallbackName で完全一致検索する。
 */
function findFileByPattern(pattern, fallbackName) {
  try {
    const query = `title contains '${pattern}' and trashed = false`;
    const files = DriveApp.searchFiles(query);
    if (files.hasNext()) {
      return files.next();
    }
  } catch (e) {
    // 検索エラー時はログを残しフォールバックへ
  }
  
  // フォールバック
  const files = DriveApp.getFilesByName(fallbackName);
  if (files.hasNext()) {
    return files.next();
  }
  return null;
}

/**
 * ファイルオブジェクトからCSVまたはGoogleスプレッドシートのデータをパースして取得する
 */
function getCsvOrSheetDataFromFile(file) {
  if (!file) return null;
  const mime = file.getMimeType();
  if (mime === MimeType.GOOGLE_SHEETS) {
    const ss = SpreadsheetApp.open(file);
    return ss.getSheets()[0].getDataRange().getValues();
  } else {
    const blob = file.getBlob();
    let text;
    try {
      text = blob.getDataAsString("UTF-8");
      if (text.indexOf("\uFFFD") !== -1) throw new Error();
    } catch (e) {
      text = blob.getDataAsString("Shift_JIS");
    }
    try {
      return Utilities.parseCsv(text);
    } catch (e) {
      return text.split("\n").map((line) => line.split(","));
    }
  }
}

/**
 * スプレッドシート名から都道府県と選挙区を自動検出する
 */
function detectRegionFromSpreadsheetName() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const name = ss.getName();
  
  let prefecture = "";
  let district = "";
  
  // 1. 都道府県の検出
  const prefMap = {
    "MIE": "三重県", "三重": "三重県",
    "TOKYO": "東京都", "東京": "東京都",
    "OSAKA": "大阪府", "大阪": "大阪府",
    "AICHI": "愛知県", "愛知": "愛知県",
    "GIFU": "岐阜県", "岐阜": "岐阜県",
    "SHIGA": "滋賀県", "滋賀": "滋賀県",
    "KYOTO": "京都府", "京都": "京都府",
    "HYOGO": "兵庫県", "兵庫": "兵庫県",
    "KANAGAWA": "神奈川県", "神奈川": "神奈川県",
    "SAITAMA": "埼玉県", "埼玉": "埼玉県",
    "CHIBA": "千葉県", "CHIBA": "千葉県"
  };
  
  const upperName = name.toUpperCase();
  for (const [key, val] of Object.entries(prefMap)) {
    if (upperName.includes(key)) {
      prefecture = val;
      break;
    }
  }
  
  // 2. 選挙区の検出 (例: MIE-02, 三重第2区, 三重2区)
  // パターンA: 「第2区」や「2区」
  const districtMatch = name.match(/(?:第)?([0-9]+)区/);
  if (districtMatch) {
    district = `第${parseInt(districtMatch[1], 10)}区`;
  } else {
    // パターンB: ハイフン区切りのコード (MIE-02 など)
    const codeMatch = name.match(/[A-Za-z]+-([0-9]+)/);
    if (codeMatch) {
      district = `第${parseInt(codeMatch[1], 10)}区`;
    }
  }
  
  return { prefecture, district };
}

function matchDistrict(address, city) {
  if (!address) return "Unknown";
  
  // 四日市市の場合は詳細マスタ (District SSOT) からの完全一致で確定取得
  if (city === "四日市市") {
    // 住所から市名を除去した部分で判定
    let subAddr = address;
    if (address.indexOf(city) === 0) {
      subAddr = address.slice(city.length);
    }
    
    // YOKKAICHI_DISTRICT_MASTER から前方一致または完全一致する町名を走査
    for (let i = 0; i < YOKKAICHI_DISTRICT_MASTER.length; i++) {
      const rule = YOKKAICHI_DISTRICT_MASTER[i];
      if (subAddr.indexOf(rule.town) === 0) {
        return rule.district;
      }
    }
    
    // 四日市市の「日永地区」等、一部の境界表記例外へのフォールバック
    if (subAddr.includes("日永")) return "日永地区";
    if (subAddr.includes("塩浜")) return "塩浜地区";
    if (subAddr.includes("四郷")) return "四郷地区";
    if (subAddr.includes("内部")) return "内部地区";
    if (subAddr.includes("河原田")) return "河原田地区";
    if (subAddr.includes("水沢")) return "水沢地区";
    if (subAddr.includes("楠")) return "楠地区";
    if (subAddr.includes("小山田")) return "小山田地区";
    if (subAddr.includes("富田")) return "富田地区";
    if (subAddr.includes("羽津")) return "羽津地区";
    if (subAddr.includes("常磐")) return "常磐地区";
    if (subAddr.includes("富洲原")) return "富洲原地区";
    
    return "Unknown";
  }
  
  // 桑名市 (多度地区・長島地区・桑名地区) の判定
  if (city === "桑名市") {
    if (address.includes("多度町")) return "多度地区";
    if (address.includes("長島町")) return "長島地区";
    return "桑名地区";
  }
  
  // それ以外の市町村はデフォルトで「市区町村名 + 地区」とする (例: 朝日町 ➔ 朝日町地区)
  let cleanCity = city;
  if (city.includes("郡")) {
    // 郡名を取り除く (例: 三重郡菰野町 ➔ 菰野町)
    cleanCity = city.replace(/^.+?郡/, "");
  }
  return cleanCity + "地区";
}

// === [Yokkaichi District Master Area SSOT: START] ===
// AUTO GENERATED
// Source: data/districts/mie/yokkaichi_district_master.csv
// Records: 89
// Generated: 2026-07-22T07:57:14.136Z
// DO NOT EDIT
const YOKKAICHI_DISTRICT_MASTER = [
  {
    "city": "四日市市",
    "town": "富州原町",
    "district": "富洲原地区"
  },
  {
    "city": "四日市市",
    "town": "富洲原町",
    "district": "富洲原地区"
  },
  {
    "city": "四日市市",
    "town": "平町",
    "district": "富洲原地区"
  },
  {
    "city": "四日市市",
    "town": "天カ須賀",
    "district": "富洲原地区"
  },
  {
    "city": "四日市市",
    "town": "天カ須賀新田",
    "district": "富洲原地区"
  },
  {
    "city": "四日市市",
    "town": "住吉町",
    "district": "富洲原地区"
  },
  {
    "city": "四日市市",
    "town": "羽津",
    "district": "羽津地区"
  },
  {
    "city": "四日市市",
    "town": "羽津町",
    "district": "羽津地区"
  },
  {
    "city": "四日市市",
    "town": "羽津山町",
    "district": "羽津地区"
  },
  {
    "city": "四日市市",
    "town": "大宮町",
    "district": "羽津地区"
  },
  {
    "city": "四日市市",
    "town": "霞",
    "district": "羽津地区"
  },
  {
    "city": "四日市市",
    "town": "金場町",
    "district": "羽津地区"
  },
  {
    "city": "四日市市",
    "town": "城北町",
    "district": "羽津地区"
  },
  {
    "city": "四日市市",
    "town": "垂坂町",
    "district": "羽津地区"
  },
  {
    "city": "四日市市",
    "town": "別名",
    "district": "羽津地区"
  },
  {
    "city": "四日市市",
    "town": "別名町",
    "district": "羽津地区"
  },
  {
    "city": "四日市市",
    "town": "別名１丁目",
    "district": "羽津地区"
  },
  {
    "city": "四日市市",
    "town": "別名２丁目",
    "district": "羽津地区"
  },
  {
    "city": "四日市市",
    "town": "別名３丁目",
    "district": "羽津地区"
  },
  {
    "city": "四日市市",
    "town": "別名４丁目",
    "district": "羽津地区"
  },
  {
    "city": "四日市市",
    "town": "別名５丁目",
    "district": "羽津地区"
  },
  {
    "city": "四日市市",
    "town": "別名６丁目",
    "district": "羽津地区"
  },
  {
    "city": "四日市市",
    "town": "富士町",
    "district": "羽津地区"
  },
  {
    "city": "四日市市",
    "town": "緑丘町",
    "district": "羽津地区"
  },
  {
    "city": "四日市市",
    "town": "山手町",
    "district": "羽津地区"
  },
  {
    "city": "四日市市",
    "town": "八幡町",
    "district": "羽津地区"
  },
  {
    "city": "四日市市",
    "town": "大字羽津",
    "district": "羽津地区"
  },
  {
    "city": "四日市市",
    "town": "東茂福町",
    "district": "羽津地区"
  },
  {
    "city": "四日市市",
    "town": "茂福",
    "district": "羽津地区"
  },
  {
    "city": "四日市市",
    "town": "茂福町",
    "district": "羽津地区"
  },
  {
    "city": "四日市市",
    "town": "常磐",
    "district": "常磐地区"
  },
  {
    "city": "四日市市",
    "town": "常磐町",
    "district": "常磐地区"
  },
  {
    "city": "四日市市",
    "town": "ときわ",
    "district": "常磐地区"
  },
  {
    "city": "四日市市",
    "town": "ときわ１丁目",
    "district": "常磐地区"
  },
  {
    "city": "四日市市",
    "town": "ときわ２丁目",
    "district": "常磐地区"
  },
  {
    "city": "四日市市",
    "town": "ときわ３丁目",
    "district": "常磐地区"
  },
  {
    "city": "四日市市",
    "town": "ときわ４丁目",
    "district": "常磐地区"
  },
  {
    "city": "四日市市",
    "town": "ときわ５丁目",
    "district": "常磐地区"
  },
  {
    "city": "四日市市",
    "town": "赤堀",
    "district": "常磐地区"
  },
  {
    "city": "四日市市",
    "town": "赤堀町",
    "district": "常磐地区"
  },
  {
    "city": "四日市市",
    "town": "赤堀南町",
    "district": "常磐地区"
  },
  {
    "city": "四日市市",
    "town": "赤堀１丁目",
    "district": "常磐地区"
  },
  {
    "city": "四日市市",
    "town": "赤堀２丁目",
    "district": "常磐地区"
  },
  {
    "city": "四日市市",
    "town": "赤堀３丁目",
    "district": "常磐地区"
  },
  {
    "city": "四日市市",
    "town": "城東町",
    "district": "常磐地区"
  },
  {
    "city": "四日市市",
    "town": "伊倉",
    "district": "常磐地区"
  },
  {
    "city": "四日市市",
    "town": "伊倉１丁目",
    "district": "常磐地区"
  },
  {
    "city": "四日市市",
    "town": "伊倉２丁目",
    "district": "常磐地区"
  },
  {
    "city": "四日市市",
    "town": "伊倉３丁目",
    "district": "常磐地区"
  },
  {
    "city": "四日市市",
    "town": "久保田",
    "district": "常磐地区"
  },
  {
    "city": "四日市市",
    "town": "久保田１丁目",
    "district": "常磐地区"
  },
  {
    "city": "四日市市",
    "town": "久保田２丁目",
    "district": "常磐地区"
  },
  {
    "city": "四日市市",
    "town": "芝田",
    "district": "常磐地区"
  },
  {
    "city": "四日市市",
    "town": "芝田１丁目",
    "district": "常磐地区"
  },
  {
    "city": "四日市市",
    "town": "芝田２丁目",
    "district": "常磐地区"
  },
  {
    "city": "四日市市",
    "town": "大字赤堀",
    "district": "常磐地区"
  },
  {
    "city": "四日市市",
    "town": "大字日永",
    "district": "日永地区"
  },
  {
    "city": "四日市市",
    "town": "日永",
    "district": "日永地区"
  },
  {
    "city": "四日市市",
    "town": "日永１丁目",
    "district": "日永地区"
  },
  {
    "city": "四日市市",
    "town": "日永２丁目",
    "district": "日永地区"
  },
  {
    "city": "四日市市",
    "town": "日永３丁目",
    "district": "日永地区"
  },
  {
    "city": "四日市市",
    "town": "日永４丁目",
    "district": "日永地区"
  },
  {
    "city": "四日市市",
    "town": "日永５丁目",
    "district": "日永地区"
  },
  {
    "city": "四日市市",
    "town": "日永東",
    "district": "日永地区"
  },
  {
    "city": "四日市市",
    "town": "日永西",
    "district": "日永地区"
  },
  {
    "city": "四日市市",
    "town": "大字塩浜",
    "district": "塩浜地区"
  },
  {
    "city": "四日市市",
    "town": "塩浜",
    "district": "塩浜地区"
  },
  {
    "city": "四日市市",
    "town": "塩浜本町",
    "district": "塩浜地区"
  },
  {
    "city": "四日市市",
    "town": "大字四郷",
    "district": "四郷地区"
  },
  {
    "city": "四日市市",
    "town": "大字内部",
    "district": "内部地区"
  },
  {
    "city": "四日市市",
    "town": "大字河原田",
    "district": "河原田地区"
  },
  {
    "city": "四日市市",
    "town": "大字水沢",
    "district": "水沢地区"
  },
  {
    "city": "四日市市",
    "town": "大字楠",
    "district": "楠地区"
  },
  {
    "city": "四日市市",
    "town": "大字小山田",
    "district": "小山田地区"
  },
  {
    "city": "四日市市",
    "town": "山田町",
    "district": "小山田地区"
  },
  {
    "city": "四日市市",
    "town": "富田",
    "district": "富田地区"
  },
  {
    "city": "四日市市",
    "town": "富田一色町",
    "district": "富田地区"
  },
  {
    "city": "四日市市",
    "town": "川島町",
    "district": "川島地区"
  },
  {
    "city": "四日市市",
    "town": "神前町",
    "district": "神前地区"
  },
  {
    "city": "四日市市",
    "town": "桜町",
    "district": "桜地区"
  },
  {
    "city": "四日市市",
    "town": "生桑町",
    "district": "三重地区"
  },
  {
    "city": "四日市市",
    "town": "県町",
    "district": "県地区"
  },
  {
    "city": "四日市市",
    "town": "平尾町",
    "district": "八郷地区"
  },
  {
    "city": "四日市市",
    "town": "朝明町",
    "district": "下野地区"
  },
  {
    "city": "四日市市",
    "town": "大矢知町",
    "district": "大矢知地区"
  },
  {
    "city": "四日市市",
    "town": "小牧町",
    "district": "保々地区"
  },
  {
    "city": "四日市市",
    "town": "阿倉川町",
    "district": "海蔵地区"
  },
  {
    "city": "四日市市",
    "town": "東新町",
    "district": "橋北地区"
  },
  {
    "city": "四日市市",
    "town": "安島",
    "district": "中部地区"
  }
];
// === [Yokkaichi District Master Area SSOT: END] ===

/**
 * ドライブ上の MIE03_MUNICIPALITY_ORDER.csv から自治体順を動的に取得する（SSOT）
 * CacheService による派生データキャッシュ高速化層（SSOTは常にCSV）
 * @return {string[]} 自治体順の配列
 */
function getMunicipalityOrder() {
  const CACHE_KEY = "MIE03_MUNICIPALITY_ORDER_CACHE";
  const CACHE_TTL = 21600; // 6時間 (GAS CacheService 最大保持期間)

  try {
    if (typeof CacheService !== 'undefined' && CacheService.getScriptCache) {
      const cache = CacheService.getScriptCache();
      const cached = cache.get(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    }
  } catch (e) {
    // キャッシュ取得エラー時は正本取得へフォールバック
  }

  const fileName = "MIE03_MUNICIPALITY_ORDER.csv";
  let file = findFileByPattern("MIE03_MUNICIPALITY_ORDER", fileName);
  
  const defaultList = [
    "四日市市",
    "桑名市",
    "いなべ市",
    "桑名郡木曽岬町",
    "員弁郡東員町",
    "三重郡菰野町",
    "三重郡朝日町",
    "三重郡川越町"
  ];
  
  if (!file) {
    try {
      const csvContent = "priority,city_name\n" + defaultList.map((c, i) => `${i + 1},${c}`).join("\n");
      const parentId = typeof CONFIG !== 'undefined' ? CONFIG.get("STORAGE_PARENT_ID") : null;
      let folder = DriveApp.getRootFolder();
      if (parentId) {
        try {
          folder = DriveApp.getFolderById(parentId);
        } catch (fErr) {}
      }
      file = folder.createFile(fileName, csvContent, MimeType.PLAIN_TEXT);
      console.warn("MIE03_MUNICIPALITY_ORDER.csv が見つからないため、ドライブ上にデフォルト値で自動生成しました。");
    } catch (err) {
      console.error("MIE03_MUNICIPALITY_ORDER.csv の自動生成に失敗しました: " + err.message);
      return defaultList; // エラー時はデフォルトをそのまま返す
    }
  }
  
  try {
    const data = getCsvOrSheetDataFromFile(file);
    if (!data || data.length <= 1) {
      return defaultList;
    }
    
    const cities = [];
    // 1行目はヘッダー (priority,city_name)
    for (let i = 1; i < data.length; i++) {
      const cityName = String(data[i][1] || "").trim(); // 2列目 (city_name)
      if (cityName) {
        cities.push(cityName);
      }
    }

    // 正本からの取得成功時、CacheServiceへ保存 (派生データ高速化)
    try {
      if (typeof CacheService !== 'undefined' && CacheService.getScriptCache && cities.length > 0) {
        CacheService.getScriptCache().put(CACHE_KEY, JSON.stringify(cities), CACHE_TTL);
      }
    } catch (cErr) {}

    return cities;
  } catch (e) {
    console.error("MIE03_MUNICIPALITY_ORDER.csv のパースに失敗しました: " + e.message);
    return defaultList;
  }
}

/**
 * 自治体順キャッシュのクリア関数 (正本CSV更新時や手動リフレッシュ用)
 */
function clearMunicipalityOrderCache() {
  try {
    if (typeof CacheService !== 'undefined' && CacheService.getScriptCache) {
      CacheService.getScriptCache().remove("MIE03_MUNICIPALITY_ORDER_CACHE");
    }
  } catch (e) {}
}


