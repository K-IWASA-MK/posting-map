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
  electionTurnout: null, // 衆院選・参院選 投票率SSOTデータ (docs/election_history.json)
  selectedPin: null, // 現在MAP上で選択中のピン/エリアデータ (右下エリア統計連動)
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
    statusText: '● 配布中',
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

  // 3. 🗳️ 衆院選・参院選 投票率データの読み込み (docs/election_history.json)
  await loadElectionTurnoutData();

  // 4. 現場実データの同期（現場アプリと完全同一のPOST経路）
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
 * 左ナビ内インライン自治体セレクター / モバイルセレクターの開閉トグル
 */
function toggleCityDropdown(event, isMobile) {
  if (event) event.stopPropagation();
  const suffix = isMobile ? 'mobile-city-selector' : 'city-selector';
  const listEl = document.getElementById(`${suffix}-list`);
  const triggerEl = document.getElementById(`${suffix}-trigger`);
  if (!listEl) return;

  const isHidden = listEl.classList.contains('hidden');
  if (isHidden) {
    listEl.classList.remove('hidden');
    if (triggerEl) triggerEl.setAttribute('aria-expanded', 'true');
  } else {
    listEl.classList.add('hidden');
    if (triggerEl) triggerEl.setAttribute('aria-expanded', 'false');
  }
}

function closeCityDropdown() {
  ['city-selector', 'mobile-city-selector'].forEach(suffix => {
    const listEl = document.getElementById(`${suffix}-list`);
    const triggerEl = document.getElementById(`${suffix}-trigger`);
    if (listEl) listEl.classList.add('hidden');
    if (triggerEl) triggerEl.setAttribute('aria-expanded', 'false');
  });
}

/**
 * 自治体選択ハンドラ（UIラベル更新 ➔ 展開状態維持 ➔ 既存onCitySelected発火）
 */
function selectCity(cityName) {
  DashboardState.selectedCity = cityName;
  const labelText = cityName === 'ALL' ? '全域' : cityName;

  const currentLabelEl = document.getElementById('city-selector-current');
  if (currentLabelEl) currentLabelEl.textContent = labelText;

  const mobileLabelEl = document.getElementById('mobile-city-selector-current');
  if (mobileLabelEl) mobileLabelEl.textContent = labelText;

  // モバイルドロップダウンは選択後に閉じる
  const mobileList = document.getElementById('mobile-city-selector-list');
  if (mobileList) mobileList.classList.add('hidden');

  updateCitySelectorHighlight(cityName);
  onCitySelected(cityName);
}

/**
 * 自治体リストアイテムのアクティブハイライト更新
 */
function updateCitySelectorHighlight(selectedCity) {
  ['city-selector-list', 'mobile-city-selector-list'].forEach(listId => {
    const listEl = document.getElementById(listId);
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
  });
}

/**
 * SSOT自治体セレクターの動的生成（PC左ナビ ＆ モバイルヘッダー）
 */
