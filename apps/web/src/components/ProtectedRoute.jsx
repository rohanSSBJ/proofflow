import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export function ProtectedRoute({ children, roles }) {
  const auth = useAuth();
  const location = useLocation();
  if (auth.loading) return <div className="center-state"><span className="spinner" /> Restoring your workspace…</div>;
  if (!auth.user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (roles && !roles.includes(auth.role)) return <Navigate to="/app" replace />;
  return children;
}
