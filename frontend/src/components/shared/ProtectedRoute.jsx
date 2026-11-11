import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Spinner } from '../ui/UI';

export default function ProtectedRoute({ roles, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <Spinner label="Checking session..." />;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  if (!user.termsAcceptedAt && location.pathname !== '/accept-terms') return <Navigate to="/accept-terms" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;

  return children;
}
