const { app, BrowserWindow, Menu, ipcMain, dialog} = require('electron');
const { openExistingProject } = require('./src/services/ProjectHandle');
const fs = require('fs');
const path = require('path');
const VideoEditor = require('./src/services/videoEditor');
const { exec } = require('child_process');
var flaskProcess = null;

let mainWindow;

var frameIndex = 0;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            contextIsolation: true,
            enableRemoteModule: false,
            nodeIntegration: true,
            
        },
    });

    mainWindow.loadFile('index.html');

    //debugging
    mainWindow.webContents.openDevTools();

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

function startFlaskServer() {
    const scriptPath = path.join(__dirname, '../sam2/server.py');
    const scriptDir = path.dirname(scriptPath);

    flaskProcess = exec(`cd ${scriptDir} && python server.py`, (error, stdout, stderr) => {
        if(error) {
            console.error('Failed to start Flask server:', error);
            return;
        }
        console.log(`Flask server stdout: ${stdout}`);
        console.error(`Flask server stderr: ${stderr}`);
    });
    flaskProcess.on('close', (code) => {
        console.log(`Flask server exited with code ${code}`);
    });
}


function loadHomeScreen(filePath) {
    if (mainWindow) {
        mainWindow.loadFile('src/pages/HomePage.html').then(() => {
            mainWindow.webContents.send('load-video', filePath);
        });
    }
}

function deleteVideoFrames() {
    const directory = path.join(__dirname, '/data/Videos');
    fs.readdir(directory, (err, files) => {
        if (err) {
            console.error('Failed to read directory:', err);
            return;
        }
        files.forEach(file => {
            if (file.endsWith('.jpeg')) {
                fs.unlink(path.join(directory, file), err => {
                    if (err) {
                        console.error('Failed to delete file:', err);
                    } else {
                        console.log(`Deleted file: ${file}`);
                    }
                });
            }
        });
    });
}

app.on('ready', () => {
    startFlaskServer();
    createWindow()
});

app.on('before-quit', (event) => {
    fetch('http://localhost:500/killServer', {
        method: 'POST'
    });
    deleteVideoFrames();
});

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
                .then(filePath => {
                    loadHomeScreen(filePath);
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

ipcMain.handle('trim-video', async (event, inputPath, outputPath, startTime, duration) => {
    try {
        const result = await VideoEditor.trimVideo(inputPath, outputPath, startTime, duration);
        return result;
    } catch (error) {
        console.error(error);
        throw error;
    }
});

ipcMain.on('save-image', async (event, dataUrl) => {
    const savePath = path.join(__dirname, `/data/Videos/image${frameIndex}.jpeg`);
    frameIndex++;
    const base64Data = dataUrl.replace(/^data:image\/jpeg;base64,/, '');

    fs.writeFile(savePath, base64Data, 'base64', (err) => {
        if (err) {
            console.error('Failed to save image:', err);
        }
    });
});

module.exports = { loadHomeScreen };