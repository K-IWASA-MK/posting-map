import csv
import re
import unicodedata

def to_full_width_kana(s):
    return unicodedata.normalize('NFKC', s)

# Read District 2 constraints
district_2_cities = []
district_2_exact = []
with open('data/三重県選挙区区割り.csv', 'r', encoding='utf-8') as f:
    reader = csv.reader(f)
    next(reader) # skip header
    for row in reader:
        if row[0] == '第2区':
            city = row[2]
            detail = row[3]
            if detail:
                district_2_exact.append((city, detail))
            else:
                district_2_cities.append(city)

# Build city/town kana maps
city_kana_map = {}
town_kana_map = {}
with open('data/MIE_POSTAL.CSV', 'r', encoding='utf-8') as f:
    reader = csv.reader(f)
    for row in reader:
        if len(row) < 9: continue
        city_kanji = row[7].strip()
        city_kana = to_full_width_kana(row[4].strip())
        town_kanji = row[8].strip()
        town_kana = to_full_width_kana(row[5].strip())
        
        if city_kanji and city_kana and city_kanji not in city_kana_map:
            city_kana_map[city_kanji] = city_kana
            
        town_clean = re.sub(r'（.*?）', '', town_kanji)
        town_clean = re.sub(r'\(.*?\)', '', town_clean)
        town_kana_clean = re.sub(r'（.*?）', '', town_kana)
        town_kana_clean = re.sub(r'\(.*?\)', '', town_kana_clean)
        
        if town_clean and town_kana_clean and town_clean not in town_kana_map:
            town_kana_map[town_clean] = town_kana_clean

raw_addresses = []

# Process MIE_POSTAL.CSV
with open('data/MIE_POSTAL.CSV', 'r', encoding='utf-8') as f:
    f.seek(0)
    reader = csv.reader(f)
    for row in reader:
        if len(row) < 9: continue
        pref = row[6]
        city = row[7]
        town = row[8]
        
        if town == '以下に掲載がない場合': continue
        
        if city in district_2_cities:
            # We add all towns for these cities
            raw_addresses.append({
                'address': f"{pref}{city}{town}",
                'city': city
            })

# For exact constraints like "四日市市日永地区市民センター管内"
for city, detail in district_2_exact:
    raw_addresses.append({
        'address': f"三重県{detail}",
        'city': city
    })

# Chome expansion & collect sorting metadata
expanded_items = []
for item in raw_addresses:
    addr = item['address']
    city = item['city']
    
    # Match something like "１～５丁目" or "1〜5丁目"
    match = re.search(r'([０-９0-9]+)[〜～\-]([０-９0-9]+)丁目', addr)
    expanded_addrs = []
    if match:
        start = int(match.group(1).translate(str.maketrans('０１２３４５６７８９', '0123456789')))
        end = int(match.group(2).translate(str.maketrans('０１２３４５６７８９', '0123456789')))
        base_addr = addr[:match.start()]
        for i in range(start, end + 1):
            expanded_addrs.append(f"{base_addr}{i}丁目")
    else:
        expanded_addrs.append(addr)
        
    for a in expanded_addrs:
        city_idx = a.find(city)
        town = a[city_idx + len(city):] if city_idx != -1 else a
        
        # 簡易的な前方一致でカナを特定
        town_kana = town
        for k, v in town_kana_map.items():
            if town.startswith(k):
                town_kana = town.replace(k, v, 1)
                break
        
        expanded_items.append({
            'address': a,
            'city': city,
            'city_kana': city_kana_map.get(city, ''),
            'town_kana': town_kana
        })

# Sort items by city_kana and town_kana
expanded_items.sort(key=lambda x: (x['city_kana'], x['town_kana']))

expanded_addresses = [item['address'] for item in expanded_items]

# Generate GAS code
gas_code = """// GAS code is managed directly in the Google Apps Script editor.

const cities = [
"""
for addr in expanded_addresses:
    # Map link
    map_url = f"https://www.google.com/maps/search/?api=1&query={addr}"
    gas_code += f'  ["{addr}", "{map_url}"],\n'

gas_code += """];

function populateAreaSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName('Area');
  if (!sheet) return;
  
  // Start from B2, C2
  const startRow = 2;
  const numRows = cities.length;
  
  // Clear existing
  sheet.getRange(startRow, 2, sheet.getMaxRows(), 2).clearContent();
  
  // Set values
  sheet.getRange(startRow, 2, numRows, 2).setValues(cities);
}
"""

with open('scripts/gas.gs', 'w', encoding='utf-8') as f:
    f.write(gas_code)

print("GAS script generated successfully. Total addresses:", len(expanded_addresses))
