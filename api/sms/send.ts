import type { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';
import { getSupabaseAdmin } from '../../lib/supabase-admin.js';

const MRAM_BASE_URL = 'https://msg.mram.com.bd';
const AUTOMAS_BASE_URL = 'https://api.automas.com.bd/smsapiv3';
const REVE_BASE_URL = 'https://smpp.revesms.com:7790/sendtext';
const DEFAULT_SENDER_ID = '8809601017065';

const BN_TO_EN_DIGITS: Record<string, string> = {
  '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
  '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
};

function formatBangladeshPhone(phone: string): string {
  const p = String(phone || '')
    .replace(/[০-৯]/g, (d) => BN_TO_EN_DIGITS[d] ?? d)
    .replace(/\D/g, '');
  if (p.length === 13 && p.startsWith('8801')) return p;
  if (p.length === 14 && p.startsWith('008801')) return p.slice(2);
  if (p.startsWith('01') && p.length === 11) return `88${p}`;
  if (p.startsWith('1') && p.length === 10) return `880${p}`;
  if (p.startsWith('8801') && p.length >= 13) return p.slice(0, 13);
  return p;
}

function isUnicodeText(text: string): boolean {
  return /[^\x00-\x7F]/.test(text);
}

function formatAutomasSender(rawSender: string): string {
  const s = String(rawSender || '').trim();
  if (!s) return '';
  if (/^0961\d+/.test(s)) return `88${s}`;
  return s;
}

function parseJsonSafe(raw: unknown): Record<string, any> {
  if (!raw) return {};
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return typeof raw === 'object' ? (raw as Record<string, any>) : {};
}

interface GatewayCredentials {
  finalType: 'masking' | 'non_masking';
  reveApiKey: string;
  reveSecretKey: string;
  reveMaskingCallerId: string;
  reveNonMaskingCallerId: string;
  automasApiKey: string;
  automasMaskingSenderId: string;
  automasNonMaskingSenderId: string;
  mramApiKey: string;
  mramSenderId: string;
}

function resolveGatewayCredentials(targetInst: any, sysSettings: any): GatewayCredentials {
  const instConfig = parseJsonSafe(targetInst?.config_json);
  const providerConfig = parseJsonSafe(sysSettings?.sms_provider_config);
  const reveCfg = parseJsonSafe(providerConfig.reve);
  const automasCfg = parseJsonSafe(providerConfig.automas);

  const instMaskingId = String(targetInst?.reve_client_id || '').trim();
  const explicitType = targetInst?.sms_type || instConfig?.sms_type;
  const defaultType = providerConfig?.default_type === 'masking' ? 'masking' : 'non_masking';

  const finalType: 'masking' | 'non_masking' =
    Boolean(instMaskingId) || explicitType === 'masking'
      ? 'masking'
      : explicitType === 'non_masking'
        ? 'non_masking'
        : defaultType;

  const reveApiKey = String(
    targetInst?.reve_api_key ||
    sysSettings?.reve_api_key ||
    reveCfg.api_key ||
    process.env.REVE_API_KEY ||
    ''
  ).trim();

  const reveSecretKey = String(
    targetInst?.reve_secret_key ||
    sysSettings?.reve_secret_key ||
    reveCfg.secret_key ||
    process.env.REVE_SECRET_KEY ||
    ''
  ).trim();

  const sysMaskingId = String(
    sysSettings?.reve_client_id ||
    reveCfg.client_id ||
    process.env.REVE_CLIENT_ID ||
    ''
  ).trim();

  const reveCallerId = String(
    targetInst?.reve_caller_id ||
    sysSettings?.reve_caller_id ||
    reveCfg.caller_id ||
    process.env.REVE_CALLER_ID ||
    ''
  ).trim();

  const reveNonMaskingId = String(
    sysSettings?.reve_non_masking_id ||
    reveCfg.non_masking_id ||
    reveCallerId ||
    process.env.REVE_NON_MASKING_ID ||
    ''
  ).trim();

  const automasApiKey = String(
    sysSettings?.automas_api_key ||
    automasCfg.api_key ||
    process.env.AUTOMAS_API_KEY ||
    ''
  ).trim();

  const automasMaskingSenderId = String(
    sysSettings?.automas_masking_sender_id ||
    automasCfg.masking_sender_id ||
    process.env.AUTOMAS_MASKING_SENDER_ID ||
    ''
  ).trim();

  const automasNonMaskingSenderId = formatAutomasSender(
    String(
      sysSettings?.automas_non_masking_sender_id ||
      automasCfg.non_masking_sender_id ||
      process.env.AUTOMAS_SENDER_ID ||
      DEFAULT_SENDER_ID
    ).trim()
  );

  const mramApiKey = String(
    process.env.MRAM_API_KEY ||
    process.env.SMS_API_KEY ||
    ''
  ).trim();

  const mramSenderId = String(
    targetInst?.reve_caller_id ||
    sysSettings?.reve_caller_id ||
    process.env.MRAM_SENDER_ID ||
    DEFAULT_SENDER_ID
  ).trim();

  return {
    finalType,
    reveApiKey,
    reveSecretKey,
    reveMaskingCallerId: instMaskingId || sysMaskingId || reveCallerId,
    reveNonMaskingCallerId: reveNonMaskingId || reveCallerId,
    automasApiKey,
    automasMaskingSenderId: instMaskingId || automasMaskingSenderId,
    automasNonMaskingSenderId,
    mramApiKey,
    mramSenderId
  };
}

function hasAnyGatewayConfigured(creds: GatewayCredentials): boolean {
  const hasAutomas = Boolean(creds.automasApiKey);
  const hasReve = Boolean(creds.reveApiKey && creds.reveSecretKey && (creds.reveMaskingCallerId || creds.reveNonMaskingCallerId));
  const hasMram = Boolean(creds.mramApiKey || creds.reveApiKey);
  return hasAutomas || hasReve || hasMram;
}

async function sendViaAutomas(apiKey: string, sender: string, recipients: string[], messageText: string) {
  const unicode = isUnicodeText(messageText);
  const typeParam = unicode ? 'unicode' : 'text';
  const formatParam = unicode ? '&smsformat=8' : '';
  const msisdn = recipients.join(',');
  const cleanSender = formatAutomasSender(sender || DEFAULT_SENDER_ID);

  const url = `${AUTOMAS_BASE_URL}?apikey=${encodeURIComponent(apiKey)}&sender=${encodeURIComponent(cleanSender)}&msisdn=${encodeURIComponent(msisdn)}&smstext=${encodeURIComponent(messageText)}&type=${typeParam}${formatParam}`;
  const gwRes = await fetch(url, { method: 'GET' });
  const rawBody = await gwRes.text();

  if (!gwRes.ok) {
    throw new Error(`Automas HTTP ${gwRes.status}: ${rawBody.slice(0, 140)}`);
  }

  let parsed: any = null;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    parsed = null;
  }

  if (parsed && (parsed.error || parsed.status === 'error' || parsed.status === false)) {
    throw new Error(`Automas error: ${parsed.message || parsed.error || rawBody.slice(0, 140)}`);
  }
  if (!parsed && /\b(error|invalid|failed|unauthorized)\b/i.test(rawBody)) {
    throw new Error(`Automas error: ${rawBody.slice(0, 140)}`);
  }

  return { provider: 'automas', response: parsed || rawBody };
}

