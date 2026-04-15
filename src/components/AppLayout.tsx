import { useAuth } from '@/contexts/AuthContext';
import { BookOpen, LogOut } from 'lucide-react';
import { ReactNode } from 'react';
import { motion } from 'framer-motion';

const AppLayout = ({ children, title }: { children: ReactNode; title: string }) => {
  const { role, setRole } = useAuth();

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-50 bg-card/90 backdrop-blur-md border-b border-border shadow-sm">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-[72px] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div className="flex flex-col justify-center">
              <span className="font-display font-bold text-lg tracking-tight leading-tight">SchoolPulse</span>
              <span className="text-xs font-medium text-primary capitalize leading-tight">{role} Dashboard</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setRole(null)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground hover:bg-muted rounded-xl transition-colors"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Switch Role</span>
            </button>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-10">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="flex flex-col gap-6"
        >
          <div className="flex items-center justify-between">
            <h1 className="text-3xl font-display font-bold tracking-tight">{title}</h1>
          </div>
          {children}
        </motion.div>
      </main>
    </div>
  );
};

export default AppLayout;
