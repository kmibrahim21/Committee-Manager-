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

import authHandler from "./api/auth";
import executivesHandler from "./api/executives";
import smsSendHandler from "./api/sms/send";
import createCommitteeHandler from "./api/admin/create-committee";
import updateUserPasswordHandler from "./api/admin/update-user-password";
import systemSettingsHandler from "./api/admin/system-settings";
import { isSafePublicHttpsUrl } from "./api/awaj";

// API Routes
app.all("/api/auth", (req, res) => authHandler(req as any, res as any));
app.all("/api/executives*all", (req, res) => executivesHandler(req, res));
app.all("/api/teachers*all", (req, res) => executivesHandler(req, res));
app.all("/api/sms/send", (req, res) => smsSendHandler(req as any, res as any));
app.all("/api/admin/create-committee", (req, res) => createCommitteeHandler(req, res));
app.all("/api/admin/update-user-password", (req, res) => updateUserPasswordHandler(req, res));
app.all("/api/admin/system-settings", (req, res) => systemSettingsHandler(req, res));

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
  const action = urlParts[2] || (req.query.action as string) || 'voices'; // /api/awaj/:action
  const subAction = urlParts[3] || (req.query.id as string);

  try {
    // Require valid authenticated Supabase session for all non-webhook actions
    if (action !== "webhook") {
      const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
      const bodyToken = req.body?.auth_token;
      const userToken = (typeof authHeader === 'string' && authHeader.startsWith('Bearer '))
        ? authHeader.slice(7).trim()
        : (bodyToken ? String(bodyToken).trim() : '');

      if (!userToken) {
        return res.status(401).json({ error: "Unauthorized: Missing Bearer token" });
      }

      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(userToken);
      if (authError || !user) {
        return res.status(401).json({ error: "Unauthorized: Invalid or expired session token" });
      }
    }

    if (action === "voices") {
      if (req.method === "GET") {
        const response = await fetch(`${AWAJ_BASE_URL}/voices`, { headers: getAwajHeaders() as any });
        return res.status(response.status).json(await response.json());
      }
      
      if (req.method === "POST") {
        const { name, file_url, file_base64, filename, content_type } = req.body || {};
        let fileBuffer: Buffer | null = null;
        let contentType = content_type || 'audio/mpeg';
        let fName = filename || 'voice.mp3';

        if (file_base64) {
          fileBuffer = Buffer.from(file_base64, 'base64');
        } else if (file_url) {
          if (!isSafePublicHttpsUrl(String(file_url))) {
            return res.status(400).json({ error: "Invalid file_url: Only public HTTPS URLs are permitted" });
          }
          const fileRes = await fetch(file_url);
          if (!fileRes.ok) throw new Error(`Failed to download file: ${fileRes.statusText}`);
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
      if (req.method === "POST" && subAction === "direct") {
        const response = await fetch(`${AWAJ_BASE_URL}/broadcasts/direct`, {
          method: 'POST',
          headers: getAwajHeaders() as any,
          body: JSON.stringify(req.body)
        });
        const data = await response.json();
        return res.status(response.status).json(data);
      }

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
          let response = await fetch(`${AWAJ_BASE_URL}/broadcasts/${subAction}/result`, { headers: getAwajHeaders() as any });
          if (response.status === 404) {
            response = await fetch(`${AWAJ_BASE_URL}/broadcasts/${subAction}`, { headers: getAwajHeaders() as any });
          }
          return res.status(response.status).json(await response.json());
        } else {
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
      const { campaign_id, institution_id, rate_per_call } = req.body || {};
      if (!campaign_id || !institution_id) return res.status(400).json({ error: "Missing parameters" });

      const response = await fetch(`${AWAJ_BASE_URL}/broadcasts/${campaign_id}/result`, { headers: getAwajHeaders() as any });
      if (!response.ok) return res.status(response.status).json({ error: "Failed to fetch result" });
      
      const result: any = await response.json();
      const logs = result.calls || result.logs || [];
      const failedCount = logs.filter((c: any) => c.status === 'failed' || c.status === 'no-answer').length;

      if (failedCount > 0) {
        const refundAmount = failedCount * (rate_per_call || 1.0);
        const { error } = await supabaseAdmin.rpc('add_balance', {
          p_institution_id: institution_id,
          p_amount: refundAmount
        });

        if (error) throw error;

        await supabaseAdmin.from('voice_broadcasts').update({
          refunded_amount: refundAmount,
          status: 'completed'
        }).eq('provider_campaign_id', campaign_id);

        return res.json({ success: true, refunded: refundAmount, failed_count: failedCount });
      }

      return res.json({ success: true, refunded: 0 });
    }

    if (action === "webhook") {
      return res.status(200).json({ received: true });
    }

    res.status(404).json({ error: "Action not found" });
  } catch (error: any) {
    console.error("Awaj API Error:", error);
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/gemini/generate-minutes", async (req, res) => {
  try {
    const { title, agendas, agenda, description, notes, date, lang } = req.body || {};
    const agendaText = Array.isArray(agendas) ? agendas.join(", ") : (agenda || "");
    const notesText = description || notes || "";

    const prompt = `
      You are an expert secretary for an organization / committee.
      Generate detailed meeting minutes based on the following information:
      
      Meeting Title: ${title || ""}
      Date: ${date || ""}
      Agendas: ${agendaText}
      Notes / Description: ${notesText}
      Language: ${lang === 'en' ? 'English' : 'Bengali'}
      
      Please write a professional summary with clear sections:
      1. Intro: Purpose of the meeting.
      2. Highlights: Each agenda item discussed.
      3. Conclusions: Final decisions and action items taken.
      
      Keep it structured and formal.
    `;

    const response = await ai.models.generateContent({
      model: "gemini-4-hydrogen",
      contents: prompt,
    });

    res.json({ minutes: response.text });
  } catch (error) {
    console.error("Gemini Error:", error);
    res.status(500).json({ error: "Failed to generate minutes" });
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
