// POSTING MAP Component: list-item.js (Stateless, API-free rendering)
window.renderPointCard = function(p) {
  const statusDot = p.isDone 
    ? 'background-color: #00B7FF; box-shadow: 0 0 10px rgba(0, 183, 255, 0.6);' 
    : 'background-color: rgba(255, 255, 255, 0.2);';
  const statusText = p.isDone ? '🔒 完了' : '未完了';
  const statusColor = p.isDone ? 'color: #00B7FF;' : 'color: rgba(255, 255, 255, 0.4);';

  const _s = p.syncStatus;
  const syncBadge = (() => {
    if (!_s) return '';
    if (_s === 'SYNCING'  || _s === 'sending') return ` <span style="color:#00B7FF;font-size:7px;font-weight:900;letter-spacing:0.1em">●</span>`;
    if (_s === 'RETRY'    || _s === 'failed')  return ` <span style="color:#ef4444;font-size:7px;font-weight:900;letter-spacing:0.08em">RETRY</span>`;
    if (_s === 'PENDING'  || _s === 'pending') return ` <span style="color:#f59e0b;font-size:7px;font-weight:900;letter-spacing:0.08em">⋯</span>`;
    return '';
  })();

  const nameLineHtml = p.isDone && p.staffName
    ? `
      <div class="w-full flex justify-center mt-0.5">
        <div style="background: rgba(16,185,129,0.08); border: 1px solid rgba(16,185,129,0.25); height: 22px; font-size: 10px; color: #10b981;" class="inline-flex items-center justify-center h-[22px] px-2.5 text-[10px] font-bold text-[#10b981] rounded-full tracking-wider">
          ${p.staffName}
        </div>
      </div>`
    : '';

  const onclickAttr = p.isDone ? '' : `onclick="openPointDetailModal(${p.rowId})"`;
  const cardClass = p.isDone
    ? "premium-glass p-5 flex flex-col items-center justify-center gap-2 text-center"
    : "clickable-card premium-glass p-5 flex flex-col items-center justify-center gap-2 text-center";

  const cleanAddress = p.address ? p.address.replace(/^〒\d{3}-\d{4}\s*/, '') : '';

  return `
    <div class="${cardClass}" ${onclickAttr}>
      <div class="w-full flex justify-center">
        <div style="background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); height: 26px; font-size: 12px; color: rgba(255, 255, 255, 0.9);" class="inline-flex items-center justify-center px-3 font-bold rounded-full tracking-wide truncate max-w-full">
          🏠 ${cleanAddress}
        </div>
      </div>
      <div style="${statusColor}" class="text-[9px] font-bold uppercase tracking-widest flex items-center justify-center gap-1.5 w-full">
        <span style="${statusDot}" class="w-1.5 h-1.5 rounded-full inline-block"></span>
        <span>${statusText} ${p.isDone && p.count ? `· ${p.count}枚` : ''}${syncBadge}</span>
      </div>
      ${nameLineHtml}
    </div>`;
};
