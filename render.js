const { exec } = require('child_process');
const path = require('path');

// Ruta al script demo.py
const scriptPath = path.join(__dirname, 'sam2', 'demo', 'demo.py');

// Función para ejecutar el script
function runDemoScript() {
    exec(`python ${scriptPath}`, (error, stdout, stderr) => {
        if (error) {
            console.error(`Error ejecutando el script: ${error.message}`);
            return;
        }
        if (stderr) {
            console.error(`Error en el script: ${stderr}`);
            return;
        }
        console.log(`Resultado del script: ${stdout}`);
    });
}

// Llama a la función para ejecutar el script
runDemoScript();