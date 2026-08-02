/**
 * POSTING MAP
 * Client Configuration Dynamic Loader & Multi-Tenant Resolver
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

  let client = null;

  try {
    // ① 通常ブラウザアクセス時のクエリパラメータ解析
    const urlParams = new URLSearchParams(window.location.search);
    client = urlParams.get('client');

    // ② LINE LIFF 経由アクセス時の退避パラメータ (liff.state) 解析
    if (!client) {
      const liffState = urlParams.get('liff.state');
      if (liffState) {
        const decodedState = decodeURIComponent(liffState);
        const stateParams = new URLSearchParams(decodedState.startsWith('?') ? decodedState : '?' + decodedState);
        client = stateParams.get('client');
      }
    }
  } catch (e) {
    console.warn('[PMS Loader] Error parsing client parameter:', e);
  }

  // ③ サニタイズ ＆ ストレージ永続化 ＆ フォールバック
  if (client) {
    client = client.replace(/[^a-zA-Z0-9_-]/g, '');
    localStorage.setItem('PMS_ACTIVE_CLIENT', client);
  } else {
    client = localStorage.getItem('PMS_ACTIVE_CLIENT') || 'MIE-03';
  }

  const pathname = (window.location && window.location.pathname) ? window.location.pathname : '/';
  let basePath = '../../clients/';
  
  if (pathname.includes('/active/')) {
    const rootPath = pathname.substring(0, pathname.indexOf('/active/'));
    basePath = rootPath + '/clients/';
  } else if (pathname.includes('/app/')) {
    const rootPath = pathname.substring(0, pathname.indexOf('/app/'));
    basePath = rootPath + '/clients/';
  } else {
    basePath = 'clients/';
  }

  console.log(`[PMS Loader] Active Tenant Client Resolved: ${client} (basePath: ${basePath})`);
  document.write(`<script src="${basePath}${client}/config.js"><\/script>`);
})();

