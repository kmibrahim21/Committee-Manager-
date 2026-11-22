export const normalizePhone = (phone: string | undefined | null): string => {
  if (!phone) return '';
  let p = phone.replace(/[^0-9]/g, '');
  if (p.startsWith('01')) return '88' + p;
  if (p.startsWith('1')) return '880' + p;
  return p;
};

export const getSmsLengthInfo = (message: string) => {
  const isBangla = /[^\x00-\x7F]/.test(message);
  const len = message.length;
  
  if (len === 0) return { parts: 0, length: 0, maxAllowed: isBangla ? 70 : 160, isBangla };

  let parts = 1;
  let maxAllowed = isBangla ? 70 : 160;

  if (isBangla) {
    if (len > 70) {
      parts = Math.ceil(len / 67);
      maxAllowed = parts * 67;
    }
  } else {
    if (len > 160) {
      parts = Math.ceil(len / 153);
      maxAllowed = parts * 153;
    }
  }

  return { parts, length: len, maxAllowed, isBangla };
};

export const DEFAULT_NON_MASKING_SMS_RATE = 0.35;
export const DEFAULT_MASKING_SMS_RATE = 0.55;
export const DEFAULT_VOICE_RATE = 0.50;

export interface SmsRateConfig {
  masking_rate?: number;
  non_masking_rate?: number;
  default_sms_type?: 'non_masking' | 'masking';
  sms_rate?: number;
}

export const resolveInstitutionSmsPricing = (
  institution: {
    reve_client_id?: string | null;
    sms_type?: string | null;
    config_json?: any;
  } | null | undefined,
  globalRates?: SmsRateConfig | null
) => {
  let configObj: Record<string, any> = {};
  const rawCfg = institution?.config_json;
  if (typeof rawCfg === 'string') {
    try {
      configObj = JSON.parse(rawCfg);
    } catch {
      configObj = {};
    }
  } else if (rawCfg && typeof rawCfg === 'object') {
    configObj = rawCfg;
  }

  const maskingRate =
    Number(globalRates?.masking_rate) > 0
      ? Number(globalRates?.masking_rate)
      : DEFAULT_MASKING_SMS_RATE;

  const nonMaskingRate =
    Number(globalRates?.non_masking_rate) > 0
      ? Number(globalRates?.non_masking_rate)
      : Number(globalRates?.sms_rate) > 0
        ? Number(globalRates?.sms_rate)
        : DEFAULT_NON_MASKING_SMS_RATE;

  const hasMaskingSenderId = Boolean(String(institution?.reve_client_id || '').trim());
  const explicitType = institution?.sms_type || configObj?.sms_type;

  const isMasking =
    hasMaskingSenderId ||
    explicitType === 'masking' ||
    (explicitType !== 'non_masking' && globalRates?.default_sms_type === 'masking');

  const smsType: 'masking' | 'non_masking' = isMasking ? 'masking' : 'non_masking';
  const customRate = Number(configObj?.sms_rate);
  const hasCustomRate = Number.isFinite(customRate) && customRate > 0;

  const effectiveRate = hasCustomRate
    ? customRate
    : isMasking
      ? maskingRate
      : nonMaskingRate;

  return {
    smsType,
    isMasking,
    hasMaskingSenderId,
    hasCustomRate,
    effectiveRate,
    maskingRate,
    nonMaskingRate
  };
};

