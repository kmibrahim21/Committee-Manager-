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
  voice_rate?: number;
}

const parseConfigJson = (rawCfg: any): Record<string, any> => {
  if (typeof rawCfg === 'string') {
    try {
      const parsed = JSON.parse(rawCfg);
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch {
      return {};
    }
  }
  return rawCfg && typeof rawCfg === 'object' ? rawCfg : {};
};

export const resolveInstitutionSmsPricing = (
  institution: {
    reve_client_id?: string | null;
    sms_type?: string | null;
    config_json?: any;
  } | null | undefined,
  globalRates?: SmsRateConfig | null
) => {
  const configObj = parseConfigJson(institution?.config_json);

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
  const rawCustomRate = Number(configObj?.sms_rate);
  // Ignore legacy unflagged 0.40 default previously auto-written by AdminPanel
  const isLegacyAutoDefault = configObj?.custom_sms_rate !== true && Math.abs(rawCustomRate - 0.4) < 0.0001;
  const hasCustomRate =
    Number.isFinite(rawCustomRate) &&
    rawCustomRate > 0 &&
    (configObj?.custom_sms_rate === true || !isLegacyAutoDefault);

  const effectiveRate = hasCustomRate
    ? rawCustomRate
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

export const resolveInstitutionVoiceRate = (
  institution: {
    config_json?: any;
  } | null | undefined,
  globalRates?: SmsRateConfig | null
): number => {
  const configObj = parseConfigJson(institution?.config_json);
  const rawCustomVoice = Number(configObj?.voice_rate);
  // Ignore legacy unflagged 0.50 default previously auto-written by AdminPanel
  const isLegacyAutoDefault = configObj?.custom_voice_rate !== true && Math.abs(rawCustomVoice - 0.5) < 0.0001;
  if (
    Number.isFinite(rawCustomVoice) &&
    rawCustomVoice > 0 &&
    (configObj?.custom_voice_rate === true || !isLegacyAutoDefault)
  ) {
    return rawCustomVoice;
  }

  const globalVoice = Number(globalRates?.voice_rate);
  if (Number.isFinite(globalVoice) && globalVoice > 0) {
    return globalVoice;
  }

  return DEFAULT_VOICE_RATE;
};

