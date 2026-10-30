import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import AuthGate from './AuthGate';
import './index.css';
import { initTheme } from './theme';
import { registerSW } from 'virtual:pwa-register';

initTheme();

function showUpdateBanner(onUpdate: () => void) {
  if (document.getElementById('pwa-update-banner')) return;

  const bar = document.createElement('div');
  bar.id = 'pwa-update-banner';
  bar.className = 'update-banner';
  bar.setAttribute('role', 'status');
  bar.setAttribute('aria-live', 'polite');

  const message = document.createElement('span');
  message.textContent = 'Uma nova versão do Vetor Hub está disponível.';

  const actions = document.createElement('div');
  actions.className = 'update-banner-actions';

  const later = document.createElement('button');
  later.type = 'button';
  later.className = 'update-banner-later';
  later.textContent = 'Depois';
  later.addEventListener('click', () => bar.remove());

  const update = document.createElement('button');
  update.type = 'button';
  update.className = 'update-banner-now';
  update.textContent = 'Atualizar';
  update.addEventListener('click', () => {
    update.disabled = true;
    update.textContent = 'Atualizando…';
    onUpdate();
  });

  actions.append(later, update);
  bar.append(message, actions);
  document.body.append(bar);
}

// Keep prompt mode: automatic reload could discard unsaved product/quote forms.
const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    showUpdateBanner(() => { void updateSW(true); });
  },
  onRegisteredSW(_swUrl, registration) {
    if (!registration) return;
    let checking = false;
    const checkForUpdates = () => {
      if (checking || document.visibilityState !== 'visible' || !navigator.onLine) return;
      checking = true;
      void registration.update().catch(() => undefined).finally(() => { checking = false; });
    };
    // Also check when the installed PWA is reopened or brought to foreground.
    window.addEventListener('focus', checkForUpdates);
    window.addEventListener('online', checkForUpdates);
    document.addEventListener('visibilitychange', checkForUpdates);
    window.setInterval(checkForUpdates, 15 * 60 * 1000);
    checkForUpdates();
  },
});

createRoot(document.getElementById('root')!).render(
  <React.StrictMode><AuthGate><App /></AuthGate></React.StrictMode>,
);
