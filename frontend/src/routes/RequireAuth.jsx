import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function RequireAuth() {
  const { autenticado } = useAuth();
  const local = useLocation();

  if (!autenticado) {
    return <Navigate to="/entrar" state={{ de: local }} replace />;
  }

  return <Outlet />;
}
