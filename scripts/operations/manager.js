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
  ranking: [], // 現場アプリと完全同一の計算済みランキング (getRanking)
  roster: [],
  requests: [], // 受渡要請 (getTransferRequests)
  liveRecords: [], // Backendから取得した最新配布実績レコード (SSOT)
  latestSeenRecordId: null, // アニメーション検知用最新レコードID
  globalPinStatus: { inProgress: [], completed: [] },
  masterPins858: [], // SSOT 858件マスターピン
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
 * - 広域（Lv11全域初期表示）では858件の密集を防ぐため、極小ドット（2.2px / 3.0px）で表示し、
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
  
  // 1. SSOT 858件住所マスターの読み込み
  await loadAddressMaster858();

  // 2. 858エリア町丁目境界GeoJSONの読み込み（独立レイヤー）
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
 * SSOT: data/MIE03_ADDRESS_MASTER_858.csv の取得とパース
 */
async function loadAddressMaster858() {
  try {
    const res = await fetchStaticDataFile('MIE03_ADDRESS_MASTER_858.csv');
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

    // SSOTマスターからユニークな自治体リストを抽出（出現順SSOTを尊重）
    const uniqueCities = [];
    const citySet = new Set();
    for (const p of pins) {
      if (p.cityName && !citySet.has(p.cityName)) {
        citySet.add(p.cityName);
        uniqueCities.push(p.cityName);
      }
    }
    DashboardState.cities = uniqueCities;

    // 自治体セレクターをSSOTから動的生成
    populateCitySelector(uniqueCities);

    // マップにピンを描画
    renderPinsOnMap(DashboardState.map, DashboardState.markersLayer, pins);

  } catch (err) {
    console.error('[SSOT Load Error]', err);
  }
}

/**
 * 国勢調査小地域境界 (data/MIE03_BOUNDARIES.geojson) の取得と背景レイヤー初期化
 * - 純粋な地理的背景情報として描画（業務データやrowIdとの紐付けは一切行わない）
 */
