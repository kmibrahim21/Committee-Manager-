import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fetch from "node-fetch";
import FormData from "form-data";

dotenv.config();

const app = express();
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

const PORT = 3000;

// Supabase Admin Client
const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || "",
  process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || "",
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

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
    results: true,
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
    results: false,
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
    results: true,
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
    results: false,
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
    results: false,
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
    results: false,
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
    results: true,
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
    results: false,
    polls: true,
    notices: true,
    welfare_fund: true,
    legal_support: true,
    training: true,
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
    results: false,
    polls: true,
    notices: true,
    volunteers: true,
    projects: true,
  },
  forum: {
    departments: false,
    attendance: true,
    meetings: true,
    minutes: true,
    events: true,
    accounting: true,
    voice_broadcast: true,
    sms: true,
    results: false,
    polls: true,
    notices: true,
    discussions: true,
  },
  society: {
    departments: false,
    attendance: true,
    meetings: true,
    minutes: true,
    events: true,
    accounting: true,
    voice_broadcast: true,
    sms: true,
    results: false,
    polls: true,
    notices: true,
    election: true,
  },
  federation: {
    departments: true,
    attendance: true,
    meetings: true,
    minutes: true,
    events: true,
    accounting: true,
    voice_broadcast: true,
    sms: true,
    results: true,
    polls: true,
    notices: true,
    multi_org: true,
    branches: true,
    delegates: true,
    conferences: true,
  },
  governing_board: {
    departments: true,
    attendance: true,
    meetings: true,
    minutes: true,
    events: true,
    accounting: true,
    voice_broadcast: true,
    sms: true,
    results: true,
    polls: true,
    notices: true,
    institutions: true,
    board_members: true,
  },
  ngo: {
    departments: true,
    attendance: true,
    meetings: true,
    minutes: true,
    events: true,
    accounting: true,
    voice_broadcast: true,
    sms: true,
    results: false,
    polls: true,
    notices: true,
    volunteers: true,
    beneficiaries: true,
    relief_mgmt: true,
    donations: true,
    projects: true,
    monitoring: true,
    gps_tracking: true,
  },
};

