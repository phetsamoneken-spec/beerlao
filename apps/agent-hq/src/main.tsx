import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { LanguageProvider } from './i18n';
import '@fontsource-variable/noto-sans-lao';
import './style.css';
ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><LanguageProvider><App/></LanguageProvider></React.StrictMode>);

// Installed web builds cache only public app assets, never user data or APIs.
if(import.meta.env.PROD && !document.documentElement.hasAttribute('data-standalone') && 'serviceWorker' in navigator && location.protocol!=='file:'){
 window.addEventListener('load',()=>{navigator.serviceWorker.register('./sw.js').catch(()=>{/* Offline installation is optional; keep the app usable. */});});
}
