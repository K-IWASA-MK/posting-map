/**
 * POSTING MAP - Branch Live Dashboard Manager (L1)
 * 
 * 責務:
 * 1. 既存API (getSystemSummary, getTier1, getFlyerStock) の軽量読み込み
 * 2. 前回取得値との差分検知 (Diff Checking)
 * 3. 変化した箇所のみを滑らかに再描画 (Micro-Animations & Flash)
 * 4. 厳格な LIVE / OFFLINE 状態表示 (偽装なし)
 * 5. 完全な Read-Only (書き込み・編集・新規業務機能ゼロ)
 */

function getApiUrl() {
  if (typeof window !== 'undefined' && window.PMS_CLIENT_CONFIG && window.PMS_CLIENT_CONFIG.api && window.PMS_CLIENT_CONFIG.api.gasWebAppUrl) {
    return window.PMS_CLIENT_CONFIG.api.gasWebAppUrl;
  }
  return "https://script.google.com/macros/s/AKfycbyjNwgZ_6CCv258lqKMrCXJYi0wDR23ZCyyzOQIV1R_WcCF5TQxYXOzZWWSJd_vMyu_/exec";
}

function getAuthToken() {
  if (typeof window === 'undefined') return '';
  const urlParams = new URLSearchParams(window.location.search);
  const tokenFromUrl = urlParams.get('token') || urlParams.get('liffToken');
  if (tokenFromUrl) return tokenFromUrl;

  return sessionStorage.getItem('liff_token') || 
         localStorage.getItem('liff_token') || 
         sessionStorage.getItem('currentStaffUser') || '';
}

// Local state for diff checking
let previousState = {
  summary: null,
  cities: null,
  stocks: null,
  lastSuccessfulSync: null
};

// Initial entry point
window.addEventListener('DOMContentLoaded', () => {
  initDashboard();
});

function initDashboard() {
  // Set branch title from SSOT config
  if (typeof window !== 'undefined' && window.PMS_CLIENT_CONFIG && window.PMS_CLIENT_CONFIG.districtName) {
    const titleEl = document.getElementById('branch-title');
    if (titleEl) titleEl.textContent = window.PMS_CLIENT_CONFIG.districtName;
  }

  // 1. Initial Immediate Fetch
  syncAllData();

  // 2. Lightweight Background Sync Loop (every 30s)
  setInterval(() => {
    syncAllData();
  }, 30000);

  // 3. Sync immediately when user switches back to this tab
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      syncAllData();
    }
  });
}

/**
 * GAS Web App との通信ヘルパー (CORS対応 POST)
 */
async function callApi(action, payload = {}) {
  const url = `${getApiUrl()}?_t=${Date.now()}`;
  const token = getAuthToken();
  const body = JSON.stringify({ 
    action, 
    liffToken: token,
    ...payload 
  });

  const response = await fetch(url, {
    method: 'POST',
    mode: 'cors',
    credentials: 'omit',
    cache: 'no-store',
    redirect: 'follow',
    body: body
  });

  if (!response.ok) {
    throw new Error(`HTTP Error: ${response.status}`);
  }

  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error("Invalid JSON response: " + text.substring(0, 50));
  }
}

/**
 * 既存APIからデータを安全かつ軽量に取得して同期する
 */
