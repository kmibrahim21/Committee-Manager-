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

  const { email, new_password } = body;

  if (!email || !email.trim() || !new_password || !new_password.trim()) {
    return res.status(400).json({ error: 'ইমেইল এবং নতুন পাসওয়ার্ড প্রদান করুন।' });
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanPassword = new_password.trim();

  if (cleanPassword.length < 6) {
    return res.status(400).json({ error: 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।' });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();

    // 1. Fetch users from Supabase Auth admin
    let targetUser: any = null;
    try {
      const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (!listError && users) {
        targetUser = users.find((u: any) => u.email?.toLowerCase() === cleanEmail);
      }
    } catch (listErr) {
      console.warn('Error listing auth users:', listErr);
    }

    // 2. If not found in Auth, check institutions table by email
    let instRecord: any = null;
    if (!targetUser) {
      const { data: instData } = await supabaseAdmin
        .from('institutions')
        .select('id, email, name')
        .or(`email.ilike.${cleanEmail},login_code.ilike.${cleanEmail}`)
        .maybeSingle();

      if (instData) {
        instRecord = instData;
        // Check if there is an auth user with institution's ID
        try {
          const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(instData.id);
          if (user) targetUser = user;
        } catch {
          // not found by id
        }
      }
    }

    // 3. If target user exists in Auth, update password
    if (targetUser) {
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(targetUser.id, {
        password: cleanPassword,
        email_confirm: true
      });
      if (updateError) throw updateError;

      // Sync RPC if available
      try {
        await supabaseAdmin.rpc('update_user_by_admin', {
          p_user_id: targetUser.id,
          p_password: cleanPassword
        });
      } catch {
        // secondary sync optional
      }

      return res.status(200).json({ success: true, message: 'পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে!' });
    }

    // 4. If user not in Auth yet, but exists in institutions/profiles, create Auth user so they can log in
    if (instRecord) {
      const { error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: cleanEmail,
        password: cleanPassword,
        email_confirm: true,
        user_metadata: { name: instRecord.name }
      });
      if (createError) throw createError;

      return res.status(200).json({ success: true, message: 'পাসওয়ার্ড সফলভাবে সেট করা হয়েছে!' });
    }

    // 5. If not found anywhere
    return res.status(404).json({ error: 'এই ইমেইলে কোনো একাউন্ট পাওয়া যায়নি। সঠিক ইমেইল প্রদান করুন।' });

  } catch (err: any) {
    console.error('Password reset handler error:', err);
    return res.status(500).json({ error: err.message || 'পাসওয়ার্ড রিসেট করতে ব্যর্থ হয়েছে।' });
  }
}