// API Routes
app.all("/api/awaj*all", async (req, res) => {
  const AWAJ_BASE_URL = 'https://api.awajdigital.com/api';
  const token = process.env.AWAJ_API_TOKEN;
  
  if (!token) {
    return res.status(500).json({ error: "AWAJ_API_TOKEN is not set" });
  }

  const getAwajHeaders = (contentType = 'application/json') => ({
    'Authorization': `Bearer ${token}`,
    'Accept': 'application/json',
    'Content-Type': contentType
  });

  const urlParts = req.path.split('/').filter(Boolean);
  const action = urlParts[2]; // /api/awaj/:action
  const subAction = urlParts[3];

  try {
    if (action === "voices") {
      if (req.method === "GET") {
        const response = await fetch(`${AWAJ_BASE_URL}/voices`, { headers: getAwajHeaders() as any });
        return res.status(response.status).json(await response.json());
      }
      
      if (req.method === "POST") {
        const { name, file_url, file_base64, filename, content_type } = req.body;
        let fileBuffer: Buffer | null = null;
        let contentType = content_type || 'audio/mpeg';
        let fName = filename || 'voice.mp3';

        if (file_base64) {
          fileBuffer = Buffer.from(file_base64, 'base64');
        } else if (file_url) {
          const fileRes = await fetch(file_url);
          const ab = await fileRes.arrayBuffer();
          fileBuffer = Buffer.from(ab);
          contentType = fileRes.headers.get('content-type') || contentType;
          const ext = file_url.split('.').pop()?.split('?')[0] || 'mp3';
          fName = `voice.${ext}`;
        }

        if (fileBuffer) {
          const formData = new FormData();
          formData.append('name', name || 'Voice Upload');
          formData.append('audio', fileBuffer, { filename: fName, contentType });
          formData.append('file', fileBuffer, { filename: fName, contentType });
          
          const response = await fetch(`${AWAJ_BASE_URL}/voices/upload`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, ...formData.getHeaders() },
            body: formData
          });
          const data = await response.json();
          return res.status(response.status).json(data);
        } else {
          return res.status(400).json({ error: "Missing audio file or file_url" });
        }
      }

      if (req.method === "DELETE" && subAction) {
        const response = await fetch(`${AWAJ_BASE_URL}/voices/${subAction}`, {
          method: 'DELETE',
          headers: getAwajHeaders() as any
        });
        return res.status(response.status).json(await response.json());
      }
    }

    if (action === "broadcast" || action === "broadcasts") {
      // Direct voice broadcast: POST /api/awaj/broadcast/direct or /api/awaj/broadcasts/direct
      if (req.method === "POST" && subAction === "direct") {
        const response = await fetch(`${AWAJ_BASE_URL}/broadcasts/direct`, {
          method: 'POST',
          headers: getAwajHeaders() as any,
          body: JSON.stringify(req.body)
        });
        const data = await response.json();
        return res.status(response.status).json(data);
      }

      // OTP broadcast: POST /api/awaj/broadcast/otp or /api/awaj/broadcasts/otp
      if (req.method === "POST" && subAction === "otp") {
        const response = await fetch(`${AWAJ_BASE_URL}/broadcasts/otp`, {
          method: 'POST',
          headers: getAwajHeaders() as any,
          body: JSON.stringify(req.body)
        });
        const data = await response.json();
        return res.status(response.status).json(data);
      }

      if (req.method === "POST") {
        const response = await fetch(`${AWAJ_BASE_URL}/broadcasts`, {
          method: 'POST',
          headers: getAwajHeaders() as any,
          body: JSON.stringify(req.body)
        });
        const data = await response.json();
        return res.status(response.status).json(data);
      }

      if (req.method === "GET") {
        if (subAction) {
          // Try result endpoint first
          let response = await fetch(`${AWAJ_BASE_URL}/broadcasts/${subAction}/result`, { headers: getAwajHeaders() as any });
          if (response.status === 404) {
            response = await fetch(`${AWAJ_BASE_URL}/broadcasts/${subAction}`, { headers: getAwajHeaders() as any });
          }
          return res.status(response.status).json(await response.json());
        } else {
          // Forward query parameters
          const queryString = new URLSearchParams(req.query as any).toString();
          const targetUrl = queryString ? `${AWAJ_BASE_URL}/broadcasts?${queryString}` : `${AWAJ_BASE_URL}/broadcasts`;
          const response = await fetch(targetUrl, { headers: getAwajHeaders() as any });
          return res.status(response.status).json(await response.json());
        }
      }
    }

    if (action === "broadcast-result") {
      const id = req.query.id || subAction;
      if (!id) return res.status(400).json({ error: "ID is required" });
      let response = await fetch(`${AWAJ_BASE_URL}/broadcasts/${id}/result`, { headers: getAwajHeaders() as any });
      if (response.status === 404) {
        response = await fetch(`${AWAJ_BASE_URL}/broadcasts/${id}`, { headers: getAwajHeaders() as any });
      }
      return res.status(response.status).json(await response.json());
    }

    if (action === "senders") {
      const response = await fetch(`${AWAJ_BASE_URL}/senders`, { headers: getAwajHeaders() as any });
      return res.status(response.status).json(await response.json());
    }

    if (action === "balance") {
      const response = await fetch(`${AWAJ_BASE_URL}/balance`, { headers: getAwajHeaders() as any });
      return res.status(response.status).json(await response.json());
    }

    if (action === "refund") {
      const { campaign_id, institution_id, rate_per_call } = req.body;
      if (!campaign_id || !institution_id) return res.status(400).json({ error: "Missing parameters" });

      // 1. Get broadcast result from Awaj
      const response = await fetch(`${AWAJ_BASE_URL}/broadcasts/${campaign_id}/result`, { headers: getAwajHeaders() as any });
      if (!response.ok) return res.status(response.status).json({ error: "Failed to fetch result" });
      
      const result: any = await response.json();
      const logs = result.calls || result.logs || [];
      const failedCount = logs.filter((c: any) => c.status === 'failed' || c.status === 'no-answer').length;

      if (failedCount > 0) {
        const refundAmount = failedCount * (rate_per_call || 1.0);
        
        // 2. Add balance to institution via RPC
        const { error } = await supabaseAdmin.rpc('add_balance', {
          p_institution_id: institution_id,
          p_amount: refundAmount
        });

        if (error) throw error;

        // 3. Mark as refunded in broadcast history (optional but good)
        await supabaseAdmin.from('voice_broadcasts').update({
          refunded_amount: refundAmount,
          status: 'completed'
        }).eq('provider_campaign_id', campaign_id);

        return res.json({ success: true, refunded: refundAmount, failed_count: failedCount });
      }

      return res.json({ success: true, refunded: 0 });
    }

    res.status(404).json({ error: "Action not found" });
  } catch (error: any) {
    console.error("Awaj API Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/gemini/generate-minutes", async (req, res) => {
  try {
    const { title, agendas, description } = req.body;
    
    const prompt = `
      You are an expert secretary for an educational institution (Madrasah). 
      Generate detailed meeting minutes based on the following information:
      
      Meeting Title: ${title}
      Agendas: ${agendas.join(", ")}
      Description: ${description}
      
      Please write a professional summary in Bengali (as the primary language) and English. 
      The report should include:
      1. Intro: Purpose of the meeting.
      2. Highlights: Each agenda item discussed.
      3. Conclusions: Final decisions taken.
      
      Keep it structured and formal.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: prompt,
    });

    res.json({ minutes: response.text });
  } catch (error) {
    console.error("Gemini Error:", error);
    res.status(500).json({ error: "Failed to generate minutes" });
  }
});

app.post("/api/admin/create-committee", async (req, res) => {
  const { email, password, name, phone, login_code, type, auth_token, songho_activities } = req.body;
  
  try {
    // 1. Verify requester is super admin
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(auth_token);
    if (authError || !user) {
      return res.status(401).json({ error: "Unauthorized: Invalid token" });
    }
    
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
      
    if (profileError || profile?.role !== 'super_admin') {
      return res.status(403).json({ error: "Forbidden: Not a super admin" });
    }

    // 2. Create User
    const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name, madrasah_name: name }
    });

    if (createError) throw createError;

    // 3. Update the institution record with specific details (the trigger handles creation)
    // Wait a bit for the trigger
    await new Promise(resolve => setTimeout(resolve, 500));

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

    const { error: updateError } = await supabaseAdmin.from('institutions').update({
      phone,
      institution_type: type || 'committee',
      login_code: login_code || null,
      is_active: true,
      status: 'active',
      config_json: default_config
    }).eq('id', newUser.user.id);
    
    if (updateError) {
      console.warn("Update error (retrying with upsert):", updateError);
      // Fallback in case trigger was slow or failed
      await supabaseAdmin.from('institutions').upsert({
        id: newUser.user.id,
        name: name,
        email: email,
        phone: phone,
        institution_type: type || 'committee',
        login_code: login_code || null,
        is_active: true,
        is_super_admin: false,
        balance: 0,
        sms_balance: 0,
        status: 'active',
        config_json: default_config
      });
      
      await supabaseAdmin.from('profiles').upsert({
        id: newUser.user.id,
        institution_id: newUser.user.id,
        full_name: name,
        role: 'org_admin',
        is_active: true
      });
    }

    res.json({ success: true, userId: newUser.user.id });
  } catch (error: any) {
    console.error("Create Committee Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/auth/reset-password", async (req, res) => {
  const { email, new_password } = req.body;
  if (!email || !new_password) {
    return res.status(400).json({ error: "ইমেইল এবং নতুন পাসওয়ার্ড প্রদান করুন।" });
  }

  if (new_password.length < 6) {
    return res.status(400).json({ error: "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।" });
  }

  try {
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;

    const user = (users as any[]).find((u: any) => u.email?.toLowerCase() === email.trim().toLowerCase());
    if (!user) {
      return res.status(404).json({ error: "এই ইমেইলে কোনো একাউন্ট পাওয়া যায়নি।" });
    }

    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
      password: new_password.trim(),
      email_confirm: true
    });
    if (updateError) throw updateError;

    res.json({ success: true, message: "পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে!" });
  } catch (err: any) {
    console.error("Password reset error:", err);
    res.status(500).json({ error: err.message || "Failed to reset password" });
  }
});

app.post("/api/admin/update-user-password", async (req, res) => {
  const { user_id, email, new_password, auth_token } = req.body;
  
  if (!new_password || new_password.trim().length < 6) {
    return res.status(400).json({ error: "পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।" });
  }

  try {
    // 1. Verify requester is admin if auth_token passed
    if (auth_token) {
      const { data: { user: requester }, error: tokenErr } = await supabaseAdmin.auth.getUser(auth_token);
      if (tokenErr || !requester) {
        return res.status(401).json({ error: "অননুমোদিত অ্যাক্সেস" });
      }
      const { data: requesterProfile } = await supabaseAdmin
        .from('profiles')
        .select('role')
        .eq('id', requester.id)
        .single();
      if (requesterProfile?.role !== 'super_admin' && requesterProfile?.role !== 'manager') {
        return res.status(403).json({ error: "শুধুমাত্র সুপার অ্যাডমিন অথবা ম্যানেজার পাসওয়ার্ড পরিবর্তন করতে পারেন।" });
      }
    }

    // 2. Fetch list of auth users to find matching user
    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
    if (listError) throw listError;

    let targetUser: any = null;

    // Try finding by user_id
    if (user_id) {
      targetUser = users.find((u: any) => u.id === user_id);
    }

    // If not found by user_id, search by email
    const searchEmail = email?.trim()?.toLowerCase();
    if (!targetUser && searchEmail) {
      targetUser = users.find((u: any) => u.email?.toLowerCase() === searchEmail);
    }

    // If still not found, check if user_id was an institution ID
    if (!targetUser && user_id) {
      const { data: instData } = await supabaseAdmin
        .from('institutions')
        .select('email, name')
        .eq('id', user_id)
        .maybeSingle();

      if (instData?.email) {
        targetUser = users.find((u: any) => u.email?.toLowerCase() === instData.email.toLowerCase());
      }

      // If still not found, check profiles
      if (!targetUser) {
        const { data: profData } = await supabaseAdmin
          .from('profiles')
          .select('id, full_name')
          .or(`id.eq.${user_id},institution_id.eq.${user_id}`)
          .maybeSingle();

        if (profData?.id) {
          targetUser = users.find((u: any) => u.id === profData.id);
        }
      }
    }

    if (targetUser) {
      // Update existing auth user password
      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(targetUser.id, {
        password: new_password.trim(),
        email_confirm: true
      });
      if (updateErr) throw updateErr;

      // Also call update_user_by_admin RPC as secondary sync
      try {
        await supabaseAdmin.rpc("update_user_by_admin", {
          p_user_id: targetUser.id,
          p_password: new_password.trim()
        });
      } catch (rpcErr) {
        console.warn("Secondary RPC error:", rpcErr);
      }

      return res.json({ success: true, message: "পাসওয়ার্ড সফলভাবে পরিবর্তন করা হয়েছে!" });
    }

    // If user doesn't exist in auth yet (legacy record), create user with this email & password
    let effectiveEmail = searchEmail;
    if (!effectiveEmail && user_id) {
      const { data: inst } = await supabaseAdmin.from('institutions').select('email').eq('id', user_id).maybeSingle();
      effectiveEmail = inst?.email?.toLowerCase();
    }

    if (effectiveEmail) {
      const { error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: effectiveEmail,
        password: new_password.trim(),
        email_confirm: true
      });
      if (createErr) throw createErr;

      return res.json({ success: true, message: "নতুন অথেন্টিকেশন একাউন্ট তৈরি করে পাসওয়ার্ড সেট করা হয়েছে!" });
    }

    return res.status(404).json({ error: "কোনো ব্যবহারকারী পাওয়া যায়নি।" });
  } catch (err: any) {
    console.error("Admin password update error:", err);
    res.status(500).json({ error: err.message || "পাসওয়ার্ড পরিবর্তন করতে ব্যর্থ হয়েছে।" });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get("*all", (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
