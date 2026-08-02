// POSTING MAP Component: area.js (Stateless, API-free rendering)

window.renderAreaCard = function(areaData) {
  if (!areaData) return '';

  const doneCount = areaData.done || 0;
  const totalCount = areaData.total || 0;
  const percent = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const displayAreaName = areaData.name || '---';

  return `
    <div style="background: rgba(28,28,30,0.8); border: 1px solid rgba(255,255,255,0.08);" class="w-full max-w-sm p-5 rounded-2xl flex items-center justify-between shadow-2xl mt-6">
      <div class="flex-1 space-y-1">
        <div class="flex items-center gap-1.5 text-white/50 text-[9px] uppercase tracking-wider">
          <span>🎯</span>
          <span>本日の担当エリア</span>
        </div>
        <div class="flex items-center gap-1 cursor-pointer hover:text-white transition-colors" onclick="window.switchToAssignedArea()">
          <span class="text-sm font-black text-white">${displayAreaName}</span>
          <span class="text-white/40 text-xs">➔</span>
        </div>
      </div>
      <div style="border-left: 1px solid rgba(255,255,255,0.08); padding-left: 16px;" class="w-[40%] space-y-1 text-right">
        <span class="text-white/50 text-[9px] uppercase tracking-wider block">本日の進捗</span>
        <div class="flex items-baseline justify-end gap-1.5">
          <span class="text-sm font-black text-white font-mono">${doneCount} / ${totalCount}</span>
          <span class="text-[10px] text-[#00B7FF] font-bold font-mono">(${percent}%)</span>
        </div>
      </div>
    </div>
  `;
};

window.renderCityListItem = function(c) {
  const isCompleted = c.done === c.total && c.total > 0;
  const leftDummy = isCompleted ? '<span style="visibility: hidden; margin-right: 12px;" class="select-none text-[9px] font-sans">🔒 VERIFIED</span>' : '';
  const rightLabel = isCompleted ? '<span style="margin-left: 12px;" class="font-sans text-[9px] opacity-90">🔒 VERIFIED</span>' : '';

  let fontSizeClass = 'text-lg';
  if (c.name.length > 12) {
    fontSizeClass = 'text-xs';
  } else if (c.name.length > 8) {
    fontSizeClass = 'text-sm';
  } else if (c.name.length > 5) {
    fontSizeClass = 'text-base';
  }

  return `
    <div class="clickable-card premium-glass py-5 px-6 flex flex-col items-center text-center gap-1.5" onclick="selectCity('${c.name}')">
      <div class="w-full flex justify-center mb-1">
        <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08);" class="inline-flex items-center justify-center h-7 px-3 ${fontSizeClass} font-black text-white rounded-full tracking-tight">
          <span class="text-xs mr-1 select-none">🏢</span>
          <span>${c.name}</span>
        </div>
      </div>
      <div class="text-sm text-[#00B7FF]">${c.progress}%</div>
      <div class="flex items-center justify-center w-full">
        ${leftDummy}
        <div style="background: rgba(34, 197, 94, 0.08); border: 1px solid rgba(34, 197, 94, 0.25); height: 22px; font-size: 10px; color: #22c55e;" class="inline-flex items-center justify-center px-2.5 font-bold rounded-full tracking-wider font-mono">
          ${c.done || 0}/ ${c.total || 0}
        </div>
        ${rightLabel}
      </div>
    </div>
  `;
};

