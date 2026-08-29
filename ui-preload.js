const { contextBridge, ipcRenderer } = require('electron');
function forward(channel){ ipcRenderer.on(channel, (_event, data) => window.dispatchEvent(new CustomEvent(channel, { detail: data }))); }
['taws:tab-created','taws:active','taws:navigation','taws:title','taws:favicon','taws:loading'].forEach(forward);
contextBridge.exposeInMainWorld('taws', {
  newTab: (url) => ipcRenderer.invoke('taws:new-tab', url),
  activate: (id) => ipcRenderer.invoke('taws:activate', id),
  navigate: (id,url) => ipcRenderer.invoke('taws:navigate', {id,url}),
  back: (id) => ipcRenderer.invoke('taws:back', id),
  forward: (id) => ipcRenderer.invoke('taws:forward', id),
  reload: (id) => ipcRenderer.invoke('taws:reload', id),
  closeTab: (id) => ipcRenderer.invoke('taws:close-tab', id),
  loadPasswords: () => ipcRenderer.invoke('taws:password-load'),
  savePasswords: (value) => ipcRenderer.invoke('taws:password-save', value)
});