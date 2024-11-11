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
    const dropdownButton = document.getElementById('dropdownButton');
    var natural_width;
    var natural_height;
    var frameIndex = 0;
    var first = true;
    var masks;
    //var maskIndex = 0;
    $(document).ready(() => {
        $('.selectpicker').selectpicker({
            dropupAuto: false
        }); // Inicializa el bootstrap-select
        
    });
    
    const updateFrameList = () => {
        frameList.innerHTML = '';
        frames.forEach((frame, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `Frame ${index}`;
            frameList.appendChild(option);
        });
        $('.selectpicker').selectpicker('refresh'); // Refresca el select después de actualizarlo
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
        var imagePath =  `../TFG-Editor-de-video/data/Videos\\` + frameIndex + '.jpeg';
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
            //var image_path2 =   `../TFG-Editor-de-video/data/Videos\` + frameIndex + '.jpeg';
                get_masks(data.image_path);
            })
        .catch((error) => {
            console.error('Error loading image:', error);
        })
    })

    dropdownButton.addEventListener('click', () => {
        maskSelectorContainer.classList.toggle('show');
    });

    maskSelectorContainer.addEventListener('click', (event) => {
        // Verifica si se hizo clic en un elemento de máscara
        const maskItem = event.target.closest('.mask-item');
        if (!maskItem) return; // Si no se hizo clic en un elemento de máscara, salir

        // Alternar la clase de selección
        if(!maskItem.classList.contains('selected')) {
            maskItem.classList.toggle('selected');
            maskItem.style.backgroundColor = masks[maskItem.getAttribute('data-value')][0];
            maskItem.style.color = '#e0e1dd';
        }
        else {
            maskItem.classList.remove('selected');
            maskItem.style.backgroundColor = '#e0e1dd';
            maskItem.style.color = '#5a5a5a';
        }

        // Recopilar todas las máscaras seleccionadas
        const selectedMasks = Array.from(maskSelectorContainer.querySelectorAll('.mask-item.selected'))
            .map(item => parseInt(item.getAttribute('data-value')));

        // Preparar los datos para enviar a la API
        const data = {
            image_path: `../TFG-Editor-de-video/data/Videos\\${frameIndex}.jpeg`,
            mask: selectedMasks
        };

        // Hacer la solicitud para aplicar las máscaras seleccionadas
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
            resultImage.src = url; // Mostrar la imagen actualizada
        })
        .catch((error) => {
            console.error('Error al aplicar las máscaras:', error);
        });
    });


    function addOption(value, text, color) {
        const maskItem = document.createElement('div');
        maskItem.classList.add('mask-item');
        maskItem.setAttribute('data-value', value);

        const itemText = document.createElement('span');
        itemText.textContent = text;

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
        maskItem.appendChild(deleteButton);
        maskSelectorContainer.appendChild(maskItem);
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
            maskSelectorContainer.innerHTML = '';
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
});
