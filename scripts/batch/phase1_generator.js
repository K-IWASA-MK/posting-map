const fs = require('fs');
const path = require('path');

const csvPath = '/Volumes/SSD_DATA/AI Development OS/projects/posting-map/data/MIE03_ADDRESS_MASTER.csv';
const content = fs.readFileSync(csvPath, 'utf8');
const lines = content.trim().split('\n').map(line => line.trim()).filter(line => line.length > 0);

if (lines.length === 0) {
  throw new Error('Input master CSV is empty');
}

// Header: municipality_code,city_name,town_name,full_address,postal_code,latitude,longitude,source
const header = lines[0].split(',').map(h => h.trim());
const cityIdx = header.indexOf('city_name');
const fullAddressIdx = header.indexOf('full_address');
const postalIdx = header.indexOf('postal_code');

if (cityIdx === -1 || fullAddressIdx === -1 || postalIdx === -1) {
  throw new Error('CSV columns city_name, full_address, and postal_code are required.');
}

const records = [];

for (let i = 1; i < lines.length; i++) {
  const line = lines[i];
  
  // Custom CSV parser supporting commas inside quotes (though this CSV doesn't have it, let's keep it safe)
  const row = [];
  let current = '';
  let inQuotes = false;
  for (let j = 0; j < line.length; j++) {
    const char = line[j];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  row.push(current.trim());
  
  if (row.length < header.length) continue;
  
  const city = row[cityIdx];
  const fullAddress = row[fullAddressIdx].replace(/"/g, '').trim();
  const postal = row[postalIdx].replace(/-/g, '').trim();
  
  records.push({
    originalIdx: i, // 1-indexed row number from CSV (excluding header)
    city: city,
    fullAddress: fullAddress,
    postal: postal,
    rawRow: row
  });
}

console.log(`Successfully parsed ${records.length} records from MIE-03 Master CSV.`);

// Sort according to instructions:
// 1st key: postal code ASC
// 2nd key: fullAddress ASC
// 3rd key: original index ASC (original row number)
records.sort((a, b) => {
  if (a.postal !== b.postal) {
    return a.postal.localeCompare(b.postal);
  }
  const addrComp = a.fullAddress.localeCompare(b.fullAddress);
  if (addrComp !== 0) {
    return addrComp;
  }
  return a.originalIdx - b.originalIdx;
});

// Group by municipality (city)
const groups = {};
records.forEach(r => {
  if (!groups[r.city]) {
    groups[r.city] = [];
  }
  groups[r.city].push(r);
});

// Build batch plan
const batchPlan = {
  municipalityBatches: {}
};

for (const municipality in groups) {
  const mRecords = groups[municipality];
  const total = mRecords.length;
  const sheetCount = Math.ceil(total / 10);
  
  const batches = [];
  for (let b = 0; b < sheetCount; b++) {
    const start = b * 10;
    const end = Math.min(start + 10, total);
    const batchNo = b + 1;
    const sheetName = batchNo === 1 ? municipality : `${municipality}（${batchNo}）`;
    
    const batchRecords = mRecords.slice(start, end).map(r => ({
      address: r.fullAddress,
      zip: r.postal,
      originalLineNumber: r.originalIdx
    }));
    
    batches.push({
      sheetName: sheetName,
      batchNo: batchNo,
      rows: batchRecords.length,
      startIndex: start + 1,
      endIndex: end,
      records: batchRecords
    });
  }
  
  batchPlan.municipalityBatches[municipality] = {
    totalRecords: total,
    totalSheets: sheetCount,
    batches: batches
  };
}

fs.writeFileSync('/Volumes/SSD_DATA/AI Development OS/projects/posting-map/batch/batch_plan.json', JSON.stringify(batchPlan, null, 2));
console.log('batch_plan.json generated successfully from MIE-03 Master CSV!');

for (const m in batchPlan.municipalityBatches) {
  const data = batchPlan.municipalityBatches[m];
  console.log(` - ${m}: ${data.totalRecords} records -> ${data.totalSheets} sheets`);
}
