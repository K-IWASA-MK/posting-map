/**
 * GAS v2（最強安定・統合版） - 設定モジュール
 * - 全体の動作パラメータ管理
 * - Phase 14: Runtime Config System (OS化)
 */

// ==========================================
// RUNTIME OS CONFIGURATION
// ==========================================

const DEFAULT_STORE = {
  "DEFAULT": {
    VERSION: "2.2.0 (Mobile & Pro Integrated)",
    MODE: "production",
    SHEETS: {
      EVENTLOG: "EventLog"
    },
    PATH: {
      CSV: "/reference/",
      CORE: "v2_core.gs",
      API: "v2_api.gs"
    },

    // ファイル名設定
    DISTRICT_CSV: "三重県選挙区区割り",
    POSTAL_CSV: "MIE_POSTAL.CSV",
    TURNOUT_CSV: "voter_turnout.csv",
    TARGET_GOAL: 300000,

    // シート名設定
    SHEET_GUIDE: "初めての方「使い方ガイド」",
    SHEET_ROSTER: "名簿",
    SHEET_TEMPLATE: "原本",
    SHEET_POSTAL: "郵便番号",
    SHEET_DISTRICT: "区割り",
    SHEET_MASTER_EXPORT: "📥 集計用マスターデータ",
    SHEET_REPORT: "📄 活動報告書",
    SHEET_MANUAL: "📖 らくらくマニュアル",
    SHEET_SYSTEM_CACHE: "__SYSTEM_CACHE__",
    SHEET_STORAGE: "チラシ保管庫",
    SHEET_ADMIN: "管理者ID",

    // 動作設定
    CHUNK_SIZE: 10,
    ROW_HEIGHT_STAFF: 60,
    DENOMINATOR_UNITS: 651,
    DEFAULTS: {
      DEFAULT_PREFECTURE: "三重県",
      DEFAULT_DISTRICT: "三重第3区"
    },

    // 参照データソース基盤 (REFERENCE_FILES)
    REFERENCE_FILES: {
      POSTAL_CSV_FILE_ID: "1sVIEgWgtK9dF0nkqbwe4k7zwPnn8O6DY",   // MIE_POSTAL.CSV (数値昇順保証)
      POSTAL_ALT_FILE_ID: "1m6e6tH8vwBKs1HJuXAeEFCAU8wlKpSHl",     // KEN_ALL.CSV
      DISTRICT_CSV_FILE_ID: "1LGeZIaxidgKihq5iirYp-KXygJlBQ5Wm", // 三重県選挙区区割り.csv
      MUNICIPALITY_CSV_FILE_ID: ""
    },

    POSTAL_CSV_FILE_ID: "1sVIEgWgtK9dF0nkqbwe4k7zwPnn8O6DY",
    DISTRICT_CSV_FILE_ID: "1LGeZIaxidgKihq5iirYp-KXygJlBQ5Wm",
    DEFAULT_TENANT_ID: "MIE-03",
    DEFAULT_BRANCH_ID: "MIE-03",
    DEFAULT_BRANCH_NAME: "三重第3支部",
    
    // Phase 15: Strategic Engine Map
    DISTRICT_MAP: {
      "MIE-03": [
        // Placeholder blocks. Will be managed via PropertiesService in Production.
      ]
    }
  },
  "MIE-03": {
    // Override example for tenant
    MODE: "production"
  }
};

function loadConfigStore() {
  try {
    const cache = CacheService.getScriptCache().get("CONFIG_STORE");
    if (cache) return JSON.parse(cache);

    const storeRaw = PropertiesService.getScriptProperties().getProperty("CONFIG_STORE");

    let parsed;
    if (!storeRaw) {
      parsed = DEFAULT_STORE;
    } else {
      parsed = JSON.parse(storeRaw);
    }

    CacheService.getScriptCache().put("CONFIG_STORE", JSON.stringify(parsed), 300);
    return parsed;
  } catch (e) {
    // 🔥 フェイルセーフ（OS停止防止）
    return DEFAULT_STORE;
  }
}

function deepMerge(base, override) {
  const result = JSON.parse(JSON.stringify(base));
  for (const k in override) {
    if (typeof override[k] === "object" && override[k] !== null && !Array.isArray(override[k])) {
      result[k] = deepMerge(result[k] || {}, override[k]);
    } else {
      result[k] = override[k];
    }
  }
  return result;
}

function getConfig(tenantId = "DEFAULT") {
  const store = loadConfigStore();
  return deepMerge(
    store.DEFAULT,
    store[tenantId] || {}
  );
}

// ==========================================
// GLOBAL ACCESSOR (OS CONFIG)
// ==========================================
const CONFIG = {
  get: function(path, tenantId = "DEFAULT") {
    const cfg = getConfig(tenantId);
    return path.split(".").reduce((obj, key) => obj?.[key], cfg);
  },
  
  // ストレージ設定
  // ⚠️ STORAGE_PARENT_ID は PropertiesService で管理（スクリプトプロパティ: STORAGE_PARENT_ID）
  get STORAGE_PARENT_ID() {
    return PropertiesService.getScriptProperties().getProperty('STORAGE_PARENT_ID') || '';
  }
};
