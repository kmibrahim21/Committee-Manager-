import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  CreditCard,
  Smartphone,
  CheckCircle2,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  XCircle,
  ArrowRight,
  ChevronLeft,
  ExternalLink,
  RefreshCw,
  ShieldCheck,
  Zap,
  Mic,
  Package,
  Clock
} from 'lucide-react';
import { supabase } from 'supabase';
import { Institution, Language } from 'types';

export interface PaymentCheckoutProps {
  lang: Language;
  madrasah: Institution | null;
  module: 'sms' | 'voice' | 'subscription';
  initialAmount?: number;
  fixedAmount?: number;
  onSuccess: (trx: any) => void;
  onCancel: () => void;
  metadata?: any;
}

type CheckoutStep = 'amount' | 'method' | 'number' | 'pay' | 'success' | 'failed';
type PaymentMethod = 'bKash' | 'Nagad';

const BN_TO_EN_DIGITS: Record<string, string> = {
  '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
  '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
};

const toEnglishDigits = (str: string): string =>
  String(str || '').replace(/[০-৯]/g, (d) => BN_TO_EN_DIGITS[d] ?? d);

const normalizeSenderPhone11 = (raw: string): string => {
  const digits = toEnglishDigits(raw).replace(/\D/g, '');
  if (digits.length === 13 && digits.startsWith('8801')) return digits.slice(2);
  if (digits.length === 14 && digits.startsWith('008801')) return digits.slice(4);
  if (digits.length === 11 && digits.startsWith('01')) return digits;
  if (digits.length === 10 && digits.startsWith('1')) return `0${digits}`;
  return digits;
};

const isValidBdMobile11 = (phone: string): boolean => /^01[3-9]\d{8}$/.test(phone);

const QUICK_AMOUNTS = [100, 200, 500, 1000];
const SESSION_MAX_AGE_MS = 2 * 60 * 60 * 1000; // 2 hours

