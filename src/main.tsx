import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import IssuerChooserHost from './components/IssuerChooserHost.tsx';
import { installIssuerFetch } from './lib/issuerView';
import { startReceiptLogoSync } from './lib/receiptLogo';
import './index.css';

// Visão por CNPJ no cabeçalho de toda chamada à API + pergunta de qual CNPJ emitir nas notas.
installIssuerFetch();
// Logo da loja nas notinhas térmicas (app desktop): mantém o desktop atualizado com a opção "Exibir logo nas notinhas".
startReceiptLogoSync();

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
      <IssuerChooserHost />
    </ErrorBoundary>
  </StrictMode>,
);

window.setTimeout(() => {
  const splash = document.getElementById('app-splash');
  if (!splash) return;
  splash.classList.add('is-ready');
  window.setTimeout(() => splash.remove(), 320);
}, 1250);
