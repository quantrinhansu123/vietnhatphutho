import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {enableMobileNumericKeyboards} from './utils/mobileNumericKeyboard.ts';

enableMobileNumericKeyboards();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
