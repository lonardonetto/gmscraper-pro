/* ─── GMScraper Pro — Renderer Script ──────────────────────────────────── */
const api = window.electronAPI;

// ─── Navigation ────────────────────────────────────────────────────────────
const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page');

function navigateTo(pageId) {
  navItems.forEach(i => i.classList.toggle('active', i.dataset.page === pageId));
  pages.forEach(p => p.classList.toggle('active', p.id === `page-${pageId}`));
  if (pageId === 'dashboard') loadDashboard();
  if (pageId === 'results') loadSessions();
  if (pageId === 'settings') loadSettings();
}

navItems.forEach(item => {
  item.addEventListener('click', () => navigateTo(item.dataset.page));
});

document.getElementById('quick-start-btn').addEventListener('click', () => navigateTo('scraper'));

// ─── Title bar ─────────────────────────────────────────────────────────────
document.getElementById('btn-minimize').addEventListener('click', () => api.minimize());
document.getElementById('btn-maximize').addEventListener('click', () => api.maximize());
document.getElementById('btn-close').addEventListener('click', () => api.close());

// ─── Dashboard ─────────────────────────────────────────────────────────────
async function loadDashboard() {
  try {
    const stats = await api.getStats();
    document.getElementById('stat-sessions').textContent = stats.totalSessions ?? 0;
    document.getElementById('stat-results').textContent = stats.totalResults ?? 0;

    const tbody = document.getElementById('recent-sessions-body');
    if (stats.recentSessions?.length) {
      tbody.innerHTML = stats.recentSessions.map(s => `
        <tr>
          <td>${escHtml(s.name)}</td>
          <td>${s.result_count}</td>
          <td>${formatDate(s.created_at)}</td>
        </tr>
      `).join('');
    } else {
      tbody.innerHTML = '<tr><td colspan="3" class="empty-row">No sessions yet</td></tr>';
    }

    const lic = await api.getLicenseInfo();
    if (lic.plan) {
      document.getElementById('license-plan').textContent = lic.plan;
    }
  } catch (err) {
    console.error('Dashboard load error:', err);
  }
}

// ─── Scraper ───────────────────────────────────────────────────────────────
const btnStart = document.getElementById('btn-start-scrape');
const btnStop = document.getElementById('btn-stop-scrape');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const scraperBadge = document.getElementById('scraper-badge');
const logConsole = document.getElementById('log-console');

function addLog(entry) {
  const div = document.createElement('div');
  const now = new Date().toLocaleTimeString('en', { hour12: false });
  div.className = `log-entry log-${entry.level || 'info'}`;
  div.setAttribute('data-time', `[${now}]`);
  div.textContent = entry.message;
  logConsole.appendChild(div);
  logConsole.scrollTop = logConsole.scrollHeight;

  // Keep max 200 log lines
  while (logConsole.children.length > 200) {
    logConsole.removeChild(logConsole.firstChild);
  }
}

function setScraperUI(running) {
  btnStart.disabled = running;
  btnStop.disabled = !running;
  scraperBadge.className = `badge ${running ? 'badge-purple' : 'badge-green'}`;
  scraperBadge.textContent = running ? 'Running' : 'Idle';
  document.getElementById('stat-status').textContent = running ? 'Running' : 'Ready';
}

api.on('scraper-progress', (p) => {
  progressFill.style.width = `${p.percent}%`;
  progressText.textContent = `${p.current} / ${p.total}`;
});

api.on('scraper-log', (entry) => addLog(entry));

api.on('scraper-status', (s) => setScraperUI(s.running));

api.on('scraper-complete', (data) => {
  addLog({ level: 'success', message: `Done! Extracted ${data.count} results.` });
  progressFill.style.width = '100%';
  loadDashboard();
});

api.on('scraper-error', (msg) => {
  addLog({ level: 'error', message: `Error: ${msg}` });
  setScraperUI(false);
});

btnStart.addEventListener('click', async () => {
  const keyword = document.getElementById('inp-keyword').value.trim();
  const location = document.getElementById('inp-location').value.trim();

  if (!keyword || !location) {
    addLog({ level: 'error', message: 'Keyword and Location are required.' });
    return;
  }

  const config = {
    keyword,
    location,
    limit: parseInt(document.getElementById('inp-limit').value) || 50,
    delay: parseInt(document.getElementById('inp-delay').value) || 1000,
    sessionName: document.getElementById('inp-session').value.trim() || `${keyword} - ${location}`,
    proxy: document.getElementById('inp-proxy').value.trim() || null
  };

  progressFill.style.width = '0%';
  progressText.textContent = '0 / 0';
  addLog({ level: 'info', message: `Starting: "${config.keyword}" in "${config.location}"` });
  setScraperUI(true);

  const result = await api.startScrape(config);
  if (!result.success) {
    addLog({ level: 'error', message: result.message });
    setScraperUI(false);
  }
});

