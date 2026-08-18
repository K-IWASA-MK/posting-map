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

function getCityName(areaName) {
  if (!areaName) return 'その他';
  return areaName.replace(/\(\d+\)$/, '').trim();
}

function renderAreas() {
  const contentEl = $('content');

  if (currentCity === null) {
    const pageAreas = $('page-areas');
    const isPageAreasVisible = pageAreas && !pageAreas.classList.contains('hidden');
    if (contentEl) {
      if (isPageAreasVisible) {
        contentEl.classList.add('is-map-view');
      } else {
        contentEl.classList.remove('is-map-view');
      }
    }

    let cities = [];
    if (typeof tier1Cache !== 'undefined' && Array.isArray(tier1Cache) && tier1Cache.length > 0) {
      cities = tier1Cache.map(c => {
        const done = c.done || 0;
        const total = c.total || 0;
        const progress = total > 0 ? Math.round((done / total) * 100) : 0;
        return { name: typeof c === "string" ? c : c.name, done: done, total: total, progress: progress };
      });
    }

    if (cities.length === 0) {
      $('area-list').innerHTML = `
        <div class="premium-glass p-8 text-center space-y-4 mx-4 my-10 border border-white/10 rounded-3xl bg-white/5 backdrop-blur-2xl">
          <p class="text-base font-black text-white">エリアデータ読み込み中...</p>
        </div>`;
      return;
    }

    let mapEl = document.getElementById("main-map");
    if (!mapEl) {
      const mapHtml = `
        <div id="main-map" style="width:100%; height:var(--primary-card-height, 356px); border-radius:1.5rem; overflow:hidden; border: 1px solid rgba(255,255,255,0.1); box-shadow: 0 10px 30px rgba(0,0,0,0.5);"></div>
      `;
      $('area-list').innerHTML = mapHtml;
    }

    if (!window.mainMapInstance && typeof window.initMainMap === 'function') {
      setTimeout(window.initMainMap, 100);
    }
  } else {
    if (contentEl) contentEl.classList.remove('is-map-view');
    // 【第2層：選択された市のエリアシート一覧画面】
    const backButtonHtml = `
      <div class="flex items-center mb-6 h-12">
        <button onclick="backToCityList()" class="w-12 h-12 premium-glass-btn flex items-center justify-center text-xl font-bold">‹</button>
      </div>
    `;

    let filteredAreas = [];
    if (typeof tier2CacheMap !== 'undefined' && Array.isArray(tier2CacheMap[currentCity])) {
      filteredAreas = tier2CacheMap[currentCity].map(t => {
        const done = t.done || 0;
        const total = t.total || 0;
        const progress = total > 0 ? Math.round((done / total) * 100) : 0;
        return { name: t.name, done: done, total: total, progress: progress, repAddress: t.repAddress || '' };
      });
    }

    const areaCardsHtml = filteredAreas.map(s => renderAreaListItem(s)).join('');
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
    const mainContentHtml = `<div class="space-y-6">${areaCardsHtml}</div>` + bottomNavHtml;
    $('area-list').innerHTML = backButtonHtml + mainContentHtml;
  }
}

