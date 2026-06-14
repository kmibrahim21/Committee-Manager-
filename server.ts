import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());

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

// API Routes
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
      model: "gemini-3.5-flash",
      contents: prompt,
    });

    res.json({ minutes: response.text });
  } catch (error) {
    console.error("Gemini Error:", error);
    res.status(500).json({ error: "Failed to generate minutes" });
  }
});

app.post("/api/admin/create-committee", async (req, res) => {
  const { email, password, name, phone, login_code, type, auth_token } = req.body;
  
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

    const { error: updateError } = await supabaseAdmin.from('institutions').update({
      phone,
      institution_type: type || 'committee',
      login_code: login_code || null,
      is_active: true,
      status: 'active'
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
        status: 'active'
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
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
