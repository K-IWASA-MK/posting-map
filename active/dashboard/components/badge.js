// POSTING MAP Component: badge.js (Stateless, API-free rendering)
window.renderStatusBadge = function(status) {
  let badgeClass = 'text-white/40 bg-white/5 border-white/10';
  let badgeLabel = status || 'OFFLINE';

  if (status === 'ONLINE') {
    badgeClass = 'text-[#22c55e] bg-[#22c55e]/10 border-[#22c55e]/30 shadow-[0_0_8px_rgba(34,197,94,0.2)]';
  } else if (status === 'SYNCING') {
    badgeClass = 'text-[#f59e0b] bg-[#f59e0b]/10 border-[#f59e0b]/30';
  } else if (status === 'ERROR') {
    badgeClass = 'text-[#ef4444] bg-[#ef4444]/10 border-[#ef4444]/30';
  }

  return `
    <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black border uppercase tracking-wider ${badgeClass}">
      ${badgeLabel === 'ONLINE' ? '<span class="w-1.5 h-1.5 bg-[#22c55e] rounded-full shadow-[0_0_6px_#22c55e]"></span>' : ''}
      ${badgeLabel}
    </span>
  `;
};
