import { supabase } from 'lib/supabase';
import { Member } from 'types';
import { getSmsLengthInfo } from 'utils/smsUtils';
import { ShortcodeService } from './ShortcodeService';

const normalizePhone = (phone: string): string => {
  const p = String(phone || '').replace(/\D/g, '');
  if (p.length === 13 && p.startsWith('880')) return p;
  if (p.startsWith('0') && p.length === 11) return `88${p}`;
  if (p.startsWith('1') && p.length === 10) return `880${p}`;
  if (p.startsWith('880')) return p.slice(0, 13);
  return p;
};

export const SMSService = {
  getGlobalSettings: async () => {
    const defaults = {
      id: null as string | number | null,
      reve_api_key: '',
      reve_caller_id: '8809601017065',
      bkash_number: '01766-XXXXXX',
      nagad_number: '',
      rocket_number: '',
      sms_rate: 0.50,
      voice_rate: 1.00
    };
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (!data) return defaults;

      return {
        id: data.id ?? null,
        reve_api_key: data.reve_api_key || '',
        reve_caller_id: data.reve_caller_id || defaults.reve_caller_id,
        bkash_number: data.bkash_number ?? defaults.bkash_number,
        nagad_number: data.nagad_number || '',
        rocket_number: data.rocket_number || '',
        sms_rate: data.sms_rate ?? defaults.sms_rate,
        voice_rate: data.voice_rate ?? defaults.voice_rate
      };
    } catch {
      return defaults;
    }
  },

  sendBulk: async (institutionId: string, students: Member[], message: string) => {
    const { data: mRes } = await supabase
      .from('institutions')
      .select('sms_balance')
      .eq('id', institutionId)
      .single();

    if (!mRes) throw new Error('Institution not found');

    const hasShortcodes = /\{[a-z_]+\}/i.test(message);
    let personalizedMessages: { studentId: string; phone: string; text: string; parts: number }[] = [];
    let totalSmsNeeded = 0;

    if (hasShortcodes) {
      const shortcodeData = await ShortcodeService.fetchShortcodeData(institutionId, students.map(s => s.id));
      personalizedMessages = students.map(s => {
        const data = shortcodeData.find(d => d.id === s.id) || { name: s.name, phone: s.phone };
        const text = ShortcodeService.replaceShortcodes(message, data);
        const { parts } = getSmsLengthInfo(text);
        return { studentId: s.id, phone: s.phone, text, parts };
      });
      totalSmsNeeded = personalizedMessages.reduce((sum, m) => sum + m.parts, 0);
    } else {
      const { parts } = getSmsLengthInfo(message);
      if (parts > 7) throw new Error('SMS length exceeds the maximum limit of 7 parts.');
      totalSmsNeeded = students.length * parts;
    }

    const balance = mRes.sms_balance || 0;
    if (balance < totalSmsNeeded) {
      throw new Error(`ব্যালেন্স পর্যাপ্ত নয়। প্রয়োজন: ${totalSmsNeeded}, আছে: ${balance}`);
    }

    const studentIdsForRpc: string[] = [];
    if (hasShortcodes) {
      personalizedMessages.forEach(m => {
        for (let i = 0; i < m.parts; i++) studentIdsForRpc.push(m.studentId);
      });
    } else {
      const { parts } = getSmsLengthInfo(message);
      for (let i = 0; i < parts; i++) {
        studentIdsForRpc.push(...students.map(s => s.id));
      }
    }

    const { data: { session } } = await supabase.auth.getSession();
    const response = await fetch('/api/sms/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
      },
      body: JSON.stringify({
        mode: 'bulk',
        institution_id: institutionId,
        student_ids: studentIdsForRpc,
        phones: students.map(s => normalizePhone(s.phone)),
        personalized_messages: hasShortcodes ? personalizedMessages : undefined,
        message,
        auth_token: session?.access_token
      })
    });

    const resData = await response.json().catch(() => ({}));
    if (!response.ok || !resData.success) {
      throw new Error(resData.error || 'ট্রানজ্যাকশন সফল হয়নি।');
    }

    return { success: true };
  },

  sendDirect: async (phone: string, message: string, institutionId?: string) => {
    const target = normalizePhone(phone);
    const { data: { session } } = await supabase.auth.getSession();

    const response = await fetch('/api/sms/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { 'Authorization': `Bearer ${session.access_token}` } : {})
      },
      body: JSON.stringify({
        mode: 'direct',
        institution_id: institutionId,
        phones: [target],
        message,
        auth_token: session?.access_token
      })
    });

    const resData = await response.json().catch(() => ({}));
    if (!response.ok || !resData.success) {
      throw new Error(resData.error || 'Direct SMS failed');
    }
    return { success: true };
  },

  getHistory: async (institutionId: string) => {
    if (!institutionId) return [];
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, institution_id, amount, transaction_id, sender_phone, description, type, status, sms_count, created_at')
        .eq('institution_id', institutionId)
        .or('sms_count.gt.0,transaction_id.ilike.BULK_SMS_%,description.ilike.%SMS%')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error || !data) {
        return [];
      }

      return data.map((row: any) => ({
        id: row.id,
        date: row.created_at,
        recipient: row.sender_phone || `${row.sms_count || 0} প্রাপক`,
        recipients: row.sms_count || 0,
        message: row.description || row.transaction_id || 'SMS Transaction',
        status: row.status === 'approved' ? 'delivered' : (row.status || 'sent')
      }));
    } catch (error) {
      console.error('Error in getHistory:', error);
      return [];
    }
  }
};