async function syncAllData() {
  try {
    // 1. Fetch System Summary, Tier 1 Municipalities, and Stocks in parallel
    const [summaryRes, tier1Res, stockRes] = await Promise.allSettled([
      callApi('getSystemSummary'),
      callApi('getTier1'),
      callApi('getFlyerStock')
    ]);

    let anySuccess = false;

    // Handle Summary
    if (summaryRes.status === 'fulfilled' && summaryRes.value && summaryRes.value.success) {
      handleSummaryUpdate(summaryRes.value);
      anySuccess = true;
    }

    // Handle Municipalities
    if (tier1Res.status === 'fulfilled' && tier1Res.value && tier1Res.value.success) {
      handleCitiesUpdate(tier1Res.value.cities || []);
      anySuccess = true;
    }

    // Handle Stocks
    if (stockRes.status === 'fulfilled' && stockRes.value && stockRes.value.success) {
      handleStockUpdate(stockRes.value.stocks || []);
      anySuccess = true;
    }

    if (anySuccess) {
      setLiveStatus(true);
    } else {
      const errReason = (!getAuthToken()) ? '認証待機中' : '接続試行中';
      setLiveStatus(false, errReason);
    }

  } catch (error) {
    console.error('[Dashboard Sync Error]', error);
    setLiveStatus(false, '同期失敗');
  }
}

/**
 * KPI Summary の差分検知と描画
 */
function handleSummaryUpdate(summaryData) {
  const prev = previousState.summary;
  const isInitial = !prev;

  const total = Number(summaryData.total) || 858;
  const done = Number(summaryData.done) || 0;
  const percent = Number(summaryData.percent) || (total > 0 ? Math.round((done / total) * 100) : 0);

  // Diff check
  const isChanged = !prev || prev.done !== done || prev.percent !== percent;

  if (isChanged) {
    animateNumber('kpi-percent', prev ? prev.percent : 0, percent, '%');
    animateNumber('kpi-done-pins', prev ? prev.done : 0, done);
    document.getElementById('kpi-total-pins').textContent = total;

    if (!isInitial) {
      flashCard('kpi-card');
    }
  }

  previousState.summary = { total, done, percent };
}

/**
 * 自治体別進捗の差分検知と描画
 */
function handleCitiesUpdate(cities) {
  const prevCities = previousState.cities;
  const listEl = document.getElementById('municipality-list');
  if (!listEl) return;

  // Check which city has changed
  let changedCity = null;

  if (prevCities) {
    for (const city of cities) {
      const old = prevCities.find(c => c.name === city.name);
      if (!old || old.done !== city.done) {
        changedCity = city;
        break;
      }
    }
  }

  // Render or Update municipality bars
  let html = '';
  cities.forEach((c, idx) => {
    const rate = c.total > 0 ? Math.round((c.done / c.total) * 100) : 0;
    const isThisCityChanged = changedCity && changedCity.name === c.name;
    const rowClass = isThisCityChanged ? 'updated-flash' : '';

    html += `
      <div id="city-row-${idx}" class="space-y-1.5 p-2 rounded-xl transition-all duration-500 ${rowClass}">
        <div class="flex justify-between items-center text-xs font-bold">
          <span class="text-white/90">${c.name}</span>
          <span class="font-mono text-white/60">
            <span class="text-emerald-400 font-bold">${c.done}</span> / ${c.total}
            <span class="text-white/40 ml-1">(${rate}%)</span>
          </span>
        </div>
        <div class="w-full h-2.5 bg-white/10 rounded-full overflow-hidden p-0.5 border border-white/5">
          <div class="h-full bg-gradient-to-r from-emerald-500 to-sky-400 rounded-full progress-bar-fill" style="width: ${rate}%;"></div>
        </div>
      </div>
    `;
  });

  listEl.innerHTML = html;
  document.getElementById('municipality-summary-count').textContent = `${cities.length} 自治体`;

  // Update JUST UPDATED card if a city changed
  if (changedCity) {
    updateJustUpdatedBanner(changedCity.name, `${changedCity.done} / ${changedCity.total} 件完了`);
  }

  previousState.cities = cities;
}

/**
 * チラシ在庫の集計と描画
 */
