import { getSupabaseAdmin } from '../lib/supabase-admin';
import * as crypto from 'crypto';

function hashPin(rawPin: string): string {
  const trimmed = String(rawPin).trim();
  if (/^[a-f0-9]{64}$/i.test(trimmed) || trimmed.startsWith('$2a$') || trimmed.startsWith('$2b$')) {
    return trimmed;
  }
  return crypto.createHash('sha256').update(trimmed).digest('hex');
}

function stripSensitiveFields(exec: any) {
  if (!exec || typeof exec !== 'object') return exec;
  const copy = { ...exec };
  delete copy.pin;
  delete copy.password_hash;
  return copy;
}

async function verifyExecutiveCaller(
  req: any,
  supabase: any,
  targetInstitutionId?: string | null,
  executiveId?: string | null
): Promise<{ authorized: boolean; status: number; error?: string; resolvedInstitutionId?: string | null }> {
  const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
  const bodyToken = req.body?.auth_token;
  const token = (typeof authHeader === 'string' && authHeader.startsWith('Bearer '))
    ? authHeader.slice(7).trim()
    : (bodyToken ? String(bodyToken).trim() : '');

  if (!token) {
    return { authorized: false, status: 401, error: 'Unauthorized: Missing Bearer token' };
  }

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) {
    return { authorized: false, status: 401, error: 'Unauthorized: Invalid or expired token' };
  }

  let resolvedInstId = targetInstitutionId || null;
  if (!resolvedInstId && executiveId) {
    const { data: execRow } = await supabase
      .from('executives')
      .select('institution_id')
      .eq('id', executiveId)
      .maybeSingle();
    if (!execRow) {
      return { authorized: false, status: 404, error: 'Executive not found' };
    }
    resolvedInstId = execRow.institution_id;
  }

  const [{ data: profile }, { data: inst }] = await Promise.all([
    supabase
      .from('profiles')
      .select('role, institution_id')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('institutions')
      .select('is_super_admin')
      .eq('id', user.id)
      .maybeSingle()
  ]);

  const isSuper =
    profile?.role === 'super_admin' ||
    profile?.role === 'manager' ||
    inst?.is_super_admin === true;

  if (isSuper) {
    return { authorized: true, status: 200, resolvedInstitutionId: resolvedInstId };
  }

  if (
    resolvedInstId &&
    (user.id === resolvedInstId || profile?.institution_id === resolvedInstId)
  ) {
    return { authorized: true, status: 200, resolvedInstitutionId: resolvedInstId };
  }

  return { authorized: false, status: 403, error: 'Forbidden: You do not have access to this institution' };
}

