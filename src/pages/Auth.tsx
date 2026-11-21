
import React, { useState, useEffect } from 'react';
import { supabase, offlineApi } from 'supabase';
import { Mail, Lock, Loader2, BookOpen, AlertCircle, Smartphone, Key, Moon, Star, Sparkles, Eye, EyeOff, CheckCircle2, X, KeyRound, ArrowLeft, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Language } from 'types';
import { t } from 'translations';
import { isValidUUID } from 'utils/validation';
import { useOfflineStatus } from '../hooks/useOffline';

interface AuthProps {
  lang: Language;
  signInAsMember?: (phone: string, memberId: string) => Promise<boolean>;
}

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
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetStep, setResetStep] = useState<'code_entry' | 'new_password'>('code_entry');
  const [resetEmail, setResetEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [codeSending, setCodeSending] = useState(false);
  const [resetSuccess, setResetSuccess] = useState('');
  const [resetError, setResetError] = useState('');
  const [countdown, setCountdown] = useState(0);
  const [verifiedUser, setVerifiedUser] = useState<any>(null);
  const [brandInfo, setBrandInfo] = useState({ name: 'কমিটি ম্যানেজার' });

  useEffect(() => {
    const name = localStorage.getItem('m_name');
    if (name) setBrandInfo({ name });
  }, []);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleAdminAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    try {
      localStorage.removeItem('executive_session');
      const { data, error: signInError } = await (supabase.auth as any).signInWithPassword({ 
        email: email.trim(), 
        password: code 
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

  // 1. Send reset code to Gmail
  const handleSendCode = async () => {
    const targetEmail = resetEmail.trim();
    if (!targetEmail) {
      setResetError(lang === 'bn' ? 'অনুগ্রহ করে আপনার জিমেইল প্রদান করুন।' : 'Please enter your email address.');
      return;
    }

    setCodeSending(true);
    setResetError('');
    setResetSuccess('');

    try {
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(targetEmail);
      if (resetErr) throw resetErr;

      setCountdown(60);
      setResetSuccess(
        lang === 'bn' 
          ? 'আপনার জিমেইলে কোড পাঠানো হয়েছে! ইনবক্স অথবা স্প্যাম (Spam) ফোল্ডার চেক করুন।' 
          : 'A code has been sent to your Gmail! Please check inbox or spam folder.'
      );
    } catch (err: any) {
      console.error('Send reset code error:', err);
      const msg = err?.message || '';
      if (msg.includes('rate limit') || msg.includes('over_email_send_rate_limit')) {
        setResetError(lang === 'bn' ? 'অতিরিক্ত অনুরোধ করা হয়েছে। কিছুক্ষণ অপেক্ষা করে আবার চেষ্টা করুন।' : 'Rate limit exceeded. Please wait a moment.');
      } else {
        setResetError(msg || (lang === 'bn' ? 'কোড পাঠানো ব্যর্থ হয়েছে। জিমেইল সঠিক কিনা যাচাই করুন।' : 'Failed to send code.'));
      }
    } finally {
      setCodeSending(false);
    }
  };

  // 2. Confirm code received in Gmail (Move to step 2 without auto-logging in)
  const handleConfirmCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetEmail = resetEmail.trim().toLowerCase();
    const token = resetCode.trim();

    if (!targetEmail) {
      setResetError(lang === 'bn' ? 'অনুগ্রহ করে আপনার জিমেইল প্রদান করুন।' : 'Please enter your email.');
      return;
    }
    if (!token || token.length < 6) {
      setResetError(lang === 'bn' ? 'অনুগ্রহ করে জিমেইলে প্রাপ্ত সঠিক কোডটি প্রদান করুন।' : 'Please enter the valid code received in Gmail.');
      return;
    }

    setResetLoading(true);
    setResetError('');
    try {
      let verifyRes = await supabase.auth.verifyOtp({
        email: targetEmail,
        token,
        type: 'recovery'
      });

      if (verifyRes.error) {
        verifyRes = await supabase.auth.verifyOtp({
          email: targetEmail,
          token,
          type: 'email'
        });
      }

      if (verifyRes.error) {
        throw new Error(lang === 'bn' ? 'ভুল অথবা মেয়াদোত্তীর্ণ ভেরিফিকেশন কোড।' : 'Invalid or expired verification code.');
      }

      setResetStep('new_password');
      setResetSuccess(
        lang === 'bn' 
          ? 'কোড কনফার্ম হয়েছে! এবার আপনার নতুন পাসওয়ার্ড প্রদান করুন।' 
          : 'Code confirmed! Now enter your new password.'
      );
    } catch (err: any) {
      setResetError(err?.message || (lang === 'bn' ? 'ভেরিফিকেশন কোড যাচাই ব্যর্থ হয়েছে।' : 'Failed to verify code.'));
    } finally {
      setResetLoading(false);
    }
  };

  // 3. Set new password & require manual login from login form
  const handleSetNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const password = newPassword.trim();
    const confirmPass = confirmNewPassword.trim();

    if (!password || password.length < 6) {
      setResetError(lang === 'bn' ? 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।' : 'Password must be at least 6 characters.');
      return;
    }

    if (confirmPass && password !== confirmPass) {
      setResetError(lang === 'bn' ? 'দুটি পাসওয়ার্ড হুবহু এক হয়নি।' : 'Passwords do not match.');
      return;
    }

    setResetLoading(true);
    setResetError('');
    setResetSuccess('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session && resetCode.trim()) {
        let verifyRes = await supabase.auth.verifyOtp({
          email: resetEmail.trim().toLowerCase(),
          token: resetCode.trim(),
          type: 'recovery'
        });

        if (verifyRes.error) {
          verifyRes = await supabase.auth.verifyOtp({
            email: resetEmail.trim().toLowerCase(),
            token: resetCode.trim(),
            type: 'email'
          });
        }

        if (verifyRes.error) {
          throw new Error(lang === 'bn' ? 'ভুল অথবা মেয়াদোত্তীর্ণ ভেরিফিকেশন কোড।' : 'Invalid or expired verification code.');
        }
      }

      const { error: updErr } = await supabase.auth.updateUser({ password });
      if (updErr) {
        throw updErr;
      }

      // Always sign out so user must log in manually as requested
      try {
        await supabase.auth.signOut();
      } catch {
        // ignore signout errors
      }

      localStorage.removeItem('madrasah_auth_token');
      localStorage.removeItem('executive_session');
      localStorage.removeItem('committee_session');

      // Pre-fill email, close modal, and show success message on login screen
      setEmail(resetEmail.trim());
      setCode('');
      setShowResetModal(false);
      setLoginSuccessMsg(
        lang === 'bn'
          ? 'পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে! আপনার নতুন পাসওয়ার্ড দিয়ে নিচে লগইন করুন।'
          : 'Password updated successfully! Please log in with your new password below.'
      );

    } catch (err: any) {
      console.error('Update password error:', err);
      setResetError(err?.message || (lang === 'bn' ? 'পাসওয়ার্ড পরিবর্তন ব্যর্থ হয়েছে।' : 'Failed to update password.'));
    } finally {
      setResetLoading(false);
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
                    onClick={() => {
                      setResetStep('code_entry');
                      setResetEmail(email.trim());
                      setResetCode('');
                      setNewPassword('');
                      setConfirmNewPassword('');
                      setShowNewPassword(false);
                      setShowResetModal(true);
                      setResetError('');
                      setResetSuccess('');
                      setCountdown(0);
                    }}
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

      {/* Native Supabase OTP Password Reset Modal */}
      <AnimatePresence>
        {showResetModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="w-full max-w-md bg-slate-900 border border-white/10 rounded-[2.5rem] p-8 shadow-2xl relative"
            >
              <button
                onClick={() => setShowResetModal(false)}
                className="absolute right-6 top-6 text-slate-400 hover:text-white p-2 rounded-xl bg-white/5 transition-all"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-[#42f5e9]/10 text-[#42f5e9] flex items-center justify-center">
                  <KeyRound size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white font-noto">
                    {resetStep === 'code_entry' ? 'পাসওয়ার্ড পরিবর্তন' : 'নতুন পাসওয়ার্ড সেট করুন'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    {resetStep === 'code_entry' 
                      ? 'আপনার জিমেইল ও প্রাপ্ত কোড দিয়ে কনফার্ম করুন' 
                      : `${resetEmail} অ্যাকাউন্টের জন্য নতুন পাসওয়ার্ড দিন`}
                  </p>
                </div>
              </div>

              {resetSuccess && (
                <div className="p-4 mb-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-start gap-3 text-emerald-400 font-bold text-xs">
                  <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                  <span>{resetSuccess}</span>
                </div>
              )}

              {resetError && (
                <div className="p-4 mb-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3 text-red-400 font-bold text-xs">
                  <AlertCircle size={18} className="shrink-0 mt-0.5" />
                  <span>{resetError}</span>
                </div>
              )}

              {resetStep === 'code_entry' ? (
                /* Step 1: Two Fields (Gmail field with Send Code button + Code field), then Confirm button */
                <form onSubmit={handleConfirmCode} className="space-y-4">
                  {/* Field 1: Gmail + Send Code button */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">আপনার জিমেইল</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                        <input
                          type="email"
                          required
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          placeholder="your-email@gmail.com"
                          className="w-full pl-10 pr-3 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-white text-sm font-bold outline-none focus:border-[#42f5e9]/50 transition-all"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={handleSendCode}
                        disabled={codeSending || countdown > 0 || !resetEmail.trim()}
                        className="px-4 py-3.5 bg-[#42f5e9]/15 text-[#42f5e9] border border-[#42f5e9]/30 hover:bg-[#42f5e9]/25 font-bold text-xs rounded-2xl transition-all shrink-0 flex items-center justify-center gap-1.5 disabled:opacity-50 min-w-[95px]"
                      >
                        {codeSending ? <Loader2 size={16} className="animate-spin" /> : countdown > 0 ? `${countdown}s` : 'কোড পাঠান'}
                      </button>
                    </div>
                  </div>

                  {/* Field 2: Code input (8 digits/chars) */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">জিমেইলে প্রাপ্ত কোড (৮ ডিজিট)</label>
                    <div className="relative">
                      <Key className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                      <input
                        type="text"
                        required
                        maxLength={12}
                        value={resetCode}
                        onChange={(e) => setResetCode(e.target.value.trim())}
                        placeholder="জিমেইলে প্রাপ্ত ৮ ডিজিটের কোডটি লিখুন"
                        className="w-full pl-10 pr-4 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-white text-sm font-mono font-bold outline-none focus:border-[#42f5e9]/50 transition-all"
                      />
                    </div>
                    <p className="text-[10px] text-slate-500 ml-1">💡 কোড না পেলে জিমেইলের ইনবক্স বা স্প্যাম (Spam) ফোল্ডার চেক করুন।</p>
                  </div>

                  {/* Confirm Button */}
                  <button
                    type="submit"
                    disabled={resetLoading || !resetEmail.trim() || !resetCode.trim()}
                    className="w-full py-4 bg-[#42f5e9] hover:bg-[#3ce0d5] text-[#0fb5ab] font-black rounded-2xl transition-all shadow-lg shadow-[#42f5e9]/20 flex items-center justify-center gap-2 mt-4 active:scale-95 disabled:opacity-50"
                  >
                    {resetLoading ? <Loader2 size={20} className="animate-spin" /> : 'Confirm / কোড কনফার্ম করুন'}
                  </button>
                </form>
              ) : (
                /* Step 2: Set New Password after Confirm succeeds, then Auto-Login */
                <form onSubmit={handleSetNewPassword} className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">নতুন পাসওয়ার্ড সেট করুন</label>
                      <button
                        type="button"
                        onClick={() => {
                          setResetStep('code_entry');
                          setResetError('');
                          setResetSuccess('');
                        }}
                        className="text-[11px] text-[#42f5e9] hover:underline flex items-center gap-1 font-bold"
                      >
                        <ArrowLeft size={13} /> পূর্বের ধাপে ফিরে যান
                      </button>
                    </div>

                    {/* Field 1: New Password */}
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="নতুন পাসওয়ার্ড (কমপক্ষে ৬ অক্ষর)"
                        className="w-full pl-12 pr-12 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-white text-sm font-bold outline-none focus:border-[#42f5e9]/50 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-[#42f5e9] p-1"
                      >
                        {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>

                    {/* Field 2: Confirm New Password */}
                    <div className="relative">
                      <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        required
                        minLength={6}
                        value={confirmNewPassword}
                        onChange={(e) => setConfirmNewPassword(e.target.value)}
                        placeholder="নতুন পাসওয়ার্ড পুনরায় নিশ্চিত করুন"
                        className="w-full pl-12 pr-12 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-white text-sm font-bold outline-none focus:border-[#42f5e9]/50 transition-all"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={resetLoading || newPassword.length < 6}
                    className="w-full py-4 bg-[#42f5e9] hover:bg-[#3ce0d5] text-[#0fb5ab] font-black rounded-2xl transition-all shadow-lg shadow-[#42f5e9]/20 flex items-center justify-center gap-2 mt-4 active:scale-95 disabled:opacity-50"
                  >
                    {resetLoading ? <Loader2 size={20} className="animate-spin" /> : 'পাসওয়ার্ড পরিবর্তন ও সরাসরি লগইন করুন'}
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Auth;
