/**
 * POSTING MAP Dashboard Manager (Field Data Mirror Production Edition)
 * 
 * 思想:
 * 「データを説明しない。データを見せる。」
 * 「現場アプリが持っている“現実の現場データ”を、ダッシュボードが正確に映す。」
 * 
 * SSOT原則:
 * 1. 住所マスター: config.js の staticMaster.addressCsvFilename で指定（地図座標専用）
 * 2. 自治体一覧: Backend getTier1 が唯一の正
 * 3. 状態判定: 現場アプリと完全同一の callApiPost('getGlobalPinStatus') 経由
 */

function getApiUrl() {
  if (typeof window !== 'undefined' && window.PMS_CLIENT_CONFIG && window.PMS_CLIENT_CONFIG.api && window.PMS_CLIENT_CONFIG.api.gasWebAppUrl) {
    return window.PMS_CLIENT_CONFIG.api.gasWebAppUrl;
  }
  throw new Error('[Dashboard Config Error] PMS_CLIENT_CONFIG.api.gasWebAppUrl が未設定です。config.js を確認してください。');
}

/** config.js から静的マスター設定を取得するヘルパー */
function getStaticMasterConfig() {
  if (typeof window !== 'undefined' && window.PMS_CLIENT_CONFIG && window.PMS_CLIENT_CONFIG.staticMaster) {
    return window.PMS_CLIENT_CONFIG.staticMaster;
  }
  return {};
}

// 現場データ保持用ステート（現場アプリと同一構造）
const DashboardState = {
  summary: null,
  cities: [],
  stocks: [],
  ranking: [], // 現場アプリと完全同一の計算済みランキング (getRanking)
  roster: [],
  requests: [], // 受渡要請 (getTransferRequests)
  liveRecords: [], // Backendから取得した最新配布実績レコード (SSOT)
  latestSeenRecordId: null, // アニメーション検知用最新レコードID
  globalPinStatus: { inProgress: [], completed: [] },
  masterPins: [], // SSOT マスターピン（config.js で指定された CSV から動的取得）
  masterLoadStatus: 'PENDING', // 'PENDING' | 'LOADED' | 'ERROR'
  boundariesGeoJson: null, // 国勢調査小地域境界GeoJSON（純粋地理背景）
  boundariesLayer: null, // Leaflet GeoJSON レイヤー
  selectedCity: 'ALL',
  currentFocus: 'areas',
  map: null,
  markersLayer: null
};
if (typeof window !== 'undefined') {
  window.DashboardState = DashboardState;
}

// エリア配布状態の確定SSOT定義（ピン・ポップアップ・下部詳細で同一定義を使用）
const AREA_STATUS_CONFIG = {
  COMPLETED: {
    statusKey: 'COMPLETED',
    statusText: '● 配布済',
    color: '#EA5F08',
    strokeColor: '#fb923c',
    radius: 6,
    weight: 1.5,
    opacity: 0.9,
    fillOpacity: 0.9
  },
  IN_PROGRESS: {
    statusKey: 'IN_PROGRESS',
    statusText: '🔵 配布中',
    color: '#00B7FF',
    strokeColor: '#0284c7',
    radius: 5.5,
    weight: 1,
    opacity: 0.9,
    fillOpacity: 0.8
  },
  UNALLOCATED: {
    statusKey: 'UNALLOCATED',
    statusText: '○ 未配布',
    color: '#22C55E',
    strokeColor: '#16a34a',
    radius: 4.5,
    weight: 1,
    opacity: 0.9,
    fillOpacity: 0.8
  },
  UNKNOWN: {
    statusKey: 'UNKNOWN',
    statusText: '？ 状態不明',
    color: '#A8B3C7',
    strokeColor: '#64748b',
    radius: 4.5,
    weight: 1,
    opacity: 0.7,
    fillOpacity: 0.5
  }
};

/**
 * ズームレベルに応じたピン半径（radius）動的スケーリング
 * - 広域（Lv11全域初期表示）では大量ピンの密集を防ぐため、極小ドット（2.2px / 3.0px）で表示し、
 *   道路網や市町名（四日市・桑名・いなべ等）の可読性を最大化。
 * - ズームインするにつれて段階的に拡大し、街区・丁目レベル（Lv15〜17）では特大ピン（10px〜24px）へ拡張。
 *
 * 【計算仕様】
 * - Lv <= 8: 1.2 px (広域極小)
 * - Lv 9〜10: 1.6 px
 * - Lv 11 (全域初期): 2.2 px (未配布) / 3.0 px (配布済) ← 密集解消の黄金バランス
 * - Lv 12: 3.2 px
 * - Lv 13 (自治体): 4.8 px (未配布) / 6.4 px (配布済)
 * - Lv 14: 7.0 px
 * - Lv 15 (街区): 10.5 px
 * - Lv 16: 15.0 px
 * - Lv 17+: 22.0 px (丁目詳細)
 */
function getZoomScaledRadius(baseRadius, currentZoom) {
  const scale = 0.50 * Math.pow(2, (currentZoom - 11) * 0.52);
  const radius = baseRadius * scale;
  return Math.max(1.2, Math.min(24.0, Math.round(radius * 10) / 10));
}

/**
 * レイヤー内の全ピン半径を現在のマップズームに合わせて一括更新
 */
function updatePinsRadiusOnZoom(mapInstance, layerGroup) {
  if (!mapInstance || !layerGroup) return;
  const currentZoom = typeof mapInstance.getZoom === 'function' ? mapInstance.getZoom() : 11;
  layerGroup.eachLayer(layer => {
    if (layer instanceof L.CircleMarker && layer.options && layer.options._baseRadius) {
      const newRadius = getZoomScaledRadius(layer.options._baseRadius, currentZoom);
      layer.setRadius(newRadius);
    }
  });
}

