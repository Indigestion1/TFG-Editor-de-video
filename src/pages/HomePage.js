//const { ipcRenderer } = require('electron');
//import Tweakpane from 'https://cdn.jsdelivr.net/npm/tweakpane@3.0.0/dist/tweakpane.min.js';

document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.body.classList.add(`${savedTheme}-mode`);
});

document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('videoTrackCanvas');
    const context = canvas.getContext('2d');
    const frames = [];
    //const maskSelectorContainer = document.getElementById('maskContainer');
    const frameImage = document.getElementById('frameImage');
    const context2 = frameImage.getContext('2d');
    const propagate_button = document.getElementById('propagate_button');
    const controlsContainer = document.getElementById('framesContainer');
    const maskContainer = document.getElementById('maskContainer');
    const canvasResult = document.getElementById('resultImage');
    const context3 = canvasResult.getContext('2d');
    var natural_width;
    var natural_height;
    var frameIndex = 0;
    var first = true;
    var masks;
    var numMasks = 0;
    //var maskIndex = 0;

    propagate_button.addEventListener('click', () => {
        fetch('http://localhost:5000/propagate_segmentation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ video_path: `../TFG-Editor-de-video/data/Videos`, image_path: `../TFG-Editor-de-video/data/Videos\\${frameIndex}.jpeg` })
        })
        .then(response => response.json())
    });
    
    const updateControls = () => {
        console.log('Updating controls');
        controlsContainer.innerHTML = ''; // Limpia los controles existentes
        frames.forEach((frame, index) => {
            const frameDiv = document.createElement('div');
            frameDiv.classList.add('control-item');
            frameDiv.textContent = `Frame ${index}`;
            frameDiv.addEventListener('click', () => {
                sendFrameToServer(index);
                showFrame(index);
            });
            controlsContainer.appendChild(frameDiv);
        });
    };

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
                        console.log('Finished capturing frames');
                        resolve();
                        return;
                    }                    
                    context.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
                    const frame = canvas.toDataURL('image/jpeg', 1.0);
                    frames.push(frame);
                    window.electron.send('save-image', frame, frameIndex);
                    frameIndex++;
                    setTimeout(() => {
                        capture();
                        tempVideo.currentTime += 1/24;
                    }, 100);
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
                body: JSON.stringify({ image_path: `../TFG-Editor-de-video/data/Videos\\${index}.jpeg` })
            }).then(response => get_masks(`../TFG-Editor-de-video/data/Videos\\${index}.jpeg`));
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


    if (window.electron) {
        window.electron.receive('load-video', async (filePath) => {
            const loadingSpinner = document.getElementById('loadingSpinner');
            loadingSpinner.classList.add('show');
            await captureFrames(filePath);
            loadingSpinner.classList.remove('show');
            updateControls();

        });
    } else {
        console.error('Electron object is not available');
    }

    frameImage.addEventListener('click', () => {
        const rect = frameImage.getBoundingClientRect();
        const scaleX = natural_width / rect.width;
        const scaleY = natural_height / rect.height;
        const x = (event.clientX - rect.left) * scaleX;
        const y = (event.clientY - rect.top) * scaleY;
        const imagePath =  `../TFG-Editor-de-video/data/Videos\\` + frameIndex + '.jpeg';
        const data = {
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
        }).then(response => response.blob())
          .then(blob => {
                const url = URL.createObjectURL(blob);
                const img = new Image();
                img.src = url;
                img.onload = () => {
                context2.clearRect(0, 0, frameImage.width, frameImage.height);
                context2.drawImage(img, 0, 0, frameImage.width, frameImage.height);
                };
                get_masks(data.image_path);
                var numMaskArray = [numMasks];
                let data2 = {
                        image_path: imagePath,
                        mask: numMaskArray
                };
        
                apply_Mask(mode=false, data2);
          })
          .catch((error) => {
              console.error('Error loading image:', error);
          });
    })


    maskContainer.addEventListener('click', (event) => {
        const maskItem = event.target.closest('.mask-item');
        if (!maskItem) return; 
        
        if(event.target.classList.contains('move-up')){
            const prevItem = maskItem.previousElementSibling;
            if (prevItem && prevItem.classList.contains('mask-item')) {
                maskContainer.insertBefore(maskItem, prevItem);
            }
        }

        else if(event.target.classList.contains('move-down')) {
            const nextItem = maskItem.nextElementSibling;
            if (nextItem && nextItem.classList.contains('mask-item')) {
                maskContainer.insertBefore(nextItem, maskItem);
            }
        }

        else {

            // Alternar la clase de selección
            if(!maskItem.classList.contains('selected')) {
                maskItem.classList.add('selected');
                maskItem.style.backgroundColor = masks[maskItem.getAttribute('data-value')][0];
                maskItem.style.color = '#e0e1dd';
            }
            else {
                maskItem.classList.remove('selected');
                maskItem.style.backgroundColor = '';
                maskItem.style.color = '';
            }

            // Recopilar todas las máscaras seleccionadas
            const selectedMasks = Array.from(maskContainer.querySelectorAll('.mask-item.selected'))
                .map(item => parseInt(item.getAttribute('data-value')));

            // Preparar los datos para enviar a la API
            const data = {
                image_path: `../TFG-Editor-de-video/data/Videos\\${frameIndex}.jpeg`,
                mask: selectedMasks
            };
            apply_Mask(mode=true, data);
            
        }
    });


    function addOption(value, text, color) {
        const maskItem = document.createElement('div');
        maskItem.classList.add('mask-item');
        maskItem.setAttribute('data-value', value);
    
        const itemText = document.createElement('span');
        itemText.textContent = text;
    
        const colorButton = document.createElement('button');
        colorButton.classList.add('color-button');
    
        const deleteButton = document.createElement('button');
        deleteButton.classList.add('delete-button');
        deleteButton.textContent = 'X';
    
        // Lógica para borrar el elemento
        deleteButton.addEventListener('click', (e) => {
            e.stopPropagation(); // Evitar que se cierre el menú al hacer clic
            maskItem.remove(); // Eliminar el elemento de la lista
            deleteMask(value);
            // Aquí puedes manejar cualquier lógica adicional para borrar la máscara
        });
    
        maskItem.style.borderLeft = `4px solid ${color}`;
    
        maskItem.appendChild(itemText);
        maskItem.appendChild(colorButton);
        maskItem.appendChild(deleteButton);
    
        maskContainer.appendChild(maskItem);
    
        // Crear Pickr para el control del color
        const pickr = Pickr.create({
            el: colorButton,
            theme: 'classic', // or 'monolith', or 'nano'
            default: color,
            components: {
            // Main components
            preview: true,
            opacity: true,
            hue: true,
            // Input / output Options
            interaction: {
                rgba: true,
                hex: true,
                hsla: true,
                hsva: true,
                rgb: true,
                hsv: true,
                input: true,
                save: true
            }
            }
        });

        pickr.on('save', (colorInstance) => {
            const hexColor = colorInstance.toHEXA().toString();
            const rgbaArray = colorInstance.toRGBA();
            const rgbaArrayNormalized = rgbaArray.map((value, index) => index < 3 ? value / 255 : 0.6);

            if (maskItem.classList.contains('selected')) {
                maskItem.style.backgroundColor = hexColor;
            } else {
                maskItem.style.backgroundColor = '';
            }

            colorButton.style.backgroundColor = hexColor;

            fetch('http://localhost:5000/color', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                image_path: `../TFG-Editor-de-video/data/Videos\\${frameIndex}.jpeg`,
                mask_index: value,
                color: rgbaArrayNormalized
            })
            })
            .then(response => response.json())
            .then(response => {
                maskItem.remove();
                masks[value][0] = hexColor;
                addOption(value, `Máscara ${value + 1}`, hexColor);
            })
            .catch(error => console.error('Error updating color:', error));
        }); 
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
            masks = data.masks;
            numMasks = masks.length;
            maskContainer.innerHTML = '';
            masks.forEach((mask, index) => {
                const color = mask[0]; // Obtener el color de la máscara
                addOption(index, `Máscara ${index + 1}`, color);
            });
        })
        .catch(error => console.error('Error:', error));
    }
    
    function deleteMask(maskId) {
        const data = {
            image_path: `../TFG-Editor-de-video/data/Videos\\${frameIndex}.jpeg`,
            mask_index: maskId
        };
    
        fetch('http://localhost:5000/mask', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        .then(response => {
            if (response.ok) {
                get_masks(data.image_path); // Actualizar la lista de máscaras
                
            } else {
                console.error('Error al eliminar la máscara:', response.statusText);
            }
        })
        .catch(error => {
            console.error('Error al hacer la solicitud de eliminación:', error);
        });
    }

    function apply_Mask(mode, data) {
        if(mode) {
            fetch('http://localhost:5000/applyMask', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            })
            .then(response => response.blob())
            .then(blob => {
                const url = URL.createObjectURL(blob);
                const img = new Image();
                img.src = url;
                img.onload = () => {
                    context2.clearRect(0, 0, frameImage.width, frameImage.height);
                    context2.drawImage(img, 0, 0, frameImage.width, frameImage.height);
                    URL.revokeObjectURL(url); // Limpia el objeto URL
                };
            })
            .catch((error) => {
                console.error('Error al aplicar las máscaras:', error);
            });
        }
        fetch('http://localhost:5000/applyMaskBlack', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        }).then(response => response.blob())
        .then(blob => {
            const url = URL.createObjectURL(blob);
            const img = new Image();
            img.src = url;
            img.onload = () => {
                context3.clearRect(0, 0, frameImage.width, frameImage.height);
                canvasResult.width = img.width;
                canvasResult.height = img.height;
                context3.drawImage(img, 0, 0, canvasResult.width, canvasResult.height);
            };
        })
        .catch((error) => {
            console.error('Error loading image:', error);
        });
    }
        
});
