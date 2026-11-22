import type { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';
import FormData from 'form-data';
import { Buffer } from 'node:buffer';
import { getSupabaseAdmin } from '../lib/supabase-admin.js';

const AWAJ_BASE_URL = 'https://api.awajdigital.com/api';

const getAwajHeaders = () => {
  const token = process.env.AWAJ_API_TOKEN;
  if (!token) {
    console.error('AWAJ_API_TOKEN is not set in environment variables');
  }
  return {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  };
};

export function isSafePublicHttpsUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '');
    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '0.0.0.0' ||
      host === '::1' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      host.startsWith('127.') ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      host.startsWith('169.254.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host) ||
      host.startsWith('fc') ||
      host.startsWith('fd') ||
      host.startsWith('fe80:')
    ) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  const parts = pathname.split('/').filter(Boolean);
  
  // More robust action detection
  let action = parts[2]; // e.g. 'voices', 'broadcast', 'senders', etc.
  if (parts[1] === 'awaj' && !action) {
    action = (req.query.action as string) || 'voices';
  }
  const subAction = parts[3] || (req.query.id as string);

  try {
    // Parse string body early if needed
    if (req.body && typeof req.body === 'string' && req.body.trim().startsWith('{')) {
      try {
        req.body = JSON.parse(req.body);
      } catch (e) {
        console.warn('Failed to parse req.body as JSON in awaj API:', e);
      }
    }

    // Require valid authenticated Supabase session for all non-webhook actions
    if (action !== 'webhook') {
      const authHeader = req.headers?.authorization || req.headers?.Authorization || '';
      const bodyToken = (req.body as any)?.auth_token;
      const token = (typeof authHeader === 'string' && authHeader.startsWith('Bearer '))
        ? authHeader.slice(7).trim()
        : (bodyToken ? String(bodyToken).trim() : '');

      if (!token) {
        return res.status(401).json({ error: 'Unauthorized: Missing Bearer token' });
      }

      const supabaseAdmin = getSupabaseAdmin();
      const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
      if (authError || !user) {
        return res.status(401).json({ error: 'Unauthorized: Invalid or expired session token' });
      }
    }

    // VOICES
    if (action === 'voices') {
      if (req.method === 'GET') {
        const response = await fetch(`${AWAJ_BASE_URL}/voices`, { headers: getAwajHeaders() as any });
        if (!response.ok) throw new Error(`Awaj API Error: ${response.statusText}`);
        const data = await response.json();
        return res.status(200).json(data);
      }
      if (req.method === 'POST') {
        const body = req.body || {};
        const { name, file_url, file_base64, filename, content_type } = body;
        let fileBuffer: Buffer | null = null;
        let contentType = content_type || 'audio/mpeg';
        let fName = filename || 'voice.mp3';

        if (file_base64) {
          fileBuffer = Buffer.from(file_base64, 'base64');
        } else if (file_url) {
          if (!isSafePublicHttpsUrl(String(file_url))) {
            return res.status(400).json({ error: 'Invalid file_url: Only public HTTPS URLs are permitted' });
          }
          const fileRes = await fetch(file_url);
          if (!fileRes.ok) throw new Error(`Failed to download file: ${fileRes.statusText}`);
          const ab = await fileRes.arrayBuffer();
          fileBuffer = Buffer.from(new Uint8Array(ab));
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
            headers: { 'Authorization': `Bearer ${process.env.AWAJ_API_TOKEN}`, 'Accept': 'application/json', ...formData.getHeaders() },
            body: formData
          });
          const data = await response.json();
          if (!response.ok) return res.status(response.status).json(data);
          return res.status(200).json(data);
        } else {
          return res.status(400).json({ error: "Missing audio file or file_url" });
        }
      }
      if (req.method === 'DELETE' && subAction) {
        const response = await fetch(`${AWAJ_BASE_URL}/voices/${subAction}`, { method: 'DELETE', headers: getAwajHeaders() as any });
        if (!response.ok) throw new Error(`Awaj API Error: ${response.statusText}`);
        let data = {};
        try { data = await response.json(); } catch (e) {}
        return res.status(200).json({ success: true, ...data });
      }
    }

    // BROADCAST
    if (action === 'broadcast' || action === 'broadcasts') {
      if (req.method === 'POST' && subAction === 'direct') {
        const response = await fetch(`${AWAJ_BASE_URL}/broadcasts/direct`, { method: 'POST', headers: getAwajHeaders(), body: JSON.stringify(req.body) });
        const data = await response.json();
        if (!response.ok) return res.status(response.status).json(data);
        return res.status(200).json(data);
      }
      if (req.method === 'POST' && subAction === 'otp') {
        const response = await fetch(`${AWAJ_BASE_URL}/broadcasts/otp`, { method: 'POST', headers: getAwajHeaders(), body: JSON.stringify(req.body) });
        const data = await response.json();
        if (!response.ok) return res.status(response.status).json(data);
        return res.status(200).json(data);
      }
      if (req.method === 'POST') {
        const response = await fetch(`${AWAJ_BASE_URL}/broadcasts`, { method: 'POST', headers: getAwajHeaders(), body: JSON.stringify(req.body) });
        const data = await response.json();
        if (!response.ok) return res.status(response.status).json(data);
        return res.status(200).json(data);
      }
      if (req.method === 'GET') {
        if (subAction) {
          let response = await fetch(`${AWAJ_BASE_URL}/broadcasts/${subAction}/result`, { headers: getAwajHeaders() });
          if (response.status === 404) response = await fetch(`${AWAJ_BASE_URL}/broadcasts/${subAction}`, { headers: getAwajHeaders() });
          if (!response.ok) throw new Error(`Awaj API Error: ${response.statusText}`);
          const data = await response.json();
          return res.status(200).json(data);
        } else {
          const searchParams = url.searchParams.toString();
          const targetUrl = searchParams ? `${AWAJ_BASE_URL}/broadcasts?${searchParams}` : `${AWAJ_BASE_URL}/broadcasts`;
          const response = await fetch(targetUrl, { headers: getAwajHeaders() });
          if (!response.ok) throw new Error(`Awaj API Error: ${response.statusText}`);
          const data = await response.json();
          return res.status(200).json(data);
        }
      }
    }

    // BROADCAST-RESULT (legacy or direct)
    if (action === 'broadcast-result') {
      const id = req.query.id || subAction;
      if (!id) return res.status(400).json({ error: 'ID is required' });
      let response = await fetch(`${AWAJ_BASE_URL}/broadcasts/${id}/result`, { headers: getAwajHeaders() });
      if (response.status === 404) response = await fetch(`${AWAJ_BASE_URL}/broadcasts/${id}`, { headers: getAwajHeaders() });
      if (!response.ok) throw new Error(`Awaj API Error: ${response.statusText}`);
      const data = await response.json();
      return res.status(200).json(data);
    }

    // SENDERS
    if (action === 'senders') {
      const response = await fetch(`${AWAJ_BASE_URL}/senders`, { headers: getAwajHeaders() });
      if (!response.ok) throw new Error(`Awaj API Error: ${response.statusText}`);
      const data = await response.json();
      return res.status(200).json(data);
    }

    // BALANCE / ACCOUNT / USER
    if (action === 'balance' || action === 'account' || action === 'user' || action === 'me') {
      try {
        let response = await fetch(`${AWAJ_BASE_URL}/balance`, { headers: getAwajHeaders() });
        if (!response.ok) {
          response = await fetch(`${AWAJ_BASE_URL}/user`, { headers: getAwajHeaders() });
        }
        if (!response.ok) {
          response = await fetch(`${AWAJ_BASE_URL}/account`, { headers: getAwajHeaders() });
        }
        if (!response.ok) {
          return res.status(200).json({ balance: 0, currency: 'BDT' });
        }
        const data = await response.json();
        return res.status(200).json(data);
      } catch (e: any) {
        return res.status(200).json({ balance: 0, currency: 'BDT' });
      }
    }

    // SURVEYS
    if (action === 'surveys') {
      if (req.method === 'POST') {
        const response = await fetch(`${AWAJ_BASE_URL}/surveys`, { method: 'POST', headers: getAwajHeaders(), body: JSON.stringify(req.body) });
        if (!response.ok) throw new Error(`Awaj API Error: ${response.statusText}`);
        const data = await response.json();
        return res.status(200).json(data);
      }
    }

    // WEBHOOK
    if (action === 'webhook') {
      if (req.method === 'POST') {
        console.log('Received webhook:', req.body);
        return res.status(200).json({ received: true });
      }
    }

    return res.status(404).json({ error: 'Action not found' });
  } catch (error: any) {
    console.error(`Awaj API error (${action}):`, error);
    res.status(500).json({ error: error.message });
  }
}
