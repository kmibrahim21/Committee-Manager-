import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';
import fetch from 'node-fetch';
import { getSupabaseAdmin } from '../lib/supabase-admin.js';

const MRAM_BASE_URL = 'https://msg.mram.com.bd';
const DEFAULT_SENDER_ID = '8809601017065';
const OTP_EXPIRY_MINUTES = 10;
const OTP_COOLDOWN_SECONDS = 30;

function convertBnToEnDigits(str: string): string {
  const bnDigits: Record<string, string> = {
    '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
    '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
  };
  return String(str || '').replace(/[০-৯]/g, (d) => bnDigits[d] || d);
}

function normalizePhone(phone: string): string {
  const cleaned = convertBnToEnDigits(phone).replace(/\D/g, '');
  if (cleaned.length === 13 && cleaned.startsWith('880')) {
    return `0${cleaned.slice(3)}`;
  }
  if (cleaned.length === 10 && cleaned.startsWith('1')) {
    return `0${cleaned}`;
  }
  if (cleaned.length > 11 && cleaned.startsWith('8801')) {
    return `0${cleaned.slice(3, 13)}`;
  }
  return cleaned;
}

function toInternationalBDPhone(phone01: string): string {
  const p = normalizePhone(phone01);
  if (p.length === 11 && p.startsWith('01')) return `88${p}`;
  if (p.length === 10 && p.startsWith('1')) return `880${p}`;
  return p;
}

function isValidBDMobile(phone01: string): boolean {
  return /^01[3-9]\d{8}$/.test(phone01);
}

interface MatchedAdminAccount {
  institution: any;
  userId: string;
  userEmail: string;
}

async function findAdminAccountByPhone(
  supabaseAdmin: any,
  inputPhone: string
): Promise<MatchedAdminAccount | null> {
  const normalizedInput = normalizePhone(inputPhone);
  if (normalizedInput.length < 8) return null;

  const last6 = normalizedInput.slice(-6);
  const last10 = normalizedInput.slice(-10);
  const last8 = normalizedInput.slice(-8);

  const selectCols = 'id, name, phone, email, login_code, reve_api_key, reve_secret_key, reve_caller_id, reve_client_id';

  let { data: instRows } = await supabaseAdmin
    .from('institutions')
    .select(selectCols)
    .ilike('phone', `%${last6}%`);

  if (!instRows || instRows.length === 0) {
    const { data: fallbackRows } = await supabaseAdmin
      .from('institutions')
      .select(selectCols)
      .order('created_at', { ascending: false })
      .limit(200);
    instRows = fallbackRows || [];
  }

  const matchedInst = (instRows || []).find((inst: any) => {
    const instPhone = normalizePhone(inst?.phone || '');
    if (!instPhone || instPhone.length < 8) return false;
    return (
      instPhone === normalizedInput ||
      instPhone.slice(-10) === last10 ||
      instPhone.slice(-8) === last8
    );
  });

  if (!matchedInst) return null;

  let userId = '';
  let userEmail = '';

  // Check A: public.profiles for this institution
  const { data: profRows } = await supabaseAdmin
    .from('profiles')
    .select('id, email, role')
    .or(`institution_id.eq.${matchedInst.id},id.eq.${matchedInst.id}`);

  const preferredProfile =
    (profRows || []).find((p: any) => p.role === 'institution_admin' || p.role === 'org_admin' || p.role === 'super_admin') ||
    (profRows || [])[0];

  if (preferredProfile) {
    if (preferredProfile.id) userId = preferredProfile.id;
    if (preferredProfile.email) userEmail = String(preferredProfile.email).trim().toLowerCase();
  }

  // Check B: Direct Auth lookup by institution ID or profile ID
  const idsToTry = Array.from(new Set([matchedInst.id, userId].filter(Boolean)));
  for (const uid of idsToTry) {
    try {
      const { data: authData } = await supabaseAdmin.auth.admin.getUserById(uid);
      if (authData?.user) {
        userId = authData.user.id;
        if (authData.user.email) {
          userEmail = authData.user.email.trim().toLowerCase();
        }
        break;
      }
    } catch {
      // continue to next check
    }
  }

  // Fallback email from institution record if still missing
  if (!userEmail) {
    if (matchedInst.email) {
      userEmail = String(matchedInst.email).trim().toLowerCase();
    } else if (matchedInst.login_code && String(matchedInst.login_code).includes('@')) {
      userEmail = String(matchedInst.login_code).trim().toLowerCase();
    }
  }

  // Check C: Auth listUsers scan if Auth user still not resolved
  if (!userId || !userEmail) {
    try {
      const { data: listData } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const users = listData?.users || [];
      const foundAuth = users.find((u: any) =>
        u.id === matchedInst.id ||
        (userId && u.id === userId) ||
        (userEmail && u.email?.trim().toLowerCase() === userEmail)
      );
      if (foundAuth) {
        userId = foundAuth.id;
        if (foundAuth.email) userEmail = foundAuth.email.trim().toLowerCase();
      }
    } catch {
      // ignore listUsers fallback failure
    }
  }

  if (!userId) return null;

  return {
    institution: matchedInst,
    userId,
    userEmail
  };
}

