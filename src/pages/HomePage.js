//const { ipcRenderer } = require('electron');

document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.body.classList.add(`${savedTheme}-mode`);
});

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('videoTrackCanvas');
    const context = canvas.getContext('2d');
    const frames = [];
    const frameList = document.getElementById('frameList');
    const maskSelectorContainer = document.getElementById('maskSelectorContainer');
    const frameImage = document.getElementById('frameImage');
    const context2 = frameImage.getContext('2d');
    // const deleteMaskButton = document.getElementById('DeleteMask');
    // const maskModal = document.getElementById('maskModal');
    // const closeModal = document.getElementById('closeModal');
    // const confirmDeleteMaskButton = document.getElementById('confirmDeleteMask');
    // const maskSelectorModal = document.getElementById('maskSelectorModal');
    // const closeDeleteMaskModal = document.getElementById('closeDeleteMask');
    var natural_width;
    var natural_height;
    var frameIndex = 0;
    var first = true;
    //var maskIndex = 0;

    const captureFrames = (filePath) => {
        return new Promise((resolve) => {
            const tempVideo = document.createElement('video');
            tempVideo.src = filePath;
            tempVideo.load();
            tempVideo.currentTime = 0.01;

            tempVideo.addEventListener('loadeddata', () => {
                canvas.width = tempVideo.videoWidth;
                canvas.height = tempVideo.videoHeight;
                natural_width = tempVideo.videoWidth;
                natural_height = tempVideo.videoHeight;

                const capture = () => {
                   
                        frameIndex = 0;
                        if (tempVideo.currentTime >= tempVideo.duration) {
                            resolve();
                            return;
                        } else {
                            setTimeout(() => {
                                tempVideo.currentTime += 1/24;
                                capture();
                            }, 0);
                        }
                    
                    context.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
                    const frame = canvas.toDataURL('image/jpeg', 1.0);
                    frames.push(frame);
                    window.electron.send('save-image', frame, frameIndex);
                    frameIndex++;
                    tempVideo.currentTime += 1/24; 
                    setTimeout(capture, 100); // Espera un poco antes de capturar el siguiente frame
                    if(first) { 
                        first = false;
                        sendFrameToServer(0);
                        showFrame(0);
                    }
                };
                capture();
            });
        });
    };

    const sendFrameToServer = async (index) => {
        try {
            const response = await fetch('http://localhost:5000/addFrame', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ image_path: `../TFG-Editor-de-video/data/Videos\\image${index}.jpeg` })
            }).then(response => get_masks(`../TFG-Editor-de-video/data/Videos\\image${index}.jpeg`));
        } catch (error) {
            console.error('Error sending frame to server:', error);
        }
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
            frameIndex = index;
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
        });
    } else {
        console.error('Electron object is not available');
    }

    frameList.addEventListener('change', (event) => {
        const index = parseInt(event.target.value, 10);
        sendFrameToServer(index);
        showFrame(index);
    });

    frameImage.addEventListener('click', () => {
        const rect = frameImage.getBoundingClientRect();
        const scaleX = natural_width / rect.width;
        const scaleY = natural_height / rect.height;
        const x = (event.clientX - rect.left) * scaleX;
        const y = (event.clientY - rect.top) * scaleY;
        var imagePath =  `../TFG-Editor-de-video/data/Videos\\image` + frameIndex + '.jpeg';
        data = {
            x: x,
            y: y,
            image_path: imagePath
        }
        fetch('http://localhost:5000/predictImage', {
            method: 'POST',
            headers: {
            'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        .then(response => response.blob())
        .then(blob => {
            const url = URL.createObjectURL(blob);
            resultImage.src = url;
            //var image_path2 =   `../TFG-Editor-de-video/data/Videos\image` + frameIndex + '.jpeg';
                get_masks(data.image_path);
            })
        .catch((error) => {
            console.error('Error loading image:', error);
        })
    })


    maskSelectorContainer.addEventListener('change', () => {
        const maskSelector = document.getElementById('maskSelectorContainer');
        const selectedMasks = Array.from(maskSelector.selectedOptions).map(option => parseInt(option.value));
        const data = {
            image_path: `../TFG-Editor-de-video/data/Videos\\image${frameIndex}.jpeg`,
            mask: selectedMasks
        };
    
        fetch('http://localhost:5000/applyMask', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        .then(response => response.blob()) // Cambiar a .blob() para manejar la imagen
        .then(blob => {
            const url = URL.createObjectURL(blob);
            resultImage.src = url; // Mostrar la imagen en el mismo lugar que la imagen de predictImage
            console.log('Mask applied and image updated');
        })
        .catch((error) => {
            console.error('Error applying mask:', error);
        });
    });


    function addOption(value, text) {
        const option = document.createElement('option');
        option.value = value; // El valor que llevará la opción
        option.textContent = text; // El texto que se mostrará
        maskSelectorContainer.appendChild(option); // Agregar la opción al <select>
    }
    
    function updateOptionsBasedOnNumber(number) {
        console.log('Number:', number);
        // Primero, limpia las opciones actuales
        maskSelectorContainer.innerHTML = '';
    
        // Agrega una opción por defecto
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
    
        // Basado en el número, agrega diferentes opciones
        for (let i = 0; i <= number-1; i++) {
           addOption(i, `Máscara ${i+1}`);
        }
        $('.selectpicker').selectpicker('refresh');
    }

    function get_masks(image_path) {
        fetch(`http://localhost:5000/mask?image_path=${image_path}`, {
            method: 'GET',
            headers: {
            'Content-Type': 'application/json'
            },
        })
        .then(response => response.json())
        .then(data => {
            updateOptionsBasedOnNumber(data.masks);
        })
        .catch(error => console.error('Error:', error));
    }
    
    // deleteMaskButton.addEventListener('click', () => {
    //     maskModal.style.display = 'block';
    // });
    // window.addEventListener('click', (event) => {
    //     if (event.target === maskModal) {
    //         maskModal.style.display = 'none';
    //     }
    // });
    // confirmDeleteMaskButton.addEventListener('click', () => {
    //     const maskSelector = document.getElementById('maskSelectorContainer');
    //     const selectedMasks = Array.from(maskSelector.selectedOptions).map(option => parseInt(option.value));
    //     const data = {
    //         image_path: `../TFG-Editor-de-video/data/Videos\\image${frameIndex}.jpeg`,
    //         mask: selectedMasks
    //     };
    //     fetch('http://localhost:5000/Mask', {
    //         method: 'DELETE',
    //         headers: {
    //             'Content-Type': 'application/json'
    //         },
    //         body: JSON.stringify(data)
    //     })
    //     .then(response => get_masks(data.image_path))
    //     .catch((error) => {
    //         console.error('Error deleting mask:', error);
    //     });
    //     maskModal.style.display = 'none';
    // });
    // closeModal.addEventListener('click', () => {
    //     maskModal.style.display = 'none';
    // });
});
