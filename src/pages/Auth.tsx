
import React, { useState, useEffect } from 'react';
import { supabase, offlineApi } from 'supabase';
import { Mail, Lock, Loader2, BookOpen, AlertCircle, Smartphone, Key, Moon, Star, Sparkles, Eye, EyeOff, CheckCircle2, KeyRound, ArrowLeft, RefreshCw, ShieldCheck, Copy, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Language } from 'types';
import { t } from 'translations';
import { isValidUUID } from 'utils/validation';
import { useOfflineStatus } from '../hooks/useOffline';

interface AuthProps {
  lang: Language;
  signInAsMember?: (phone: string, memberId: string) => Promise<boolean>;
}

const toEnDigits = (str: string) => {
  const bn = '০১২৩৪৫৬৭৮৯';
  return String(str || '').replace(/[০-৯]/g, (d) => String(bn.indexOf(d)));
};

const Auth: React.FC<AuthProps> = ({ lang, signInAsMember }) => {
  const isOnline = useOfflineStatus();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [phone, setPhone] = useState('');
  const [memberId, setMemberId] = useState('');
  const [loginType, setLoginType] = useState<'admin' | 'executive' | 'member'>('admin');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loginSuccessMsg, setLoginSuccessMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // 3-step Mobile Number SMS OTP Password Reset states
  const [isResetMode, setIsResetMode] = useState(false);
  const [resetStep, setResetStep] = useState<1 | 2 | 3>(1);
  const [resetPhone, setResetPhone] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState(false);
  const [adminResetEmail, setAdminResetEmail] = useState('');
  const [copiedEmail, setCopiedEmail] = useState(false);

  const [brandInfo, setBrandInfo] = useState({ name: 'কমিটি ম্যানেজার' });

  useEffect(() => {
    const name = localStorage.getItem('m_name');
    if (name) setBrandInfo({ name });
  }, []);

  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const handleAdminAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      localStorage.removeItem('executive_session');
      const normalizedPassword = code !== code.trim() ? code.trim() : code;
      const { data, error: signInError } = await (supabase.auth as any).signInWithPassword({ 
        email: email.trim(), 
        password: normalizedPassword 
      });
      if (signInError) throw signInError;
      if (data.user) {
        const userEmail = email.trim().toLowerCase();
        if (userEmail === 'thedevomix@gmail.com' || userEmail === 'kmibrahim@gmail.com' || userEmail === 'ibrahimkhan269596@gmail.com') {
          try {
            await supabase.rpc('bootstrap_super_admin', {
              p_uid: data.user.id,
              p_email: data.user.email
            });
          } catch (bootstrapErr) {
            console.error('Bootstrap error:', bootstrapErr);
          }
        }

        offlineApi.removeCache('profile');
        if (isValidUUID(data.user.id)) {
          const { data: profile } = await supabase.from('institutions').select('name').eq('id', data.user.id).maybeSingle();
          if (profile) localStorage.setItem('m_name', profile.name);
          else localStorage.setItem('m_name', 'Super Admin');
        } else {
          localStorage.setItem('m_name', 'Super Admin');
        }
      }
    } catch (err: any) { 
      console.error('Login error:', err);
      const msg = err?.message || '';
      if (msg.includes('Invalid login credentials')) {
        setError(lang === 'bn' ? 'ইমেইল অথবা পাসওয়ার্ড সঠিক নয়। অনুগ্রহ করে সঠিক পাসওয়ার্ড দিন অথবা নিচে "পাসওয়ার্ড ভুলে গেছেন?" অপশন থেকে রিসেট করুন।' : 'Invalid email or password. Please verify or use "Forgot Password?" below.');
      } else if (msg.includes('Email not confirmed')) {
        setError(lang === 'bn' ? 'ইমেইল এখনও ভেরিফাই করা হয়নি।' : 'Email is not verified.');
      } else {
        setError(err?.message || t('login_error', lang)); 
      }
    } finally { 
      setLoading(false); 
    }
  };

  const startResetFlow = () => {
    setIsResetMode(true);
    setResetStep(1);
    setResetPhone('');
    setResetOtp('');
    setNewPassword('');
    setConfirmPassword('');
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setResetError('');
    setResetSuccess(false);
    setAdminResetEmail('');
    setCopiedEmail(false);
    setResendCooldown(0);
    setError('');
  };

  const exitResetFlow = () => {
    setIsResetMode(false);
    setResetError('');
  };

  // Step 1: Request 6-digit SMS OTP
  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanedPhone = toEnDigits(resetPhone).replace(/\D/g, '');
    if (!cleanedPhone || cleanedPhone.length < 10) {
      setResetError(lang === 'bn' ? 'অনুগ্রহ করে সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন।' : 'Please enter a valid 11-digit mobile number.');
      return;
    }

    setResetLoading(true);
    setResetError('');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'request-otp',
          phone: cleanedPhone
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || (lang === 'bn' ? 'ওটিপি পাঠানো যায়নি।' : 'Failed to send OTP.'));
      }
      setResetOtp('');
      setResetStep(2);
      setResendCooldown(45);
    } catch (err: any) {
      setResetError(err?.message || (lang === 'bn' ? 'ওটিপি পাঠাতে সমস্যা হয়েছে।' : 'Error requesting OTP.'));
    } finally {
      setResetLoading(false);
    }
  };

  // Step 2: Verify 6-digit OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedPhone = toEnDigits(resetPhone).replace(/\D/g, '');
    const cleanedOtp = toEnDigits(resetOtp).replace(/\D/g, '');
    if (cleanedOtp.length !== 6) {
      setResetError(lang === 'bn' ? 'অনুগ্রহ করে ৬ ডিজিটের ওটিপি কোডটি লিখুন।' : 'Please enter the 6-digit OTP code.');
      return;
    }

    setResetLoading(true);
    setResetError('');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify-otp',
          phone: cleanedPhone,
          otp: cleanedOtp
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || (lang === 'bn' ? 'ভুল অথবা মেয়াদোত্তীর্ণ ওটিপি কোড।' : 'Invalid or expired OTP.'));
      }
      setResetStep(3);
    } catch (err: any) {
      setResetError(err?.message || (lang === 'bn' ? 'ওটিপি যাচাই ব্যর্থ হয়েছে।' : 'Failed to verify OTP.'));
    } finally {
      setResetLoading(false);
    }
  };

  // Step 3: Update Password with Verified OTP
  const handleVerifyAndResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanedPhone = toEnDigits(resetPhone).replace(/\D/g, '');
    const cleanedOtp = toEnDigits(resetOtp).replace(/\D/g, '');
    const password = newPassword.trim();
    const confirmPass = confirmPassword.trim();

    if (password.length < 6) {
      setResetError(lang === 'bn' ? 'নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।' : 'New password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPass) {
      setResetError(lang === 'bn' ? 'দুটি পাসওয়ার্ড হুবহু এক হয়নি।' : 'Passwords do not match.');
      return;
    }

    setResetLoading(true);
    setResetError('');
    try {
      const res = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify-otp-reset',
          phone: cleanedPhone,
          otp: cleanedOtp,
          newPassword: password
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || (lang === 'bn' ? 'পাসওয়ার্ড পরিবর্তন ব্যর্থ হয়েছে।' : 'Failed to reset password.'));
      }

      try {
        await supabase.auth.signOut();
      } catch {
        // ignore signOut errors
      }
      localStorage.removeItem('madrasah_auth_token');
      localStorage.removeItem('executive_session');
      localStorage.removeItem('committee_session');

      setAdminResetEmail(data.adminEmail || '');
      if (data.adminEmail) {
        setEmail(data.adminEmail);
      }
      setCode('');
      setResetSuccess(true);
    } catch (err: any) {
      setResetError(err?.message || (lang === 'bn' ? 'পাসওয়ার্ড আপডেট করতে সমস্যা হয়েছে।' : 'Failed to update password.'));
    } finally {
      setResetLoading(false);
    }
  };

  const handleCopyAdminEmail = async () => {
    if (!adminResetEmail) return;
    try {
      await navigator.clipboard.writeText(adminResetEmail);
      setCopiedEmail(true);
      setTimeout(() => setCopiedEmail(false), 2000);
    } catch {
      // Clipboard API fallback ignored cleanly in restricted environments
    }
  };

  const handleTeacherAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      // Login by phone only as per user request to remove PIN
      const { data, error: fetchError } = await supabase
        .from('executives')
        .select('*')
        .eq('phone', phone.trim())
        .eq('is_active', true)
        .maybeSingle();

      if (fetchError) throw fetchError;
      
      if (data) {
        const sessionData = {
          ...data,
          id: data.id,
          institution_id: data.institution_id || data.institute_id,
          name: data.name || data.teacher_name,
          permissions: typeof data.permissions === 'string' ? JSON.parse(data.permissions) : (data.permissions || {}),
          role: 'executive'
        };
        localStorage.setItem('executive_session', JSON.stringify(sessionData));
        localStorage.setItem('committee_session', JSON.stringify(sessionData));
        window.location.reload();
      } else {
        setError(lang === 'bn' ? 'ভুল ফোন নম্বর' : 'Invalid phone number');
      }
    } catch (err: any) {
      console.error('Executive login error:', err);
      setError(lang === 'bn' ? 'লগইন করতে সমস্যা হচ্ছে' : 'Error logging in');
    } finally {
      setLoading(false);
    }
  };

  const handleMemberAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!signInAsMember) return;
    
    setLoading(true);
    setError('');
    
    try {
      const success = await signInAsMember(phone.trim(), memberId.trim());
      if (!success) {
        setError(lang === 'bn' ? 'ভুল মোবাইল নম্বর বা সদস্য পরিচিতি নম্বর' : 'Invalid phone or member ID');
      } else {
        window.location.reload();
      }
    } catch (err: any) {
      setError(err.message || 'Error logging in');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0F172A] flex flex-col items-center justify-center p-6 pt-[calc(env(safe-area-inset-top)+24px)] relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 100, repeat: Infinity, ease: "linear" }}
          className="absolute -top-20 -right-20 w-96 h-96 bg-[#42f5e9]/10 rounded-full blur-3xl"
        />
        <motion.div 
          animate={{ rotate: -360 }}
          transition={{ duration: 80, repeat: Infinity, ease: "linear" }}
          className="absolute -bottom-20 -left-20 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl"
        />
        
        {/* Islamic Decorative Icons */}
        <motion.div 
          animate={{ y: [0, -20, 0], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-20 left-[15%] text-[#42f5e9]/20"
        >
          <Moon size={120} strokeWidth={1} />
        </motion.div>
        
        {[...Array(12)].map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0.1, scale: 0.5 }}
            animate={{ 
              opacity: [0.1, 0.4, 0.1], 
              scale: [0.5, 1, 0.5],
              y: [0, Math.random() * -30, 0]
            }}
            transition={{ 
              duration: 3 + Math.random() * 4, 
              repeat: Infinity, 
              delay: Math.random() * 5 
            }}
            className="absolute text-yellow-500/20"
            style={{ 
              top: `${Math.random() * 100}%`, 
              left: `${Math.random() * 100}%` 
            }}
          >
            <Star size={12 + Math.random() * 12} fill="currentColor" />
          </motion.div>
        ))}
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md flex flex-col items-center z-10 space-y-8"
      >
        <div className="text-center space-y-4">
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="relative inline-block"
          >
            <div className="w-24 h-24 bg-white/5 backdrop-blur-xl rounded-[2.5rem] mx-auto flex items-center justify-center border border-white/20 shadow-2xl relative group">
              <div className="absolute inset-0 bg-[#42f5e9]/20 rounded-[2.5rem] blur-xl group-hover:bg-[#42f5e9]/30 transition-colors" />
              <BookOpen size={48} strokeWidth={1.5} className="text-[#42f5e9] relative z-10" />
            </div>
          </motion.div>
          
          <div className="space-y-1">
            <h1 className="text-4xl font-black text-white font-noto tracking-tight">
              {brandInfo.name}
            </h1>
            <div className="flex items-center justify-center gap-2 text-[#42f5e9]/60">
              <Sparkles size={14} />
              <p className="text-[10px] font-bold uppercase tracking-[0.3em]">Secure Portal Login</p>
              <Sparkles size={14} />
            </div>
          </div>
        </div>

        <div className="w-full bg-slate-900/40 backdrop-blur-[40px] p-8 space-y-6 rounded-[3rem] border border-white/10 shadow-[0_32px_64px_-15px_rgba(0,0,0,0.5)] relative overflow-hidden group">
          {/* Animated Light Beam */}
          <motion.div
            animate={{
              x: ['-150%', '150%'],
              y: ['-150%', '150%'],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "linear",
            }}
            className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-transparent via-[#42f5e9]/5 to-transparent pointer-events-none"
          />
          
          {/* Subtle inner glow */}
          <div className="absolute -top-24 -left-24 w-64 h-64 bg-[#42f5e9]/10 rounded-full blur-[80px] pointer-events-none" />
          
          {isResetMode ? (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-3 duration-300 relative z-10">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={exitResetFlow}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#42f5e9] hover:text-white transition-colors"
                >
                  <ArrowLeft size={15} />
                  {lang === 'bn' ? 'লগইনে ফিরে যান' : 'Back to Login'}
                </button>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                  {resetSuccess ? (lang === 'bn' ? 'সম্পন্ন' : 'Done') : `${lang === 'bn' ? 'ধাপ' : 'Step'} ${resetStep}/3`}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#42f5e9]/15 border border-[#42f5e9]/25 text-[#42f5e9] flex items-center justify-center shrink-0">
                  {resetSuccess ? <CheckCircle2 size={22} /> : <KeyRound size={22} />}
                </div>
                <div>
                  <h2 className="text-lg font-black text-white font-noto leading-tight">
                    {t('reset_password', lang)}
                  </h2>
                  <p className="text-[11px] text-slate-400 font-medium">
                    {resetSuccess
                      ? (lang === 'bn' ? 'অ্যাকাউন্টের নতুন পাসওয়ার্ড সেট হয়েছে' : 'Your new password has been saved')
                      : resetStep === 1
                        ? (lang === 'bn' ? 'রেজিস্টার্ড মোবাইল নম্বরে ওটিপি নিন' : 'Receive an OTP on your registered mobile')
                        : resetStep === 2
                          ? (lang === 'bn' ? 'এসএমএসে প্রাপ্ত ৬ ডিজিটের কোড যাচাই করুন' : 'Verify the 6-digit code sent via SMS')
                          : (lang === 'bn' ? 'অ্যাকাউন্টের জন্য নতুন পাসওয়ার্ড দিন' : 'Set a new password for your account')}
                  </p>
                </div>
              </div>

              {!resetSuccess && (
                <div className="grid grid-cols-3 gap-2">
                  {[1, 2, 3].map((stepNum) => (
                    <div
                      key={stepNum}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        stepNum <= resetStep ? 'bg-[#42f5e9] shadow-[0_0_10px_rgba(66,245,233,0.4)]' : 'bg-white/10'
                      }`}
                    />
                  ))}
                </div>
              )}

              <AnimatePresence mode="wait">
                {resetError && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-start gap-3 text-red-400 font-bold text-xs"
                  >
                    <AlertCircle size={18} className="shrink-0 mt-0.5" />
                    <span>{resetError}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {resetSuccess ? (
                <div className="space-y-4">
                  <div className="p-5 bg-emerald-500/10 border border-emerald-500/25 rounded-2xl space-y-3">
                    <div className="flex items-center gap-2.5 text-emerald-400 font-black text-sm font-noto">
                      <CheckCircle2 size={20} className="shrink-0" />
                      <span>{lang === 'bn' ? 'পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে!' : 'Password updated successfully!'}</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">
                      {lang === 'bn'
                        ? 'এখন নিচের ইমেইল ও আপনার নতুন পাসওয়ার্ড ব্যবহার করে লগইন করুন।'
                        : 'Log in now using the email below and your new password.'}
                    </p>

                    {adminResetEmail && (
                      <div className="p-3.5 bg-slate-950/60 border border-white/10 rounded-xl flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                            {lang === 'bn' ? 'অ্যাডমিন লগইন ইমেইল' : 'Admin Login Email'}
                          </p>
                          <p className="text-xs font-mono font-bold text-[#42f5e9] truncate">{adminResetEmail}</p>
                        </div>
                        <button
                          type="button"
                          onClick={handleCopyAdminEmail}
                          className="px-3 py-2 rounded-lg bg-[#42f5e9]/15 hover:bg-[#42f5e9]/25 text-[#42f5e9] text-[11px] font-bold flex items-center gap-1.5 shrink-0 transition-colors"
                        >
                          {copiedEmail ? <Check size={14} /> : <Copy size={14} />}
                          {copiedEmail ? (lang === 'bn' ? 'কপি হয়েছে' : 'Copied') : (lang === 'bn' ? 'কপি' : 'Copy')}
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setIsResetMode(false);
                      setLoginType('admin');
                      setResetSuccess(false);
                      setLoginSuccessMsg(
                        lang === 'bn'
                          ? 'পাসওয়ার্ড পরিবর্তন হয়েছে! নতুন পাসওয়ার্ড দিয়ে লগইন করুন।'
                          : 'Password changed! Please log in with your new password.'
                      );
                    }}
                    className="w-full py-4 bg-[#42f5e9] hover:bg-[#3ce0d5] text-[#0fb5ab] font-black rounded-2xl transition-all flex items-center justify-center gap-2 text-base font-noto shadow-xl shadow-[#42f5e9]/20"
                  >
                    {lang === 'bn' ? 'এখনই লগইন করুন' : 'Login Now'}
                  </button>
                </div>
              ) : resetStep === 1 ? (
                <form onSubmit={handleRequestOtp} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                      {lang === 'bn' ? 'মোবাইল নম্বর' : 'Mobile Number'}
                    </label>
                    <div className="group relative">
                      <Smartphone className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#42f5e9] transition-colors" size={20} />
                      <input
                        type="tel"
                        required
                        autoComplete="tel"
                        placeholder="01XXXXXXXXX"
                        className="w-full pl-14 pr-6 py-4 bg-white/5 border border-white/10 rounded-2xl outline-none text-white font-bold text-sm focus:border-[#42f5e9]/50 focus:bg-white/10 focus:ring-4 focus:ring-[#42f5e9]/10 transition-all placeholder:text-slate-600"
                        value={resetPhone}
                        onChange={(e) => setResetPhone(toEnDigits(e.target.value))}
                      />
                    </div>
                    <p className="text-[11px] text-slate-400 ml-1">
                      {lang === 'bn'
                        ? 'অ্যাডমিন অ্যাকাউন্টের সাথে যুক্ত মোবাইল নম্বরে ৬ ডিজিটের ওটিপি পাঠানো হবে।'
                        : 'A 6-digit OTP will be sent to the mobile number linked to your admin account.'}
                    </p>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={resetLoading || toEnDigits(resetPhone).replace(/\D/g, '').length < 10}
                    className="w-full py-4 bg-[#42f5e9] hover:bg-[#3ce0d5] text-[#0fb5ab] font-black rounded-2xl transition-all flex items-center justify-center gap-2 text-base font-noto shadow-xl shadow-[#42f5e9]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {resetLoading ? <Loader2 className="animate-spin" size={20} /> : t('send_otp', lang)}
                  </motion.button>
                </form>
              ) : resetStep === 2 ? (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <div className="p-3.5 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between gap-2 text-xs">
                    <span className="text-slate-300 font-bold truncate">
                      {lang === 'bn' ? 'নম্বর: ' : 'Number: '}
                      <span className="text-[#42f5e9] font-mono">{toEnDigits(resetPhone)}</span>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setResetStep(1);
                        setResetError('');
                      }}
                      className="text-[11px] font-bold text-[#42f5e9] hover:underline shrink-0"
                    >
                      {lang === 'bn' ? 'নম্বর পরিবর্তন করুন' : 'Change'}
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                      {lang === 'bn' ? '৬ ডিজিটের ওটিপি কোড' : '6-Digit OTP Code'}
                    </label>
                    <div className="group relative">
                      <ShieldCheck className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#42f5e9] transition-colors" size={20} />
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        required
                        placeholder="------"
                        className="w-full pl-14 pr-6 py-4 bg-white/5 border border-white/10 rounded-2xl outline-none text-white font-mono font-black tracking-[0.45em] text-base focus:border-[#42f5e9]/50 focus:bg-white/10 focus:ring-4 focus:ring-[#42f5e9]/10 transition-all placeholder:text-slate-600"
                        value={resetOtp}
                        onChange={(e) => setResetOtp(toEnDigits(e.target.value).replace(/\D/g, '').slice(0, 6))}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-xs px-1">
                    <span className="text-slate-400">
                      {lang === 'bn' ? 'কোড পাননি?' : "Didn't receive code?"}
                    </span>
                    <button
                      type="button"
                      disabled={resendCooldown > 0 || resetLoading}
                      onClick={() => handleRequestOtp()}
                      className="inline-flex items-center gap-1.5 font-bold text-[#42f5e9] hover:underline disabled:opacity-50 disabled:no-underline"
                    >
                      <RefreshCw size={13} className={resetLoading ? 'animate-spin' : ''} />
                      {resendCooldown > 0
                        ? (lang === 'bn' ? `পুনরায় পাঠান (${resendCooldown}s)` : `Resend (${resendCooldown}s)`)
                        : (lang === 'bn' ? 'পুনরায় ওটিপি পাঠান' : 'Resend OTP')}
                    </button>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={resetLoading || resetOtp.length !== 6}
                    className="w-full py-4 bg-[#42f5e9] hover:bg-[#3ce0d5] text-[#0fb5ab] font-black rounded-2xl transition-all flex items-center justify-center gap-2 text-base font-noto shadow-xl shadow-[#42f5e9]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {resetLoading ? <Loader2 className="animate-spin" size={20} /> : t('verify_otp', lang)}
                  </motion.button>
                </form>
              ) : (
                <form onSubmit={handleVerifyAndResetPassword} className="space-y-4">
                  <div className="space-y-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                        {t('new_password', lang)}
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          required
                          minLength={6}
                          autoCapitalize="none"
                          autoCorrect="off"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder={lang === 'bn' ? 'কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড' : 'At least 6 characters'}
                          className="w-full pl-12 pr-12 py-4 bg-white/5 border border-white/10 rounded-2xl text-white text-sm font-bold outline-none focus:border-[#42f5e9]/50 transition-all placeholder:text-slate-600"
                        />
                        <button
                          type="button"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#42f5e9] p-1"
                        >
                          {showNewPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                        </button>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                        {t('confirm_new_password', lang)}
                      </label>
                      <div className="relative">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          required
                          minLength={6}
                          autoCapitalize="none"
                          autoCorrect="off"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder={lang === 'bn' ? 'পাসওয়ার্ড পুনরায় লিখুন' : 'Re-enter new password'}
                          className="w-full pl-12 pr-12 py-4 bg-white/5 border border-white/10 rounded-2xl text-white text-sm font-bold outline-none focus:border-[#42f5e9]/50 transition-all placeholder:text-slate-600"
                        />
                        <button
                          type="button"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#42f5e9] p-1"
                        >
                          {showConfirmPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={resetLoading || newPassword.trim().length < 6}
                    className="w-full py-4 bg-[#42f5e9] hover:bg-[#3ce0d5] text-[#0fb5ab] font-black rounded-2xl transition-all flex items-center justify-center gap-2 text-base font-noto shadow-xl shadow-[#42f5e9]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {resetLoading
                      ? <Loader2 className="animate-spin" size={20} />
                      : (lang === 'bn' ? 'পাসওয়ার্ড আপডেট করুন' : 'Update Password')}
                  </motion.button>
                </form>
              )}
            </div>
          ) : (
            <>
              <div className="flex p-1 bg-black/40 rounded-2xl border border-white/5 relative mb-6">
                <div className={`absolute h-[calc(100%-8px)] w-[calc(50%-4px)] bg-[#42f5e9] rounded-xl shadow-lg shadow-[#42f5e9]/20 transition-transform duration-300 ${loginType === 'executive' ? 'translate-x-full' : 'translate-x-0'}`} />
                <button 
                  onClick={() => { setLoginType('admin'); setError(''); }}
                  className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest relative z-10 transition-colors ${loginType === 'admin' ? 'text-[#0fb5ab]' : 'text-slate-400 hover:text-slate-300'}`}
                >
                  Admin
                </button>
                <button 
                  onClick={() => { setLoginType('executive'); setError(''); }}
                  className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest relative z-10 transition-colors ${loginType === 'executive' ? 'text-[#0fb5ab]' : 'text-slate-400 hover:text-slate-300'}`}
                >
                  Exec
                </button>
                {/* Member login option is temporarily hidden as requested. Can be restored by adding 'member' button back. */}
              </div>

              {loginType === 'admin' ? (
                <form onSubmit={handleAdminAuth} className="space-y-5 animate-in fade-in slide-in-from-left-4 duration-300">
                  <AnimatePresence mode="wait">
                    {loginSuccessMsg && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl flex items-center gap-3 text-emerald-400 font-bold text-xs mb-3"
                      >
                        <CheckCircle2 size={18} className="shrink-0" />
                        <span>{loginSuccessMsg}</span>
                      </motion.div>
                    )}
                    {error && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-3 text-red-400 font-bold text-xs"
                      >
                        <AlertCircle size={18} className="shrink-0" />
                        <span>{error}</span>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="space-y-4">
                    <div className="group relative">
                      <Mail className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#42f5e9] transition-colors" size={20} />
                      <input
                        type="email"
                        required
                        autoCapitalize="none"
                        autoCorrect="off"
                        placeholder="ইমেইল এড্রেস"
                        className="w-full pl-14 pr-6 py-5 bg-white/5 border border-white/10 rounded-2xl outline-none text-white font-bold text-sm focus:border-[#42f5e9]/50 focus:bg-white/10 focus:ring-4 focus:ring-[#42f5e9]/10 transition-all placeholder:text-slate-600"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>
                    <div className="group relative">
                      <Lock className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#42f5e9] transition-colors" size={20} />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        autoCapitalize="none"
                        autoCorrect="off"
                        placeholder="পাসওয়ার্ড"
                        className="w-full pl-14 pr-12 py-5 bg-white/5 border border-white/10 rounded-2xl outline-none text-white font-bold text-sm focus:border-[#42f5e9]/50 focus:bg-white/10 focus:ring-4 focus:ring-[#42f5e9]/10 transition-all placeholder:text-slate-600"
                        value={code}
                        onChange={(e) => setCode(e.target.value)}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#42f5e9] transition-colors p-1.5 rounded-lg active:scale-95"
                        title={showPassword ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখুন'}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>

                    <div className="flex items-center justify-end text-xs px-1">
                      <button
                        type="button"
                        onClick={startResetFlow}
                        className="text-[11px] text-[#42f5e9] hover:underline font-bold"
                      >
                        পাসওয়ার্ড ভুলে গেছেন?
                      </button>
                    </div>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    type="submit"
                    disabled={loading}
                    className="w-full py-5 bg-[#42f5e9] hover:bg-[#3ce0d5] text-[#0fb5ab] font-black rounded-2xl transition-all flex items-center justify-center gap-3 text-lg font-noto shadow-xl shadow-[#42f5e9]/20 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? <Loader2 className="animate-spin" size={24} /> : 'লগইন করুন'}
                  </motion.button>
                </form>
              ) : loginType === 'executive' ? (
            <form onSubmit={handleTeacherAuth} className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-3 text-red-400 font-bold text-xs"
                  >
                    <AlertCircle size={18} />
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-4">
                <div className="group relative">
                  <Smartphone className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#42f5e9] transition-colors" size={20} />
                  <input
                    type="tel"
                    required
                    placeholder="ফোন নম্বর (01...)"
                    className="w-full pl-14 pr-6 py-5 bg-white/5 border border-white/10 rounded-2xl outline-none text-white font-bold text-sm focus:border-[#42f5e9]/50 focus:bg-white/10 focus:ring-4 focus:ring-[#42f5e9]/10 transition-all placeholder:text-slate-600"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading}
                className="w-full py-5 bg-[#42f5e9] hover:bg-[#3ce0d5] text-[#0fb5ab] font-black rounded-2xl transition-all flex items-center justify-center gap-3 text-lg font-noto shadow-xl shadow-[#42f5e9]/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="animate-spin" size={24} /> : 'নির্বাহী লগইন'}
              </motion.button>
            </form>
          ) : (
            <form onSubmit={handleMemberAuth} className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
              <AnimatePresence mode="wait">
                {error && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-3 text-red-400 font-bold text-xs"
                  >
                    <AlertCircle size={18} />
                    {error}
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="space-y-4">
                <div className="group relative">
                  <Smartphone className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#42f5e9] transition-colors" size={20} />
                  <input
                    type="tel"
                    required
                    placeholder={lang === 'bn' ? 'মোবাইল নম্বর' : 'Mobile Number'}
                    className="w-full pl-14 pr-6 py-5 bg-white/5 border border-white/10 rounded-2xl outline-none text-white font-bold text-sm focus:border-[#42f5e9]/50 focus:bg-white/10 focus:ring-4 focus:ring-[#42f5e9]/10 transition-all placeholder:text-slate-600"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div className="group relative">
                  <Key className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-[#42f5e9] transition-colors" size={20} />
                  <input
                    type="text"
                    required
                    placeholder={lang === 'bn' ? 'সদস্য পরিচিতি নম্বর' : 'Member ID Number'}
                    className="w-full pl-14 pr-6 py-5 bg-white/5 border border-white/10 rounded-2xl outline-none text-white font-bold text-sm focus:border-[#42f5e9]/50 focus:bg-white/10 focus:ring-4 focus:ring-[#42f5e9]/10 transition-all placeholder:text-slate-600"
                    value={memberId}
                    onChange={(e) => setMemberId(e.target.value)}
                  />
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                type="submit"
                disabled={loading}
                className="w-full py-5 bg-[#42f5e9] hover:bg-[#3ce0d5] text-[#0fb5ab] font-black rounded-2xl transition-all flex items-center justify-center gap-3 text-lg font-noto shadow-xl shadow-[#42f5e9]/20 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? <Loader2 className="animate-spin" size={24} /> : 'সদস্য লগইন'}
              </motion.button>
            </form>
          )}
            </>
          )}
        </div>

        <div className="flex flex-col items-center gap-2">
          <p className="text-slate-500 text-[9px] font-black tracking-[0.4em] uppercase">
            Committee Manager Platform
          </p>
          <div className="flex items-center gap-4 text-slate-600">
            <Star size={10} fill="currentColor" />
            <Moon size={10} fill="currentColor" />
            <Star size={10} fill="currentColor" />
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Auth;
