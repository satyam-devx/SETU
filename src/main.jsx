import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { initObservability } from './lib/observability'

// Capture uncaught errors / unhandled rejections globally (Phase-3 observability).
initObservability()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