export const PaymentCheckout: React.FC<PaymentCheckoutProps> = ({
  lang,
  madrasah,
  module,
  initialAmount,
  fixedAmount,
  onSuccess,
  onCancel,
  metadata
}) => {
  const isDark = madrasah?.theme === 'dark';

  const instConfig = useMemo(() => {
    const raw = madrasah?.config_json as any;
    if (typeof raw === 'string') {
      try { return JSON.parse(raw); } catch { return {}; }
    }
    return raw || {};
  }, [madrasah?.config_json]);

  const storageKey = madrasah?.id ? `pending_payment_${madrasah.id}_${module}` : '';

  const [step, setStep] = useState<CheckoutStep>('amount');
  const [amountInput, setAmountInput] = useState<string>(() => {
    if (module === 'subscription' && fixedAmount !== undefined) return String(fixedAmount);
    if (initialAmount !== undefined && initialAmount > 0) return String(initialAmount);
    return module === 'subscription' ? '0' : '100';
  });
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bKash');
  const [senderPhone, setSenderPhone] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [creatingSession, setCreatingSession] = useState<boolean>(false);
  const [cancelling, setCancelling] = useState<boolean>(false);
  const [checkingNow, setCheckingNow] = useState<boolean>(false);
  const [copiedNum, setCopiedNum] = useState<boolean>(false);
  const [pendingTrx, setPendingTrx] = useState<any>(null);
  const [completedTrx, setCompletedTrx] = useState<any>(null);
  const [pollElapsedSec, setPollElapsedSec] = useState<number>(0);

  const [publicSettings, setPublicSettings] = useState<{
    bkash_number: string;
    nagad_number: string;
    sms_rate: number;
    voice_rate: number;
  }>({
    bkash_number: '01700-000000',
    nagad_number: '',
    sms_rate: Number(instConfig?.sms_rate) > 0 ? Number(instConfig.sms_rate) : 0.50,
    voice_rate: Number(instConfig?.voice_rate) > 0 ? Number(instConfig.voice_rate) : 1.00
  });

  const handledTerminalRef = useRef<string | null>(null);
  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  useEffect(() => {
    if (module === 'subscription' && fixedAmount !== undefined) {
      setAmountInput(String(fixedAmount));
    }
  }, [module, fixedAmount]);

  const effectiveSmsRate = useMemo(() => {
    const custom = Number(instConfig?.sms_rate);
    if (custom > 0) return custom;
    return publicSettings.sms_rate > 0 ? publicSettings.sms_rate : 0.50;
  }, [instConfig?.sms_rate, publicSettings.sms_rate]);

  const effectiveVoiceRate = useMemo(() => {
    const custom = Number(instConfig?.voice_rate);
    if (custom > 0) return custom;
    return publicSettings.voice_rate > 0 ? publicSettings.voice_rate : 1.00;
  }, [instConfig?.voice_rate, publicSettings.voice_rate]);

  const parsedAmount = useMemo(() => {
    if (module === 'subscription' && fixedAmount !== undefined) {
      return Number(fixedAmount) || 0;
    }
    const clean = toEnglishDigits(amountInput).replace(/[^0-9.]/g, '');
    const num = parseFloat(clean);
    return Number.isFinite(num) ? Math.round(num * 100) / 100 : 0;
  }, [amountInput, fixedAmount, module]);

  const estimatedSmsCount = useMemo(() => {
    if (module !== 'sms' || parsedAmount <= 0 || effectiveSmsRate <= 0) return 0;
    return Math.ceil(parsedAmount / effectiveSmsRate);
  }, [module, parsedAmount, effectiveSmsRate]);

  // Fetch global payment settings via RPC with fallback to system_settings
  useEffect(() => {
    let active = true;
    const loadPaymentSettings = async () => {
      try {
        const { data: rpcData, error: rpcErr } = await supabase.rpc('get_public_payment_settings');
        const row = Array.isArray(rpcData) ? rpcData[0] : rpcData;
        if (!rpcErr && row && (row.bkash_number || row.nagad_number || row.sms_rate || row.voice_rate)) {
          if (!active) return;
          setPublicSettings((prev) => ({
            bkash_number: row.bkash_number || prev.bkash_number,
            nagad_number: row.nagad_number || '',
            sms_rate: Number(row.sms_rate) > 0 ? Number(row.sms_rate) : prev.sms_rate,
            voice_rate: Number(row.voice_rate) > 0 ? Number(row.voice_rate) : prev.voice_rate
          }));
          return;
        }
      } catch {
        // Fallback below
      }

      try {
        const { data: sysRow } = await supabase
          .from('system_settings')
          .select('bkash_number, nagad_number, sms_rate, voice_rate')
          .limit(1)
          .maybeSingle();

        if (active && sysRow) {
          setPublicSettings((prev) => ({
            bkash_number: sysRow.bkash_number || prev.bkash_number,
            nagad_number: sysRow.nagad_number || '',
            sms_rate: Number(sysRow.sms_rate) > 0 ? Number(sysRow.sms_rate) : prev.sms_rate,
            voice_rate: Number(sysRow.voice_rate) > 0 ? Number(sysRow.voice_rate) : prev.voice_rate
          }));
        }
      } catch (err) {
        console.error('Failed to load payment settings:', err);
      }
    };

    loadPaymentSettings();
    return () => { active = false; };
  }, []);

  // Restore saved pending payment session from localStorage (when returning from bKash/Nagad app)
  useEffect(() => {
    if (!storageKey) return;
    let active = true;

    const restoreSession = async () => {
      try {
        const raw = localStorage.getItem(storageKey);
        if (!raw) return;
        const saved = JSON.parse(raw);
        if (!saved?.trx?.id || (saved.createdAt && Date.now() - saved.createdAt > SESSION_MAX_AGE_MS)) {
          localStorage.removeItem(storageKey);
          return;
        }

        const { data: latestTrx, error } = await supabase
          .from('transactions')
          .select('*')
          .eq('id', saved.trx.id)
          .maybeSingle();

        if (!active) return;

        if (error || !latestTrx) {
          localStorage.removeItem(storageKey);
          return;
        }

        if (latestTrx.status === 'approved') {
          localStorage.removeItem(storageKey);
          setCompletedTrx(latestTrx);
          setPendingTrx(latestTrx);
          if (saved.paymentMethod) setPaymentMethod(saved.paymentMethod);
          if (saved.senderPhone) setSenderPhone(saved.senderPhone);
          if (saved.amount) setAmountInput(String(saved.amount));
          setStep('success');
          if (handledTerminalRef.current !== latestTrx.id) {
            handledTerminalRef.current = latestTrx.id;
            onSuccessRef.current(latestTrx);
          }
          return;
        }

        if (latestTrx.status === 'rejected') {
          localStorage.removeItem(storageKey);
          setPendingTrx(latestTrx);
          setStep('failed');
          return;
        }

        if (latestTrx.status === 'cancelled') {
          localStorage.removeItem(storageKey);
          return;
        }

        if (latestTrx.status === 'pending') {
          setPendingTrx(latestTrx);
          if (saved.paymentMethod) setPaymentMethod(saved.paymentMethod);
          if (saved.senderPhone) setSenderPhone(saved.senderPhone);
          if (saved.amount) setAmountInput(String(saved.amount));
          setStep('pay');
        }
      } catch {
        localStorage.removeItem(storageKey);
      }
    };

    restoreSession();
    return () => { active = false; };
  }, [storageKey]);

  const checkTransactionStatus = useCallback(async (trxId: string) => {
    if (!trxId) return;
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('id', trxId)
        .maybeSingle();

      if (error || !data) return;

      if (data.status === 'approved') {
        if (storageKey) localStorage.removeItem(storageKey);
        setCompletedTrx(data);
        setPendingTrx(data);
        setStep('success');
        if (handledTerminalRef.current !== data.id) {
          handledTerminalRef.current = data.id;
          onSuccessRef.current(data);
        }
      } else if (data.status === 'rejected') {
        if (storageKey) localStorage.removeItem(storageKey);
        setPendingTrx(data);
        setStep('failed');
      } else if (data.status === 'cancelled') {
        if (storageKey) localStorage.removeItem(storageKey);
        setPendingTrx(null);
        setStep('amount');
      }
    } catch (err) {
      console.error('Status polling error:', err);
    }
  }, [storageKey]);

  // Auto-verification polling every 3 seconds + instant check on tab/app return
  useEffect(() => {
    if (step !== 'pay' || !pendingTrx?.id) return;

    const interval = setInterval(() => {
      checkTransactionStatus(pendingTrx.id);
    }, 3000);

    const secTimer = setInterval(() => {
      setPollElapsedSec((s) => s + 1);
    }, 1000);

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        checkTransactionStatus(pendingTrx.id);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityOrFocus);
    window.addEventListener('focus', handleVisibilityOrFocus);

    return () => {
      clearInterval(interval);
      clearInterval(secTimer);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      window.removeEventListener('focus', handleVisibilityOrFocus);
    };
  }, [step, pendingTrx?.id, checkTransactionStatus]);

  const currentAdminPayNumber = useMemo(() => {
    if (paymentMethod === 'Nagad') {
      return publicSettings.nagad_number || publicSettings.bkash_number || '01700-000000';
    }
    return publicSettings.bkash_number || '01700-000000';
  }, [paymentMethod, publicSettings]);

  const handleStep1Next = () => {
    setErrorMsg('');
    if (module !== 'subscription' && parsedAmount < 50) {
      setErrorMsg(
        lang === 'bn'
          ? 'সর্বনিম্ন রিচার্জের পরিমাণ ৫০ টাকা।'
          : 'Minimum recharge amount is 50 BDT.'
      );
      return;
    }
    if (parsedAmount <= 0) {
      setErrorMsg(
        lang === 'bn'
          ? 'সঠিক টাকার পরিমাণ দিন।'
          : 'Please enter a valid amount.'
      );
      return;
    }
    setStep('method');
  };

  const handleStep2Next = () => {
    setErrorMsg('');
    setStep('number');
  };

  const handleCreatePendingSession = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!madrasah?.id) {
      setErrorMsg(lang === 'bn' ? 'প্রতিষ্ঠানের তথ্য পাওয়া যায়নি।' : 'Organization info not found.');
      return;
    }

    const normalizedSender = normalizeSenderPhone11(senderPhone);
    if (!isValidBdMobile11(normalizedSender)) {
      setErrorMsg(
        lang === 'bn'
          ? 'সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)।'
          : 'Please enter a valid 11-digit mobile number (e.g. 017XXXXXXXX).'
      );
      return;
    }

    setSenderPhone(normalizedSender);
    setCreatingSession(true);

    try {
      const generatedTrxId = `PENDING_${Date.now()}`;
      const monthsList = Array.isArray(metadata?.months) ? metadata.months : [];
      const description =
        module === 'sms'
          ? `SMS Recharge Request (${estimatedSmsCount} SMS) via ${paymentMethod}`
          : module === 'voice'
            ? `Voice Recharge Request via ${paymentMethod}`
            : `Subscription Payment (${metadata?.package_name || 'PLAN'}) - ${monthsList.join(', ')} via ${paymentMethod}`;

      const fullPayload: Record<string, any> = {
        institution_id: madrasah.id,
        amount: parsedAmount,
        transaction_id: generatedTrxId,
        sender_phone: normalizedSender,
        description,
        type: 'credit',
        status: 'pending',
        module,
        sms_count: module === 'sms' ? estimatedSmsCount : 0,
        metadata: {
          ...(metadata || {}),
          payment_method: paymentMethod,
          sender_number: normalizedSender,
          checkout_session: true,
          requested_amount: parsedAmount,
          ...(module === 'sms' ? { sms_rate: effectiveSmsRate } : {}),
          ...(module === 'voice' ? { voice_rate: effectiveVoiceRate } : {})
        }
      };

      let { data: insertedRow, error: insertErr } = await supabase
        .from('transactions')
        .insert(fullPayload)
        .select('*')
        .single();

      if (insertErr && (insertErr.message?.includes('module') || insertErr.message?.includes('metadata') || insertErr.code === '42703')) {
        const { module: _m, metadata: _md, ...fallbackPayload } = fullPayload;
        const retry = await supabase
          .from('transactions')
          .insert(fallbackPayload)
          .select('*')
          .single();
        insertedRow = retry.data;
        insertErr = retry.error;
      }

      if (insertErr) throw insertErr;

      handledTerminalRef.current = null;
      setPendingTrx(insertedRow);
      setPollElapsedSec(0);

      if (storageKey && insertedRow) {
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            trx: insertedRow,
            step: 'pay',
            paymentMethod,
            senderPhone: normalizedSender,
            amount: parsedAmount,
            createdAt: Date.now()
          })
        );
      }

      setStep('pay');
    } catch (err: any) {
      setErrorMsg(
        err?.message ||
          (lang === 'bn'
            ? 'পেমেন্ট সেশন তৈরি করতে সমস্যা হয়েছে। আবার চেষ্টা করুন।'
            : 'Failed to initialize payment session. Please try again.')
      );
    } finally {
      setCreatingSession(false);
    }
  };

  const handleCopyNumber = async () => {
    const cleanNum = toEnglishDigits(currentAdminPayNumber).replace(/[^0-9]/g, '') || currentAdminPayNumber;
    try {
      await navigator.clipboard.writeText(cleanNum);
      setCopiedNum(true);
      setTimeout(() => setCopiedNum(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const handleOpenWalletApp = (method: PaymentMethod) => {
    const ua = navigator.userAgent || '';
    const isAndroid = /Android/i.test(ua);
    const schemeUrl =
      method === 'bKash'
        ? isAndroid
          ? 'intent://#Intent;scheme=bkash;package=com.bKash.customerapp;end'
          : 'bkash://'
        : isAndroid
          ? 'intent://#Intent;scheme=nagad;package=com.konasl.nagad;end'
          : 'nagad://';

    const link = document.createElement('a');
    link.href = schemeUrl;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleCancelPayment = async () => {
    setCancelling(true);
    try {
      if (pendingTrx?.id) {
        await supabase
          .from('transactions')
          .update({ status: 'cancelled' })
          .eq('id', pendingTrx.id);
      }
      if (storageKey) {
        localStorage.removeItem(storageKey);
      }
      setPendingTrx(null);
      setPollElapsedSec(0);
      setErrorMsg('');
      setStep('amount');
      onCancel();
    } catch (err) {
      console.error('Error cancelling payment:', err);
      if (storageKey) localStorage.removeItem(storageKey);
      setPendingTrx(null);
      setStep('amount');
      onCancel();
    } finally {
      setCancelling(false);
    }
  };

  const handleResetCheckout = () => {
    if (storageKey) localStorage.removeItem(storageKey);
    handledTerminalRef.current = null;
    setPendingTrx(null);
    setCompletedTrx(null);
    setErrorMsg('');
    setPollElapsedSec(0);
    setStep('amount');
  };

  const stepsMeta = [
    { key: 'amount', num: 1, labelBn: 'পরিমাণ', labelEn: 'Amount' },
    { key: 'method', num: 2, labelBn: 'মাধ্যম', labelEn: 'Method' },
    { key: 'number', num: 3, labelBn: 'নম্বর', labelEn: 'Number' },
    { key: 'pay', num: 4, labelBn: 'পেমেন্ট', labelEn: 'Verify' }
  ];

  const activeStepIndex =
    step === 'amount' ? 0 :
    step === 'method' ? 1 :
    step === 'number' ? 2 :
    3;

  const moduleHeader =
    module === 'sms'
      ? {
          icon: Zap,
          titleBn: 'অটোমেটিক এসএমএস রিচার্জ',
          titleEn: 'Instant SMS Recharge',
          subBn: `রেট: ৳${effectiveSmsRate} / SMS • অটো-ভেরিফিকেশন`,
          subEn: `Rate: ৳${effectiveSmsRate} / SMS • Auto-Verification`
        }
      : module === 'voice'
        ? {
            icon: Mic,
            titleBn: 'অটোমেটিক ভয়েস রিচার্জ',
            titleEn: 'Instant Voice Recharge',
            subBn: `ভয়েস কল রেট: ৳${effectiveVoiceRate} • অটো-ভেরিফিকেশন`,
            subEn: `Voice Rate: ৳${effectiveVoiceRate} • Auto-Verification`
          }
        : {
            icon: Package,
            titleBn: 'অটোমেটিক সাবস্ক্রিপশন পেমেন্ট',
            titleEn: 'Instant Subscription Checkout',
            subBn: `${metadata?.package_name || 'PLAN'} • অটো-ভেরিফিকেশন`,
            subEn: `${metadata?.package_name || 'PLAN'} • Auto-Verification`
          };

  const HeaderIcon = moduleHeader.icon;

  return (
    <div
      className={`rounded-[2.2rem] border p-5 sm:p-7 space-y-6 transition-all ${
        isDark
          ? 'bg-slate-800/95 border-slate-700 text-slate-100'
          : 'bg-white border-slate-100 text-slate-800 shadow-bubble'
      }`}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${
              isDark ? 'bg-[#42f5e9]/15 text-[#42f5e9]' : 'bg-[#42f5e9]/15 text-[#0fb5ab]'
            }`}
          >
            <HeaderIcon size={22} />
          </div>
          <div className="min-w-0">
            <h3 className={`text-base sm:text-lg font-black font-noto leading-tight truncate ${isDark ? 'text-white' : 'text-[#0e8a84]'}`}>
              {lang === 'bn' ? moduleHeader.titleBn : moduleHeader.titleEn}
            </h3>
            <p className="text-[11px] font-bold text-slate-400 truncate mt-0.5 tabular-nums">
              {lang === 'bn' ? moduleHeader.subBn : moduleHeader.subEn}
            </p>
          </div>
        </div>

        {module === 'subscription' && step !== 'pay' && step !== 'success' && (
          <button
            type="button"
            onClick={onCancel}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-black border shrink-0 transition-colors ${
              isDark ? 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
            }`}
          >
            {lang === 'bn' ? 'পরিবর্তন' : 'Change'}
          </button>
        )}
      </div>

      {/* Animated 4-Step Progress Bar */}
      {step !== 'success' && step !== 'failed' && (
        <div className="relative pt-1 pb-2">
          <div className={`h-1.5 w-full rounded-full overflow-hidden ${isDark ? 'bg-slate-900' : 'bg-slate-100'}`}>
            <div
              className="h-full bg-gradient-to-r from-[#0fb5ab] to-[#42f5e9] rounded-full transition-all duration-500 ease-out"
              style={{ width: `${((activeStepIndex + 1) / 4) * 100}%` }}
            />
          </div>
          <div className="grid grid-cols-4 gap-1 mt-3">
            {stepsMeta.map((s, idx) => {
              const isDone = idx < activeStepIndex;
              const isCurrent = idx === activeStepIndex;
              return (
                <div key={s.key} className="flex flex-col items-center text-center gap-1">
                  <div
                    className={`w-6 h-6 rounded-full text-[11px] font-black flex items-center justify-center transition-all duration-300 tabular-nums ${
                      isDone
                        ? 'bg-[#0fb5ab] text-white'
                        : isCurrent
                          ? 'bg-[#42f5e9] text-[#0e8a84] ring-4 ring-[#42f5e9]/20'
                          : isDark
                            ? 'bg-slate-900 text-slate-500 border border-slate-700'
                            : 'bg-slate-100 text-slate-400'
                    }`}
                  >
                    {isDone ? <Check size={12} strokeWidth={3} /> : s.num}
                  </div>
                  <span
                    className={`text-[10px] font-bold leading-tight ${
                      isCurrent || isDone
                        ? isDark ? 'text-[#42f5e9]' : 'text-[#0fb5ab]'
                        : 'text-slate-400'
                    }`}
                  >
                    {lang === 'bn' ? s.labelBn : s.labelEn}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* STEP 1: AMOUNT */}
      {step === 'amount' && (
        <div className="space-y-5 animate-in fade-in duration-300">
          {module === 'subscription' && Array.isArray(metadata?.months) && metadata.months.length > 0 && (
            <div className={`p-4 rounded-2xl border space-y-2 ${isDark ? 'bg-slate-900/70 border-slate-700' : 'bg-[#42f5e9]/10 border-[#42f5e9]/30'}`}>
              <div className="flex items-center justify-between text-xs font-black">
                <span className="text-slate-400">
                  {lang === 'bn' ? `নির্বাচিত প্যাকেজ: ${metadata.package_name || 'STANDARD'}` : `Plan: ${metadata.package_name || 'STANDARD'}`}
                </span>
                <span className={isDark ? 'text-[#42f5e9]' : 'text-[#0fb5ab]'}>
                  {metadata.months.length} {lang === 'bn' ? 'মাস' : 'mos'}
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {metadata.months.map((m: string) => (
                  <span
                    key={m}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-black tabular-nums ${
                      isDark ? 'bg-slate-800 text-slate-200 border border-slate-700' : 'bg-white text-[#0fb5ab] border border-[#0fb5ab]/20'
                    }`}
                  >
                    {m}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider px-1 block">
              {lang === 'bn' ? 'টাকার পরিমাণ (BDT)' : 'Amount (BDT)'}
            </label>
            <div className="relative">
              <span className={`absolute left-5 top-1/2 -translate-y-1/2 text-xl font-black ${isDark ? 'text-[#42f5e9]' : 'text-[#0fb5ab]'}`}>
                ৳
              </span>
              <input
                type="text"
                inputMode="decimal"
                readOnly={module === 'subscription'}
                value={amountInput}
                onChange={(e) => {
                  if (module === 'subscription') return;
                  setErrorMsg('');
                  setAmountInput(toEnglishDigits(e.target.value).replace(/[^0-9.]/g, ''));
                }}
                placeholder="100"
                className={`w-full h-14 pl-11 pr-5 rounded-2xl border-2 text-2xl font-black tabular-nums outline-none transition-all ${
                  module === 'subscription' ? 'cursor-not-allowed opacity-90' : ''
                } ${
                  isDark
                    ? 'bg-slate-900 border-slate-700 text-white focus:border-[#42f5e9]'
                    : 'bg-slate-50 border-slate-200 text-[#0e8a84] focus:border-[#0fb5ab] focus:bg-white'
                }`}
              />
            </div>

            {module !== 'subscription' && (
              <div className="grid grid-cols-4 gap-2 pt-1">
                {QUICK_AMOUNTS.map((amt) => {
                  const isSelected = parsedAmount === amt;
                  return (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => {
                        setErrorMsg('');
                        setAmountInput(String(amt));
                      }}
                      className={`py-2.5 rounded-xl text-xs font-black tabular-nums border transition-all active:scale-95 ${
                        isSelected
                          ? 'bg-[#0fb5ab] text-white border-[#0fb5ab] shadow-sm'
                          : isDark
                            ? 'bg-slate-900 border-slate-700 text-slate-300 hover:border-[#42f5e9]/50'
                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-[#0fb5ab]/50'
                      }`}
                    >
                      ৳{amt}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {parsedAmount > 0 && module !== 'subscription' && (
            <div className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs font-black ${
              isDark ? 'bg-slate-900/60 border-slate-700' : 'bg-[#42f5e9]/10 border-[#42f5e9]/30'
            }`}>
              <span className="text-slate-400">
                {module === 'sms'
                  ? (lang === 'bn' ? 'সম্ভাব্য SMS পাবেন:' : 'Estimated SMS:')
                  : (lang === 'bn' ? 'ওয়ালেটে যোগ হবে:' : 'Wallet Credit:')}
              </span>
              <span className={`tabular-nums text-sm ${isDark ? 'text-[#42f5e9]' : 'text-[#0e8a84]'}`}>
                {module === 'sms'
                  ? `${estimatedSmsCount.toLocaleString()} SMS`
                  : `৳ ${parsedAmount.toFixed(2)}`}
              </span>
            </div>
          )}

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleStep1Next}
            className="w-full h-13 bg-[#0fb5ab] hover:bg-[#0d9e95] text-white font-black rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#0fb5ab]/20 active:scale-[0.98] transition-all"
          >
            <span>{lang === 'bn' ? 'পরবর্তী ধাপ' : 'Continue'}</span>
            <ArrowRight size={18} />
          </button>
        </div>
      )}

      {/* STEP 2: PAYMENT METHOD */}
      {step === 'method' && (
        <div className="space-y-5 animate-in fade-in duration-300">
          <div className="space-y-2">
            <p className="text-xs font-black text-slate-400 px-1">
              {lang === 'bn' ? 'পেমেন্ট মেথড নির্বাচন করুন' : 'Select Payment Method'}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod('bKash')}
                className={`p-4 rounded-2xl border-2 text-left transition-all flex flex-col gap-3 active:scale-[0.98] ${
                  paymentMethod === 'bKash'
                    ? isDark
                      ? 'bg-[#E2136E]/15 border-[#E2136E] ring-2 ring-[#E2136E]/25'
                      : 'bg-[#E2136E]/5 border-[#E2136E] ring-2 ring-[#E2136E]/15'
                    : isDark
                      ? 'bg-slate-900/60 border-slate-700 hover:border-slate-600'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-[#E2136E] text-white font-black text-xs flex items-center justify-center shadow-sm">
                    bKash
                  </div>
                  {paymentMethod === 'bKash' && (
                    <CheckCircle2 size={18} className="text-[#E2136E]" />
                  )}
                </div>
                <div>
                  <h4 className={`font-black text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {lang === 'bn' ? 'বিকাশ (bKash)' : 'bKash'}
                  </h4>
                  <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                    {lang === 'bn' ? 'সেন্ড মানি • অটো-ভেরিফাই' : 'Send Money • Auto-Verify'}
                  </p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('Nagad')}
                className={`p-4 rounded-2xl border-2 text-left transition-all flex flex-col gap-3 active:scale-[0.98] ${
                  paymentMethod === 'Nagad'
                    ? isDark
                      ? 'bg-[#F7941D]/15 border-[#F7941D] ring-2 ring-[#F7941D]/25'
                      : 'bg-[#F7941D]/5 border-[#F7941D] ring-2 ring-[#F7941D]/15'
                    : isDark
                      ? 'bg-slate-900/60 border-slate-700 hover:border-slate-600'
                      : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-[#F7941D] text-white font-black text-xs flex items-center justify-center shadow-sm">
                    Nagad
                  </div>
                  {paymentMethod === 'Nagad' && (
                    <CheckCircle2 size={18} className="text-[#F7941D]" />
                  )}
                </div>
                <div>
                  <h4 className={`font-black text-sm ${isDark ? 'text-white' : 'text-slate-900'}`}>
                    {lang === 'bn' ? 'নগদ (Nagad)' : 'Nagad'}
                  </h4>
                  <p className="text-[10px] font-bold text-slate-400 mt-0.5">
                    {lang === 'bn' ? 'সেন্ড মানি • অটো-ভেরিফাই' : 'Send Money • Auto-Verify'}
                  </p>
                </div>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setStep('amount')}
              className={`px-4 h-13 rounded-2xl font-black text-xs border flex items-center justify-center gap-1.5 transition-all ${
                isDark ? 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <ChevronLeft size={16} />
              <span>{lang === 'bn' ? 'পিছনে' : 'Back'}</span>
            </button>
            <button
              type="button"
              onClick={handleStep2Next}
              className="flex-1 h-13 bg-[#0fb5ab] hover:bg-[#0d9e95] text-white font-black rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#0fb5ab]/20 active:scale-[0.98] transition-all"
            >
              <span>{lang === 'bn' ? 'পরবর্তী ধাপ' : 'Continue'}</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* STEP 3: SENDER NUMBER */}
      {step === 'number' && (
        <form onSubmit={handleCreatePendingSession} className="space-y-5 animate-in fade-in duration-300">
          <div className={`p-3.5 rounded-2xl border flex items-center justify-between text-xs font-black ${
            isDark ? 'bg-slate-900/70 border-slate-700' : 'bg-slate-50 border-slate-200/80'
          }`}>
            <span className="text-slate-400">{lang === 'bn' ? 'পরিমাণ ও মাধ্যম' : 'Amount & Method'}</span>
            <span className={`tabular-nums ${isDark ? 'text-[#42f5e9]' : 'text-[#0e8a84]'}`}>
              ৳{parsedAmount.toLocaleString()} · {paymentMethod}
            </span>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-black text-slate-400 uppercase tracking-wider px-1 block">
              {lang === 'bn'
                ? `যে ${paymentMethod} নম্বর থেকে টাকা পাঠাবেন (১১ ডিজিট)`
                : `Your ${paymentMethod} Sender Number (11 digits)`}
            </label>
            <div className="relative">
              <Smartphone
                size={18}
                className={`absolute left-4 top-1/2 -translate-y-1/2 ${isDark ? 'text-[#42f5e9]' : 'text-[#0fb5ab]'}`}
              />
              <input
                type="tel"
                required
                value={senderPhone}
                onChange={(e) => {
                  setErrorMsg('');
                  setSenderPhone(toEnglishDigits(e.target.value));
                }}
                placeholder="017XXXXXXXX"
                maxLength={14}
                className={`w-full h-14 pl-11 pr-4 rounded-2xl border-2 text-lg font-black font-mono tabular-nums outline-none transition-all ${
                  isDark
                    ? 'bg-slate-900 border-slate-700 text-white focus:border-[#42f5e9]'
                    : 'bg-slate-50 border-slate-200 text-slate-900 focus:border-[#0fb5ab] focus:bg-white'
                }`}
              />
            </div>
            <p className="text-[11px] font-bold text-slate-400 px-1 leading-relaxed">
              {lang === 'bn'
                ? 'টাকা পাঠানোর পর অটোমেটিক ভেরিফিকেশনের জন্য সঠিক প্রেরক নম্বরটি দিন।'
                : 'Enter the exact 11-digit number you will send money from for instant auto-verification.'}
            </p>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-bold flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={creatingSession}
              onClick={() => {
                setErrorMsg('');
                setStep('method');
              }}
              className={`px-4 h-13 rounded-2xl font-black text-xs border flex items-center justify-center gap-1.5 transition-all ${
                isDark ? 'bg-slate-900 border-slate-700 text-slate-300 hover:bg-slate-700' : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
              }`}
            >
              <ChevronLeft size={16} />
              <span>{lang === 'bn' ? 'পিছনে' : 'Back'}</span>
            </button>
            <button
              type="submit"
              disabled={creatingSession}
              className="flex-1 h-13 bg-[#0fb5ab] hover:bg-[#0d9e95] text-white font-black rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#0fb5ab]/20 active:scale-[0.98] transition-all disabled:opacity-60"
            >
              {creatingSession ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
              <span>{lang === 'bn' ? 'এগিয়ে যান' : 'Proceed to Pay'}</span>
            </button>
          </div>
        </form>
      )}

      {/* STEP 4: PAY & AUTO VERIFY */}
      {step === 'pay' && (
        <div className="space-y-4 animate-in fade-in duration-300">
          {/* Waiting Auto-Verify Banner */}
          <div
            className={`p-4 rounded-2xl border flex items-center justify-between gap-3 ${
              isDark ? 'bg-[#0fb5ab]/10 border-[#42f5e9]/30' : 'bg-[#42f5e9]/10 border-[#0fb5ab]/25'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#0fb5ab] text-white flex items-center justify-center shrink-0">
                <Loader2 size={18} className="animate-spin" />
              </div>
              <div className="min-w-0">
                <p className={`text-xs font-black font-noto ${isDark ? 'text-[#42f5e9]' : 'text-[#0e8a84]'}`}>
                  {lang === 'bn' ? 'অটো-ভেরিফিকেশন চলছে...' : 'Auto-Verification Active...'}
                </p>
                <p className="text-[10px] font-bold text-slate-400 truncate tabular-nums">
                  {lang === 'bn'
                    ? `টাকা পাঠালেই স্বয়ংক্রিয়ভাবে সফল হবে (${pollElapsedSec}s)`
                    : `Auto-approves as soon as Send Money arrives (${pollElapsedSec}s)`}
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={checkingNow}
              onClick={async () => {
                if (!pendingTrx?.id) return;
                setCheckingNow(true);
                await checkTransactionStatus(pendingTrx.id);
                setCheckingNow(false);
              }}
              className={`px-3 py-2 rounded-xl text-[10px] font-black border flex items-center gap-1 shrink-0 transition-all ${
                isDark ? 'bg-slate-900 border-slate-700 text-[#42f5e9] hover:bg-slate-800' : 'bg-white border-slate-200 text-[#0fb5ab] hover:bg-slate-50'
              }`}
            >
              <RefreshCw size={12} className={checkingNow ? 'animate-spin' : ''} />
              <span>{lang === 'bn' ? 'চেক' : 'Check'}</span>
            </button>
          </div>

          {/* Admin Payment Number Box */}
          <div
            className={`p-4 sm:p-5 rounded-2xl border space-y-3 ${
              isDark ? 'bg-slate-900/80 border-slate-700' : 'bg-slate-50 border-slate-200/80'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black text-white ${
                  paymentMethod === 'bKash' ? 'bg-[#E2136E]' : 'bg-[#F7941D]'
                }`}
              >
                {paymentMethod} Send Money
              </span>
              <span className="text-xs font-black tabular-nums text-slate-400">
                {lang === 'bn' ? 'প্রেরক:' : 'From:'} {senderPhone}
              </span>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <div className="min-w-0">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                  {lang === 'bn' ? `${paymentMethod} পার্সোনাল নম্বর` : `${paymentMethod} Personal Number`}
                </p>
                <p className={`text-xl sm:text-2xl font-black font-mono tabular-nums mt-0.5 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {currentAdminPayNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopyNumber}
                className={`px-3.5 py-2.5 rounded-xl text-xs font-black flex items-center gap-1.5 shrink-0 border transition-all active:scale-95 ${
                  copiedNum
                    ? 'bg-emerald-500 text-white border-emerald-500'
                    : isDark
                      ? 'bg-slate-800 hover:bg-slate-700 text-[#42f5e9] border-slate-700'
                      : 'bg-white hover:bg-slate-100 text-[#0fb5ab] border-slate-200'
                }`}
              >
                {copiedNum ? <Check size={14} /> : <Copy size={14} />}
                <span>{copiedNum ? (lang === 'bn' ? 'কপি হয়েছে' : 'Copied') : (lang === 'bn' ? 'কপি করুন' : 'Copy')}</span>
              </button>
            </div>

            <div className={`pt-2 border-t flex items-center justify-between text-xs font-black ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
              <span className="text-slate-400">{lang === 'bn' ? 'পাঠাতে হবে (সঠিক পরিমাণ):' : 'Exact Amount to Send:'}</span>
              <span className={`text-lg tabular-nums ${isDark ? 'text-[#42f5e9]' : 'text-[#0e8a84]'}`}>
                ৳ {parsedAmount.toLocaleString()}
              </span>
            </div>
          </div>

          {/* Instructions */}
          <div className={`p-3.5 rounded-2xl border text-[11px] font-bold space-y-1.5 leading-relaxed ${
            isDark ? 'bg-slate-900/40 border-slate-700/80 text-slate-300' : 'bg-slate-50/70 border-slate-200/70 text-slate-600'
          }`}>
            <p className="flex items-start gap-2">
              <span className="font-black text-[#0fb5ab] tabular-nums">1.</span>
              <span>
                {lang === 'bn'
                  ? `উপরের ${paymentMethod} নম্বরটি কপি করে আপনার ${paymentMethod} অ্যাপে যান।`
                  : `Copy the ${paymentMethod} number above and open your ${paymentMethod} app.`}
              </span>
            </p>
            <p className="flex items-start gap-2">
              <span className="font-black text-[#0fb5ab] tabular-nums">2.</span>
              <span>
                {lang === 'bn'
                  ? `ঠিক ৳${parsedAmount.toLocaleString()} টাকা "Send Money" করুন (${senderPhone} নম্বর থেকে)।`
                  : `Send Money exact ৳${parsedAmount.toLocaleString()} from ${senderPhone}.`}
              </span>
            </p>
            <p className="flex items-start gap-2">
              <span className="font-black text-[#0fb5ab] tabular-nums">3.</span>
              <span>
                {lang === 'bn'
                  ? 'টাকা পাঠানোর পর এই পেজে ফিরে আসুন — কোনো TrxID দিতে হবে না, স্বয়ংক্রিয়ভাবে কনফার্ম হবে।'
                  : 'Return to this page after sending — no TrxID needed, verification completes automatically.'}
              </span>
            </p>
          </div>

          {/* Direct App Launch + Cancel */}
          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              onClick={() => handleOpenWalletApp(paymentMethod)}
              className={`w-full h-13 text-white font-black rounded-2xl text-sm flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all ${
                paymentMethod === 'bKash'
                  ? 'bg-[#E2136E] hover:bg-[#c80f60] shadow-[#E2136E]/25'
                  : 'bg-[#F7941D] hover:bg-[#de8213] shadow-[#F7941D]/25'
              }`}
            >
              <ExternalLink size={17} />
              <span>
                {lang === 'bn'
                  ? `সরাসরি ${paymentMethod} অ্যাপ ওপেন করুন`
                  : `Open ${paymentMethod} App`}
              </span>
            </button>

            <button
              type="button"
              disabled={cancelling}
              onClick={handleCancelPayment}
              className={`w-full h-11 rounded-2xl text-xs font-black border flex items-center justify-center gap-2 transition-all disabled:opacity-50 ${
                isDark
                  ? 'bg-red-950/30 border-red-900/50 text-red-400 hover:bg-red-950/50'
                  : 'bg-red-50 border-red-100 text-red-500 hover:bg-red-100/70'
              }`}
            >
              {cancelling ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
              <span>{lang === 'bn' ? 'পেমেন্ট বাতিল করুন' : 'Cancel Payment'}</span>
            </button>
          </div>
        </div>
      )}

      {/* SUCCESS STATE */}
      {step === 'success' && (
        <div className="py-6 text-center space-y-5 animate-in zoom-in-95 duration-300">
          <div className="w-20 h-20 rounded-full bg-emerald-500/15 text-emerald-500 border-4 border-emerald-500/20 flex items-center justify-center mx-auto">
            <CheckCircle2 size={42} strokeWidth={2.5} />
          </div>
          <div className="space-y-1.5">
            <h4 className={`text-xl font-black font-noto ${isDark ? 'text-white' : 'text-[#0e8a84]'}`}>
              {lang === 'bn' ? 'পেমেন্ট সফলভাবে সম্পন্ন হয়েছে!' : 'Payment Verified Successfully!'}
            </h4>
            <p className="text-xs font-bold text-slate-400 leading-relaxed max-w-sm mx-auto">
              {module === 'sms'
                ? (lang === 'bn'
                    ? `আপনার অ্যাকাউন্টে ${completedTrx?.sms_count || estimatedSmsCount} টি SMS ব্যালেন্স যোগ করা হয়েছে।`
                    : `${completedTrx?.sms_count || estimatedSmsCount} SMS credits have been added to your account.`)
                : module === 'voice'
                  ? (lang === 'bn'
                      ? `আপনার ভয়েস ওয়ালেটে ৳${Number(completedTrx?.amount || parsedAmount).toLocaleString()} যোগ করা হয়েছে।`
                      : `৳${Number(completedTrx?.amount || parsedAmount).toLocaleString()} has been added to your voice wallet.`)
                  : (lang === 'bn'
                      ? 'আপনার সাবস্ক্রিপশন পেমেন্ট অনুমোদিত হয়েছে এবং মেয়াদ আপডেট করা হয়েছে।'
                      : 'Your subscription payment is approved and your plan is now active.')}
            </p>
          </div>

          <div className={`p-4 rounded-2xl border text-xs font-bold space-y-2 text-left ${
            isDark ? 'bg-slate-900/70 border-slate-700' : 'bg-slate-50 border-slate-200/80'
          }`}>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">{lang === 'bn' ? 'পরিমাণ' : 'Amount'}</span>
              <span className={`font-black tabular-nums ${isDark ? 'text-[#42f5e9]' : 'text-[#0fb5ab]'}`}>
                ৳ {Number(completedTrx?.amount || parsedAmount).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-400">TrxID</span>
              <span className="font-mono font-black">{completedTrx?.transaction_id || pendingTrx?.transaction_id || 'VERIFIED'}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              handleResetCheckout();
              if (module === 'subscription') onCancel();
            }}
            className="w-full h-12 bg-[#42f5e9] text-[#0e8a84] font-black rounded-2xl text-xs uppercase tracking-wider shadow-lg shadow-[#42f5e9]/20 active:scale-[0.98] transition-all"
          >
            {module === 'subscription'
              ? (lang === 'bn' ? 'সম্পন্ন ও ফিরে যান' : 'Done & Return')
              : (lang === 'bn' ? 'নতুন রিচার্জ করুন' : 'Make Another Recharge')}
          </button>
        </div>
      )}

      {/* FAILED / REJECTED STATE */}
      {step === 'failed' && (
        <div className="py-6 text-center space-y-5 animate-in zoom-in-95 duration-300">
          <div className="w-20 h-20 rounded-full bg-red-500/15 text-red-500 border-4 border-red-500/20 flex items-center justify-center mx-auto">
            <XCircle size={42} strokeWidth={2.5} />
          </div>
          <div className="space-y-1.5">
            <h4 className={`text-xl font-black font-noto ${isDark ? 'text-white' : 'text-red-600'}`}>
              {lang === 'bn' ? 'পেমেন্ট বাতিল বা প্রত্যাখ্যাত হয়েছে' : 'Payment Rejected or Failed'}
            </h4>
            <p className="text-xs font-bold text-slate-400 leading-relaxed max-w-sm mx-auto">
              {lang === 'bn'
                ? 'এই পেমেন্ট রিকোয়েস্টটি অনুমোদিত হয়নি। সঠিক তথ্য দিয়ে পুনরায় চেষ্টা করুন।'
                : 'This payment session was rejected. Please verify your details and try again.'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleResetCheckout}
              className="flex-1 h-12 bg-[#0fb5ab] text-white font-black rounded-2xl text-xs uppercase tracking-wider active:scale-[0.98] transition-all"
            >
              {lang === 'bn' ? 'আবার চেষ্টা করুন' : 'Try Again'}
            </button>
            <button
              type="button"
              onClick={() => {
                handleResetCheckout();
                onCancel();
              }}
              className={`px-5 h-12 rounded-2xl text-xs font-black border ${
                isDark ? 'bg-slate-900 border-slate-700 text-slate-300' : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              {lang === 'bn' ? 'বাতিল' : 'Close'}
            </button>
          </div>
        </div>
      )}

      {/* Security Trust Footer */}
      <div className="pt-1 flex items-center justify-center gap-2 text-[10px] font-bold text-slate-400">
        <ShieldCheck size={13} className="text-[#0fb5ab]" />
        <span>
          {lang === 'bn'
            ? 'নিরাপদ ও স্বয়ংক্রিয় পেমেন্ট সিস্টেম'
            : 'Secured Automated Payment Verification'}
        </span>
      </div>
    </div>
  );
};

export default PaymentCheckout;
