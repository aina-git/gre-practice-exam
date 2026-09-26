// GRE Ready — desktop shell.
//
// The whole app is the same single index.html the website serves (copied into
// app/ at build time by scripts/prepare-app.js), so the desktop edition works
// fully offline; only the AI features talk to the internet, with the key the
// user pasted. Scores and settings live in Electron's per-user data folder.
const { app, BrowserWindow, shell, dialog, Menu } = require('electron');
const path = require('path');
const fs = require('fs');

app.setName('GRE Ready');
// A separate data folder for automated tests, so they never touch real scores.
if (process.env.GRE_DESKTOP_USERDATA) app.setPath('userData', process.env.GRE_DESKTOP_USERDATA);

// One window, one instance: a second launch just focuses the first.
if (!app.requestSingleInstanceLock()) { app.quit(); }

const WEB_URL = 'https://aina-git.github.io/gre-practice-exam/';
let win = null;
let closing = false;

const boundsFile = () => path.join(app.getPath('userData'), 'window.json');
function loadBounds() { try { return JSON.parse(fs.readFileSync(boundsFile(), 'utf8')); } catch { return null; } }
function saveBounds() {
  try { if (win && !win.isMinimized() && !win.isFullScreen()) fs.writeFileSync(boundsFile(), JSON.stringify(win.getNormalBounds())); } catch {}
}

/* Is a practice section running right now? `exam` is a top-level `let` in the
   page, so it is read in the page's own scope, not as a window property. */
async function practiceInProgress() {
  try { return !!(await win.webContents.executeJavaScript('(function(){ try { return !!(exam && exam.sec && exam.inSection); } catch (e) { return false; } })()', true)); }
  catch { return false; }
}

function createWindow() {
  const b = loadBounds() || {};
  win = new BrowserWindow({
    width: b.width || 1100, height: b.height || 820, x: b.x, y: b.y,
    minWidth: 380, minHeight: 600,
    title: 'GRE Ready', backgroundColor: '#12305e', autoHideMenuBar: true, show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: true },
  });
  win.once('ready-to-show', () => win.show());
  win.loadFile(path.join(__dirname, 'app', 'index.html'));

  // Links to the outside world open in the system browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/i.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) { e.preventDefault(); if (/^https?:/i.test(url)) shell.openExternal(url); } });

  win.on('resize', saveBounds);
  win.on('move', saveBounds);

  // Closing in the middle of a practice: the page keeps a snapshot of the
  // section, so offer to pause (and keep the clock) rather than lose it. The
  // page's own beforeunload guard would otherwise block the window silently.
  win.on('close', async (e) => {
    if (closing) return;
    e.preventDefault();
    if (await practiceInProgress()) {
      const choice = process.env.GRE_DESKTOP_TEST ? 0 : dialog.showMessageBoxSync(win, {
        type: 'question', buttons: ['Pause and quit', 'Keep practicing'], defaultId: 0, cancelId: 1,
        title: 'Practice in progress', message: 'You are in the middle of a practice.',
        detail: 'Pause and quit keeps your place and the clock — you can resume from the home screen next time you open GRE Ready.',
      });
      if (choice !== 0) return;
      try { await win.webContents.executeJavaScript('(function(){ try { saveActiveSnapshot(); } catch (e) {} return true; })()', true); } catch {}
    }
    closing = true;
    saveBounds();
    win.destroy();
  });
  win.on('closed', () => { win = null; closing = false; });
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ label: app.name, submenu: [{ role: 'about' }, { type: 'separator' }, { role: 'hide' }, { role: 'hideOthers' }, { role: 'unhide' }, { type: 'separator' }, { role: 'quit' }] }] : []),
    { label: 'Edit', submenu: [{ role: 'undo' }, { role: 'redo' }, { type: 'separator' }, { role: 'cut' }, { role: 'copy' }, { role: 'paste' }, { role: 'selectAll' }] },
    { label: 'View', submenu: [{ role: 'reload' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { type: 'separator' }, { role: 'togglefullscreen' }] },
    { label: 'Window', submenu: [{ role: 'minimize' }, { role: 'close' }, ...(isMac ? [{ type: 'separator' }, { role: 'front' }] : [])] },
    { label: 'Help', submenu: [
      { label: 'Open the web version', click: () => shell.openExternal(WEB_URL) },
      { label: 'About GRE Ready', click: () => dialog.showMessageBox(win, { type: 'info', title: 'GRE Ready', message: `GRE Ready ${app.getVersion()}`, detail: 'Adaptive GRE practice with an AI Teacher. Works offline; AI features use the key you add in Settings. Your scores are saved on this computer.' }) },
    ] },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.whenReady().then(() => {
  buildMenu();
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