async function loadBoundariesGeoJson() {
  try {
    const res = await fetchStaticDataFile('MIE03_BOUNDARIES.geojson');
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
}

/**
 * SSOT自治体セレクターの動的生成
 */
function populateCitySelector(cities) {
  const select = document.getElementById('city-selector');
  if (!select) return;

  const currentVal = DashboardState.selectedCity || 'ALL';
  select.innerHTML = '';

  // 1. 全域プリセット (ALL: 表示範囲プリセット)
  const allOpt = document.createElement('option');
  allOpt.value = 'ALL';
  allOpt.textContent = '全域';
  select.appendChild(allOpt);

  // 2. SSOTから動的抽出された自治体リスト
  cities.forEach(cityName => {
    const opt = document.createElement('option');
    opt.value = cityName;
    opt.textContent = cityName;
    select.appendChild(opt);
  });

  select.value = currentVal;
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
    }).setView([35.0641, 136.6200], 11);

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
    if (isTier1Ok && Array.isArray(tier1Res.cities)) {
      DashboardState.cities = tier1Res.cities.map(c => typeof c === 'string' ? c : (c.name || '')).filter(Boolean);
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
      renderPinsOnMap(DashboardState.map, DashboardState.markersLayer, DashboardState.masterPins858);
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
    renderPinsOnMap(DashboardState.map, DashboardState.markersLayer, DashboardState.masterPins858);
  }

  // マップの連動ズーム移動（SSOT住所マスターデータから動的にフォーカス）
  if (DashboardState.map) {
    if (cityName === 'ALL') {
      if (DashboardState.masterPins858.length > 0) {
        const bounds = L.latLngBounds(DashboardState.masterPins858.map(p => [p.lat, p.lng]));
        DashboardState.map.fitBounds(bounds, { padding: [20, 20], maxZoom: 11 });
      } else {
        DashboardState.map.setView([35.0641, 136.6200], 11);
      }
    } else {
      const cityPins = DashboardState.masterPins858.filter(p => p.cityName === cityName);
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

  // 1. トップの事実数字（SSOT 858件 ＆ 実配布完了データ連動）
  let totalAreas = DashboardState.masterPins858.length || 858;
  let doneAreas = DashboardState.masterPins858.filter(p => completedList.includes(p.rowId)).length;
  let progAreas = DashboardState.masterPins858.filter(p => inProgressList.includes(p.rowId)).length;

  if (!isAll && DashboardState.masterPins858.length > 0) {
    const cityPins = DashboardState.masterPins858.filter(p => p.cityName.includes(selected) || selected.includes(p.cityName));
    totalAreas = cityPins.length;
    doneAreas = cityPins.filter(p => completedList.includes(p.rowId)).length;
    progAreas = cityPins.filter(p => inProgressList.includes(p.rowId)).length;
  }

  const unallocatedAreas = Math.max(0, totalAreas - doneAreas - progAreas);
  const progressPercent = totalAreas > 0 ? Math.round((doneAreas / totalAreas) * 100) : 0;

  const doneAreasEl = document.getElementById('fact-done-areas');
  const totalAreasEl = document.getElementById('fact-total-areas');
  const progressBadgeEl = document.getElementById('fact-progress-badge');
  const unallocatedEl = document.getElementById('fact-unallocated-areas');
  const inProgressEl = document.getElementById('fact-inprogress-areas');
  const completedEl = document.getElementById('fact-completed-areas');
  const districtLabelEl = document.getElementById('map-district-label');

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

  // 2. 保有チラシの描画
  renderStockFacts(DashboardState.stocks, selected);

  // 3. 最下部 LIVE 配布実績フィードの描画 (Backend SSOT)
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
      <div class="flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-[#182130] border border-[#243044] text-[11px] text-white flex-shrink-0 ${isFirstNew ? 'live-card-new' : ''}">
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
function renderMainStageRecords(ranking) {
  const contentEl = document.getElementById('main-stage-records-content');
  if (!contentEl) return;

  const rankingList = ranking || [];
  if (rankingList.length === 0) {
    contentEl.innerHTML = `<div class="text-xs text-[#94A3B8]/60 text-center py-12">配布実績データはありません</div>`;
    return;
  }

  let html = '<div class="space-y-1.5">';
  rankingList.forEach((item, index) => {
    const rank = item.rank || (index + 1);
    let rankBadgeHtml = '';
    if (rank === 1) {
      rankBadgeHtml = `<span class="w-7 h-7 flex items-center justify-center text-base select-none">🥇</span>`;
    } else if (rank === 2) {
      rankBadgeHtml = `<span class="w-7 h-7 flex items-center justify-center text-base select-none">🥈</span>`;
    } else if (rank === 3) {
      rankBadgeHtml = `<span class="w-7 h-7 flex items-center justify-center text-base select-none">🥉</span>`;
    } else {
      rankBadgeHtml = `<span class="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold font-mono bg-white/5 text-white/70">${rank}</span>`;
    }

    html += `
      <div class="flex items-center justify-between p-2.5 rounded-xl bg-[#182130] border border-[#243044] hover:border-[#33435C] transition-colors">
        <div class="flex items-center gap-3">
          ${rankBadgeHtml}
          <div>
            <div class="flex items-center gap-2">
              <span class="font-semibold text-white text-sm font-mono">${item.staffId}</span>
              ${item.name ? `<span class="text-xs text-[#94A3B8] font-normal">(${item.name})</span>` : ''}
            </div>
            <div class="text-[11px] text-statusGreen font-normal mt-0.5">● 稼働確認済</div>
          </div>
        </div>
        <div class="text-right">
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
          <div class="font-semibold text-sm text-white">${s.location || '保管拠点'}</div>
          <div class="text-xs text-[#94A3B8] font-normal mt-0.5">担当: ${s.staffName || s.staffId || '未設定'} ｜ 更新: ${s.updatedAt || '--'}</div>
        </div>
        <div class="text-right">
          <span class="text-xl font-bold font-mono text-white">${(Number(s.count) || 0).toLocaleString()}</span>
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
          <span class="w-7 h-7 rounded-lg bg-brand/10 border border-brand/20 flex items-center justify-center font-mono font-semibold text-xs text-brand">${r.id || ''}</span>
          <div>
            <div class="font-semibold text-sm text-white">${r.name || ''}</div>
            <div class="text-xs text-[#94A3B8] font-normal mt-0.5">区分: 正式登録配布員</div>
          </div>
        </div>
        <span class="text-xs text-statusGreen font-medium px-2 py-0.5 rounded bg-statusGreen/10 border border-statusGreen/20">有効</span>
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
            <span class="font-semibold text-sm text-white">${req.requesterName || req.requesterId}</span>
            <span class="text-xs text-[#94A3B8]">➔</span>
            <span class="font-semibold text-sm text-white">${req.holderName || req.holderId}</span>
          </div>
          <span class="font-mono text-xs text-[#94A3B8] font-normal">${req.requestTime || ''}</span>
        </div>
        <div class="text-xs text-[#94A3B8] font-normal mt-1 flex items-center justify-between">
          <span>連絡先: ${req.contactMethod ? `[${req.contactMethod}] ` : ''}${req.contactValue || ''}</span>
          <span class="text-brand font-medium text-xs">要請中</span>
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
        renderPinsOnMap(DashboardState.map, DashboardState.markersLayer, DashboardState.masterPins858);
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
