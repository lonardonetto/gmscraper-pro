const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  maximize: () => ipcRenderer.send('window-maximize'),
  close: () => ipcRenderer.send('window-close'),

  // License
  validateLicense: (key) => ipcRenderer.invoke('validate-license', key),
  getLicenseInfo: () => ipcRenderer.invoke('get-license-info'),
  deactivateLicense: () => ipcRenderer.invoke('deactivate-license'),
  getMachineId: () => ipcRenderer.invoke('get-machine-id'),

  // Scraper
  startScrape: (config) => ipcRenderer.invoke('start-scrape', config),
  stopScrape: () => ipcRenderer.send('stop-scrape'),

  // Results / Sessions
  getSessions: () => ipcRenderer.invoke('get-sessions'),
  getResults: (sessionId) => ipcRenderer.invoke('get-results', sessionId),
  deleteSession: (sessionId) => ipcRenderer.invoke('delete-session', sessionId),
  getStats: () => ipcRenderer.invoke('get-stats'),

  // Export
  exportCSV: (params) => ipcRenderer.invoke('export-csv', params),
  exportExcel: (params) => ipcRenderer.invoke('export-excel', params),
  showSaveDialog: (options) => ipcRenderer.invoke('show-save-dialog', options),
  openPath: (filePath) => ipcRenderer.invoke('open-path', filePath),

  // Settings
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings) => ipcRenderer.invoke('save-settings', settings),

  // Proxy
  testProxy: (proxy) => ipcRenderer.invoke('test-proxy', proxy),
  getProxyList: () => ipcRenderer.invoke('get-proxy-list'),
  saveProxyList: (proxies) => ipcRenderer.invoke('save-proxy-list', proxies),

  // Auto-update
  downloadUpdate: () => ipcRenderer.invoke('download-update'),
  installUpdate: () => ipcRenderer.invoke('install-update'),
  checkUpdate: () => ipcRenderer.invoke('check-update'),

  // Event listeners
  on: (channel, callback) => {
    const allowedChannels = [
      'scraper-progress', 'scraper-log', 'scraper-status',
      'scraper-complete', 'scraper-error',
      'update-available', 'update-downloaded', 'update-progress'
    ];
    if (allowedChannels.includes(channel)) {
      const subscription = (event, ...args) => callback(...args);
      ipcRenderer.on(channel, subscription);
      return () => ipcRenderer.removeListener(channel, subscription);
    }
  },

  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});
