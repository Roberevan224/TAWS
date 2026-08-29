const { app, BrowserWindow, BaseWindow, WebContentsView, ipcMain, safeStorage, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

let win;
const tabs = new Map();
let nextTabId = 1;

function normalize(input) {
  const value = String(input || '').trim();
  if (!value) return 'https://www.google.com';
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) return value;
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(value)) return `https://${value}`;
  return `https://www.google.com/search?q=${encodeURIComponent(value)}`;
}

function layout() {
  if (!win) return;
  const [width, height] = win.getContentSize();
  for (const tab of tabs.values()) {
    tab.view.setBounds({ x: 0, y: 98, width, height: Math.max(1, height - 98) });
    tab.view.setAutoResize({ width: true, height: true });
  }
}

function send(channel, data) {
  if (!win || win.isDestroyed()) return;
  win.webContents.send(channel, data);
}

function createTab(url = 'https://www.google.com') {
  const id = nextTabId++;
  const view = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  tabs.set(id, { id, view });
  win.contentView.addChildView(view);
  layout();
  view.webContents.setWindowOpenHandler(({ url }) => {
    createTab(url);
    return { action: 'deny' };
  });
  view.webContents.on('did-navigate', (_event, navigationUrl) => {
    send('taws:navigation', { id, url: navigationUrl, title: view.webContents.getTitle() });
  });
  view.webContents.on('did-navigate-in-page', (_event, navigationUrl) => {
    send('taws:navigation', { id, url: navigationUrl, title: view.webContents.getTitle() });
  });
  view.webContents.on('page-title-updated', (_event, title) => send('taws:title', { id, title }));
  view.webContents.on('page-favicon-updated', (_event, favicons) => send('taws:favicon', { id, favicon: favicons[0] || null }));
  view.webContents.on('did-start-loading', () => send('taws:loading', { id, loading: true }));
  view.webContents.on('did-stop-loading', () => send('taws:loading', { id, loading: false }));
  view.webContents.on('destroyed', () => tabs.delete(id));
  view.webContents.loadURL(normalize(url));
  send('taws:tab-created', { id, url: normalize(url) });
  return id;
}

function activateTab(id) {
  for (const [tabId, tab] of tabs) {
    if (tabId === id) tab.view.setBounds({ x: 0, y: 98, width: win.getContentSize()[0], height: Math.max(1, win.getContentSize()[1] - 98) });
    else tab.view.setBounds({ x: 0, y: 98, width: 0, height: 0 });
  }
  send('taws:active', { id });
}

function createWindow() {
  win = new BaseWindow({ width: 1280, height: 800, minWidth: 800, minHeight: 600, backgroundColor: '#0b0d12' });
  const chrome = new WebContentsView({ webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true } });
  win.contentView.addChildView(chrome);
  chrome.setBounds({ x: 0, y: 0, width: 1280, height: 98 });
  chrome.setAutoResize({ width: true });
  chrome.webContents.loadFile(path.join(__dirname, 'ui.html'));
  chrome.webContents.on('did-finish-load', () => {
    const id = createTab();
    activateTab(id);
  });
  win.on('resize', layout);
  win.on('closed', () => {
    for (const tab of tabs.values()) tab.view.webContents.close();
    chrome.webContents.close();
    tabs.clear();
    win = null;
  });
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
  ipcMain.handle('taws:new-tab', (_e, url) => createTab(url));
  ipcMain.handle('taws:activate', (_e, id) => activateTab(Number(id)));
  ipcMain.handle('taws:navigate', (_e, { id, url }) => tabs.get(Number(id))?.view.webContents.loadURL(normalize(url)));
  ipcMain.handle('taws:back', (_e, id) => tabs.get(Number(id))?.view.webContents.navigationHistory.goBack());
  ipcMain.handle('taws:forward', (_e, id) => tabs.get(Number(id))?.view.webContents.navigationHistory.goForward());
  ipcMain.handle('taws:reload', (_e, id) => tabs.get(Number(id))?.view.webContents.reload());
  ipcMain.handle('taws:close-tab', (_e, id) => {
    const tab = tabs.get(Number(id));
    if (!tab) return;
    win.contentView.removeChildView(tab.view);
    tab.view.webContents.close();
    tabs.delete(Number(id));
    if (!tabs.size) createTab();
  });
  ipcMain.handle('taws:password-load', () => {
    const file = path.join(app.getPath('userData'), 'vault.dat');
    if (!safeStorage.isEncryptionAvailable() || !fs.existsSync(file)) return null;
    try { return safeStorage.decryptString(fs.readFileSync(file)); } catch { return null; }
  });
  ipcMain.handle('taws:password-save', (_e, value) => {
    if (!safeStorage.isEncryptionAvailable()) throw new Error('OS encrypted storage unavailable');
    const file = path.join(app.getPath('userData'), 'vault.dat');
    fs.writeFileSync(file, safeStorage.encryptString(JSON.stringify(value)));
    return true;
  });
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });