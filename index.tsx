import './src/index.css';
import React, { Suspense, lazy, useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Admin dashboard is code-split so normal users don't download recharts/tanstack.
const AdminApp = lazy(() => import('./components/AdminDashboard'));

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const isAdminRoute = () => window.location.hash.startsWith('#/admin');

const Root: React.FC = () => {
  const [admin, setAdmin] = useState(isAdminRoute());

  useEffect(() => {
    const onHash = () => setAdmin(isAdminRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (admin) {
    return (
      <Suspense fallback={<div className="min-h-screen bg-[#0b0f19]" />}>
        <AdminApp />
      </Suspense>
    );
  }
  return <App />;
};

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
);
