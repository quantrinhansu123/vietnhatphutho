import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import 'select2/dist/css/select2.min.css';
import './index.css';
import App from './App.tsx';
import {enableMobileNumericKeyboards} from './utils/mobileNumericKeyboard.ts';

enableMobileNumericKeyboards();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
