import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './ErrorBoundary.tsx';
import IssuerChooserHost from './components/IssuerChooserHost.tsx';
import { installIssuerFetch } from './lib/issuerView';
import { startReceiptLogoSync } from './lib/receiptLogo';
import { isStaleChunkError, reloadForNewVersion } from './lib/staleChunk';
import './index.css';

// Visão por CNPJ no cabeçalho de toda chamada à API + pergunta de qual CNPJ emitir nas notas.
installIssuerFetch();
// Logo da loja nas notinhas térmicas (app desktop): mantém o desktop atualizado com a opção "Exibir logo nas notinhas".
startReceiptLogoSync();

// Após um deploy, abas abertas podem apontar para arquivos da versão anterior: recarrega sozinho para pegar a versão nova
// (no máximo uma vez a cada 30 s — antes era UMA vez por aba, e no deploy seguinte o cliente via a tela de erro).
window.addEventListener('vite:preloadError', (event) => {
  if (reloadForNewVersion()) event.preventDefault();
});
window.addEventListener('unhandledrejection', (event) => {
  if (isStaleChunkError(event.reason)) reloadForNewVersion();
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