export default async function handler(req: any, res: any) {
  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  let pathname = url.pathname;
  if (pathname.endsWith('/')) pathname = pathname.slice(0, -1);

  let action = pathname.split('/').pop();
  if (action === 'executives' || action === 'teachers' || !action) {
    action = (req.query?.action as string) || url.searchParams.get('action') || (req.headers?.['x-original-action'] as string) || 'list';
  }

  try {
    const supabase = getSupabaseAdmin();

    if (req.body && typeof req.body === 'string' && req.body.trim().startsWith('{')) {
      try {
        req.body = JSON.parse(req.body);
      } catch (e) {
        console.warn('Failed to parse req.body as JSON:', e);
      }
    }

    const body = req.body || {};

    // Public endpoint: Executive login
    if (action === 'login' && req.method === 'POST') {
      const mobile = (body.mobile || body.phone || '').trim();
      const password = (body.password || body.pin || '').trim();
      if (!mobile || !password) {
        return res.status(400).json({ error: 'Mobile and PIN/password are required' });
      }

      const passwordHash = hashPin(password);

      // Call check_teacher_login with (p_phone, p_pin)
      let executiveData: any = null;
      const { data: rpcRows, error: rpcError } = await supabase.rpc('check_teacher_login', {
        p_phone: mobile,
        p_pin: password
      });

      if (!rpcError && Array.isArray(rpcRows) && rpcRows.length > 0) {
        executiveData = rpcRows[0];
      } else {
        // Fallback in case RPC expects SHA-256 hash or direct table lookup with hash/legacy check
        const { data: rpcHashRows } = await supabase.rpc('check_teacher_login', {
          p_phone: mobile,
          p_pin: passwordHash
        });
        if (Array.isArray(rpcHashRows) && rpcHashRows.length > 0) {
          executiveData = rpcHashRows[0];
        } else {
          const { data: directRows } = await supabase
            .from('executives')
            .select('id, institution_id, name, phone, pin, designation, photo_url, permissions, is_active')
            .eq('phone', mobile)
            .eq('is_active', true);

          if (Array.isArray(directRows)) {
            executiveData = directRows.find(
              (r: any) => r.pin && (r.pin === passwordHash || r.pin === password)
            );
          }
        }
      }

      if (!executiveData) {
        return res.status(401).json({ error: 'Invalid mobile number or PIN' });
      }

      // Auto-upgrade plaintext PIN to SHA-256 hash if needed
      if (executiveData.pin && executiveData.pin === password && password !== passwordHash) {
        await supabase
          .from('executives')
          .update({ pin: passwordHash, last_login_at: new Date().toISOString() })
          .eq('id', executiveData.id);
      } else {
        await supabase
          .from('executives')
          .update({ last_login_at: new Date().toISOString() })
          .eq('id', executiveData.id);
      }

      let parsedPermissions = executiveData.permissions || {};
      if (typeof executiveData.permissions === 'string') {
        try {
          parsedPermissions = JSON.parse(executiveData.permissions);
        } catch {
          parsedPermissions = {};
        }
      }

      return res.status(200).json({
        user: {
          id: executiveData.id,
          role: 'executive',
          name: executiveData.teacher_name || executiveData.name,
          institute_id: executiveData.institution_id,
          institution_id: executiveData.institution_id,
          phone: executiveData.phone,
          designation: executiveData.designation,
          photo_url: executiveData.photo_url,
          permissions: parsedPermissions,
          supabase_email: executiveData.supabase_email || `${executiveData.phone}@committee.com`
        }
      });
    }

    if (action === 'list' && req.method === 'GET') {
      const institute_id =
        (req.query?.institute_id as string) ||
        url.searchParams.get('institute_id') ||
        (req.query?.organization_id as string) ||
        url.searchParams.get('organization_id') ||
        (req.query?.institution_id as string) ||
        url.searchParams.get('institution_id');

      if (!institute_id) return res.status(400).json({ error: 'Organization ID is required' });

      const authCheck = await verifyExecutiveCaller(req, supabase, institute_id, null);
      if (!authCheck.authorized) {
        return res.status(authCheck.status).json({ error: authCheck.error });
      }

      const { data: executives, error } = await supabase
        .from('executives')
        .select('id, institution_id, user_id, name, phone, designation, photo_url, is_active, permissions, created_at, last_login_at')
        .eq('institution_id', institute_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const formattedExecutives = (executives || []).map((t: any) => {
        let parsedPermissions = t.permissions || {};
        if (typeof t.permissions === 'string') {
          try {
            parsedPermissions = JSON.parse(t.permissions);
          } catch {
            parsedPermissions = {};
          }
        }
        return stripSensitiveFields({
          ...t,
          permissions: parsedPermissions
        });
      });
      return res.status(200).json({ executives: formattedExecutives });
    }

    if (action === 'create' && req.method === 'POST') {
      const { institute_id, institution_id, organization_id, name, phone, pin, designation, photo_url, permissions, is_active } = body;
      const finalInstituteId = institute_id || institution_id || organization_id;
      if (!finalInstituteId || !name || !phone || !pin) {
        return res.status(400).json({ error: 'Required fields missing (institution_id, name, phone, pin)' });
      }

      const authCheck = await verifyExecutiveCaller(req, supabase, finalInstituteId, null);
      if (!authCheck.authorized) {
        return res.status(authCheck.status).json({ error: authCheck.error });
      }

      const hashedPin = hashPin(pin);

      const { data: executive, error: executiveError } = await supabase
        .from('executives')
        .insert({
          institution_id: finalInstituteId,
          name: String(name).trim(),
          phone: String(phone).trim(),
          pin: hashedPin,
          designation: designation || '',
          photo_url: photo_url || null,
          permissions: permissions || {},
          is_active: is_active !== undefined ? Boolean(is_active) : true
        })
        .select('id, institution_id, user_id, name, phone, designation, photo_url, is_active, permissions, created_at, last_login_at')
        .single();

      if (executiveError) throw executiveError;
      return res.status(201).json({ success: true, executive: stripSensitiveFields(executive) });
    }

    if (action === 'update' && (req.method === 'PUT' || req.method === 'POST')) {
      const { id, name, phone, pin, designation, photo_url, is_active, permissions } = body;
      if (!id) return res.status(400).json({ error: 'Executive ID is required' });

      const authCheck = await verifyExecutiveCaller(req, supabase, body.institution_id || body.institute_id || null, id);
      if (!authCheck.authorized) {
        return res.status(authCheck.status).json({ error: authCheck.error });
      }

      const updateData: any = {};
      if (name !== undefined) updateData.name = String(name).trim();
      if (phone !== undefined) updateData.phone = String(phone).trim();
      if (designation !== undefined) updateData.designation = designation;
      if (photo_url !== undefined) updateData.photo_url = photo_url;
      if (is_active !== undefined) updateData.is_active = Boolean(is_active);
      if (permissions !== undefined) updateData.permissions = permissions;
      if (pin && String(pin).trim().length > 0) {
        updateData.pin = hashPin(pin);
      }

      const { data: updatedExec, error: executiveError } = await supabase
        .from('executives')
        .update(updateData)
        .eq('id', id)
        .select('id, institution_id, user_id, name, phone, designation, photo_url, is_active, permissions, created_at, last_login_at')
        .single();

      if (executiveError) throw executiveError;
      return res.status(200).json({ success: true, executive: stripSensitiveFields(updatedExec) });
    }

    if (action === 'delete' && (req.method === 'DELETE' || req.method === 'POST')) {
      const id = (req.query?.id as string) || url.searchParams.get('id') || body?.id;
      if (!id) return res.status(400).json({ error: 'Executive ID is required' });

      const authCheck = await verifyExecutiveCaller(req, supabase, null, id);
      if (!authCheck.authorized) {
        return res.status(authCheck.status).json({ error: authCheck.error });
      }

      const { error } = await supabase.from('executives').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    if (action === 'permissions' && (req.method === 'POST' || req.method === 'PUT')) {
      const executiveId = body.executive_id || body.teacher_id || body.id;
      const permissions = body.permissions;
      if (!executiveId || !permissions || typeof permissions !== 'object') {
        return res.status(400).json({ error: 'Executive ID and permissions object are required' });
      }

      const authCheck = await verifyExecutiveCaller(req, supabase, null, executiveId);
      if (!authCheck.authorized) {
        return res.status(authCheck.status).json({ error: authCheck.error });
      }

      const { data: updatedExec, error } = await supabase
        .from('executives')
        .update({ permissions })
        .eq('id', executiveId)
        .select('id, institution_id, name, phone, designation, is_active, permissions')
        .single();

      if (error) throw error;
      return res.status(200).json({ success: true, executive: stripSensitiveFields(updatedExec) });
    }

    return res.status(404).json({ error: 'Action not found' });
  } catch (err: any) {
    console.error(`Executives API error (${action}):`, err);
    return res.status(500).json({
      error: err.message || err.error_description || 'Internal server error',
      details: err.details || err.hint || null,
      code: err.code || null
    });
  }
}
