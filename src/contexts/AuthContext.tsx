import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { db } from '@/lib/firebase';
import { supabase } from '@/lib/supabase';
import { doc, getDoc, getFirestore } from 'firebase/firestore';
import { UserRole, AppUser } from '@/lib/types';
import { useStore } from '@/store/useStore';

const PENDING_LOGIN_ROLE_KEY = 'schoolpulse_pending_login_role';

const isUserRole = (value: string | null): value is UserRole =>
  value === 'admin' ||
  value === 'accountant' ||
  value === 'teacher' ||
  value === 'student' ||
  value === 'parent';

const readPendingLoginRole = (): UserRole | null => {
  if (typeof window === 'undefined') return null;
  const value = window.sessionStorage.getItem(PENDING_LOGIN_ROLE_KEY);
  return isUserRole(value) ? value : null;
};

const writePendingLoginRole = (role: UserRole | null) => {
  if (typeof window === 'undefined') return;
  if (role) window.sessionStorage.setItem(PENDING_LOGIN_ROLE_KEY, role);
  else window.sessionStorage.removeItem(PENDING_LOGIN_ROLE_KEY);
};

const getLinkedStudentId = (userData: AppUser) => {
  if (userData.linkedStudentId) return userData.linkedStudentId;
  if (Array.isArray(userData.linkedChildrenIds) && userData.linkedChildrenIds.length > 0) {
    return userData.linkedChildrenIds[0] || '';
  }
  return '';
};

interface AuthContextType {
  role: UserRole | null;
  setRole: (role: UserRole | null) => void;
  schoolId: string;
  setSchoolId: (id: string) => void;
  parentStudentId: string;
  setParentStudentId: (id: string) => void;
  studentId: string;
  setStudentId: (id: string) => void;
  classId: string | null;
  setClassId: (id: string | null) => void;
  user: AppUser | null;
  authLoading: boolean;
  authError: string | null;
  clearAuthError: () => void;
  setPendingLoginRole: (role: UserRole | null) => void;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  role: null,
  setRole: () => { },
  schoolId: 'school_001',
  setSchoolId: () => { },
  parentStudentId: 'S001',
  setParentStudentId: () => { },
  studentId: 'S001',
  setStudentId: () => { },
  classId: null,
  setClassId: () => { },
  user: null,
  authLoading: true,
  authError: null,
  clearAuthError: () => { },
  setPendingLoginRole: () => { },
  signOut: async () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [role, setRole] = useState<UserRole | null>(null);
  const [schoolId, setSchoolId] = useState('school_001'); 
  const [parentStudentId, setParentStudentId] = useState('S001');
  const [studentId, setStudentId] = useState('S001');
  const [classId, setClassId] = useState<string | null>(null);
  const [user, setUser] = useState<AppUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const setCurrentUser = useStore(state => state.setCurrentUser);

  const resetAuthState = () => {
    setUser(null);
    setRole(null);
    setSchoolId('school_001');
    setParentStudentId('S001');
    setStudentId('S001');
    setClassId(null);
    setCurrentUser(null);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    resetAuthState();
  };

  useEffect(() => {
    const resolveUserProfile = async (uid: string, email?: string | null): Promise<AppUser | null> => {
      // First try Supabase users table (preferred)
      const { data: sbUser, error: sbError } = await supabase
        .from('users')
        .select('*')
        .eq('uid', uid)
        .maybeSingle();

      if (!sbError && sbUser) {
        return {
          ...sbUser,
          uid: sbUser.uid || uid,
          email: sbUser.email || email || '',
          schoolId: sbUser.schoolId || 'school_001',
        } as AppUser;
      }

      // Fallback to Firestore for legacy profiles
      try {
        const docRef = doc(db, 'users', uid);
        const globalUserDoc = await getDoc(docRef);
        if (globalUserDoc.exists()) {
          const globalUserData = globalUserDoc.data() as AppUser;
          return {
            ...globalUserData,
            uid: globalUserData.uid || uid,
            email: globalUserData.email || email || '',
            schoolId: globalUserData.schoolId || 'school_001',
          };
        }
      } catch (err) {
        console.error("Firestore resolution error:", err);
      }
      
      return null;
    };

    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        await handleAuthStateChange(session.user);
      } else {
        setAuthLoading(false);
      }
    };

    const handleAuthStateChange = async (sbUser: any) => {
      setAuthLoading(true);
      try {
        if (sbUser) {
          const userData = await resolveUserProfile(sbUser.id, sbUser.email);
          const pendingLoginRole = readPendingLoginRole();

          if (!userData) {
            setAuthError("User not registered in profile database");
            writePendingLoginRole(null);
            resetAuthState();
            await supabase.auth.signOut();
            return;
          }

          if (pendingLoginRole && userData.role !== pendingLoginRole) {
            setAuthError(`Access denied: User is registered as ${userData.role}, not ${pendingLoginRole}`);
            writePendingLoginRole(null);
            resetAuthState();
            await supabase.auth.signOut();
            return;
          }

          const linkedStudentId = getLinkedStudentId(userData);

          if (userData.role === 'student' && !linkedStudentId) {
            setAuthError("No student linked to this account");
            writePendingLoginRole(null);
            resetAuthState();
            await supabase.auth.signOut();
            return;
          }

          setAuthError(null);
          writePendingLoginRole(null);
          setUser(userData);
          setRole(userData.role);
          setSchoolId(userData.schoolId || 'school_001');
          setStudentId(userData.role === 'student' ? linkedStudentId : '');
          setParentStudentId(userData.role === 'parent' ? linkedStudentId : '');
          if (userData.classId) setClassId(userData.classId);
          else setClassId(null);
          setCurrentUser(userData);
        } else {
          resetAuthState();
        }
      } catch (error) {
        console.error("Error synchronizing auth state:", error);
        resetAuthState();
      } finally {
        setAuthLoading(false);
      }
    };

    initAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) handleAuthStateChange(session.user);
      } else if (event === 'SIGNED_OUT') {
        handleAuthStateChange(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [setCurrentUser]);

  const clearAuthError = () => setAuthError(null);
  const setPendingLoginRole = (pendingRole: UserRole | null) => {
    writePendingLoginRole(pendingRole);
    setAuthError(null);
  };

  return (
    <AuthContext.Provider value={{ role, setRole, schoolId, setSchoolId, parentStudentId, setParentStudentId, studentId, setStudentId, classId, setClassId, user, authLoading, authError, clearAuthError, setPendingLoginRole }}>
      {children}
    </AuthContext.Provider>
  );
};
