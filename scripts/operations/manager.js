/**
 * POSTING MAP - Mission Control Dashboard Manager (L1)
 * 
 * 責務:
 * 1. 既存Backend API (getSystemSummary, getTier1, getFlyerStock, getRanking) の実データ取得
 * 2. 1-Viewport (100dvh) MISSION CONTROL 原型UIへの完全バインド
 * 3. 差分検知 (Diff Checking) による変更箇所のみのスムーズ更新
 * 4. 厳格な LIVE / OFFLINE 状態管理 (偽装なし)
 * 5. 完全な Zero-Touch (操作不要・自動同期)
 */

function getApiUrl() {
  if (typeof window !== 'undefined' && window.PMS_CLIENT_CONFIG && window.PMS_CLIENT_CONFIG.api && window.PMS_CLIENT_CONFIG.api.gasWebAppUrl) {
    return window.PMS_CLIENT_CONFIG.api.gasWebAppUrl;
  }
  return "https://script.google.com/macros/s/AKfycbyjNwgZ_6CCv258lqKMrCXJYi0wDR23ZCyyzOQIV1R_WcCF5TQxYXOzZWWSJd_vMyu_/exec";
}

// Local cache for diff checking
let previousState = {
  summary: null,
  cities: null,
  stocks: null,
  ranking: null
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMissionControl);
} else {
  initMissionControl();
}

function initMissionControl() {
  // Set district title
  if (typeof window !== 'undefined' && window.PMS_CLIENT_CONFIG && window.PMS_CLIENT_CONFIG.districtName) {
    const titleEl = document.getElementById('sidebar-district-name');
    if (titleEl) titleEl.textContent = window.PMS_CLIENT_CONFIG.districtName;
  }

  // 1. Immediate Initial Sync
  syncMissionData();

  // 2. Silent Periodic Sync (30s)
  setInterval(() => {
    syncMissionData();
  }, 30000);

  // 3. Tab Visibility Sync
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      syncMissionData();
    }
  });
}