function getAreaStatusConfig(isCompleted, isInProgress) {
  if (isCompleted) return AREA_STATUS_CONFIG.COMPLETED;
  if (isInProgress) return AREA_STATUS_CONFIG.IN_PROGRESS;
  return AREA_STATUS_CONFIG.UNALLOCATED;
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDashboard);
} else {
  initDashboard();
}

async function initDashboard() {
  initMap();
  updateNavHighlight('areas');
  
  // 1. SSOT 住所マスターの読み込み
  await loadAddressMaster();

  // 2. エリア町丁目境界GeoJSONの読み込み（独立レイヤー）
  await loadBoundariesGeoJson();

  // 3. 現場実データの同期（現場アプリと完全同一のPOST経路）
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
  });
}

/**
 * 環境非依存の静的データファイル安全取得関数（フォールバック対応）
 */
async function fetchStaticDataFile(filename) {
  const candidates = [
    `../../data/${filename}`,
    `/data/${filename}`,
    `./data/${filename}`,
    `data/${filename}`
  ];
  for (const path of candidates) {
    try {
      const res = await fetch(path);
      if (res.ok) return res;
    } catch (e) {}
  }
  throw new Error(`Failed to load static file: ${filename}`);
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
 * SSOT: 住所マスター CSV の取得とパース（config.js で指定されたファイル名を使用）
 */
async function loadAddressMaster() {
  try {
    const cfg = getStaticMasterConfig();
    const csvFilename = cfg.addressCsvFilename;
    if (!csvFilename) throw new Error('[Config Error] staticMaster.addressCsvFilename が未設定です');
    const res = await fetchStaticDataFile(csvFilename);
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

    DashboardState.masterLoadStatus = 'LOADED';
    DashboardState.masterPins = pins;
    console.log(`[SSOT Master Pins Loaded] Total: ${pins.length} items`);

    // マップにピンを描画
    renderPinsOnMap(DashboardState.map, DashboardState.markersLayer, pins);

    // マスターピンの有効座標から自動的に表示範囲を算出
    if (DashboardState.map && pins.length > 0) {
      const validCoords = pins
        .filter(p => isFinite(p.lat) && isFinite(p.lng) && p.lat !== 0 && p.lng !== 0)
        .map(p => [p.lat, p.lng]);
      if (validCoords.length > 0) {
        const bounds = L.latLngBounds(validCoords);
        DashboardState.map.fitBounds(bounds, { padding: [20, 20], maxZoom: 13 });
      }
      // validCoords が 0件なら initMap() の config 座標がそのまま残る
    }

  } catch (err) {
    console.error('[SSOT Load Error]', err);
    DashboardState.masterLoadStatus = 'ERROR';
  }
}

/**
 * 国勢調査小地域境界 GeoJSON の取得と背景レイヤー初期化（config.js で指定されたファイル名を使用）
 * - 純粋な地理的背景情報として描画（業務データやrowIdとの紐付きは一切行わない）
 */
async function loadBoundariesGeoJson() {
  try {
    const cfg = getStaticMasterConfig();
    const geojsonFilename = cfg.boundariesGeojsonFilename;
    if (!geojsonFilename) { console.warn('[Config] boundariesGeojsonFilename 未設定 - 境界線スキップ'); return; }
    const res = await fetchStaticDataFile(geojsonFilename);
    const geojsonData = await res.json();
    DashboardState.boundariesGeoJson = geojsonData;

    const layer = L.geoJSON(geojsonData, {
      pane: 'boundariesPane',
      interactive: false, // 境界ポリゴン自体はクリックを奪わずピン操作を最優先
      style: () => ({
        color: '#475569',
        weight: 1.0,
        opacity: 0.55,
        fillColor: '#3B82F6',
        fillOpacity: 0.03
      })
    });

    DashboardState.boundariesLayer = layer;

    // ズーム状態に応じて Attach / Detach を判定
    updateBoundariesVisibility();

    console.log('[Boundaries Layer Loaded] Pure geographic background layer initialized.');
  } catch (err) {
    console.warn('[Boundaries Load Error - Map continues normally]', err);
  }
}

/**
 * ズームレベルに応じた境界レイヤーの脱着（Attach / Detach: 描画負荷ゼロ化）
 * - Lv <= 11: 全域広域表示時は境界線を MAP からデタッチ
 * - Lv >= 12: ズームイン時に境界線を MAP へアタッチ（boundariesPane によりピンの背面に自動配置）
 */
function updateBoundariesVisibility() {
  if (!DashboardState.map || !DashboardState.boundariesLayer) return;
  const currentZoom = typeof DashboardState.map.getZoom === 'function' ? DashboardState.map.getZoom() : 11;

  if (currentZoom >= 12) {
    if (!DashboardState.map.hasLayer(DashboardState.boundariesLayer)) {
      DashboardState.boundariesLayer.addTo(DashboardState.map);
    }
  } else {
    if (DashboardState.map.hasLayer(DashboardState.boundariesLayer)) {
      DashboardState.map.removeLayer(DashboardState.boundariesLayer);
    }
  }
}

if (typeof window !== 'undefined') {
  window.showAreaDetail = showAreaDetail;
  window.closeAreaDetail = closeAreaDetail;
  window.AREA_STATUS_CONFIG = AREA_STATUS_CONFIG;
  window.toggleCityDropdown = toggleCityDropdown;
  window.closeCityDropdown = closeCityDropdown;
  window.selectCity = selectCity;
  window.onCitySelected = onCitySelected;
}

/**
 * 左ナビ内インライン自治体セレクターの開閉トグル
 */
function toggleCityDropdown() {
  const listEl = document.getElementById('city-selector-list');
  const triggerEl = document.getElementById('city-selector-trigger');
  const arrowEl = document.getElementById('city-selector-arrow');
  if (!listEl) return;

  const isHidden = listEl.classList.contains('hidden');
  if (isHidden) {
    listEl.classList.remove('hidden');
    if (triggerEl) triggerEl.setAttribute('aria-expanded', 'true');
    if (arrowEl) arrowEl.textContent = '▲';
  } else {
    listEl.classList.add('hidden');
    if (triggerEl) triggerEl.setAttribute('aria-expanded', 'false');
    if (arrowEl) arrowEl.textContent = '▼';
  }
}

function closeCityDropdown() {
  const listEl = document.getElementById('city-selector-list');
  const triggerEl = document.getElementById('city-selector-trigger');
  const arrowEl = document.getElementById('city-selector-arrow');
  if (listEl) listEl.classList.add('hidden');
  if (triggerEl) triggerEl.setAttribute('aria-expanded', 'false');
  if (arrowEl) arrowEl.textContent = '▼';
}

/**
 * 自治体選択ハンドラ（UIラベル更新 ➔ 展開状態維持 ➔ 既存onCitySelected発火）
 */
function selectCity(cityName) {
  DashboardState.selectedCity = cityName;

  const currentLabelEl = document.getElementById('city-selector-current');
  if (currentLabelEl) {
    currentLabelEl.textContent = cityName === 'ALL' ? '全域' : cityName;
  }

  // 選択後もリストを開いたまま維持（トリガー再タップ時のみ閉じる）
  updateCitySelectorHighlight(cityName);
  onCitySelected(cityName);
}

/**
 * 自治体リストアイテムのアクティブハイライト更新
 */
function updateCitySelectorHighlight(selectedCity) {
  const listEl = document.getElementById('city-selector-list');
  if (!listEl) return;

  const buttons = listEl.querySelectorAll('button[data-city-val]');
  buttons.forEach(btn => {
    const val = btn.getAttribute('data-city-val');
    if (val === selectedCity) {
      btn.className = 'w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-between bg-brand/15 text-brand border border-brand/30';
      const checkSpan = btn.querySelector('.city-check');
      if (checkSpan) checkSpan.textContent = '✓';
    } else {
      btn.className = 'w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-between text-textSub hover:text-white hover:bg-white/5 border border-transparent';
      const checkSpan = btn.querySelector('.city-check');
      if (checkSpan) checkSpan.textContent = '';
    }
  });
}

/**
 * SSOT自治体セレクターの動的生成（左ナビ内インラインリスト）
 */
function populateCitySelector(cities) {
  const listEl = document.getElementById('city-selector-list');
  const currentLabelEl = document.getElementById('city-selector-current');
  if (!listEl) return;

  const currentVal = DashboardState.selectedCity || 'ALL';
  listEl.innerHTML = '';

  // 1. 全域プリセット (ALL)
  const allBtn = document.createElement('button');
  allBtn.type = 'button';
  allBtn.setAttribute('data-city-val', 'ALL');
  allBtn.onclick = () => selectCity('ALL');
  allBtn.innerHTML = `<span>全域</span><span class="city-check text-[11px] font-bold">${currentVal === 'ALL' ? '✓' : ''}</span>`;
  allBtn.className = currentVal === 'ALL'
    ? 'w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-between bg-brand/15 text-brand border border-brand/30'
    : 'w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-between text-textSub hover:text-white hover:bg-white/5 border border-transparent';
  listEl.appendChild(allBtn);

  // 2. SSOTから動的抽出された自治体リスト
  cities.forEach(cityName => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('data-city-val', cityName);
    btn.onclick = () => selectCity(cityName);
    btn.innerHTML = `<span>${cityName}</span><span class="city-check text-[11px] font-bold">${currentVal === cityName ? '✓' : ''}</span>`;
    btn.className = currentVal === cityName
      ? 'w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-between bg-brand/15 text-brand border border-brand/30'
      : 'w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-between text-textSub hover:text-white hover:bg-white/5 border border-transparent';
    listEl.appendChild(btn);
  });

  if (currentLabelEl) {
    currentLabelEl.textContent = currentVal === 'ALL' ? '全域' : currentVal;
  }
}

