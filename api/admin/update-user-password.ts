import { getSupabaseAdmin } from '../../lib/supabase-admin';

export default async function handler(req: any, res: any) {
  // CORS handling
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  let body = req.body || {};
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      // Keep body as is
    }
  }

  const { user_id, email, new_password, auth_token, role, full_name, permissions } = body;

  if (!new_password || new_password.trim().length < 6) {
    return res.status(400).json({ error: 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।' });
  }

  const cleanPassword = new_password.trim();
  const cleanEmail = email?.trim()?.toLowerCase();

  try {
    const supabaseAdmin = getSupabaseAdmin();

    // 1. Unconditionally require and verify admin auth token
    const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
    const token = (typeof authHeader === 'string' && authHeader.startsWith('Bearer '))
      ? authHeader.slice(7).trim()
      : (auth_token ? String(auth_token).trim() : '');

    if (!token) {
      return res.status(401).json({ error: 'অননুমোদিত অ্যাক্সেস (Missing authentication token)' });
    }

    const { data: { user: requester }, error: tokenErr } = await supabaseAdmin.auth.getUser(token);
    if (tokenErr || !requester) {
      return res.status(401).json({ error: 'অননুমোদিত অ্যাক্সেস (Invalid or expired token)' });
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

    const isAuthorized =
      requesterProfile?.role === 'super_admin' ||
      requesterProfile?.role === 'manager' ||
      requesterInst?.is_super_admin === true;

    if (!isAuthorized) {
      return res.status(403).json({ error: 'শুধুমাত্র সুপার অ্যাডমিন অথবা ম্যানেজার পাসওয়ার্ড পরিবর্তন করতে পারেন।' });
    }

    // Collect candidate emails and user IDs for bulletproof matching
    let candidateEmails: string[] = [];
    if (cleanEmail) candidateEmails.push(cleanEmail);

    let candidateUserIds: string[] = [];
    if (user_id) candidateUserIds.push(user_id);

    // 2. Fetch institution data if user_id is provided
    let instData: any = null;
    if (user_id) {
      const { data } = await supabaseAdmin
        .from('institutions')
        .select('id, email, login_code, name')
        .eq('id', user_id)
        .maybeSingle();
      if (data) {
        instData = data;
        if (data.email) candidateEmails.push(data.email.trim().toLowerCase());
        if (data.login_code && data.login_code.includes('@')) {
          candidateEmails.push(data.login_code.trim().toLowerCase());
        }
      }
    }

    // 3. Fetch profile data
    if (user_id || cleanEmail) {
      const filters = [];
      if (user_id) {
        filters.push(`id.eq.${user_id}`);
        filters.push(`institution_id.eq.${user_id}`);
      }
      if (cleanEmail) {
        filters.push(`email.ilike.${cleanEmail}`);
      }
      const { data: profs } = await supabaseAdmin
        .from('profiles')
        .select('id, institution_id, full_name, email, role')
        .or(filters.join(','));

      if (profs && profs.length > 0) {
        profs.forEach((p: any) => {
          if (p.id) candidateUserIds.push(p.id);
          if (p.email) candidateEmails.push(p.email.trim().toLowerCase());
        });
      }
    }

    // Remove duplicates
    candidateEmails = Array.from(new Set(candidateEmails.filter(Boolean)));
    candidateUserIds = Array.from(new Set(candidateUserIds.filter(Boolean)));

    // 4. Search for Auth user
    let targetUser: any = null;

    // Direct Auth ID check
    for (const uid of candidateUserIds) {
      try {
        const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(uid);
        if (user) {
          targetUser = user;
          break;
        }
      } catch {
        // Not found by ID
      }
    }

    // Search via listUsers
    if (!targetUser) {
      const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (!listError && users) {
        // Search by candidate user IDs
        targetUser = users.find((u: any) => candidateUserIds.includes(u.id));

        // Search by candidate emails
        if (!targetUser) {
          targetUser = users.find((u: any) => 
            u.email && candidateEmails.includes(u.email.trim().toLowerCase())
          );
        }
      }
    }

    // 5. If Auth user found, UPDATE password in Supabase Auth!
    if (targetUser) {
      const isMgr = role === 'manager' || targetUser.email?.toLowerCase().includes('manager') || targetUser.user_metadata?.role === 'manager';
      
      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(targetUser.id, {
        password: cleanPassword,
        email_confirm: true,
        user_metadata: {
          ...targetUser.user_metadata,
          role: isMgr ? 'manager' : (role || targetUser.user_metadata?.role || 'org_admin'),
          full_name: full_name || targetUser.user_metadata?.full_name || 'User',
          ...(permissions ? { permissions } : {})
        }
      });
      if (updateErr) throw updateErr;

      // If creating/updating a Manager, ensure profiles table has institution_id: null and role: 'manager'
      if (isMgr) {
        await supabaseAdmin.from('profiles').upsert({
          id: targetUser.id,
          institution_id: null,
          role: 'manager',
          full_name: full_name || targetUser.user_metadata?.full_name || 'System Manager',
          email: targetUser.email?.toLowerCase() || cleanEmail,
          is_active: true,
          ...(permissions ? { permissions } : {})
        });
      }

      // Sync email in institutions if provided
      if (instData?.id && cleanEmail) {
        await supabaseAdmin
          .from('institutions')
          .update({ email: cleanEmail, login_code: cleanEmail })
          .eq('id', instData.id);
      }

      // Secondary RPC sync if available
      try {
        await supabaseAdmin.rpc('update_user_by_admin', {
          p_user_id: targetUser.id,
          p_password: cleanPassword
        });
      } catch {
        // optional sync
      }

      return res.status(200).json({ success: true, user_id: targetUser.id, message: 'পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে!' });
    }

    // 6. If Auth user NOT found yet, create Auth user for primary email
    const primaryEmail = candidateEmails[0];
    if (primaryEmail) {
      const { data: createData, error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: primaryEmail,
        password: cleanPassword,
        email_confirm: true,
        user_metadata: {
          role: role || 'manager',
          full_name: full_name || 'System Manager'
        }
      });
      if (createErr) throw createErr;

      const newUserId = createData.user.id;

      // Upsert into profiles for Manager with institution_id: null
      if (role === 'manager' || primaryEmail.includes('manager')) {
        await supabaseAdmin.from('profiles').upsert({
          id: newUserId,
          institution_id: null,
          role: 'manager',
          full_name: full_name || 'System Manager',
          email: primaryEmail,
          is_active: true,
          ...(permissions ? { permissions } : {})
        });
      }

      if (instData?.id) {
        await supabaseAdmin
          .from('institutions')
          .update({ email: primaryEmail, login_code: primaryEmail })
          .eq('id', instData.id);
      }

      return res.status(200).json({ success: true, user_id: newUserId, message: 'নতুন অথেন্টিকেশন একাউন্ট তৈরি করে পাসওয়ার্ড পরিবর্তন করা হয়েছে!' });
    }

    return res.status(404).json({ error: 'কোনো ব্যবহারকারী পাওয়া যায়নি।' });

  } catch (err: any) {
    console.error('Admin password update error:', err);
    return res.status(500).json({ error: err.message || 'পাসওয়ার্ড পরিবর্তন করতে ব্যর্থ হয়েছে।' });
  }
}