btnStop.addEventListener('click', () => {
  api.stopScrape();
  addLog({ level: 'warn', message: 'Stop requested...' });
  setScraperUI(false);
});

document.getElementById('btn-clear-log').addEventListener('click', () => {
  logConsole.innerHTML = '<div class="log-entry log-info">Log cleared.</div>';
});

// ─── Results ───────────────────────────────────────────────────────────────
let allResults = [];

async function loadSessions() {
  const sessions = await api.getSessions();
  const select = document.getElementById('session-select');
  select.innerHTML = '<option value="">— Select Session —</option>' +
    sessions.map(s => `<option value="${s.id}">${escHtml(s.name)} (${s.result_count})</option>`).join('');
}

async function loadResults(sessionId) {
  allResults = await api.getResults(sessionId);
  renderResults(allResults);
}

function renderResults(data) {
  const tbody = document.getElementById('results-tbody');
  document.getElementById('results-count').textContent = `${data.length} result${data.length !== 1 ? 's' : ''}`;

  if (!data.length) {
    tbody.innerHTML = '<tr><td colspan="8" class="empty-row">No results found</td></tr>';
    return;
  }

  tbody.innerHTML = data.map((r, i) => `
    <tr>
      <td>${i + 1}</td>
      <td title="${escHtml(r.name)}">${escHtml(r.name)}</td>
      <td title="${escHtml(r.address)}">${escHtml(r.address)}</td>
      <td>${escHtml(r.phone)}</td>
      <td title="${escHtml(r.website)}"><a class="link" href="#" data-url="${escHtml(r.website)}">${truncate(r.website, 30)}</a></td>
      <td>${r.rating ? `⭐ ${r.rating}` : '—'}</td>
      <td>${r.review_count || '—'}</td>
      <td>${escHtml(r.category)}</td>
    </tr>
  `).join('');
}

document.getElementById('session-select').addEventListener('change', (e) => {
  if (e.target.value) loadResults(e.target.value);
  else {
    allResults = [];
    renderResults([]);
  }
});

document.getElementById('results-search').addEventListener('input', (e) => {
  const q = e.target.value.toLowerCase();
  const filtered = allResults.filter(r =>
    Object.values(r).some(v => String(v || '').toLowerCase().includes(q))
  );
  renderResults(filtered);
});

document.getElementById('btn-delete-session').addEventListener('click', async () => {
  const sessionId = document.getElementById('session-select').value;
  if (!sessionId) return;
  if (!confirm('Delete this session and all its results?')) return;
  await api.deleteSession(parseInt(sessionId));
  allResults = [];
  renderResults([]);
  loadSessions();
  loadDashboard();
});

// Export
async function doExport(type) {
  const sessionId = document.getElementById('session-select').value;
  if (!sessionId) { alert('Select a session first'); return; }

  const ext = type === 'csv' ? 'csv' : 'xlsx';
  const { filePath, canceled } = await api.showSaveDialog({
    defaultPath: `gmap-results.${ext}`,
    filters: [{ name: type.toUpperCase(), extensions: [ext] }]
  });

  if (canceled || !filePath) return;

  const result = type === 'csv'
    ? await api.exportCSV({ sessionId: parseInt(sessionId), filePath })
    : await api.exportExcel({ sessionId: parseInt(sessionId), filePath });

  if (result.success) {
    if (confirm(`Exported to: ${filePath}\n\nOpen folder?`)) {
      api.openPath(filePath);
    }
  } else {
    alert(`Export failed: ${result.message}`);
  }
}

document.getElementById('btn-export-csv').addEventListener('click', () => doExport('csv'));
document.getElementById('btn-export-excel').addEventListener('click', () => doExport('excel'));