/**
 * Leaflet Map 初期化
 */
function initMap() {
  const mapEl = document.getElementById('map');
  if (!mapEl || DashboardState.map) return;

  try {
    const cfg = getStaticMasterConfig();
    const defaultCenter = cfg.mapDefaultCenter || [35.0, 137.0];
    const defaultZoom = cfg.mapDefaultZoom || 10;
    const map = L.map('map', {
      zoomControl: true,
      attributionControl: false
    }).setView(defaultCenter, defaultZoom);

    // 境界線専用カスタムペインの作成 (タイルの上・ピンの下)
    if (!map.getPane('boundariesPane')) {
      const bPane = map.createPane('boundariesPane');
      bPane.style.zIndex = 450;
    }

    // OpenStreetMap Japan 日本語優先高コントラストタイル
    L.tileLayer('https://tile.openstreetmap.jp/{z}/{x}/{y}.png', {
      maxZoom: 18
    }).addTo(map);

    DashboardState.markersLayer = L.layerGroup().addTo(map);
    DashboardState.map = map;

    // ズーム変更時のピンサイズ動的スケーリング ＆ 境界レイヤー脱着制御
    map.on('zoom zoomend', () => {
      updatePinsRadiusOnZoom(DashboardState.map, DashboardState.markersLayer);
      updateBoundariesVisibility();
    });

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
    const [summaryRes, tier1Res, stockRes, rankRes, pinStatusRes, rosterRes, reqRes, latestDistRes] = await Promise.all([
      callApiPost('getSystemSummary').catch(e => ({ success: false, error: e.message })),
      callApiPost('getTier1').catch(e => ({ success: false, error: e.message })),
      callApiPost('getFlyerStock').catch(e => ({ success: false, error: e.message })),
      callApiPost('getRanking').catch(e => ({ success: false, error: e.message })),
      callApiPost('getGlobalPinStatus').catch(e => ({ success: false, error: e.message })),
      callApiPost('getRoster').catch(e => ({ success: false, error: e.message })),
      callApiPost('getTransferRequests').catch(e => ({ success: false, error: e.message })),
      callApiPost('getLatestDistribution', { limit: 20 }).catch(e => ({ success: false, error: e.message }))
    ]);

    const isSummaryOk = summaryRes && summaryRes.success;
    const isTier1Ok = tier1Res && tier1Res.success;
    const isStockOk = stockRes && stockRes.success;
    const isRankOk = rankRes && rankRes.success;
    const isPinStatusOk = pinStatusRes && pinStatusRes.success;
    const isRosterOk = rosterRes && rosterRes.success;
    const isReqOk = reqRes && reqRes.success;
    const isLatestDistOk = latestDistRes && latestDistRes.success;

    // 1. 配布エリア事実データ
    if (isSummaryOk) {
      DashboardState.summary = summaryRes;
    }

    // 2. 自治体サマリーデータ
    // 自治体一覧: Backend getTier1 が唯一の正（SSOT）
    if (isTier1Ok && Array.isArray(tier1Res.cities)) {
      DashboardState.cities = tier1Res.cities
        .map(c => typeof c === 'string' ? c : (c.name || ''))
        .filter(name => name && !name.includes('原本') && !name.includes('テンプレート'));
      populateCitySelector(DashboardState.cities);
    }

    // 3. 保有チラシデータ
    if (isStockOk) {
      DashboardState.stocks = stockRes.stocks || [];
    }

    // 4. 名簿データ
    if (isRosterOk) {
      DashboardState.roster = rosterRes.roster || [];
    }

    // 5. 受渡要請データ
    if (isReqOk) {
      DashboardState.requests = reqRes.requests || [];
    } else {
      DashboardState.requests = [];
    }

    // 6. 現場ピンステータス（現場アプリと完全同一データ）
    if (isPinStatusOk) {
      DashboardState.globalPinStatus.inProgress = (pinStatusRes.inProgress || []).map(id => parseInt(id, 10)).filter(id => !isNaN(id));
      DashboardState.globalPinStatus.completed = (pinStatusRes.completed || []).map(id => parseInt(id, 10)).filter(id => !isNaN(id));
    }

    // 7. 配布実績ランキング（現場アプリと完全同一データ）
    if (isRankOk) {
      DashboardState.ranking = rankRes.ranking || [];
    } else {
      DashboardState.ranking = [];
    }

    // 8. 最新配布実績レコード (Backend SSOT)
    if (isLatestDistOk && Array.isArray(latestDistRes.records)) {
      DashboardState.liveRecords = latestDistRes.records;
    }

    // 9. 現在選択中の自治体に合わせて画面全体を再描画
    renderCurrentView();

    // 10. 通常マップのピンを再描画
    if (DashboardState.map && DashboardState.markersLayer) {
      renderPinsOnMap(DashboardState.map, DashboardState.markersLayer, DashboardState.masterPins);
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

    // 確定状態SSOT設定の取得
    const statusCfg = getAreaStatusConfig(isCompleted, isInProgress);
    const currentZoom = typeof mapInstance.getZoom === 'function' ? mapInstance.getZoom() : 11;
    const scaledRadius = getZoomScaledRadius(statusCfg.radius, currentZoom);

    const marker = L.circleMarker([pin.lat, pin.lng], {
      radius: scaledRadius,
      _baseRadius: statusCfg.radius,
      fillColor: statusCfg.color,
      color: statusCfg.strokeColor,
      weight: statusCfg.weight,
      opacity: statusCfg.opacity,
      fillOpacity: statusCfg.fillOpacity
    });

    // タッチ/クリック時の詳細オーバーレイ表示 (SSOT準拠: エリア名・状態SSOT)
    marker.on('click', () => {
      showAreaDetail({
        name: pin.fullName,
        statusCfg: statusCfg
      });
    });

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
    renderPinsOnMap(DashboardState.map, DashboardState.markersLayer, DashboardState.masterPins);
  }

  // マップの連動ズーム移動（SSOT住所マスターデータから動的にフォーカス）
  if (DashboardState.map) {
    if (cityName === 'ALL') {
      if (DashboardState.masterPins.length > 0) {
        const validCoords = DashboardState.masterPins
          .filter(p => isFinite(p.lat) && isFinite(p.lng) && p.lat !== 0 && p.lng !== 0)
          .map(p => [p.lat, p.lng]);
        if (validCoords.length > 0) {
          const bounds = L.latLngBounds(validCoords);
          DashboardState.map.fitBounds(bounds, { padding: [20, 20], maxZoom: 11 });
        }
      } else {
        const cfg = getStaticMasterConfig();
        const defaultCenter = cfg.mapDefaultCenter || [35.0, 137.0];
        const defaultZoom = cfg.mapDefaultZoom || 10;
        DashboardState.map.setView(defaultCenter, defaultZoom);
      }
    } else {
      const cityPins = DashboardState.masterPins.filter(p => p.cityName === cityName);
      if (cityPins.length > 0) {
        const bounds = L.latLngBounds(cityPins.map(p => [p.lat, p.lng]));
        DashboardState.map.fitBounds(bounds, { padding: [30, 30], maxZoom: 13 });
      }
    }
  }
}

/**
 * 現在の自治体フィルターに応じた画面再描画
 */
function renderCurrentView() {
  const selected = DashboardState.selectedCity;
  const isAll = selected === 'ALL';
  const completedList = DashboardState.globalPinStatus.completed || [];
  const inProgressList = DashboardState.globalPinStatus.inProgress || [];

  const doneAreasEl = document.getElementById('fact-done-areas');
  const totalAreasEl = document.getElementById('fact-total-areas');
  const progressBadgeEl = document.getElementById('fact-progress-badge');
  const unallocatedEl = document.getElementById('fact-unallocated-areas');
  const inProgressEl = document.getElementById('fact-inprogress-areas');
  const completedEl = document.getElementById('fact-completed-areas');
  const districtLabelEl = document.getElementById('map-district-label');

  // --- マスター件数（Static Master 由来）---
  // 3状態: PENDING(--) / LOADED(実件数) / ERROR(ERR)
  const masterOk = DashboardState.masterLoadStatus === 'LOADED';

  if (DashboardState.masterLoadStatus === 'PENDING') {
    // 未取得 — 初期値 '--' のまま。マスター依存の描画だけスキップ。
  } else if (DashboardState.masterLoadStatus === 'ERROR') {
    if (doneAreasEl) doneAreasEl.textContent = 'ERR';
    if (totalAreasEl) totalAreasEl.textContent = 'ERR';
    if (progressBadgeEl) progressBadgeEl.textContent = '--';
    // ★ return しない — Backend由来の描画は続行 ★
  } else {
    // 1. トップの事実数字（マスターピン件数 ＆ 実配布完了データ連動）
    let totalAreas = DashboardState.masterPins.length;
    let doneAreas = DashboardState.masterPins.filter(p => completedList.includes(p.rowId)).length;
    let progAreas = DashboardState.masterPins.filter(p => inProgressList.includes(p.rowId)).length;

    if (!isAll && DashboardState.masterPins.length > 0) {
      const cityPins = DashboardState.masterPins.filter(p => p.cityName.includes(selected) || selected.includes(p.cityName));
      totalAreas = cityPins.length;
      doneAreas = cityPins.filter(p => completedList.includes(p.rowId)).length;
      progAreas = cityPins.filter(p => inProgressList.includes(p.rowId)).length;
    }

    const unallocatedAreas = Math.max(0, totalAreas - doneAreas - progAreas);
    const progressPercent = totalAreas > 0 ? Math.round((doneAreas / totalAreas) * 100) : 0;

    if (doneAreasEl) doneAreasEl.textContent = doneAreas.toLocaleString();
    if (totalAreasEl) totalAreasEl.textContent = totalAreas.toLocaleString();
    if (progressBadgeEl) progressBadgeEl.textContent = `${progressPercent}%`;
    if (unallocatedEl) unallocatedEl.textContent = unallocatedAreas.toLocaleString();
    if (inProgressEl) inProgressEl.textContent = progAreas.toLocaleString();
    if (completedEl) completedEl.textContent = doneAreas.toLocaleString();

    if (districtLabelEl) {
      const districtCode = DashboardState.summary?.districtName;
      const labelPrefix = districtCode ? districtCode : '全域';
      districtLabelEl.textContent = isAll ? `${labelPrefix} (${totalAreas}エリア)` : `${selected} (${totalAreas}エリア)`;
    }
  }

  // --- ここから Backend SSOT 由来の描画（Master状態に関係なく実行）---

  // 2. 配布実績枚数の描画 (Backend SSOT: ranking / 自治体選択時は liveRecords 連動)
  const totalRecordsEl = document.getElementById('fact-total-records');
  if (totalRecordsEl) {
    let totalDelivered = 0;
    if (isAll) {
      // 全域SSOT: ranking の合計
      totalDelivered = (DashboardState.ranking || []).reduce((acc, item) => acc + (Number(item.count) || 0), 0);
    } else {
      // 自治体選択時: 該当自治体の配布実績
      const matchedLive = (DashboardState.liveRecords || []).filter(r => (r.cityName && r.cityName.includes(selected)) || (selected && selected.includes(r.cityName)));
      totalDelivered = matchedLive.reduce((acc, r) => acc + (Number(r.count) || 0), 0);
    }
    totalRecordsEl.textContent = totalDelivered.toLocaleString();
  }

  // 3. 保有チラシの描画 (Backend SSOT: stocks)
  renderStockFacts(DashboardState.stocks, selected);

  // 4. 名簿人数の描画 (Backend SSOT: roster)
  const totalRosterEl = document.getElementById('fact-total-roster');
  if (totalRosterEl) {
    const rosterCount = (DashboardState.roster || []).length;
    totalRosterEl.textContent = rosterCount.toLocaleString();
  }

  // 5. 最下部 LIVE 配布実績フィードの描画 (Backend SSOT)
  renderLiveFeed(DashboardState.liveRecords);

  // 4. 現在アクティブな中央メインステージのビューを再描画
  if (DashboardState.currentFocus === 'records') renderMainStageRecords(DashboardState.ranking);
  if (DashboardState.currentFocus === 'stocks') renderMainStageStocks(DashboardState.stocks);
  if (DashboardState.currentFocus === 'roster') renderMainStageRoster(DashboardState.roster);
  if (DashboardState.currentFocus === 'requests') renderMainStageRequests(DashboardState.requests);
}

/**
 * 自治体マスター順序（DashboardState.cities）に基づくソートインデックス取得
 * 1. 完全一致 ➔ 2. 前方一致/包含 ➔ 3. 未知拠点 (最後尾)
 */
function getCityMasterIndex(location, masterCities) {
  if (!location || !masterCities || masterCities.length === 0) return 99999;
  
  const cityNames = masterCities.map(c => typeof c === 'string' ? c : (c.name || '')).filter(Boolean);

  // 1. 完全一致
  const exactIdx = cityNames.indexOf(location);
  if (exactIdx !== -1) return exactIdx;

  // 2. 前方一致 / 包含一致
  for (let i = 0; i < cityNames.length; i++) {
    const city = cityNames[i];
    if (location.startsWith(city) || location.includes(city)) {
      return i;
    }
  }

  // 3. 未知拠点・Master外
  return 99999;
}

/**
 * 保有チラシの描画（ヘッダー事実数字の更新）
 */
function renderStockFacts(stocks, selectedCity) {
  let totalStock = 0;

  stocks.forEach(s => {
    const loc = s.location || 'その他拠点';
    const count = Number(s.count) || 0;
    
    // 選択自治体でフィルタ
    if (selectedCity === 'ALL' || loc.includes(selectedCity) || selectedCity.includes(loc)) {
      totalStock += count;
    }
  });

  const totalStocksEl = document.getElementById('fact-total-stocks');
  if (totalStocksEl) totalStocksEl.textContent = totalStock.toLocaleString();
}

/**
 * 最下部 LIVE 配布実績フィードの描画（Backend SSOT: 常時最新4件固定・スライディングウィンドウ）
 */
function renderLiveFeed(liveRecords) {
  const containerEl = document.getElementById('live-feed-container');
  if (!containerEl) return;

  const records = Array.isArray(liveRecords) ? liveRecords : [];
  if (records.length === 0) {
    containerEl.innerHTML = `<div class="text-[11px] text-[#94A3B8]/60 py-0.5">配布実績データはありません</div>`;
    return;
  }

  // 常時最新4件（新しいものが左）
  const latest4 = records.slice(0, 4);
  const isNewArrival = latest4.length > 0 && latest4[0].recordId !== DashboardState.latestSeenRecordId;

  let html = '';
  latest4.forEach((rec, idx) => {
    const isFirstNew = (idx === 0 && isNewArrival);
    const areaText = rec.cityName && rec.townName
      ? `${rec.cityName} ${rec.townName}`
      : (rec.townName || rec.cityName || `エリア #${rec.rowId}`);
    const countStr = Number(rec.count || 0).toLocaleString();

    html += `
      <div class="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-[#0B1019] border border-borderNormal text-[11px] text-white flex-shrink-0 ${isFirstNew ? 'live-card-new' : ''}">
        <span class="w-1.5 h-1.5 rounded-full bg-statusGreen flex-shrink-0"></span>
        <span class="font-mono text-textSub text-[10px] whitespace-nowrap">${rec.time || '--:--'}</span>
        <span class="font-mono font-bold text-brand text-[11px] flex-shrink-0">${rec.staffId || '--'}</span>
        <span class="font-medium text-white truncate max-w-[155px] text-[11px]">${areaText}</span>
        <span class="font-mono font-bold text-white text-[11px] flex-shrink-0">${countStr}<span class="text-[9px] font-normal text-textSub ml-0.5">枚</span></span>
      </div>
    `;

    // カード間の矢印デリミタ（最後の要素以外）
    if (idx < latest4.length - 1) {
      html += `<span class="text-[#243044] text-[11px] flex-shrink-0">➔</span>`;
    }
  });

  containerEl.innerHTML = html;

  // 最新レコードIDを記録
  if (latest4.length > 0) {
    DashboardState.latestSeenRecordId = latest4[0].recordId;
  }
}

/**
 * エリア詳細オーバーレイの表示
 */
function showAreaDetail(data) {
  const detailEl = document.getElementById('map-area-detail');
  const nameEl = document.getElementById('selected-area-name');
  const statusEl = document.getElementById('selected-area-status');
  const metaEl = document.getElementById('selected-area-meta');

  const cfg = data.statusCfg || AREA_STATUS_CONFIG.UNKNOWN;

  if (nameEl) nameEl.textContent = data.name;
  if (statusEl) {
    statusEl.textContent = cfg.statusText;
    statusEl.style.color = cfg.color;
  }
  if (metaEl) {
    if (data.meta) {
      metaEl.textContent = data.meta;
    } else {
      metaEl.textContent = '';
    }
  }

  if (detailEl) detailEl.classList.remove('hidden');
}

function closeAreaDetail() {
  const detailEl = document.getElementById('map-area-detail');
  if (detailEl) detailEl.classList.add('hidden');
}

/**
 * 中央メインステージ用: 配布実績ランキングの描画
 */
/**
 * 中央メインステージ用: 配布実績ランキングの描画 (2件表示窓 ＆ 左右矢印ページ送り)
 */
function renderMainStageRecords(ranking) {
  const contentEl = document.getElementById('main-stage-records-content');
  if (!contentEl) return;

  const rankingList = ranking || [];
  if (rankingList.length === 0) {
    contentEl.innerHTML = `<div class="text-xs text-[#94A3B8]/60 text-center py-12">配布実績データはありません</div>`;
    return;
  }

  if (!DashboardState.staffFeedPages) {
    DashboardState.staffFeedPages = {};
  }

  let html = '<div class="space-y-1.5">';
  rankingList.forEach((item, index) => {
    const rank = item.rank || (index + 1);
    let rankBadgeHtml = '';
    if (rank === 1) {
      rankBadgeHtml = `<span class="w-7 h-7 flex items-center justify-center text-lg select-none">🥇</span>`;
    } else if (rank === 2) {
      rankBadgeHtml = `<span class="w-7 h-7 flex items-center justify-center text-lg select-none">🥈</span>`;
    } else if (rank === 3) {
      rankBadgeHtml = `<span class="w-7 h-7 flex items-center justify-center text-lg select-none">🥉</span>`;
    } else {
      rankBadgeHtml = `<span class="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold font-mono bg-white/5 text-white/70">${rank}</span>`;
    }

    // 各スタッフごとの配布履歴抽出 (Backend SSOT: liveRecords)
    const staffRecords = (DashboardState.liveRecords || []).filter(r => r.staffId === item.staffId);
    const totalRecordsCount = staffRecords.length;
    const pageSize = 2;
    const totalPages = Math.ceil(totalRecordsCount / pageSize) || 1;

    const currentPage = DashboardState.staffFeedPages[item.staffId] || 0;
    const validPage = Math.max(0, Math.min(currentPage, totalPages - 1));
    DashboardState.staffFeedPages[item.staffId] = validPage;

    const start = validPage * pageSize;
    const pageRecords = staffRecords.slice(start, start + pageSize);

    let recentFeedHtml = '';
    if (pageRecords.length > 0) {
      const itemsHtml = pageRecords.map(rec => {
        const areaName = rec.townName || rec.cityName || `エリア #${rec.rowId}`;
        const countStr = Number(rec.count || 0).toLocaleString();
        return `
          <div class="flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-[#0B1019] border border-borderNormal text-xs text-white flex-shrink-0">
            <span class="w-1.5 h-1.5 rounded-full bg-statusGreen flex-shrink-0"></span>
            <span class="font-mono text-textSub text-[11px] whitespace-nowrap">${rec.time || '--:--'}</span>
            <span class="font-medium text-white truncate max-w-[130px] text-xs">${areaName}</span>
            <span class="font-mono font-bold text-white text-xs flex-shrink-0">${countStr}<span class="text-[10px] font-normal text-textSub ml-0.5">枚</span></span>
          </div>
        `;
      }).join('<span class="text-[#243044] text-xs flex-shrink-0">➔</span>');

      if (totalPages > 1) {
        const hasPrev = validPage > 0;
        const hasNext = validPage < totalPages - 1;
        const prevBtn = `
          <button type="button" onclick="changeStaffFeedPage('${item.staffId}', -1, event)" ${!hasPrev ? 'disabled' : ''} class="w-6 h-6 flex items-center justify-center rounded text-sm font-bold font-mono transition-colors ${hasPrev ? 'text-white hover:bg-white/10 cursor-pointer' : 'text-white/20 cursor-not-allowed'}">‹</button>
        `;
        const nextBtn = `
          <button type="button" onclick="changeStaffFeedPage('${item.staffId}', 1, event)" ${!hasNext ? 'disabled' : ''} class="w-6 h-6 flex items-center justify-center rounded text-sm font-bold font-mono transition-colors ${hasNext ? 'text-white hover:bg-white/10 cursor-pointer' : 'text-white/20 cursor-not-allowed'}">›</button>
        `;
        const pageIndicator = `
          <span class="font-mono text-xs text-textSub whitespace-nowrap ml-1">${validPage + 1}/${totalPages}</span>
        `;
        recentFeedHtml = `<div class="flex items-center gap-1.5 mx-2 overflow-hidden justify-center flex-1 min-w-0">${prevBtn}${itemsHtml}${nextBtn}${pageIndicator}</div>`;
      } else {
        recentFeedHtml = `<div class="flex items-center gap-1.5 mx-2 overflow-hidden justify-center flex-1 min-w-0">${itemsHtml}</div>`;
      }
    } else {
      recentFeedHtml = `<div class="flex-1"></div>`;
    }

    html += `
      <div class="flex items-center justify-between p-2.5 rounded-xl bg-[#182130] border border-[#243044] hover:border-[#33435C] transition-colors">
        <div class="flex items-center gap-2.5 flex-shrink-0">
          ${rankBadgeHtml}
          <div class="flex items-center gap-1.5">
            <span class="font-bold text-white text-lg font-mono">${item.staffId}</span>
            ${item.name ? `<span class="text-sm text-[#94A3B8] font-normal">(${item.name})</span>` : ''}
          </div>
        </div>
        ${recentFeedHtml}
        <div class="text-right flex-shrink-0">
          <span class="text-lg font-mono font-bold text-white">${(Number(item.count) || 0).toLocaleString()}</span>
          <span class="text-xs text-[#94A3B8] font-normal ml-0.5">枚 完了</span>
        </div>
      </div>
    `;
  });
  html += '</div>';
  contentEl.innerHTML = html;
}

/**
 * スタッフごとの配布履歴フィードのページ送り (2件単位)
 */
function changeStaffFeedPage(staffId, delta, event) {
  if (event) event.stopPropagation();
  if (!DashboardState.staffFeedPages) {
    DashboardState.staffFeedPages = {};
  }
  const current = DashboardState.staffFeedPages[staffId] || 0;
  DashboardState.staffFeedPages[staffId] = current + delta;
  renderMainStageRecords(DashboardState.ranking);
}
window.changeStaffFeedPage = changeStaffFeedPage;

/**
 * 中央メインステージ用: 保有チラシ一覧の描画
 */
function renderMainStageStocks(stocks) {
  const contentEl = document.getElementById('main-stage-stocks-content');
  if (!contentEl) return;

  const stocksList = stocks || [];
  if (stocksList.length === 0) {
    contentEl.innerHTML = `<div class="text-sm text-[#94A3B8]/60 text-center py-12">保有チラシの登録データはありません</div>`;
    return;
  }

  // DashboardState.cities (SSOT順) に基づいてソート
  const masterCities = DashboardState.cities || [];
  const sortedStocks = [...stocksList].sort((a, b) => {
    const idxA = getCityMasterIndex(a.location, masterCities);
    const idxB = getCityMasterIndex(b.location, masterCities);
    return idxA - idxB;
  });

  let html = '<div class="space-y-1.5">';
  sortedStocks.forEach(s => {
    html += `
      <div class="flex items-center justify-between p-2.5 rounded-xl bg-[#182130] border border-[#243044] hover:border-[#33435C] transition-colors">
        <div>
          <div class="font-semibold text-lg text-white">${s.location || '保管拠点'}</div>
          <div class="text-sm text-[#94A3B8] font-normal mt-0.5">担当: ${s.staffName || s.staffId || '未設定'} ｜ 更新: ${s.updatedAt || '--'}</div>
        </div>
        <div class="text-right">
          <span class="text-lg font-bold font-mono text-white">${(Number(s.count) || 0).toLocaleString()}</span>
          <span class="text-xs text-[#94A3B8] font-normal ml-0.5">枚</span>
        </div>
      </div>
    `;
  });
  html += '</div>';
  contentEl.innerHTML = html;
}

/**
 * 中央メインステージ用: 登録配布員名簿の描画
 */
function renderMainStageRoster(roster) {
  const contentEl = document.getElementById('main-stage-roster-content');
  if (!contentEl) return;

  const rosterList = roster || [];
  if (rosterList.length === 0) {
    contentEl.innerHTML = `<div class="text-sm text-[#94A3B8]/60 text-center py-12">登録配布員データはありません</div>`;
    return;
  }

  let html = '<div class="space-y-1.5">';
  rosterList.forEach(r => {
    html += `
      <div class="p-2.5 rounded-xl bg-[#182130] border border-[#243044] hover:border-[#33435C] flex items-center justify-between transition-colors">
        <div class="flex items-center gap-3">
          <span class="w-8 h-8 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center font-mono font-bold text-sm text-brand flex-shrink-0">${r.id || ''}</span>
          <div>
            <div class="font-semibold text-lg text-white">${r.name || ''}</div>
            <div class="text-sm text-[#94A3B8] font-normal mt-0.5">区分: 正式登録配布員</div>
          </div>
        </div>
        <span class="text-xs text-statusGreen font-medium px-2.5 py-1 rounded bg-statusGreen/10 border border-statusGreen/20 flex-shrink-0">有効</span>
      </div>
    `;
  });
  html += '</div>';
  contentEl.innerHTML = html;
}

/**
 * 中央メインステージ用: チラシ受渡要請の描画
 */
function renderMainStageRequests(requests) {
  const contentEl = document.getElementById('main-stage-requests-content');
  if (!contentEl) return;

  const reqList = requests || [];
  if (reqList.length === 0) {
    contentEl.innerHTML = `<div class="text-sm text-[#94A3B8]/60 text-center py-12">現在、受渡要請はありません</div>`;
    return;
  }

  let html = '<div class="space-y-1.5">';
  reqList.forEach(req => {
    html += `
      <div class="p-2.5 rounded-xl bg-[#182130] border border-[#243044] hover:border-[#33435C] transition-colors">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="font-semibold text-lg text-white">${req.requesterName || req.requesterId}</span>
            <span class="text-sm text-[#94A3B8]">➔</span>
            <span class="font-semibold text-lg text-white">${req.holderName || req.holderId}</span>
          </div>
          <span class="font-mono text-xs text-[#94A3B8] font-normal">${req.requestTime || ''}</span>
        </div>
        <div class="text-sm text-[#94A3B8] font-normal mt-1 flex items-center justify-between">
          <span>連絡先: ${req.contactMethod ? `[${req.contactMethod}] ` : ''}${req.contactValue || ''}</span>
          <span class="text-xs font-medium text-brand px-2.5 py-0.5 rounded bg-brand/10 border border-brand/20">要請中</span>
        </div>
      </div>
    `;
  });
  html += '</div>';
  contentEl.innerHTML = html;
}

/**
 * 左ナビゲーションからの排他的メインステージ切り替え
 * - areas: 中央メインステージにMAPを表示 (初期状態)
 * - records: 中央メインステージに配布実績ランキングを表示
 * - stocks: 中央メインステージに保有チラシ一覧を表示
 * - roster: 中央メインステージに名簿一覧を表示
 * - requests: 中央メインステージに受渡要請一覧を表示
 * ※ NAV、統括BAR、NOW/STOCKパネル、Activity Streamは常時固定
 */
function switchView(type) {
  const views = ['areas', 'records', 'stocks', 'roster', 'requests'];
  const targetView = views.includes(type) ? type : 'areas';

  views.forEach(v => {
    const el = document.getElementById(`main-view-${v}`);
    if (el) {
      if (v === targetView) {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    }
  });

  DashboardState.currentFocus = targetView;
  updateNavHighlight(targetView);

  if (targetView === 'areas') {
    if (DashboardState.map) {
      setTimeout(() => {
        DashboardState.map.invalidateSize();
        renderPinsOnMap(DashboardState.map, DashboardState.markersLayer, DashboardState.masterPins);
      }, 50);
    }
  } else if (targetView === 'records') {
    renderMainStageRecords(DashboardState.ranking);
  } else if (targetView === 'stocks') {
    renderMainStageStocks(DashboardState.stocks);
  } else if (targetView === 'roster') {
    renderMainStageRoster(DashboardState.roster);
  } else if (targetView === 'requests') {
    renderMainStageRequests(DashboardState.requests);
  }
}

function updateNavHighlight(activeType) {
  const navTypes = ['roster', 'stocks', 'requests', 'records', 'areas'];
  navTypes.forEach(t => {
    const el = document.getElementById(`nav-${t}`);
    if (el) {
      if (t === activeType) {
        el.className = 'nav-item nav-item-active w-full h-10 flex items-center gap-2.5 px-3 rounded-xl border border-brand/35 text-brand font-semibold text-left';
      } else {
        el.className = 'nav-item w-full h-10 flex items-center gap-2.5 px-3 rounded-xl text-textSub border border-transparent hover:text-white hover:bg-white/5 text-left font-medium';
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
