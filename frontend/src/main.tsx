import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.tsx'

// Global Fetch Interceptor to ensure Authorization header is always attached for tenant isolation
const originalFetch = window.fetch;
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const token = localStorage.getItem('pos_token');
  const urlStr = typeof input === 'string' ? input : (input instanceof Request ? input.url : input.toString());
  
  if (token && (urlStr.startsWith('/api') || urlStr.includes(':3000/api'))) {
    init = init || {};
    const headers = new Headers(init.headers || {});
    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    init.headers = headers;
  }
  return originalFetch(input, init);
};

// Global Clean Numeric Inputs (No Leading Zeros) Listener
document.addEventListener('focusin', (e) => {
  const target = e.target as HTMLInputElement;
  if (target && target.tagName === 'INPUT' && (target.type === 'number' || target.inputMode === 'numeric' || target.classList.contains('numeric-input'))) {
    // Select all text on focus so typing immediately replaces initial '0'
    setTimeout(() => {
      if (document.activeElement === target) {
        target.select();
      }
    }, 10);
  }
});

document.addEventListener('input', (e) => {
  const target = e.target as HTMLInputElement;
  if (target && target.tagName === 'INPUT' && (target.type === 'number' || target.inputMode === 'numeric' || target.classList.contains('numeric-input'))) {
    const val = target.value;
    // If user types numbers leading with 0 (e.g. "02", "023"), strip the leading zero
    if (val && /^0[0-9]+/.test(val)) {
      const cleaned = val.replace(/^0+(?=\d)/, '');
      if (cleaned !== val) {
        target.value = cleaned;
        // Dispatch React-compatible change event if necessary
        target.dispatchEvent(new Event('change', { bubbles: true }));
      }
    }
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
