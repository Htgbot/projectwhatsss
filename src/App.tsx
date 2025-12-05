import { useState } from 'react';
import { useAuth } from './contexts/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TempSuper from './pages/TempSuper';

function App() {
  const { user, loading } = useAuth();

  // Temporary backdoor route for creating superadmin
  if (window.location.pathname === '/tempsuper') {
    return <TempSuper />;
  }

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#f0f2f5]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return <Dashboard />;
}

export default App;
