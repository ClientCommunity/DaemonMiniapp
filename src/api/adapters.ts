import {
  UserProfile,
  Server1AccountItem,
  Server2StockItem,
  Server2QualityTier,
  VirtualOtpServiceItem,
  OtpAppCode,
  SmmServiceItem,
  SmmPlatform,
  HistoryItem,
  OrderCategory,
  OrderStatus,
  ResellerConfig,
} from '../types';

export interface BackendUserPayload {
  id?: number;
  balance?: number;
  promo_balance?: number;
  transferable_balance?: number;
  sales_balance?: number;
  pref_curr?: string;
  referred_by?: string | null;
  total_deposited?: number;
  reseller_token?: string;
  email?: string;
  name?: string;
  avatar_url?: string;
  auth_provider?: string;
}

export interface BackendServer1Item {
  id?: string | number;
  name?: string;
  country?: string;
  code?: string;
  flag?: string;
  icon?: string;
  price?: number;
  stock?: number;
  twofa?: boolean | string;
  subtitle?: string;
  phone?: string;
}

export interface BackendServer2Item {
  id?: string | number;
  name?: string;
  country?: string;
  code?: string;
  flag?: string;
  icon?: string;
  year?: number;
  price?: number;
  stock?: number;
  tier?: string;
  subtitle?: string;
}

export interface BackendServer34Item {
  id?: string;
  name?: string;
  country?: string;
  icon?: string;
  price?: number;
  stock?: number;
  subtitle?: string;
  country_code?: string;
}

export interface BackendServer5Item {
  id?: string | number;
  name?: string;
  country?: string;
  category?: string;
  icon?: string;
  price?: number;
  min_qty?: number;
  max_qty?: number;
  stock?: number;
  subtitle?: string;
}

export interface BackendHistoryItem {
  type?: string;
  title?: string;
  amount?: string | number;
  date?: string;
  details?: string;
  download_url?: string | null;
}

export interface BackendResellerPayload {
  token?: string;
  margin?: number;
  margin_percent?: number;
  link?: string;
  customers?: number;
  orders?: number;
  earnings?: number;
  min_margin?: number;
  max_margin?: number;
}

/**
 * Adapt backend user payload into frontend UserProfile, incorporating
 * Telegram user metadata from WebApp context when present.
 */
export function adaptBackendUser(
  backendData: BackendUserPayload,
  current?: UserProfile
): UserProfile {
  let tgUser: {
    id?: number;
    username?: string;
    first_name?: string;
    photo_url?: string;
  } | undefined;

  try {
    tgUser = (window as unknown as {
      Telegram?: {
        WebApp?: {
          initDataUnsafe?: {
            user?: {
              id?: number;
              username?: string;
              first_name?: string;
              photo_url?: string;
            };
          };
        };
      };
    })?.Telegram?.WebApp?.initDataUnsafe?.user;
  } catch {
    // browser mode fallback
  }

  const userId = backendData.id ?? tgUser?.id ?? current?.id ?? 0;
  const username = tgUser?.username || (backendData.email ? backendData.email.split('@')[0] : '') || current?.username || `user_${userId}`;
  const firstName = backendData.name || tgUser?.first_name || current?.firstName || 'User';
  const avatarUrl = backendData.avatar_url || tgUser?.photo_url || current?.avatarUrl || '';

  const prefCurrency = backendData.pref_curr === 'USDT' ? 'USDT' : (current?.prefCurrency || 'INR');
  const exchangeRateUsdt = current?.exchangeRateUsdt || 94.0;

  const balance = Number(backendData.balance ?? current?.balance ?? 0);
  const promoBalance = Number(backendData.promo_balance ?? current?.promoBalance ?? 0);
  const salesBalance = Number(backendData.sales_balance ?? current?.salesBalance ?? 0);
  const totalDeposited = Number(backendData.total_deposited ?? current?.totalDeposited ?? 0);
  const totalSaved = current?.totalSaved ?? 0;
  const joinedDate = current?.joinedDate || 'Recently';

  return {
    id: userId,
    telegramId: String(userId),
    username,
    firstName,
    avatarUrl,
    joinedDate,
    prefCurrency,
    exchangeRateUsdt,
    balance,
    promoBalance,
    salesBalance,
    totalDeposited,
    totalSaved,
    email: backendData.email || current?.email,
    authProvider: (backendData.auth_provider as 'telegram' | 'google') || (backendData.email ? 'google' : (current?.authProvider || 'telegram')),
  };
}

/**
 * Adapt Server 1 Global 2FA items.
 */
