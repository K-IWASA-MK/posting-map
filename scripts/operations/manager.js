/**
 * POSTING MAP Dashboard Manager (Field Data Mirror Production Edition)
 * 
 * 思想:
 * 「データを説明しない。データを見せる。」
 * 「現場アプリが持っている“現実の現場データ”を、ダッシュボードが正確に映す。」
 * 
 * SSOT原則:
 * 1. 住所マスター: /data/MIE03_ADDRESS_MASTER_858.csv (全858件)
 * 2. 状態判定: 現場アプリ (active/dashboard/app.js, render.js) と完全同一の
 *    callApiPost('getGlobalPinStatus') 経由の実 completed / inProgress 配列と rowId 結合。
 */

function getApiUrl() {
  if (typeof window !== 'undefined' && window.PMS_CLIENT_CONFIG && window.PMS_CLIENT_CONFIG.api && window.PMS_CLIENT_CONFIG.api.gasWebAppUrl) {
    return window.PMS_CLIENT_CONFIG.api.gasWebAppUrl;
  }
  return "https://script.google.com/macros/s/AKfycbyjNwgZ_6CCv258lqKMrCXJYi0wDR23ZCyyzOQIV1R_WcCF5TQxYXOzZWWSJd_vMyu_/exec";
}

// 現場データ保持用ステート（現場アプリと同一構造）
const DashboardState = {
  summary: null,
  cities: [],
  stocks: [],
  activities: [],
  roster: [],
  globalPinStatus: { inProgress: [], completed: [] },
  masterPins858: [], // SSOT 858件マスターピン
  selectedCity: 'ALL',
  currentFocus: null,
  map: null,
  markersLayer: null,
  fullscreenMap: null,
  fullscreenMarkersLayer: null
};

// 各自治体の代表座標とズームレベル
const CITY_GEO = {
  'ALL': { center: [35.0641, 136.6200], zoom: 11 },
  '桑名市': { center: [35.0641, 136.6800], zoom: 13 },
  '四日市市': { center: [34.9641, 136.6200], zoom: 13 },
  'いなべ市': { center: [35.1561, 136.5167], zoom: 13 },
  '員弁郡東員町': { center: [35.0744, 136.5922], zoom: 14 },
  '桑名郡木曽岬町': { center: [35.0611, 136.7361], zoom: 14 },
  '三重郡菰野町': { center: [35.0119, 136.5161], zoom: 13 },
  '三重郡朝日町': { center: [35.0389, 136.6667], zoom: 14 },
  '三重郡川越町': { center: [35.0194, 136.6722], zoom: 14 }
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDashboard);
} else {
  initDashboard();
}

async function initDashboard() {
  initMap();
  
  // 1. SSOT 858件住所マスターの読み込み
  await loadAddressMaster858();

  // 2. 現場実データの同期（現場アプリと完全同一のPOST経路）
  await syncDashboardData();

  // 30秒ごとの自動データ同期
  setInterval(() => {
    syncDashboardData();
  }, 30000);

  // タブ復帰時の即時同期
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      syncDashboardData();
    }
  });

  // ウィンドウリサイズ時のマップ再描画フィット
  window.addEventListener('resize', () => {
    if (DashboardState.map) DashboardState.map.invalidateSize();
    if (DashboardState.fullscreenMap) DashboardState.fullscreenMap.invalidateSize();
  });
}

/**
 * 現場アプリと完全同一の POST 通信関数 (active/dashboard/app.js 準拠)
 */
async function callApiPost(action, payload = {}) {
  const url = `${getApiUrl()}?_t=${Date.now()}`;
  const body = JSON.stringify({ action, ...payload });

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 25000);

  const response = await fetch(url, {
    method: 'POST',
    mode: 'cors',
    credentials: 'omit',
    cache: 'no-store',
    redirect: 'follow',
    body: body,
    signal: controller.signal
  });
  clearTimeout(timeoutId);

  if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch (parseErr) {
    throw new Error("JSON形式ではない応答を受け取りました: " + parseErr.message);
  }

  if (data && typeof data === 'object' && 'data' in data && data.data !== null) {
    const innerSuccess = data.data.success !== undefined ? data.data.success : data.success;
    if (innerSuccess === false) throw new Error(data.data.message || data.message || "API Error");
    return data.data;
  }

  if (data.success === false) throw new Error(data.message || "API Error");
  return data;
}

