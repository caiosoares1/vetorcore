import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import AuthGate from './AuthGate';
import './style.css';
import { registerSW } from 'virtual:pwa-register';
const updateSW = registerSW({onNeedRefresh() {
  const bar = document.createElement('div');
  bar.className='update-banner';
  bar.innerHTML='<span>Uma nova versão do Vetor Hub está disponível.</span><button type="button">Atualizar</button>';
  bar.querySelector('button')?.addEventListener('click',()=>updateSW(true));
  document.body.appendChild(bar);
}});
createRoot(document.getElementById('root')!).render(<React.StrictMode><AuthGate><App/></AuthGate></React.StrictMode>);