async function selectCity(cityName) {
  currentCity = cityName;
  renderAreas();
  const contentEl = $('content');
  if (contentEl) contentEl.scrollTop = 0;

  // Gen 2 Tier 2 オンデマンド取得
  if (typeof fetchTier2 === 'function') {
    await fetchTier2(cityName);
    renderAreas();
  }

  // 市区町村全体の詳細データをバックグラウンドで先読み開始
  if (window.currentCityDetailsName !== cityName) {
    window.cityAreaCache = {}; // キャッシュリセット
    window.currentCityDetailsName = cityName;
    window.activeCityDetailsPromise = callApiPost('getCityAreaDetails', { cityName: cityName })
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
  if (!allPoints) {
    allPoints = [];
  }
  let p = allPoints.find(point => point.rowId === rowId);

  // MASTER_858 fallback generated temporary point
  if (!p) {
    const masterRow = window.ADDRESS_MASTER_DATA?.find(item => item.rowId === rowId);
    if (masterRow) {
      const areaName = (masterRow.town_name && masterRow.town_name.includes(masterRow.city_name))
        ? masterRow.town_name
        : `${masterRow.city_name}_${masterRow.town_name}`;

      window.currentCityDetailAreaName = areaName;

      // 既存の全体進捗(areaSummary)から進捗状況を逆引き
      let isDone = false;
      let count = 0;
      if (typeof areaSummary !== 'undefined' && Array.isArray(areaSummary)) {
        const summary = areaSummary.find(s => s.name === areaName || s.name === masterRow.town_name);
        if (summary) {
          isDone = (summary.done > 0);
          count = summary.count || 0;
        }
      }

      p = {
        rowId: rowId,
        address: `${masterRow.city_name} ${masterRow.town_name}`,
        isDone: isDone,
        count: count,
        staffName: '',
        staffId: '',
        gps: '',
        photoUrl: '',
        source: "MASTER_858_FALLBACK"
      };
      allPoints.push(p);
    }
  }

  if (!p) return;

  window.currentPointDetailRowId = rowId;
  const modalContent = $('detail-modal-content');
  if (modalContent) {
    modalContent.innerHTML = renderDetailModalContent(p);
    modalContent.scrollTop = 0; // スクロール位置を確実に一番上へリセット
  }

  const modal = $('detail-modal');

  if (!modal) {
    console.error("[ERROR] detail-modal not found");
    return;
  }

  if (getComputedStyle(modal).display === "none") {
    modal.style.display = ""; // クラスで定義された 'flex' 等に戻す
  }

  modal.classList.remove('pointer-events-none', 'opacity-0');
  if (modal.firstElementChild) {
    modal.firstElementChild.classList.remove('translate-y-full');
  }
}

// Close point detail modal
function closeDetailModal() {
  const modal = $('detail-modal');
  if (!modal) return;
  modal.classList.add('opacity-0', 'pointer-events-none');
  if (modal.firstElementChild) {
    modal.firstElementChild.classList.add('translate-y-full');
  }
  // アニメーション完了後にdisplay: noneにする
  setTimeout(() => {
    if (modal.classList.contains('opacity-0')) {
      modal.style.display = "none";
    }
  }, 300);
  window.currentPointDetailRowId = null;
}

// キャンセル時の完全破棄＆PinStatus解除 (二重remove防止設計)
window.cancelMissionComplete = function(rowId) {
  const numericRowId = parseInt(rowId, 10);

  // 1. 対象ポイントの一時下書きデータを完全破棄
  const resetPointData = (p) => {
    p.isDone = false;
    p.count = 0;
    p.staffName = '';
    p.staffId = '';
    p.completedAt = '';
    p.syncStatus = '';
    p.photoStatus = 'NONE';
    p.gpsStatus = 'NO';
    p.gps = '';
    p.latitude = '';
    p.longitude = '';
    p.accuracy = null;
    delete p.tempPhotoUrl;
    delete p.photoBase64;
  };

  if (typeof allPoints !== 'undefined' && Array.isArray(allPoints)) {
    const p = allPoints.find(point => point.rowId === numericRowId || point.rowId === rowId);
    if (p) resetPointData(p);
  }
  if (typeof window.allPoints !== 'undefined' && Array.isArray(window.allPoints)) {
    const p = window.allPoints.find(point => point.rowId === numericRowId || point.rowId === rowId);
    if (p) resetPointData(p);
  }

  // 2. モーダルを閉じる
  closeDetailModal();

  // 3. activeMarker の有無を確認し、removeの二重送信を防止
  let markerHandled = false;
  if (typeof window.closeCustomInfoWindow === 'function') {
    markerHandled = window.closeCustomInfoWindow();
  }

  // activeMarker が無かった場合のみ直接 remove を呼ぶ (重複送信の防止)
  if (!markerHandled && typeof window.setPinInProgress === 'function') {
    window.setPinInProgress(numericRowId || rowId, "remove");
  }

  // 4. マップピンの同期
  if (typeof window.refreshMainMapPins === 'function') {
    window.refreshMainMapPins();
  }

  // 5. エリア詳細リストの再描画
  if (typeof renderDetailList === 'function' && window.currentCityDetailAreaName) {
    renderDetailList(window.currentCityDetailAreaName);
  }
};

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
    if (p.gpsStatus === 'pending') {
      gpsBadgeHtml = `
        <!-- 【GPS取得中】横幅いっぱいのカード型 -->
        <div style="background: rgba(245, 158, 11, 0.05); border: 1px solid rgba(245, 158, 11, 0.2);" class="w-full rounded-2xl py-4 px-5 flex flex-col items-center justify-center">
          <div class="flex items-center justify-center gap-2 w-full">
            <span class="text-sm animate-pulse">📍</span>
            <span class="text-[10px] font-black text-[#f59e0b] uppercase tracking-[0.2em] animate-pulse">GPS 取得中...</span>
          </div>
        </div>
      `;
    } else if (p.gpsStatus === 'OK' || p.gps) {
      gpsBadgeHtml = `
        <!-- 【GPSあり】横幅いっぱいの青色カード型 (PHOTO VERIFIED と完全同一スタイル) -->
        <div style="background: rgba(37, 99, 235, 0.05); border: 1.5px solid rgba(37, 99, 235, 0.4); box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.15), 0 0 30px rgba(37, 99, 235, 0.05);" class="w-full rounded-2xl py-4 px-5 flex flex-col items-center justify-center">
          <div class="flex items-center justify-center gap-2 w-full">
            <span class="text-sm">📍</span>
            <span class="text-[10px] font-black text-[#2563eb] uppercase tracking-[0.2em]">GPS VERIFIED</span>
          </div>
        </div>
      `;
    } else if (p.gpsStatus === 'DEVICE_OFF') {
      gpsBadgeHtml = `
        <!-- 【GPS OFF】横幅いっぱいのカード型 -->
        <div style="background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.2);" class="w-full rounded-2xl py-4 px-5 flex flex-col items-center justify-center">
          <div class="flex items-center justify-center gap-2 w-full">
            <span class="text-sm opacity-50">📍</span>
            <span class="text-[10px] font-black text-[#ef4444] uppercase tracking-[0.2em]">GPS OFF</span>
          </div>
        </div>
      `;
    } else {
      gpsBadgeHtml = `
        <!-- 【GPSエラー】横幅いっぱいのカード型 -->
        <div style="background: rgba(239, 68, 68, 0.05); border: 1px solid rgba(239, 68, 68, 0.2);" class="w-full rounded-2xl py-4 px-5 flex flex-col items-center justify-center">
          <div class="flex items-center justify-center gap-2 w-full">
            <span class="text-sm opacity-50">📍</span>
            <span class="text-[10px] font-black text-[#ef4444] uppercase tracking-[0.2em]">GPS 取得できませんでした</span>
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
    if (tempUrl || photoId) {
      photoBlockHtml = `
        <!-- 【写真あり】青色（#2563eb）テーマの写真確認カード (コンパクト化・ボタン廃止・外枠青色化) -->
        <div style="background: rgba(37, 99, 235, 0.05); border: 1.5px solid rgba(37, 99, 235, 0.4); box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.15), 0 0 30px rgba(37, 99, 235, 0.05);" class="w-full rounded-2xl py-4 px-5 flex flex-col items-center justify-center">
          <div class="flex items-center justify-center gap-2 w-full">
            <span class="text-sm">📸</span>
            <span class="text-[10px] font-black text-[#2563eb] uppercase tracking-[0.2em]">PHOTO VERIFIED</span>
          </div>
        </div>
      `;
    } else if (false) { // keep existing else block structure intact but bypassed
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

  // 「大字」除去 + 余分な空白整理
  const cleanAddr = (p.address || '').replace(/大字/g, '').replace(/\s+/g, ' ').trim();
  // 住所の文字数に応じてフォントサイズを自動調整（折り返し・はみ出し防止）
  let addrFontSizeClass = 'text-lg';
  if (cleanAddr.length > 16) {
    addrFontSizeClass = 'text-sm';
  } else if (cleanAddr.length > 10) {
    addrFontSizeClass = 'text-base';
  }

  return `
    <div style="display: flex; flex-direction: column; gap: 12px; width: 100%; box-sizing: border-box;">
      <!-- 1行目: 住所バッジ（中央寄せ） -->
      <div class="w-full flex flex-col items-center">
        <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); height: 26px; font-size: 12px; color: rgba(255, 255, 255, 0.9);" class="inline-flex items-center px-3 font-bold rounded-full tracking-wide truncate max-w-full select-text">
          🏠 ${escapeHtml(cleanAddr)}
        </div>
        ${p.memo ? `<div class="text-xs text-white/50 bg-white/5 rounded-xl p-3 border border-white/5 select-text w-full text-center mt-1">${escapeHtml(p.memo)}</div>` : ''}
      </div>

      ${!p.isDone ? `
        <!-- 【未完了】配布枚数入力案内カード -->
        <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08);" class="w-full rounded-3xl py-6 px-5 flex flex-col items-center justify-center gap-6">
          <div style="color: rgba(255, 255, 255, 0.7); font-size: 13px; font-weight: 700; line-height: 1.6; text-align: center; margin-bottom: 12px;">
            配布枚数を入力してください<br>入力後 写真を撮影します
          </div>

          <div style="display: flex; gap: 10px; width: 100%;">
            <button type="button" onclick="cancelMissionComplete(${p.rowId})"
              style="flex: 1; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.1); color: rgba(255, 255, 255, 0.6); border-radius: 14px; padding: 14px 8px; font-size: 13px; font-weight: 900; cursor: pointer; transition: transform 0.12s ease, opacity 0.12s ease;"
              onpointerdown="this.style.transform='scale(0.94)'; this.style.opacity='0.7';"
              onpointerup="this.style.transform='scale(1)'; this.style.opacity='1';"
              onpointerleave="this.style.transform='scale(1)'; this.style.opacity='1';">キャンセル</button>
            <button type="button" onclick="openNumpad('${escapeHtml(areaName)}', ${p.rowId}, ${p.count || 0}, true);" class="btn-neu"
              style="flex: 1; background: #2563eb; border: none; color: white; border-radius: 14px; padding: 14px 8px; font-size: 13px; font-weight: 900; cursor: pointer; transition: transform 0.12s ease, opacity 0.12s ease;"
              onpointerdown="this.style.transform='scale(0.96)'; this.style.opacity='0.85';"
              onpointerup="this.style.transform='scale(1)'; this.style.opacity='1';"
              onpointerleave="this.style.transform='scale(1)'; this.style.opacity='1';">OK</button>
          </div>
        </div>
      ` : `
        <!-- 【完了確認】MISSION COMPLETED 大見出しカード (コンパクト化) -->
        <div style="background: rgba(16, 185, 129, 0.06); border: 1px solid rgba(16, 185, 129, 0.25); box-shadow: 0 0 20px rgba(16, 185, 129, 0.08); border-radius: 20px; padding: 14px 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; gap: 4px; box-sizing: border-box; width: 100%;">
          <div style="width: 28px; height: 28px; border-radius: 9999px; background: rgba(16, 185, 129, 0.2); border: 1px solid rgba(16, 185, 129, 0.4); display: flex; align-items: center; justify-content: center; color: #10b981; font-weight: 900; font-size: 14px;">
            ✓
          </div>
          <div style="font-size: 13px; font-weight: 900; letter-spacing: 0.08em; color: #10b981; text-transform: uppercase;">
            MISSION COMPLETED!
          </div>
          <div style="font-size: 11px; font-weight: 700; color: rgba(255, 255, 255, 0.7);">
            配布が完了しました
          </div>
          <div style="font-size: 10px; font-weight: 700; color: rgba(255, 255, 255, 0.4); margin-top: 2px;">
            🕒 ${p.completedAt || ''}${p.staffName ? ` · ${escapeHtml(p.staffName)}` : ''}
          </div>
        </div>

        <!-- 【中央2カラムエリア】左: 提出写真 / 右: GPS・枚数・配布員 -->
        <div style="display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; width: 100%; box-sizing: border-box;">
          <!-- 左カラム: 提出写真 -->
          <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 16px; padding: 10px; display: flex; flex-direction: column; align-items: center; justify-content: space-between; gap: 6px; box-sizing: border-box; overflow: hidden;">
            <div style="font-size: 10px; font-weight: 900; color: rgba(255, 255, 255, 0.5); width: 100%; display: flex; align-items: center; gap: 4px;">
              <span>📷</span><span>提出写真</span>
            </div>
            <div style="width: 100%; aspect-ratio: 1 / 1; border-radius: 10px; overflow: hidden; background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.1); display: flex; align-items: center; justify-content: center;">
              ${(p.tempPhotoUrl || p.photoUrl) ? `
                <img src="${p.tempPhotoUrl || p.photoUrl}" alt="Evidence" style="width: 100%; height: 100%; object-fit: cover;" />
              ` : `
                <span style="font-size: 10px; color: rgba(255, 255, 255, 0.3);">写真なし</span>
              `}
            </div>
            <div style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.3); color: #10b981; font-size: 8.5px; font-weight: 900; padding: 2px 6px; border-radius: 9999px; display: inline-flex; align-items: center; gap: 3px; white-space: nowrap; letter-spacing: 0.04em;">
              <span>🛡️</span><span>PHOTO VERIFIED</span>
            </div>
            <div style="font-size: 9px; font-weight: 700; color: rgba(255, 255, 255, 0.4); text-align: center; white-space: nowrap;">
              写真を確認しました
            </div>
          </div>

          <!-- 右カラム: GPS・配布数・配布員（3段） -->
          <div style="display: flex; flex-direction: column; gap: 6px; width: 100%; box-sizing: border-box; justify-content: space-between;">
            <!-- 1. GPS位置情報 -->
            <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 14px; padding: 8px 9px; display: flex; flex-direction: column; gap: 2px; box-sizing: border-box; overflow: hidden;">
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 2px; width: 100%;">
                <span style="font-size: 9.5px; font-weight: 900; color: rgba(255, 255, 255, 0.5); display: flex; align-items: center; gap: 2px; white-space: nowrap;">📍 GPS</span>
                ${(p.gpsStatus === 'OK' || p.gps || p.latitude) ? `
                  <span style="background: rgba(16, 185, 129, 0.12); color: #10b981; font-size: 7.5px; font-weight: 900; padding: 1px 4px; border-radius: 4px; white-space: nowrap;">取得済み</span>
                ` : p.gpsStatus === 'pending' ? `
                  <span style="background: rgba(37, 99, 235, 0.12); color: #60a5fa; font-size: 7.5px; font-weight: 900; padding: 1px 4px; border-radius: 4px; white-space: nowrap;">取得中...</span>
                ` : `
                  <span style="background: rgba(255, 255, 255, 0.08); color: rgba(255, 255, 255, 0.5); font-size: 7.5px; font-weight: 900; padding: 1px 4px; border-radius: 4px; white-space: nowrap;">未取得</span>
                `}
              </div>
              <div style="font-size: 9px; font-family: monospace; font-weight: 700; color: ${(p.gps || p.latitude) ? 'rgba(255, 255, 255, 0.8)' : 'rgba(255, 255, 255, 0.4)'}; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; width: 100%;">
                ${p.gps || (p.latitude && p.longitude ? `${String(p.latitude).slice(0,9)}, ${String(p.longitude).slice(0,10)}` : (p.gpsStatus === 'pending' ? '測位中...' : '位置情報なし (GPSオフ)'))}
              </div>
              <div style="font-size: 7.5px; font-weight: 700; color: rgba(255, 255, 255, 0.3); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                ${(p.gps || p.latitude) ? `精度: ±${p.accuracy ? Math.round(p.accuracy) : 5}m · ${(p.completedAt || '').split(' ')[1] || ''}` : '※未取得でも提出できます'}
              </div>
            </div>

            <!-- 2. 配布枚数（右詰め・コンパクト化） -->
            <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 14px; padding: 8px 9px; display: flex; flex-direction: column; justify-content: center; gap: 1px; box-sizing: border-box; overflow: hidden;">
              <div style="font-size: 9.5px; font-weight: 900; color: rgba(255, 255, 255, 0.5); display: flex; align-items: center; gap: 2px;">📄 配布枚数</div>
              <div style="font-size: 18px; font-weight: 900; color: #ffffff; font-family: monospace; text-align: right; width: 100%; line-height: 1.1; margin-top: 2px; letter-spacing: -0.02em;">
                ${p.count || 0}枚
              </div>
            </div>

            <!-- 3. 配布員（右詰め・コンパクト化） -->
            <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 14px; padding: 8px 9px; display: flex; flex-direction: column; justify-content: center; gap: 1px; box-sizing: border-box; overflow: hidden;">
              <div style="font-size: 9.5px; font-weight: 900; color: rgba(255, 255, 255, 0.5); display: flex; align-items: center; gap: 2px;">👤 配布員</div>
              <div style="font-size: 11px; font-weight: 900; color: rgba(255, 255, 255, 0.9); text-align: right; width: 100%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                ${escapeHtml(p.staffName || '担当者')}
              </div>
            </div>
          </div>
        </div>

        <!-- 【注意文】枠線・背景なしのシンプルなテキスト -->
        <div style="color: rgba(245, 158, 11, 0.9); display: flex; align-items: center; justify-content: center; gap: 4px; font-size: 11px; font-weight: 700; width: 100%; box-sizing: border-box; padding: 2px 0;">
          <span>⚠️</span><span>提出すると配布実績として記録されます</span>
        </div>

        <!-- 【アクションボタン】上: 提出(ブルー) / 下: キャンセル(ダークグレー) -->
        <div style="width: 100%; display: flex; flex-direction: column; gap: 12px; box-sizing: border-box;">
          <!-- 提出ボタン (ブルー) -->
          <button type="button" id="submit-mission-btn" ontouchstart="" onclick="submitMissionComplete('${escapeHtml(areaName)}', ${p.rowId})" class="btn-neu"
            style="width: 100%; background: #2563eb; border: none; color: white; border-radius: 14px; padding: 14px 8px; font-size: 13px; font-weight: 900; cursor: pointer; transition: transform 0.12s ease, opacity 0.12s ease; display: flex; align-items: center; justify-content: center; gap: 6px; box-sizing: border-box;"
            onpointerdown="this.style.transform='scale(0.97)'; this.style.opacity='0.85';"
            onpointerup="this.style.transform='scale(1)'; this.style.opacity='1';"
            onpointerleave="this.style.transform='scale(1)'; this.style.opacity='1';">
            🚀 この内容で提出する
          </button>

          <!-- キャンセルボタン (ダークグレー) -->
          <button type="button" id="cancel-mission-btn" ontouchstart="" onclick="cancelMissionComplete(${p.rowId})"
            style="width: 100%; background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.1); color: rgba(255, 255, 255, 0.6); border-radius: 14px; padding: 12px 8px; font-size: 13px; font-weight: 900; cursor: pointer; transition: transform 0.12s ease, opacity 0.12s ease; display: flex; align-items: center; justify-content: center; gap: 4px; box-sizing: border-box;"
            onpointerdown="this.style.transform='scale(0.97)'; this.style.opacity='0.7';"
            onpointerup="this.style.transform='scale(1)'; this.style.opacity='1';"
            onpointerleave="this.style.transform='scale(1)'; this.style.opacity='1';">
            ✕ キャンセル
          </button>
        </div>
      `}
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
  const cityAreas = (typeof tier2CacheMap !== 'undefined' && tier2CacheMap[activeCity]) ? tier2CacheMap[activeCity] : [];
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
  if (!window.currentCityDetailAreaName) return;
  const activeCity = currentCity || getCityName(window.currentCityDetailAreaName);
  const cityAreas = (typeof tier2CacheMap !== 'undefined' && tier2CacheMap[activeCity]) ? tier2CacheMap[activeCity] : [];
  const currentIndex = cityAreas.findIndex(s => s.name === window.currentCityDetailAreaName);
  if (currentIndex === -1) return;

  const targetIndex = currentIndex + direction;
  if (targetIndex >= 0 && targetIndex < cityAreas.length) {
    const targetAreaName = cityAreas[targetIndex].name;
    openDetail(targetAreaName);
  }
}

