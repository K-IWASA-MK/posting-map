/**
 * POSTING MAP - Tier 2 Service (Generation 2)
 * エリア Tier 2 (町名一覧) 専用サービス
 * 責務: 指定市町村配下の町名サマリー (name, done, total) をオンデマンド取得
 * ルール: SSOT 配列出現順の100%維持 (sort() / localeCompare() 全面禁止)
 */
(function(global) {
  class Tier2Service {
    constructor() {}

    static getInstance() {
      if (!Tier2Service.instance) {
        Tier2Service.instance = new Tier2Service();
      }
      return Tier2Service.instance;
    }

    getTier2(cityName) {
      try {
        if (!cityName) {
          return { success: false, cityName: '', areas: [], message: 'cityName is required' };
        }

        const ss = typeof getSS === 'function' ? getSS() : SpreadsheetApp.getActiveSpreadsheet();
        if (!ss) throw new Error("Spreadsheet not found");

        const masterSheet = ss.getSheetByName("MIE03_ADDRESS_MASTER");
        if (!masterSheet) {
          throw new Error("MIE03_ADDRESS_MASTER sheet not found");
        }

        const data = masterSheet.getDataRange().getValues();
        if (data.length <= 1) {
          return { success: true, cityName: cityName, areas: [] };
        }

        const header = data[0];
        const cityIdx = header.indexOf('city_name');
        const townIdx = header.indexOf('town_name');
        const addrIdx = header.indexOf('full_address');
        const latMasterIdx = header.indexOf('latitude');
        const lngMasterIdx = header.indexOf('longitude');

        if (cityIdx === -1 || townIdx === -1 || addrIdx === -1) {
          throw new Error("Required columns not found in master sheet");
        }

        // 1. 指定された cityName に属する一意の town_name リストをCSV出現順を維持して抽出 (SSOT)
        const townList = [];
        const seenTowns = {};
        for (let i = 1; i < data.length; i++) {
          const row = data[i];
          const cName = String(row[cityIdx] || "").trim();
          const tName = String(row[townIdx] || "").trim();
          if (cName === cityName && tName) {
            if (!seenTowns[tName]) {
              seenTowns[tName] = true;
              townList.push(tName);
            }
          }
        }

        if (townList.length === 0) {
          return { success: true, cityName: cityName, areas: [] };
        }

        // 2. 実シートの一覧を取得
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

        // 各実シートの「2行目A列の代表住所」を読み込み、MIE03_ADDRESS_MASTER で照合して所属する正式な [自治体名, 町名] を特定
        const sheetMapping = {};
        sheets.forEach(sheet => {
          const sName = sheet.getName();
          if (excludeSheets.includes(sName) || sheet.isSheetHidden()) return;
          if (sName.includes("MASTER") || sName.includes("DATABASE") || sName.includes("EXPORT")) return;

          const lastRow = sheet.getLastRow();
          if (lastRow < 2) return;

          let repAddr = String(sheet.getRange(2, 1).getValue() || "").trim();
          if (!repAddr) return;

          repAddr = repAddr.replace(/^〒\d{3}-?\d{4}\s*/, "").replace(/\n/g, " ").trim();

          // 2行目のGPSカラム (I列: 9列目) から座標を取得
          let lat = null, lng = null;
          const gpsVal = String(sheet.getRange(2, 9).getValue() || "").trim();
          if (gpsVal && gpsVal.indexOf(',') !== -1) {
            const parts = gpsVal.split(',');
            lat = parseFloat(parts[0]) || null;
            lng = parseFloat(parts[1]) || null;
          }

          if (!lat || !lng) {
            if (typeof getCoordsFromAddress === 'function') {
              const coords = getCoordsFromAddress(repAddr);
              if (coords) {
                lat = coords.lat;
                lng = coords.lng;
              }
            }
          }

          for (let i = 1; i < data.length; i++) {
            const masterAddr = String(data[i][addrIdx] || "").trim();
            if (masterAddr && (masterAddr === repAddr || repAddr.indexOf(masterAddr) !== -1 || masterAddr.indexOf(repAddr) !== -1)) {
              const cName = String(data[i][cityIdx] || "").trim();
              const tName = String(data[i][townIdx] || "").trim();
              
              // マスター行の座標をフォールバックとして取得
              const mLat = latMasterIdx !== -1 ? parseFloat(data[i][latMasterIdx]) || null : null;
              const mLng = lngMasterIdx !== -1 ? parseFloat(data[i][lngMasterIdx]) || null : null;

              sheetMapping[sName] = {
                cityName: cName,
                townName: tName,
                sheet: sheet,
                lastRow: lastRow,
                lat: lat || mLat,
                lng: lng || mLng
              };
              break;
            }
          }
        });

        // 3. townList (一意の町名リスト) に基づいて、該当するシートの進捗を集計
        const areas = [];
        townList.forEach(town => {
          let foundSheetInfo = null;
          const sNames = Object.keys(sheetMapping);
          for (let k = 0; k < sNames.length; k++) {
            const info = sheetMapping[sNames[k]];
            if (info.cityName === cityName && info.townName === town) {
              foundSheetInfo = info;
              foundSheetInfo.sheetName = sNames[k];
              break;
            }
          }

          if (foundSheetInfo) {
            const sheet = foundSheetInfo.sheet;
            const lastRow = foundSheetInfo.lastRow;

            // D2:D11 の完了フラグをカウント
            const targetRange = sheet.getRange(2, 4, Math.min(lastRow - 1, 10), 1);
            const isDoneValues = targetRange.getValues();
            let done = 0;
            isDoneValues.forEach(row => {
              const val = row[0];
              if (val === true || val === 'true' || (typeof val === 'string' && val.toLowerCase() === 'true')) {
                done++;
              }
            });

            areas.push({
              name: town,
              fullName: foundSheetInfo.sheetName,
              done: done,
              total: lastRow - 1,
              lat: foundSheetInfo.lat,
              lng: foundSheetInfo.lng
            });
          } else {
            // シートがまだ存在しない（未作成の町）場合はマスター座標をフォールバックとして検索
            let fallbackLat = null;
            let fallbackLng = null;
            if (latMasterIdx !== -1 && lngMasterIdx !== -1) {
              for (let i = 1; i < data.length; i++) {
                if (String(data[i][cityIdx]).trim() === cityName && String(data[i][townIdx]).trim() === town) {
                  fallbackLat = parseFloat(data[i][latMasterIdx]) || null;
                  fallbackLng = parseFloat(data[i][lngMasterIdx]) || null;
                  if (fallbackLat) break;
                }
              }
            }

            areas.push({
              name: town,
              fullName: town,
              done: 0,
              total: 0,
              lat: fallbackLat,
              lng: fallbackLng
            });
          }
        });

        return {
          success: true,
          cityName: cityName,
          areas: areas
        };
      } catch (err) {
        return {
          success: false,
          cityName: cityName || '',
          areas: [],
          message: err.message
        };
      }
    }
  }

  Tier2Service.instance = null;
  global.Tier2Service = Tier2Service;

  global.getTier2 = function(cityName) {
    return Tier2Service.getInstance().getTier2(cityName);
  };
})(this);
