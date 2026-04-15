import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { auth, db } from '@/lib/firebase';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { supabase } from '@/lib/supabase';
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
    await firebaseSignOut(auth);
    await supabase.auth.signOut();
    resetAuthState();
  };

  useEffect(() => {
    const resolveUserProfile = async (uid: string, email?: string | null): Promise<AppUser | null> => {
      // 1. Try Supabase users table
      try {
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
      } catch (err) { }

      // 2. Try Firestore users collection (The original working credentials store)
      try {
        const globalUserDoc = await getDoc(doc(db, 'users', uid));
        if (globalUserDoc.exists()) {
          const globalUserData = globalUserDoc.data() as AppUser;
          return {
            ...globalUserData,
            uid: globalUserData.uid || uid,
            email: globalUserData.email || email || '',
            schoolId: globalUserData.schoolId || 'school_001',
          };
        }
      } catch (err) { }
      
      return null;
    };

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setAuthLoading(true);
      try {
        if (firebaseUser) {
          const userData = await resolveUserProfile(firebaseUser.uid, firebaseUser.email);
          const pendingLoginRole = readPendingLoginRole();

          if (!userData) {
            setAuthError("User profile not found. Please contact admin.");
            writePendingLoginRole(null);
            resetAuthState();
            await firebaseSignOut(auth);
            return;
          }

          if (pendingLoginRole && userData.role !== pendingLoginRole) {
            setAuthError(`Entry denied: User is registered as ${userData.role}, not ${pendingLoginRole}.`);
            writePendingLoginRole(null);
            resetAuthState();
            await firebaseSignOut(auth);
            return;
          }

          const linkedStudentId = getLinkedStudentId(userData);

          if (userData.role === 'student' && !linkedStudentId) {
            setAuthError("No student record linked to this account.");
            writePendingLoginRole(null);
            resetAuthState();
            await firebaseSignOut(auth);
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
        console.error("Auth sync error:", error);
        resetAuthState();
      } finally {
        setAuthLoading(false);
      }
    });

    return () => unsubscribe();
  }, [setCurrentUser]);

  const clearAuthError = () => setAuthError(null);
  const setPendingLoginRole = (pendingRole: UserRole | null) => {
    writePendingLoginRole(pendingRole);
    setAuthError(null);
  };

  return (
    <AuthContext.Provider value={{ role, setRole, schoolId, setSchoolId, parentStudentId, setParentStudentId, studentId, setStudentId, classId, setClassId, user, authLoading, authError, clearAuthError, setPendingLoginRole, signOut }}>
      {children}
    </AuthContext.Provider>
};
