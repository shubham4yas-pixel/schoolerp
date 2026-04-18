import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { Loader2, Lock, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';

type PageState = 'loading' | 'ready' | 'success' | 'error';

const ResetPassword = () => {
  const [pageState, setPageState] = useState<PageState>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Supabase embeds the recovery token in the URL hash as:
    // #access_token=...&refresh_token=...&type=recovery
    // We need to let supabase.auth handle the session from the URL hash.
    const hash = window.location.hash;
    if (!hash) {
      setErrorMsg('No recovery token found in this link. Please request a new password reset email.');
      setPageState('error');
      return;
    }

    // supabase-js v2: onAuthStateChange will fire with SIGNED_IN + type=recovery
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY' || event === 'SIGNED_IN') {
        setPageState('ready');
      }
    });

    // Also check if we already have a session (token already exchanged)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setPageState('ready');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setPageState('success');
      toast.success('Password updated successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update password');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex justify-center mb-8">
          <div className="w-14 h-14 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/30">
            <Lock className="w-7 h-7 text-white" />
          </div>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl p-8 shadow-2xl">

          {/* Loading */}
          {pageState === 'loading' && (
            <div className="flex flex-col items-center gap-4 py-6">
              <Loader2 className="w-10 h-10 text-primary animate-spin" />
              <p className="text-white/60 text-sm">Verifying your reset link…</p>
            </div>
          )}

          {/* Error */}
          {pageState === 'error' && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="w-14 h-14 bg-red-500/10 rounded-2xl flex items-center justify-center">
                <AlertCircle className="w-7 h-7 text-red-400" />
              </div>
              <h2 className="text-white font-bold text-xl">Link Invalid</h2>
              <p className="text-white/50 text-sm">{errorMsg}</p>
              <a
                href="/"
                className="mt-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Go to Login
              </a>
            </div>
          )}

          {/* Success */}
          {pageState === 'success' && (
            <div className="flex flex-col items-center gap-4 py-4 text-center">
              <div className="w-14 h-14 bg-emerald-500/10 rounded-2xl flex items-center justify-center">
                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              </div>
              <h2 className="text-white font-bold text-xl">Password Updated!</h2>
              <p className="text-white/50 text-sm">Your password has been set successfully. You can now sign in.</p>
              <a
                href="/"
                className="mt-2 px-6 py-2.5 bg-primary text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-opacity"
              >
                Go to Login
              </a>
            </div>
          )}

          {/* Ready — show password form */}
          {pageState === 'ready' && (
            <>
              <h2 className="text-white font-bold text-2xl mb-1">Set New Password</h2>
              <p className="text-white/50 text-sm mb-6">Choose a strong password for your account.</p>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-white/60 text-xs font-semibold uppercase tracking-wider mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      required
                      minLength={8}
                      className="w-full px-4 py-3 pr-11 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-white/60 text-xs font-semibold uppercase tracking-wider mb-1.5">
                    Confirm Password
                  </label>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter your password"
                    required
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/20 focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary/50 transition-all text-sm"
                  />
                </div>

                {confirmPassword && password !== confirmPassword && (
                  <p className="text-red-400 text-xs flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Passwords do not match
                  </p>
                )}

                <button
                  type="submit"
                  disabled={saving || !password || !confirmPassword}
                  className="w-full py-3 bg-primary text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2 mt-2"
                >
                  {saving ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Updating…</>
                  ) : (
                    'Update Password'
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-white/20 text-xs mt-6">SchoolPulse ERP · Secure Password Reset</p>
      </div>
    </div>
  );
};

export default ResetPassword;
