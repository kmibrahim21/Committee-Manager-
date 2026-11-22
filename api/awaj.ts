import type { VercelRequest, VercelResponse } from '@vercel/node';
import fetch from 'node-fetch';
import FormData from 'form-data';
import { Buffer } from 'node:buffer';
import { getSupabaseAdmin } from '../lib/supabase-admin.js';

const AWAJ_BASE_URL = 'https://api.awajdigital.com/api';
const AWAJ_ORIGIN = 'https://api.awajdigital.com';

const ALLOWED_AUDIO_EXTS = ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'webm', 'flac'] as const;
type AllowedAudioExt = (typeof ALLOWED_AUDIO_EXTS)[number];

const AUDIO_MIME_MAP: Record<AllowedAudioExt, string> = {
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
  ogg: 'audio/ogg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  webm: 'audio/webm',
  flac: 'audio/flac'
};

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

const isAllowedStreamHost = (rawUrl: string): boolean => {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase();
    return (
      host === 'awajdigital.com' ||
      host.endsWith('.awajdigital.com') ||
      host.endsWith('.supabase.co') ||
      host.endsWith('.supabase.in')
    );
  } catch {
    return false;
  }
};

const normalizeAwajUrl = (rawUrl: unknown): string => {
  const s = String(rawUrl || '').trim();
  if (!s) return '';
  if (s.startsWith('http://') || s.startsWith('https://')) return s;
  if (s.startsWith('/')) return `${AWAJ_ORIGIN}${s}`;
  return `${AWAJ_ORIGIN}/${s}`;
};

const normalizeAudioFormat = (
  filename?: string,
  contentType?: string,
  fileUrl?: string
): { ext: AllowedAudioExt; mime: string } => {
  const candidates: string[] = [];
  const fromName = String(filename || '').split('.').pop()?.toLowerCase().trim();
  if (fromName) candidates.push(fromName);
  const fromUrl = String(fileUrl || '').split('?')[0].split('.').pop()?.toLowerCase().trim();
  if (fromUrl) candidates.push(fromUrl);

  const rawMime = String(contentType || '').toLowerCase().split(';')[0].trim();
  if (rawMime) {
    if (rawMime.includes('mpeg') || rawMime === 'audio/mp3') candidates.push('mp3');
    else if (rawMime.includes('wav')) candidates.push('wav');
    else if (rawMime.includes('ogg')) candidates.push('ogg');
    else if (rawMime.includes('mp4') || rawMime.includes('m4a')) candidates.push('m4a');
    else if (rawMime.includes('aac')) candidates.push('aac');
    else if (rawMime.includes('webm')) candidates.push('webm');
    else if (rawMime.includes('flac')) candidates.push('flac');
  }

  for (const c of candidates) {
    const mapped = c === 'mpeg' || c === 'mpga' ? 'mp3' : c === 'mp4' ? 'm4a' : c;
    if ((ALLOWED_AUDIO_EXTS as readonly string[]).includes(mapped)) {
      const ext = mapped as AllowedAudioExt;
      return { ext, mime: AUDIO_MIME_MAP[ext] };
    }
  }

  return { ext: 'mp3', mime: AUDIO_MIME_MAP.mp3 };
};

const stripCmPrefixServer = (rawName: string): string => {
  const trimmed = String(rawName || '').trim();
  if (!trimmed) return '';
  if (!/^CM[_-]/i.test(trimmed)) return trimmed;
  const withoutCm = trimmed.replace(/^CM[_-]+/i, '').trim();
  if (!withoutCm) return trimmed;
  const digitCodeMatch = withoutCm.match(/^(?:[A-Z0-9]*\d[A-Z0-9]{0,15})[_-]+(.+)$/i);
  if (digitCodeMatch && digitCodeMatch[1]?.trim()) {
    return digitCodeMatch[1].trim();
  }
  return withoutCm;
};