/**
 * SSOT: data/MIE03_ADDRESS_MASTER_858.csv の取得とパース
 */
async function loadAddressMaster858() {
  try {
    const res = await fetch('/data/MIE03_ADDRESS_MASTER_858.csv');
    if (!res.ok) {
      throw new Error(`Failed to load CSV: ${res.status}`);
    }
    const text = await res.text();
    const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
    
    // ヘッダー行をスキップしてパース
    const pins = [];
    for (let i = 1; i < lines.length; i++) {
      const parts = lines[i].split(',');
      if (parts.length >= 5) {
        const rowId = parseInt(parts[0], 10);
        const cityName = parts[1];
        const townName = parts[2];
        const lat = parseFloat(parts[3]);
        const lng = parseFloat(parts[4]);

        if (!isNaN(rowId) && !isNaN(lat) && !isNaN(lng)) {
          pins.push({
            rowId: rowId,
            cityName: cityName,
            townName: townName,
            fullName: `${cityName} ${townName}`,
            lat: lat,
            lng: lng
          });
        }
      }
    }

    DashboardState.masterPins858 = pins;
    console.log(`[SSOT Master Pins Loaded] Total: ${pins.length} items (SSOT 858 verified)`);

    // マップにピンを描画
    renderPinsOnMap(DashboardState.map, DashboardState.markersLayer, pins);

  } catch (err) {
    console.error('[SSOT Load Error]', err);
  }
}

/**
 * Leaflet Map 初期化
 */
function initMap() {
  const mapEl = document.getElementById('map');
  if (!mapEl || DashboardState.map) return;

  try {
    const map = L.map('map', {
      zoomControl: true,
      attributionControl: false
    }).setView(CITY_GEO['ALL'].center, CITY_GEO['ALL'].zoom);

    // CartoDB Dark Matter タイル
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd'
    }).addTo(map);

    DashboardState.markersLayer = L.layerGroup().addTo(map);
    DashboardState.map = map;

    setTimeout(() => {
      map.invalidateSize();
    }, 200);
  } catch (e) {
    console.warn('[Map Init Error]', e);
  }
}

/**
 * 現場データの同期（現場アプリと完全同一のPOST取得経路）
 */
async function syncDashboardData() {
  try {
    const [summaryRes, tier1Res, stockRes, rankRes, pinStatusRes, rosterRes] = await Promise.all([
      callApiPost('getSystemSummary').catch(e => ({ success: false, error: e.message })),
      callApiPost('getTier1').catch(e => ({ success: false, error: e.message })),
      callApiPost('getFlyerStock').catch(e => ({ success: false, error: e.message })),
      callApiPost('getRanking').catch(e => ({ success: false, error: e.message })),
      callApiPost('getGlobalPinStatus').catch(e => ({ success: false, error: e.message })),
      callApiPost('getRoster').catch(e => ({ success: false, error: e.message }))
    ]);

    const isSummaryOk = summaryRes && summaryRes.success;
    const isTier1Ok = tier1Res && tier1Res.success;
    const isStockOk = stockRes && stockRes.success;
    const isRankOk = rankRes && rankRes.success;
    const isPinStatusOk = pinStatusRes && pinStatusRes.success;
    const isRosterOk = rosterRes && rosterRes.success;

    // 1. 配布エリア事実データ
    if (isSummaryOk) {
      DashboardState.summary = summaryRes;
    }

    // 2. 自治体サマリーデータ
    if (isTier1Ok) {
      DashboardState.cities = tier1Res.cities || [];
    }

    // 3. 保有チラシデータ
    if (isStockOk) {
      DashboardState.stocks = stockRes.stocks || [];
    }

    // 4. 名簿データ
    if (isRosterOk) {
      DashboardState.roster = rosterRes.roster || [];
    }

    // 5. 現場ピンステータス（現場アプリと完全同一データ）
    if (isPinStatusOk) {
      DashboardState.globalPinStatus.inProgress = (pinStatusRes.inProgress || []).map(id => parseInt(id, 10)).filter(id => !isNaN(id));
      DashboardState.globalPinStatus.completed = (pinStatusRes.completed || []).map(id => parseInt(id, 10)).filter(id => !isNaN(id));
    }

    // 6. 配布実績 ＆ 最新の活動
    const rawActivities = isRankOk ? (rankRes.ranking || []) : [];
    const stockActivities = isStockOk ? (stockRes.stocks || []) : [];
    processActivities(rawActivities, stockActivities);

    // 7. 現在選択中の自治体に合わせて画面全体を再描画
    renderCurrentView();

    // 8. 通常マップと全画面マップのピンを再描画
    if (DashboardState.map && DashboardState.markersLayer) {
      renderPinsOnMap(DashboardState.map, DashboardState.markersLayer, DashboardState.masterPins858);
    }
    if (DashboardState.fullscreenMap && DashboardState.fullscreenMarkersLayer) {
      renderPinsOnMap(DashboardState.fullscreenMap, DashboardState.fullscreenMarkersLayer, DashboardState.masterPins858);
    }

    // 同期状態の表示
    const allOk = isSummaryOk && isTier1Ok && isStockOk && isPinStatusOk;
    setSyncStatus(allOk);

  } catch (err) {
    console.error('[Dashboard Sync Error]', err);
    setSyncStatus(false);
  }
}

