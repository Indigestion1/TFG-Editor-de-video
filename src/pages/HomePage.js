//const { ipcRenderer } = require('electron');

document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.body.classList.add(`${savedTheme}-mode`);
});

document.addEventListener('DOMContentLoaded', () => {
    const videoElement = document.getElementById('video');
    const canvas = document.getElementById('videoTrackCanvas');
    const context = canvas.getContext('2d');
    const frames = [];
    const frameList = document.getElementById('frameList');
    const frameImage = document.getElementById('frameImage');
    const context2 = frameImage.getContext('2d');

    const captureFrames = (filePath) => {
        return new Promise((resolve) => {
            const tempVideo = document.createElement('video');
            tempVideo.src = filePath;
            tempVideo.load();

            tempVideo.addEventListener('loadeddata', () => {
                canvas.width = tempVideo.videoWidth;
                canvas.height = tempVideo.videoHeight;

                const capture = () => {
                    if (tempVideo.currentTime >= tempVideo.duration) {
                        resolve();
                        return;
                    }
                    context.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
                    const frame = canvas.toDataURL('image/png');
                    frames.push(frame);
                    window.electron.send('save-image', frame);
                    tempVideo.currentTime += 1/24; 
                    setTimeout(capture, 100); // Espera un poco antes de capturar el siguiente frame
                };
                capture();
            });
        });
    };

    const showFrame = (index) => {
        if (index < 0 || index >= frames.length) {
            console.error('Invalid frame index');
            return;
        }
        const img = new Image();
        img.src = frames[index];
        img.onload = () => {
            context2.clearRect(0, 0, frameImage.width, frameImage.height);
            frameImage.width = img.width;
            frameImage.height = img.height;
            context2.drawImage(img, 0, 0, frameImage.width, frameImage.height);
        };
        img.onerror = () => {
            console.error('Failed to load frame image');
        };
    };


    const updateFrameList = () => {
        frameList.innerHTML = '';
        frames.forEach((frame, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `Frame ${index}`;
            frameList.appendChild(option);
        });
    };

    if (window.electron) {
        window.electron.receive('load-video', async (filePath) => {
            await captureFrames(filePath);
            updateFrameList();
            videoElement.src = filePath;
            videoElement.load();
        });
    } else {
        console.error('Electron object is not available');
    }

    frameList.addEventListener('change', (event) => {
        console.log("change");
        const index = parseInt(event.target.value, 10);
        showFrame(index);
    });

    frameImage.addEventListener('click', () => {
        const rect = frameImage.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        console.log(`Click at (${x}, ${y})`);
    });
});