export function adaptServer1Item(item: BackendServer1Item, index: number): Server1AccountItem {
  const country = item.country || item.name || 'Global';
  const price = Number(item.price || 0);
  const code = item.code || 'GL';
  const stock = Number(item.stock ?? 0);
  const icon = item.flag || item.icon || '🌐';

  return {
    id: String(item.id || `s1_${country.toLowerCase()}_${index}`),
    country,
    countryCode: code,
    icon,
    priceInr: price,
    priceUsdt: Number((price / 94.0).toFixed(2)),
    stockCount: stock,
    platform: 'Telegram',
    format: 'Session + 2FA',
    subtitle: item.subtitle || 'Global Market 2FA',
    credentialsSample: {
      phone: item.phone || '',
      twoFa: item.twofa ? String(item.twofa) : '',
      sessionFile: '',
      loginInstruction: 'Login code and credentials delivered upon purchase.',
    },
  };
}

/**
 * Adapt Server 2 Aged Session stock items.
 */
export function adaptServer2Item(
  item: BackendServer2Item,
  defaultTier: Server2QualityTier = 'good'
): Server2StockItem {
  const tier: Server2QualityTier = item.tier === 'cheap' ? 'cheap' : defaultTier;
  const year = Number(item.year || 2024);
  const country = item.country || item.name || 'Global';
  const price = Number(item.price || 0);
  const stock = Number(item.stock ?? 0);
  const icon = item.flag || item.icon || (tier === 'good' ? '🟢' : '🟡');

  return {
    id: String(item.id || `s2_${country.toLowerCase()}_${year}_${tier}`),
    country,
    countryCode: item.code || 'GL',
    icon,
    qualityTier: tier,
    accountYear: year,
    priceInr: price,
    stockCount: stock,
    deliveryFormat: 'session',
    subtitle: item.subtitle || (tier === 'good' ? '🟢 Good Quality Session' : '🟡 Cheap Quality Session'),
    twoFaRequired: false,
    sampleSessionUrl: '',
  };
}

/**
 * Helper to map app identifiers to OtpAppCode chips.
 */
export function mapAppCode(code: string | undefined, fallback?: string): OtpAppCode {
  const check = (val: string | undefined): OtpAppCode => {
    if (!val) return 'all';
    const c = val.toLowerCase().trim();
    if (c === 'wa' || c === 'whatsapp' || /\bwhatsapp\b/i.test(c)) return 'wa';
    if (c === 'tg' || c === 'telegram' || /\btelegram\b/i.test(c)) return 'tg';
    if (c === 'ig' || c === 'instagram' || /\binstagram\b/i.test(c) || /\binsta\b/i.test(c)) return 'ig';
    if (c === 'go' || c === 'google' || c === 'gmail' || /\bgoogle\b/i.test(c) || /\bgmail\b/i.test(c)) return 'go';
    if (c === 'spam' || /\bspam\b/i.test(c)) return 'spam';
    return 'all';
  };
  const primary = check(code);
  if (primary !== 'all') return primary;
  return check(fallback);
}

interface CountryMeta {
  code: string;
  dial: string;
  flag: string;
}

const COUNTRY_META_MAP: Record<string, CountryMeta> = {
  india: { code: 'IN', dial: '+91', flag: '🇮🇳' },
  usa: { code: 'US', dial: '+1', flag: '🇺🇸' },
  'united states': { code: 'US', dial: '+1', flag: '🇺🇸' },
  uk: { code: 'GB', dial: '+44', flag: '🇬🇧' },
  'united kingdom': { code: 'GB', dial: '+44', flag: '🇬🇧' },
  indonesia: { code: 'ID', dial: '+62', flag: '🇮🇩' },
  russia: { code: 'RU', dial: '+7', flag: '🇷🇺' },
  kazakhstan: { code: 'KZ', dial: '+7', flag: '🇰🇿' },
  brazil: { code: 'BR', dial: '+55', flag: '🇧🇷' },
  colombia: { code: 'CO', dial: '+57', flag: '🇨🇴' },
  egypt: { code: 'EG', dial: '+20', flag: '🇪🇬' },
  germany: { code: 'DE', dial: '+49', flag: '🇩🇪' },
  netherlands: { code: 'NL', dial: '+31', flag: '🇳🇱' },
  'south africa': { code: 'ZA', dial: '+27', flag: '🇿🇦' },
  spain: { code: 'ES', dial: '+34', flag: '🇪🇸' },
  sweden: { code: 'SE', dial: '+46', flag: '🇸🇪' },
  turkey: { code: 'TR', dial: '+90', flag: '🇹🇷' },
  vietnam: { code: 'VN', dial: '+84', flag: '🇻🇳' },
  philippines: { code: 'PH', dial: '+63', flag: '🇵🇭' },
  poland: { code: 'PL', dial: '+48', flag: '🇵🇱' },
  malaysia: { code: 'MY', dial: '+60', flag: '🇲🇾' },
  morocco: { code: 'MA', dial: '+212', flag: '🇲🇦' },
  israel: { code: 'IL', dial: '+972', flag: '🇮🇱' },
  ireland: { code: 'IE', dial: '+353', flag: '🇮🇪' },
  'hong kong': { code: 'HK', dial: '+852', flag: '🇭🇰' },
  china: { code: 'CN', dial: '+86', flag: '🇨🇳' },
  canada: { code: 'CA', dial: '+1', flag: '🇨🇦' },
  latvia: { code: 'LV', dial: '+371', flag: '🇱🇻' },
  madagascar: { code: 'MG', dial: '+261', flag: '🇲🇬' },
  thailand: { code: 'TH', dial: '+66', flag: '🇹🇭' },
  singapore: { code: 'SG', dial: '+65', flag: '🇸🇬' },
  uae: { code: 'AE', dial: '+971', flag: '🇦🇪' },
  nigeria: { code: 'NG', dial: '+234', flag: '🇳🇬' },
  france: { code: 'FR', dial: '+33', flag: '🇫🇷' },
  italy: { code: 'IT', dial: '+39', flag: '🇮🇹' },
  ukraine: { code: 'UA', dial: '+380', flag: '🇺🇦' },
};

