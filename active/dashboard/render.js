// 住所から郵便番号(〒000-0000およびその後の改行/スペース)を除去したクリーンな住所を返す
function getCleanAddress(addr) {
  if (!addr) return '';
  return addr.replace(/^〒\d{3}-\d{4}\s*/, '');
}

function formatCompletedAt(dateStr) {
  if (!dateStr) return '';
  if (/^\d{2}\/\d{2} \d{2}:\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) {
    return dateStr;
  }
  const MM = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const HH = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${MM}/${dd} ${HH}:${mm}`;
}

const CITY_ORDER = { '桑名市': 1, 'いなべ市': 2, '桑名郡': 3, '員弁郡': 4, '三重郡': 5, '四日市市': 6 };

function getCityName(areaName) {
  if (!areaName) return 'その他';
  // 注意: 以下のハードコードは「四日市(市)」のようにエリア名に「市」が含まれる特殊ケースへの対処。
  // 正規表現 /^[^市町...]/ では「四日市」と不完全にマッチするため意図的に残している。
  if (areaName.startsWith('四日市')) return '四日市市';
  if (areaName.startsWith('鈴鹿')) return '鈴鹿市';
  if (areaName.startsWith('亀山')) return '亀山市';
  const match = areaName.match(/^[^市町郡区\(\d]+(?:市|町|郡|区)/);
  if (match) return match[0];
  return areaName + '市';
}

function renderAreas() {
  if (!areaSummary || areaSummary.length === 0) {
    $('area-list').innerHTML = `
      <div class="premium-glass p-8 text-center space-y-4 mx-4 my-10 border border-white/10 rounded-3xl bg-white/5 backdrop-blur-2xl">
        <p class="text-base font-black text-white">エリアデータが設定されていません</p>
        <p class="text-xs text-white/50 leading-relaxed">管理者のセットアップをお待ちください。</p>
      </div>`;
    return;
  }

  if (currentCity === null) {
    // 【第1層：市・自治体一覧画面】
    const cityMap = {};
    areaSummary.forEach(s => {
      const cityName = getCityName(s.name);
      if (!cityMap[cityName]) {
        cityMap[cityName] = { name: cityName, done: 0, total: 0 };
      }
      cityMap[cityName].done += s.done || 0;
      cityMap[cityName].total += s.total || 0;
    });

    const cities = Object.values(cityMap).map(c => {
      c.progress = c.total > 0 ? Math.round((c.done / c.total) * 100) : 0;
      return c;
    });

    cities.sort((a, b) => {
      const orderA = CITY_ORDER[a.name] || 99;
      const orderB = CITY_ORDER[b.name] || 99;
      if (orderA !== orderB) return orderA - orderB;
      return a.name.localeCompare(b.name);
    });

    const headerCardHtml = `
      <div style="border: 1px solid rgba(37, 99, 235, 0.35); box-shadow: inset 0 0 15px rgba(37, 99, 235, 0.08), 0 0 25px rgba(37, 99, 235, 0.12);" class="premium-glass py-5 px-6 flex flex-col items-center justify-center text-center gap-2 mb-6">
        <div class="w-8 h-8 rounded-xl bg-[#2563eb]/10 border border-[#2563eb]/20 flex items-center justify-center shadow-lg shadow-[#2563eb]/10 mb-0.5">
          <svg class="w-4 h-4 text-[#2563eb]" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
          </svg>
        </div>
        <div class="text-lg font-black text-white tracking-tight">全体エリア</div>
      </div>
    `;

    const cityCardsHtml = cities.map(c => renderCityListItem(c)).join('');

    // 1層目の最下部にスムーズスクロールで上部に戻る「↑ トップに戻る」ボタンを追加
    const bottomTopButtonHtml = `
      <div class="flex items-center justify-center mt-8 pb-10">
        <button onclick="$('content').scrollTo({top: 0, behavior: 'smooth'})" class="px-6 h-12 premium-glass-btn flex items-center justify-center text-xs font-bold uppercase tracking-wider text-white/80">↑ トップに戻る</button>
      </div>
    `;

    $('area-list').innerHTML = headerCardHtml + `<div class="space-y-6">${cityCardsHtml}</div>` + bottomTopButtonHtml;
  } else {
    // 【第2層：選択された市のエリアシート一覧画面】
    const filteredAreas = areaSummary.filter(s => getCityName(s.name) === currentCity);

    const backButtonHtml = `
      <div class="flex items-center mb-6 h-12">
        <button onclick="backToCityList()" class="w-12 h-12 premium-glass-btn flex items-center justify-center text-xl font-bold">‹</button>
      </div>
    `;

    const areaCardsHtml = filteredAreas.map(s => renderAreaListItem(s)).join('');

    // 2層目の最下部ナビゲーション（戻る ‹ / ↑ トップに戻る）
    const bottomNavHtml = filteredAreas.length > 3 ? `
      <div class="flex items-center justify-between mt-8 pb-10 w-full gap-4">
        <button onclick="backToCityList()" class="w-12 h-12 premium-glass-btn flex items-center justify-center text-xl font-bold">‹</button>
        <button onclick="$('content').scrollTo({top: 0, behavior: 'smooth'})" class="flex-1 h-12 premium-glass-btn flex items-center justify-center text-xs font-bold uppercase tracking-wider text-white/80">↑ トップに戻る</button>
        <div class="w-12 h-12"></div>
      </div>
    ` : `
      <div class="flex items-center justify-start mt-8 pb-10">
        <button onclick="backToCityList()" class="w-12 h-12 premium-glass-btn flex items-center justify-center text-xl font-bold">‹</button>
      </div>
    `;

    $('area-list').innerHTML = backButtonHtml + `<div class="space-y-6">${areaCardsHtml}</div>` + bottomNavHtml;
  }
}

function selectCity(cityName) {
  currentCity = cityName;
  renderAreas();
  const contentEl = $('content');
  if (contentEl) contentEl.scrollTop = 0;

  // 市区町村全体の詳細データをバックグラウンドで先読み開始
  if (window.currentCityDetailsName !== cityName) {
    window.cityAreaCache = {}; // キャッシュリセット
    window.currentCityDetailsName = cityName;
    window.activeCityDetailsPromise = callApi('getCityAreaDetails', { cityName: cityName })
      .then(data => {
        if (data && data.success) {
          window.cityAreaCache = data.details || {};
        }
        return data;
      })
      .catch(err => {
        console.error("Background prefetch failed:", err);
        return null;
      });
  }
}

// Open point detail modal
function openPointDetailModal(rowId) {
  const p = allPoints.find(point => point.rowId === rowId);
  if (!p) return;

  window.currentPointDetailRowId = rowId;
  const modalContent = $('detail-modal-content');
  if (modalContent) {
    modalContent.innerHTML = renderDetailModalContent(p);
    modalContent.scrollTop = 0; // スクロール位置を確実に一番上へリセット
  }

  const modal = $('detail-modal');
  modal.classList.remove('pointer-events-none', 'opacity-0');
  modal.firstElementChild.classList.remove('translate-y-full');
}

// Close point detail modal
function closeDetailModal() {
  const modal = $('detail-modal');
  if (!modal) return;
  modal.classList.add('opacity-0', 'pointer-events-none');
  modal.firstElementChild.classList.add('translate-y-full');
  window.currentPointDetailRowId = null;
}

// Render single point detail modal contents
function renderDetailModalContent(p) {
  const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
  const myId = userInfo.id || '';
  const myName = `${userInfo.last || ''} ${userInfo.first || ''}`.trim();
  
  // 他人の完了実績か判定
  const isOtherStaff = p.isDone && (
    (p.staffId && p.staffId !== myId) ||
    (!p.staffId && p.staffName && p.staffName !== myName)
  );

  // 配布完了時は編集ロック
  const isLocked = p.isDone;

  // GPS接続バッジ
  let gpsBadgeHtml = '';
  if (p.isDone) {
    if (p.gps) {
      gpsBadgeHtml = `
        <!-- 【GPSあり】横幅いっぱいの青色カード型 (PHOTO VERIFIED と完全同一スタイル) -->
        <div style="background: rgba(37, 99, 235, 0.05); border: 1.5px solid rgba(37, 99, 235, 0.4); box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.15), 0 0 30px rgba(37, 99, 235, 0.05);" class="w-full rounded-2xl py-4 px-5 flex flex-col items-center justify-center">
          <div class="flex items-center justify-center gap-2 w-full">
            <span class="text-sm">📍</span>
            <span class="text-[10px] font-black text-[#2563eb] uppercase tracking-[0.2em]">GPS VERIFIED</span>
          </div>
        </div>
      `;
    } else {
      gpsBadgeHtml = `
        <!-- 【GPSなし】横幅いっぱいのカード型 -->
        <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08);" class="w-full rounded-2xl py-4 px-5 flex flex-col items-center justify-center">
          <div class="flex items-center justify-center gap-2 w-full">
            <span class="text-sm opacity-30">📍</span>
            <span class="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">NO GPS DATA</span>
          </div>
        </div>
      `;
    }
  }

  // 非同期送信ステータスバッジ (要件8: PENDING / SYNCING / COMPLETE / RETRYING...)
  let syncLabelHtml = '';
  if (p.isDone) {
    const s = p.syncStatus;
    if (s === 'SYNCING' || s === 'sending') {
      syncLabelHtml = `<span class="text-[8px] font-black text-[#2563eb] animate-pulse tracking-widest bg-[#2563eb]/10 px-2 py-0.5 rounded-full ml-auto">FIELD DATA SYNCING...</span>`;
    } else if (s === 'RETRY' || s === 'failed') {
      syncLabelHtml = `<span class="text-[8px] font-black text-red-500 animate-pulse tracking-widest bg-red-500/10 px-2 py-0.5 rounded-full ml-auto">UPLOAD RETRYING...</span>`;
    } else if (s === 'PENDING' || s === 'pending') {
      syncLabelHtml = `<span class="text-[8px] font-black text-white/40 animate-pulse tracking-widest bg-white/5 px-2 py-0.5 rounded-full ml-auto">SYNC PENDING...</span>`;
    }
  }

  // 🔒アイコン
  const lockIconHtml = isLocked ? `<span class="text-xs mr-1">🔒</span>` : '';

  // 写真表示・追加・変更ブロック
  const photoId = p.photoUrl || '';
  const tempUrl = p.tempPhotoUrl || '';
  let photoBlockHtml = '';
  if (p.isDone) {
    if (tempUrl) {
      photoBlockHtml = `
        <div class="relative w-full h-40 rounded-2xl overflow-hidden border border-white/10 bg-white/5 flex items-center justify-center">
          <img src="${tempUrl}" class="w-full h-full object-cover">
        </div>
      `;
    } else if (photoId) {
      photoBlockHtml = `
        <!-- 【写真あり】青色（#2563eb）テーマの写真確認カード (コンパクト化・ボタン廃止・外枠青色化) -->
        <div style="background: rgba(37, 99, 235, 0.05); border: 1.5px solid rgba(37, 99, 235, 0.4); box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.15), 0 0 30px rgba(37, 99, 235, 0.05);" class="w-full rounded-2xl py-4 px-5 flex flex-col items-center justify-center">
          <div class="flex items-center justify-center gap-2 w-full">
            <span class="text-sm">📸</span>
            <span class="text-[10px] font-black text-[#2563eb] uppercase tracking-[0.2em]">PHOTO VERIFIED</span>
          </div>
        </div>
      `;
    } else {
      photoBlockHtml = `
        <!-- 【写真なし】「写真を追加」ボタンを排除し、証跡なし状態のみをシンプルに表示 -->
        <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08);" class="w-full rounded-2xl py-4 px-5 flex flex-col items-center justify-center">
          <div class="flex items-center justify-center gap-2 w-full">
            <span class="text-sm opacity-30">📸</span>
            <span class="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">NO EVIDENCE PHOTO</span>
          </div>
        </div>
      `;
    }
  }

  // ロック状態によるスタイル分岐
  const cardClasses = isOtherStaff
    ? "rounded-3xl p-5 flex items-center gap-5 bg-white/[0.01] border border-white/[0.03]"
    : "rounded-3xl p-5 flex items-center gap-5 bg-white/5 border border-white/10";
  
  const labelStyle = !isOtherStaff && p.isDone
    ? 'background: rgba(16,185,129,0.05); border: 1px solid rgba(16,185,129,0.2);'
    : '';

  const areaName = window.currentCityDetailAreaName || '';

  const cleanAddr = getCleanAddress(p.address);
  // 住所の文字数に応じてフォントサイズを自動調整（折り返し・はみ出し防止）
  let addrFontSizeClass = 'text-lg';
  if (cleanAddr.length > 16) {
    addrFontSizeClass = 'text-sm';
  } else if (cleanAddr.length > 10) {
    addrFontSizeClass = 'text-base';
  }

  // 完了済み(p.isDone)の場合はGoogle Mapsボタンを非表示にする
  const googleMapsButtonHtml = !p.isDone ? `
    <!-- 2行目: 横幅いっぱいのGoogle Mapsボタン -->
    <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cleanAddr)}" target="_blank" style="background: rgba(37, 99, 235, 0.08); border: 1px solid rgba(37, 99, 235, 0.25); color: #2563eb; box-shadow: inset 0 1px 0 rgba(255,255,255,0.1), inset 0 0 6px rgba(37,99,235,0.1), 0 0 12px rgba(37,99,235,0.05); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);" class="w-full h-12 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest rounded-2xl active:scale-[0.97] transition-all">
      📍 Googleマップで開く
    </a>
  ` : '';

  return `
    <!-- 1行目: 住所バッジ（中央寄せ） -->
    <div class="w-full flex flex-col items-center gap-3">
      <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); height: 26px; font-size: 12px; color: rgba(255, 255, 255, 0.9);" class="inline-flex items-center px-3 font-bold rounded-full tracking-wide truncate max-w-full select-text">
        🏠 ${cleanAddr}
      </div>
      ${p.memo ? `<div class="text-xs text-white/50 bg-white/5 rounded-xl p-3 border border-white/5 select-text w-full text-center mt-1">${p.memo}</div>` : ''}
    </div>
    
    ${googleMapsButtonHtml}
    
    <div class="flex flex-col gap-4">
      ${!p.isDone ? `
        <!-- 【未完了】全体がタップ可能な極上シンメトリーカード -->
        <label ontouchstart="" class="cursor-pointer rounded-3xl py-6 px-5 bg-white/5 border border-white/10 flex flex-col items-center justify-center gap-4 w-full">
          <input type="checkbox" class="hidden" onchange="toggleDone('${areaName}', ${p.rowId}, this)">
          
          <!-- 1. テキスト（中央揃え） -->
          <div class="flex flex-col items-center select-none text-center">
            <span class="text-[10px] font-black uppercase tracking-[0.2em] text-white/60">READY TO DEPLOY</span>
            <span class="text-xs font-bold text-white/40 mt-1 tracking-wider">タップで配布完了</span>
          </div>

          <!-- 2. チェックボックス（押した瞬間だけ沈み込む） -->
          <div ontouchstart="" style="border-color: #10b981; background-color: #10b981; box-shadow: 0 0 10px rgba(16,185,129,0.4); transition: transform 75ms ease-out, box-shadow 75ms ease-out, filter 75ms ease-out;" class="w-12 h-12 rounded-2xl border flex items-center justify-center select-none"
            onpointerdown="this.style.transform='scale(0.82)'; this.style.boxShadow='0 0 4px rgba(16,185,129,0.2)'; this.style.filter='brightness(0.85)'"
            onpointerup="this.style.transform=''; this.style.boxShadow='0 0 10px rgba(16,185,129,0.4)'; this.style.filter=''"
            onpointerleave="this.style.transform=''; this.style.boxShadow='0 0 10px rgba(16,185,129,0.4)'; this.style.filter=''">
            <svg class="w-6 h-6 text-white" fill="none" stroke="currentColor" stroke-width="4" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"/>
            </svg>
          </div>
        </label>
      ` : `
        <!-- 【完了済み】編集ロックがかかった上品なグリーンステータス表示 -->
        <div style="background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.2); box-shadow: inset 0 0 0 1px rgba(16, 185, 129, 0.1), 0 0 30px rgba(16, 185, 129, 0.05);" class="w-full rounded-3xl py-6 px-5 flex flex-col items-center justify-center gap-4">
          
          <!-- 1. テキスト（中央揃え） -->
          <div class="flex flex-col items-center select-none text-center">
            <div class="flex items-center justify-center gap-1.5">
              <span class="text-xs">🔒</span>
              <span class="text-[10px] font-black uppercase tracking-widest text-[#10b981]">MISSION COMPLETED</span>
            </div>
            <span class="text-xs font-bold text-white/80 mt-1">${p.completedAt ? `${formatCompletedAt(p.completedAt)}${p.staffName ? ` · ${p.staffName}` : ''}` : ''}</span>
          </div>
          
          ${syncLabelHtml ? `<div class="w-full flex justify-center mt-1">${syncLabelHtml.replace('ml-auto', '')}</div>` : ''}
        </div>
      `}

      ${p.isDone ? `
        ${gpsBadgeHtml}
        
        ${photoBlockHtml}

        <!-- 【配布数】上2つの証拠カードと枠サイズ・デザイン・青色テーマを完全統一 -->
        <div style="background: rgba(37, 99, 235, 0.05); border: 1.5px solid rgba(37, 99, 235, 0.4); box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.15), 0 0 30px rgba(37, 99, 235, 0.05);" class="w-full rounded-2xl py-4 px-5 flex flex-col items-center justify-center">
          <div class="text-3xl font-black text-[#2563eb] text-center tracking-tight">
            配布数 ${p.count || 0}枚
          </div>
          ${!isLocked ? `
            <button onclick="openNumpad('${areaName}', ${p.rowId}, ${p.count || 0})" class="w-full py-3 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-white/80 active:scale-95 transition-all mt-2">枚数変更</button>
          ` : ''}
        </div>

        <!-- 4行目: この内容で提出する（閉じる）ボタン -->
        <button ontouchstart="" onclick="closeDetailModal()" style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); color: #10b981; box-shadow: inset 0 1px 0 rgba(255,255,255,0.1), inset 0 0 6px rgba(16,185,129,0.1), 0 0 12px rgba(16,185,129,0.05); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);" class="w-full h-12 flex items-center justify-center gap-2 text-xs font-black uppercase tracking-widest rounded-2xl active:scale-95 active:translate-y-[2px] transition-all duration-75 mt-2">
          ✅ この内容で提出する（閉じる）
        </button>
      ` : ''}
    </div>
  `;
}

// Render the entire details list using global allPoints (1-line simple card)
function renderDetailList(areaName) {
  const cardsHtml = allPoints.map((p, i) => {
    return renderPointCard(p);
  }).join('');

  // 同一市区町村内の隣接エリアへの切り替えナビゲーションを追加
  const activeCity = currentCity || getCityName(areaName);
  const cityAreas = areaSummary ? areaSummary.filter(s => getCityName(s.name) === activeCity) : [];
  const currentIndex = cityAreas.findIndex(s => s.name === areaName);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex !== -1 && currentIndex < cityAreas.length - 1;

  const bottomNavHtml = `
    <div class="flex items-center justify-between mt-8 pb-10 w-full gap-4">
      <button onclick="navigateToSiblingArea(-1)" class="w-12 h-12 premium-glass-btn flex items-center justify-center text-xl font-bold ${hasPrev ? '' : 'opacity-20 pointer-events-none'}" ${hasPrev ? '' : 'disabled'}>‹</button>
      
      <button onclick="switchPage('areas')" class="flex-1 h-12 premium-glass-btn flex items-center justify-center text-xs font-bold uppercase tracking-wider text-white/80">一覧に戻る</button>
      
      <button onclick="navigateToSiblingArea(1)" class="w-12 h-12 premium-glass-btn flex items-center justify-center text-xl font-bold ${hasNext ? '' : 'opacity-20 pointer-events-none'}" ${hasNext ? '' : 'disabled'}>›</button>
    </div>
  `;

  $('detail-list').innerHTML = `<div class="space-y-4">${cardsHtml}</div>` + bottomNavHtml;
}

// 隣のエリアへの切り替えを実行する関数
function navigateToSiblingArea(direction) {
  if (!window.currentCityDetailAreaName || !areaSummary || areaSummary.length === 0) return;
  const activeCity = currentCity || getCityName(window.currentCityDetailAreaName);
  const cityAreas = areaSummary.filter(s => getCityName(s.name) === activeCity);
  const currentIndex = cityAreas.findIndex(s => s.name === window.currentCityDetailAreaName);
  if (currentIndex === -1) return;
  
  const targetIndex = currentIndex + direction;
  if (targetIndex >= 0 && targetIndex < cityAreas.length) {
    const targetAreaName = cityAreas[targetIndex].name;
    openDetail(targetAreaName);
  }
}

async function openDetail(name) {
  // openDetail() で開かれたエリアを localStorage の assigned_area に自動記録
  localStorage.setItem('assigned_area', name);

  // 1. 同一エリアへの再タップ: メモリキャッシュを使って即時描画
  if (window.currentCityDetailAreaName === name && allPoints && allPoints.length > 0) {
    if (typeof scrollPositions !== 'undefined') scrollPositions['detail'] = 0;
    const contentEl = $('content');
    if (contentEl) contentEl.scrollTop = 0;
    renderDetailList(name);
    switchPage('detail');
    return;
  }

  // 2. メモリキャッシュの確認（改善④）
  if (window.cityAreaCache && window.cityAreaCache[name]) {
    window.currentCityDetailAreaName = name;
    allPoints = window.cityAreaCache[name];
    if (typeof scrollPositions !== 'undefined') {
      scrollPositions['detail'] = 0;
    }
    const contentEl = $('content');
    if (contentEl) contentEl.scrollTop = 0;
    renderDetailList(name);
    switchPage('detail');
    return;
  }

  // 3. フォールバック: キャッシュ未取得の場合
  $('loading').classList.remove('hidden');
  $('loading').classList.remove('opacity-0');
  
  await new Promise(r => setTimeout(r, 50));
  
  try {
    // 実行中の先読みPromiseがあればそれを待つ
    if (window.activeCityDetailsPromise) {
      const data = await window.activeCityDetailsPromise;
      if (data && data.success && data.details && data.details[name]) {
        window.cityAreaCache = data.details;
        window.currentCityDetailAreaName = name;
        allPoints = data.details[name];
        renderDetailList(name);
        
        if (typeof scrollPositions !== 'undefined') scrollPositions['detail'] = 0;
        const contentEl = $('content');
        if (contentEl) contentEl.scrollTop = 0;
        
        switchPage('detail');
        $('loading').classList.add('opacity-0');
        setTimeout(() => $('loading').classList.add('hidden'), 700);
        return;
      }
    }

    // 先読みPromiseがない、または取得に失敗した場合は個別取得を実行
    const data = await callApi('getAreaDetails', { name: name });
    if (data && data.points) {
      window.currentCityDetailAreaName = name;
      allPoints = data.points;
      
      if (!window.cityAreaCache) window.cityAreaCache = {};
      window.cityAreaCache[name] = data.points;
      
      renderDetailList(name);
      if (typeof scrollPositions !== 'undefined') scrollPositions['detail'] = 0;
      const contentEl = $('content');
      if (contentEl) contentEl.scrollTop = 0;
      switchPage('detail');
    }
  } catch (e) {
    // alert()はLINE WebViewで不安定なためDOM表示に切り替え
    const detailList = $('detail-list');
    if (detailList) {
      detailList.innerHTML = `
        <div style="border: 1px solid rgba(255,255,255,0.04);" class="premium-glass p-8 flex flex-col items-center justify-center text-center gap-3 mt-8">
          <span class="text-2xl">⚠️</span>
          <p class="text-sm font-black text-white/60">データの取得に失敗しました</p>
          <p class="text-[10px] font-bold text-white/30 uppercase tracking-wider">時間をおいて再度お試しください</p>
        </div>`;
    }
    switchPage('detail');
  }
  
  $('loading').classList.add('opacity-0');
  setTimeout(() => $('loading').classList.add('hidden'), 700);
}

function toggleDone(areaName, rowId, checkbox) {
  const p = allPoints.find(point => point.rowId === rowId);
  if (!p) return;
  
  if (checkbox.checked) {
    // Open numpad modal
    openNumpad(areaName, rowId, p.count || 0, true, checkbox);
  } else {
    // 誤操作防止の削除確認ダイアログ
    if (!confirm("完了実績をキャンセルしますか？\n入力された配布枚数もクリアされます。")) {
      checkbox.checked = true; // キャンセルされたらチェック状態を元に戻す
      return;
    }
    
    // Directly clear completion and count
    p.isDone = false;
    p.count = 0;
    p.completedAt = '';
    p.staffName = '';
    delete p.syncStatus;
    delete p.tempPhotoUrl;
    
    // Update local card list
    renderDetailList(areaName);
    
    // Update active modal content
    const modalContent = $('detail-modal-content');
    if (modalContent) {
      modalContent.innerHTML = renderDetailModalContent(p);
    }
    
    // Send update to server
    updateRecord(areaName, rowId, false, 0);
  }
}

function renderSettings() {
  const userInfo = JSON.parse(localStorage.getItem('user_info'));
  const container = $('settings-content');
  
  if (!userInfo) {
    // サーチ画面から1.5秒で確実にID画面へ移行する仕様のため、中途半端なスピナーや登録画面等の中間表示は一切行わない
    container.innerHTML = '';
    return;
  }

  // If editing mode is active
  if (window.isEditingProfile) {
    container.innerHTML = `
      <div class="flex flex-col items-center justify-center -mt-10 pb-12 px-4">
        <div class="mb-8 text-center">
          <p class="text-sm text-white/70 leading-relaxed font-bold">
            名前を編集してください
          </p>
        </div>
        <div class="w-full premium-glass p-8 space-y-8 text-left">
          <div class="space-y-4">
            <div>
              <label style="color: rgba(255,255,255,0.72);" class="text-[11px] font-black uppercase tracking-[0.2em] mb-2 block text-center">苗字</label>
              <input type="text" id="user-last" value="${userInfo.last || ''}" style="background: #ffffff; border: 1px solid rgba(0, 0, 0, 0.15); color: #000000;" class="w-full rounded-2xl py-6 px-7 text-lg font-black text-left outline-none focus:border-[#2563eb] transition-all shadow-xl placeholder-gray-400" placeholder="例：鈴木">
            </div>
            <div>
              <label style="color: rgba(255,255,255,0.72);" class="text-[11px] font-black uppercase tracking-[0.2em] mb-2 block text-center">名前</label>
              <input type="text" id="user-first" value="${userInfo.first || ''}" style="background: #ffffff; border: 1px solid rgba(0, 0, 0, 0.15); color: #000000;" class="w-full rounded-2xl py-6 px-7 text-lg font-black text-left outline-none focus:border-[#2563eb] transition-all shadow-xl placeholder-gray-400" placeholder="例：一郎">
            </div>
          </div>
          
          <div class="pt-2 flex gap-4">
            <button onclick="window.cancelEditingProfile()" class="w-1/2 bg-white/5 border border-white/10 text-white rounded-2xl py-4 text-base font-bold shadow-xl transition-all">キャンセル</button>
            <button onclick="saveProfile()" class="w-1/2 bg-[#00B7FF] text-white rounded-2xl py-4 text-base font-black shadow-xl transition-all">保存する</button>
          </div>
        </div>
      </div>
    `;
    return;
  }

  // Normal view mode: Show ID card + assigned area shortcut + edit name button
  const rawBranch = localStorage.getItem('branch_name') || '';
  const displayBranch = rawBranch ? (rawBranch.includes('支部') ? rawBranch : `${rawBranch} 支部`) : 'MIE-03 支部';
  
  // Format sync time
  const lastSyncTime = localStorage.getItem('__last_sync_time__') || '--:--';
  const regDate = userInfo.registrationDate || '2025/07/01';

  // Find assigned area info
  let assignedAreaData = null;
  const assignedAreaName = localStorage.getItem('assigned_area');
  if (assignedAreaName && areaSummary) {
    assignedAreaData = areaSummary.find(s => s.name === assignedAreaName);
  }

  const staffCardHtml = renderStaffCard(userInfo, {
    branchName: displayBranch,
    lastSyncTime: lastSyncTime,
    registrationDate: regDate
  });

  const areaCardHtml = assignedAreaData ? renderAreaCard(assignedAreaData) : '';

  container.innerHTML = `
    <div class="space-y-6 flex flex-col items-center">
      <div class="w-full">${staffCardHtml}</div>
      ${areaCardHtml ? `<div class="w-full flex justify-center">${areaCardHtml}</div>` : ''}
      
      <div class="w-full max-w-sm px-4 pt-4 space-y-4">
        <button onclick="window.startEditingProfile()" class="w-full h-12 rounded-2xl bg-white/5 border border-white/10 text-white text-xs font-bold hover:bg-white/10 transition-colors">
          👤 プロフィール名前編集
        </button>
      </div>
    </div>
  `;
}

// Publish helper functions to window
window.startEditingProfile = function() {
  window.isEditingProfile = true;
  renderSettings();
};
window.cancelEditingProfile = function() {
  window.isEditingProfile = false;
  renderSettings();
};

window.switchToAssignedArea = function() {
  const assignedAreaName = localStorage.getItem('assigned_area');
  if (assignedAreaName) {
    openDetail(assignedAreaName);
  }
};

function renderRanking() {
  const container = $('ranking-list');
  if (!container) return;

  const headerCardHtml = `
    <div style="border: 1px solid rgba(37, 99, 235, 0.35); box-shadow: inset 0 0 15px rgba(37,99,235,0.08), 0 0 25px rgba(37,99,235,0.12);" class="premium-glass py-5 px-6 flex flex-col items-center justify-center text-center gap-2 mb-6">
      <div class="w-8 h-8 rounded-xl bg-[#2563eb]/10 border border-[#2563eb]/20 flex items-center justify-center shadow-lg shadow-[#2563eb]/10 mb-0.5">
        <svg class="w-4 h-4 text-[#2563eb]" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 14.25c3.976 0 7.25-3.274 7.25-7.25V4.75a.75.75 0 00-.75-.75H5.5a.75.75 0 00-.75.75V7c0 3.976 3.274 7.25 7.25 7.25zM12 14.25v4.5m-3 0h6m-9-11.25H4.25A1.25 1.25 0 003 8.75V9.5c0 1.657 1.343 3 3 3h.25M18 7.5h1.75A1.25 1.25 0 0121 8.75V9.5c0 1.657-1.343 3-3 3h-.25" />
        </svg>
      </div>
      <div class="text-lg font-black text-white tracking-tight">配布ランキング</div>
    </div>
  `;

  const userInfo = JSON.parse(localStorage.getItem('user_info'));
  const myName = userInfo ? (userInfo.last + " " + (userInfo.first || "")).trim() : "";

  // APIから取得した実データを優先的に使用
  const displayRanking = (typeof rankingData !== 'undefined' && rankingData) ? rankingData : [];

  if (displayRanking.length === 0) {
    container.innerHTML = headerCardHtml + `
      <div style="border: 1px solid rgba(255, 255, 255, 0.04);" class="premium-glass p-8 flex flex-col items-center justify-center text-center gap-3">
        <span class="text-3xl">🏆</span>
        <div class="text-sm font-black text-white/80">まだ配布ランキングがありません</div>
        <p class="text-[10px] text-white/40 font-bold leading-relaxed uppercase tracking-wider">
          ポスティング完了が記録されると<br>
          ここにランキングが表示されます
        </p>
      </div>
    `;
    return;
  }

  const rankingContentHtml = renderRankingCard(displayRanking, myName);
  container.innerHTML = headerCardHtml + rankingContentHtml;
}

// チラシ保管状況の描画処理
function renderStorageList(stocks) {
  const container = $('storage-list-container');
  if (!container) return;

  // テスト用データを除外
  if (stocks && stocks.length > 0) {
    stocks = stocks.filter(s => {
      const name = s.staffName || '';
      const id = s.staffId || '';
      return !name.includes('テスト') && !id.toUpperCase().includes('TEST');
    });
  }

  if (!stocks || stocks.length === 0) {
    container.innerHTML = `
      <div style="border: 1px solid rgba(255,255,255,0.04);" class="premium-glass p-8 flex flex-col items-center justify-center text-center gap-3">
        <span class="text-2xl">📦</span>
        <p class="text-sm font-black text-white/60">現在、保管されているチラシはありません</p>
      </div>`;
    return;
  }

  // 保管場所ごとにグループ化
  const groups = {};
  stocks.forEach(s => {
    const loc = s.location || 'その他';
    if (!groups[loc]) groups[loc] = [];
    groups[loc].push(s);
  });

  const sortedLocations = Object.keys(groups).sort((a, b) => {
    const orderA = CITY_ORDER[a] || 99;
    const orderB = CITY_ORDER[b] || 99;
    if (orderA !== orderB) return orderA - orderB;
    return a.localeCompare(b);
  });

  const groupsHtml = sortedLocations.map(loc => {
    const list = groups[loc];
    
    // 日時の降順（新しい順）にソート
    list.sort((a, b) => {
      const dateA = a.updatedAt || '';
      const dateB = b.updatedAt || '';
      return dateB.localeCompare(dateA);
    });

    const staffCount = list.length;
    
    const rowsHtml = list.map(s => {
      return `
        <div class="stock-row flex flex-col pt-1 pb-4 border-b border-white/5 last:border-b-0 rounded-xl px-2 -mx-2 gap-2"
          data-name="${(s.staffName||'').replace(/"/g,'&quot;')}"
          data-id="${(s.staffId||'').replace(/"/g,'&quot;')}"
          data-loc="${(s.location||'').replace(/"/g,'&quot;')}"
          data-count="${s.count||0}">
          
          <!-- 1行目：左詰め（名前） -->
          <div class="w-full text-left">
            <div class="text-sm font-black text-white truncate">${(s.staffName||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
          </div>
          
          <!-- 2行目：中央揃え（枚数とLINEボタン） -->
          <div class="flex items-center justify-center w-full py-1" style="gap: 32px;">
            <span class="text-base font-black text-[#22c55e] font-mono">${(s.count || 0).toLocaleString()}枚</span>
            <button type="button"
              ontouchstart="this.style.transform='scale(0.92)'; this.style.opacity='0.7';"
              ontouchend="this.style.transform='scale(1)'; this.style.opacity='1'; event.preventDefault(); var r=this.closest('.stock-row'); if(window.openTransferRequestDialog){window.openTransferRequestDialog(r.dataset.name,r.dataset.id,r.dataset.loc,parseFloat(r.dataset.count)||0);}else{alert('[DEBUG]関数未定義');}"
              ontouchcancel="this.style.transform='scale(1)'; this.style.opacity='1';"
              onclick="var r=this.closest('.stock-row'); if(window.openTransferRequestDialog){window.openTransferRequestDialog(r.dataset.name,r.dataset.id,r.dataset.loc,parseFloat(r.dataset.count)||0);}"
              style="background: rgba(6,199,85,0.1); border-color: rgba(6,199,85,0.3); color: #06C755; gap: 6px; transition: transform 0.15s ease, opacity 0.15s ease; touch-action: manipulation;"
              class="flex items-center justify-center px-5 py-2 rounded-full border">
              <span class="text-sm pointer-events-none">🤝</span>
              <span class="text-[10px] font-black tracking-wider pointer-events-none">受渡要請</span>
            </button>
          </div>
          
          <!-- 3行目：右詰め（更新日時） -->
          <div class="w-full text-right">
            <div class="text-[9px] text-white/40 font-mono truncate">UPDATE: ${(s.updatedAt||'---').replace(/&/g,'&amp;').replace(/</g,'&lt;')}</div>
          </div>
        </div>`;
    }).join('');

    return `
      <div class="premium-glass p-6 space-y-2">
        <div class="flex justify-between items-center border-b border-white/10 pb-3">
          <span class="text-base font-black text-white tracking-wider">🏢 ${loc}</span>
          <span style="background: rgba(37,99,235,0.1); color: #2563eb;" class="text-[10px] font-black px-2 py-0.5 rounded-full font-mono">${staffCount}名保管</span>
        </div>
        <div class="space-y-1">
          ${rowsHtml}
        </div>
      </div>`;
  }).join('');

  container.innerHTML = groupsHtml;

  // (イベント登録は削除。インラインonclickで確実に実行します)
}

// LINE受渡連絡用の共有リンク生成
window.sendLineContact = function(staffName, staffId, location, count) {
  const text = `【チラシ受渡のお願い】\n${staffName}さんの保管チラシ（${location} ${Number(count).toLocaleString()}枚）を一部分けていただけないでしょうか？`;
  const lineUrl = `https://line.me/R/share?text=${encodeURIComponent(text)}`;
  window.open(lineUrl, '_blank');
};
