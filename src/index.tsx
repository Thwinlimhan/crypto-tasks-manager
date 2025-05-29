import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App'; // Your main application component
// Firebase imports are now handled within App.tsx or its children if needed for direct use,
// but initialization can happen here.
// For this setup, App.tsx handles its own Firebase initialization internally.

// Ensure Tailwind is loaded (usually via index.html or bundler config)
// For this project, Tailwind is loaded via a CDN in index.html

// If you had global styles, you would import them here, e.g.:
// import './index.css'; 

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
} else {
  console.error("Fatal Error: The root element with ID 'root' was not found in the HTML.");
  // Optionally, display an error message in the body if #root is missing
  const body = document.body;
  if (body) {
    body.innerHTML = '<div style="color: red; text-align: center; padding-top: 50px;">Error: Application cannot start. Root HTML element missing.</div>';
  }
}

// Service worker registration (if you manage it via JS, otherwise public/index.html handles it)
// Example:
// if ('serviceWorker' in navigator) {
//   window.addEventListener('load', () => {
//     navigator.serviceWorker.register('/service-worker.js')
//       .then(registration => {
//         console.log('SW registered: ', registration);
//       })
//       .catch(registrationError => {
//         console.log('SW registration failed: ', registrationError);
//       });
//   });
// }
