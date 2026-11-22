// @ts-nocheck
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-webhook-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const BN_DIGIT_MAP: Record<string, string> = {
  "০": "0", "১": "1", "২": "2", "৩": "3", "৪": "4",
  "৫": "5", "৬": "6", "৭": "7", "৮": "8", "৯": "9",
};

function toEnglishDigits(input: string): string {
  return String(input || "").replace(/[০-৯]/g, (d) => BN_DIGIT_MAP[d] ?? d);
}

function normalizePhone11(raw: string): string {
  const digits = toEnglishDigits(raw).replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("8801")) return digits.slice(2);
  if (digits.length === 14 && digits.startsWith("008801")) return digits.slice(4);
  if (digits.length === 11 && digits.startsWith("01")) return digits;
  if (digits.length === 10 && digits.startsWith("1")) return `0${digits}`;
  return digits;
}

interface ParsedSmsPayment {
  amount: number;
  senderPhone: string;
  trxId: string;
  method: "bKash" | "Nagad" | "Unknown";
}

function parseWalletSms(rawText: string, senderHint = ""): ParsedSmsPayment | null {
  const text = toEnglishDigits(rawText || "").replace(/\s+/g, " ").trim();
  if (!text) return null;

  const lower = `${senderHint} ${text}`.toLowerCase();
  const method: "bKash" | "Nagad" | "Unknown" = lower.includes("nagad")
    ? "Nagad"
    : lower.includes("bkash")
      ? "bKash"
      : "Unknown";

  // Match received money amount: "received Tk 500.00", "Tk 1,000.00", "টাকা 500"
  const amountMatch =
    text.match(/(?:received|cash\s*in|send\s*money|payment|tk\.?|bdt|৳|টাকা)\s*[:\-]?\s*([0-9,]+(?:\.[0-9]{1,2})?)/i) ||
    text.match(/([0-9,]+(?:\.[0-9]{1,2})?)\s*(?:tk\.?|bdt|৳|টাকা)/i);

  const amount = amountMatch ? parseFloat(amountMatch[1].replace(/,/g, "")) : 0;

  // Match sender phone (01XXXXXXXXX or +8801XXXXXXXXX)
  const phoneMatch =
    text.match(/(?:from|sender|প্রেরক)\s*[:\-]?\s*(\+?88)?(01[3-9]\d{8})/i) ||
    text.match(/(\+?88)?(01[3-9]\d{8})/);

  const senderPhone = phoneMatch ? normalizePhone11(phoneMatch[2] || phoneMatch[0]) : "";

  // Match TrxID / TxnID / Transaction ID
  const trxMatch =
    text.match(/(?:trxid|txnid|trx\s*id|txn\s*id|transaction\s*id)\s*[:\-#]?\s*([A-Z0-9]{6,20})/i);

  const trxId = trxMatch ? trxMatch[1].toUpperCase() : "";

  if (!amount || amount <= 0 || !senderPhone || !trxId) {
    return null;
  }

  return { amount, senderPhone, trxId, method };
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const webhookSecret = Deno.env.get("PAYMENT_WEBHOOK_SECRET") || "";
    if (webhookSecret) {
      const headerSecret = req.headers.get("x-webhook-secret") || "";
      const authHeader = req.headers.get("authorization") || "";
      const bearerSecret = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
      const provided = headerSecret || bearerSecret;

      if (!provided || !constantTimeEquals(provided, webhookSecret)) {
        return new Response(JSON.stringify({ success: false, error: "Unauthorized webhook request" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const payload = await req.json().catch(() => ({}));
    const rawMessage = String(payload.message || payload.text || payload.body || payload.sms || "");
    const smsSender = String(payload.sender || payload.from || "");

    // Allow either parsed SMS message OR structured payload
    let parsed: ParsedSmsPayment | null = null;
    if (rawMessage) {
      parsed = parseWalletSms(rawMessage, smsSender);
    }

    const amount = parsed?.amount || Number(payload.amount || 0);
    const senderPhone = parsed?.senderPhone || normalizePhone11(String(payload.sender_phone || ""));
    const trxId = parsed?.trxId || String(payload.trx_id || payload.transaction_id || "").trim().toUpperCase();
    const detectedMethod = parsed?.method !== "Unknown" ? parsed?.method : (payload.method || "bKash");

    if (!amount || amount <= 0 || !senderPhone || !trxId) {
      return new Response(
        JSON.stringify({
          success: false,
          verified: false,
          error: "Could not extract valid amount, sender_phone, and trx_id",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prevent TrxID replay attacks
    const { data: existingApproved } = await supabaseAdmin
      .from("transactions")
      .select("id")
      .eq("transaction_id", trxId)
      .eq("status", "approved")
      .maybeSingle();

    if (existingApproved) {
      return new Response(
        JSON.stringify({ success: false, verified: false, error: "Transaction ID already processed" }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Match most recent pending checkout session within the last 2 hours
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data: pendingList, error: fetchErr } = await supabaseAdmin
      .from("transactions")
      .select("*")
      .eq("status", "pending")
      .eq("amount", amount)
      .gte("created_at", twoHoursAgo)
      .order("created_at", { ascending: false })
      .limit(20);

    if (fetchErr) throw fetchErr;

    const matchedTrx = (pendingList || []).find((tr: any) => {
      const dbSender = normalizePhone11(tr.sender_phone || tr.metadata?.sender_number || "");
      return dbSender === senderPhone;
    });

    if (!matchedTrx) {
      return new Response(
        JSON.stringify({
          success: true,
          verified: false,
          message: "No matching pending payment session found",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine payment module cleanly
    const desc = String(matchedTrx.description || "").toLowerCase();
    const moduleName =
      matchedTrx.module ||
      (desc.includes("subscription")
        ? "subscription"
        : desc.includes("voice")
          ? "voice"
          : "sms");

    const { data: inst, error: instErr } = await supabaseAdmin
      .from("institutions")
      .select("*")
      .eq("id", matchedTrx.institution_id)
      .single();

    if (instErr || !inst) {
      throw instErr || new Error("Institution not found");
    }

    let instConfig: Record<string, any> = {};
    if (typeof inst.config_json === "string") {
      try {
        instConfig = JSON.parse(inst.config_json);
      } catch {
        instConfig = {};
      }
    } else if (inst.config_json && typeof inst.config_json === "object") {
      instConfig = { ...inst.config_json };
    }

    const { data: sysSettings } = await supabaseAdmin
      .from("system_settings")
      .select("*")
      .order("id", { ascending: true })
      .limit(1)
      .maybeSingle();

    let updatedSmsCount = Number(matchedTrx.sms_count || 0);

    if (moduleName === "sms") {
      const providerCfg =
        sysSettings?.sms_provider_config && typeof sysSettings.sms_provider_config === "object"
          ? sysSettings.sms_provider_config
          : {};
      const globalMaskingRate =
        Number(providerCfg.masking_rate) > 0 ? Number(providerCfg.masking_rate) : 0.55;
      const globalNonMaskingRate =
        Number(providerCfg.non_masking_rate) > 0
          ? Number(providerCfg.non_masking_rate)
          : Number(sysSettings?.sms_rate) > 0
            ? Number(sysSettings.sms_rate)
            : 0.35;

      const hasMaskingId = Boolean(String(inst.reve_client_id || "").trim());
      const explicitType = inst.sms_type || instConfig?.sms_type || matchedTrx.metadata?.sms_type;
      const isMasking =
        hasMaskingId ||
        explicitType === "masking" ||
        (explicitType !== "non_masking" && providerCfg.default_type === "masking");

      const effectiveSmsRate =
        Number(instConfig?.sms_rate) > 0
          ? Number(instConfig.sms_rate)
          : isMasking
            ? globalMaskingRate
            : globalNonMaskingRate;

      if (updatedSmsCount <= 0) {
        updatedSmsCount = Math.ceil(amount / effectiveSmsRate);
      }

      // Deduct from admin stock if available
      const { data: stockRow } = await supabaseAdmin
        .from("admin_sms_stock")
        .select("id, remaining_sms")
        .limit(1)
        .maybeSingle();

      if (stockRow && typeof stockRow.remaining_sms === "number") {
        const nextStock = Math.max(0, stockRow.remaining_sms - updatedSmsCount);
        await supabaseAdmin
          .from("admin_sms_stock")
          .update({ remaining_sms: nextStock, updated_at: new Date().toISOString() })
          .eq("id", stockRow.id);
      }

      const nextSmsBalance = Number(inst.sms_balance || 0) + updatedSmsCount;
      await supabaseAdmin
        .from("institutions")
        .update({ sms_balance: nextSmsBalance })
        .eq("id", inst.id);
    } else if (moduleName === "voice") {
      const nextVoiceBalance = Number(inst.balance || 0) + amount;
      await supabaseAdmin
        .from("institutions")
        .update({ balance: nextVoiceBalance })
        .eq("id", inst.id);
    } else if (moduleName === "subscription") {
      const existingPaidMonths: string[] = Array.isArray(instConfig.paid_months)
        ? instConfig.paid_months
        : [];
      const newMonths: string[] = Array.isArray(matchedTrx.metadata?.months)
        ? matchedTrx.metadata.months
        : (String(matchedTrx.description || "").match(/\b\d{4}-\d{2}\b/g) || []);
      const mergedPaidMonths = Array.from(new Set([...existingPaidMonths, ...newMonths])).sort();

      let nextSubEnd = inst.subscription_end || null;
      if (mergedPaidMonths.length > 0) {
        const latestYm = mergedPaidMonths[mergedPaidMonths.length - 1];
        const [yrStr, moStr] = latestYm.split("-");
        const yr = Number(yrStr);
        const mo = Number(moStr);
        if (yr && mo) {
          const lastDay = new Date(yr, mo, 0).toISOString().split("T")[0];
          if (!nextSubEnd || lastDay > nextSubEnd) {
            nextSubEnd = lastDay;
          }
        }
      }

      const updatedConfig = {
        ...instConfig,
        paid_months: mergedPaidMonths,
        ...(matchedTrx.metadata?.package_name ? { package_name: matchedTrx.metadata.package_name } : {}),
        ...(Number(matchedTrx.metadata?.package_rate) > 0 ? { package_rate: Number(matchedTrx.metadata.package_rate) } : {}),
        ...(matchedTrx.metadata?.subscription_type ? { subscription_type: matchedTrx.metadata.subscription_type } : {}),
      };

      await supabaseAdmin
        .from("institutions")
        .update({
          config_json: updatedConfig,
          subscription_end: nextSubEnd,
          status: "active",
          is_active: true,
        })
        .eq("id", inst.id);
    }

    const updatedMeta = {
      ...(matchedTrx.metadata || {}),
      auto_verified: true,
      verified_at: new Date().toISOString(),
      verified_method: detectedMethod,
      sms_sender: smsSender || null,
      raw_trx_id: trxId,
    };

    const { error: approveErr } = await supabaseAdmin
      .from("transactions")
      .update({
        status: "approved",
        transaction_id: trxId,
        sms_count: updatedSmsCount,
        metadata: updatedMeta,
      })
      .eq("id", matchedTrx.id);

    if (approveErr) throw approveErr;

    return new Response(
      JSON.stringify({
        success: true,
        verified: true,
        transaction_row_id: matchedTrx.id,
        transaction_id: trxId,
        module: moduleName,
        institution_id: inst.id,
        amount,
        sms_count: updatedSmsCount,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, error: err?.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
