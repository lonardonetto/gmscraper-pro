const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  winMinimize:   ()       => ipcRenderer.send('win-minimize'),
  winMaximize:   ()       => ipcRenderer.send('win-maximize'),
  winClose:      ()       => ipcRenderer.send('win-close'),
  listLicenses:  ()       => ipcRenderer.invoke('list-licenses'),
  generateKeys:  (opts)   => ipcRenderer.invoke('generate-keys', opts),
  deleteLicense: (key)    => ipcRenderer.invoke('delete-license', key),
  exportCsv:     (keys)   => ipcRenderer.invoke('export-keys-csv', keys),
  getActivations:   (key) => ipcRenderer.invoke('get-activations', key),
  resetActivation:  (key) => ipcRenderer.invoke('reset-activation', key),
  backupDb:      ()       => ipcRenderer.invoke('backup-db'),
  restoreDb:     ()       => ipcRenderer.invoke('restore-db'),
});
