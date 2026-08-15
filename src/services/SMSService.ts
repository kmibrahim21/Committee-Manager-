import { supabase } from 'lib/supabase';
import { Member } from 'types';
import { getSmsLengthInfo } from 'utils/smsUtils';
import { ShortcodeService } from './ShortcodeService';

const normalizePhone = (phone: string): string => {
  let p = phone.replace(/\D/g, ''); 
  if (p.length === 13 && p.startsWith('880')) return p;
  if (p.startsWith('0') && p.length === 11) return `88${p}`;
  if (p.startsWith('1') && p.length === 10) return `880${p}`;
  if (p.startsWith('880')) return p.slice(0, 13);
  return p;
};

const isBanglaText = (text: string): boolean => {
  return /[\u0980-\u09FF]/.test(text);
};

export const SMSService = {
  getGlobalSettings: async () => {
    try {
      const { data } = await supabase
        .from('system_settings')
        .select('*')
        .eq('id', '00000000-0000-0000-0000-000000000001')
        .maybeSingle();
      
      const defaults = { 
        reve_api_key: 'demo16a6792c44443d2.81791638', 
        reve_caller_id: '8809601017065',
        bkash_number: '০১৭৬৬-XXXXXX',
        sms_rate: 0.50,
        voice_rate: 1.00
      };

      if (!data) return defaults;

      return {
        reve_api_key: (data.reve_api_key || defaults.reve_api_key).trim(),
        reve_caller_id: (data.reve_caller_id || defaults.reve_caller_id).trim(),
        bkash_number: data.bkash_number || defaults.bkash_number,
        sms_rate: data.sms_rate || defaults.sms_rate,
        voice_rate: data.voice_rate || defaults.voice_rate
      };
    } catch (e) {
      return { reve_api_key: 'demo16a6792c44443d2.81791638', bkash_number: '০১৭৬৬-XXXXXX', reve_caller_id: '8809601017065' };
    }
  },

  sendBulk: async (institutionId: string, students: Member[], message: string) => {
    const global = await SMSService.getGlobalSettings();
    const { data: mRes } = await supabase
      .from('institutions')
      .select('sms_balance, reve_api_key, reve_caller_id')
      .eq('id', institutionId)
      .single();

    if (!mRes) throw new Error("Institution not found");
    const mData = mRes;

    const hasShortcodes = /\[(name|phone)\]/i.test(message);
    let personalizedMessages: { studentId: string, phone: string, text: string, parts: number }[] = [];
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
      if (parts > 7) throw new Error("SMS length exceeds the maximum limit of 7 parts.");
      totalSmsNeeded = students.length * parts;
    }

    const balance = mData.sms_balance || 0;
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

    const { data: rpcData, error: rpcError } = await supabase.rpc('send_bulk_sms_rpc', {
      p_institution_id: institutionId,
      p_student_ids: studentIdsForRpc,
      p_message: message 
    });

    if (rpcError) throw new Error("ট্রানজ্যাকশন সফল হয়নি। (RLS Refused)");
    if (rpcData && rpcData.success === false) throw new Error(rpcData.error || "ট্রানজ্যাকশন সফল হয়নি।");

    const apiKey = (mData.reve_api_key && mData.reve_api_key.trim() !== '') ? mData.reve_api_key.trim() : global.reve_api_key;
    const senderId = (mData.reve_caller_id && mData.reve_caller_id.trim() !== '') ? mData.reve_caller_id.trim() : global.reve_caller_id;

    if (hasShortcodes) {
      const chunkSize = 50;
      const batches = [];
      for (let i = 0; i < personalizedMessages.length; i += chunkSize) {
        batches.push(personalizedMessages.slice(i, i + chunkSize));
      }

      const sendPromises = batches.map(async (chunk) => {
        for (const m of chunk) {
          const type = isBanglaText(m.text) ? 'unicode' : 'text';
          const apiUrl = `https://msg.mram.com.bd/smsapi?api_key=${apiKey}&type=${type}&contacts=${normalizePhone(m.phone)}&senderid=${senderId}&msg=${encodeURIComponent(m.text)}&label=transactional`;
          try { 
            await fetch(apiUrl, { mode: "no-cors" });
          } catch (err) { 
            console.warn("Personalized SMS failed:", err); 
          }
        }
      });
      await Promise.all(sendPromises);
    } else {
      const chunkSize = 50; 
      const batches: string[] = [];
      for (let i = 0; i < students.length; i += chunkSize) {
        const chunk = students.slice(i, i + chunkSize);
        const phoneList = chunk.map(s => normalizePhone(s.phone)).join('+');
        batches.push(phoneList);
      }
      
      const type = isBanglaText(message) ? 'unicode' : 'text';
      const sendPromises = batches.map(async (toUsers) => {
        const apiUrl = `https://msg.mram.com.bd/smsapi?api_key=${apiKey}&type=${type}&contacts=${toUsers}&senderid=${senderId}&msg=${encodeURIComponent(message)}&label=transactional`;
        try { 
          await fetch(apiUrl, { mode: "no-cors" });
        } catch (err) { 
          console.warn("SMS batch failed:", err); 
        }
      });
      await Promise.all(sendPromises);
    }

    return { success: true };
  },

  sendDirect: async (phone: string, message: string, institutionId?: string) => {
    const global = await SMSService.getGlobalSettings();
    let apiKey = global.reve_api_key;
    let senderId = global.reve_caller_id;

    if (institutionId) {
      const { data } = await supabase
        .from('institutions')
        .select('reve_api_key, reve_caller_id')
        .eq('id', institutionId)
        .maybeSingle();
        
      if (data) {
        if (data.reve_api_key && data.reve_api_key.trim() !== '') apiKey = data.reve_api_key.trim();
        if (data.reve_caller_id && data.reve_caller_id.trim() !== '') senderId = data.reve_caller_id.trim();
      }
    }

    const target = normalizePhone(phone);
    const type = isBanglaText(message) ? 'unicode' : 'text';
    const apiUrl = `https://msg.mram.com.bd/smsapi?api_key=${apiKey}&type=${type}&contacts=${target}&senderid=${senderId}&msg=${encodeURIComponent(message)}&label=transactional`;
    
    try { 
      await fetch(apiUrl, { mode: "no-cors" });
    } catch (e) { 
      console.warn("Direct SMS failed:", e); 
    }
  },

  getHistory: async (institutionId: string) => {
    try {
      // Mock history for now since MRAM doesn't have an easily callable list endpoint without SMS Shoot ID
      return [
        { date: new Date().toISOString(), recipient: '8801712345678', message: 'আস-সালামু আলাইকুম, আপনার সন্তানের হাজিরা রিপোর্ট...', status: 'sent' },
        { date: new Date(Date.now() - 3600000).toISOString(), recipient: '8801812345678', message: 'পরীক্ষার ফলাফল প্রকাশিত হয়েছে।', status: 'delivered' },
        { date: new Date(Date.now() - 86400000).toISOString(), recipient: '8801912345678', message: 'বকেয়া ফি পরিশোধ করুন।', status: 'failed', reason: 'Invalid Number' },
        { date: new Date(Date.now() - 172800000).toISOString(), recipient: '8801612345678', message: 'ছুটির নোটিশ।', status: 'sent' },
        { date: new Date(Date.now() - 259200000).toISOString(), recipient: '8801512345678', message: 'মাসিক সভার আমন্ত্রণ।', status: 'failed', reason: 'Insufficient Balance' },
      ];
    } catch (error) {
      console.error("Error in getHistory:", error);
      return [];
    }
  }
};
