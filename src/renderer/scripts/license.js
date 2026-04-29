/* ─── License Activation Page ─────────────────────────────────────────── */
const api = window.electronAPI;

const keyInput = document.getElementById('license-key-input');
const btnActivate = document.getElementById('btn-activate');
const errorBox = document.getElementById('license-error');
const activateText = document.getElementById('activate-text');
const activateSpinner = document.getElementById('activate-spinner');

document.getElementById('btn-close').addEventListener('click', () => api.close());

// Machine ID display
api.getMachineId().then(id => {
  document.getElementById('machine-id-display').textContent =
    id ? id.substring(0, 24) + '...' : 'Unavailable';
});

// Enable activate button only when key is non-empty
keyInput.addEventListener('input', () => {
  const val = keyInput.value.trim();
  btnActivate.disabled = val.length < 8;
  errorBox.style.display = 'none';
});

// Auto-format key as uppercase with dashes
keyInput.addEventListener('keyup', (e) => {
  if (e.key === 'Enter' && !btnActivate.disabled) {
    btnActivate.click();
  }
});

btnActivate.addEventListener('click', async () => {
  const key = keyInput.value.trim().toUpperCase();
  if (!key) return;

  setLoading(true);
  errorBox.style.display = 'none';

  try {
    const result = await api.validateLicense(key);
    if (result.valid) {
      activateText.textContent = 'Activating...';
    } else {
      showError(result.message || 'Invalid license key. Please try again.');
    }
  } catch (err) {
    showError('Connection error. Please check your internet connection.');
  } finally {
    setLoading(false);
  }
});

function setLoading(loading) {
  btnActivate.disabled = loading;
  activateText.style.display = loading ? 'none' : 'inline';
  activateSpinner.style.display = loading ? 'inline-block' : 'none';
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.style.display = 'block';
  keyInput.style.borderColor = 'var(--red)';
  setTimeout(() => {
    keyInput.style.borderColor = '';
  }, 2000);
}