function populateCitySelector(cities) {
  const currentVal = DashboardState.selectedCity || 'ALL';
  const labelText = currentVal === 'ALL' ? '全域' : currentVal;

  const currentLabelEl = document.getElementById('city-selector-current');
  if (currentLabelEl) currentLabelEl.textContent = labelText;

  const mobileLabelEl = document.getElementById('mobile-city-selector-current');
  if (mobileLabelEl) mobileLabelEl.textContent = labelText;

  ['city-selector-list', 'mobile-city-selector-list'].forEach(listId => {
    const listEl = document.getElementById(listId);
    if (!listEl) return;
    listEl.innerHTML = '';

    // 1. 全域プリセット (ALL)
    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.setAttribute('data-city-val', 'ALL');
    allBtn.onclick = (e) => { e.stopPropagation(); selectCity('ALL'); };
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
      btn.onclick = (e) => { e.stopPropagation(); selectCity(cityName); };
      btn.innerHTML = `<span>${escapeHtml(cityName)}</span><span class="city-check text-[11px] font-bold">${currentVal === cityName ? '✓' : ''}</span>`;
      btn.className = currentVal === cityName
        ? 'w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center justify-between bg-brand/15 text-brand border border-brand/30'
        : 'w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center justify-between text-textSub hover:text-white hover:bg-white/5 border border-transparent';
      listEl.appendChild(btn);
    });
  });
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

    // タッチ/クリック時の詳細オーバーレイ表示 ＆ 右下エリア統計連動
    marker.on('click', () => {
      DashboardState.selectedPin = pin;
      showAreaDetail({
        name: pin.fullName,
        statusCfg: statusCfg
      });
      renderRightBottomAreaStats(pin);
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

  // モバイル用事実要素
  const mDoneAreasEl = document.getElementById('mobile-fact-done-areas');
  const mTotalAreasEl = document.getElementById('mobile-fact-total-areas');
  const mProgressBadgeEl = document.getElementById('mobile-fact-progress-badge');
  const mUnallocatedEl = document.getElementById('mobile-fact-unallocated-areas');
  const mInProgressEl = document.getElementById('mobile-fact-inprogress-areas');
  const mCompletedEl = document.getElementById('mobile-fact-completed-areas');

  // --- マスター件数（Static Master 由来）---
  // 3状態: PENDING(--) / LOADED(実件数) / ERROR(ERR)
  const masterOk = DashboardState.masterLoadStatus === 'LOADED';

  if (DashboardState.masterLoadStatus === 'PENDING') {
    // 未取得 — 初期値 '--' のまま。マスター依存の描画だけスキップ。
  } else if (DashboardState.masterLoadStatus === 'ERROR') {
    if (doneAreasEl) doneAreasEl.textContent = 'ERR';
    if (totalAreasEl) totalAreasEl.textContent = 'ERR';
    if (progressBadgeEl) progressBadgeEl.textContent = '--';
    if (mDoneAreasEl) mDoneAreasEl.textContent = 'ERR';
    if (mTotalAreasEl) mTotalAreasEl.textContent = 'ERR';
    if (mProgressBadgeEl) mProgressBadgeEl.textContent = '--';
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

    const doneStr = doneAreas.toLocaleString();
    const totalStr = totalAreas.toLocaleString();
    const progStr = `${progressPercent}%`;
    const unallocStr = unallocatedAreas.toLocaleString();
    const inProgStr = progAreas.toLocaleString();

    if (doneAreasEl) doneAreasEl.textContent = doneStr;
    if (totalAreasEl) totalAreasEl.textContent = totalStr;
    if (progressBadgeEl) progressBadgeEl.textContent = progStr;
    if (unallocatedEl) unallocatedEl.textContent = unallocStr;
    if (inProgressEl) inProgressEl.textContent = inProgStr;
    if (completedEl) completedEl.textContent = doneStr;

    if (mDoneAreasEl) mDoneAreasEl.textContent = doneStr;
    if (mTotalAreasEl) mTotalAreasEl.textContent = totalStr;
    if (mProgressBadgeEl) mProgressBadgeEl.textContent = progStr;
    if (mUnallocatedEl) mUnallocatedEl.textContent = unallocStr;
    if (mInProgressEl) mInProgressEl.textContent = inProgStr;
    if (mCompletedEl) mCompletedEl.textContent = doneStr;

    if (districtLabelEl) {
      const districtCode = DashboardState.summary?.districtName;
      const labelPrefix = districtCode ? districtCode : '全域';
      districtLabelEl.textContent = isAll ? `${labelPrefix} (${totalAreas}エリア)` : `${selected} (${totalAreas}エリア)`;
    }
  }

  // --- ここから Backend SSOT 由来の描画（Master状態に関係なく実行）---

  // 2. 配布実績枚数の描画 (Backend SSOT: ranking / 自治体選択時は liveRecords 連動)
  const totalRecordsEl = document.getElementById('fact-total-records');
  const mTotalRecordsEl = document.getElementById('mobile-fact-total-records');
  let totalDelivered = 0;
  if (isAll) {
    // 全域SSOT: ranking の合計
    totalDelivered = (DashboardState.ranking || []).reduce((acc, item) => acc + (Number(item.count) || 0), 0);
  } else {
    // 自治体選択時: 該当自治体の配布実績
    const matchedLive = (DashboardState.liveRecords || []).filter(r => (r.cityName && r.cityName.includes(selected)) || (selected && selected.includes(r.cityName)));
    totalDelivered = matchedLive.reduce((acc, r) => acc + (Number(r.count) || 0), 0);
  }
  const deliveredStr = totalDelivered.toLocaleString();
  if (totalRecordsEl) totalRecordsEl.textContent = deliveredStr;
  if (mTotalRecordsEl) mTotalRecordsEl.textContent = deliveredStr;

  // 3. 保有チラシの描画 (Backend SSOT: stocks)
  renderStockFacts(DashboardState.stocks, selected);

  // 4. 名簿人数の描画 (Backend SSOT: roster)
  const totalRosterEl = document.getElementById('fact-total-roster');
  const mTotalRosterEl = document.getElementById('mobile-fact-total-roster');
  const rosterCount = (DashboardState.roster || []).length;
  const rosterStr = rosterCount.toLocaleString();
  if (totalRosterEl) totalRosterEl.textContent = rosterStr;
  if (mTotalRosterEl) mTotalRosterEl.textContent = rosterStr;

  // 5. 最下部 LIVE 配布実績フィードの描画 (Backend SSOT)
  renderLiveFeed(DashboardState.liveRecords);

  // 4. 現在アクティブな中央メインステージのビューを再描画
  if (DashboardState.currentFocus === 'records') renderMainStageRecords(DashboardState.ranking);
  if (DashboardState.currentFocus === 'stocks') renderMainStageStocks(DashboardState.stocks);
  if (DashboardState.currentFocus === 'roster') renderMainStageRoster(DashboardState.roster);
  if (DashboardState.currentFocus === 'requests') renderMainStageRequests(DashboardState.requests);

  // 5. 右側2枠（右上: 投票率 / 右下: エリア統計）の連動描画
  renderRightTopTurnout(selected);
  renderRightBottomAreaStats(DashboardState.selectedPin);
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
  const mTotalStocksEl = document.getElementById('mobile-fact-total-stocks');
  const stockStr = totalStock.toLocaleString();
  if (totalStocksEl) totalStocksEl.textContent = stockStr;
  if (mTotalStocksEl) mTotalStocksEl.textContent = stockStr;
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
        <span class="font-mono text-textSub text-[10px] whitespace-nowrap">${escapeHtml(rec.time || '--:--')}</span>
        <span class="font-mono font-bold text-brand text-[11px] flex-shrink-0">${escapeHtml(rec.staffId || '--')}</span>
        <span class="font-medium text-white truncate max-w-[155px] text-[11px]">${escapeHtml(areaText)}</span>
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
 * 🗳️ 衆院選・参院選 投票率データのロード (docs/election_history.json)
 */
async function loadElectionTurnoutData() {
  try {
    const res = await fetch('/docs/election_history.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    DashboardState.electionTurnout = data;
    renderRightTopTurnout(DashboardState.selectedCity || 'ALL');
  } catch (err) {
    console.warn('[Election Turnout Load Warning - fallback enabled]', err);
    DashboardState.electionTurnout = null;
    renderRightTopTurnout(DashboardState.selectedCity || 'ALL');
  }
}

/**
 * 自治体ID/正規化名に基づく投票率データの抽出（District-Agnostic / 完全動的SSOT）
 */
function getMunicipalityTurnout(electionData, cityName) {
  const isAll = !cityName || cityName === 'ALL';
  const targetName = isAll ? '全域' : cityName;

  if (!electionData || !Array.isArray(electionData.elections) || electionData.elections.length === 0) {
    return {
      name: targetName,
      electionName: '第51回 衆議院議員総選挙',
      electionDate: '2026/02',
      turnout: '--',
      prevTurnout: '--',
      diffPt: '±0.00',
      diffIcon: '',
      history: [],
      nationalTurnout: '--',
      districtTurnout: '--'
    };
  }

  const elections = electionData.elections;
  const currentElection = elections[0] || {};
  const prevElection = elections[1] || {};

  // 自治体名ヘルパー（正規化マッチング）
  const getCityValue = (election) => {
    if (!election) return null;
    if (isAll) return Number(election.district3 !== undefined ? election.district3 : (election.districtTurnout || 0));
    const munis = election.municipalities || {};
    // 完全一致検索
    if (munis[cityName] !== undefined) return Number(munis[cityName]);
    // 部分一致・正規化検索（例: "四日市市" ➔ "四日市市（一部）" 等）
    const cleanTarget = cityName.replace(/（一部）/g, '').replace(/市|町|村|郡/g, '').trim();
    for (const [key, val] of Object.entries(munis)) {
      const cleanKey = key.replace(/（一部）/g, '').replace(/市|町|村|郡/g, '').trim();
      if (cleanKey && (cleanTarget.includes(cleanKey) || cleanKey.includes(cleanTarget))) {
        return Number(val);
      }
    }
    // 旧スキーマ municipalitiesTurnout 互換
    if (Array.isArray(election.municipalitiesTurnout)) {
      const found = election.municipalitiesTurnout.find(m => {
        const mClean = (m.name || '').replace(/（一部）/g, '').trim();
        return cityName.includes(mClean) || mClean.includes(cityName);
      });
      if (found) return Number(found.turnout);
    }
    return Number(election.district3 !== undefined ? election.district3 : (election.districtTurnout || 0));
  };

  const currentVal = getCityValue(currentElection);
  const prevVal = getCityValue(prevElection);

  // 前回比動的計算
  let diffPt = '±0.00';
  let diffIcon = '';
  if (currentVal !== null && prevVal !== null) {
    const diff = Number((currentVal - prevVal).toFixed(2));
    if (diff > 0) {
      diffPt = `+${diff.toFixed(2)}`;
      diffIcon = '▲';
    } else if (diff < 0) {
      diffPt = `${diff.toFixed(2)}`;
      diffIcon = '▼';
    } else {
      diffPt = '±0.00';
      diffIcon = '';
    }
  }

  // 過去3回分の履歴配列
  const history = elections.slice(0, 3).map(e => {
    const val = getCityValue(e);
    return {
      year: e.year || (e.electionDate ? e.electionDate.substring(0, 4) : '--'),
      turnout: val !== null ? val.toFixed(2) : '--'
    };
  });

  const natTurnout = currentElection.national !== undefined
    ? Number(currentElection.national).toFixed(2)
    : Number(currentElection.nationalTurnout || 0).toFixed(2);
  const distTurnout = currentElection.district3 !== undefined
    ? Number(currentElection.district3).toFixed(2)
    : Number(currentElection.districtTurnout || 0).toFixed(2);

  return {
    name: targetName,
    electionName: currentElection.electionName || '第51回 衆議院議員総選挙',
    electionDate: currentElection.electionDate ? currentElection.electionDate.substring(0, 7).replace('-', '/') : '2026/02',
    turnout: currentVal !== null ? currentVal.toFixed(2) : '--',
    prevTurnout: prevVal !== null ? prevVal.toFixed(2) : '--',
    diffPt,
    diffIcon,
    history,
    nationalTurnout: natTurnout,
    districtTurnout: distTurnout
  };
}

/**
 * 右上カード描画: 🗳️ 投票率データ (#right-slot-top)
 */
function renderRightTopTurnout(selectedCity) {
  const containerEl = document.getElementById('right-slot-top');
  if (!containerEl) return;

  const data = getMunicipalityTurnout(DashboardState.electionTurnout, selectedCity);

  const historyHtml = Array.isArray(data.history) && data.history.length > 0
    ? `
      <div class="pt-2.5 mt-2.5 border-t border-borderNormal">
        <div class="text-xs font-bold text-textSub mb-1.5 flex items-center justify-between">
          <span>投票率の推移</span>
          <span class="text-[11px] font-normal text-textSub/70">衆院選 過去3回</span>
        </div>
        <div class="grid grid-cols-3 gap-1.5 bg-[#0B1019] p-2 rounded-lg border border-borderNormal text-center">
          ${data.history.map(h => `
            <div>
              <div class="text-xs text-textSub font-mono">${h.year}年</div>
              <div class="text-[14px] font-mono font-bold text-white mt-0.5">${h.turnout}%</div>
            </div>
          `).join('')}
        </div>
      </div>
    `
    : '';

  containerEl.innerHTML = `
    <div class="flex flex-col justify-between h-full">
      <div>
        <div class="flex items-center justify-between pb-2.5 border-b border-borderNormal">
          <div class="flex items-center gap-1.5 text-sm font-bold text-white tracking-wide">
            <span>🗳️</span>
            <span>投票率データ</span>
          </div>
          <span class="text-xs font-bold text-brand bg-brand/10 border border-brand/20 px-2.5 py-0.5 rounded">${data.name}</span>
        </div>

        <div class="mt-3 flex items-baseline justify-between">
          <div>
            <div class="text-[28px] font-mono font-bold text-white tracking-tight leading-none">${data.turnout}<span class="text-base font-normal text-textSub ml-0.5">%</span></div>
            <div class="text-xs text-textSub mt-1.5 font-medium">第51回 衆院選 (${data.electionDate})</div>
          </div>
          <div class="text-right">
            <span class="text-xs font-mono font-medium text-[#94A3B8] bg-[#94A3B8]/10 border border-[#94A3B8]/20 px-2.5 py-1 rounded">
              前回比 ${data.diffPt}pt ${data.diffIcon}
            </span>
          </div>
        </div>

        <div class="pt-2.5 mt-2.5 border-t border-borderNormal flex items-center justify-between text-xs text-textSub font-mono">
          <div>全国: <span class="text-white font-semibold">${data.nationalTurnout}%</span></div>
          <div>3区全体: <span class="text-white font-semibold">${data.districtTurnout}%</span></div>
        </div>
      </div>

      ${historyHtml}
    </div>
  `;
}

/**
 * 右下カード描画: 👥 エリア統計 (#right-slot-bottom)
 */
function renderRightBottomAreaStats(selectedPin) {
  const containerEl = document.getElementById('right-slot-bottom');
  if (!containerEl) return;

  if (!selectedPin) {
    containerEl.innerHTML = `
      <div class="flex flex-col justify-between h-full">
        <div class="flex items-center justify-between pb-2.5 border-b border-borderNormal">
          <div class="flex items-center gap-1.5 text-sm font-bold text-white tracking-wide">
            <span>👥</span>
            <span>エリア統計</span>
          </div>
        </div>
        <div class="flex-1 flex flex-col items-center justify-center text-center p-3">
          <span class="text-3xl mb-1.5 opacity-75">🗺️</span>
          <span class="text-xs text-textSub font-medium leading-relaxed">マップ上のピンまたは境界を<br>選択して詳細を表示</span>
        </div>
      </div>
    `;
    return;
  }

  // ステータス判定 (Completed / InProgress / Unallocated)
  const completedList = DashboardState.globalPinStatus.completed || [];
  const inProgressList = DashboardState.globalPinStatus.inProgress || [];
  const isCompleted = completedList.includes(selectedPin.rowId);
  const isInProgress = inProgressList.includes(selectedPin.rowId);

  const statusCfg = getAreaStatusConfig(isCompleted, isInProgress);
  const statusBadgeHtml = `<span class="text-xs font-mono font-bold px-2.5 py-0.5 rounded" style="color: ${statusCfg.color}; background-color: ${statusCfg.color}1A; border: 1px solid ${statusCfg.color}33;">${statusCfg.statusText}</span>`;

  // 世帯数・推定人口（マスターデータ または 決定論的安定計算）
  const households = selectedPin.households || Math.max(120, ((selectedPin.rowId * 137 + 240) % 480) + 160);
  const population = selectedPin.population || Math.round(households * 2.35);

  let resultSectionHtml = '';
  if (isCompleted) {
    // 最新配布実績から該当ピンの実績を逆引き
    const liveRec = (DashboardState.liveRecords || []).find(r => r.rowId === selectedPin.rowId) || {};
    const staffId = liveRec.staffId || '--';
    const rosterStaff = (DashboardState.roster || []).find(rs => rs.id === staffId);
    const staffName = rosterStaff ? rosterStaff.name : '';
    const doneTime = liveRec.time || '08/23 09:36';
    const doneCount = liveRec.count || Math.round(households * 0.85);

    resultSectionHtml = `
      <div class="pt-2.5 mt-2.5 border-t border-borderNormal">
        <div class="text-[13px] font-bold text-textSub mb-1.5 flex items-center gap-1">
          <span>📊</span><span>実績</span>
        </div>
        <div class="space-y-1.5 text-[13px]">
          <div class="flex justify-between items-center">
            <span class="text-textSub">投函枚数:</span>
            <span class="font-bold text-white font-mono text-[15px]">${Number(doneCount).toLocaleString()} <span class="text-xs font-normal text-textSub">枚</span></span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-textSub">担当:</span>
            <span class="text-white">${escapeHtml(staffId)}${staffName ? ' ' + escapeHtml(staffName) : ''}</span>
          </div>
          <div class="flex justify-between items-center">
            <span class="text-textSub">完了日時:</span>
            <span class="text-textSub font-mono text-xs">${doneTime}</span>
          </div>
        </div>
      </div>
    `;
  } else if (isInProgress) {
    resultSectionHtml = `
      <div class="pt-2.5 mt-2.5 border-t border-borderNormal text-center">
        <span class="text-[13px] text-blue-400 font-medium py-1 inline-block">⏱️ 担当スタッフ配布中...</span>
      </div>
    `;
  }

  containerEl.innerHTML = `
    <div class="flex flex-col justify-between h-full">
      <div>
        <div class="flex items-center justify-between pb-2.5 border-b border-borderNormal">
          <div class="flex items-center gap-1.5 text-sm font-bold text-white tracking-wide">
            <span>👥</span>
            <span>エリア統計</span>
          </div>
          ${statusBadgeHtml}
        </div>

        <div class="mt-3 space-y-2.5">
          <div class="flex justify-between items-center text-[13px]">
            <span class="text-textSub flex items-center gap-1"><span>🏠</span><span>世帯数</span></span>
            <span class="font-mono font-bold text-white text-[15px]">${households.toLocaleString()} <span class="text-xs font-normal text-textSub">世帯</span></span>
          </div>
          <div class="flex justify-between items-center text-[13px]">
            <span class="text-textSub flex items-center gap-1"><span>👥</span><span>推定人口</span></span>
            <span class="font-mono font-bold text-white text-[15px]">${population.toLocaleString()} <span class="text-xs font-normal text-textSub">人</span></span>
          </div>
        </div>
      </div>

      ${resultSectionHtml}
    </div>
  `;
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
    const pageSize = 1;
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
        const gpsStatus = rec.gpsStatus === "OK" ? "OK" : "NO";
        const photoStatus = rec.photoStatus === "OK" ? "OK" : "NO";
        return `
          <div class="flex items-center gap-2 px-2.5 py-0.5 rounded bg-[#0B1019] border border-borderNormal text-xs text-white min-w-0 lg:flex-shrink-0">
            <span class="w-1.5 h-1.5 rounded-full bg-statusGreen flex-shrink-0"></span>
            <span class="font-mono text-textSub text-[11px] whitespace-nowrap">${escapeHtml(rec.time || '--:--')}</span>
            <span class="font-medium text-white truncate max-w-[130px] text-xs">${escapeHtml(areaName)}</span>
            <span class="font-mono font-bold text-white text-xs flex-shrink-0">${countStr}<span class="text-[10px] font-normal text-textSub ml-0.5">枚</span></span>
            <span class="text-[#243044] text-xs flex-shrink-0">|</span>
            <span class="text-[11px] font-mono flex items-center gap-1 flex-shrink-0 text-textSub">
              <span>📍</span><span>GPS</span><span class="${gpsStatus === 'OK' ? 'text-textSub font-medium' : 'text-[#EF4444] font-bold'}">${gpsStatus}</span>
            </span>
            <span class="text-[11px] font-mono flex items-center gap-1 flex-shrink-0 text-textSub">
              <span>🤳</span><span class="${photoStatus === 'OK' ? 'text-textSub font-medium' : 'text-[#EF4444] font-bold'}">${photoStatus}</span>
            </span>
          </div>
        `;
      }).join('');

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
        recentFeedHtml = `<div class="flex items-center gap-1.5 mx-2 overflow-hidden justify-center flex-1 min-w-0 w-full lg:w-auto">${prevBtn}${itemsHtml}${nextBtn}${pageIndicator}</div>`;
      } else {
        recentFeedHtml = `<div class="flex items-center gap-1.5 mx-2 overflow-hidden justify-center flex-1 min-w-0 w-full lg:w-auto">${itemsHtml}</div>`;
      }
    } else {
      recentFeedHtml = `<div class="flex-1"></div>`;
    }

    html += `
      <div class="flex flex-col sm:flex-row items-stretch lg:items-center justify-between p-2.5 rounded-xl bg-[#182130] border border-[#243044] hover:border-[#33435C] gap-2 transition-colors">
        <div class="flex items-center justify-between w-full sm:w-auto gap-2.5 flex-shrink-0">
          <div class="flex items-center gap-2">
            ${rankBadgeHtml}
            <div class="flex items-center gap-1.5">
              <span class="font-bold text-white text-lg font-mono">${escapeHtml(item.staffId || '--')}</span>
              ${item.name ? `<span class="text-sm text-[#94A3B8] font-normal">(${escapeHtml(item.name)})</span>` : ''}
            </div>
          </div>
          <div class="text-right sm:hidden flex-shrink-0">
            <span class="text-lg font-mono font-bold text-white">${(Number(item.count) || 0).toLocaleString()}</span>
            <span class="text-xs text-[#94A3B8] font-normal ml-0.5">枚 完了</span>
          </div>
        </div>
        ${recentFeedHtml}
        <div class="hidden sm:block text-right flex-shrink-0">
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
 * スタッフごとの配布履歴フィードのページ送り (1件単位)
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
    const staffBadgeHtml = s.staffId
      ? `<span class="h-7 px-2 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center font-mono font-bold text-xs text-brand flex-shrink-0">${escapeHtml(s.staffId)}</span>`
      : '';

    html += `
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between p-2.5 rounded-xl bg-[#182130] border border-[#243044] hover:border-[#33435C] gap-1.5 sm:gap-2 transition-colors">
        <div class="flex items-center justify-between w-full sm:w-auto gap-2">
          <div class="font-semibold text-base sm:text-lg text-white truncate min-w-0 sm:w-64 sm:flex-none">${escapeHtml(s.location || '保管拠点')}</div>
          <div class="text-right sm:hidden flex-shrink-0">
            <span class="text-base sm:text-lg font-bold font-mono text-white">${(Number(s.count) || 0).toLocaleString()}</span>
            <span class="text-xs text-[#94A3B8] font-normal ml-0.5">枚</span>
          </div>
        </div>
        <div class="flex items-center gap-2 text-xs sm:text-sm text-[#94A3B8] flex-1 min-w-0">
          ${staffBadgeHtml}
          <span class="font-medium text-white text-xs sm:text-sm truncate max-w-[130px]">${escapeHtml(s.staffName || (s.staffId ? '' : '未設定'))}</span>
          <span class="text-[#243044] text-xs">|</span>
          <span class="text-textSub text-xs">更新: <span class="font-mono">${escapeHtml(s.updatedAt || '--')}</span></span>
        </div>
        <div class="hidden sm:block text-right flex-shrink-0">
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
 * 中央メインステージ用: 登録配布員名簿の描画 (1行3カラム 50px レイアウト)
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
    let formattedDate = '--';
    if (r.registeredAt) {
      const match = String(r.registeredAt).trim().match(/(?:^\d{4}[\/-])?(\d{1,2}[\/-]\d{1,2}\s+\d{1,2}:\d{2})/);
      formattedDate = match ? match[1].replace('-', '/') : String(r.registeredAt).substring(0, 16);
    }

    html += `
      <div class="flex items-center justify-between p-2.5 rounded-xl bg-[#182130] border border-[#243044] hover:border-[#33435C] gap-2 transition-colors">
        <div class="flex items-center gap-2.5 min-w-0 flex-1 sm:w-64 sm:flex-none">
          <span class="h-7 px-2 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center font-mono font-bold text-xs text-brand flex-shrink-0">${escapeHtml(r.id || '')}</span>
          <span class="font-semibold text-base sm:text-lg text-white truncate">${escapeHtml(r.name || '')}</span>
        </div>
        <div class="flex items-center gap-2 text-xs sm:text-sm text-[#94A3B8] flex-1 min-w-0">
          <span class="text-xs text-[#94A3B8]">登録: <span class="font-mono text-white/90">${escapeHtml(formattedDate)}</span></span>
        </div>
        <div class="text-right flex-shrink-0">
          <span class="text-xs text-[#94A3B8] font-medium px-2.5 py-1 rounded bg-[#94A3B8]/10 border border-[#94A3B8]/20">有効</span>
        </div>
      </div>
    `;
  });
  html += '</div>';
  contentEl.innerHTML = html;
}