function handleStockUpdate(stocks) {
  const listEl = document.getElementById('stock-list');
  if (!listEl) return;

  // Group stock counts by location
  const locationMap = {};
  let totalStockCount = 0;

  stocks.forEach(s => {
    const loc = s.location || 'その他保管場所';
    const count = Number(s.count) || 0;
    locationMap[loc] = (locationMap[loc] || 0) + count;
    totalStockCount += count;
  });

  const locations = Object.keys(locationMap);
  if (locations.length === 0) {
    listEl.innerHTML = `<div class="text-xs text-white/30 font-mono py-2">保管情報なし</div>`;
    document.getElementById('total-flyer-stock').textContent = '0';
    return;
  }

  let html = '';
  locations.forEach(loc => {
    const count = locationMap[loc];
    html += `
      <div class="bg-white/5 border border-white/5 rounded-xl p-3 flex justify-between items-center">
        <span class="text-xs font-bold text-white/80">${loc}</span>
        <span class="font-mono text-xs font-black text-brand">${count.toLocaleString()} <span class="text-[10px] text-white/40 font-normal">枚</span></span>
      </div>
    `;
  });

  listEl.innerHTML = html;
  document.getElementById('total-flyer-stock').textContent = totalStockCount.toLocaleString();

  previousState.stocks = stocks;
}

/**
 * JUST UPDATED バナーの更新演出
 */
function updateJustUpdatedBanner(title, detail) {
  const card = document.getElementById('just-updated-card');
  const titleEl = document.getElementById('updated-area-text');
  const timeEl = document.getElementById('updated-time-text');

  if (titleEl) titleEl.textContent = `${title} (${detail})`;
  if (timeEl) {
    const now = new Date();
    timeEl.textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  }

  if (card) {
    card.classList.add('updated-flash');
    setTimeout(() => {
      card.classList.remove('updated-flash');
    }, 2000);
  }
}

/**
 * カードの一時発光演出
 */
function flashCard(cardId) {
  const el = document.getElementById(cardId);
  if (!el) return;
  el.classList.add('updated-flash');
  setTimeout(() => {
    el.classList.remove('updated-flash');
  }, 1500);
}

/**
 * 数字のカウントアップアニメーション
 */
function animateNumber(elementId, startVal, endVal, suffix = '') {
  const el = document.getElementById(elementId);
  if (!el) return;

  if (startVal === endVal) {
    el.innerHTML = `${endVal}${suffix ? `<span class="text-3xl sm:text-4xl text-white/60 font-bold ml-1">${suffix}</span>` : ''}`;
    return;
  }

  const duration = 1000;
  const startTime = performance.now();

  function step(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    // Ease-out expo curve
    const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
    const currentVal = Math.round(startVal + (endVal - startVal) * easeProgress);

    el.innerHTML = `${currentVal}${suffix ? `<span class="text-3xl sm:text-4xl text-white/60 font-bold ml-1">${suffix}</span>` : ''}`;

    if (progress < 1) {
      requestAnimationFrame(step);
    }
  }

  requestAnimationFrame(step);
}

/**
 * LIVE / OFFLINE 状態の厳格な更新
 */
function setLiveStatus(isOnline, errorMsg = '') {
  const dot = document.getElementById('live-dot');
  const text = document.getElementById('live-text');
  const timeEl = document.getElementById('sync-time');

  if (isOnline) {
    if (dot) {
      dot.className = 'w-2.5 h-2.5 rounded-full bg-emerald-400 glow-green animate-pulse';
    }
    if (text) {
      text.className = 'text-xs font-black tracking-widest text-emerald-400';
      text.textContent = 'LIVE';
    }
    if (timeEl) {
      const now = new Date();
      const timeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`;
      timeEl.textContent = `同期: ${timeStr}`;
    }
    previousState.lastSuccessfulSync = new Date();
  } else {
    if (dot) {
      dot.className = 'w-2.5 h-2.5 rounded-full bg-red-500 glow-red';
    }
    if (text) {
      text.className = 'text-xs font-black tracking-widest text-red-400';
      text.textContent = 'OFFLINE';
    }
    if (timeEl) {
      timeEl.textContent = errorMsg || '再接続試行中...';
    }
  }
}
