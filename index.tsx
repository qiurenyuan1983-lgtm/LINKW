import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Unregister any existing service workers to prevent origin mismatch errors in preview
// Wrap in load event to ensure document is in valid state
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.getRegistrations().then(function(registrations) {
      for(let registration of registrations) {
        registration.unregister().catch(err => console.log('SW unregister error:', err));
      }
    }).catch(function(err) {
      // Silently fail if SW API is restricted or document is invalid
      console.debug('Service Worker access failed (expected in some previews): ', err);
    });
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);