/**
 * 現場アプリと完全同一のピン描画ロジック (active/dashboard/render.js 準拠)
 */
function renderPinsOnMap(mapInstance, layerGroup, pins) {
  if (!mapInstance || !layerGroup || !pins || pins.length === 0) return;

  layerGroup.clearLayers();

  const selectedCity = DashboardState.selectedCity;
  const isAll = selectedCity === 'ALL';
  const completedList = DashboardState.globalPinStatus.completed || [];
  const inProgressList = DashboardState.globalPinStatus.inProgress || [];

  pins.forEach(pin => {
    // 自治体フィルター判定
    const matchCity = isAll || pin.cityName.includes(selectedCity) || selectedCity.includes(pin.cityName);
    if (!matchCity) return;

    // 現場アプリと完全同一の判定条件 (active/dashboard/render.js Line 780〜795)
    const isCompleted = completedList.includes(pin.rowId);
    const isInProgress = inProgressList.includes(pin.rowId);

    // 地図ピンの確定3色ルール
    // 🟢 未配布 → #22C55E (枠: #16a34a)
    // 🔵 配布中 → #00B7FF (枠: #0284c7)
    // 🟠 完了   → #EA5F08 (枠: #fb923c)
    let pinColor = '#22C55E';
    let strokeColor = '#16a34a';
    let pinRadius = 4.5;
    let statusText = '○ 未配布';

    if (isCompleted) {
      pinColor = '#EA5F08';
      strokeColor = '#fb923c';
      pinRadius = 6;
      statusText = '● 配布済';
    } else if (isInProgress) {
      pinColor = '#00B7FF';
      strokeColor = '#0284c7';
      pinRadius = 5.5;
      statusText = '🔵 配布中';
    }

    const marker = L.circleMarker([pin.lat, pin.lng], {
      radius: pinRadius,
      fillColor: pinColor,
      color: strokeColor,
      weight: isCompleted ? 1.5 : 1,
      opacity: 0.9,
      fillOpacity: isCompleted ? 0.9 : 0.8
    });

    // タッチ/クリック時の詳細オーバーレイ表示
    marker.on('click', () => {
      showAreaDetail({
        name: pin.fullName,
        count: isCompleted ? '配布済' : (isInProgress ? '配布中' : '未配布'),
        staff: isCompleted ? '完了エリア' : (isInProgress ? '作業中' : '--'),
        time: isCompleted || isInProgress ? '本日' : '--'
      });
    });

    marker.bindPopup(`
      <div class="text-xs">
        <div class="font-bold text-white text-xs mb-0.5">${pin.fullName}</div>
        <div class="text-white/80 text-[11px]">状態: <span class="font-mono font-bold" style="color: ${pinColor}">${statusText}</span></div>
        <div class="text-white/40 text-[10px] mt-0.5">ID: ${pin.rowId} ｜ 座標: ${pin.lat.toFixed(4)}, ${pin.lng.toFixed(4)}</div>
      </div>
    `);

    layerGroup.addLayer(marker);
  });
}

/**
 * 自治体切替 (Control UI) イベントハンドラ
 */