async function sendViaReve(apiKey: string, secretKey: string, callerId: string, recipients: string[], messageText: string) {
  const toUser = recipients.join(',');
  const url = `${REVE_BASE_URL}?apikey=${encodeURIComponent(apiKey)}&secretkey=${encodeURIComponent(secretKey)}&callerID=${encodeURIComponent(callerId)}&toUser=${encodeURIComponent(toUser)}&messageContent=${encodeURIComponent(messageText)}&type=3`;
  const gwRes = await fetch(url, { method: 'GET' });
  const rawBody = await gwRes.text();

  if (!gwRes.ok) {
    throw new Error(`REVE HTTP ${gwRes.status}: ${rawBody.slice(0, 140)}`);
  }

  let parsed: any = null;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    parsed = null;
  }

  if (parsed && parsed.Status !== undefined && String(parsed.Status) !== '0') {
    throw new Error(`REVE error (${parsed.Status}): ${parsed.Text || parsed.Message || rawBody.slice(0, 140)}`);
  }
  if (!parsed && /\b(error|invalid|failed|unauthorized)\b/i.test(rawBody)) {
    throw new Error(`REVE error: ${rawBody.slice(0, 140)}`);
  }

  return { provider: 'reve', response: parsed || rawBody };
}

async function sendViaMram(apiKey: string, senderId: string, recipients: string[], messageText: string) {
  const smsType = isUnicodeText(messageText) ? 'unicode' : 'text';
  const contacts = recipients.join('+');
  const url = `${MRAM_BASE_URL}/smsapi?api_key=${encodeURIComponent(apiKey)}&type=${smsType}&contacts=${contacts}&senderid=${encodeURIComponent(senderId)}&msg=${encodeURIComponent(messageText)}&label=transactional`;
  const gwRes = await fetch(url, { method: 'GET' });
  const rawBody = await gwRes.text();

  if (!gwRes.ok) {
    throw new Error(`MRAM HTTP ${gwRes.status}: ${rawBody.slice(0, 140)}`);
  }
  if (/invalid\s*api|unauthorized|error\s*code/i.test(rawBody)) {
    throw new Error(`MRAM error: ${rawBody.slice(0, 140)}`);
  }

  return { provider: 'mram', response: rawBody };
}