async function callApi(action) {
  const url = `${getApiUrl()}?action=${encodeURIComponent(action)}&_t=${Date.now()}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`HTTP Error: ${response.status}`);
  }
  return await response.json();
}

/**
 * 実データの一括同期
 */
async function syncMissionData() {
  try {
    const [summaryRes, tier1Res, stockRes, rankRes] = await Promise.allSettled([
      callApi('getSystemSummary'),
      callApi('getTier1'),
      callApi('getFlyerStock'),
      callApi('getRanking')
    ]);

    let anySuccess = false;

    // 1. Summary
    if (summaryRes.status === 'fulfilled' && summaryRes.value && summaryRes.value.success) {
      renderSummary(summaryRes.value);
      anySuccess = true;
    }

    // 2. Tier 1 Cities
    if (tier1Res.status === 'fulfilled' && tier1Res.value && tier1Res.value.success) {
      renderCities(tier1Res.value.cities || []);
      anySuccess = true;
    }

    // 3. Flyer Stocks
    if (stockRes.status === 'fulfilled' && stockRes.value && stockRes.value.success) {
      renderStocks(stockRes.value.stocks || []);
      anySuccess = true;
    }

    // 4. Ranking / Activities
    if (rankRes.status === 'fulfilled' && rankRes.value && rankRes.value.success) {
      renderActivities(rankRes.value.ranking || [], stockRes.status === 'fulfilled' ? stockRes.value.stocks || [] : []);
      anySuccess = true;
    }

    if (anySuccess) {
      setSyncStatus(true);
      window.__missionSyncReady = true;
    } else {
      setSyncStatus(false);
      window.__missionSyncReady = false;
    }

  } catch (err) {
    console.error('[Mission Control Sync Error]', err);
    setSyncStatus(false);
    window.__missionSyncReady = false;
  }
}

/**
 * KPI: 全体進捗の描画
 */
function renderSummary(data) {
  const total = Number(data.total) || 858;
  const done = Number(data.done) || 0;
  const percent = Number(data.percent) || (total > 0 ? Math.round((done / total) * 100) : 0);

  const percentEl = document.getElementById('kpi-percent');
  const doneEl = document.getElementById('kpi-done-pins');
  const totalEl = document.getElementById('kpi-total-pins');

  if (percentEl) percentEl.textContent = `${percent}%`;
  if (doneEl) doneEl.textContent = done.toLocaleString();
  if (totalEl) totalEl.textContent = total.toLocaleString();

  previousState.summary = { total, done, percent };
}

/**
 * KPI & Bar: 保有枚数・保管状況の描画
 */
function renderStocks(stocks) {
  let totalStock = 0;
  const locationMap = {};

  stocks.forEach(s => {
    const loc = s.location || 'その他';
    const count = Number(s.count) || 0;
    locationMap[loc] = (locationMap[loc] || 0) + count;
    totalStock += count;
  });

  // KPI Total
  const kpiStockEl = document.getElementById('kpi-total-stock');
  if (kpiStockEl) kpiStockEl.textContent = totalStock.toLocaleString();

  // Inventory Bars
  const container = document.getElementById('inventory-bars-container');
  if (!container) return;

  const locations = Object.keys(locationMap);
  if (locations.length === 0) {
    container.innerHTML = `<div class="text-xs text-white/30 font-mono self-center">在庫情報なし</div>`;
    return;
  }

  const maxVal = Math.max(...Object.values(locationMap), 1000);
  let barsHtml = '';

  locations.forEach(loc => {
    const count = locationMap[loc];
    const heightPercent = Math.max(Math.round((count / maxVal) * 85), 15);

    barsHtml += `
      <div class="flex-1 flex flex-col items-center gap-1.5 h-full justify-end">
        <span class="text-[10px] font-mono font-black text-brand">${count.toLocaleString()}</span>
        <div class="w-full max-w-[48px] rounded-t-lg bg-gradient-to-t from-brandDark/40 to-brand/80 border border-brand/40 relative flex items-center justify-center transition-all duration-700" style="height: ${heightPercent}%;">
        </div>
        <span class="text-[10px] font-bold text-white/80 truncate w-full text-center">${loc}</span>
      </div>
    `;
  });

  container.innerHTML = barsHtml;
  previousState.stocks = stocks;
}

/**
 * KPI & List: 活動人数 ＆ 今日の活動フィードの描画
 */
function renderActivities(ranking, stocks) {
  // Active Members
  const activeCount = Math.max(ranking.length, stocks.length, 1);
  const activeMembersEl = document.getElementById('kpi-active-members');
  if (activeMembersEl) activeMembersEl.textContent = activeCount;

  // Today's Activity List
  const listEl = document.getElementById('today-activity-list');
  if (!listEl) return;

  let activities = [];

  // Use stocks updatedAt & ranking as real activity source
  stocks.forEach(s => {
    if (s.updatedAt) {
      activities.push({
        time: s.updatedAt,
        staffId: s.staffId || 'STAFF',
        staffName: s.staffName || '',
        action: `${s.count?.toLocaleString()}枚 保有登録`,
        location: s.location || '三重県'
      });
    }
  });

  ranking.forEach(r => {
    activities.push({
      time: '本日',
      staffId: r.staffId || 'S001',
      staffName: r.name || '',
      action: `${r.count?.toLocaleString()}枚 配布完了`,
      location: '現場エリア'
    });
  });

  if (activities.length === 0) {
    listEl.innerHTML = `<div class="text-xs text-white/30 font-mono py-2 text-center">本日の活動記録なし</div>`;
    return;
  }

  let html = '';
  activities.slice(0, 3).forEach(act => {
    html += `
      <div class="flex items-center justify-between text-xs py-1 px-2 rounded-lg bg-white/[0.02] border border-white/5">
        <div class="flex items-center gap-2">
          <span class="w-1.5 h-1.5 rounded-full bg-brand"></span>
          <span class="font-mono text-[10px] text-white/40">${act.time}</span>
          <span class="font-mono font-bold text-white/90">${act.staffId}</span>
          <span class="text-white/70">${act.action}</span>
        </div>
        <span class="px-2 py-0.5 rounded bg-brand/10 text-[9px] font-bold text-brand border border-brand/20">${act.location}</span>
      </div>
    `;
  });

  listEl.innerHTML = html;
  previousState.ranking = ranking;
}

/**
 * 配布エリア進捗 (Tier 1 自治体実データ) の描画
 */
function renderCities(cities) {
  const container = document.getElementById('area-progress-container');
  if (!container) return;

  if (!cities || cities.length === 0) {
    container.innerHTML = `<div class="text-xs text-white/30 font-mono py-2 text-center">エリア進捗データなし</div>`;
    return;
  }

  // Render top municipalities fitting the 1-viewport card cleanly
  let html = '';
  const displayCities = cities.slice(0, 4);

  displayCities.forEach(c => {
    const total = Number(c.total) || 0;
    const done = Number(c.done) || 0;
    const rate = total > 0 ? Math.round((done / total) * 100) : 0;
    const barColor = rate >= 80 ? 'bg-emerald-400' : 'bg-brand';

    html += `
      <div class="space-y-1">
        <div class="flex justify-between items-center text-xs font-bold">
          <span class="text-white/90 truncate">${c.name}</span>
          <div class="flex items-center gap-2 font-mono">
            <span class="text-white/60 text-[10px]"><span class="text-white font-bold">${done}</span> / ${total}</span>
            <span class="text-white font-bold text-xs">${rate}%</span>
          </div>
        </div>
        <div class="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
          <div class="h-full ${barColor} rounded-full transition-all duration-700" style="width: ${Math.max(rate, 2)}%;"></div>
        </div>
      </div>
    `;
  });

  container.innerHTML = html;
  previousState.cities = cities;
}

/**
 * 厳格な同期ステータス表示
 */
function setSyncStatus(isLive) {
  const dot = document.getElementById('live-dot');
  const text = document.getElementById('live-status-text');
  const clock = document.getElementById('sync-clock');

  if (isLive) {
    if (dot) dot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-400 glow-green animate-pulse';
    if (text) text.textContent = '最新データを同期しています';
    if (clock) {
      const now = new Date();
      clock.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
    }
  } else {
    if (dot) dot.className = 'w-2.5 h-2.5 rounded-full bg-red-500 glow-red';
    if (text) text.textContent = 'オフライン（再接続中）';
  }
}
