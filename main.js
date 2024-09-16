const { app, BrowserWindow, Menu, ipcMain, dialog} = require('electron');
const { openExistingProject } = require('./src/services/ProjectHandle');
const path = require('path');

const projectState = {
    videoPath: '',
    edits: [],
    currentTime: 0
};

function applyProjectState(state) {
    projectState.videoPath = state.videoPath;
    projectState.edits = state.edits;
    projectState.currentTime = state.currentTime;

    const videoElement = document.getElementById('video');
    videoElement.src = projectState.videoPath;
    videoElement.currentTime = projectState.currentTime;

    // projectState.edits.forEach(edit => {
    //     // Apply each edit to the video
    // });
}

let mainWindow;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            enableRemoteModule: false,
            nodeIntegration: false,
        },
    });

    mainWindow.loadFile('index.html');

    mainWindow.webContents.on('did-finish-load', () => {
        const theme = 'dark'; // Default theme
        mainWindow.webContents.send('set-theme', theme);
    });

    const menu = Menu.buildFromTemplate([
        {
            label: 'File',
            submenu: [
                {
                    label: 'New Project',
                    click: () => {
                        ipcMain.emit('onNewProject');
                    },
                },
                {
                    label: 'Open Project',
                    click: () => {
                        ipcMain.emit('onOpenProject');
                    },
                },
            ],
        },
        {
            label: 'View',
            submenu: [
                {
                    label: 'Themes',
                    submenu: [
                        {
                            label: 'Dark',
                            type: 'radio',
                            click: () => {
                                ipcMain.emit('set-theme', 'dark');
                            },
                        },
                        {
                            label: 'Light',
                            type: 'radio',
                            click: () => {
                                ipcMain.emit('set-theme', 'light');
                            },
                        },
                        // Add more themes here as needed
                    ],
                },
            ],
        },
    ]);

    Menu.setApplicationMenu(menu);

    mainWindow.on('closed', function () {
        mainWindow = null;
    });
}

function loadHomeScreen() {
    if(mainWindow) {
        mainWindow.loadFile('src/Pages/HomePage.html');
    }
}

ipcMain.on('onNewProject', function () {
    dialog.showOpenDialog({
        title: 'Open Project',
        properties: ['openFile'],
        filters: [
            { name: 'Videos', extensions: ['mp4', 'avi', 'mov'] },
            { name: 'All Files', extensions: ['*'] }
        ]
    }).then(result => {
        if (!result.canceled) {
            const filePath = result.filePaths[0];
            openExistingProject(filePath)
                .then(state => {
                    applyProjectState(state);
                    loadHomeScreen();
                })
                .catch(err => {
                    console.error(err);
                });
        }
    }).catch(err => {
        console.error('Failed to open file:', err);
    });
});
ipcMain.on('onOpenProject', function () {
    ipcMain.emit('onNewProject');
});

app.on('ready', createWindow);

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', function () {
    if (mainWindow === null) {
        createWindow();
    }
});

module.exports = { loadHomeScreen };