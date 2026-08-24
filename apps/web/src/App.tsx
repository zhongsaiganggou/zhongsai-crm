import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/AppShell';
import { Loading } from './components/Feedback';
import { useAuth } from './contexts/AuthContext';
import { AdsPage } from './pages/AdsPage';
import { DashboardPage } from './pages/DashboardPage';
import { LeadDetailPage } from './pages/LeadDetailPage';
import { LeadsPage } from './pages/LeadsPage';
import { LoginPage } from './pages/LoginPage';
import { ProfilePage } from './pages/ProfilePage';
import { ReviewPage } from './pages/ReviewPage';
import { SettingsPage } from './pages/SettingsPage';
import { UsersPage } from './pages/UsersPage';

function Protected() {
  const { user, loading } = useAuth();
  if (loading) return <div className="min-h-screen bg-canvas"><Loading label="正在进入中赛 CRM" /></div>;
  return user ? <Outlet /> : <Navigate to="/login" replace />;
}

function AdminOnly() {
  const { user } = useAuth();
  return user?.role === 'ADMIN' ? <Outlet /> : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<Protected />}>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="leads" element={<LeadsPage />} />
          <Route path="leads/:id" element={<LeadDetailPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route element={<AdminOnly />}>
            <Route path="review" element={<ReviewPage />} />
            <Route path="ads" element={<AdsPage />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

