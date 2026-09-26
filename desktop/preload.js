// Runs before the page, isolated from it. The page needs nothing from Node;
// this only tells it (read-only) that it is running as the desktop edition.
const { contextBridge } = require('electron');
contextBridge.exposeInMainWorld('greDesktop', { platform: process.platform, versions: { electron: process.versions.electron } });
