// POSTING MAP Component: card.js (Stateless, API-free rendering)
window.renderCard = function(contentHtml, options = {}) {
  const className = options.className || '';
  return `
    <div class="premium-glass ${className}">
      ${contentHtml}
    </div>
  `;
};
