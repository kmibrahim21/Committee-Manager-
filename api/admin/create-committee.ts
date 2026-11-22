import { getSupabaseAdmin } from '../../lib/supabase-admin.js';

const ACCOUNT_TYPE_DEFAULT_MODULES: Record<string, Record<string, boolean>> = {
  committee: {
    departments: true,
    attendance: true,
    meetings: true,
    minutes: true,
    events: true,
    accounting: true,
    voice_broadcast: true,
    sms: true,
    polls: true,
    notices: true,
  },
  association: {
    departments: false,
    attendance: true,
    meetings: true,
    minutes: true,
    events: false,
    accounting: true,
    voice_broadcast: true,
    sms: true,
    polls: true,
    notices: true,
    savings: true,
    loans: true,
    installments: true,
    profit_distribution: true,
  },
  organization: {
    departments: true,
    attendance: true,
    meetings: true,
    minutes: true,
    events: true,
    accounting: true,
    voice_broadcast: true,
    sms: true,
    polls: true,
    notices: true,
    employees: true,
    volunteers: true,
    tasks: true,
    projects: true,
    payroll: true,
  },
  club: {
    departments: false,
    attendance: true,
    meetings: true,
    minutes: true,
    events: true,
    accounting: true,
    voice_broadcast: true,
    sms: true,
    polls: true,
    notices: true,
    tournaments: true,
    gallery: true,
    certificates: true,
  },
  foundation: {
    departments: false,
    attendance: true,
    meetings: true,
    minutes: true,
    events: true,
    accounting: true,
    voice_broadcast: true,
    sms: true,
    polls: true,
    notices: true,
    donations: true,
    beneficiaries: true,
    welfare: true,
    scholarships: true,
    projects: true,
  },
  trust: {
    departments: false,
    attendance: true,
    meetings: true,
    minutes: true,
    events: false,
    accounting: true,
    voice_broadcast: true,
    sms: true,
    polls: false,
    notices: true,
    trustees: true,
    properties: true,
    assets: true,
    legal_documents: true,
  },
  council: {
    departments: true,
    attendance: true,
    meetings: true,
    minutes: true,
    events: true,
    accounting: true,
    voice_broadcast: true,
    sms: true,
    polls: true,
    notices: true,
    regional_mgmt: true,
    election: true,
  },
  union: {
    departments: false,
    attendance: true,
    meetings: true,
    minutes: true,
    events: true,
    accounting: true,
    voice_broadcast: true,
    sms: true,
    polls: true,
    notices: true,
    wards: true,
    citizen_services: true,
    trade_license: true,
    holding_tax: true,
  },
  sangha: {
    departments: true,
    attendance: true,
    meetings: true,
    minutes: true,
    events: true,
    accounting: true,
    voice_broadcast: true,
    sms: true,
    polls: true,
    notices: true,
    social_activities: true,
    youth_wing: true,
    library: true,
  },
  somiti: {
    departments: false,
    attendance: true,
    meetings: true,
    minutes: true,
    events: false,
    accounting: true,
    voice_broadcast: true,
    sms: true,
    polls: true,
    notices: true,
    savings: true,
    loans: true,
    installments: true,
    profit_distribution: true,
  },
  madrasah: {
    departments: true,
    attendance: true,
    meetings: true,
    minutes: true,
    events: true,
    accounting: true,
    voice_broadcast: true,
    sms: true,
    polls: true,
    notices: true,
  }
};

export default async function handler(req: any, res: any) {
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

  const { email, password, name, phone, login_code, type, auth_token, songho_activities } = body;

  if (!email || !password || !name) {
    return res.status(400).json({ error: 'Email, password, and name are required' });
  }

  try {
    const supabaseAdmin = getSupabaseAdmin();

    // 1. Unconditionally require and verify super_admin token
    const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
    const token = (typeof authHeader === 'string' && authHeader.startsWith('Bearer '))
      ? authHeader.slice(7).trim()
      : (auth_token ? String(auth_token).trim() : '');

    if (!token) {
      return res.status(401).json({ error: 'Unauthorized: Missing authentication token' });
    }

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Unauthorized: Invalid authentication session' });
    }

    const [{ data: profile }, { data: inst }] = await Promise.all([
      supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .maybeSingle(),
      supabaseAdmin
        .from('institutions')
        .select('is_super_admin')
        .eq('id', user.id)
        .maybeSingle()
    ]);

    const isSuper = profile?.role === 'super_admin' || inst?.is_super_admin === true;
    if (!isSuper) {
      return res.status(403).json({ error: 'Forbidden: Super Admin access required' });
    }

    // 2. Create User in Supabase Auth
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email: email.trim(),
      password: password.trim(),
      email_confirm: true,
      user_metadata: { name: name.trim(), madrasah_name: name.trim() }
    });

    if (createError) {
      return res.status(400).json({ error: createError.message });
    }

    if (!newUser?.user) {
      return res.status(500).json({ error: 'Failed to create user record' });
    }

    const userId = newUser.user.id;

    // 3. Configure default settings
    const defaultModules = ACCOUNT_TYPE_DEFAULT_MODULES[type || 'committee'] || ACCOUNT_TYPE_DEFAULT_MODULES.committee;
    const default_config: Record<string, any> = {
      modules: defaultModules,
      org_type: type || 'committee',
      attendance_type: 'meeting',
      fee_structure: 'monthly',
      ui_mode: 'committee'
    };

    if (type === 'sangha' || type === 'union') {
      default_config.songho_activities = (Array.isArray(songho_activities) && songho_activities.length > 0)
        ? songho_activities
        : ['islamic', 'youth', 'social', 'welfare'];
    }

    // 4. Ensure Institution record is upserted
    const { error: instError } = await supabaseAdmin.from('institutions').upsert({
      id: userId,
      name: name.trim(),
      email: email.trim(),
      phone: phone?.trim() || null,
      institution_type: type || 'committee',
      login_code: login_code?.trim() || null,
      is_active: true,
      is_super_admin: false,
      balance: 0,
      sms_balance: 0,
      status: 'active',
      config_json: default_config
    });

    if (instError) {
      console.warn('Upsert institution error:', instError);
    }

    // 5. Ensure Profile record is upserted
    await supabaseAdmin.from('profiles').upsert({
      id: userId,
      institution_id: userId,
      full_name: name.trim(),
      role: 'org_admin',
      is_active: true
    });

    return res.status(200).json({
      success: true,
      userId: userId,
      message: 'Committee and user created successfully'
    });
  } catch (error: any) {
    console.error('Create Committee API Error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
