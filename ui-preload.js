const { contextBridge, ipcRenderer } = require('electron');
const allowed=['taws:created','taws:tab','taws:active','taws:closed','taws:state','taws:history','taws:error','taws:download'];
contextBridge.exposeInMainWorld('taws',{
 newTab:url=>ipcRenderer.invoke('taws:new-tab',url),activate:id=>ipcRenderer.invoke('taws:activate',id),navigate:url=>ipcRenderer.invoke('taws:navigate',url),back:()=>ipcRenderer.invoke('taws:back'),forward:()=>ipcRenderer.invoke('taws:forward'),reload:()=>ipcRenderer.invoke('taws:reload'),stop:()=>ipcRenderer.invoke('taws:stop'),closeTab:id=>ipcRenderer.invoke('taws:close-tab',id),home:()=>ipcRenderer.invoke('taws:home'),devtools:()=>ipcRenderer.invoke('taws:devtools'),openExternal:url=>ipcRenderer.invoke('taws:external',url),loadVault:()=>ipcRenderer.invoke('taws:vault-load'),saveVault:v=>ipcRenderer.invoke('taws:vault-save',v),
 on:(channel,cb)=>{if(allowed.includes(channel))ipcRenderer.on(channel,(_e,data)=>cb(data))}
});