export function parseCountryMeta(rawCountry: string): CountryMeta {
  const clean = rawCountry.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  for (const [key, meta] of Object.entries(COUNTRY_META_MAP)) {
    if (clean.includes(key)) {
      return meta;
    }
  }
  const serverMatch = rawCountry.match(/server\s*(\d+)/i);
  if (serverMatch) {
    return { code: `S${serverMatch[1]}`, dial: serverMatch[1], flag: '📶' };
  }
  return { code: 'GL', dial: '', flag: '🌐' };
}

/**
 * Adapt Server 3 & 4 Virtual OTP service items.
 */
export function adaptServer34Item(
  item: BackendServer34Item,
  serverId: 3 | 4,
  index: number = 0
): VirtualOtpServiceItem {
  const serviceCode = item.id || 'all';
  const rawName = item.name || item.country || 'Virtual Service';
  const price = Number(item.price || (serverId === 3 ? 45 : 55));
  const stock = Number(item.stock ?? 999);
  const icon = item.icon || (serverId === 3 ? '⚡' : '📶');

  // Fast path for Server 4: Carrier pool has 21,000+ app names without parentheses
  if (serverId === 4) {
    const cleanServiceName = rawName.trim();
    return {
      id: `s4_${serviceCode}_${index}`,
      server: 4,
      serviceCode,
      serviceName: cleanServiceName,
      rawName,
      country: 'Global Carrier',
      countryCode: item.country_code || 'GL',
      callingCode: '',
      flag: '📶',
      icon,
      priceInr: price,
      availableCount: stock,
      category: mapAppCode(cleanServiceName, serviceCode),
      speed: '10-30s Carrier',
      successRate: 96,
    };
  }

  // Server 3 path: Parse service name and country from parentheses
  let cleanServiceName = rawName;
  let cleanCountry = item.country || 'Global';

  const parenMatch = rawName.match(/^(.*?)\s*\((.+)\)\s*$/);
  if (parenMatch) {
    cleanServiceName = parenMatch[1].trim();
    cleanCountry = parenMatch[2].replace(/[()]/g, '').trim();
  } else if (cleanCountry.includes('(')) {
    const cpMatch = cleanCountry.match(/\((.+)\)/);
    if (cpMatch) {
      cleanCountry = cpMatch[1].replace(/[()]/g, '').trim();
    }
  }

  const meta = parseCountryMeta(cleanCountry);

  return {
    id: `s3_${serviceCode}_${cleanCountry.replace(/[^a-zA-Z0-9]/g, '_')}_${price}_${index}`,
    server: 3,
    serviceCode,
    serviceName: cleanServiceName,
    rawName,
    country: cleanCountry,
    countryCode: item.country_code || meta.code,
    callingCode: meta.dial,
    flag: meta.flag,
    icon,
    priceInr: price,
    availableCount: stock,
    category: mapAppCode(cleanServiceName, serviceCode),
    speed: '1-3s Instant',
    successRate: 99,
  };
}

/**
 * Helper to map category name to SmmPlatform.
 */
export function mapSmmPlatform(cat: string | undefined): SmmPlatform {
  if (!cat) return 'telegram';
  const c = cat.toLowerCase();
  if (c.includes('tele')) return 'telegram';
  if (c.includes('insta')) return 'instagram';
  if (c.includes('you') || c.includes('yt')) return 'youtube';
  if (c.includes('tik')) return 'tiktok';
  if (c.includes('twit') || c.includes('x')) return 'twitter';
  return 'telegram';
}

/**
 * Adapt Server 5 SMM service items.
 */
