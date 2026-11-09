import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import { TvPanel } from './components/TvPanel.jsx'
import './index.css'

// Con ?panel en la URL se muestra el panel para la televisión del club en
// lugar de la app de reservas. No pide código de acceso: solo lee reservas.
const isTvPanel = new URLSearchParams(window.location.search).has('panel')

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        {isTvPanel ? <TvPanel /> : <App />}
    </React.StrictMode>,
)
