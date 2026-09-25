import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import './index.css';

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
