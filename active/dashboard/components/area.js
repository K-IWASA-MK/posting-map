// POSTING MAP Component: area.js (Stateless, API-free rendering)




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

  const actionButtonHtml = isCompleted
    ? `
      <button style="background: rgba(37,99,235,0.05); border: 1px solid rgba(37,99,235,0.15); color: rgba(255,255,255,0.3); pointer-events: none;"
        class="h-9 px-5 rounded-xl text-xs font-black tracking-wide select-none opacity-40">
        配布詳細へ →
      </button>
    `
    : `
      <button ontouchstart="" onclick="typeof selectTown === 'function' ? selectTown(typeof currentCity !== 'undefined' ? currentCity : '', '${escapeHtml(s.name)}') : openDetail('${escapeHtml(s.name)}')"
        style="background: rgba(37,99,235,0.12); border: 1px solid rgba(37,99,235,0.3); color: #fff; transition: transform 75ms ease-out; white-space: nowrap;"
        onpointerdown="this.style.transform='scale(0.96)'"
        onpointerup="this.style.transform=''"
        onpointerleave="this.style.transform=''"
        class="h-9 px-5 rounded-xl text-xs font-black tracking-wide select-none">
        配布詳細へ →
      </button>
    `;

  return `
    <div id="area-card-${escapeHtml(s.name)}" class="premium-glass py-5 px-6 flex items-center justify-center">
      <div style="display: inline-flex; flex-direction: column; align-items: stretch; gap: 8px; text-align: center;">
        <div class="${fontSizeClass} font-black text-white tracking-tight leading-snug" style="text-wrap: balance; padding: 4px 0;">
          ${escapeHtml(cleanAddress)}
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