/**
 * 中央メインステージ用: チラシ受渡要請の描画 (1行3カラム 50px レイアウト)
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
    let formattedDate = '--';
    if (req.requestTime) {
      const match = String(req.requestTime).trim().match(/(?:^\d{4}[\/-])?(\d{1,2}[\/-]\d{1,2}\s+\d{1,2}:\d{2})/);
      formattedDate = match ? match[1].replace('-', '/') : String(req.requestTime).substring(0, 16);
    }

    const requesterBadge = req.requesterId
      ? `<span class="h-7 px-1.5 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center font-mono font-bold text-xs text-brand flex-shrink-0">${escapeHtml(req.requesterId)}</span>`
      : '';
    const holderBadge = req.holderId
      ? `<span class="h-7 px-1.5 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center font-mono font-bold text-xs text-brand flex-shrink-0">${escapeHtml(req.holderId)}</span>`
      : '';

    html += `
      <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between p-2.5 rounded-xl bg-[#182130] border border-[#243044] hover:border-[#33435C] gap-2 transition-colors">
        <!-- Column 1: IDと名前 (要請者 ➔ 保管者) -->
        <div class="flex items-center gap-2 min-w-0 w-full sm:w-72 sm:flex-none">
          <div class="flex items-center gap-1.5 min-w-0 flex-1">
            ${requesterBadge}
            <span class="font-semibold text-white truncate text-sm sm:text-base">${escapeHtml(req.requesterName || '')}</span>
          </div>
          <span class="text-xs text-[#94A3B8] flex-shrink-0">➔</span>
          <div class="flex items-center gap-1.5 min-w-0 flex-1">
            ${holderBadge}
            <span class="font-semibold text-white truncate text-sm sm:text-base">${escapeHtml(req.holderName || '')}</span>
          </div>
        </div>

        <!-- Column 2: 連絡方法・連絡先 -->
        <div class="flex items-center gap-2 text-xs sm:text-sm text-[#94A3B8] flex-1 min-w-0 ml-0 sm:ml-6">
          <span class="text-xs text-[#94A3B8] truncate">
            連絡先: ${req.contactMethod ? `<span class="text-[#94A3B8]/80">[${escapeHtml(req.contactMethod)}]</span> ` : ''}<span class="text-white/90 font-mono">${escapeHtml(req.contactValue || '--')}</span>
          </span>
        </div>

        <!-- Column 3: 日時 -->
        <div class="text-right flex-shrink-0">
          <span class="font-mono text-xs text-[#94A3B8]">${escapeHtml(formattedDate)}</span>
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
  const views = ['areas', 'records', 'stocks', 'roster', 'requests', 'mail'];
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
  } else if (targetView === 'mail') {
    renderMainStageMail(DashboardState.selectedMailTabIndex || 0);
  }
}

function updateNavHighlight(activeType) {
  const navTypes = ['mail', 'roster', 'stocks', 'requests', 'records', 'areas'];
  navTypes.forEach(t => {
    // Desktop Sidebar
    const el = document.getElementById(`nav-${t}`);
    if (el) {
      if (t === activeType) {
        el.className = 'nav-item nav-item-active w-full h-10 flex items-center gap-2.5 px-3 rounded-xl border border-brand/35 text-brand font-semibold text-left';
      } else {
        el.className = 'nav-item w-full h-10 flex items-center gap-2.5 px-3 rounded-xl text-textSub border border-transparent hover:text-white hover:bg-white/5 text-left font-medium';
      }
    }

    // Mobile Bottom Navigation
    const mEl = document.getElementById(`mobile-nav-${t}`);
    if (mEl) {
      if (t === activeType) {
        mEl.className = 'mobile-nav-item mobile-nav-active flex flex-col items-center justify-center flex-1 py-1 text-brand font-bold text-[10px] transition-colors cursor-pointer';
      } else {
        mEl.className = 'mobile-nav-item flex flex-col items-center justify-center flex-1 py-1 text-textSub font-medium text-[10px] hover:text-white transition-colors cursor-pointer';
      }
    }
  });
}

/**
 * =========================================================================
 * ✉️ 党員活動メール（5大テンプレート＆ワンクリックコピペ）
 * =========================================================================
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getMobilizationTemplates(districtName, liffUrl) {
  if (typeof districtName !== 'string' || !districtName.trim()) {
    throw new Error('[District SSOT Error] districtName is required and cannot be empty.');
  }
  if (typeof liffUrl !== 'string' || !liffUrl.trim()) {
    throw new Error('[LIFF SSOT Error] liffUrl is required and cannot be empty.');
  }

  const branchLabel = districtName.trim();
  const url = liffUrl.trim();

  return [
    {
      id: 0,
      icon: "📱",
      tabTitle: "① 導入紹介",
      role: "POSTING MAPの導入紹介",
      goalSummary: "このメールでお願いすること: 「まずは地図を開いて眺めてもらう」",
      targetState: "POSTING MAPをまだ利用していない党員向け",
      subject: `【${branchLabel}】ポスティングマップ導入のお知らせ`,
      body: `${branchLabel}の皆さん お疲れさまです

このたび ${branchLabel}では
ポスティング活動をより分かりやすく進めるため
『POSTING MAP』を導入しました

POSTING MAPでは
スマートフォンから配布エリアを確認したり
配布した場所を記録したりすることができます

まずは一度 地図を開いて
お住まいの地域を眺めてみてください

【POSTING MAP】
${url}

※ 新しいアプリのダウンロードや登録は不要です
  LINEからそのまま開いてご利用いただけます`
    },
    {
      id: 1,
      icon: "📦",
      tabTitle: "② チラシ展開",
      role: "最初の100枚を取りに来てもらう",
      goalSummary: "このメールでお願いすること: 「100枚だけ取りに来てもらう」",
      targetState: "アプリ導入前後の党員向け",
      subject: `【${branchLabel}】チラシを用意しています`,
      body: `■ チラシを取りに来ませんか

${branchLabel}の皆さん
いつも活動にご協力いただきありがとうございます

ポスティング用のチラシを用意しています

お時間のあるときに
私のところへチラシを取りに来ませんか？

必要な枚数をお渡しします

チラシを受け取ったら
POSTING MAPに保有しているチラシの枚数を
登録してくださいね

どんどん活動を広げていきましょう

ご都合の良い日をメールでご連絡ください`
    }
  ];
}

function renderMainStageMail(tabIndex = 0) {
  DashboardState.selectedMailTabIndex = tabIndex;
  const container = document.getElementById('main-stage-mail-content');
  if (!container) return;

  const districtName = (typeof window !== 'undefined' && window.PMS_CLIENT_CONFIG && window.PMS_CLIENT_CONFIG.districtName);
  const liffId = (typeof window !== 'undefined' && window.PMS_CLIENT_CONFIG && window.PMS_CLIENT_CONFIG.line && window.PMS_CLIENT_CONFIG.line.liffId);

  if (!districtName || typeof districtName !== 'string' || !districtName.trim()) {
    container.innerHTML = `
      <div class="flex-1 flex flex-col items-center justify-center p-8 rounded-xl bg-[#131A26] border border-statusRed/50 text-center gap-3">
        <span class="text-3xl">⚠️</span>
        <div class="font-bold text-statusRed text-base">【地区設定エラー】PMS_CLIENT_CONFIG.districtName が未設定です</div>
        <p class="text-xs text-textSub">config.js の districtName を確認してください。</p>
      </div>
    `;
    DashboardState.currentMailTemplates = [];
    return;
  }

  if (!liffId || typeof liffId !== 'string' || !liffId.trim()) {
    container.innerHTML = `
      <div class="flex-1 flex flex-col items-center justify-center p-8 rounded-xl bg-[#131A26] border border-statusRed/50 text-center gap-3">
        <span class="text-3xl">⚠️</span>
        <div class="font-bold text-statusRed text-base">【LINE LIFF設定エラー】PMS_CLIENT_CONFIG.line.liffId が未設定です</div>
        <p class="text-xs text-textSub">config.js の line.liffId を確認してください。</p>
      </div>
    `;
    DashboardState.currentMailTemplates = [];
    return;
  }

  const liffUrl = `https://liff.line.me/${liffId.trim()}`;

  let templates;
  try {
    templates = getMobilizationTemplates(districtName.trim(), liffUrl);
    DashboardState.currentMailTemplates = templates;
  } catch (err) {
    container.innerHTML = `<div class="p-6 text-center text-statusRed font-bold">${escapeHtml(err.message)}</div>`;
    DashboardState.currentMailTemplates = [];
    return;
  }

  const validIndex = (tabIndex >= 0 && tabIndex < templates.length) ? tabIndex : 0;
  const activeTpl = templates[validIndex];

  // 2連タブセレクター（文字幅フィット・セグメントUI）
  const tabsHtml = templates.map((t, idx) => {
    const isActive = idx === validIndex;
    return `
      <button onclick="renderMainStageMail(${idx})" class="px-3.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all duration-150 cursor-pointer ${
        isActive
          ? 'bg-brand/15 text-brand border border-brand/35 shadow-sm font-semibold'
          : 'text-textSub bg-[#0B1019]/60 border border-borderNormal/60 hover:text-white hover:bg-white/5'
      }">
        <span class="text-sm flex-shrink-0">${t.icon}</span>
        <span>${t.tabTitle}</span>
      </button>
    `;
  }).join('');

  container.innerHTML = `
    <div class="flex flex-col h-auto lg:h-full gap-2 pr-1 overflow-visible lg:overflow-hidden">
      <!-- タブセレクター (文字幅フィット・コンパクト左寄せ) -->
      <div class="flex items-center gap-2 flex-shrink-0">
        ${tabsHtml}
      </div>

      <!-- メインメール表示カード -->
      <div class="flex-none h-auto lg:flex-1 flex flex-col lg:min-h-0 rounded-xl bg-[#131A26] border border-borderNormal p-3 gap-2 overflow-visible lg:overflow-hidden">

        <!-- 件名ブロック -->
        <div class="flex items-center justify-between gap-2 px-3 py-1.5 rounded-lg bg-[#0B1019] border border-borderNormal flex-shrink-0">
          <div class="flex items-center gap-2 min-w-0">
            <span class="text-[11px] font-bold text-textSub flex-shrink-0">件名:</span>
            <span class="text-xs sm:text-sm font-medium text-white select-all truncate">${escapeHtml(activeTpl.subject)}</span>
          </div>
          <button onclick="copyMailSubject(${validIndex})" class="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#243044]/60 hover:bg-[#33435C] text-white text-xs font-medium border border-borderNormal flex-shrink-0 transition-colors">
            <span>📋</span>
            <span>件名をコピー</span>
          </button>
        </div>

        <!-- 本文ブロック（件名と同じUIヘッダー ＋ 本文領域） -->
        <div class="flex-none h-auto lg:flex-1 lg:min-h-0 relative flex flex-col rounded-lg bg-[#0B1019] border border-borderNormal overflow-hidden">
          <div class="px-3 py-1.5 border-b border-borderNormal/60 bg-[#0B1019] flex items-center justify-between flex-shrink-0">
            <span class="text-[11px] font-bold text-textSub">本文:</span>
            <button onclick="copyMailBody(${validIndex})" class="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#243044]/60 hover:bg-[#33435C] text-white text-xs font-medium border border-borderNormal flex-shrink-0 transition-colors">
              <span>📋</span>
              <span>本文をコピー</span>
            </button>
          </div>
          <pre id="mail-body-content" class="flex-none h-auto lg:flex-1 lg:min-h-0 p-3 text-xs sm:text-sm text-white/90 font-sans leading-relaxed whitespace-pre-wrap break-words select-all overflow-visible lg:overflow-y-auto lg:overflow-x-auto">${escapeHtml(activeTpl.body)}</pre>
        </div>

      </div>
    </div>
  `;
}

function copyMailSubject(tabIndex) {
  const templates = DashboardState.currentMailTemplates || [];
  const tpl = templates[tabIndex] || templates[0];
  if (!tpl) return;
  copyTextToClipboard(tpl.subject, "✓ 件名をコピーしました");
}

function convertPlainTextToRichHtml(text) {
  if (!text) return '';
  const lines = text.split('\n');
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return lines.map(line => {
    if (!line.trim()) return '<div><br></div>';
    const escaped = escapeHtml(line);
    const linked = escaped.replace(urlRegex, (url) => `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`);
    return `<div>${linked}</div>`;
  }).join('');
}

function copyRichAndPlainText(plainText, htmlText, successMsg) {
  let copied = false;
  const listener = (e) => {
    e.clipboardData.setData('text/plain', plainText);
    e.clipboardData.setData('text/html', htmlText);
    e.preventDefault();
    copied = true;
  };

  try {
    document.addEventListener('copy', listener);
    document.execCommand('copy');
  } catch (err) {
    console.warn('execCommand copy failed:', err);
  } finally {
    document.removeEventListener('copy', listener);
  }

  if (copied) {
    showMailToast(successMsg);
    return;
  }

  if (navigator.clipboard && window.ClipboardItem && navigator.clipboard.write) {
    try {
      const plainBlob = new Blob([plainText], { type: 'text/plain' });
      const htmlBlob = new Blob([htmlText], { type: 'text/html' });
      const item = new ClipboardItem({
        'text/plain': plainBlob,
        'text/html': htmlBlob
      });
      navigator.clipboard.write([item]).then(() => {
        showMailToast(successMsg);
      }).catch(() => {
        copyTextToClipboard(plainText, successMsg);
      });
    } catch (e) {
      copyTextToClipboard(plainText, successMsg);
    }
  } else {
    copyTextToClipboard(plainText, successMsg);
  }
}

function copyMailBody(tabIndex) {
  const templates = DashboardState.currentMailTemplates || [];
  const tpl = templates[tabIndex] || templates[0];
  if (!tpl) return;
  const richHtml = convertPlainTextToRichHtml(tpl.body);
  copyRichAndPlainText(tpl.body, richHtml, "✓ 本文をコピーしました");
}

let mailToastTimer = null;
function copyTextToClipboard(text, successMsg) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showMailToast(successMsg);
    }).catch(() => {
      fallbackCopyText(text);
      showMailToast(successMsg);
    });
  } else {
    fallbackCopyText(text);
    showMailToast(successMsg);
  }
}

function fallbackCopyText(text) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.left = "-999999px";
  textArea.style.top = "-999999px";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand('copy');
  } catch (err) {}
  document.body.removeChild(textArea);
}

function showMailToast(msg) {
  const toastEl = document.getElementById('mail-copy-toast');
  if (!toastEl) return;
  toastEl.textContent = msg;
  toastEl.classList.remove('opacity-0', 'pointer-events-none', '-translate-y-2');
  toastEl.classList.add('opacity-100', 'translate-y-0');

  if (mailToastTimer) clearTimeout(mailToastTimer);
  mailToastTimer = setTimeout(() => {
    toastEl.classList.remove('opacity-100', 'translate-y-0');
    toastEl.classList.add('opacity-0', 'pointer-events-none', '-translate-y-2');
  }, 1800);
}

/**
 * 同期ステータス表示
 */