async function sendOtpSMS(
  supabaseAdmin: any,
  phone01: string,
  otp: string,
  institution: any
): Promise<void> {
  const intlPhone = toInternationalBDPhone(phone01);
  const message = `কমিটি ম্যানেজার: আপনার পাসওয়ার্ড রিসেট ওটিপি কোড হলো ${otp}। কোডটি ${OTP_EXPIRY_MINUTES} মিনিটের জন্য প্রযোজ্য।`;

  const { data: sysSettings } = await supabaseAdmin
    .from('system_settings')
    .select('*')
    .eq('id', 1)
    .maybeSingle();

  const errors: string[] = [];

  // 1. Automas Non-Masking (if configured)
  const automasKey = (
    process.env.AUTOMAS_API_KEY ||
    sysSettings?.automas_api_key ||
    ''
  ).trim();
  if (automasKey) {
    try {
      const automasSender = (
        process.env.AUTOMAS_SENDER_ID ||
        sysSettings?.automas_sender_id ||
        DEFAULT_SENDER_ID
      ).trim();
      const automasUrl = `https://api.automas.com.bd/smsapiv3?api_key=${encodeURIComponent(automasKey)}&type=unicode&contacts=${encodeURIComponent(intlPhone)}&senderid=${encodeURIComponent(automasSender)}&msg=${encodeURIComponent(message)}&smsformat=8`;
      const gwRes = await fetch(automasUrl, { method: 'GET' });
      const resText = await gwRes.text();
      if (gwRes.ok && !/error|invalid|failed/i.test(resText)) {
        return;
      }
      errors.push(`Automas HTTP ${gwRes.status}: ${resText.slice(0, 120)}`);
    } catch (err: any) {
      errors.push(`Automas error: ${err?.message || 'failed'}`);
    }
  }

  // 2. MRAM SMS Gateway (primary Committee Manager gateway)
  const mramKey = (
    process.env.MRAM_API_KEY ||
    process.env.SMS_API_KEY ||
    sysSettings?.reve_api_key ||
    institution?.reve_api_key ||
    ''
  ).trim();
  if (mramKey) {
    try {
      const mramSender = (
        sysSettings?.reve_caller_id ||
        institution?.reve_caller_id ||
        institution?.reve_client_id ||
        process.env.MRAM_SENDER_ID ||
        DEFAULT_SENDER_ID
      ).trim();
      const mramUrl = `${MRAM_BASE_URL}/smsapi?api_key=${encodeURIComponent(mramKey)}&type=unicode&contacts=${encodeURIComponent(intlPhone)}&senderid=${encodeURIComponent(mramSender)}&msg=${encodeURIComponent(message)}&label=transactional`;
      const gwRes = await fetch(mramUrl, { method: 'GET' });
      const resText = await gwRes.text();
      if (gwRes.ok && !/invalid\s*api|unauthorized|error\s*code/i.test(resText)) {
        return;
      }
      errors.push(`MRAM HTTP ${gwRes.status}: ${resText.slice(0, 120)}`);
    } catch (err: any) {
      errors.push(`MRAM error: ${err?.message || 'failed'}`);
    }
  }

  // 3. REVE SMS Gateway fallback (if both API key and secret key exist)
  const reveKey = (
    process.env.REVE_API_KEY ||
    sysSettings?.reve_api_key ||
    institution?.reve_api_key ||
    ''
  ).trim();
  const reveSecret = (
    process.env.REVE_SECRET_KEY ||
    sysSettings?.reve_secret_key ||
    institution?.reve_secret_key ||
    ''
  ).trim();
  if (reveKey && reveSecret) {
    try {
      const callerId = (
        sysSettings?.reve_caller_id ||
        institution?.reve_caller_id ||
        process.env.REVE_CALLER_ID ||
        DEFAULT_SENDER_ID
      ).trim();
      const reveUrl = `https://smpp.ajuratech.com:7790/sendtext?apikey=${encodeURIComponent(reveKey)}&secretkey=${encodeURIComponent(reveSecret)}&callerID=${encodeURIComponent(callerId)}&toUser=${encodeURIComponent(intlPhone)}&messageContent=${encodeURIComponent(message)}`;
      const gwRes = await fetch(reveUrl, { method: 'GET' });
      if (gwRes.ok) {
        return;
      }
      errors.push(`REVE HTTP ${gwRes.status}`);
    } catch (err: any) {
      errors.push(`REVE error: ${err?.message || 'failed'}`);
    }
  }

  if (errors.length === 0) {
    throw new Error('এসএমএস গেটওয়ে কনফিগার করা নেই। অনুগ্রহ করে সুপার অ্যাডমিনের সাথে যোগাযোগ করুন।');
  }
  throw new Error(`ওটিপি এসএমএস পাঠানো যায়নি (${errors.join('; ')})`);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  let body: any = req.body || {};
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }

  const action = String(body?.action || '').trim();
  if (!action) {
    return res.status(400).json({ error: 'Action is required' });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();

    if (action === 'request-otp') {
      const normalizedPhone = normalizePhone(body?.phone || '');
      if (!isValidBDMobile(normalizedPhone)) {
        return res.status(400).json({
          error: 'অনুগ্রহ করে সঠিক ১১ ডিজিটের মোবাইল নম্বর দিন (যেমন: 017XXXXXXXX)।'
        });
      }

      const account = await findAdminAccountByPhone(supabaseAdmin, normalizedPhone);
      if (!account) {
        return res.status(404).json({
          error: 'এই মোবাইল নম্বরের বিপরীতে কোনো অ্যাডমিন অ্যাকাউন্ট পাওয়া যায়নি।'
        });
      }

      // 30-second cooldown rate limit per identifier
      const { data: recentOtp } = await supabaseAdmin
        .from('otp_verifications')
        .select('id, created_at')
        .eq('identifier', normalizedPhone)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (recentOtp?.created_at) {
        const elapsedSec = (Date.now() - new Date(recentOtp.created_at).getTime()) / 1000;
        if (elapsedSec < OTP_COOLDOWN_SECONDS) {
          const waitSec = Math.max(1, Math.ceil(OTP_COOLDOWN_SECONDS - elapsedSec));
          return res.status(429).json({
            error: `অনুগ্রহ করে পুনরায় ওটিপি পাঠানোর আগে ${waitSec} সেকেন্ড অপেক্ষা করুন।`
          });
        }
      }

      const otp = crypto.randomInt(100000, 1000000).toString();
      const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000).toISOString();

      // Invalidate previous unverified OTPs for this identifier
      await supabaseAdmin
        .from('otp_verifications')
        .delete()
        .eq('identifier', normalizedPhone)
        .is('verified_at', null);

      const { data: insertedOtp, error: insertErr } = await supabaseAdmin
        .from('otp_verifications')
        .insert({
          identifier: normalizedPhone,
          otp,
          expires_at: expiresAt
        })
        .select('id')
        .single();

      if (insertErr) {
        console.error('OTP insert error:', insertErr);
        return res.status(500).json({ error: 'ওটিপি সংরক্ষণ করতে সমস্যা হয়েছে।' });
      }

      try {
        await sendOtpSMS(supabaseAdmin, normalizedPhone, otp, account.institution);
      } catch (smsErr: any) {
        if (insertedOtp?.id) {
          await supabaseAdmin.from('otp_verifications').delete().eq('id', insertedOtp.id);
        }
        return res.status(502).json({
          error: smsErr?.message || 'ওটিপি এসএমএস পাঠানো ব্যর্থ হয়েছে।'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'আপনার মোবাইল নম্বরে ৬ ডিজিটের ওটিপি কোড পাঠানো হয়েছে।'
      });
    }

    if (action === 'verify-otp') {
      const normalizedPhone = normalizePhone(body?.phone || '');
      const cleanOtp = convertBnToEnDigits(String(body?.otp || '')).replace(/\D/g, '').trim();

      if (!isValidBDMobile(normalizedPhone)) {
        return res.status(400).json({ error: 'সঠিক মোবাইল নম্বর প্রদান করুন।' });
      }
      if (cleanOtp.length !== 6) {
        return res.status(400).json({ error: '৬ ডিজিটের সঠিক ওটিপি কোড প্রদান করুন।' });
      }

      const { data: otpRow, error: otpErr } = await supabaseAdmin
        .from('otp_verifications')
        .select('id, otp, expires_at, verified_at')
        .eq('identifier', normalizedPhone)
        .eq('otp', cleanOtp)
        .is('verified_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (otpErr || !otpRow) {
        return res.status(400).json({ error: 'ভুল অথবা মেয়াদোত্তীর্ণ ওটিপি কোড।' });
      }

      return res.status(200).json({
        success: true,
        message: 'ওটিপি সফলভাবে যাচাই হয়েছে। এবার নতুন পাসওয়ার্ড দিন।'
      });
    }

    if (action === 'verify-otp-reset') {
      const normalizedPhone = normalizePhone(body?.phone || '');
      const cleanOtp = convertBnToEnDigits(String(body?.otp || '')).replace(/\D/g, '').trim();
      const newPassword = typeof body?.newPassword === 'string' ? body.newPassword.trim() : '';

      if (!isValidBDMobile(normalizedPhone)) {
        return res.status(400).json({ error: 'সঠিক মোবাইল নম্বর প্রদান করুন।' });
      }
      if (cleanOtp.length !== 6) {
        return res.status(400).json({ error: '৬ ডিজিটের সঠিক ওটিপি কোড প্রদান করুন।' });
      }
      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'নতুন পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।' });
      }

      const { data: otpRow, error: otpErr } = await supabaseAdmin
        .from('otp_verifications')
        .select('id, otp, expires_at, verified_at')
        .eq('identifier', normalizedPhone)
        .eq('otp', cleanOtp)
        .is('verified_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (otpErr || !otpRow) {
        return res.status(400).json({ error: 'ভুল অথবা মেয়াদোত্তীর্ণ ওটিপি কোড।' });
      }

      const account = await findAdminAccountByPhone(supabaseAdmin, normalizedPhone);
      if (!account || !account.userId) {
        return res.status(404).json({ error: 'সংশ্লিষ্ট অ্যাডমিন অ্যাকাউন্ট খুঁজে পাওয়া যায়নি।' });
      }

      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(account.userId, {
        password: newPassword,
        email_confirm: true
      });

      if (updateErr) {
        console.error('Password reset updateUserById error:', updateErr);
        return res.status(500).json({ error: updateErr.message || 'পাসওয়ার্ড আপডেট করতে সমস্যা হয়েছে।' });
      }

      try {
        await supabaseAdmin.rpc('update_user_by_admin', {
          p_user_id: account.userId,
          p_password: newPassword
        });
      } catch {
        // Optional secondary sync
      }

      // Mark OTP as verified/consumed
      await supabaseAdmin
        .from('otp_verifications')
        .update({ verified_at: new Date().toISOString() })
        .eq('identifier', normalizedPhone)
        .is('verified_at', null);

      return res.status(200).json({
        success: true,
        adminEmail: account.userEmail || '',
        message: 'পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে!'
      });
    }

    if (action === 'admin-login') {
      const email = String(body?.email || '').trim();
      const password = typeof body?.password === 'string'
        ? (body.password !== body.password.trim() ? body.password.trim() : body.password)
        : '';

      if (!email || !password) {
        return res.status(400).json({ error: 'ইমেইল এবং পাসওয়ার্ড উভয়ই প্রয়োজন।' });
      }

      const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '';
      const supabaseKey =
        process.env.VITE_SUPABASE_ANON_KEY ||
        process.env.SUPABASE_ANON_KEY ||
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
        process.env.SERVICE_ROLE_KEY ||
        '';

      const isolatedClient = createClient(supabaseUrl, supabaseKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      });

      const { data, error: signInError } = await isolatedClient.auth.signInWithPassword({
        email,
        password
      });

      if (signInError || !data?.session) {
        return res.status(401).json({
          error: signInError?.message || 'ইমেইল অথবা পাসওয়ার্ড সঠিক নয়।'
        });
      }

      return res.status(200).json({
        success: true,
        session: data.session,
        user: data.user
      });
    }

    return res.status(400).json({ error: `Unsupported action: ${action}` });
  } catch (err: any) {
    console.error('Auth API error:', err);
    return res.status(500).json({ error: err?.message || 'Authentication request failed' });
  }
}