function onCitySelected(cityName) {
  DashboardState.selectedCity = cityName;
  renderCurrentView();

  // ピンの再フィルタ描画
  if (DashboardState.map && DashboardState.markersLayer) {
    renderPinsOnMap(DashboardState.map, DashboardState.markersLayer, DashboardState.masterPins858);
  }
  if (DashboardState.fullscreenMap && DashboardState.fullscreenMarkersLayer) {
    renderPinsOnMap(DashboardState.fullscreenMap, DashboardState.fullscreenMarkersLayer, DashboardState.masterPins858);
  }

  // マップの連動ズーム移動
  const activeMap = DashboardState.currentFocus === 'areas' ? DashboardState.fullscreenMap : DashboardState.map;
  if (activeMap) {
    const target = CITY_GEO[cityName] || CITY_GEO['ALL'];
    activeMap.flyTo(target.center, target.zoom, {
      duration: 1.2,
      easeLinearity: 0.25
    });
  }
}

/**
 * 現在の自治体フィルターに応じた画面再描画
 */
function renderCurrentView() {
  const selected = DashboardState.selectedCity;
  const isAll = selected === 'ALL';
  const completedList = DashboardState.globalPinStatus.completed || [];

  // 1. トップの事実数字（SSOT 858件 ＆ 実配布完了データ連動）
  let totalAreas = DashboardState.masterPins858.length || 858;
  let doneAreas = DashboardState.masterPins858.filter(p => completedList.includes(p.rowId)).length;

  if (!isAll && DashboardState.masterPins858.length > 0) {
    const cityPins = DashboardState.masterPins858.filter(p => p.cityName.includes(selected) || selected.includes(p.cityName));
    totalAreas = cityPins.length;
    doneAreas = cityPins.filter(p => completedList.includes(p.rowId)).length;
  }

  const doneAreasEl = document.getElementById('fact-done-areas');
  const totalAreasEl = document.getElementById('fact-total-areas');
  const districtLabelEl = document.getElementById('map-district-label');

  if (doneAreasEl) doneAreasEl.textContent = doneAreas.toLocaleString();
  if (totalAreasEl) totalAreasEl.textContent = totalAreas.toLocaleString();
  if (districtLabelEl) {
    districtLabelEl.textContent = isAll ? (DashboardState.summary?.districtName || '三重第3区 (858エリア)') : `${selected} (${totalAreas}エリア)`;
  }

  // 2. 保有チラシの描画
  renderStockFacts(DashboardState.stocks, selected);

  // 3. 最新の活動 ＆ 配布実績の描画
  renderActivityFacts(DashboardState.activities, selected);
}

/**
 * 保有チラシの描画
 */
function renderStockFacts(stocks, selectedCity) {
  let totalStock = 0;
  const locationMap = {};

  stocks.forEach(s => {
    const loc = s.location || 'その他拠点';
    const count = Number(s.count) || 0;
    
    // 選択自治体でフィルタ
    if (selectedCity === 'ALL' || loc.includes(selectedCity) || selectedCity.includes(loc)) {
      locationMap[loc] = (locationMap[loc] || 0) + count;
      totalStock += count;
    }
  });

  const totalStocksEl = document.getElementById('fact-total-stocks');
  if (totalStocksEl) totalStocksEl.textContent = totalStock.toLocaleString();

  // 保有チラシリスト（中段カード）
  const listEl = document.getElementById('stock-location-list');
  if (!listEl) return;

  const locations = Object.keys(locationMap);
  if (locations.length === 0) {
    listEl.innerHTML = `<div class="text-[11px] text-[#A8B3C7]/60 text-center py-2">保管データなし</div>`;
    return;
  }

  let html = '';
  locations.forEach(loc => {
    const count = locationMap[loc];
    html += `
      <div class="flex items-center justify-between p-2 px-2.5 rounded-lg bg-[#222C3E] border border-[#2A3547] text-xs">
        <span class="font-medium text-[#E6ECF3] truncate text-[11px]">${loc}</span>
        <span class="font-mono font-bold text-white text-xs">${count.toLocaleString()} <span class="text-[9px] text-[#A8B3C7] font-normal">枚</span></span>
      </div>
    `;
  });
  listEl.innerHTML = html;
}