// ─── Settings ──────────────────────────────────────────────────────────────
async function loadSettings() {
  const settings = await api.getSettings();
  if (settings.limit) document.getElementById('set-limit').value = settings.limit;
  if (settings.delay) document.getElementById('set-delay').value = settings.delay;
  if (settings.headless !== undefined) document.getElementById('set-headless').checked = settings.headless;
  if (settings.rotation !== undefined) document.getElementById('set-rotation').checked = settings.rotation;

  const proxies = await api.getProxyList();
  document.getElementById('set-proxies').value = proxies.join('\n');

  const lic = await api.getLicenseInfo();
  document.getElementById('lic-status').textContent = lic.valid ? 'Active' : 'Inactive';
  document.getElementById('lic-status').className = `badge ${lic.valid ? 'badge-green' : 'badge-red'}`;
  document.getElementById('lic-plan').textContent = lic.plan || '—';
  document.getElementById('lic-expires').textContent = lic.expiresAt ? formatDate(lic.expiresAt) : 'Never';
  document.getElementById('lic-machine').textContent = lic.machineId ? lic.machineId.substring(0, 20) + '...' : '—';
}

document.getElementById('btn-save-settings').addEventListener('click', async () => {
  const proxiesRaw = document.getElementById('set-proxies').value
    .split('\n').map(p => p.trim()).filter(Boolean);

  await api.saveProxyList(proxiesRaw);
  await api.saveSettings({
    limit: parseInt(document.getElementById('set-limit').value),
    delay: parseInt(document.getElementById('set-delay').value),
    headless: document.getElementById('set-headless').checked,
    rotation: document.getElementById('set-rotation').checked
  });

  const fb = document.getElementById('save-feedback');
  fb.textContent = '✓ Settings saved';
  setTimeout(() => { fb.textContent = ''; }, 2500);
});

document.getElementById('btn-test-proxy').addEventListener('click', async () => {
  const proxiesRaw = document.getElementById('set-proxies').value
    .split('\n').map(p => p.trim()).filter(Boolean);
  if (!proxiesRaw.length) {
    document.getElementById('proxy-test-result').textContent = 'No proxy entered';
    return;
  }
  const resultEl = document.getElementById('proxy-test-result');
  resultEl.style.color = 'var(--text-muted)';
  resultEl.textContent = 'Testing...';
  const res = await api.testProxy(proxiesRaw[0]);
  resultEl.style.color = res.success ? 'var(--green)' : 'var(--red)';
  resultEl.textContent = res.message;
});

document.getElementById('btn-deactivate').addEventListener('click', async () => {
  if (!confirm('Deactivate your license on this machine?')) return;
  const result = await api.deactivateLicense();
  if (result.success) {
    alert('License deactivated. App will restart.');
    location.reload();
  } else {
    alert(`Error: ${result.message}`);
  }
});

// ─── Auto-update ────────────────────────────────────────────────────────────
api.on('update-available', (info) => {
  const toast = document.getElementById('update-toast');
  document.getElementById('update-toast-msg').textContent = `Version ${info.version} is available.`;
  toast.style.display = 'block';
});

api.on('update-downloaded', () => {
  document.getElementById('update-toast-msg').textContent = 'Ready to install. Click to restart.';
  document.getElementById('btn-download-update').textContent = 'Install & Restart';
  document.getElementById('btn-download-update').onclick = () => api.installUpdate();
});

api.on('update-progress', (p) => {
  document.getElementById('update-status').textContent =
    `Downloading... ${Math.round(p.percent)}%`;
});

document.getElementById('btn-download-update').addEventListener('click', () => {
  api.downloadUpdate();
  document.getElementById('btn-download-update').disabled = true;
  document.getElementById('btn-download-update').textContent = 'Downloading...';
  document.getElementById('update-status').textContent = 'Starting download...';
});

document.getElementById('btn-dismiss-update').addEventListener('click', () => {
  document.getElementById('update-toast').style.display = 'none';
});

document.getElementById('btn-check-update').addEventListener('click', async () => {
  document.getElementById('update-status').textContent = 'Checking for updates...';
  try {
    await api.checkUpdate();
    setTimeout(() => {
      if (!document.getElementById('update-toast').style.display === 'block') {
        document.getElementById('update-status').textContent = 'You are on the latest version.';
      }
    }, 4000);
  } catch {
    document.getElementById('update-status').textContent = 'Could not check for updates.';
  }
});

// ─── Utilities ──────────────────────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function truncate(str, maxLen) {
  if (!str) return '—';
  return str.length > maxLen ? str.substring(0, maxLen) + '…' : str;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleString('en', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return dateStr;
  }
}

// ─── Boot ───────────────────────────────────────────────────────────────────
loadDashboard();
