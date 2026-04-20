import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/lib/types';
import { Loader2 } from 'lucide-react';

export const getRoleHomePath = (role: UserRole | null) => {
  switch (role) {
    case 'admin':
      return '/admin';
    case 'accountant':
      return '/accountant';
    case 'teacher':
      return '/teacher';
    case 'student':
      return '/student';
    case 'parent':
      return '/parent';
    default:
      return '/';
  }
};

const isAllowedRole = (role: UserRole, allowedRole: UserRole) => {
  return role === allowedRole;
};

const AuthLoader = () => (
  <div className="flex h-screen items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="w-10 h-10 text-primary animate-spin" />
      <p className="text-sm font-medium text-muted-foreground">Synchronizing session...</p>
    </div>
  </div>
);

const ProtectedRoute = ({ role: requiredRole, children }: { role: UserRole; children: ReactNode }) => {
  const { role, authLoading } = useAuth();
  const location = useLocation();

  console.log(`[ProtectedRoute] path=${location.pathname} | required=${requiredRole} | current=${role ?? 'none'} | loading=${authLoading}`);

  if (authLoading) {
    return <AuthLoader />;
  }

  if (!role) {
    console.log(`[ProtectedRoute] No role — redirecting to / from ${location.pathname}`);
    return <Navigate to="/" replace state={{ from: location }} />;
  }

  if (!isAllowedRole(role, requiredRole)) {
    console.log(`[ProtectedRoute] Wrong role (${role} ≠ ${requiredRole}) — redirecting to ${getRoleHomePath(role)}`);
    return <Navigate to={getRoleHomePath(role)} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