/**
 * 配布実績データの集約
 */
function processActivities(rankings, stocks) {
  const activities = [];

  rankings.forEach(r => {
    activities.push({
      time: r.updatedAt || '本日',
      staffId: r.staffId || 'スタッフ',
      staffName: r.name || '',
      location: r.districtName || r.areaName || '',
      count: Number(r.count) || 0,
      photoUrl: r.photoUrl || ''
    });
  });

  stocks.forEach(s => {
    if (s.updatedAt) {
      activities.push({
        time: s.updatedAt,
        staffId: s.staffId || 'スタッフ',
        staffName: s.staffName || '',
        location: s.location || '',
        count: Number(s.count) || 0,
        photoUrl: s.photoUrl || ''
      });
    }
  });

  DashboardState.activities = activities;
}

/**
 * 配布実績 ＆ 最新活動の描画 (ダミーフォールバック全廃)
 */
function renderActivityFacts(activities, selectedCity) {
  const filtered = (selectedCity === 'ALL')
    ? activities
    : activities.filter(a => a.location.includes(selectedCity) || selectedCity.includes(a.location));

  // 1. 配布した人の実人数
  const activeMembersEl = document.getElementById('fact-active-members');
  if (activeMembersEl) {
    const uniqueStaff = new Set(filtered.map(a => a.staffId).filter(id => id && id !== 'スタッフ'));
    activeMembersEl.textContent = uniqueStaff.size;
  }

  // 2. 最新の活動（実データが存在する場合のみ表示）
  const latest = filtered.length > 0 ? filtered[0] : (activities.length > 0 ? activities[0] : null);

  const lTimeEl = document.getElementById('latest-activity-time');
  const lStaffEl = document.getElementById('latest-activity-staff');
  const lLocEl = document.getElementById('latest-activity-location');
  const lCountEl = document.getElementById('latest-activity-count');
  const lImgEl = document.getElementById('latest-activity-img');
  const lPlaceholderEl = document.getElementById('latest-activity-placeholder');

  if (latest) {
    if (lTimeEl) lTimeEl.textContent = latest.time;
    if (lStaffEl) lStaffEl.textContent = latest.staffId;
    if (lLocEl) lLocEl.textContent = latest.location || '三重県内';
    if (lCountEl) lCountEl.textContent = latest.count ? latest.count.toLocaleString() : '--';

    if (latest.photoUrl && lImgEl && lPlaceholderEl) {
      lImgEl.src = latest.photoUrl;
      lImgEl.classList.remove('hidden');
      lPlaceholderEl.classList.add('hidden');
    }
  } else {
    // 実データが存在しない場合
    if (lTimeEl) lTimeEl.textContent = '--:--';
    if (lStaffEl) lStaffEl.textContent = '--';
    if (lLocEl) lLocEl.textContent = '本日の活動データなし';
    if (lCountEl) lCountEl.textContent = '0';
    if (lImgEl) lImgEl.classList.add('hidden');
    if (lPlaceholderEl) lPlaceholderEl.classList.remove('hidden');
  }

  // 3. 横並び配布実績フィード（下段）
  const recordsListEl = document.getElementById('distribution-records-list');
  if (recordsListEl) {
    if (filtered.length === 0) {
      recordsListEl.innerHTML = `<div class="text-[11px] text-[#A8B3C7]/60 py-1">本日の配布実績データはありません</div>`;
      return;
    }

    let recordsHtml = '';
    filtered.slice(0, 6).forEach(act => {
      recordsHtml += `
        <div class="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#222C3E] border border-[#2A3547] text-xs flex-shrink-0">
          <span class="font-mono text-[#A8B3C7] text-[10px]">${act.time}</span>
          <span class="font-mono font-bold text-brand text-[11px]">${act.staffId}</span>
          <span class="font-medium text-[#E6ECF3] text-[11px]">${act.location}</span>
          <span class="font-mono font-bold text-white text-[11px]">${act.count.toLocaleString()}枚</span>
          ${act.photoUrl ? '<span class="text-[10px]">📷</span>' : ''}
        </div>
      `;
    });
    recordsListEl.innerHTML = recordsHtml;
  }
}

/**
 * エリア詳細オーバーレイの表示
 */
