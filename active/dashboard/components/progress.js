// POSTING MAP Component: progress.js (Stateless, API-free rendering)
window.renderProgressBar = function(done, total) {
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  return `
    <div class="space-y-1.5 w-full">
      <div class="flex justify-between items-baseline">
        <span class="text-[9px] font-bold text-white/40 tracking-wider">PROGRESS</span>
        <span class="text-xs font-black text-white/90 font-mono">${done.toLocaleString()} / ${total.toLocaleString()} (${percent}%)</span>
      </div>
      <div class="w-full h-2 bg-white/5 border border-white/5 rounded-full overflow-hidden relative">
        <div style="width: ${percent}%;" class="h-full bg-gradient-to-r from-[#00B7FF] to-[#0088FF] rounded-full transition-all duration-500"></div>
      </div>
    </div>
  `;
};

window.renderProgressRing = function(percent) {
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;
  return `
    <div class="relative w-12 h-12 flex items-center justify-center">
      <svg class="w-full h-full transform -rotate-90">
        <circle cx="24" cy="24" r="${radius}" stroke="rgba(255,255,255,0.06)" stroke-width="3" fill="transparent" />
        <circle cx="24" cy="24" r="${radius}" stroke="#00B7FF" stroke-width="3" fill="transparent"
          stroke-dasharray="${circumference}" stroke-dashoffset="${offset}" class="transition-all duration-500" />
      </svg>
      <span class="absolute text-[9px] font-black text-white font-mono">${percent}%</span>
    </div>
  `;
};
