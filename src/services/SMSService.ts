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
      reve_secret_key: '',
      reve_client_id: '',
      reve_caller_id: '8809601017065',
      reve_non_masking_id: '',
      automas_api_key: '',
      automas_non_masking_sender_id: '',
      automas_masking_sender_id: '',
      bkash_number: '01766-XXXXXX',
      nagad_number: '',
      rocket_number: '',
      sms_rate: 0.35,
      non_masking_rate: 0.35,
      masking_rate: 0.55,
      default_sms_type: 'non_masking' as 'non_masking' | 'masking',
      voice_rate: 0.50,
      sms_provider_config: null as any
    };
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('*')
        .order('id', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (!data) return defaults;

      let providerCfg: any = data.sms_provider_config;
      if (typeof providerCfg === 'string') {
        try { providerCfg = JSON.parse(providerCfg); } catch { providerCfg = {}; }
      }
      providerCfg = providerCfg && typeof providerCfg === 'object' ? providerCfg : {};

      const nonMaskingRate =
        Number(providerCfg?.non_masking_rate) > 0
          ? Number(providerCfg.non_masking_rate)
          : Number(data.sms_rate) > 0
            ? Number(data.sms_rate)
            : defaults.non_masking_rate;

      const maskingRate =
        Number(providerCfg?.masking_rate) > 0
          ? Number(providerCfg.masking_rate)
          : defaults.masking_rate;

      const defaultSmsType: 'non_masking' | 'masking' =
        providerCfg?.default_type === 'masking' ? 'masking' : 'non_masking';

      return {
        id: data.id ?? null,
        reve_api_key: data.reve_api_key || providerCfg?.reve?.api_key || '',
        reve_secret_key: data.reve_secret_key || providerCfg?.reve?.secret_key || '',
        reve_client_id: data.reve_client_id || providerCfg?.reve?.client_id || '',
        reve_caller_id: data.reve_caller_id || providerCfg?.reve?.caller_id || defaults.reve_caller_id,
        reve_non_masking_id: data.reve_non_masking_id || providerCfg?.reve?.non_masking_id || data.reve_caller_id || '',
        automas_api_key: data.automas_api_key || providerCfg?.automas?.api_key || '',
        automas_non_masking_sender_id: data.automas_non_masking_sender_id || providerCfg?.automas?.non_masking_sender_id || '',
        automas_masking_sender_id: data.automas_masking_sender_id || providerCfg?.automas?.masking_sender_id || '',
        bkash_number: data.bkash_number ?? defaults.bkash_number,
        nagad_number: data.nagad_number || '',
        rocket_number: data.rocket_number || '',
        sms_rate: nonMaskingRate,
        non_masking_rate: nonMaskingRate,
        masking_rate: maskingRate,
        default_sms_type: defaultSmsType,
        voice_rate: Number(data.voice_rate) > 0 ? Number(data.voice_rate) : defaults.voice_rate,
        sms_provider_config: providerCfg
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