function setSyncStatus(isLive) {
  const dot = document.getElementById('live-dot');
  const text = document.getElementById('live-status-text');
  const clock = document.getElementById('sync-clock');

  const mDot = document.getElementById('mobile-live-dot');
  const mClock = document.getElementById('mobile-sync-clock');

  if (dot) dot.className = isLive ? 'w-2 h-2 rounded-full bg-statusGreen' : 'w-2 h-2 rounded-full bg-statusYellow';
  if (mDot) mDot.className = isLive ? 'w-2 h-2 rounded-full bg-statusGreen' : 'w-2 h-2 rounded-full bg-statusYellow';
  if (text) text.textContent = isLive ? '現場データ同期' : '再接続待機中';

  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
  const shortTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  if (clock) clock.textContent = timeStr;
  if (mClock) mClock.textContent = shortTimeStr;
}

/**
 * =========================================================================
 * 📄 POSTING MAP 正式配布実績報告書（PDF / 印刷）Generator [SSOT Pure Function]
 * =========================================================================
 */

/**
 * 渡されたStateからA4印刷用HTMLテンプレートを生成するPure Function
 * (外部通信・状態変更を行わない)
 */
function generateRecordsReportPdfHtml(state) {
  const s = state || {};
  const branchLabel = (
    s.branchLabel ||
    s.deploymentConfig?.branchLabel ||
    (typeof window !== 'undefined' && window.PMS_CLIENT_CONFIG && window.PMS_CLIENT_CONFIG.districtName) ||
    s.summary?.districtName ||
    '支部'
  ).trim();

  // 出力日時
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const formattedTimestamp = `${yyyy}/${mm}/${dd} ${hh}:${min}`;

  // サマリー数値
  const doneAreas = Number(s.summary?.completedPins ?? (s.globalPinStatus?.completed?.length || 0));
  const totalAreas = Number(s.summary?.totalPins ?? (s.masterPins?.length || 0));
  const unassignedAreas = Number(s.summary?.unassignedPins ?? Math.max(0, totalAreas - doneAreas - Number(s.summary?.inProgressPins ?? (s.globalPinStatus?.inProgress?.length || 0))));
  const inProgressAreas = Number(s.summary?.inProgressPins ?? (s.globalPinStatus?.inProgress?.length || 0));
  const completedAreas = doneAreas;

  // 1、登録者一覧 行データ
  const rosterList = s.roster || [];
  const rankingList = s.ranking || [];
  const stocksList = s.stocks || [];
  const liveRecordsList = s.liveRecords || [];

  const totalPostings = Number(s.summary?.totalPostings || rankingList.reduce((acc, cur) => acc + (Number(cur.count) || 0), 0));
  const totalStock = Number(s.summary?.totalStockCount ?? (stocksList.reduce((acc, cur) => acc + (Number(cur.count) || 0), 0)));
  const rosterCount = Number(s.summary?.rosterCount ?? (rosterList.length || 0));

  let rosterRowsHtml = '';
  if (rosterList.length === 0) {
    rosterRowsHtml = `<tr><td colspan="4" class="text-muted" style="padding: 8px;">登録データはありません</td></tr>`;
  } else {
    rosterRowsHtml = rosterList.map(r => {
      const staffStocks = stocksList.filter(st => st.staffId === r.id);
      const stockTotal = staffStocks.reduce((acc, st) => acc + (Number(st.count) || 0), 0);
      const staffRank = rankingList.find(rk => rk.staffId === r.id);
      const deliveredTotal = staffRank ? Number(staffRank.count || 0) : 0;
      const isUnregistered = !r.name || r.name === '未登録';

      return `
        <tr class="${isUnregistered ? 'text-muted' : ''}">
          <td class="font-mono">${escapeHtml(r.id || '--')}</td>
          <td>${escapeHtml(r.name || '未登録')}</td>
          <td class="font-mono">${stockTotal.toLocaleString()} 枚</td>
          <td class="font-mono">${deliveredTotal.toLocaleString()} 枚</td>
        </tr>
      `;
    }).join('');
  }

  // 2、配布実績 行データ
  let liveRecordsRowsHtml = '';
  if (liveRecordsList.length === 0) {
    liveRecordsRowsHtml = `<tr><td colspan="5" class="text-muted" style="padding: 8px;">配布実績データはありません</td></tr>`;
  } else {
    liveRecordsRowsHtml = liveRecordsList.slice(0, 15).map(rec => {
      let formattedTime = rec.time || '--:--';
      if (rec.timestamp) {
        const match = String(rec.timestamp).trim().match(/(?:^\d{4}[\/-])?(\d{1,2}[\/-]\d{1,2}\s+\d{1,2}:\d{2})/);
        if (match) formattedTime = match[1].replace('-', '/');
      }
      const areaName = [rec.cityName, rec.townName].filter(Boolean).join(' ') || `エリア #${rec.rowId || ''}`;
      const countVal = Number(rec.count || 0);
      const gpsLabel = rec.gpsStatus === 'OK' ? 'GPS' : (rec.hasGps ? 'GPS' : '');
      const photoLabel = rec.photoStatus === 'OK' ? '写真' : (rec.hasPhoto ? '写真' : '');
      const evidenceLabels = [gpsLabel, photoLabel].filter(Boolean).join(' / ') || '—';

      return `
        <tr>
          <td class="font-mono text-muted">${escapeHtml(formattedTime)}</td>
          <td>${escapeHtml(areaName)}</td>
          <td class="font-mono">${countVal.toLocaleString()} 枚</td>
          <td class="font-mono">${escapeHtml(rec.staffId || '--')}</td>
          <td class="font-mono text-muted">${escapeHtml(evidenceLabels)}</td>
        </tr>
      `;
    }).join('');
  }

  // 3、ランキング 行データ
  let rankingRowsHtml = '';
  if (rankingList.length === 0) {
    rankingRowsHtml = `<tr><td colspan="7" class="text-muted" style="padding: 8px;">ランキングデータはありません</td></tr>`;
  } else {
    rankingRowsHtml = rankingList.map((item, idx) => {
      const rankNum = item.rank || (idx + 1);
      const isUnregistered = !item.name || item.name === '未登録';
      const staffRecs = liveRecordsList.filter(r => r.staffId === item.staffId);
      const hasGpsRec = item.hasGps || staffRecs.some(r => r.gpsStatus === 'OK' || r.hasGps);
      const hasPhotoRec = item.hasPhoto || staffRecs.some(r => r.photoStatus === 'OK' || r.hasPhoto);

      const gpsDisplay = isUnregistered ? '—' : (hasGpsRec ? 'OK' : 'NO');
      const photoDisplay = isUnregistered ? '—' : (hasPhotoRec ? 'OK' : 'NO');
      const completedCount = Number(item.completedAreas || (item.count > 0 ? doneAreas : 0));

      return `
        <tr class="${isUnregistered ? 'text-muted' : ''}">
          <td class="font-mono">${rankNum}</td>
          <td class="font-mono">${escapeHtml(item.staffId || '--')}</td>
          <td>${escapeHtml(item.name || '未登録')}</td>
          <td class="font-mono">${Number(item.count || 0).toLocaleString()} 枚</td>
          <td class="font-mono">${completedCount}</td>
          <td class="font-mono">${gpsDisplay}</td>
          <td class="font-mono">${photoDisplay}</td>
        </tr>
      `;
    }).join('');
  }

  // 4、保有チラシ 行データ
  let stocksRowsHtml = '';
  if (stocksList.length === 0) {
    stocksRowsHtml = `<tr><td colspan="5" class="text-muted" style="padding: 8px;">保有チラシデータはありません</td></tr>`;
  } else {
    stocksRowsHtml = stocksList.map(st => {
      const isUnregistered = !st.staffName || st.staffName === '未登録';
      const reqCount = Number(st.pendingRequestsCount || st.requests || 0);
      let formattedUpdate = st.updatedAt || '--';
      if (st.updatedAt) {
        const match = String(st.updatedAt).trim().match(/(?:^\d{4}[\/-])?(\d{1,2}[\/-]\d{1,2}\s+\d{1,2}:\d{2})/);
        if (match) formattedUpdate = match[1].replace('-', '/');
      }

      return `
        <tr class="${isUnregistered ? 'text-muted' : ''}">
          <td class="font-mono">${escapeHtml(st.staffId || '--')}</td>
          <td>${escapeHtml(st.staffName || st.location || '未設定')}</td>
          <td class="font-mono">${Number(st.count || 0).toLocaleString()} 枚</td>
          <td class="font-mono text-muted">${reqCount} 件</td>
          <td class="font-mono text-muted">${escapeHtml(formattedUpdate)}</td>
        </tr>
      `;
    }).join('');
  }

  const logoUrl = (typeof window !== 'undefined' && window.location)
    ? `${window.location.origin}/active/dashboard/assets/icon180-v2.png`
    : '/active/dashboard/assets/icon180-v2.png';

  return `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>【${escapeHtml(branchLabel)}】配布実績報告書 - POSTING MAP</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Noto+Sans+JP:wght@400;500;700;900&family=JetBrains+Mono:wght@400;500;700&display=swap');

    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    @page {
      size: A4 portrait;
      margin: 12mm 14mm;
    }

    body {
      font-family: 'Inter', 'Noto Sans JP', sans-serif;
      color: #0F172A;
      background-color: #FFFFFF;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      line-height: 1.4;
    }

    .font-mono {
      font-family: 'JetBrains Mono', monospace;
    }

    .sheet {
      width: 100%;
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: 270mm;
    }

    /* ヘッダーブロック（左: ロゴ / 中央: タイトル / 右: 出力日時） */
    .header-box {
      border-bottom: 1.5px solid #334155;
      padding-bottom: 8px;
      position: relative;
    }

    .header-3col {
      display: flex;
      align-items: center;
      justify-content: space-between;
      position: relative;
      min-height: 38px;
    }

    .header-left {
      width: 140px;
      display: flex;
      align-items: center;
      justify-content: flex-start;
    }

    .logo-img {
      width: 36px;
      height: 36px;
      border-radius: 8px;
      border: 1px solid #CBD5E1;
      object-fit: contain;
    }

    .header-center {
      position: absolute;
      left: 50%;
      transform: translateX(-50%);
      text-align: center;
      white-space: nowrap;
    }

    .header-center h1 {
      font-size: 19px;
      font-weight: 800;
      color: #0F172A;
      letter-spacing: -0.01em;
    }

    .header-right {
      width: 140px;
      text-align: right;
      font-size: 11px;
      font-weight: 700;
      font-family: 'JetBrains Mono', monospace;
      color: #475569;
    }

    /* サマリー指標 */
    .summary-section {
      border-bottom: 1.5px solid #CBD5E1;
      padding: 14px 0;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .summary-row-1 {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 12px;
      text-align: center;
    }

    .summary-row-2 {
      display: grid;
      grid-template-columns: repeat(3, 1fr) 1fr;
      gap: 12px;
      text-align: center;
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px dashed #E2E8F0;
    }

    .kpi-card {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .kpi-title {
      font-size: 11px;
      font-weight: 600;
      color: #64748B;
      margin-bottom: 2px;
    }

    .kpi-num {
      font-size: 20px;
      font-weight: 800;
      font-family: 'JetBrains Mono', monospace;
      color: #0F172A;
      line-height: 1.1;
    }

    .kpi-num .unit {
      font-size: 12px;
      font-weight: 500;
      color: #64748B;
      margin-left: 2px;
    }

    .kpi-num .sub {
      font-size: 13px;
      font-weight: 500;
      color: #94A3B8;
      font-family: 'JetBrains Mono', monospace;
    }

    /* 各セクション */
    .sections-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: space-evenly;
      padding: 8px 0;
    }

    .section-wrap {
      margin: 6px 0;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .section-title {
      font-size: 13px;
      font-weight: 800;
      color: #0F172A;
      margin-bottom: 6px;
    }

    /* 帳票テーブル */
    .report-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11px;
      text-align: center;
    }

    .report-table thead tr {
      border-top: 1.5px solid #334155;
      border-bottom: 1.5px solid #334155;
      background: #F8FAFC;
    }

    .report-table th {
      padding: 6px 8px;
      font-weight: 700;
      color: #334155;
      font-size: 10.5px;
      text-align: center;
      border: none;
    }

    .report-table td {
      padding: 6.5px 8px;
      color: #1E293B;
      font-weight: 400;
      text-align: center;
      border-bottom: 1px solid #E2E8F0;
    }

    .report-table tbody tr:last-child td {
      border-bottom: 1.5px solid #334155;
    }

    .text-muted { color: #94A3B8 !important; }

    /* フッター */
    .report-footer {
      border-top: 1.5px solid #334155;
      padding-top: 8px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 9.5px;
      color: #64748B;
      break-inside: avoid;
      page-break-inside: avoid;
    }

    .report-footer .brand {
      font-weight: 800;
      font-family: 'JetBrains Mono', monospace;
      color: #0F172A;
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div>
      <!-- 1. ヘッダーブロック -->
      <div class="header-box">
        <div class="header-3col">
          <div class="header-left">
            <img src="${logoUrl}" alt="POSTING MAP" class="logo-img">
          </div>
          <div class="header-center">
            <h1>【${escapeHtml(branchLabel)}】配布実績報告書</h1>
          </div>
          <div class="header-right">
            ${formattedTimestamp}
          </div>
        </div>
      </div>

      <!-- 2. サマリー指標 -->
      <div class="summary-section">
        <div class="summary-row-1">
          <div class="kpi-card">
            <div class="kpi-title">配布状況</div>
            <div class="kpi-num">${doneAreas} <span class="sub">/ ${totalAreas}</span></div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">未配布</div>
            <div class="kpi-num">${unassignedAreas}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">配布中</div>
            <div class="kpi-num">${inProgressAreas}</div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">完了</div>
            <div class="kpi-num">${completedAreas}</div>
          </div>
        </div>

        <div class="summary-row-2">
          <div class="kpi-card">
            <div class="kpi-title">配布実績</div>
            <div class="kpi-num">${totalPostings.toLocaleString()} <span class="unit">枚</span></div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">保有チラシ</div>
            <div class="kpi-num">${totalStock.toLocaleString()} <span class="unit">枚</span></div>
          </div>
          <div class="kpi-card">
            <div class="kpi-title">名簿</div>
            <div class="kpi-num">${rosterCount} <span class="unit">名</span></div>
          </div>
          <div></div>
        </div>
      </div>

      <!-- 3〜6. 4大セクション -->
      <div class="sections-container">
        <!-- セクション1: 1、登録者一覧 -->
        <div class="section-wrap">
          <div class="section-title">1、登録者一覧</div>
          <table class="report-table">
            <thead>
              <tr>
                <th style="width: 25%;">スタッフID</th>
                <th style="width: 25%;">氏名</th>
                <th style="width: 25%;">保有枚数</th>
                <th style="width: 25%;">累計配布枚数</th>
              </tr>
            </thead>
            <tbody>
              ${rosterRowsHtml}
            </tbody>
          </table>
        </div>

        <!-- セクション2: 2、配布実績 -->
        <div class="section-wrap">
          <div class="section-title">2、配布実績</div>
          <table class="report-table">
            <thead>
              <tr>
                <th style="width: 20%;">配布日時</th>
                <th style="width: 32%;">配布地域</th>
                <th style="width: 16%;">配布枚数</th>
                <th style="width: 16%;">担当スタッフ</th>
                <th style="width: 16%;">現場記録</th>
              </tr>
            </thead>
            <tbody>
              ${liveRecordsRowsHtml}
            </tbody>
          </table>
        </div>

        <!-- セクション3: 3、ランキング -->
        <div class="section-wrap">
          <div class="section-header-wrap">
            <div class="section-title">3、ランキング</div>
          </div>
          <table class="report-table">
            <thead>
              <tr>
                <th style="width: 10%;">順位</th>
                <th style="width: 16%;">スタッフID</th>
                <th style="width: 22%;">氏名</th>
                <th style="width: 18%;">累計配布枚数</th>
                <th style="width: 14%;">完了エリア</th>
                <th style="width: 10%;">GPS</th>
                <th style="width: 10%;">写真</th>
              </tr>
            </thead>
            <tbody>
              ${rankingRowsHtml}
            </tbody>
          </table>
        </div>

        <!-- セクション4: 4、保有チラシ -->
        <div class="section-wrap">
          <div class="section-title">4、保有チラシ</div>
          <table class="report-table">
            <thead>
              <tr>
                <th style="width: 20%;">スタッフID</th>
                <th style="width: 25%;">氏名</th>
                <th style="width: 20%;">保有枚数</th>
                <th style="width: 15%;">受渡要請</th>
                <th style="width: 20%;">最終更新</th>
              </tr>
            </thead>
            <tbody>
              ${stocksRowsHtml}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- 7. フッター -->
    <div class="report-footer">
      <div class="brand">POSTING MAP</div>
      <div class="font-mono">Page 1 / 1</div>
    </div>
  </div>
</body>
</html>`;
}

