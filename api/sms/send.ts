import type { VercelRequest, VercelResponse } from '@vercel/node';
import https from 'node:https';
import fetch from 'node-fetch';
import { getSupabaseAdmin } from '../../lib/supabase-admin.js';

const MRAM_BASE_URL = 'https://msg.mram.com.bd';
const AUTOMAS_BASE_URL = 'https://api.automas.com.bd/smsapiv3';
const REVE_BASE_URL = 'https://smpp.revesms.com:7790/sendtext';
const DEFAULT_MRAM_SENDER_ID = '8809601017065';

const reveHttpsAgent = new https.Agent({ rejectUnauthorized: false });

const BN_TO_EN_DIGITS: Record<string, string> = {
  '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
  '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
};

const AUTOMAS_ERROR_MAP: Record<string, string> = {
  '101': 'বার্তা অনেক লম্বা বা খালি (Code 101)',
  '102': 'Sender ID অনুমোদিত নয় (Code 102)',
  '103': 'Authentication ত্রুটি - API Key সঠিক নয় (Code 103)',
  '104': 'Invalid User (Code 104)',
  '105': 'মোবাইল নম্বর সঠিক নয় (Code 105)',
  '106': 'সার্ভারে পর্যাপ্ত ব্যালেন্স নেই (Code 106)',
  '107': 'Sender ID দেওয়া হয়নি (Code 107)',
  '110': 'গেটওয়ে অনুমোদিত নয় (Code 110)',
  '111': 'এসএমএস টাইপ সঠিক নয় (Code 111)',
  '1000': 'অজানা সার্ভার ত্রুটি (Code 1000)'
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

function countSmsParts(text: string): number {
  const len = String(text || '').length;
  if (len === 0) return 0;
  if (isUnicodeText(text)) {
    return len <= 70 ? 1 : Math.ceil(len / 67);
  }
  return len <= 160 ? 1 : Math.ceil(len / 153);
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

function httpsGet(url: string, timeoutMs = 12000): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { agent: reveHttpsAgent }, (resp) => {
      let data = '';
      resp.setEncoding('utf8');
      resp.on('data', (chunk) => {
        data += chunk;
      });
      resp.on('end', () => {
        resolve({ statusCode: resp.statusCode || 200, body: data });
      });
    });

    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`REVE request timeout after ${timeoutMs / 1000}s`));
    });

    req.on('error', (err) => {
      reject(err);
    });
  });
}

function mapAutomasError(codeVal: unknown, fallbackText?: string): string {
  const key = String(codeVal ?? '').trim();
  if (key && AUTOMAS_ERROR_MAP[key]) {
    return AUTOMAS_ERROR_MAP[key];
  }
  return fallbackText || `Automas error (code: ${key || 'unknown'})`;
}

