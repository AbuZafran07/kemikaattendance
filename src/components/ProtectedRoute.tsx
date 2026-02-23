import { ReactNode, useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';
import logger from '@/lib/logger';

interface ProtectedRouteProps {
  children: ReactNode;
  requireAdmin?: boolean;
}

export const ProtectedRoute = ({ children, requireAdmin = false }: ProtectedRouteProps) => {
  const { user, loading: authLoading } = useAuth();
  const [verifiedRole, setVerifiedRole] = useState<string | null>(null);
  const [roleLoading, setRoleLoading] = useState(true);

  useEffect(() => {
    const verifyRole = async () => {
      if (!user) {
        setRoleLoading(false);
        return;
      }

      try {
        // Server-side role verification - fetch directly from database
        // RLS policies ensure users can only see their own role
        const { data: roleData, error } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();

        if (error) {
          logger.error('Error verifying user role');
          setVerifiedRole('employee'); // Default to employee on error
        } else {
          setVerifiedRole(roleData?.role || 'employee');
        }
      } catch (error) {
        logger.error('Error in role verification');
        setVerifiedRole('employee');
      } finally {
        setRoleLoading(false);
      }
    };

    if (!authLoading) {
      verifyRole();
    }
  }, [user, authLoading]);

  // Show loading while auth or role verification is in progress
  if (authLoading || roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Redirect non-admins and non-hr away from admin routes
  if (requireAdmin && verifiedRole !== 'admin' && verifiedRole !== 'hr') {
    return <Navigate to="/employee" replace />;
  }

  return <>{children}</>;
};
