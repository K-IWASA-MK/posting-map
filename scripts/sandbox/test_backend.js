const fs = require('fs');

const CONFIG = {
  CHUNK_SIZE: 10,
  SHEET_TEMPLATE: "原本",
};

function toFullWidthKana(str) {
  if (!str) return "";
  const kanaMap = {
    'ｱ': 'ア', 'ｲ': 'イ', 'ｳ': 'ウ', 'ｴ': 'エ', 'ｵ': 'オ',
    'ｶ': 'カ', 'ｷ': 'キ', 'ｸ': 'ク', 'ｹ': 'ケ', 'ｺ': 'コ',
    'ｻ': 'サ', 'ｼ': 'ジ', 'ｽ': 'ス', 'ｾ': 'セ', 'ｿ': 'ソ',
    'ﾀ': 'タ', 'ﾁ': 'チ', 'ﾂ': 'ツ', 'ﾃ': 'テ', 'ﾄ': 'ト',
    'ﾅ': 'ナ', 'ﾆ': 'ニ', 'ﾇ': 'ヌ', 'ﾈ': 'ネ', 'ﾉ': 'ノ',
    'ﾊ': 'ハ', 'ﾋ': 'ヒ', 'ﾌ': 'フ', 'ﾍ': 'ヘ', 'ﾎ': 'ホ',
    'ﾏ': 'マ', 'ﾐ': 'ミ', 'ﾑ': 'ム', 'ﾒ': 'メ', 'ﾓ': 'モ',
    'ﾔ': 'ヤ', 'ﾕ': 'ユ', 'ﾖ': 'ヨ',
    'ﾗ': 'ラ', 'ﾘ': 'リ', 'ﾙ': 'ル', 'ﾚ': 'レ', 'ﾛ': 'ロ',
    'ﾜ': 'ワ', 'ｦ': 'ヲ', 'ﾝ': 'ン',
    'ｧ': 'ァ', 'ｨ': 'ィ', 'ｩ': 'ゥ', 'ｪ': 'ェ', 'ｫ': 'ォ',
    'ｬ': 'ャ', 'ｭ': 'ュ', 'ｮ': 'ョ', 'ｯ': 'ッ',
    'ｰ': 'ー', 'ﾞ': '゛', 'ﾟ': '゜'
  };
  let s = str.replace(/[ｱ-ﾝｧ-ｫｬ-ｮｯｰﾞﾟ]/g, m => kanaMap[m] || m);
  s = s.replace(/カ゛/g, 'ガ').replace(/キ゛/g, 'ギ').replace(/ク゛/g, 'グ').replace(/ケ゛/g, 'ゲ').replace(/コ゛/g, 'ゴ')
       .replace(/サ゛/g, 'ザ').replace(/シ゛/g, 'ジ').replace(/ス゛/g, 'ズ').replace(/セ゛/g, 'ゼ').replace(/ソ゛/g, 'ゾ')
       .replace(/タ゛/g, 'ダ').replace(/チ゛/g, 'ヂ').replace(/ツ゛/g, 'ヅ').replace(/テ゛/g, 'デ').replace(/ト゛/g, 'ド')
       .replace(/ハ゛/g, 'バ').replace(/ヒ゛/g, 'ビ').replace(/フ゛/g, 'ブ').replace(/ヘ゛/g, 'ベ').replace(/ホ゛/g, 'ボ')
       .replace(/ハ゜/g, 'パ').replace(/ヒ゜/g, 'ピ').replace(/フ゜/g, 'プ').replace(/ヘ゜/g, 'ペ').replace(/ホ゜/g, 'ポ');
  return s;
}

function extractCityName(addr) {
  if (addr.indexOf("四日市市") === 0) return "四日市市";
  return addr.match(/^(.+?[市郡])/) ? addr.match(/^(.+?[市郡])/)[1] : "エリア";
}