function parseAutomasResponse(rawBody: string): { providerMessageId: string; raw: any } {
  const trimmed = String(rawBody || '').trim();
  let parsed: any = null;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    parsed = null;
  }

  if (!parsed || typeof parsed !== 'object') {
    if (/\b(error|invalid|failed|unauthorized|insufficient)\b/i.test(trimmed) || !trimmed) {
      throw new Error(`Automas error: ${trimmed ? trimmed.slice(0, 140) : 'Empty response'}`);
    }
    return { providerMessageId: '', raw: trimmed };
  }

  if (parsed.error && typeof parsed.error === 'string') {
    throw new Error(`Automas error: ${parsed.error}`);
  }

  if (Array.isArray(parsed.response)) {
    const first = parsed.response[0];
    if (!first || typeof first !== 'object') {
      throw new Error(`Automas error: ${trimmed.slice(0, 140)}`);
    }
    const st = Number(first.status);
    if (!Number.isNaN(st) && st === 0) {
      return {
        providerMessageId: String(first.message_id || first.id || first.trxid || ''),
        raw: parsed
      };
    }
    throw new Error(mapAutomasError(first.status, first.message || first.error || trimmed.slice(0, 140)));
  }

  if (parsed.response !== undefined && parsed.response !== null) {
    const respStr = String(parsed.response).trim().toLowerCase();
    const respNum = Number(parsed.response);
    if ((!Number.isNaN(respNum) && respNum === 0) || respStr === 'success' || respStr === 'submitted') {
      return {
        providerMessageId: String(parsed.message_id || parsed.id || ''),
        raw: parsed
      };
    }
    throw new Error(mapAutomasError(parsed.response, parsed.message || parsed.error || trimmed.slice(0, 140)));
  }

  if (parsed.status !== undefined || parsed.response_code !== undefined) {
    const code = parsed.status !== undefined ? parsed.status : parsed.response_code;
    const codeStr = String(code).trim().toLowerCase();
    const codeNum = Number(code);
    if (
      (!Number.isNaN(codeNum) && (codeNum === 0 || codeNum === 200 || codeNum === 202)) ||
      codeStr === 'success' ||
      codeStr === 'submitted'
    ) {
      return {
        providerMessageId: String(parsed.message_id || parsed.id || ''),
        raw: parsed
      };
    }
    throw new Error(mapAutomasError(code, parsed.message || parsed.error || trimmed.slice(0, 140)));
  }

  if (parsed.status === false || parsed.status === 'error') {
    throw new Error(`Automas error: ${parsed.message || parsed.error || trimmed.slice(0, 140)}`);
  }

  return {
    providerMessageId: String(parsed.message_id || parsed.id || ''),
    raw: parsed
  };
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

  // Strictly NO DEFAULT_SENDER_ID fallback for Automas Non-Masking
  const automasNonMaskingSenderId = formatAutomasSender(
    String(
      sysSettings?.automas_non_masking_sender_id ||
      automasCfg.non_masking_sender_id ||
      sysSettings?.automas_sender_id ||
      process.env.AUTOMAS_SENDER_ID ||
      ''
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
    DEFAULT_MRAM_SENDER_ID
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
  const hasMram = Boolean(creds.mramApiKey);
  return hasAutomas || hasReve || hasMram;
}

async function sendViaAutomas(apiKey: string, sender: string, recipient: string, messageText: string) {
  const cleanSender = formatAutomasSender(sender);
  if (!cleanSender) {
    throw new Error('Automas Non-Masking Sender ID সেট করা নেই');
  }

  const unicode = isUnicodeText(messageText);
  const typeParam = unicode ? 'unicode' : 'text';
  const formatParam = unicode ? '&smsformat=8' : '';

  const url = `${AUTOMAS_BASE_URL}?apikey=${encodeURIComponent(apiKey)}&sender=${encodeURIComponent(cleanSender)}&msisdn=${encodeURIComponent(recipient)}&smstext=${encodeURIComponent(messageText)}&type=${typeParam}${formatParam}`;
  const gwRes = await fetch(url, { method: 'GET' });
  const rawBody = await gwRes.text();

  if (!gwRes.ok) {
    throw new Error(`Automas HTTP ${gwRes.status}: ${rawBody.slice(0, 140)}`);
  }

  const parsedResult = parseAutomasResponse(rawBody);
  return {
    provider: 'automas',
    providerMessageId: parsedResult.providerMessageId,
    response: parsedResult.raw
  };
}

async function sendViaReve(apiKey: string, secretKey: string, callerId: string, recipient: string, messageText: string) {
  const url = `${REVE_BASE_URL}?apikey=${encodeURIComponent(apiKey)}&secretkey=${encodeURIComponent(secretKey)}&callerID=${encodeURIComponent(callerId)}&toUser=${encodeURIComponent(recipient)}&messageContent=${encodeURIComponent(messageText)}&type=3`;
  const gwRes = await httpsGet(url, 12000);
  const rawBody = gwRes.body;

  if (gwRes.statusCode < 200 || gwRes.statusCode >= 300) {
    throw new Error(`REVE HTTP ${gwRes.statusCode}: ${rawBody.slice(0, 140)}`);
  }

  let parsed: any = null;
  try {
    parsed = JSON.parse(rawBody);
  } catch {
    parsed = null;
  }

  if (parsed && typeof parsed === 'object') {
    const isOk =
      String(parsed.Status) === '0' ||
      parsed.Status === 0 ||
      Boolean(parsed.Message_ID || parsed.message_id);
    if (!isOk) {
      throw new Error(`REVE error (${parsed.Status ?? 'unknown'}): ${parsed.Text || parsed.Message || rawBody.slice(0, 140)}`);
    }
    return {
      provider: 'reve',
      providerMessageId: String(parsed.Message_ID || parsed.message_id || ''),
      response: parsed
    };
  }

  if (/\b(error|invalid|failed|unauthorized)\b/i.test(rawBody)) {
    throw new Error(`REVE error: ${rawBody.slice(0, 140)}`);
  }

  return { provider: 'reve', providerMessageId: '', response: rawBody };
}

async function sendViaMram(apiKey: string, senderId: string, recipient: string, messageText: string) {
  const smsType = isUnicodeText(messageText) ? 'unicode' : 'text';
  const url = `${MRAM_BASE_URL}/smsapi?api_key=${encodeURIComponent(apiKey)}&type=${smsType}&contacts=${encodeURIComponent(recipient)}&senderid=${encodeURIComponent(senderId)}&msg=${encodeURIComponent(messageText)}&label=transactional`;
  const gwRes = await fetch(url, { method: 'GET' });
  const rawBody = await gwRes.text();

  if (!gwRes.ok) {
    throw new Error(`MRAM HTTP ${gwRes.status}: ${rawBody.slice(0, 140)}`);
  }
  if (/invalid\s*api|unauthorized|error\s*code/i.test(rawBody)) {
    throw new Error(`MRAM error: ${rawBody.slice(0, 140)}`);
  }

  return { provider: 'mram', providerMessageId: '', response: rawBody };
}

async function dispatchSingleSms(
  creds: GatewayCredentials,
  recipient: string,
  messageText: string
): Promise<{ provider: string; providerMessageId: string }> {
  const errors: string[] = [];

  if (creds.finalType === 'masking') {
    if (creds.reveApiKey && creds.reveSecretKey && creds.reveMaskingCallerId) {
      try {
        const res = await sendViaReve(
          creds.reveApiKey,
          creds.reveSecretKey,
          creds.reveMaskingCallerId,
          recipient,
          messageText
        );
        return { provider: res.provider, providerMessageId: res.providerMessageId };
      } catch (err: any) {
        errors.push(err?.message || 'REVE masking failed');
      }
    }

    if (creds.automasApiKey && creds.automasMaskingSenderId) {
      try {
        const res = await sendViaAutomas(
          creds.automasApiKey,
          creds.automasMaskingSenderId,
          recipient,
          messageText
        );
        return { provider: res.provider, providerMessageId: res.providerMessageId };
      } catch (err: any) {
        errors.push(err?.message || 'Automas masking fallback failed');
      }
    }

    if (creds.mramApiKey) {
      try {
        const res = await sendViaMram(
          creds.mramApiKey,
          creds.reveMaskingCallerId || creds.mramSenderId,
          recipient,
          messageText
        );
        return { provider: res.provider, providerMessageId: res.providerMessageId };
      } catch (err: any) {
        errors.push(err?.message || 'MRAM fallback failed');
      }
    }
  } else {
    // Non-Masking primary: Automas
    if (creds.automasApiKey) {
      try {
        const res = await sendViaAutomas(
          creds.automasApiKey,
          creds.automasNonMaskingSenderId,
          recipient,
          messageText
        );
        return { provider: res.provider, providerMessageId: res.providerMessageId };
      } catch (err: any) {
        errors.push(err?.message || 'Automas non-masking failed');
      }
    }

    // Fallback 1: REVE non-masking
    if (creds.reveApiKey && creds.reveSecretKey && creds.reveNonMaskingCallerId) {
      try {
        const res = await sendViaReve(
          creds.reveApiKey,
          creds.reveSecretKey,
          creds.reveNonMaskingCallerId,
          recipient,
          messageText
        );
        return { provider: res.provider, providerMessageId: res.providerMessageId };
      } catch (err: any) {
        errors.push(err?.message || 'REVE non-masking fallback failed');
      }
    }

    // Fallback 2: MRAM
    if (creds.mramApiKey) {
      try {
        const res = await sendViaMram(
          creds.mramApiKey,
          creds.mramSenderId,
          recipient,
          messageText
        );
        return { provider: res.provider, providerMessageId: res.providerMessageId };
      } catch (err: any) {
        errors.push(err?.message || 'MRAM fallback failed');
      }
    }
  }

  throw new Error(
    errors.length > 0
      ? errors.join(' | ')
      : 'SMS Gateway credentials are not configured on the server or system settings.'
  );
}

interface DispatchTarget {
  phone: string;
  message: string;
  parts: number;
}

interface DispatchOutcome extends DispatchTarget {
  status: 'delivered' | 'failed';
  provider: string;
  providerMessageId: string;
  errorMessage: string | null;
}

async function dispatchBatchRecipients(
  creds: GatewayCredentials,
  targets: DispatchTarget[],
  concurrency = 8
): Promise<DispatchOutcome[]> {
  const outcomes: DispatchOutcome[] = [];
  for (let i = 0; i < targets.length; i += concurrency) {
    const batch = targets.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(async (target): Promise<DispatchOutcome> => {
        try {
          const res = await dispatchSingleSms(creds, target.phone, target.message);
          return {
            ...target,
            status: 'delivered',
            provider: res.provider,
            providerMessageId: res.providerMessageId,
            errorMessage: null
          };
        } catch (err: any) {
          return {
            ...target,
            status: 'failed',
            provider: creds.finalType === 'masking' ? 'reve' : 'automas',
            providerMessageId: '',
            errorMessage: err?.message || 'Gateway delivery failed'
          };
        }
      })
    );
    outcomes.push(...batchResults);
  }
  return outcomes;
}

