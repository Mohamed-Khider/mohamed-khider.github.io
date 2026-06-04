/**
 * Electron Main Process
 * Manages window lifecycle, IPC communication, and printer service
 */
import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import path from 'path';
import { printerService } from './services/PrinterService';
import isDev from 'electron-is-dev';

let mainWindow: BrowserWindow | null = null;
const PORT = 3000;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      sandbox: true,
    },
  });

  const startUrl = isDev
    ? `http://localhost:${PORT}`
    : `file://${path.join(__dirname, '../out/index.html')}`;

  mainWindow.loadURL(startUrl);

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  createMenu();
}

function createMenu() {
  const template: any[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Exit',
          accelerator: 'CmdOrCtrl+Q',
          click: () => {
            app.quit();
          },
        },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About',
          click: () => {
            // Show about dialog
          },
        },
      ],
    },
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// IPC Handlers
ipcMain.handle('printer:discover', async () => {
  try {
    return {
      success: true,
      printers: printerService.getPrinters(),
    };
  } catch (error) {
    return {
      success: false,
      error: String(error),
    };
  }
});

ipcMain.handle('printer:send-zpl', async (event, { printerId, zpl, jobId }) => {
  try {
    printerService.queuePrintJob(printerId, zpl, jobId);
    return {
      success: true,
      message: 'Job queued for printing',
    };
  } catch (error) {
    return {
      success: false,
      error: String(error),
    };
  }
});

ipcMain.handle('printer:test-connection', async (event, { printerId }) => {
  try {
    const isConnected = await printerService.testConnection(printerId);
    return {
      success: true,
      connected: isConnected,
    };
  } catch (error) {
    return {
      success: false,
      error: String(error),
    };
  }
});

ipcMain.handle('printer:get-queue', async () => {
  try {
    return {
      success: true,
      queue: printerService.getQueueStatus(),
    };
  } catch (error) {
    return {
      success: false,
      error: String(error),
    };
  }
});

// Printer Service Event Listeners
printerService.on('printers-discovered', (printers) => {
  if (mainWindow) {
    mainWindow.webContents.send('printer:discovered', printers);
  }
});

printerService.on('job-completed', (data) => {
  if (mainWindow) {
    mainWindow.webContents.send('printer:job-completed', data);
  }
});

printerService.on('job-failed', (data) => {
  if (mainWindow) {
    mainWindow.webContents.send('printer:job-failed', data);
  }
});

printerService.on('job-retry', (data) => {
  if (mainWindow) {
    mainWindow.webContents.send('printer:job-retry', data);
  }
});

// App lifecycle
app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

export { mainWindow };
