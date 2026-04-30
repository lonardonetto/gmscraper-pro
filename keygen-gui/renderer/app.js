let allLicenses   = [];
let allDeviceRows = [];
let lastGeneratedKeys = [];

// ── Init ────────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', async () => {
  await loadDashboard();
});

// ── Panel switching ──────────────────────────────────────────────────────────
function switchPanel(name, btn) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('panel-' + name).classList.add('active');
  btn.classList.add('active');
  if (name === 'dashboard') loadDashboard();
  if (name === 'manage')    loadManage();
  if (name === 'devices')   loadDevices();
}

// ── Toast ────────────────────────────────────────────────────────────────────
let toastTimer = null;
function toast(msg, type = 'success') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className = 'show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.className = ''; }, 3200);
}

// ── Backup / Restore ─────────────────────────────────────────────────────────
async function backupDb() {
  const r = await api.backupDb();
  if (r && r.ok) toast('✅ Backup saved: ' + r.path.split('\\').pop());
}

async function restoreDb() {
  if (!confirm('Restore will replace ALL current data with the backup.\nContinue?')) return;
  const r = await api.restoreDb();
  if (r && r.ok) {
    toast('✅ Database restored successfully');
    await loadDashboard();
  } else if (r && r.error) {
    toast('Restore failed: ' + r.error, 'error');
  }
}

// ── Dashboard ─────────────────────────────────────────────────────────────────
async function loadDashboard() {
  allLicenses = await api.listLicenses();

  const now     = new Date();
  const total   = allLicenses.length;
  const active  = allLicenses.filter(l => Number(l.activation_count) > 0).length;
  const unused  = allLicenses.filter(l => Number(l.activation_count) === 0).length;
  const expired = allLicenses.filter(l => l.expires_at && new Date(l.expires_at) < now).length;

  document.getElementById('stat-total').textContent   = total;
  document.getElementById('stat-active').textContent  = active;
  document.getElementById('stat-unused').textContent  = unused;
  document.getElementById('stat-expired').textContent = expired;

  const tbody  = document.getElementById('tbody-recent');
  const recent = allLicenses.slice(0, 10);
  if (!recent.length) {
    tbody.innerHTML = `<tr><td colspan="5"><div class="empty-state"><div class="icon">🔑</div>No keys yet. Generate some!</div></td></tr>`;
    return;
  }
  tbody.innerHTML = recent.map(r => {
    const locked = Number(r.activation_count) > 0;
    return `<tr>
      <td class="key-cell">
        ${r.key}
        <button class="copy-btn" onclick="copyText('${r.key}')" title="Copy">📋</button>
      </td>
      <td><span class="badge badge-purple">${r.plan}</span></td>
      <td>${locked ? '<span class="badge badge-green">Locked to device</span>' : '<span class="badge badge-purple">Unused</span>'}</td>
      <td>${(r.created_at || '').substring(0, 10)}</td>
      <td style="color:var(--muted)">${r.notes || '—'}</td>
    </tr>`;
  }).join('');
}

// ── Generate ──────────────────────────────────────────────────────────────────
async function generateKeys() {
  const count     = parseInt(document.getElementById('gen-count').value) || 1;
  const plan      = document.getElementById('gen-plan').value;
  const expiresAt = document.getElementById('gen-expires').value || null;
  const notes     = document.getElementById('gen-notes').value.trim();

  if (count < 1 || count > 1000) { toast('Count must be 1–1000', 'error'); return; }

  const r = await api.generateKeys({ count, plan, maxActivations: 1, expiresAt, notes });
  if (!r.ok) { toast('Error: ' + r.error, 'error'); return; }

  lastGeneratedKeys = r.keys;
  document.getElementById('keys-output').textContent = r.keys.join('\n');

  const card = document.getElementById('gen-result');
  card.classList.add('show');
  card.scrollIntoView({ behavior: 'smooth' });

  // Handle sync result messages
  if (r.info) {
    toast(`Generated ${r.keys.length} key(s) - ${r.info}`, 'info');
  } else if (r.warning) {
    toast(`Generated ${r.keys.length} key(s) - ${r.warning}`, 'warning');
  } else {
    toast(`Generated ${r.keys.length} key(s)`);
  }
  
  loadDashboard();
}

function clearGenForm() {
  document.getElementById('gen-count').value   = '1';
  document.getElementById('gen-plan').value    = 'pro';
  document.getElementById('gen-expires').value = '';
  document.getElementById('gen-notes').value   = '';
  document.getElementById('gen-result').classList.remove('show');
  lastGeneratedKeys = [];
}

async function copyAllKeys() {
  if (!lastGeneratedKeys.length) return;
  await navigator.clipboard.writeText(lastGeneratedKeys.join('\n'));
  toast('Copied ' + lastGeneratedKeys.length + ' key(s) to clipboard');
}

async function exportLastGenerated() {
  if (!lastGeneratedKeys.length) { toast('Nothing to export', 'error'); return; }
  const rows = allLicenses.filter(r => lastGeneratedKeys.includes(r.key));
  const res  = await api.exportCsv(rows);
  if (res && res.ok) toast('Exported to ' + res.path.split('\\').pop());
}

// ── Manage Keys ───────────────────────────────────────────────────────────────
async function loadManage() {
  allLicenses = await api.listLicenses();
  renderManageTable(allLicenses);
}