async function openDetail(name) {
  // Gen 2 Tier3 キャッシュチェック
  const activeCity = (typeof currentCity !== 'undefined' && currentCity) ? currentCity : getCityName(name);
  const cacheKey = `${activeCity}::${name}`;
  if (typeof tier3CacheMap !== 'undefined' && tier3CacheMap[cacheKey]) {
    allPoints = tier3CacheMap[cacheKey];
    window.currentCityDetailAreaName = name;
    if (typeof scrollPositions !== 'undefined') scrollPositions['detail'] = 0;
    const contentEl = $('content');
    if (contentEl) contentEl.scrollTop = 0;
    renderDetailList(name);
    switchPage('detail');
    return;
  }

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
    const data = await callApiPost('getAreaDetails', { name: name });
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
  const contentEl = $('content');
  if (contentEl) {
    contentEl.classList.remove('is-map-view');
  }

  const userInfo = JSON.parse(localStorage.getItem('user_info'));
  const container = $('settings-content');

  if (!userInfo) {
    // サーチ画面から1.5秒で確実にID画面へ移行する仕様のため、中途半端なスピナーや登録画面等の中間表示は一切行わない
    container.innerHTML = '';
    return;
  }



  // Normal view mode: Show ID card + assigned area shortcut + edit name button
  const rawBranch = (window.PMS_CLIENT_CONFIG && window.PMS_CLIENT_CONFIG.districtId) || localStorage.getItem('branch_name') || '';
  const displayBranch = rawBranch ? (rawBranch.includes('支部') ? rawBranch : `${rawBranch} 支部`) : '';

  // Format sync time
  const lastSyncTime = localStorage.getItem('__last_sync_time__') || '--:--';
  const regDate = userInfo.registrationDate || '2025/07/01';


  const staffCardHtml = renderStaffCard(userInfo, {
    branchName: displayBranch,
    lastSyncTime: lastSyncTime,
    registrationDate: regDate
  });

  container.innerHTML = staffCardHtml;
}