const parseSafeJson = async (response: any) => {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { error: text, message: text };
  }
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  const parts = pathname.split('/').filter(Boolean);

  let action = parts[2]; // e.g. 'voices', 'broadcast', 'senders', 'stream'
  if (parts[1] === 'awaj' && !action) {
    action = (req.query?.action as string) || url.searchParams.get('action') || 'voices';
  }
  const subAction = parts[3] || (req.query?.id as string) || url.searchParams.get('id') || undefined;

  try {
    // Parse string body early if needed
    if (req.body && typeof req.body === 'string' && req.body.trim().startsWith('{')) {
      try {
        req.body = JSON.parse(req.body);
      } catch (e) {
        console.warn('Failed to parse req.body as JSON in awaj API:', e);
      }
    }

    // AUDIO STREAM PROXY (CORS-safe playback for <audio> tags)
    if (action === 'stream' && req.method === 'GET') {
      const rawTarget = String(url.searchParams.get('url') || req.query?.url || '').trim();
      if (!rawTarget) {
        return res.status(400).json({ error: 'Missing url parameter' });
      }
      const targetUrl = normalizeAwajUrl(rawTarget);
      if (!isSafePublicHttpsUrl(targetUrl) || !isAllowedStreamHost(targetUrl)) {
        return res.status(400).json({ error: 'Invalid or disallowed stream URL' });
      }

      const headers: Record<string, string> = {};
      const parsedTarget = new URL(targetUrl);
      if (
        (parsedTarget.hostname === 'awajdigital.com' || parsedTarget.hostname.endsWith('.awajdigital.com')) &&
        process.env.AWAJ_API_TOKEN
      ) {
        headers['Authorization'] = `Bearer ${process.env.AWAJ_API_TOKEN}`;
      }

      const upstream = await fetch(targetUrl, { headers });
      if (!upstream.ok) {
        return res.status(upstream.status).json({ error: `Stream error (${upstream.status})` });
      }

      const arrayBuf = await upstream.arrayBuffer();
      const buf = Buffer.from(arrayBuf);
      const contentType = upstream.headers.get('content-type') || 'audio/mpeg';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Length', String(buf.length));
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=300');
      return res.status(200).send(buf);
    }

    let callerUser: any = null;
    let isSuperAdmin = false;

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
      callerUser = user;

      const [{ data: requesterProfile }, { data: requesterInst }] = await Promise.all([
        supabaseAdmin.from('profiles').select('role').eq('id', user.id).maybeSingle(),
        supabaseAdmin.from('institutions').select('is_super_admin').eq('id', user.id).maybeSingle()
      ]);

      isSuperAdmin =
        requesterProfile?.role === 'super_admin' ||
        requesterInst?.is_super_admin === true;

      if (!process.env.AWAJ_API_TOKEN || !process.env.AWAJ_API_TOKEN.trim()) {
        return res.status(500).json({ error: 'AWAJ_API_TOKEN সার্ভার এনভায়রনমেন্টে সেট করা নেই।' });
      }
    }

    // VOICES
    if (action === 'voices') {
      if (req.method === 'GET') {
        const response = await fetch(`${AWAJ_BASE_URL}/voices`, { headers: getAwajHeaders() as any });
        const data = await parseSafeJson(response);
        if (!response.ok) return res.status(response.status).json(data);
        return res.status(200).json(data);
      }

      if (req.method === 'POST') {
        const body = req.body || {};
        const { name, title, file_url, file_base64, filename, content_type, institution_id } = body;
        let fileBuffer: Buffer | null = null;

        const { ext, mime: finalContentType } = normalizeAudioFormat(filename, content_type, file_url);
        const cleanFilename = `voice_${Date.now()}.${ext}`;

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
        }

        if (!fileBuffer) {
          return res.status(400).json({ error: 'Missing audio file or file_url' });
        }

        const voiceUploadName = String(name || 'Voice Upload').trim();
        const formData = new FormData();
        formData.append('name', voiceUploadName);
        formData.append('audio', fileBuffer, {
          filename: cleanFilename,
          contentType: finalContentType,
          knownLength: fileBuffer.length
        });

        const formBuffer = formData.getBuffer();
        const response = await fetch(`${AWAJ_BASE_URL}/voices/upload`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.AWAJ_API_TOKEN}`,
            'Accept': 'application/json',
            ...formData.getHeaders(),
            'Content-Length': String(formBuffer.length)
          },
          body: formBuffer
        });

        const data: any = await parseSafeJson(response);
        if (!response.ok) return res.status(response.status).json(data);

        // Extract and normalize voice metadata from upload response
        let resolvedId: string = String(
          data?.voice?.id ?? data?.id ?? data?.voice_id ?? data?.data?.id ?? ''
        ).trim();
        let resolvedName: string = String(
          data?.voice?.name ?? data?.name ?? data?.data?.name ?? voiceUploadName
        ).trim();
        let resolvedPreviewUrl: string = normalizeAwajUrl(
          data?.voice?.previewUrl ??
            data?.voice?.preview_url ??
            data?.voice?.file_url ??
            data?.voice?.audioUrl ??
            data?.voice?.url ??
            data?.previewUrl ??
            data?.preview_url ??
            data?.file_url ??
            data?.audioUrl ??
            data?.url ??
            data?.data?.previewUrl ??
            ''
        );
        let resolvedStatus: string = String(
          data?.voice?.status ?? data?.status ?? data?.data?.status ?? ''
        ).toLowerCase();

        // If previewUrl wasn't in upload response, enrich from GET /voices immediately
        if (!resolvedPreviewUrl || !resolvedId) {
          try {
            const listRes = await fetch(`${AWAJ_BASE_URL}/voices`, { headers: getAwajHeaders() as any });
            if (listRes.ok) {
              const listData: any = await parseSafeJson(listRes);
              const listArr: any[] = Array.isArray(listData)
                ? listData
                : Array.isArray(listData?.voices)
                  ? listData.voices
                  : Array.isArray(listData?.data)
                    ? listData.data
                    : [];

              const matched = listArr.find((v: any) => {
                if (resolvedId && v?.id !== undefined && String(v.id) === resolvedId) return true;
                return (
                  v?.name &&
                  String(v.name).trim().toLowerCase() === resolvedName.trim().toLowerCase()
                );
              });

              if (matched) {
                if (!resolvedId && matched.id !== undefined) resolvedId = String(matched.id);
                if (matched.name) resolvedName = String(matched.name).trim();
                const matchedAudio = normalizeAwajUrl(
                  matched.previewUrl ||
                    matched.preview_url ||
                    matched.file_url ||
                    matched.audioUrl ||
                    matched.url ||
                    ''
                );
                if (matchedAudio) resolvedPreviewUrl = matchedAudio;
                if (matched.status) resolvedStatus = String(matched.status).toLowerCase();
              }
            }
          } catch (enrichErr) {
            console.warn('Awaj post-upload enrichment failed:', enrichErr);
          }
        }

        if (resolvedStatus !== 'rejected' && (resolvedStatus === 'approved' || Boolean(resolvedPreviewUrl))) {
          resolvedStatus = 'approved';
        } else if (!resolvedStatus) {
          resolvedStatus = 'pending';
        }

        let assignedTemplate: any = null;
        if (institution_id && isSuperAdmin && callerUser) {
          try {
            const supabaseAdmin = getSupabaseAdmin();
            const cleanTitle = String(title || '').trim() || stripCmPrefixServer(resolvedName) || resolvedName;
            const { data: insertedTpl, error: tplError } = await supabaseAdmin
              .from('voice_templates')
              .insert({
                institution_id: String(institution_id),
                title: cleanTitle,
                provider_voice_name: resolvedName,
                provider_voice_id: resolvedId || null,
                file_url: resolvedPreviewUrl || String(file_url || ''),
                admin_status: 'approved',
                provider_status: 'approved'
              })
              .select('*')
              .maybeSingle();

            if (!tplError && insertedTpl) {
              assignedTemplate = insertedTpl;
            } else if (tplError) {
              console.warn('Failed to auto-assign voice_template on upload:', tplError.message);
            }
          } catch (assignErr) {
            console.warn('Error inserting auto-assigned voice_template:', assignErr);
          }
        }

        return res.status(200).json({
          ...data,
          id: resolvedId || data?.id || null,
          voice_id: resolvedId || data?.voice_id || null,
          name: resolvedName,
          previewUrl: resolvedPreviewUrl,
          file_url: resolvedPreviewUrl,
          url: resolvedPreviewUrl,
          status: resolvedStatus,
          assigned_template: assignedTemplate
        });
      }

      if (req.method === 'DELETE' && subAction) {
        const response = await fetch(`${AWAJ_BASE_URL}/voices/${subAction}`, {
          method: 'DELETE',
          headers: getAwajHeaders() as any
        });
        const data = await parseSafeJson(response);
        if (!response.ok) return res.status(response.status).json(data);
        return res.status(200).json({ success: true, ...data });
      }
    }

    // BROADCAST
    if (action === 'broadcast' || action === 'broadcasts') {
      if (req.method === 'POST' && subAction === 'direct') {
        const response = await fetch(`${AWAJ_BASE_URL}/broadcasts/direct`, {
          method: 'POST',
          headers: getAwajHeaders(),
          body: JSON.stringify(req.body)
        });
        const data = await parseSafeJson(response);
        if (!response.ok) return res.status(response.status).json(data);
        return res.status(200).json(data);
      }
      if (req.method === 'POST' && subAction === 'otp') {
        const response = await fetch(`${AWAJ_BASE_URL}/broadcasts/otp`, {
          method: 'POST',
          headers: getAwajHeaders(),
          body: JSON.stringify(req.body)
        });
        const data = await parseSafeJson(response);
        if (!response.ok) return res.status(response.status).json(data);
        return res.status(200).json(data);
      }
      if (req.method === 'POST') {
        const response = await fetch(`${AWAJ_BASE_URL}/broadcasts`, {
          method: 'POST',
          headers: getAwajHeaders(),
          body: JSON.stringify(req.body)
        });
        const data = await parseSafeJson(response);
        if (!response.ok) return res.status(response.status).json(data);
        return res.status(200).json(data);
      }
      if (req.method === 'GET') {
        if (subAction) {
          let response = await fetch(`${AWAJ_BASE_URL}/broadcasts/${subAction}/result`, { headers: getAwajHeaders() });
          if (response.status === 404) {
            response = await fetch(`${AWAJ_BASE_URL}/broadcasts/${subAction}`, { headers: getAwajHeaders() });
          }
          const data = await parseSafeJson(response);
          if (!response.ok) return res.status(response.status).json(data);
          return res.status(200).json(data);
        } else {
          const searchParams = url.searchParams.toString();
          const targetUrl = searchParams ? `${AWAJ_BASE_URL}/broadcasts?${searchParams}` : `${AWAJ_BASE_URL}/broadcasts`;
          const response = await fetch(targetUrl, { headers: getAwajHeaders() });
          const data = await parseSafeJson(response);
          if (!response.ok) return res.status(response.status).json(data);
          return res.status(200).json(data);
        }
      }
    }

    // BROADCAST-RESULT (legacy or direct)
    if (action === 'broadcast-result') {
      const id = req.query?.id || subAction;
      if (!id) return res.status(400).json({ error: 'ID is required' });
      let response = await fetch(`${AWAJ_BASE_URL}/broadcasts/${id}/result`, { headers: getAwajHeaders() });
      if (response.status === 404) {
        response = await fetch(`${AWAJ_BASE_URL}/broadcasts/${id}`, { headers: getAwajHeaders() });
      }
      const data = await parseSafeJson(response);
      if (!response.ok) return res.status(response.status).json(data);
      return res.status(200).json(data);
    }

    // SENDERS
    if (action === 'senders') {
      const response = await fetch(`${AWAJ_BASE_URL}/senders`, { headers: getAwajHeaders() });
      const data = await parseSafeJson(response);
      if (!response.ok) return res.status(response.status).json(data);
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
        const data = await parseSafeJson(response);
        return res.status(200).json(data);
      } catch {
        return res.status(200).json({ balance: 0, currency: 'BDT' });
      }
    }

    // SURVEYS
    if (action === 'surveys') {
      if (req.method === 'POST') {
        const response = await fetch(`${AWAJ_BASE_URL}/surveys`, {
          method: 'POST',
          headers: getAwajHeaders(),
          body: JSON.stringify(req.body)
        });
        const data = await parseSafeJson(response);
        if (!response.ok) return res.status(response.status).json(data);
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
    return res.status(500).json({ error: error.message });
  }
}
