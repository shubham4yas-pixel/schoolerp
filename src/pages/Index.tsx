import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useStore } from '@/store/useStore';
import LoginPage from '@/components/LoginPage';
import AdminDashboard from '@/pages/AdminDashboard';
import TeacherDashboard from '@/pages/TeacherDashboard';
import ParentDashboard from '@/pages/ParentDashboard';
import StudentDashboard from '@/pages/StudentDashboard';

const Index = () => {
  const { user, role, schoolId, authLoading } = useAuth();
  const init = useStore(state => state.init);

  useEffect(() => {
    if (schoolId) {
      // void init(schoolId);
    }
  }, [schoolId, init]);

  if (authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
          <p className="text-sm font-medium text-muted-foreground animate-pulse font-display uppercase tracking-widest text-[10px] font-black">Synchronizing Session...</p>
        </div>
      </div>
    );
  }

  // Role check is sufficient for Demo Mode / Immediate access
  if (!role) {
    return <LoginPage />;
  }

  if (role === 'admin' || role === 'accountant') return <AdminDashboard />;
  if (role === 'teacher') return <TeacherDashboard />;
  if (role === 'student') return <StudentDashboard />;
  return <ParentDashboard />;
};

export default Index;
