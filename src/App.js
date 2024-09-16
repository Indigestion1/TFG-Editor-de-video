import React from 'react';
import HomePage from './pages/HomePage'; // Asegúrate de que la ruta sea correcta

function App() {
    // Función para manejar el evento de clic en "Nuevo Proyecto"
    const handleNewProject = () => {
        console.log('Crear nuevo proyecto');
        // Aquí iría la lógica para crear un nuevo proyecto
    };

    // Función para manejar el evento de clic en "Abrir Proyecto Existente"
    const handleOpenProject = () => {
        console.log('Abrir un proyecto existente');
        // Aquí iría la lógica para abrir un proyecto existente
    };

    return (
        <div className="App">
            <HomePage onNewProject={handleNewProject} onOpenProject={handleOpenProject} />
            {/* Puedes agregar más componentes o rutas aquí */}
        </div>
    );
}

export default App;