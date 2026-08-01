const API_URL = "https://script.google.com/macros/s/AKfycbwgiOFU5iudUS6UscNU-MZhnxZJaqJHywVA9ivA-GE0uLe02fi7mmBU474lWa1TD7-R/exec";

let allWorkspaces = [];

window.addEventListener('DOMContentLoaded', () => {
  checkAuth();
});

function checkAuth() {
  const isAuth = sessionStorage.getItem('is_ops_authenticated') === 'true';
  if (isAuth) {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('operations-app').classList.remove('hidden');
    loadDashboardData();
  } else {
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('operations-app').classList.add('hidden');
    showLoading(false);
  }
}

function handleOperationsLogin() {
  // Simple session authentication flag mock for Phase S5-11
  sessionStorage.setItem('is_ops_authenticated', 'true');
  checkAuth();
}

function logout() {
  sessionStorage.removeItem('is_ops_authenticated');
  checkAuth();
}

function showLoading(show) {
  const loader = document.getElementById('loading-overlay');
  if (show) {
    loader.classList.remove('opacity-0', 'pointer-events-none');
  } else {
    loader.classList.add('opacity-0', 'pointer-events-none');
  }
}

async function loadDashboardData() {
  showLoading(true);
  try {
    const url = `${API_URL}?action=operations/dashboard/workspaces`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`API response error: ${response.status}`);
    }
    const data = await response.json();
    // Assuming API structure returns success wrapped or raw array
    allWorkspaces = Array.isArray(data) ? data : (data.data || []);
    renderDashboard();
  } catch (error) {
    console.error('Failed to load operations dashboard data:', error);
    alert('データ情報の取得に失敗しました。');
  } finally {
    showLoading(false);
  }
}

function renderDashboard(workspacesToRender = allWorkspaces) {
  // Calculate KPIs
  let activeCount = 0;
  let suspendedCount = 0;
  let warningCount = 0;

  workspacesToRender.forEach(w => {
    if (w.status === 'ACTIVE') {
      activeCount++;
      if (w.remainingDays > 0 && w.remainingDays <= 7) {
        warningCount++;
      }
    } else if (w.status === 'SUSPENDED') {
      suspendedCount++;
    }
  });

  document.getElementById('kpi-active-count').textContent = `${activeCount}支部`;
  document.getElementById('kpi-suspended-count').textContent = `${suspendedCount}支部`;
  document.getElementById('kpi-warning-count').textContent = `${warningCount}支部`;

  // Render Table
  const tbody = document.getElementById('workspaces-table-body');
  tbody.innerHTML = '';

  if (workspacesToRender.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="5" class="py-8 text-center text-secondary text-xs">
          ワークスペース情報が見つかりません。
        </td>
      </tr>
    `;
    return;
  }

  workspacesToRender.forEach(w => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-white/5 transition-colors border-b border-default';

    // Status Badge Style
    let statusClass = 'text-gray-400 bg-gray-400/10 border-gray-400/20';
    if (w.status === 'ACTIVE') {
      statusClass = 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20';
    } else if (w.status === 'SUSPENDED') {
      statusClass = 'text-red-400 bg-red-400/10 border-red-400/20';
    }

    // Expiry Date format
    const expiresDate = new Date(w.expiresAt);
    const dateString = isNaN(expiresDate.getTime()) || expiresDate.getTime() === 0
      ? '-'
      : `${expiresDate.getFullYear()}/${String(expiresDate.getMonth() + 1).padStart(2, '0')}/${String(expiresDate.getDate()).padStart(2, '0')}`;

    // Remaining Days Style
    let remainingDaysClass = 'text-white';
    if (w.remainingDays === 0) {
      remainingDaysClass = 'text-red-400 font-bold';
    } else if (w.remainingDays <= 7) {
      remainingDaysClass = 'text-amber-400 font-bold';
    }

    tr.innerHTML = `
      <td class="py-4 px-2 font-mono text-xs text-white">${w.workspaceId}</td>
      <td class="py-4 px-2 font-bold text-white">${w.workspaceName}</td>
      <td class="py-4 px-2">
        <span class="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${statusClass}">
          ${w.status}
        </span>
      </td>
      <td class="py-4 px-2 text-xs">${dateString}</td>
      <td class="py-4 px-2 text-right text-xs ${remainingDaysClass}">残り ${w.remainingDays}日</td>
    `;
    tbody.appendChild(tr);
  });
}

function handleSearch() {
  const query = document.getElementById('search-input').value.toLowerCase().trim();
  if (!query) {
    renderDashboard(allWorkspaces);
    return;
  }

  const filtered = allWorkspaces.filter(w => 
    w.workspaceId.toLowerCase().includes(query) ||
    w.workspaceName.toLowerCase().includes(query)
  );
  renderDashboard(filtered);
}

async function handleOnboarding(event) {
  event.preventDefault();
  const nameInput = document.getElementById('onboard-name-input');
  const workspaceName = nameInput.value.trim();
  if (!workspaceName) return;

  showLoading(true);
  try {
    const url = `${API_URL}`;
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify({
        action: 'operations/workspaces',
        version: 'v2',
        workspaceName: workspaceName
      })
    });
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    const resData = await response.json();
    const payload = resData.data || resData;

    // Show result
    document.getElementById('result-id').textContent = payload.workspaceId || '-';
    document.getElementById('result-line').textContent = payload.lineAppUrl || '-';
    document.getElementById('result-line').href = payload.lineAppUrl || '#';
    document.getElementById('result-dashboard').textContent = payload.dashboardUrl || '-';
    document.getElementById('result-dashboard').href = payload.dashboardUrl || '#';
    document.getElementById('onboarding-result').classList.remove('hidden');

    // Reset input and reload list
    nameInput.value = '';
    await loadDashboardData();
  } catch (error) {
    console.error('Failed to create workspace:', error);
    alert('ワークスペースの作成に失敗しました。');
  } finally {
    showLoading(false);
  }
}