function renderManageTable(rows) {
  const tbody = document.getElementById('tbody-manage');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="icon">🔑</div>No keys found</div></td></tr>`;
    return;
  }
  const now = new Date();
  tbody.innerHTML = rows.map(r => {
    const expired = r.expires_at && new Date(r.expires_at) < now;
    const locked  = Number(r.activation_count) > 0;
    const devBadge = expired
      ? '<span class="badge badge-red">Expired</span>'
      : locked
        ? '<span class="badge badge-green">🔒 Locked</span>'
        : '<span class="badge badge-purple">Unused</span>';
    return `<tr>
      <td class="key-cell">
        ${r.key}
        <button class="copy-btn" onclick="copyText('${r.key}')" title="Copy">📋</button>
      </td>
      <td><span class="badge badge-purple">${r.plan}</span></td>
      <td>${devBadge}</td>
      <td>${r.expires_at ? r.expires_at.substring(0,10) : '<span style="color:var(--muted)">Never</span>'}</td>
      <td style="color:var(--muted);max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="${r.notes||''}">${r.notes||'—'}</td>
      <td>${(r.created_at||'').substring(0,10)}</td>
      <td style="display:flex;gap:5px">
        ${locked ? `<button class="btn btn-ghost" style="padding:4px 8px;font-size:11px" onclick="resetKey('${r.key}')" title="Reset device lock">🔓 Reset</button>` : ''}
        <button class="btn btn-danger" style="padding:4px 8px;font-size:11px" onclick="deleteKey('${r.key}')">🗑</button>
      </td>
    </tr>`;
  }).join('');
}

function filterTable() {
  const q = document.getElementById('search-input').value.toLowerCase();
  renderManageTable(!q ? allLicenses : allLicenses.filter(r =>
    (r.key||'').toLowerCase().includes(q) ||
    (r.plan||'').toLowerCase().includes(q) ||
    (r.notes||'').toLowerCase().includes(q)
  ));
}

async function resetKey(key) {
  if (!confirm(`Reset device lock for:\n${key}\n\nThe current device will be deactivated and the key can be used on a new device.`)) return;
  const r = await api.resetActivation(key);
  if (r && r.ok) {
    toast('✅ Device lock reset — key can now activate on a new device');
    loadManage();
    loadDashboard();
  } else {
    toast('Reset failed', 'error');
  }
}

async function deleteKey(key) {
  if (!confirm(`Permanently delete key:\n${key}\n\nThis cannot be undone.`)) return;
  const r = await api.deleteLicense(key);
  if (r && r.ok) {
    toast('Key deleted');
    loadManage();
    loadDashboard();
  } else {
    toast('Delete failed', 'error');
  }
}

async function exportAllKeys() {
  if (!allLicenses.length) { toast('No keys to export', 'error'); return; }
  const res = await api.exportCsv(allLicenses);
  if (res && res.ok) toast('Exported ' + allLicenses.length + ' keys → ' + res.path.split('\\').pop());
}

// ── Devices Panel ─────────────────────────────────────────────────────────────
async function loadDevices() {
  const licenses = await api.listLicenses();
  // Fetch activations for all locked licenses
  const rows = [];
  for (const lic of licenses) {
    const acts = await api.getActivations(lic.key);
    if (acts.length === 0) {
      rows.push({ lic, act: null });
    } else {
      for (const a of acts) rows.push({ lic, act: a });
    }
  }
  allDeviceRows = rows;
  renderDeviceTable(rows);
}

function renderDeviceTable(rows) {
  const tbody = document.getElementById('tbody-devices');
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="7"><div class="empty-state"><div class="icon">🖥️</div>No activations yet</div></td></tr>`;
    return;
  }
  tbody.innerHTML = rows.map(({ lic, act }) => {
    const active   = act && Number(act.is_active) === 1;
    const statusEl = !act
      ? '<span class="badge badge-purple">Unused</span>'
      : active
        ? '<span class="badge badge-green">🔒 Active</span>'
        : '<span class="badge" style="background:rgba(100,116,139,0.2);color:var(--muted)">Inactive</span>';
    const deviceId = act ? `<span class="device-id">${act.machine_id}</span>` : '<span style="color:var(--muted)">—</span>';
    const activated = act ? act.activated_at.substring(0, 16) : '—';
    const lastSeen  = act ? (act.last_validated || '').substring(0, 16) : '—';
    const resetBtn  = active
      ? `<button class="btn btn-ghost" style="padding:4px 10px;font-size:11px" onclick="resetKey('${lic.key}')">🔓 Reset</button>`
      : '';
    return `<tr>
      <td class="key-cell" style="font-size:11px">
        ${lic.key}
        <button class="copy-btn" onclick="copyText('${lic.key}')">📋</button>
      </td>
      <td><span class="badge badge-purple">${lic.plan}</span></td>
      <td>${statusEl}</td>
      <td style="max-width:160px;overflow:hidden;text-overflow:ellipsis">${deviceId}</td>
      <td style="color:var(--muted);font-size:11px">${activated}</td>
      <td style="color:var(--muted);font-size:11px">${lastSeen}</td>
      <td>${resetBtn}</td>
    </tr>`;
  }).join('');
}

function filterDeviceTable() {
  const q = document.getElementById('dev-search').value.toLowerCase();
  renderDeviceTable(!q ? allDeviceRows : allDeviceRows.filter(({ lic }) =>
    (lic.key||'').toLowerCase().includes(q) ||
    (lic.notes||'').toLowerCase().includes(q)
  ));
}

// ── Utilities ─────────────────────────────────────────────────────────────────
async function copyText(text) {
  await navigator.clipboard.writeText(text);
  toast('Copied!');
}
