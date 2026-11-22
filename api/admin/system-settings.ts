import { getSupabaseAdmin } from '../../lib/supabase-admin';

const BN_TO_EN_DIGITS: Record<string, string> = {
  '০': '0', '১': '1', '২': '2', '৩': '3', '৪': '4',
  '৫': '5', '৬': '6', '৭': '7', '৮': '8', '৯': '9'
};

const normalizeNumberInput = (val: unknown): string => {
  return String(val ?? '')
    .replace(/[০-৯]/g, (d) => BN_TO_EN_DIGITS[d] ?? d)
    .trim();
};

export default async function handler(req: any, res: any) {
  const origin = req.headers?.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,PUT,PATCH');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (!['GET', 'POST', 'PUT', 'PATCH'].includes(req.method)) {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();

    // Verify caller authentication & super_admin role
    const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
    const token = (typeof authHeader === 'string' && authHeader.startsWith('Bearer '))
      ? authHeader.slice(7).trim()
      : '';

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized: Missing authentication token' });
    }

    const { data: { user: requester }, error: tokenErr } = await supabaseAdmin.auth.getUser(token);
    if (tokenErr || !requester) {
      return res.status(401).json({ error: 'Unauthorized: Invalid or expired session token' });
    }

    const [{ data: requesterProfile }, { data: requesterInst }] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', requester.id)
        .maybeSingle(),
      supabaseAdmin
        .from('institutions')
        .select('is_super_admin')
        .eq('id', requester.id)
        .maybeSingle()
    ]);

    const isSuperAdmin =
      requesterProfile?.role === 'super_admin' ||
      requesterInst?.is_super_admin === true;

    if (!isSuperAdmin) {
      return res.status(403).json({ error: 'Forbidden: Super Admin access required' });
    }

    if (req.method === 'GET') {
      const { data, error } = await supabaseAdmin
        .from('system_settings')
        .select('*')
        .order('id', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return res.status(200).json({ success: true, settings: data || null });
    }

    let body = req.body || {};
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        return res.status(400).json({ error: 'Invalid JSON body' });
      }
    }

    const updatePayload: Record<string, any> = {};

    if (body.bkash_number !== undefined) {
      const cleanBkash = normalizeNumberInput(body.bkash_number);
      if (cleanBkash.length > 30) {
        return res.status(400).json({ error: 'Invalid bKash number format' });
      }
      updatePayload.bkash_number = cleanBkash;
    }

    if (body.nagad_number !== undefined) {
      const cleanNagad = normalizeNumberInput(body.nagad_number);
      if (cleanNagad.length > 30) {
        return res.status(400).json({ error: 'Invalid Nagad number format' });
      }
      updatePayload.nagad_number = cleanNagad;
    }

    if (body.reve_api_key !== undefined) {
      updatePayload.reve_api_key = String(body.reve_api_key ?? '').trim();
    }

    if (body.reve_caller_id !== undefined) {
      updatePayload.reve_caller_id = String(body.reve_caller_id ?? '').trim();
    }

    if (body.sms_rate !== undefined) {
      const smsRate = Number(body.sms_rate);
      if (!Number.isFinite(smsRate) || smsRate < 0) {
        return res.status(400).json({ error: 'Invalid SMS rate' });
      }
      updatePayload.sms_rate = smsRate;
    }

    if (body.voice_rate !== undefined) {
      const voiceRate = Number(body.voice_rate);
      if (!Number.isFinite(voiceRate) || voiceRate < 0) {
        return res.status(400).json({ error: 'Invalid Voice rate' });
      }
      updatePayload.voice_rate = voiceRate;
    }

    if (Object.keys(updatePayload).length === 0) {
      return res.status(400).json({ error: 'No settings fields provided to update' });
    }

    const { data: existingRow, error: fetchErr } = await supabaseAdmin
      .from('system_settings')
      .select('*')
      .order('id', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (fetchErr) throw fetchErr;

    let savedRow: any = null;
    if (existingRow && existingRow.id !== undefined && existingRow.id !== null) {
      const missingNonEmptyCols: string[] = [];
      const filteredPayload: Record<string, any> = {};

      for (const [col, val] of Object.entries(updatePayload)) {
        if (Object.prototype.hasOwnProperty.call(existingRow, col)) {
          filteredPayload[col] = val;
        } else if (val !== '' && val !== null && val !== undefined) {
          missingNonEmptyCols.push(col);
        }
      }

      if (Object.keys(filteredPayload).length > 0) {
        const { data: updated, error: updateErr } = await supabaseAdmin
          .from('system_settings')
          .update(filteredPayload)
          .eq('id', existingRow.id)
          .select('*')
          .single();

        if (updateErr) throw updateErr;
        savedRow = updated;
      } else {
        savedRow = existingRow;
      }

      if (missingNonEmptyCols.length > 0) {
        const alterSql = missingNonEmptyCols
          .map((c) => `ALTER TABLE public.system_settings ADD COLUMN IF NOT EXISTS ${c} TEXT;`)
          .join(' ');
        return res.status(422).json({
          error: `Database column missing in system_settings: ${missingNonEmptyCols.join(', ')}. Please run in Supabase SQL Editor: ${alterSql}`,
          missing_columns: missingNonEmptyCols,
          settings: savedRow
        });
      }
    } else {
      const { data: inserted, error: insertErr } = await supabaseAdmin
        .from('system_settings')
        .insert(updatePayload)
        .select('*')
        .single();

      if (insertErr) {
        const msg = String(insertErr?.message || '');
        if (insertErr?.code === 'PGRST204' || insertErr?.code === '42703' || msg.includes('column')) {
          return res.status(422).json({
            error: msg || 'Database schema mismatch in system_settings table.'
          });
        }
        throw insertErr;
      }
      savedRow = inserted;
    }

    return res.status(200).json({
      success: true,
      settings: savedRow
    });
  } catch (err: any) {
    console.error('System settings API error:', err);
    const errMsg =
      err?.message ||
      err?.error_description ||
      err?.details ||
      err?.hint ||
      (typeof err === 'string' && err.trim() ? err : '') ||
      'Failed to update system settings';
    return res.status(500).json({
      error: errMsg
    });
  }
}