async function persistSmsLogs(
  supabaseAdmin: any,
  institutionId: string | null,
  smsType: string,
  outcomes: DispatchOutcome[]
) {
  if (!institutionId || outcomes.length === 0) return;
  try {
    const rows = outcomes.map((o) => ({
      institution_id: institutionId,
      recipient: o.phone,
      message: o.message,
      status: o.status,
      provider: o.provider,
      sms_type: smsType,
      provider_message_id: o.providerMessageId || null,
      error_message: o.errorMessage || null
    }));
    await supabaseAdmin.from('sms_logs').insert(rows);
  } catch (err) {
    console.warn('sms_logs insert skipped/failed:', err);
  }
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

    let effectiveSysSettings = sysSettings;
    if (sysSettings && Object.keys(parseJsonSafe(sysSettings.sms_provider_config)).length === 0) {
      const { data: superInst } = await supabaseAdmin
        .from('institutions')
        .select('config_json')
        .eq('is_super_admin', true)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      const superCfg = parseJsonSafe(superInst?.config_json);
      if (superCfg.system_sms_provider_config && typeof superCfg.system_sms_provider_config === 'object') {
        effectiveSysSettings = {
          ...sysSettings,
          sms_provider_config: superCfg.system_sms_provider_config
        };
      }
    }

    const creds = resolveGatewayCredentials(targetInst, effectiveSysSettings);
    if (!hasAnyGatewayConfigured(creds)) {
      return res.status(500).json({
        error: 'SMS Gateway API key is not configured on system settings or server environment.'
      });
    }

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

      const trimmedMsg = String(message).trim();
      const msgParts = countSmsParts(trimmedMsg) || 1;
      const directTargets: DispatchTarget[] = validPhones.map((phone) => ({
        phone,
        message: trimmedMsg,
        parts: msgParts
      }));

      const outcomes = await dispatchBatchRecipients(creds, directTargets, 8);
      await persistSmsLogs(supabaseAdmin, targetInstId, creds.finalType, outcomes);

      const delivered = outcomes.filter((o) => o.status === 'delivered');
      if (delivered.length === 0) {
        const firstErr = outcomes.find((o) => o.errorMessage)?.errorMessage || 'Direct SMS failed';
        return res.status(502).json({ success: false, error: firstErr });
      }

      return res.status(200).json({
        success: true,
        sentCount: delivered.length,
        failedCount: outcomes.length - delivered.length,
        provider: delivered[0].provider,
        sms_type: creds.finalType
      });
    }

    const targetMemberIds: string[] = Array.isArray(student_ids)
      ? student_ids
      : Array.isArray(member_ids)
        ? member_ids
        : [];

    if (targetMemberIds.length === 0 && (!Array.isArray(phones) || phones.length === 0) && (!Array.isArray(personalized_messages) || personalized_messages.length === 0)) {
      return res.status(400).json({ error: 'At least one recipient member is required' });
    }

    // Build per-recipient dispatch list BEFORE deducting any balance
    let dispatchTargets: DispatchTarget[] = [];
    const trimmedMessage = String(message).trim();

    if (Array.isArray(personalized_messages) && personalized_messages.length > 0) {
      const seen = new Set<string>();
      for (const item of personalized_messages) {
        const cleanPhone = formatBangladeshPhone(item.phone);
        if (cleanPhone.length < 13 || seen.has(cleanPhone)) continue;
        seen.add(cleanPhone);
        const msgText = String(item.text || trimmedMessage).trim();
        const parts = Number(item.parts) > 0 ? Number(item.parts) : (countSmsParts(msgText) || 1);
        dispatchTargets.push({ phone: cleanPhone, message: msgText, parts });
      }
    } else {
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

      const parts = countSmsParts(trimmedMessage) || 1;
      dispatchTargets = validPhones.map((phone) => ({
        phone,
        message: trimmedMessage,
        parts
      }));
    }

    if (dispatchTargets.length === 0) {
      return res.status(400).json({ error: 'No valid phone numbers found for selected members' });
    }

    const totalNeededParts = dispatchTargets.reduce((sum, t) => sum + t.parts, 0);
    const currentBalance = Number(targetInst?.sms_balance || 0);
    if (currentBalance < totalNeededParts) {
      return res.status(400).json({
        error: `ব্যালেন্স পর্যাপ্ত নয়। প্রয়োজন: ${totalNeededParts}, আছে: ${currentBalance}`
      });
    }

    // Dispatch per recipient in batches of 8 (NO pre-deduction before sending)
    const outcomes = await dispatchBatchRecipients(creds, dispatchTargets, 8);
    await persistSmsLogs(supabaseAdmin, targetInstId, creds.finalType, outcomes);

    const deliveredOutcomes = outcomes.filter((o) => o.status === 'delivered');
    const failedOutcomes = outcomes.filter((o) => o.status === 'failed');

    if (deliveredOutcomes.length === 0) {
      const realError = failedOutcomes[0]?.errorMessage || 'SMS গেটওয়ে থেকে কোনো মেসেজ পাঠানো যায়নি।';
      return res.status(502).json({
        success: false,
        sentCount: 0,
        failedCount: failedOutcomes.length,
        error: `${realError} (কোনো ব্যালেন্স কাটা হয়নি)`
      });
    }

    // Deduct ONLY for actually succeeded SMS parts
    const succeededParts = deliveredOutcomes.reduce((sum, o) => sum + o.parts, 0);
    const { data: latestInst } = await supabaseAdmin
      .from('institutions')
      .select('sms_balance')
      .eq('id', targetInstId)
      .maybeSingle();

    const latestBalance = Number(latestInst?.sms_balance ?? currentBalance);
    const updatedBalance = Math.max(0, latestBalance - succeededParts);

    await supabaseAdmin
      .from('institutions')
      .update({ sms_balance: updatedBalance })
      .eq('id', targetInstId);

    try {
      await supabaseAdmin.from('transactions').insert({
        institution_id: targetInstId,
        amount: 0,
        transaction_id: `BULK_SMS_${Math.floor(Date.now() / 1000)}`,
        sender_phone: 'SYSTEM',
        description: `Sent ${deliveredOutcomes.length} SMS (${succeededParts} credits, ${creds.finalType})`,
        type: 'debit',
        status: 'approved',
        sms_count: succeededParts
      });
    } catch (txErr) {
      console.warn('Bulk SMS transaction debit log failed:', txErr);
    }

    const primaryProvider = deliveredOutcomes[0]?.provider || 'automas';
    return res.status(200).json({
      success: true,
      sentCount: deliveredOutcomes.length,
      failedCount: failedOutcomes.length,
      deductedCredits: succeededParts,
      remainingBalance: updatedBalance,
      provider: primaryProvider,
      sms_type: creds.finalType
    });
  } catch (err: any) {
    console.error('SMS send API error:', err);
    return res.status(500).json({ error: err?.message || 'Failed to send SMS' });
  }
}