function renderRanking() {
  const container = $('ranking-list');
  if (!container) return;

  const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
  const myStaffId = userInfo.id ? String(userInfo.id).trim() : '';

  // APIから取得した実データを優先的に使用
  const displayRanking = (typeof rankingData !== 'undefined' && rankingData) ? rankingData : [];

  if (displayRanking.length === 0) {
    container.innerHTML = `
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

  const rankingContentHtml = renderRankingCard(displayRanking, myStaffId);
  container.innerHTML = rankingContentHtml;
}

// チラシ保管状況の描画処理
function renderStorageList(stocks) {
  const container = $('storage-list-container');
  if (!container) return;

  const userInfo = JSON.parse(localStorage.getItem('user_info') || '{}');
  const myStaffId = userInfo.id ? String(userInfo.id).trim() : '';

  // テスト用データおよび「自分のデータ」を除外（他人の在庫のみ共有表示）
  if (stocks && stocks.length > 0) {
    stocks = stocks.filter(s => {
      const name = s.staffName || '';
      const id = s.staffId ? String(s.staffId).trim() : '';

      // テストデータの除外
      if (name.includes('テスト') || id.toUpperCase().includes('TEST')) return false;

      // 自分のレコードは在庫一覧（共有一覧）から除外
      if (myStaffId && id === myStaffId) return false;

      return true;
    });
  }

  if (!stocks || stocks.length === 0) {
    container.innerHTML = `
      <div style="border: 1px solid rgba(255,255,255,0.04);" class="premium-glass p-8 flex flex-col items-center justify-center text-center gap-3">
        <span class="text-2xl">📦</span>
        <p class="text-sm font-black text-white/60">現在、他の方が保管しているチラシはありません</p>
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

  // ADDRESS_MASTER_858.CSV (tier1Cache / ADDRESS_MASTER_DATA) の出現順を SSOT として取得
  let masterCities = [];
  if (typeof tier1Cache !== 'undefined' && Array.isArray(tier1Cache) && tier1Cache.length > 0) {
    masterCities = tier1Cache.map(c => typeof c === 'string' ? c : (c.name || ''));
  } else if (typeof window !== 'undefined' && window.ADDRESS_MASTER_DATA && Array.isArray(window.ADDRESS_MASTER_DATA)) {
    const seen = new Set();
    window.ADDRESS_MASTER_DATA.forEach(row => {
      if (row.city_name && !seen.has(row.city_name)) {
        seen.add(row.city_name);
        masterCities.push(row.city_name);
      }
    });
  }

  const sortedLocations = Object.keys(groups).sort((a, b) => {
    const idxA = masterCities.indexOf(a);
    const idxB = masterCities.indexOf(b);
    const orderA = idxA !== -1 ? idxA : 999;
    const orderB = idxB !== -1 ? idxB : 999;
    if (orderA !== orderB) return orderA - orderB;
    return a.localeCompare(b); // SSOTに存在しない未知の保管場所のみ五十音順で末尾に配置
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
          data-storage-id="${(s.id||'').replace(/"/g,'&quot;')}"
          data-name="${(s.staffName||'').replace(/"/g,'&quot;')}"
          data-id="${(s.staffId||'').replace(/"/g,'&quot;')}"
          data-loc="${(s.location||'').replace(/"/g,'&quot;')}"
          data-count="${s.count||0}">

          <!-- 1行目：左詰め（ID） -->
          <div class="w-full text-left">
            <div class="text-sm font-black font-mono text-white truncate">${(s.id||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</div>
          </div>

          <!-- 2行目：中央揃え（枚数とLINEボタン） -->
          <div class="flex items-center justify-center w-full py-1" style="gap: 32px;">
            <span class="text-base font-black text-[#22c55e] font-mono">${(s.count || 0).toLocaleString()}枚</span>
            <button type="button"
              ontouchstart="this.style.transform='scale(0.92)'; this.style.opacity='0.7';"
              ontouchend="this.style.transform='scale(1)'; this.style.opacity='1'; event.preventDefault(); var r=this.closest('.stock-row'); if(window.openTransferRequestDialog){window.openTransferRequestDialog(r.dataset.name,r.dataset.id,r.dataset.loc,parseFloat(r.dataset.count)||0,r.dataset.storageId||'');}else{alert('[DEBUG]関数未定義');}"
              ontouchcancel="this.style.transform='scale(1)'; this.style.opacity='1';"
              onclick="var r=this.closest('.stock-row'); if(window.openTransferRequestDialog){window.openTransferRequestDialog(r.dataset.name,r.dataset.id,r.dataset.loc,parseFloat(r.dataset.count)||0,r.dataset.storageId||'');}"
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
}

window.initMainMap = function() {
  const mapEl = document.getElementById("main-map");
  if (!mapEl || !window.google || !window.google.maps) return;

  // 既存Mapインスタンスが同一DOM要素にバインド済みの場合はMap生成・858 Marker生成・Listener登録のすべてをスキップ
  if (window.mainMapInstance && window.mainMapInstance.getDiv() === mapEl) {
    return;
  }

  const appleStyle = [
    { elementType: "geometry", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.stroke", stylers: [{ color: "#242f3e" }] },
    { elementType: "labels.text.fill", stylers: [{ color: "#746855" }] },
    {
      featureType: "administrative.locality",
      elementType: "labels.text.fill",
      stylers: [{ color: "#d59563" }]
    },
    {
      featureType: "poi",
      elementType: "labels.text.fill",
      stylers: [{ color: "#d59563" }]
    },
    {
      featureType: "poi.park",
      elementType: "geometry",
      stylers: [{ color: "#263c3f" }]
    },
    {
      featureType: "poi.park",
      elementType: "labels.text.fill",
      stylers: [{ color: "#6b9a76" }]
    },
    {
      featureType: "road",
      elementType: "geometry",
      stylers: [{ color: "#38414e" }]
    },
    {
      featureType: "road",
      elementType: "geometry.stroke",
      stylers: [{ color: "#212a37" }]
    },
    {
      featureType: "road",
      elementType: "labels.text.fill",
      stylers: [{ color: "#9ca5b3" }]
    },
    {
      featureType: "road.highway",
      elementType: "geometry",
      stylers: [{ color: "#746855" }]
    },
    {
      featureType: "road.highway",
      elementType: "geometry.stroke",
      stylers: [{ color: "#1f2835" }]
    },
    {
      featureType: "road.highway",
      elementType: "labels.text.fill",
      stylers: [{ color: "#f3d19c" }]
    },
    {
      featureType: "transit",
      elementType: "geometry",
      stylers: [{ color: "#2f3948" }]
    },
    {
      featureType: "transit.station",
      elementType: "labels.text.fill",
      stylers: [{ color: "#d59563" }]
    },
    {
      featureType: "water",
      elementType: "geometry",
      stylers: [{ color: "#17263c" }]
    },
    {
      featureType: "water",
      elementType: "labels.text.fill",
      stylers: [{ color: "#515c6d" }]
    },
    {
      featureType: "water",
      elementType: "labels.text.stroke",
      stylers: [{ color: "#17263c" }]
    }
  ];

  const map = new google.maps.Map(mapEl, {
    center: window.currentMapState?.center || { lat: 35.05, lng: 136.65 },
    zoom: window.currentMapState?.zoom || 11,
    disableDefaultUI: true,
    zoomControl: false,
    clickableIcons: false,
    styles: appleStyle
  });
  window.mainMapInstance = map;

  map.addListener('idle', () => {
    window.currentMapState = {
      center: map.getCenter().toJSON(),
      zoom: map.getZoom()
    };
    if (typeof window.fetchGlobalPinStatus === 'function') {
      window.fetchGlobalPinStatus();
    }
  });

  if (!Array.isArray(window.masterMarkers)) {
    window.masterMarkers = [];
  }

  // ── Custom Marker Overlay クラス定義 (H-app専用オーバーレイ) ──
  class CustomMarkerOverlay extends google.maps.OverlayView {
    constructor(position, content, map, onInputClick) {
      super();
      this.position = position;
      this.content = content;
      this.onInputClick = onInputClick;
      this.div = null;
      this.setMap(map);
    }

    onAdd() {
      const div = document.createElement('div');
      div.style.position = 'absolute';
      div.innerHTML = this.content;
      this.div = div;

      // 「入力操作」ボタンへイベント接続 (インラインonclickの排除)
      const inputButton = div.querySelector('.input-operation-btn');
      if (inputButton && this.onInputClick) {
        inputButton.addEventListener('click', () => {
          this.onInputClick(inputButton);
        });
      }

      // ユーザ指定のoverlayMouseTargetに格納し、クリックを有効にする
      const panes = this.getPanes();
      panes.overlayMouseTarget.appendChild(div);
    }

    draw() {
      if (!this.div) return;
      const projection = this.getProjection();
      if (!projection) return;

      const positionPixels = projection.fromLatLngToDivPixel(this.position);
      // translate(-50%, -100%) を使い、PINの20px上部に中央配置
      this.div.style.left = positionPixels.x + 'px';
      this.div.style.top = (positionPixels.y - 20) + 'px';
      this.div.style.transform = 'translate(-50%, -100%)';
    }

    onRemove() {
      if (this.div) {
        this.div.parentNode.removeChild(this.div);
        this.div = null;
      }
      this.onInputClick = null;
    }
  }

  let activeOverlay = null;
  let activeMarker = null;
  let savedMapOptions = null;

  function lockMapControls() {
    if (map) {
      if (!savedMapOptions) {
        savedMapOptions = {
          gestureHandling: map.get('gestureHandling') || 'greedy',
          zoomControl: map.get('zoomControl') !== false,
          scrollwheel: map.get('scrollwheel') !== false,
          disableDoubleClickZoom: map.get('disableDoubleClickZoom') === true
        };
      }
      map.setOptions({
        gestureHandling: 'none',
        zoomControl: false,
        scrollwheel: false,
        disableDoubleClickZoom: true
      });
    }
  }

  function unlockMapControls() {
    if (map && savedMapOptions) {
      map.setOptions({
        gestureHandling: savedMapOptions.gestureHandling,
        zoomControl: savedMapOptions.zoomControl,
        scrollwheel: savedMapOptions.scrollwheel,
        disableDoubleClickZoom: savedMapOptions.disableDoubleClickZoom
      });
      savedMapOptions = null;
    }
  }

  const revertActiveMarkerColor = () => {
    if (activeMarker) {
      const isCompleted = window.globalPinStatus?.completed?.includes(activeMarker.rowId);
      const isRemoteView = !!activeMarker.isRemoteView;
      const prevIcon = activeMarker.getIcon();

      if (prevIcon) {
        let restoredColor = "#22c55e";
        if (isCompleted) {
          restoredColor = "#EA5F08";
        } else if (isRemoteView) {
          restoredColor = "#00B7FF";
        }
        activeMarker.setIcon({
          ...prevIcon,
          fillColor: restoredColor
        });
      }

      // Phase 4-B: 自端末で追加していた場合のみ IN_PROGRESS を remove
      if (!isCompleted && !isRemoteView && typeof window.setPinInProgress === 'function') {
        window.setPinInProgress(activeMarker.rowId, "remove");
      }

      unlockMapControls();
      activeMarker = null;
    }
  };

  window.refreshMainMapPins = function() {
    if (!window.masterMarkers) return;
    window.masterMarkers.forEach(marker => {
      const isCompleted = window.globalPinStatus?.completed?.includes(marker.rowId);
      const isInProgress = window.globalPinStatus?.inProgress?.includes(marker.rowId);
      const isMine = activeMarker && activeMarker.rowId === marker.rowId;

      const currentIcon = marker.getIcon();
      if (currentIcon) {
        let targetColor = "#22c55e";
        if (isCompleted) {
          targetColor = "#EA5F08";
        } else if (isInProgress || isMine) {
          targetColor = "#00B7FF";
        }

        if (currentIcon.fillColor !== targetColor) {
          marker.setIcon({
            ...currentIcon,
            fillColor: targetColor
          });
        }
      }
    });
  };

  // カスタム「×」ボタンから呼び出す退場用関数
  window.closeCustomInfoWindow = function() {
    if (activeOverlay) {
      activeOverlay.setMap(null);
      activeOverlay = null;
    }
    const hadMarker = (typeof activeMarker !== 'undefined' && activeMarker !== null);
    revertActiveMarkerColor();
    return hadMarker;
  };

  // E2Eテスト用および下位互換性スタブ
  window.infoWindowInstance = {
    close: () => window.closeCustomInfoWindow()
  };

  window.lockActivePinAndBubble = function(rowId) {
    if (activeMarker && activeMarker.rowId === rowId) {
      const currentIcon = activeMarker.getIcon();
      if (currentIcon) {
        activeMarker.setIcon({ ...currentIcon, fillColor: "#EA5F08" });
      }
    }
    if (activeOverlay && activeOverlay.rowId === rowId) {
      activeOverlay.div.innerHTML = `
        <div class="custom-iw-wrapper">
          <div class="custom-iw-close-btn" onclick="closeCustomInfoWindow()">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </div>
          <div style="font-size: 13px; font-weight: 700; color: rgba(255,255,255,0.4); margin-bottom: 2px; text-align: center;">
            ${activeOverlay.cityName || ''}
          </div>
          <div style="font-size: 20px; font-weight: 900; line-height: 1.2; text-align: center; margin-bottom: 12px;">
            ${activeOverlay.townName || ''}
          </div>
          <div style="background: rgba(234, 95, 8, 0.2); border: 1px solid rgba(234, 95, 8, 0.5); border-radius: 4px; padding: 4px 8px; text-align: center; color: #EA5F08; font-weight: bold; font-size: 13px;">
            配布済み 🔒
          </div>
        </div>
      `;
    }
  };

  const PIN_SVG_PATH = "M 12 2 C 8.13 2 5 5.13 5 9 C 5 14.25 12 22 12 22 C 12 22 19 14.25 19 9 C 19 5.13 15.87 2 12 2 Z";

  const getPinScale = (zoom) => {
    if (zoom <= 11) return 0.55;
    if (zoom === 12) return 0.70;
    if (zoom === 13) return 0.85;
    return 1.05;
  };

  // 初回のみ 858件の Marker 生成を実行（2回目以降は既存Markerを保持・再利用）
  if (window.masterMarkers.length === 0 && window.ADDRESS_MASTER_DATA && Array.isArray(window.ADDRESS_MASTER_DATA)) {
    window.ADDRESS_MASTER_DATA.forEach(row => {
      if (typeof row.latitude === 'number' && typeof row.longitude === 'number') {
        const marker = new google.maps.Marker({
          map: map,
          position: { lat: row.latitude, lng: row.longitude },
          icon: {
            path: PIN_SVG_PATH,
            scale: getPinScale(map.getZoom()),
            fillColor: "#22c55e",
            fillOpacity: 0.9,
            strokeWeight: 1,
            strokeColor: "#ffffff",
            anchor: new google.maps.Point(12, 22)
          }
        });
        marker.rowId = row.rowId;

        marker.addListener('click', () => {
          const cleanTown = row.town_name.replace(/^大字/, '');
          const mapQuery = encodeURIComponent(`${row.city_name} ${cleanTown}`);
          const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapQuery}`;

          const createContent = (isCompleted, isRemoteInProgress) => {
            let bottomUI = '';

            if (isCompleted) {
              bottomUI = `
                <div class="premium-glass-badge badge-completed">
                  配布済み 🔒
                </div>
              `;
            } else if (isRemoteInProgress) {
              bottomUI = `
                <div class="premium-glass-badge badge-in-progress">
                  配布中 🔵
                </div>
              `;
            } else {
              bottomUI = `
                <div style="display: flex; gap: 8px; width: 100%;">
                  <a href="${googleMapsUrl}" target="_blank" class="premium-glass-btn btn-maps" style="flex: 1;">
                    <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21"></polygon>
                      <line x1="9" y1="3" x2="9" y2="18"></line>
                      <line x1="15" y1="6" x2="15" y2="21"></line>
                    </svg>
                    <span>詳細地図</span>
                  </a>
                  <button class="premium-glass-btn btn-input input-operation-btn" style="flex: 1;">
                    <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                      <path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                    </svg>
                    <span>配布開始</span>
                  </button>
                </div>
              `;
            }

            return `
              <div class="custom-iw-wrapper">
                <div class="custom-iw-close-btn" onclick="closeCustomInfoWindow()">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18"></line>
                    <line x1="6" y1="6" x2="18" y2="18"></line>
                  </svg>
                </div>
                <div style="font-size: 13px; font-weight: 700; color: rgba(255,255,255,0.4); margin-bottom: 2px; text-align: center;">
                  ${row.city_name}
                </div>
                <div style="font-size: 20px; font-weight: 900; line-height: 1.2; text-align: center; margin-bottom: 12px;">
                  ${cleanTown}
                </div>
                ${bottomUI}
              </div>
            `;
          };

          const executeOpen = () => {
            // 先頭ガード：既にPopupが開いていれば他ピンの新規タップを完全に無視
            if (activeOverlay || activeMarker) {
              return;
            }

            const isCompleted = window.globalPinStatus?.completed?.includes(row.rowId);
            const isRemoteInProgress = window.globalPinStatus?.inProgress?.includes(row.rowId);
            const isLocked = isCompleted || isRemoteInProgress;

            // タップされたPINのアイコン色変更 (自端末選択表示のため青へ変更 / PinStatus追加なし)
            const currentIcon = marker.getIcon();
            if (currentIcon) {
              let targetColor = "#00B7FF";
              if (isCompleted) {
                targetColor = "#EA5F08";
              } else if (isRemoteInProgress) {
                targetColor = "#00B7FF";
              }
              marker.setIcon({
                ...currentIcon,
                fillColor: targetColor
              });
            }

            marker.isRemoteView = isRemoteInProgress;

            // Phase 4-B: 未完了かつ他端末作業中でない自端末の新規選択時のみ IN_PROGRESS を add
            if (!isCompleted && !isRemoteInProgress && typeof window.setPinInProgress === 'function') {
               window.setPinInProgress(row.rowId, "add");
            }
            activeMarker = marker;

            // MAP操作可逆ロック
            lockMapControls();

            const showOverlay = () => {
              // 重複表示防止のガード：表示前に再度クリアする
              if (activeOverlay) {
                activeOverlay.setMap(null);
                activeOverlay = null;
              }
              let isStarted = false;
              activeOverlay = new CustomMarkerOverlay(marker.getPosition(), createContent(isCompleted, isRemoteInProgress), map, (buttonEl) => {
                if (isLocked) return;

                if (!isStarted) {
                  isStarted = true;
                  const span = buttonEl ? buttonEl.querySelector('span') : null;
                  if (span) {
                    span.textContent = '入力操作';
                  } else if (buttonEl) {
                    buttonEl.textContent = '入力操作';
                  }
                  return;
                }

                openPointDetailModal(row.rowId);
              });
              activeOverlay.rowId = row.rowId;
              activeOverlay.cityName = row.city_name;
              activeOverlay.townName = cleanTown;
            };

            // スクリュー移動が必要かどうかの判定（すでに中心付近にある場合は即表示）
            const center = map.getCenter();
            const pos = marker.getPosition();

            // 投影法を用いてカメラの中心位置を22px上にずらし、PINが画面中央より22px下に下がるようにする
            const scale = Math.pow(2, map.getZoom());
            const projection = map.getProjection();
            let targetPos = pos;
            if (projection) {
              const projPoint = projection.fromLatLngToPoint(pos);
              const offsetPoint = new google.maps.Point(
                projPoint.x,
                projPoint.y - (22 / scale) // 22px分カメラを北へずらす（Y座標を引き算）
              );
              targetPos = projection.fromPointToLatLng(offsetPoint);
            }

            const threshold = 0.00002; // スクロール判定のしきい値
            const isAlreadyCentered = Math.abs(center.lat() - targetPos.lat()) < threshold &&
                                      Math.abs(center.lng() - targetPos.lng()) < threshold;

            if (isAlreadyCentered) {
              showOverlay();
            } else {
              // 移動完了（idle）イベントを一度だけ購読し、スクロール完了後に表示
              google.maps.event.addListenerOnce(map, 'idle', showOverlay);
              map.panTo(targetPos);
            }
          };

          executeOpen();
        });

        window.masterMarkers.push(marker);
      }
    });
  }

  let zoomFrameId = null;
  let currentAppliedScale = getPinScale(map.getZoom());

  // 初回生成時に zoom_changed リスナーを1回だけ登録（重複登録防止）
  map.addListener('zoom_changed', () => {
    if (zoomFrameId) cancelAnimationFrame(zoomFrameId);
    zoomFrameId = requestAnimationFrame(() => {
      const currentZoom = map.getZoom();
      const newScale = getPinScale(currentZoom);
      if (newScale !== currentAppliedScale && window.masterMarkers) {
        currentAppliedScale = newScale;
        window.masterMarkers.forEach(m => {
          const icon = m.getIcon();
          if (icon && icon.scale !== newScale) {
            m.setIcon({ ...icon, scale: newScale });
          }
        });
      }
    });
  });
};