window.renderAreaListItem = function(s) {
  const isCompleted = s.done === s.total && s.total > 0;
  const leftDummy = isCompleted ? '<span style="visibility: hidden; margin-right: 8px; white-space: nowrap;" class="select-none text-xs font-sans">🔒</span>' : '';
  const rightLabel = isCompleted ? '<span style="margin-left: 8px; white-space: nowrap;" class="font-sans text-xs opacity-90">🔒</span>' : '';
  
  let zipCode = '';
  let cleanAddress = s.name;
  
  if (s.repAddress) {
    const match = s.repAddress.match(/^〒(\d{3}-\d{4})\s*([\s\S]*)$/);
    if (match) {
      zipCode = match[1];
      cleanAddress = match[2].trim().replace(/\r?\n/g, ' ');
    } else {
      cleanAddress = s.repAddress.replace(/\r?\n/g, ' ');
    }
  }

  let fontSizeClass = 'text-base';
  if (cleanAddress.length > 12) {
    fontSizeClass = 'text-xs';
  } else if (cleanAddress.length > 8) {
    fontSizeClass = 'text-sm';
  }

  const mapUrl = zipCode
    ? `https://www.google.com/maps/search/?api=1&query=${zipCode}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(cleanAddress + ' 日本')}`;

  const googleMapsButtonHtml = isCompleted
    ? `
      <a style="background: rgba(37,99,235,0.02); border: 1px solid rgba(37,99,235,0.1); color: rgba(37,99,235,0.3); pointer-events: none; font-family: monospace; display: inline-flex; align-items: center; justify-content: center;"
        class="h-7 px-4 rounded-full text-[10px] font-black tracking-widest select-none opacity-40">
        📮 〒${zipCode || '---'} → 🗺
      </a>
    `
    : `
      <a href="${mapUrl}" target="_blank"
        style="background: rgba(37,99,235,0.06); border: 1px solid rgba(37,99,235,0.25); color: rgba(37,99,235,0.88); transition: transform 75ms ease-out; white-space: nowrap; font-family: monospace; display: inline-flex; align-items: center; justify-content: center;"
        onpointerdown="this.style.transform='scale(0.94)'"
        onpointerup="this.style.transform=''"
        onpointerleave="this.style.transform=''"
        class="h-7 px-4 rounded-full text-[10px] font-black tracking-widest select-none">
        📮 〒${zipCode || '---'} → 🗺
      </a>
    `;

  const actionButtonHtml = isCompleted
    ? `
      <button style="background: rgba(37,99,235,0.05); border: 1px solid rgba(37,99,235,0.15); color: rgba(255,255,255,0.3); pointer-events: none;"
        class="h-9 px-5 rounded-xl text-xs font-black tracking-wide select-none opacity-40">
        配布詳細へ →
      </button>
    `
    : `
      <button ontouchstart="" onclick="openDetail('${s.name}')"
        style="background: rgba(37,99,235,0.12); border: 1px solid rgba(37,99,235,0.3); color: #fff; transition: transform 75ms ease-out; white-space: nowrap;"
        onpointerdown="this.style.transform='scale(0.96)'"
        onpointerup="this.style.transform=''"
        onpointerleave="this.style.transform=''"
        class="h-9 px-5 rounded-xl text-xs font-black tracking-wide select-none">
        配布詳細へ →
      </button>
    `;

  return `
    <div id="area-card-${s.name}" class="premium-glass py-5 px-6 flex items-center justify-center">
      <div style="display: inline-flex; flex-direction: column; align-items: stretch; gap: 8px; text-align: center;">
        ${googleMapsButtonHtml}
        <div class="${fontSizeClass} font-black text-white tracking-tight leading-snug" style="text-wrap: balance; padding: 4px 0;">
          ${cleanAddress}
        </div>
        <div class="text-sm text-[#00B7FF]">${s.progress}%</div>
        <div class="flex items-center justify-center">
          ${leftDummy}
          <div style="background: rgba(34, 197, 94, 0.08); border: 1px solid rgba(34, 197, 94, 0.25); height: 22px; font-size: 10px; color: #22c55e; white-space: nowrap; flex-shrink: 0;" class="inline-flex items-center justify-center px-2.5 font-bold rounded-full tracking-wider font-mono">
            ${s.done || 0}/ ${s.total || 0}
          </div>
          ${rightLabel}
        </div>
        ${actionButtonHtml}
      </div>
    </div>
  `;
};
