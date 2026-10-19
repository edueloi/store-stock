import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import './index.css';

// Após um deploy, abas abertas apontam para arquivos antigos: recarrega uma vez para pegar a versão nova.
window.addEventListener('vite:preloadError', (event) => {
  try {
    if (sessionStorage.getItem('preload-reloaded')) return;
    sessionStorage.setItem('preload-reloaded', '1');
  } catch {
    return;
  }
  event.preventDefault();
  window.location.reload();
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

window.setTimeout(() => {
  const splash = document.getElementById('app-splash');
  if (!splash) return;
  splash.classList.add('is-ready');
  window.setTimeout(() => splash.remove(), 320);
}, 1250);
