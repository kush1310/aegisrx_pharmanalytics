import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Doctors from './pages/Doctors';
import DoctorProfile from './pages/DoctorProfile';
import Pharmacies from './pages/Pharmacies';
import PharmacyProfile from './pages/PharmacyProfile';
import Notifications from './pages/Notifications';
import History from './pages/History';
import Analytics from './pages/Analytics';
import UniversalUpload from './pages/UniversalUpload';
import DoctorPharmacyLinkage from './pages/DoctorPharmacyLinkage';
import Settings from './pages/Settings';
import Products from './pages/Products';
import SignUp from './pages/SignUp';
import { useAuthStore } from './stores/authStore';
import { api } from './lib/api';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, checkSession } = useAuthStore();
  const location = useLocation();
  const isValid = isAuthenticated && checkSession();
  if (!isValid) return <Navigate to="/login" state={{ from: location }} replace />;
  return <>{children}</>;
}

function App() {
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) return;
    const check = async () => {
      try { await api.post('/api/notifications/check-events', {}); }
      catch (e) { console.error('Failed to check notifications:', e); }
    };
    check();
    const interval = setInterval(check, 60 * 60 * 1000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"       element={<Dashboard />} />
        <Route path="doctors"         element={<Doctors />} />
        <Route path="doctors/linkage" element={<DoctorPharmacyLinkage />} />
        <Route path="doctors/:id"     element={<DoctorProfile />} />
        <Route path="pharmacies"      element={<Pharmacies />} />
        <Route path="pharmacies/:id"  element={<PharmacyProfile />} />
        <Route path="products"        element={<Products />} />
        <Route path="notifications"   element={<Notifications />} />
        <Route path="analytics"       element={<Analytics />} />
        <Route path="history"         element={<History />} />
        <Route path="history/:id"     element={<Analytics />} />
        <Route path="upload"          element={<UniversalUpload />} />
        <Route path="settings"        element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

export default App;
