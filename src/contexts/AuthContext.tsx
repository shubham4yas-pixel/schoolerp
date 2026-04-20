import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
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

const mapProfileToUser = (profile: any, uid: string, email?: string | null): AppUser => ({
  uid,
  email: profile.email || email || '',
  role: profile.role || 'student',
  name: profile.name || profile.email || email || 'User',
  emailSent: Boolean(profile.email_sent ?? profile.emailSent),
  classId: profile.class_id || profile.classId || undefined,
  section: profile.section || undefined,
  rollNumber: profile.roll_number || profile.rollNumber || undefined,
  linkedStudentId: profile.linked_student_id || profile.linkedStudentId || undefined,
  linkedChildrenIds: profile.linked_children_ids || profile.linkedChildrenIds || undefined,
  schoolId: profile.school_id || profile.schoolId || 'school_001',
  createdAt: profile.created_at || profile.createdAt || new Date().toISOString(),
  photoURL: profile.photo_url || profile.photoURL || undefined,
});

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

  const applyUser = (userData: AppUser) => {
    const linkedStudentId = getLinkedStudentId(userData);

    setAuthError(null);
    writePendingLoginRole(null);
    setUser(userData);
    setRole(userData.role);
    setSchoolId(userData.schoolId || 'school_001');
    setStudentId(userData.role === 'student' ? linkedStudentId : '');
    setParentStudentId(userData.role === 'parent' ? linkedStudentId : '');
    setClassId(userData.classId || null);
    setCurrentUser(userData);
  };

  const resolveUserProfile = async (uid: string, email?: string | null): Promise<AppUser | null> => {
    const targetEmail = (email || '').toLowerCase();

    // Hard-coded super-admin bypass (developer access — no DB row needed)
    if (targetEmail === 'shubham.kt2029i@iimbg.ac.in' || targetEmail === 'shubhamwork@gmail.com') {
      return {
        uid,
        email: targetEmail,
        role: 'admin',
        name: 'Shubham (Super Admin)',
        schoolId: 'school_001',
        createdAt: new Date().toISOString(),
      };
    }

    // 1. Primary lookup — by Firebase UID (fast path for existing sessions)
    const { data: byUid, error: uidError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle();

    if (uidError) {
      console.error('Supabase profile lookup failed:', uidError);
      return null;
    }

    if (byUid) {
      return mapProfileToUser(byUid, uid, email);
    }

    // 2. Fallback — lookup by email (handles developer-created rows that don't have the UID yet)
    if (!targetEmail) return null;

    const { data: byEmail, error: emailError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('email', targetEmail)
      .maybeSingle();

    if (emailError) {
      console.error('Supabase email profile lookup failed:', emailError);
      return null;
    }

    if (!byEmail) return null;

    // 3. Auto-patch: update the row's id to the real Firebase UID so future lookups are fast
    //    (fire-and-forget — don't block the login flow)
    supabase
      .from('user_profiles')
      .update({ id: uid, updated_at: new Date().toISOString() })
      .eq('email', targetEmail)
      .then(({ error }) => {
        if (error) console.warn('[resolveUserProfile] UID patch failed (non-fatal):', error.message);
        else console.log('[resolveUserProfile] UID auto-patched for', targetEmail);
      });

    return mapProfileToUser(byEmail, uid, email);
  };

  const syncSession = async (uid: string, email?: string | null) => {
    const userData = await resolveUserProfile(uid, email);
    const pendingLoginRole = readPendingLoginRole();

    if (!userData) {
      // If there's no pending login role, this is likely an admin creating a new user
      // account via signUp() — don't sign out the current admin session.
      if (!pendingLoginRole) {
        console.warn('[syncSession] Profile not found but no pending role — skipping sign-out (likely admin creating user).');
        return;
      }
      setAuthError('User profile not found. Please contact admin.');
      writePendingLoginRole(null);
      resetAuthState();
      await supabase.auth.signOut();
      return;
    }

    if (pendingLoginRole && userData.role !== pendingLoginRole) {
      setAuthError(`Entry denied: User is registered as ${userData.role}, not ${pendingLoginRole}.`);
      writePendingLoginRole(null);
      resetAuthState();
      await supabase.auth.signOut();
      return;
    }

    if (userData.role === 'student' && !getLinkedStudentId(userData)) {
      setAuthError('No student record linked to this account.');
      writePendingLoginRole(null);
      resetAuthState();
      await supabase.auth.signOut();
      return;
    }

    applyUser(userData);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    resetAuthState();
  };

  useEffect(() => {
    let mounted = true;
    let initialSessionHandled = false;
    // True if loadSession() successfully called syncSession (existing session at startup).
    // Used to skip a redundant SIGNED_IN event from onAuthStateChange on the same session.
    let loadSessionSynced = false;

    const loadSession = async () => {
      setAuthLoading(true);
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error('Supabase session error:', error);
        if (mounted) {
          resetAuthState();
          setAuthLoading(false);
        }
        initialSessionHandled = true;
        return;
      }

      if (mounted && data.session?.user) {
        await syncSession(data.session.user.id, data.session.user.email);
        loadSessionSynced = true;
      } else if (mounted) {
        resetAuthState();
      }

      if (mounted) setAuthLoading(false);
      initialSessionHandled = true;
    };

    void loadSession();

    const { data: subscription } = supabase.auth.onAuthStateChange((event, session) => {
      // Skip INITIAL_SESSION — loadSession() already covers it.
      if (event === 'INITIAL_SESSION') return;

      void (async () => {
        if (!mounted) return;

        // Wait for loadSession() to finish before processing any other event.
        // This prevents a race where both loadSession and the event handler
        // call syncSession concurrently on startup.
        if (!initialSessionHandled) {
          await new Promise<void>((resolve) => {
            const start = Date.now();
            const check = () => {
              if (initialSessionHandled || Date.now() - start > 5000) resolve();
              else setTimeout(check, 50);
            };
            check();
          });
          if (!mounted) return;
        }

        // If loadSession already synced this session (user was logged in at startup),
        // skip the duplicate SIGNED_IN to avoid a second unnecessary DB call.
        if (event === 'SIGNED_IN' && loadSessionSynced) {
          loadSessionSynced = false; // reset so future explicit logins are processed
          return;
        }

        setAuthLoading(true);
        try {
          if (session?.user) {
            await syncSession(session.user.id, session.user.email);
          } else {
            resetAuthState();
          }
        } catch (error) {
          console.error('Auth sync error:', error);
          if (mounted) resetAuthState();
        } finally {
          if (mounted) setAuthLoading(false);
        }
      })();
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
  );
};