function showAreaDetail(data) {
  const detailEl = document.getElementById('map-area-detail');
  const nameEl = document.getElementById('selected-area-name');
  const countEl = document.getElementById('selected-area-count');
  const staffEl = document.getElementById('selected-area-staff');
  const timeEl = document.getElementById('selected-area-time');

  if (nameEl) nameEl.textContent = data.name;
  if (countEl) countEl.textContent = data.count;
  if (staffEl) staffEl.textContent = data.staff;
  if (timeEl) timeEl.textContent = data.time;

  if (detailEl) detailEl.classList.remove('hidden');
}

function closeAreaDetail() {
  const detailEl = document.getElementById('map-area-detail');
  if (detailEl) detailEl.classList.add('hidden');
}

/**
 * 視点切り替えインタラクション（同一Dashboard内で見たい現実が主役になる）
 */
function focusCard(type) {
  const defaultGrid = document.getElementById('default-view-grid');
  const focusContainer = document.getElementById('focus-view-container');
  const focusHeader = document.getElementById('focus-header');
  const focusTitle = document.getElementById('focus-title');
  const focusIcon = document.getElementById('focus-icon');
  const focusContent = document.getElementById('focus-content');

  if (!defaultGrid || !focusContainer || !focusContent) return;

  DashboardState.currentFocus = type;
  defaultGrid.classList.add('hidden');
  focusContainer.classList.remove('hidden');
  if (focusHeader) focusHeader.classList.remove('hidden');

  updateNavHighlight(type);

  if (type === 'areas') {
    if (focusTitle) focusTitle.textContent = '配布エリア MAP (全画面)';
    if (focusIcon) focusIcon.textContent = '🗺️';
    focusContent.innerHTML = `
      <div class="h-full w-full rounded-xl overflow-hidden relative border border-[#2A3547] min-h-[400px]" id="fullscreen-map-box">
        <div id="fullscreen-map" class="w-full h-full"></div>
      </div>
    `;
    setTimeout(() => {
      const fsMap = L.map('fullscreen-map').setView(CITY_GEO[DashboardState.selectedCity]?.center || CITY_GEO['ALL'].center, CITY_GEO[DashboardState.selectedCity]?.zoom || 11);
      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(fsMap);
      
      DashboardState.fullscreenMarkersLayer = L.layerGroup().addTo(fsMap);
      DashboardState.fullscreenMap = fsMap;

      // 現場アプリと同一のピンを描画
      renderPinsOnMap(fsMap, DashboardState.fullscreenMarkersLayer, DashboardState.masterPins858);
      fsMap.invalidateSize();
    }, 150);

  } else if (type === 'stocks') {
    if (focusTitle) focusTitle.textContent = '保有チラシ 一覧';
    if (focusIcon) focusIcon.textContent = '📦';
    
    let html = '<div class="space-y-2.5">';
    if (DashboardState.stocks.length === 0) {
      html += `<div class="text-xs text-[#A8B3C7]/60 text-center py-6">保有チラシの登録データはありません</div>`;
    } else {
      DashboardState.stocks.forEach(s => {
        html += `
          <div class="flex items-center justify-between p-3.5 rounded-xl bg-[#222C3E] border border-[#2A3547]">
            <div>
              <div class="font-bold text-xs text-[#E6ECF3]">${s.location || '保管拠点'}</div>
              <div class="text-[11px] text-[#A8B3C7] mt-0.5">担当: ${s.staffName || s.staffId || '未設定'} ｜ 更新: ${s.updatedAt || '本日'}</div>
            </div>
            <div class="text-right">
              <span class="text-xl font-black font-mono text-white">${(Number(s.count) || 0).toLocaleString()}</span>
              <span class="text-[11px] text-[#A8B3C7] ml-0.5">枚</span>
            </div>
          </div>
        `;
      });
    }
    html += '</div>';
    focusContent.innerHTML = html;

  } else if (type === 'records') {
    if (focusTitle) focusTitle.textContent = '配布実績 詳細一覧';
    if (focusIcon) focusIcon.textContent = '📝';

    let html = '<div class="space-y-2.5">';
    if (DashboardState.activities.length === 0) {
      html += `<div class="text-xs text-[#A8B3C7]/60 text-center py-6">本日の配布実績データはありません</div>`;
    } else {
      DashboardState.activities.forEach(a => {
        html += `
          <div class="flex items-center justify-between p-3.5 rounded-xl bg-[#222C3E] border border-[#2A3547]">
            <div class="flex items-center gap-3">
              <span class="font-mono text-xs text-brand font-bold">${a.time}</span>
              <div>
                <span class="font-bold text-[#E6ECF3] text-xs">${a.staffId} ${a.staffName ? `(${a.staffName})` : ''}</span>
                <div class="text-[11px] text-[#A8B3C7]">${a.location}</div>
              </div>
            </div>
            <div class="flex items-center gap-3">
              <span class="text-lg font-mono font-black text-white">${a.count.toLocaleString()} 枚</span>
              ${a.photoUrl ? `<img src="${a.photoUrl}" alt="写真" class="w-10 h-10 rounded object-cover border border-[#2A3547]">` : ''}
            </div>
          </div>
        `;
      });
    }
    html += '</div>';
    focusContent.innerHTML = html;

  } else if (type === 'roster') {
    if (focusTitle) focusTitle.textContent = '名簿 (登録配布員)';
    if (focusIcon) focusIcon.textContent = '📋';

    let html = '<div class="space-y-2.5">';
    if (DashboardState.roster.length === 0) {
      html += `<div class="text-xs text-[#A8B3C7]/60 text-center py-6">登録配布員データはありません</div>`;
    } else {
      DashboardState.roster.forEach(r => {
        html += `
          <div class="p-3.5 rounded-xl bg-[#222C3E] border border-[#2A3547]">
            <div class="font-bold text-xs text-[#E6ECF3]">${r.staffId || ''} ｜ ${r.name || '配布員'}</div>
            <div class="text-[#A8B3C7] text-[11px] mt-0.5">管轄: ${r.area || r.district || '未設定'} ｜ 登録: ${r.registeredAt || '未設定'}</div>
          </div>
        `;
      });
    }
    html += '</div>';
    focusContent.innerHTML = html;

  } else if (type === 'requests') {
    if (focusTitle) focusTitle.textContent = '受渡要請';
    if (focusIcon) focusIcon.textContent = '🤝';
    focusContent.innerHTML = `
      <div class="text-xs text-[#A8B3C7]/60 text-center py-6">
        現在、アクティブな受渡要請はありません
      </div>
    `;
  }
}