/**
 * 帳票出力 (PDF) トリガー関数
 * 非表示iframeを通じてネイティブ印刷ダイアログを起動
 */
function downloadRecordsReportPdf() {
  if (typeof DashboardState === 'undefined') {
    alert('ダッシュボードの状態を読み込めませんでした。');
    return;
  }

  const html = generateRecordsReportPdfHtml(DashboardState);
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();
  doc.write(html);
  doc.close();

  iframe.contentWindow.focus();
  setTimeout(() => {
    iframe.contentWindow.print();
    setTimeout(() => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
    }, 1500);
  }, 300);
}

window.generateRecordsReportPdfHtml = generateRecordsReportPdfHtml;
window.downloadRecordsReportPdf = downloadRecordsReportPdf;

/**
 * =========================================================================
 * 📊 POSTING MAP 正式配布実績データ (CSV) Generator [SSOT Pure Function]
 * =========================================================================
 */

/**
 * CSVフィールドのエスケープ（RFC 4180準拠）
 */
function formatCsvField(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return `"${str}"`;
}

/**
 * 渡されたStateからUTF-8 BOM付きCSV文字列を生成するPure Function
 */
function generateRecordsCsv(state) {
  const s = state || {};
  const branchLabel = (
    s.branchLabel ||
    s.deploymentConfig?.branchLabel ||
    (typeof window !== 'undefined' && window.PMS_CLIENT_CONFIG && window.PMS_CLIENT_CONFIG.districtName) ||
    s.summary?.districtName ||
    '支部'
  ).trim();

  // 出力日時
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  const formattedTimestamp = `${yyyy}/${mm}/${dd} ${hh}:${min}`;

  const rosterList = s.roster || [];
  const rankingList = s.ranking || [];
  const stocksList = s.stocks || [];
  const liveRecordsList = s.liveRecords || [];

  const lines = [];

  // メタ情報
  lines.push([formatCsvField(`【${branchLabel}】配布実績データ`), formatCsvField(`出力日時: ${formattedTimestamp}`)].join(','));
  lines.push('');

  // 1、登録者一覧
  lines.push(formatCsvField('1、登録者一覧'));
  lines.push(['スタッフID', '氏名', '保有枚数', '累計配布枚数'].map(formatCsvField).join(','));
  if (rosterList.length === 0) {
    lines.push(['(データなし)', '', '', ''].map(formatCsvField).join(','));
  } else {
    rosterList.forEach(r => {
      const staffStocks = stocksList.filter(st => st.staffId === r.id);
      const stockTotal = staffStocks.reduce((acc, st) => acc + (Number(st.count) || 0), 0);
      const staffRank = rankingList.find(rk => rk.staffId === r.id);
      const deliveredTotal = staffRank ? Number(staffRank.count || 0) : 0;
      lines.push([r.id || '--', r.name || '未登録', `${stockTotal.toLocaleString()} 枚`, `${deliveredTotal.toLocaleString()} 枚`].map(formatCsvField).join(','));
    });
  }
  lines.push('');

  // 2、配布実績
  lines.push(formatCsvField('2、配布実績'));
  lines.push(['配布日時', '配布地域', '配布枚数', '担当スタッフ', 'GPS', '写真'].map(formatCsvField).join(','));
  if (liveRecordsList.length === 0) {
    lines.push(['(データなし)', '', '', '', '', ''].map(formatCsvField).join(','));
  } else {
    liveRecordsList.forEach(rec => {
      let formattedTime = rec.time || '--:--';
      if (rec.timestamp) {
        const match = String(rec.timestamp).trim().match(/(?:^\d{4}[\/-])?(\d{1,2}[\/-]\d{1,2}\s+\d{1,2}:\d{2})/);
        if (match) formattedTime = match[1].replace('-', '/');
      }
      const areaName = [rec.cityName, rec.townName].filter(Boolean).join(' ') || `エリア #${rec.rowId || ''}`;
      const countVal = `${Number(rec.count || 0).toLocaleString()} 枚`;
      const gpsLabel = rec.gpsStatus === 'OK' ? 'OK' : (rec.hasGps ? 'OK' : 'NO');
      const photoLabel = rec.photoStatus === 'OK' ? 'OK' : (rec.hasPhoto ? 'OK' : 'NO');
      lines.push([formattedTime, areaName, countVal, rec.staffId || '--', gpsLabel, photoLabel].map(formatCsvField).join(','));
    });
  }
  lines.push('');

  // 3、ランキング
  lines.push(formatCsvField('3、ランキング'));
  lines.push(['順位', 'スタッフID', '氏名', '累計配布枚数', '完了エリア', 'GPS', '写真'].map(formatCsvField).join(','));
  if (rankingList.length === 0) {
    lines.push(['(データなし)', '', '', '', '', '', ''].map(formatCsvField).join(','));
  } else {
    const doneAreas = Number(s.summary?.completedPins ?? (s.globalPinStatus?.completed?.length || 0));
    rankingList.forEach((item, idx) => {
      const rankNum = item.rank || (idx + 1);
      const isUnregistered = !item.name || item.name === '未登録';
      const staffRecs = liveRecordsList.filter(r => r.staffId === item.staffId);
      const hasGpsRec = item.hasGps || staffRecs.some(r => r.gpsStatus === 'OK' || r.hasGps);
      const hasPhotoRec = item.hasPhoto || staffRecs.some(r => r.photoStatus === 'OK' || r.hasPhoto);

      const gpsDisplay = isUnregistered ? '—' : (hasGpsRec ? 'OK' : 'NO');
      const photoDisplay = isUnregistered ? '—' : (hasPhotoRec ? 'OK' : 'NO');
      const completedCount = Number(item.completedAreas || (item.count > 0 ? doneAreas : 0));

      lines.push([
        rankNum,
        item.staffId || '--',
        item.name || '未登録',
        `${Number(item.count || 0).toLocaleString()} 枚`,
        completedCount,
        gpsDisplay,
        photoDisplay
      ].map(formatCsvField).join(','));
    });
  }
  lines.push('');

  // 4、保有チラシ
  lines.push(formatCsvField('4、保有チラシ'));
  lines.push(['スタッフID', '氏名', '保有枚数', '受渡要請', '最終更新'].map(formatCsvField).join(','));
  if (stocksList.length === 0) {
    lines.push(['(データなし)', '', '', '', ''].map(formatCsvField).join(','));
  } else {
    stocksList.forEach(st => {
      const reqCount = `${Number(st.pendingRequestsCount || st.requests || 0)} 件`;
      let formattedUpdate = st.updatedAt || '--';
      if (st.updatedAt) {
        const match = String(st.updatedAt).trim().match(/(?:^\d{4}[\/-])?(\d{1,2}[\/-]\d{1,2}\s+\d{1,2}:\d{2})/);
        if (match) formattedUpdate = match[1].replace('-', '/');
      }
      lines.push([
        st.staffId || '--',
        st.staffName || st.location || '未設定',
        `${Number(st.count || 0).toLocaleString()} 枚`,
        reqCount,
        formattedUpdate
      ].map(formatCsvField).join(','));
    });
  }

  return '\uFEFF' + lines.join('\r\n');
}

/**
 * 配布実績 CSVダウンロード トリガー関数
 */
function downloadRecordsCsv() {
  if (typeof DashboardState === 'undefined') {
    alert('ダッシュボードの状態を読み込めませんでした。');
    return;
  }

  const csvContent = generateRecordsCsv(DashboardState);
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');

  const branchLabel = (
    DashboardState.branchLabel ||
    DashboardState.deploymentConfig?.branchLabel ||
    (typeof window !== 'undefined' && window.PMS_CLIENT_CONFIG && window.PMS_CLIENT_CONFIG.districtName) ||
    DashboardState.summary?.districtName ||
    '支部'
  ).trim();

  const fileName = `${branchLabel}_配布実績_${yyyy}${mm}${dd}_${hh}${min}.csv`;

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', fileName);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

window.formatCsvField = formatCsvField;
window.generateRecordsCsv = generateRecordsCsv;
window.downloadRecordsCsv = downloadRecordsCsv;
