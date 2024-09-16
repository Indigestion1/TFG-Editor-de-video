import React from 'react';
import ReactDOM from 'react-dom';
import './index.css'; // Importar estilos globales
import App from './App'; // Importar el componente principal de la aplicación
import reportWebVitals from './reportWebVitals';

// Configuración opcional para medir el rendimiento
// Puedes eliminar esto si no lo necesitas
reportWebVitals(console.log);

ReactDOM.render(
  <React.StrictMode>
    <App /> // Montar el componente principal de la aplicación
  </React.StrictMode>,
  document.getElementById('root') // Montar en el elemento con id 'root' en tu index.html
);