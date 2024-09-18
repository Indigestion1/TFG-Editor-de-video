
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.body.classList.add(`${savedTheme}-mode`);
});

document.addEventListener('DOMContentLoaded', () => {
    const videoElement = document.getElementById('video');

    if (window.electron) {
        window.electron.receive('load-video', (filePath) => {
            videoElement.src = filePath;
            videoElement.load();
        });
    } else {
        console.error('Electron object is not available');
    }
});