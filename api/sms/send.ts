import type { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';
import { getSupabaseAdmin } from '../../lib/supabase-admin';

const MRAM_BASE_URL = 'https://msg.mram.com.bd';
const DEFAULT_SENDER_ID = '8809601017065';

function formatBangladeshPhone(phone: string): string {
  const p = String(phone || '').replace(/\D/g, '');
  if (p.length === 13 && p.startsWith('880')) return p;
  if (p.startsWith('0') && p.length === 11) return `88${p}`;
  if (p.startsWith('1') && p.length === 10) return `880${p}`;
  if (p.startsWith('880')) return p.slice(0, 13);
  return p;
}

function isBanglaText(text: string): boolean {
  return /[\u0980-\u09FF]/.test(text);
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

    const [{ data: profile }, { data: callerInst }] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select('role, institution_id')
        .eq('id', user.id)
        .maybeSingle(),
      supabaseAdmin
        .from('institutions')
        .select('id, is_super_admin, reve_api_key, reve_caller_id, sms_balance')
        .eq('id', user.id)
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
        .select('id, reve_api_key, reve_caller_id, sms_balance')
        .eq('id', targetInstId)
        .maybeSingle();
      targetInst = data;
    }

    const apiKey =
      (targetInst?.reve_api_key && String(targetInst.reve_api_key).trim()) ||
      process.env.MRAM_API_KEY ||
      process.env.SMS_API_KEY ||
      '';
    const senderId =
      (targetInst?.reve_caller_id && String(targetInst.reve_caller_id).trim()) ||
      process.env.MRAM_SENDER_ID ||
      DEFAULT_SENDER_ID;

    if (!apiKey) {
      return res.status(500).json({
        error: 'SMS Gateway API key is not configured on the server or institution settings.'
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
        new Set(rawPhones.map(formatBangladeshPhone).filter(p => p.length >= 11))
      );
      if (validPhones.length === 0) {
        return res.status(400).json({ error: 'No valid recipient phone numbers provided' });
      }
      const smsType = isBanglaText(message) ? 'unicode' : 'text';
      const url = `${MRAM_BASE_URL}/smsapi?api_key=${encodeURIComponent(apiKey)}&type=${smsType}&contacts=${validPhones.join('+')}&senderid=${encodeURIComponent(senderId)}&msg=${encodeURIComponent(String(message).trim())}&label=transactional`;
      const gwRes = await fetch(url, { method: 'GET' });
      if (!gwRes.ok) {
        return res.status(502).json({ error: `SMS Gateway returned HTTP ${gwRes.status}` });
      }
      return res.status(200).json({ success: true });
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
        description: `Sent ${smsCount} SMS messages`,
        type: 'debit',
        status: 'approved',
        sms_count: smsCount
      });
    } else if (rpcResult && rpcResult.success === false) {
      return res.status(400).json({ error: rpcResult.error || 'SMS balance deduction failed' });
    }

    if (Array.isArray(personalized_messages) && personalized_messages.length > 0) {
      for (const item of personalized_messages) {
        const cleanPhone = formatBangladeshPhone(item.phone);
        if (cleanPhone.length < 11) continue;
        const msgText = String(item.text || message).trim();
        const smsType = isBanglaText(msgText) ? 'unicode' : 'text';
        const url = `${MRAM_BASE_URL}/smsapi?api_key=${encodeURIComponent(apiKey)}&type=${smsType}&contacts=${cleanPhone}&senderid=${encodeURIComponent(senderId)}&msg=${encodeURIComponent(msgText)}&label=transactional`;
        await fetch(url, { method: 'GET' });
      }
      return res.status(200).json({ success: true });
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
      new Set(phoneList.map(formatBangladeshPhone).filter(p => p.length >= 11))
    );

    if (validPhones.length === 0) {
      return res.status(400).json({ error: 'No valid phone numbers found for selected members' });
    }

    const chunkSize = 50;
    const smsType = isBanglaText(message) ? 'unicode' : 'text';
    for (let i = 0; i < validPhones.length; i += chunkSize) {
      const chunk = validPhones.slice(i, i + chunkSize).join('+');
      const url = `${MRAM_BASE_URL}/smsapi?api_key=${encodeURIComponent(apiKey)}&type=${smsType}&contacts=${chunk}&senderid=${encodeURIComponent(senderId)}&msg=${encodeURIComponent(String(message).trim())}&label=transactional`;
      const gwRes = await fetch(url, { method: 'GET' });
      if (!gwRes.ok) {
        return res.status(502).json({ error: `SMS Gateway returned HTTP ${gwRes.status}` });
      }
    }

    return res.status(200).json({ success: true });
  } catch (err: any) {
    console.error('SMS send API error:', err);
    return res.status(500).json({ error: err.message || 'Failed to send SMS' });
  }
}