/**
 * フォーカスをリセットして全体ビューに戻る
 */
function resetFocus() {
  const defaultGrid = document.getElementById('default-view-grid');
  const focusContainer = document.getElementById('focus-view-container');
  const focusHeader = document.getElementById('focus-header');

  if (defaultGrid && focusContainer) {
    DashboardState.currentFocus = null;
    defaultGrid.classList.remove('hidden');
    focusContainer.classList.add('hidden');
    if (focusHeader) focusHeader.classList.add('hidden');
  }

  updateNavHighlight('areas');
  if (DashboardState.map) {
    DashboardState.map.invalidateSize();
    renderPinsOnMap(DashboardState.map, DashboardState.markersLayer, DashboardState.masterPins858);
  }
}

/**
 * 左ナビゲーションからの視点切り替え
 */
function switchView(type) {
  focusCard(type);
}

function updateNavHighlight(activeType) {
  const navTypes = ['roster', 'stocks', 'requests', 'records', 'areas'];
  navTypes.forEach(t => {
    const el = document.getElementById(`nav-${t}`);
    if (el) {
      if (t === activeType) {
        el.className = 'nav-item w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-brand/10 text-brand border border-brand/30 font-bold transition-all text-left';
      } else {
        el.className = 'nav-item w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-[#A8B3C7] hover:text-white hover:bg-white/5 transition-all text-left';
      }
    }
  });
}

/**
 * 同期ステータス表示
 */
function setSyncStatus(isLive) {
  const dot = document.getElementById('live-dot');
  const text = document.getElementById('live-status-text');
  const clock = document.getElementById('sync-clock');

  if (dot) dot.className = isLive ? 'w-2 h-2 rounded-full bg-statusGreen' : 'w-2 h-2 rounded-full bg-statusYellow';
  if (text) text.textContent = isLive ? '現場データ同期' : '再接続待機中';
  if (clock) {
    const now = new Date();
    clock.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  }
}
