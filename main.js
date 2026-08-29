const { app, BrowserWindow, WebContentsView, ipcMain, safeStorage, session, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

let win;
let chromeView;
let activeId = null;
let nextId = 1;
const tabs = new Map();
const HOME = 'file://' + path.join(__dirname, 'home.html');

function uiSend(channel, data) {
  if (chromeView && !chromeView.webContents.isDestroyed()) chromeView.webContents.send(channel, data);
}
function normalize(input) {
  const v = String(input || '').trim();
  if (!v) return 'https://www.google.com';
  if (/^https?:\/\//i.test(v)) return v;
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(v)) return 'https://' + v;
  return 'https://www.google.com/search?q=' + encodeURIComponent(v);
}
function browserBounds() {
  const [w, h] = win.getContentSize();
  return { x: 0, y: 104, width: w, height: Math.max(1, h - 104) };
}
function syncTab(tab) {
  if (!tab) return;
  const wc = tab.view.webContents;
  tab.url = wc.getURL() || tab.url;
  tab.title = wc.getTitle() || tab.title || 'New Tab';
  uiSend('taws:tab', { id: tab.id, title: tab.title, url: tab.url, loading: wc.isLoading() });
  if (tab.id === activeId) {
    uiSend('taws:state', {
      id: tab.id, title: tab.title, url: tab.url, loading: wc.isLoading(),
      back: wc.navigationHistory.canGoBack(), forward: wc.navigationHistory.canGoForward()
    });
  }
}
function createTab(url = 'https://www.google.com', activate = true) {
  const id = nextId++;
  const view = new WebContentsView({ webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: true } });
  const tab = { id, view, title: 'New Tab', url };
  tabs.set(id, tab);
  win.contentView.addChildView(view);
  view.setVisible(false);
  view.setBounds(browserBounds());
  const wc = view.webContents;
  wc.setWindowOpenHandler(({ url: opened }) => { createTab(opened, true); return { action: 'deny' }; });
  wc.on('did-start-loading', () => syncTab(tab));
  wc.on('did-stop-loading', () => syncTab(tab));
  wc.on('page-title-updated', () => syncTab(tab));
  wc.on('did-navigate', (_e, u) => { tab.url = u; syncTab(tab); uiSend('taws:history', { url: u, title: tab.title }); });
  wc.on('did-navigate-in-page', (_e, u) => { tab.url = u; syncTab(tab); });
  wc.on('did-fail-load', (_e, code, desc, u, main) => { if (main && code !== -3) uiSend('taws:error', { id, message: desc, url: u }); });
  wc.on('render-process-gone', () => uiSend('taws:error', { id, message: 'Page process stopped. Reload the tab to continue.', url: tab.url }));
  wc.loadURL(url === 'taws://home' ? HOME : normalize(url));
  uiSend('taws:created', { id, title: tab.title, url });
  if (activate) activateTab(id);
  return id;
}
function activateTab(id) {
  id = Number(id);
  const tab = tabs.get(id);
  if (!tab) return;
  for (const t of tabs.values()) t.view.setVisible(false);
  activeId = id;
  tab.view.setVisible(true);
  tab.view.setBounds(browserBounds());
  tab.view.webContents.focus();
  uiSend('taws:active', { id });
  syncTab(tab);
  // The browser view must stay underneath the native browser chrome.
  if (chromeView && !chromeView.webContents.isDestroyed()) {
    win.contentView.removeChildView(chromeView);
    win.contentView.addChildView(chromeView);
    chromeView.setBounds({ x: 0, y: 0, width: win.getContentSize()[0], height: 104 });
  }
}
function closeTab(id) {
  id = Number(id);
  const tab = tabs.get(id);
  if (!tab) return;
  const was = id === activeId;
  win.contentView.removeChildView(tab.view);
  tab.view.webContents.close();
  tabs.delete(id);
  uiSend('taws:closed', { id });
  if (was) {
    const next = [...tabs.keys()].pop();
    next ? activateTab(next) : createTab();
  }
}
function activeTab() { return tabs.get(activeId); }
function setupFile() { return path.join(app.getPath('userData'), 'setup.json'); }
function readSetup() {
  try { return JSON.parse(fs.readFileSync(setupFile(), 'utf8')); } catch { return { complete: false }; }
}
function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 820, minWidth: 900, minHeight: 600,
    backgroundColor: '#0a0d12', title: 'TAWS — Tech Axel Web Surfer',
    icon: path.join(__dirname, 'assets', 'taws.svg'),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true }
  });

  // Browser content is created first so the UI chrome is always the topmost child view.
  const firstTab = createTab('https://www.google.com', false);
  activeId = firstTab;
  const tab = tabs.get(firstTab);
  tab.view.setVisible(true);

  chromeView = new WebContentsView({
    webPreferences: { preload: path.join(__dirname, 'ui-preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  win.contentView.addChildView(chromeView);
  chromeView.setBounds({ x: 0, y: 0, width: 1280, height: 104 });
  chromeView.webContents.loadFile(path.join(__dirname, 'ui.html'));

  win.on('resize', () => {
    const [w] = win.getContentSize();
    if (chromeView) chromeView.setBounds({ x: 0, y: 0, width: w, height: 104 });
    for (const t of tabs.values()) t.view.setBounds(browserBounds());
  });
  win.on('closed', () => {
    for (const t of tabs.values()) t.view.webContents.close();
    tabs.clear();
    if (chromeView) chromeView.webContents.close();
    win = null; chromeView = null;
  });
  chromeView.webContents.on('did-finish-load', () => {
    uiSend('taws:setup', readSetup());
    for (const t of tabs.values()) uiSend('taws:created', { id: t.id, title: t.title, url: t.url });
    uiSend('taws:active', { id: activeId });
    syncTab(tabs.get(activeId));
  });
}
function vaultFile() { return path.join(app.getPath('userData'), 'vault.dat'); }

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_wc, _p, cb) => cb(false));
  session.defaultSession.on('will-download', (_e, item) => {
    const file = path.join(app.getPath('downloads'), item.getFilename());
    item.setSavePath(file);
    uiSend('taws:download', { name: item.getFilename(), state: 'started', path: file });
    item.once('done', (_e, state) => uiSend('taws:download', { name: item.getFilename(), state, path: file }));
  });
  ipcMain.handle('taws:new-tab', (_e, url) => createTab(url || 'https://www.google.com', true));
  ipcMain.handle('taws:activate', (_e, id) => activateTab(id));
  ipcMain.handle('taws:navigate', (_e, url) => activeTab()?.view.webContents.loadURL(url === 'taws://home' ? HOME : normalize(url)));
  ipcMain.handle('taws:back', () => { const t = activeTab(); if (t?.view.webContents.navigationHistory.canGoBack()) t.view.webContents.navigationHistory.goBack(); });
  ipcMain.handle('taws:forward', () => { const t = activeTab(); if (t?.view.webContents.navigationHistory.canGoForward()) t.view.webContents.navigationHistory.goForward(); });
  ipcMain.handle('taws:reload', () => activeTab()?.view.webContents.reload());
  ipcMain.handle('taws:stop', () => activeTab()?.view.webContents.stop());
  ipcMain.handle('taws:close-tab', (_e, id) => closeTab(id));
  ipcMain.handle('taws:home', () => activeTab()?.view.webContents.loadFile(path.join(__dirname, 'home.html')));
  ipcMain.handle('taws:devtools', () => activeTab()?.view.webContents.openDevTools());
  ipcMain.handle('taws:external', (_e, url) => shell.openExternal(url));
  ipcMain.handle('taws:setup-load', () => readSetup());
  ipcMain.handle('taws:setup-save', (_e, value) => {
    fs.mkdirSync(path.dirname(setupFile()), { recursive: true });
    fs.writeFileSync(setupFile(), JSON.stringify({ ...value, complete: true }, null, 2));
    return true;
  });
  ipcMain.handle('taws:vault-load', () => {
    const f = vaultFile();
    if (!safeStorage.isEncryptionAvailable() || !fs.existsSync(f)) return [];
    try { return JSON.parse(safeStorage.decryptString(fs.readFileSync(f))); } catch { return []; }
  });
  ipcMain.handle('taws:vault-save', (_e, value) => {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('Encrypted OS storage unavailable');
    fs.mkdirSync(path.dirname(vaultFile()), { recursive: true });
    fs.writeFileSync(vaultFile(), safeStorage.encryptString(JSON.stringify(value)));
    return true;
  });
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
