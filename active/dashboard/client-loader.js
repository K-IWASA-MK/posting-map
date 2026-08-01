/**
 * POSTING MAP
 * Client Configuration dynamic loader (Root Level)
 */
(function() {
  // GAS Server-side Environment Safety Guard
  if (typeof window === 'undefined' || typeof document === 'undefined' || typeof URLSearchParams === 'undefined') {
    return;
  }

  // iframe内での二重ロードを完全に防止
  if (window !== window.top) {
    return;
  }

  // 1. Resolve client from Query Parameter
  const urlParams = new URLSearchParams(window.location.search);
  let client = urlParams.get('client');
  
  if (client) {
    // Sanitize client ID to prevent directory traversal
    client = client.replace(/[^a-zA-Z0-9_-]/g, '');
    localStorage.setItem('PMS_ACTIVE_CLIENT', client);
  } else {
    // 2. Fallback to LocalStorage
    client = localStorage.getItem('PMS_ACTIVE_CLIENT');
  }
  
  // 3. Fallback to default client
  if (!client) {
    client = "MIE-03";
  }
  
  const basePath = (window.location.pathname.includes('/app/') || window.location.pathname.endsWith('/app')) ? '../clients/' : 'clients/';
  console.log(`[PMS Loader] Resolving environment config from basePath: ${basePath} for client: ${client}`);
  document.write(`<script src="${basePath}${client}/config.js"><\/script>`);
})();
