import React from 'react';
import ReactDOM from 'react-dom/client';
import { initSentry } from './services/sentry';
import App from './App';
import './styles/index.css';

initSentry();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