function extractDistrictAddresses(districtCsvPath, postalCsvPath, targetDistrict, targetPref) {
    const districtData = fs.readFileSync(districtCsvPath, 'utf8').split('\n').map(l => l.split(','));
    const postalData = fs.readFileSync(postalCsvPath, 'utf8').split('\n').map(l => l.split(','));

    const targetRules = [];
    for (let i = 1; i < districtData.length; i++) {
        const row = districtData[i];
        if (row && row[0] === targetDistrict && row[1] === targetPref) {
            targetRules.push({ city: row[2], townArea: row[3] || "" });
        }
    }

    const addressMap = new Map();
    targetRules.forEach(rule => {
        if (rule.townArea) {
            const addrString = rule.townArea.startsWith(rule.city) ? rule.townArea : rule.city + rule.townArea;
            addressMap.set(addrString, "MATCHED");
        } else {
            postalData.forEach(row => {
                if (row && row[6] === targetPref && row[7] === rule.city) {
                    const townRaw = row[8];
                    if (townRaw && townRaw !== "以下に掲載がない場合") {
                        const addr = rule.city + townRaw.replace(/（.*?）/g, "");
                        addressMap.set(addr, "POSTAL_EXPANDED");
                    }
                }
            });
        }
    });

    const cityKanaMap = {};
    postalData.forEach(row => {
        if (row && row[7] && row[4]) {
            const cityKanji = row[7].toString().trim();
            const cityKana = row[4].toString().trim();
            if (cityKanji && cityKana && !cityKanaMap[cityKanji]) {
                cityKanaMap[cityKanji] = toFullWidthKana(cityKana);
            }
        }
    });

    return Array.from(addressMap, ([address, type]) => {
        const city = extractCityName(address);
        return {
            address,
            city,
            cityKana: cityKanaMap[city] || ""
        };
    });
}

function simulateBatch(addresses, startIndex = 0) {
  let cityCounts = {};
  let lastCity = "";
  let itemsInBlock = 0;
  const chunkSize = CONFIG.CHUNK_SIZE;

  // 1. Simulation loop (restore state)
  for (let i = 0; i < startIndex; i++) {
    const c = extractCityName(addresses[i].address);
    if (c !== lastCity || itemsInBlock >= chunkSize) {
      cityCounts[c] = (cityCounts[c] || 0) + 1;
      itemsInBlock = 0;
      lastCity = c;
    }
    itemsInBlock++;
  }

  console.log(`[Simulation State at startIndex=${startIndex}]`);
  console.log(`cityCounts:`, cityCounts);
  console.log(`lastCity: "${lastCity}"`);
  console.log(`itemsInBlock: ${itemsInBlock}`);

  const generatedSheets = {}; // { sheetName: [addresses] }

  // 2. Main loop
  for (let currentIndex = startIndex; currentIndex < addresses.length; currentIndex++) {
    const currentAddr = addresses[currentIndex];
    const currentCity = extractCityName(currentAddr.address);

    if (currentCity !== lastCity || itemsInBlock >= chunkSize) {
      cityCounts[currentCity] = (cityCounts[currentCity] || 0) + 1;
      itemsInBlock = 0;
      lastCity = currentCity;
    }

    let sheetName =
      cityCounts[currentCity] === 1
        ? currentCity
        : `${currentCity}(${cityCounts[currentCity]})`;

    if (!generatedSheets[sheetName]) {
      generatedSheets[sheetName] = [];
    }

    generatedSheets[sheetName].push({
      index: currentIndex,
      address: currentAddr.address,
      rowInSheet: itemsInBlock + 2
    });

    itemsInBlock++;
  }

  return generatedSheets;
}

const targetDistrict = "第2区";
const targetPref = "三重県";
const addresses = extractDistrictAddresses(
    'data/三重県選挙区区割り.csv',
    'data/MIE_POSTAL.CSV',
    targetDistrict,
    targetPref
);

// 市町村名でソートして、同じ市町村の住所データが連続するように保証する
addresses.sort((a, b) => {
  const comp = (a.cityKana || "").localeCompare(b.cityKana || "", 'ja');
  if (comp !== 0) return comp;
  return a.address.localeCompare(b.address, 'ja');
});

console.log(`Addresses total: ${addresses.length}`);
const sheets = simulateBatch(addresses, 0);


console.log("\n[Generated Sheets Summary]");
Object.entries(sheets).forEach(([sheetName, items]) => {
  console.log(`Sheet: "${sheetName}" -> ${items.length} items`);
  items.forEach(item => {
    console.log(`  Row ${item.rowInSheet}: [Index ${item.index}] ${item.address}`);
  });
});