async function dispatchSmsChunk(creds: GatewayCredentials, recipients: string[], messageText: string) {
  const errors: string[] = [];

  if (creds.finalType === 'masking') {
    // 1. Primary for Masking: REVE SMS
    if (creds.reveApiKey && creds.reveSecretKey && creds.reveMaskingCallerId) {
      try {
        return await sendViaReve(
          creds.reveApiKey,
          creds.reveSecretKey,
          creds.reveMaskingCallerId,
          recipients,
          messageText
        );
      } catch (err: any) {
        errors.push(err?.message || 'REVE masking failed');
      }
    }

    // 2. Fallback for Masking: Automas (if masking sender configured)
    if (creds.automasApiKey && creds.automasMaskingSenderId) {
      try {
        return await sendViaAutomas(
          creds.automasApiKey,
          creds.automasMaskingSenderId,
          recipients,
          messageText
        );
      } catch (err: any) {
        errors.push(err?.message || 'Automas masking fallback failed');
      }
    }

    // 3. Secondary Fallback: MRAM / non-masking Automas
    if (creds.mramApiKey) {
      try {
        return await sendViaMram(
          creds.mramApiKey,
          creds.reveMaskingCallerId || creds.mramSenderId,
          recipients,
          messageText
        );
      } catch (err: any) {
        errors.push(err?.message || 'MRAM fallback failed');
      }
    }
  } else {
    // 1. Primary for Non-Masking: Automas
    if (creds.automasApiKey) {
      try {
        return await sendViaAutomas(
          creds.automasApiKey,
          creds.automasNonMaskingSenderId,
          recipients,
          messageText
        );
      } catch (err: any) {
        errors.push(err?.message || 'Automas non-masking failed');
      }
    }

    // 2. Fallback 1 for Non-Masking: REVE SMS (non-masking ID or caller ID)
    if (creds.reveApiKey && creds.reveSecretKey && creds.reveNonMaskingCallerId) {
      try {
        return await sendViaReve(
          creds.reveApiKey,
          creds.reveSecretKey,
          creds.reveNonMaskingCallerId,
          recipients,
          messageText
        );
      } catch (err: any) {
        errors.push(err?.message || 'REVE non-masking fallback failed');
      }
    }

    // 3. Fallback 2 for Non-Masking: MRAM (env MRAM_API_KEY or single reveApiKey without secretKey)
    const fallbackMramKey = creds.mramApiKey || (!creds.reveSecretKey ? creds.reveApiKey : '');
    if (fallbackMramKey) {
      try {
        return await sendViaMram(
          fallbackMramKey,
          creds.mramSenderId,
          recipients,
          messageText
        );
      } catch (err: any) {
        errors.push(err?.message || 'MRAM fallback failed');
      }
    }
  }

  throw new Error(
    errors.length > 0
      ? `SMS Gateway error: ${errors.join(' | ')}`
      : 'SMS Gateway credentials are not configured on the server or system settings.'
  );
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

  const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
  const token = (typeof authHeader === 'string' && authHeader.startsWith('Bearer '))
    ? authHeader.slice(7).trim()
    : (body.auth_token ? String(body.auth_token).trim() : '');

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Missing authentication token' });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired authentication token' });
    }

    const {
      institution_id,
      student_ids,
      member_ids,
      phones,
      personalized_messages,
      message,
      mode = 'bulk'
    } = body;

    if (!message || !String(message).trim()) {
      return res.status(400).json({ error: 'Message content is required' });
    }

    const [{ data: profile }, { data: callerInst }, { data: sysSettings }] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select('role, institution_id')
        .eq('id', user.id)
        .maybeSingle(),
      supabaseAdmin
        .from('institutions')
        .select('*')
        .eq('id', user.id)
        .maybeSingle(),
      supabaseAdmin
        .from('system_settings')
        .select('*')
        .order('id', { ascending: true })
        .limit(1)
        .maybeSingle()
    ]);

    const isSuperAdmin =
      profile?.role === 'super_admin' ||
      profile?.role === 'manager' ||
      callerInst?.is_super_admin === true;

    const targetInstId = institution_id || profile?.institution_id || callerInst?.id || null;

    if (mode !== 'direct' && !targetInstId) {
      return res.status(400).json({ error: 'institution_id is required for bulk SMS' });
    }

    if (
      targetInstId &&
      !isSuperAdmin &&
      user.id !== targetInstId &&
      profile?.institution_id !== targetInstId
    ) {
      return res.status(403).json({ error: 'Forbidden: You do not belong to this institution' });
    }

    let targetInst: any = callerInst?.id === targetInstId ? callerInst : null;
    if (targetInstId && !targetInst) {
      const { data } = await supabaseAdmin
        .from('institutions')
        .select('*')
        .eq('id', targetInstId)
        .maybeSingle();
      targetInst = data;
    }

    const creds = resolveGatewayCredentials(targetInst, sysSettings);
    if (!hasAnyGatewayConfigured(creds)) {
      return res.status(500).json({
        error: 'SMS Gateway API key is not configured on system settings or server environment.'
      });
    }

    const targetMemberIds: string[] = Array.isArray(student_ids)
      ? student_ids
      : Array.isArray(member_ids)
        ? member_ids
        : [];

    if (mode === 'direct') {
      if (!isSuperAdmin && !targetInstId) {
        return res.status(403).json({ error: 'Forbidden: Direct SMS requires authorized institution or Super Admin' });
      }
      const rawPhones: string[] = Array.isArray(phones)
        ? phones
        : String(phones || '')
            .split(/[\s,;]+/)
            .filter(Boolean);
      const validPhones = Array.from(
        new Set(rawPhones.map(formatBangladeshPhone).filter(p => p.length >= 13))
      );
      if (validPhones.length === 0) {
        return res.status(400).json({ error: 'No valid recipient phone numbers provided' });
      }
      const result = await dispatchSmsChunk(creds, validPhones, String(message).trim());
      return res.status(200).json({ success: true, provider: result.provider, sms_type: creds.finalType });
    }

    if (targetMemberIds.length === 0) {
      return res.status(400).json({ error: 'At least one recipient member is required' });
    }

    // Deduct SMS balance via send_bulk_sms_rpc
    const { data: rpcResult, error: rpcError } = await supabaseAdmin.rpc('send_bulk_sms_rpc', {
      p_institution_id: targetInstId,
      p_student_ids: targetMemberIds,
      p_message: String(message).trim()
    });

    if (rpcError) {
      const smsCount = targetMemberIds.length;
      const currentBalance = Number(targetInst?.sms_balance || 0);
      if (currentBalance < smsCount) {
        return res.status(400).json({ error: `ব্যালেন্স পর্যাপ্ত নয়। প্রয়োজন: ${smsCount}, আছে: ${currentBalance}` });
      }
      await supabaseAdmin
        .from('institutions')
        .update({ sms_balance: currentBalance - smsCount })
        .eq('id', targetInstId);

      await supabaseAdmin.from('transactions').insert({
        institution_id: targetInstId,
        amount: 0,
        transaction_id: `BULK_SMS_${Math.floor(Date.now() / 1000)}`,
        sender_phone: 'SYSTEM',
        description: `Sent ${smsCount} SMS messages (${creds.finalType})`,
        type: 'debit',
        status: 'approved',
        sms_count: smsCount
      });
    } else if (rpcResult && rpcResult.success === false) {
      return res.status(400).json({ error: rpcResult.error || 'SMS balance deduction failed' });
    }

    if (Array.isArray(personalized_messages) && personalized_messages.length > 0) {
      let lastProvider = '';
      for (const item of personalized_messages) {
        const cleanPhone = formatBangladeshPhone(item.phone);
        if (cleanPhone.length < 13) continue;
        const msgText = String(item.text || message).trim();
        const result = await dispatchSmsChunk(creds, [cleanPhone], msgText);
        lastProvider = result.provider;
      }
      return res.status(200).json({ success: true, provider: lastProvider, sms_type: creds.finalType });
    }

    let phoneList: string[] = [];
    if (Array.isArray(phones) && phones.length > 0) {
      phoneList = phones;
    } else {
      const uniqueIds = Array.from(new Set(targetMemberIds));
      const { data: members } = await supabaseAdmin
        .from('members')
        .select('phone')
        .eq('institution_id', targetInstId)
        .in('id', uniqueIds);
      phoneList = (members || []).map((m: any) => m.phone).filter(Boolean);
    }

    const validPhones = Array.from(
      new Set(phoneList.map(formatBangladeshPhone).filter(p => p.length >= 13))
    );

    if (validPhones.length === 0) {
      return res.status(400).json({ error: 'No valid phone numbers found for selected members' });
    }

    const chunkSize = 50;
    let lastProvider = '';
    for (let i = 0; i < validPhones.length; i += chunkSize) {
      const chunk = validPhones.slice(i, i + chunkSize);
      const result = await dispatchSmsChunk(creds, chunk, String(message).trim());
      lastProvider = result.provider;
    }

    return res.status(200).json({ success: true, provider: lastProvider, sms_type: creds.finalType });
  } catch (err: any) {
    console.error('SMS send API error:', err);
    return res.status(500).json({ error: err?.message || 'Failed to send SMS' });
  }
}
