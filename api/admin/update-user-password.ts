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

  const { user_id, email, new_password, auth_token } = body;

  if (!new_password || new_password.trim().length < 6) {
    return res.status(400).json({ error: 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।' });
  }

  const cleanPassword = new_password.trim();
  const searchEmail = email?.trim()?.toLowerCase();

  try {
    const supabaseAdmin = getSupabaseAdmin();

    // 1. Verify requester is admin if auth_token passed
    if (auth_token) {
      const { data: { user: requester }, error: tokenErr } = await supabaseAdmin.auth.getUser(auth_token);
      if (tokenErr || !requester) {
        return res.status(401).json({ error: 'অননুমোদিত অ্যাক্সেস' });
      }
      const { data: requesterProfile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', requester.id)
        .maybeSingle();

      if (requesterProfile?.role !== 'super_admin' && requesterProfile?.role !== 'manager') {
        return res.status(403).json({ error: 'শুধুমাত্র সুপার অ্যাডমিন অথবা ম্যানেজার পাসওয়ার্ড পরিবর্তন করতে পারেন।' });
      }
    }

    // 2. Fetch list of auth users (paginated with 1000 items)
    let targetUser: any = null;

    // Try finding by user_id directly first
    if (user_id) {
      try {
        const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(user_id);
        if (user) targetUser = user;
      } catch {
        // user_id might be institution id
      }
    }

    // If not found yet, query list of users
    if (!targetUser) {
      const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (!listError && users) {
        if (user_id) {
          targetUser = users.find((u: any) => u.id === user_id);
        }
        if (!targetUser && searchEmail) {
          targetUser = users.find((u: any) => u.email?.toLowerCase() === searchEmail);
        }
      }
    }

    // If still not found, check if user_id was an institution ID
    if (!targetUser && user_id) {
      const { data: instData } = await supabaseAdmin
        .from('institutions')
        .select('email, name')
        .eq('id', user_id)
        .maybeSingle();

      if (instData?.email) {
        const instEmail = instData.email.toLowerCase();
        const { data: { users } } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
        if (users) {
          targetUser = users.find((u: any) => u.email?.toLowerCase() === instEmail);
        }
      }

      // If still not found, check profiles
      if (!targetUser) {
        const { data: profData } = await supabaseAdmin
          .from('profiles')
          .select('id, full_name')
          .or(`id.eq.${user_id},institution_id.eq.${user_id}`)
          .maybeSingle();

        if (profData?.id) {
          try {
            const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(profData.id);
            if (user) targetUser = user;
          } catch {
            // ignore
          }
        }
      }
    }

    if (targetUser) {
      // Update existing auth user password
      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(targetUser.id, {
        password: cleanPassword,
        email_confirm: true
      });
      if (updateErr) throw updateErr;

      // Also call update_user_by_admin RPC as secondary sync if exists
      try {
        await supabaseAdmin.rpc('update_user_by_admin', {
          p_user_id: targetUser.id,
          p_password: cleanPassword
        });
      } catch (rpcErr) {
        console.warn('Secondary RPC sync notice:', rpcErr);
      }

      return res.status(200).json({ success: true, message: 'পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে!' });
    }

    // If user doesn't exist in auth yet (legacy record), create user with this email & password
    let effectiveEmail = searchEmail;
    if (!effectiveEmail && user_id) {
      const { data: inst } = await supabaseAdmin.from('institutions').select('email, name').eq('id', user_id).maybeSingle();
      effectiveEmail = inst?.email?.toLowerCase();
    }

    if (effectiveEmail) {
      const { error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: effectiveEmail,
        password: cleanPassword,
        email_confirm: true
      });
      if (createErr) throw createErr;

      return res.status(200).json({ success: true, message: 'নতুন অথেন্টিকেশন একাউন্ট তৈরি করে পাসওয়ার্ড সেট করা হয়েছে!' });
    }

    return res.status(404).json({ error: 'কোনো ব্যবহারকারী পাওয়া যায়নি।' });
  } catch (err: any) {
    console.error('Admin password update error:', err);
    return res.status(500).json({ error: err.message || 'পাসওয়ার্ড পরিবর্তন করতে ব্যর্থ হয়েছে।' });
  }
}
