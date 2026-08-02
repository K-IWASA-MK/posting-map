// POSTING MAP Component: ranking.js (Stateless, API-free rendering)
window.renderRankingCard = function(rankingData, myName) {
  if (!rankingData || !Array.isArray(rankingData)) return '';

  let myRank = -1;
  let myCount = 0;
  if (myName) {
    const idx = rankingData.findIndex(r => r.name === myName);
    if (idx !== -1) {
      myRank = idx + 1;
      myCount = rankingData[idx].count || 0;
    }
  }

  const rowsHtml = rankingData.map((item, index) => {
    const rank = index + 1;
    const isMe = myName && item.name === myName;
    const meBg = isMe ? 'style="border-color: rgba(0, 183, 255, 0.45); background: rgba(0, 183, 255, 0.08); shadow: 0 0 15px rgba(0,183,255,0.06);"' : '';
    const nameColor = isMe ? 'text-[#00B7FF]' : 'text-white/80';
    const rankBadgeColor = rank === 1 ? 'bg-[#f59e0b] text-black' : (rank === 2 ? 'bg-[#94a3b8] text-black' : (rank === 3 ? 'bg-[#b45309] text-white' : 'bg-white/5 text-white/50'));

    return `
      <div ${meBg} class="flex items-center justify-between p-4 rounded-2xl border border-white/5 bg-[#1C1C1E]/50">
        <div class="flex items-center gap-3">
          <span class="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black font-mono ${rankBadgeColor}">${rank}</span>
          <span class="text-sm font-black truncate max-w-[140px] ${nameColor}">${(item.name || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</span>
        </div>
        <span class="text-sm font-black text-white/90 font-mono">${(item.count || 0).toLocaleString()}枚</span>
      </div>
    `;
  }).join('');

  const myRankSummaryHtml = myRank !== -1 ? `
    <div class="premium-glass py-5 px-6 flex justify-around items-center border border-[#00B7FF]/20 shadow-[0_0_20px_rgba(0,183,255,0.05)]">
      <div class="text-center">
        <span class="text-[9px] font-bold text-white/30 tracking-wider block">現在の順位</span>
        <span class="text-2xl font-black text-[#00B7FF] font-mono">${myRank}位</span>
      </div>
      <div class="w-[1px] h-8 bg-white/10"></div>
      <div class="text-center">
        <span class="text-[9px] font-bold text-white/30 tracking-wider block">配布実績枚数</span>
        <span class="text-2xl font-black text-[#00B7FF] font-mono">${myCount.toLocaleString()}枚</span>
      </div>
    </div>
  ` : '';

  return `
    <div class="space-y-6">
      ${myRankSummaryHtml}
      <div class="space-y-2">
        <div class="text-[10px] font-black text-white/30 tracking-widest uppercase mb-1">ランキング一覧</div>
        ${rowsHtml}
      </div>
    </div>
  `;
};
