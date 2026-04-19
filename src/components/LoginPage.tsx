import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppUser, UserRole } from '@/lib/types';
import { supabase } from '@/lib/supabase';
import {
  Shield, BookOpen, Users, GraduationCap, AlertCircle, Loader2,
  CheckCircle2, BarChart3, ClipboardList, DollarSign, Bell, Lock,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { toast } from 'sonner';
import { getRoleHomePath } from '@/components/ProtectedRoute';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface FAQItem {
  q: string;
  a: string;
}

const faqs: FAQItem[] = [
  {
    q: 'What is SchoolPulse?',
    a: 'SchoolPulse is a web-based school ERP that helps schools manage fees, attendance, student records, exams, and parent communication — all from one dashboard. No installation needed.',
  },
  {
    q: 'Who can use SchoolPulse?',
    a: 'School administrators, accountants, teachers, students, and parents each get a dedicated dashboard with role-specific tools and data.',
  },
  {
    q: 'Does SchoolPulse support fee collection and receipts?',
    a: 'Yes. SchoolPulse includes a complete fee management module with automated tracking, payment recording, and printable A4 receipts.',
  },
  {
    q: 'Is SchoolPulse cloud-based?',
    a: 'Yes. Fully cloud-based and accessible from any modern browser on any device. No hardware or installation required.',
  },
  {
    q: 'Is it suitable for small and medium-sized schools?',
    a: 'Absolutely. SchoolPulse is built specifically for small and medium schools that need a simple, reliable ERP without enterprise complexity.',
  },
];

const features = [
  { icon: <DollarSign className="w-5 h-5" />, title: 'Automated Fee Management', desc: 'Track dues, record payments, and print receipts instantly.' },
  { icon: <ClipboardList className="w-5 h-5" />, title: 'Attendance Tracking', desc: 'Mark and monitor daily attendance across all classes with exportable reports.' },
  { icon: <BarChart3 className="w-5 h-5" />, title: 'Student Performance Reports', desc: 'Exam results, mark sheets, and subject-wise analysis in one place.' },
  { icon: <Shield className="w-5 h-5" />, title: 'Admin Dashboard', desc: 'Complete school-wide oversight for principals and administrators.' },
  { icon: <BookOpen className="w-5 h-5" />, title: 'Teacher & Parent Access', desc: 'Teachers enter marks and feedback; parents monitor their child\'s progress.' },
  { icon: <Lock className="w-5 h-5" />, title: 'Role-Based Security', desc: 'Separate logins for admin, teacher, student, and parent — data stays protected.' },
];

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────
const FAQAccordion = ({ faqs }: { faqs: FAQItem[] }) => {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="space-y-3">
      {faqs.map((item, i) => (
        <div
          key={i}
          className="border border-border rounded-xl overflow-hidden"
        >
          <button
            id={`faq-q-${i}`}
            aria-expanded={open === i}
            aria-controls={`faq-a-${i}`}
            onClick={() => setOpen(open === i ? null : i)}
            className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left bg-card hover:bg-muted/40 transition-colors"
          >
            <span className="font-semibold text-sm text-foreground">{item.q}</span>
            {open === i ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
          </button>
          {/* Answer always in DOM for accessibility; CSS controls visibility */}
          <div
            id={`faq-a-${i}`}
            role="region"
            aria-labelledby={`faq-q-${i}`}
            className="px-5 text-sm text-muted-foreground bg-card transition-all duration-300 overflow-hidden"
            style={{ maxHeight: open === i ? '200px' : '0px', paddingBottom: open === i ? '1rem' : '0px' }}
          >
            <p>{item.a}</p>
          </div>
        </div>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────
// Main LoginPage Component
// ─────────────────────────────────────────────
const LoginPage = () => {
  const { authError, clearAuthError, setPendingLoginRole, authLoading, signOut } = useAuth();
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const resolveUserProfile = async (uid: string): Promise<AppUser | null> => {
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle();

    if (error) {
      console.error('Supabase profile lookup failed:', error);
      return null;
    }

    if (data) {
      return {
        uid,
        email: data.email || '',
        role: data.role,
        name: data.name || data.email || 'User',
        emailSent: Boolean(data.email_sent ?? data.emailSent),
        classId: data.class_id || undefined,
        section: data.section || undefined,
        rollNumber: data.roll_number || undefined,
        linkedStudentId: data.linked_student_id || undefined,
        linkedChildrenIds: data.linked_children_ids || undefined,
        schoolId: data.school_id || 'school_001',
        createdAt: data.created_at || new Date().toISOString(),
      } as AppUser;
    }

    return null;
  };

  const handleLogin = async (e: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!selectedRole) {
      setError('Select a role to continue');
      return;
    }

    if (!email || !password) {
      setError('Enter email and password');
      return;
    }

    setIsLoading(true);
    setError('');
    clearAuthError();
    setPendingLoginRole(selectedRole);

    try {
      const { data, error: loginError } = await supabase.auth.signInWithPassword({ email, password });
      if (loginError) throw loginError;

      const userData = data.user ? await resolveUserProfile(data.user.id) : null;

      if (!userData) {
        setPendingLoginRole(null);
        setError('Account verified, but profile not found. Please contact admin.');
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
        setError('No student record linked to this account.');
        await signOut();
        return;
      }

      navigate(getRoleHomePath(userData.role), { replace: true });
    } catch (error: any) {
      console.error('Supabase login error:', error.message || error);
      setPendingLoginRole(null);
      setError('Invalid email or password. Please check your credentials.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email) { toast.error('Please enter your email first'); return; }
    if (!email.includes('@')) { toast.error('Enter a valid email address'); return; }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      toast.success('Password reset email sent. Check your inbox.');
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || 'Failed to send reset email');
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
    { role: 'accountant', label: 'Accountant', desc: 'Manage fees and billing', icon: <DollarSign className="w-8 h-8 text-warning" /> },
    { role: 'teacher', label: 'Teacher', desc: 'Manage classes and student performance', icon: <BookOpen className="w-8 h-8 text-warning" /> },
    { role: 'student', label: 'Student', desc: 'View your performance and compare with peers', icon: <GraduationCap className="w-8 h-8 text-warning" /> },
    { role: 'parent', label: 'Parent', desc: "View your child's progress", icon: <Users className="w-8 h-8 text-warning" /> },
  ];

  const activeRole = roles.find(r => r.role === selectedRole) || null;
  const displayError = error || authError;
  const isSubmitting = isLoading || authLoading;

  return (
    <div className="min-h-screen bg-background">
      {/* ── Hero + Login section ─────────────────────── */}
      <div className="flex flex-col lg:flex-row min-h-screen">

        {/* Left: SEO Content Panel */}
        <div className="flex-1 flex flex-col justify-center px-8 py-16 lg:px-16 xl:px-24 bg-gradient-to-br from-primary/5 via-background to-background border-r border-border">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-10">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary">
              <BookOpen className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold font-display text-foreground tracking-tight">SchoolPulse</span>
          </div>

          {/* H1 – Primary keyword heading */}
          <h1 className="text-3xl lg:text-4xl xl:text-5xl font-display font-extrabold text-foreground leading-tight mb-4">
            Simple School ERP for<br />
            <span className="text-primary">Fees, Attendance</span><br />
            &amp; Management
          </h1>
          <p className="text-muted-foreground text-lg leading-relaxed mb-10 max-w-xl">
            SchoolPulse brings every part of your school into one dashboard — from fee collection and attendance to exam results and parent communication.
          </p>

          {/* Quick benefit bullets */}
          <ul className="space-y-3 mb-10" aria-label="Key benefits">
            {[
              'Automated fee tracking with printable receipts',
              'Daily attendance across all classes',
              'Exam marks, reports, and performance analytics',
              'Separate portals for admin, teachers, students & parents',
            ].map((item) => (
              <li key={item} className="flex items-start gap-3 text-sm text-foreground">
                <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          {/* Trust badges */}
          <div className="flex flex-wrap gap-3">
            {['Cloud-Based', 'Role-Based Access', 'India Ready', 'No Installation'].map((badge) => (
              <span key={badge} className="px-3 py-1 rounded-full text-xs font-semibold bg-primary/10 text-primary border border-primary/20">
                {badge}
              </span>
            ))}
          </div>
        </div>

        {/* Right: Login Panel */}
        <div className="w-full lg:w-[480px] flex flex-col justify-center px-8 py-16 lg:px-12">
          <div className="mb-8">
            <h2 className="text-2xl font-display font-bold text-foreground mb-1">Sign In</h2>
            <p className="text-muted-foreground text-sm">Select your role, then enter your credentials.</p>
          </div>

          {selectedRole ? (
            <div className="bg-card rounded-xl border border-border p-6 shadow-sm">
              <button
                type="button"
                onClick={handleChangeRole}
                className="text-[10px] font-bold text-primary hover:underline uppercase tracking-wide mb-4"
                id="change-role-btn"
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
              <form onSubmit={handleLogin} className="space-y-5" aria-label="Login form">
                <div>
                  <label htmlFor="login-email" className="block text-[10px] font-black uppercase tracking-widest text-foreground/60 mb-1.5">Email Address</label>
                  <input
                    id="login-email"
                    type="email"
                    value={email}
                    onChange={e => { setEmail(e.target.value); if (error) setError(''); if (authError) clearAuthError(); }}
                    className="w-full px-4 py-3 text-sm bg-muted/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                    placeholder="name@school.com"
                    autoComplete="email"
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label htmlFor="login-password" className="block text-[10px] font-black uppercase tracking-widest text-foreground/60">Password</label>
                    <button type="button" onClick={handleForgotPassword} className="text-[10px] font-bold text-primary hover:underline uppercase tracking-wide" id="forgot-password-btn">Forgot Password?</button>
                  </div>
                  <input
                    id="login-password"
                    type="password"
                    value={password}
                    onChange={e => { setPassword(e.target.value); if (error) setError(''); if (authError) clearAuthError(); }}
                    className="w-full px-4 py-3 text-sm bg-muted/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-all"
                    placeholder="Enter your password"
                    autoComplete="current-password"
                  />
                </div>
                {displayError && (
                  <div role="alert" className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-lg border border-destructive/20 animate-in fade-in slide-in-from-top-1">
                    <AlertCircle className="w-4 h-4" /> {displayError}
                  </div>
                )}
                <button
                  id="login-submit-btn"
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-4 bg-primary text-primary-foreground rounded-xl text-sm font-bold uppercase tracking-widest shadow-lg shadow-primary/20 hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  Sign In to Dashboard
                </button>
              </form>
            </div>
          ) : (
            <div className="space-y-3" role="list" aria-label="Select role to sign in">
              {roles.map(({ role, label, desc, icon }) => (
                <button
                  key={role}
                  id={`role-btn-${role}`}
                  onClick={() => handleRoleSelect(role)}
                  className="w-full flex items-center gap-4 p-5 rounded-xl bg-card border transition-all duration-200 group text-left border-border hover:border-primary/40 hover:shadow-lg"
                  role="listitem"
                >
                  <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-primary/10 text-primary flex items-center justify-center transition-colors group-hover:bg-primary group-hover:text-primary-foreground">
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

      {/* ── SEO Content Sections (below the fold) ──────── */}
      <main id="seo-content" aria-label="SchoolPulse product information">

        {/* Section: What SchoolPulse Does */}
        <section aria-labelledby="section-what" className="py-16 px-6 lg:px-16 bg-muted/30 border-t border-border">
          <div className="max-w-5xl mx-auto">
            <h2 id="section-what" className="text-2xl font-display font-bold text-foreground mb-4">What SchoolPulse Does</h2>
            <p className="text-muted-foreground text-base leading-relaxed max-w-3xl">
              SchoolPulse is a comprehensive school ERP (Enterprise Resource Planning) system built for
              everyday school operations. It replaces paper registers, disconnected spreadsheets, and
              manual fee ledgers with a single, cloud-based platform that every stakeholder in the school
              can access from their own role-based dashboard.
            </p>
          </div>
        </section>

        {/* Section: Purpose */}
        <section aria-labelledby="section-purpose" className="py-16 px-6 lg:px-16 bg-background border-t border-border">
          <div className="max-w-5xl mx-auto">
            <h2 id="section-purpose" className="text-2xl font-display font-bold text-foreground mb-4">Purpose</h2>
            <p className="text-muted-foreground text-base leading-relaxed max-w-3xl">
              SchoolPulse exists to remove administrative friction from school management. Schools spend
              hours every week on manual attendance registers, fee collection ledgers, and paper result
              sheets. SchoolPulse automates these workflows so that administrators, teachers, and parents
              can focus on what matters — student learning outcomes.
            </p>
          </div>
        </section>

        {/* Section: Key Features */}
        <section aria-labelledby="section-features" className="py-16 px-6 lg:px-16 bg-muted/30 border-t border-border">
          <div className="max-w-5xl mx-auto">
            <h2 id="section-features" className="text-2xl font-display font-bold text-foreground mb-8">Key Features</h2>
            <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6" aria-label="SchoolPulse features">
              {features.map((f) => (
                <li key={f.title} className="bg-card border border-border rounded-xl p-5 flex flex-col gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                    {f.icon}
                  </div>
                  <p className="font-semibold text-foreground text-sm">{f.title}</p>
                  <p className="text-muted-foreground text-sm leading-relaxed">{f.desc}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Section: Functionality */}
        <section aria-labelledby="section-functionality" className="py-16 px-6 lg:px-16 bg-background border-t border-border">
          <div className="max-w-5xl mx-auto">
            <h2 id="section-functionality" className="text-2xl font-display font-bold text-foreground mb-4">Functionality</h2>
            <ul className="space-y-3 text-sm text-muted-foreground" aria-label="Functionality list">
              {[
                'Fee collection with automated pending alerts and printable receipts',
                'Daily class-wise attendance entry with monthly summary reports',
                'Exam mark entry, automatic grading, and subject-wise performance charts',
                'Class management: create classes, assign teachers, enrol students',
                'Student database with profile photos, guardian contacts, and academic history',
                'Parent dashboard providing real-time access to fees due and exam results',
                'Role-based access control ensuring data privacy across all user types',
                'Bus route management for schools with transport facilities',
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Section: Target Audience */}
        <section aria-labelledby="section-audience" className="py-16 px-6 lg:px-16 bg-muted/30 border-t border-border">
          <div className="max-w-5xl mx-auto">
            <h2 id="section-audience" className="text-2xl font-display font-bold text-foreground mb-6">Target Audience</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {[
                { icon: <Shield className="w-6 h-6" />, role: 'School Administrators', desc: 'Principals and admin staff who oversee school-wide operations, enrolments, and finances.' },
                { icon: <BookOpen className="w-6 h-6" />, role: 'Teachers', desc: 'Educators who enter attendance, marks, and feedback for their assigned classes.' },
                { icon: <GraduationCap className="w-6 h-6" />, role: 'Students', desc: 'Students who access their academic performance, exam results, and peer comparisons.' },
                { icon: <Users className="w-6 h-6" />, role: 'Parents', desc: "Parents and guardians who monitor their child's fees, attendance, and overall progress." },
              ].map((a) => (
                <article key={a.role} className="bg-card border border-border rounded-xl p-5">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-3">
                    {a.icon}
                  </div>
                  <h3 className="font-semibold text-foreground text-sm mb-2">{a.role}</h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">{a.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        {/* Section: Accessibility */}
        <section aria-labelledby="section-accessibility" className="py-16 px-6 lg:px-16 bg-background border-t border-border">
          <div className="max-w-5xl mx-auto">
            <h2 id="section-accessibility" className="text-2xl font-display font-bold text-foreground mb-4">Accessibility</h2>
            <p className="text-muted-foreground text-base leading-relaxed max-w-3xl">
              SchoolPulse is accessible from any device — desktop, tablet, or mobile — using a standard
              web browser. No app download or special hardware is needed. The platform supports multiple
              concurrent users across roles, making it practical for schools of all sizes.
            </p>
          </div>
        </section>

        {/* Section: Why Schools Choose SchoolPulse */}
        <section aria-labelledby="section-why" className="py-16 px-6 lg:px-16 bg-muted/30 border-t border-border">
          <div className="max-w-5xl mx-auto">
            <h2 id="section-why" className="text-2xl font-display font-bold text-foreground mb-6">Why Schools Choose SchoolPulse</h2>
            <div className="grid sm:grid-cols-3 gap-6">
              {[
                { stat: 'One Platform', label: 'Replaces spreadsheets, paper registers, and disconnected tools.' },
                { stat: 'Real Schools', label: 'Built around the actual workflows of Indian schools, not adapted enterprise software.' },
                { stat: 'Instant Access', label: 'Cloud-based - accessible from anywhere, no IT team required.' },
              ].map((item) => (
                <div key={item.stat} className="bg-card border border-border rounded-xl p-6 text-center">
                  <p className="text-xl font-extrabold text-primary font-display mb-2">{item.stat}</p>
                  <p className="text-muted-foreground text-sm leading-relaxed">{item.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Section: School ERP Software Made Simple (keyword section) */}
        <section aria-labelledby="section-erp-simple" className="py-16 px-6 lg:px-16 bg-background border-t border-border">
          <div className="max-w-5xl mx-auto">
            <h2 id="section-erp-simple" className="text-2xl font-display font-bold text-foreground mb-4">School ERP Software Made Simple</h2>
            <p className="text-muted-foreground text-base leading-relaxed max-w-3xl">
              Most school ERP software attempts to serve every institution from primary schools to
              universities, creating bloated, expensive products with steep learning curves. SchoolPulse
              takes a different approach: it focuses exclusively on the core processes that every school
              needs - fee management, attendance, and academic tracking - and delivers them in a clean,
              fast, and affordable web application. Indian schools deserve ERP software that works the
              way they do.
            </p>
          </div>
        </section>

        {/* Section: FAQ */}
        <section aria-labelledby="section-faq" className="py-16 px-6 lg:px-16 bg-muted/30 border-t border-border">
          <div className="max-w-3xl mx-auto">
            <h2 id="section-faq" className="text-2xl font-display font-bold text-foreground mb-8">Frequently Asked Questions</h2>
            <FAQAccordion faqs={faqs} />
          </div>
        </section>

      </main>

      {/* Footer */}
      <footer className="py-8 px-6 border-t border-border bg-background text-center">
        <p className="text-xs text-muted-foreground">
          &copy; {new Date().getFullYear()} SchoolPulse. School ERP for Fees, Attendance &amp; Student Management.
          &nbsp;|&nbsp; <a href="https://www.theschoolpulse.in/" className="underline hover:text-foreground transition-colors">theschoolpulse.in</a>
        </p>
      </footer>
    </div>
  );
};

export default LoginPage;