export function adaptServer5Item(item: BackendServer5Item): SmmServiceItem {
  const platform = mapSmmPlatform(item.category || item.name);
  const name = item.name || `${item.category || 'SMM'} Boost Package`;
  const price = Number(item.price || 95);
  const minQty = Number(item.min_qty || 100);
  const maxQty = Number(item.max_qty || 10000);

  return {
    id: String(item.id || `smm_${platform}_${minQty}`),
    platform,
    categoryName: `${item.category || platform.toUpperCase()} Boost`,
    name,
    ratePer1000: price,
    minQuantity: minQty,
    maxQuantity: maxQty,
    avgSpeed: 'Instant - High Speed',
    description: item.subtitle || `${name} non-drop growth service.`,
    refillDays: 30,
  };
}

/**
 * Parse monetary amount string like "-₹70" or "+₹250" or numeric 50 into signed integer.
 */
export function parseSignedAmount(amountRaw: string | number | undefined): number {
  if (typeof amountRaw === 'number') return amountRaw;
  if (!amountRaw) return 0;
  const cleaned = String(amountRaw).replace(/[^0-9.-]/g, '');
  const parsed = parseFloat(cleaned);
  if (isNaN(parsed)) return 0;
  if (String(amountRaw).trim().startsWith('+')) {
    return Math.abs(parsed);
  }
  if (String(amountRaw).trim().startsWith('-')) {
    return -Math.abs(parsed);
  }
  return parsed;
}

/**
 * Adapt backend history item into frontend HistoryItem.
 */
export function adaptHistoryItem(item: BackendHistoryItem, index: number): HistoryItem {
  const type = (item.type || 'order').toLowerCase();
  const rawTitle = item.title || 'Transaction';
  const details = item.details || '';
  const amountInr = parseSignedAmount(item.amount);
  const date = item.date || 'Recently';

  let category: OrderCategory = 'account_purchase';
  let status: OrderStatus = 'success';

  if (type === 'deposit') {
    category = 'deposit';
  } else if (type === 'transfer_sent' || type === 'transfer_received') {
    category = 'transfer';
  } else if (
    rawTitle.includes('Server 3') ||
    rawTitle.includes('Server 4') ||
    rawTitle.includes('OTP') ||
    details.includes('OTP')
  ) {
    category = 'otp_activation';
  } else if (rawTitle.includes('Server 5') || rawTitle.includes('SMM')) {
    category = 'smm_order';
  } else {
    category = 'account_purchase';
  }

  const detailsLower = details.toLowerCase();
  if (detailsLower.includes('waiting') || detailsLower.includes('pending')) {
    status = 'waiting';
  } else if (detailsLower.includes('progress')) {
    status = 'in_progress';
  } else if (detailsLower.includes('cancel') || detailsLower.includes('refund')) {
    status = 'refunded';
  } else {
    status = 'success';
  }

  // Extract phone number from details if present (e.g., "Number: +919876543210")
  let phone: string | undefined;
  const phoneMatch = details.match(/(?:Number:\s*)(\+?[0-9\s-]+)/i);
  if (phoneMatch && phoneMatch[1]) {
    phone = phoneMatch[1].trim();
  }

  // Extract OTP code from details if present (e.g., "OTP: 48192")
  let otpCode: string | undefined;
  const otpMatch = details.match(/(?:OTP:\s*)([0-9A-Za-z-]+)/i);
  if (otpMatch && otpMatch[1] && otpMatch[1].toLowerCase() !== 'none') {
    otpCode = otpMatch[1].trim();
  }

  const id = `hist_${Date.now().toString().slice(-4)}_${index}`;

  return {
    id,
    category,
    title: rawTitle,
    subtitle: details || (amountInr > 0 ? 'Credited to Wallet' : 'Dispatched Instantly'),
    amountInr,
    date,
    status,
    phone,
    otpCode,
    sessionDownloadUrl: item.download_url || undefined,
    refunded: status === 'refunded',
  };
}

/**
 * Adapt Reseller Dashboard metrics.
 */
export function adaptResellerConfig(
  data: BackendResellerPayload,
  current?: ResellerConfig
): ResellerConfig {
  const margin = Number(data.margin ?? data.margin_percent ?? current?.marginInr ?? 15);
  const minMargin = Number(data.min_margin ?? current?.minMargin ?? 5);
  const maxMargin = Number(data.max_margin ?? current?.maxMargin ?? 100);
  const token = data.token || current?.token || 'resell_vip';
  const resellerLink = data.link || `https://t.me/DeamonOTPbot?start=resell_${token}`;
  const customersCount = Number(data.customers ?? current?.customersCount ?? 0);
  const ordersCount = Number(data.orders ?? current?.ordersCount ?? 0);
  const totalProfitInr = Number(data.earnings ?? current?.totalProfitInr ?? 0);

  return {
    token,
    marginInr: margin,
    minMargin,
    maxMargin,
    resellerLink,
    customersCount,
    ordersCount,
    totalProfitInr,
  };
}
