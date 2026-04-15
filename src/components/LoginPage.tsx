import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppUser, UserRole } from '@/lib/types';
import { auth, db } from '@/lib/firebase';
import { supabase } from '@/lib/supabase';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { Shield, BookOpen, Users, GraduationCap, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getRoleHomePath } from '@/components/ProtectedRoute';

const LoginPage = () => {
  const { authError, clearAuthError, setPendingLoginRole, authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const resolveUserProfile = async (uid: string): Promise<AppUser | null> => {
    // 1. Try Supabase first
    const { data: sbUser, error: sbError } = await supabase
      .from('users')
      .select('*')
      .eq('uid', uid)
      .maybeSingle();

    if (!sbError && sbUser) {
      return {
        ...sbUser,
        uid: sbUser.uid || uid,
        schoolId: sbUser.schoolId || 'school_001',
      } as AppUser;
    }

    // 2. Fallback to Firestore (original store)
    try {
      const userRef = doc(db, 'users', uid);
      const userSnap = await getDoc(userRef);

      if (userSnap.exists()) {
        const userData = userSnap.data() as AppUser;
        return {
          ...userData,
          uid: userData.uid || uid,
          schoolId: userData.schoolId || 'school_001',
        };
      }
    } catch (err) { }

    return null;
  };

  const handleLogin = async (e: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!selectedRole) {
      setError("Select a role to continue");
      return;
    }

    if (!email || !password) {
      setError("Enter email and password");
      return;
    }

    setIsLoading(true);
    setError('');
    clearAuthError();
    setPendingLoginRole(selectedRole);

    try {
      // PRIMARY: Login via Firebase so existing credentials work
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const userData = await resolveUserProfile(userCredential.user.uid);

      if (!userData) {
        setPendingLoginRole(null);
        setError("Account verified, but profile not found. Please contact admin.");
        await signOut();
        return;
      }

      if (selectedRole !== userData.role) {
        const roleLabel = roles.find(r => r.role === userData.role)?.label || userData.role;
        setPendingLoginRole(null);
        setError(`Access denied: This account is registered as ${roleLabel}.`);
        await signOut();
        return;
      }

      if (userData.role === 'student' && !userData.linkedStudentId && !(userData.linkedChildrenIds || []).length) {
        setPendingLoginRole(null);
        setError("No student record linked to this account.");
        await signOut();
        return;
      }

      navigate(getRoleHomePath(userData.role), { replace: true });
    } catch (error: any) {
      console.error("Firebase Login Error:", error.code, error.message);
      
      // OPTIONAL: Fallback to Supabase
      try {
        const { data: sbData, error: sbError } = await supabase.auth.signInWithPassword({ email, password });
        if (!sbError && sbData.user) {
            const userData = await resolveUserProfile(sbData.user.id);
            if (userData && selectedRole === userData.role) {
                navigate(getRoleHomePath(userData.role), { replace: true });
                return;
            } else if (userData) {
                const roleLabel = roles.find(r => r.role === userData.role)?.label || userData.role;
                setError(`Access denied: This account is registered as ${roleLabel}.`);
                await signOut();
                setIsLoading(false);
                return;
            }
        }
      } catch(e) {}

      setPendingLoginRole(null);
      // Consistent error message for any credential failure
      setError("Invalid email or password. Please check your credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) {
      toast.error("Please enter your email first");
      return;
    }
    if (!email.includes('@')) {
      toast.error("Enter a valid email address");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      toast.success("Password reset email sent. Check your inbox.");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to send reset email");
    }
  };

  const handleRoleSelect = (role: UserRole) => {
    setSelectedRole(role);
    setError('');
    clearAuthError();
    setPendingLoginRole(null);
  };

  const handleChangeRole = () => {
    setSelectedRole(null);
    setError('');
    clearAuthError();
    setPendingLoginRole(null);
  };

  const roles: { role: UserRole; label: string; desc: string; icon: React.ReactNode }[] = [
    { role: 'admin', label: 'Admin', desc: 'Full access to school management', icon: <Shield className="w-8 h-8 text-warning" /> },
    { role: 'accountant', label: 'Accountant', desc: 'Manage fees and billing', icon: <BookOpen className="w-8 h-8 text-warning" /> },
    { role: 'teacher', label: 'Teacher', desc: 'Manage classes and student performance', icon: <BookOpen className="w-8 h-8 text-warning" /> },
    { role: 'student', label: 'Student', desc: 'View your performance and compare with peers', icon: <GraduationCap className="w-8 h-8 text-warning" /> },
    { role: 'parent', label: 'Parent', desc: "View your child's progress", icon: <Users className="w-8 h-8 text-warning" /> },
  ];
  const activeRole = roles.find(roleOption => roleOption.role === selectedRole) || null;
  const displayError = error || authError;
  const isSubmitting = isLoading || authLoading;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4">
            <BookOpen className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-display font-bold text-foreground">SchoolPulse</h1>
          <p className="text-muted-foreground mt-2">School Performance Management & Analytics</p>
        </div>

        {selectedRole ? (
          <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
            <button
              type="button"
              onClick={handleChangeRole}
              className="text-[10px] font-bold text-primary hover:underline uppercase tracking-wide mb-4"
            >
              ← Change Role
            </button>
            {activeRole && (
              <div className="flex items-center gap-4 mb-6 rounded-xl border border-border bg-muted/30 px-4 py-3 transition-all">
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  {activeRole.icon}
                </div>
                <div>
                  <div className="font-display font-semibold text-foreground text-lg">{activeRole.label}</div>
                  <div className="text-muted-foreground text-sm">{activeRole.desc}</div>
                </div>
              </div>
            )}
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1.5 font-display uppercase tracking-widest text-[10px] font-black opacity-60">Email Address</label>
                <input type="email" value={email} onChange={e => {
                  setEmail(e.target.value);
                  if (error) setError('');
                  if (authError) clearAuthError();
                }}
                  className="w-full px-4 py-3 text-sm bg-muted/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                  placeholder="name@school.com" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-foreground font-display uppercase tracking-widest text-[10px] font-black opacity-60">Password</label>
                  <button type="button" onClick={handleForgotPassword} className="text-[10px] font-bold text-primary hover:underline uppercase tracking-wide">Forgot Password?</button>
                </div>
                <input type="password" value={password} onChange={e => {
                  setPassword(e.target.value);
                  if (error) setError('');
                  if (authError) clearAuthError();
                }}
                  className="w-full px-4 py-3 text-sm bg-muted/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                  placeholder="Enter your password" />
              </div>
              {displayError && (
                <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg border border-destructive/20 animate-in fade-in slide-in-from-top-1">
                  <AlertCircle className="w-4 h-4" /> {displayError}
                </div>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-4 bg-primary text-primary-foreground rounded-xl text-sm font-bold uppercase tracking-widest shadow-lg shadow-primary/20 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                Sign In to Dashboard
              </button>
            </form>
            <div className="mt-6 pt-6 border-t border-border">
              <p className="text-[10px] font-bold text-muted-foreground mb-3 uppercase tracking-widest opacity-60">Managed Access Roles</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] text-muted-foreground/80">
                <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-warning" /> Administrator</div>
                <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-primary" /> Educator</div>
                <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-success" /> Student</div>
                <div className="flex items-center gap-2"><div className="w-1.5 h-1.5 rounded-full bg-info" /> Parent</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {roles.map(({ role, label, desc, icon }) => (
              <button key={role} onClick={() => handleRoleSelect(role)}
                className={`w-full flex items-center gap-4 p-5 rounded-xl bg-card border transition-all duration-200 group text-left ${selectedRole === role ? 'border-primary shadow-lg ring-2 ring-primary/20' : 'border-border hover:border-primary/40 hover:shadow-lg'}`}>
                <div className={`flex-shrink-0 w-14 h-14 rounded-xl text-primary flex items-center justify-center transition-colors ${selectedRole === role ? 'bg-primary text-primary-foreground' : 'bg-primary/10 group-hover:bg-primary group-hover:brightness-110'}`}>
                  {icon}
                </div>
                <div>
                  <div className="font-display font-semibold text-foreground text-lg">{label}</div>
                  <div className="text-muted-foreground text-sm">{desc}</div>
                </div>
              </button>
            ))}
          </div>
        )}

        <p className="text-center text-muted-foreground text-xs mt-8">Credentials are managed by the school admin</p>
      </div>
    </div>
  );
};

export default LoginPage;
