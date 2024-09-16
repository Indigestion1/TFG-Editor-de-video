
const { ipcRenderer } = require('electron');

function uploadFile() {
}


document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.body.classList.add(`${savedTheme}-mode`);
});

ipcRenderer.on('set-theme', (event, theme) => {
    const body = document.body;
    const currentTheme = body.classList.contains('dark-mode') ? 'dark' : 'light';
    body.classList.remove(`${currentTheme}-mode`);
    body.classList.add(`${theme}-mode`);
    localStorage.setItem('theme', theme);
});