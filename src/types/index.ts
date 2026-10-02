export type CurrencyPreference = 'INR' | 'USDT';

export interface UserProfile {
  id: number;
  telegramId: string;
  username: string;
  firstName: string;
  avatarUrl?: string;
  joinedDate: string;
  prefCurrency: CurrencyPreference;
  exchangeRateUsdt: number; // e.g. 94.0
  balance: number;          // Total wallet balance in INR (transferableBalance + promoBalance)
  promoBalance: number;     // Locked Promo balance in INR (for store purchases only, strictly NO P2P transfer, NO withdrawal)
  salesBalance: number;     // Earned reseller margin / affiliate profit in INR
  totalDeposited: number;   // Cumulative lifetime deposits
  totalSaved: number;       // Lifetime promo discounts
}

export type ServerId = 1 | 2 | 3 | 4 | 5;

// Server 1: LZT Market Global Accounts
export interface Server1AccountItem {
  id: string;
  country: string;
  countryCode: string;
  icon: string;
  priceInr: number;
  priceUsdt: number;
  stockCount: number;
  platform: 'Telegram';
  format: 'Session + 2FA' | 'TData';
  subtitle: string;
  credentialsSample?: {
    phone: string;
    twoFa: string;
    sessionFile: string;
    loginInstruction: string;
  };
}

// Server 2: Local Session Stock (Segmented Good vs Cheap Quality)
export type Server2QualityTier = 'good' | 'cheap';
export type Server2DeliveryFormat = 'account' | 'session';

export interface Server2StockItem {
  id: string;
  country: string;
  countryCode: string;
  icon: string;
  qualityTier: Server2QualityTier; // 'good' | 'cheap'
  accountYear: number;            // 2021-2025
  priceInr: number;
  stockCount: number;
  deliveryFormat: Server2DeliveryFormat; // 'account' (OTP assisted) | 'session' (.session/ZIP)
  subtitle: string;
  twoFaRequired: boolean;
  sampleSessionUrl?: string;
}

// Server 3 & 4: Virtual OTP Numbers (Fast OTP & Fresh Numbers)
export type OtpAppCode = 'wa' | 'tg' | 'ig' | 'spam' | 'go' | 'all';

export interface VirtualOtpServiceItem {
  id: string;
  server: 3 | 4; // 3 = Fast OTP (DGOTP), 4 = Fresh Numbers (Tempora)
  serviceCode: string;
  serviceName: string;
  country: string;
  countryCode: string;
  icon: string;
  priceInr: number;
  availableCount: number;
  category: OtpAppCode;
  speed: string;
  successRate: number;
}

export type OtpStatus = 'waiting' | 'received' | 'cancelled' | 'expired' | 'refunded';

export interface ActiveOtpSession {
  orderId: string;
  server: 3 | 4;
  serviceName: string;
  country: string;
  phone: string;
  priceInr: number;
  status: OtpStatus;
  otpCode: string | null;
  startTime: number;
  totalDurationSeconds: number;
  remainingSeconds: number;
}

// Server 5: SMM Services
export type SmmPlatform = 'instagram' | 'telegram' | 'youtube' | 'tiktok' | 'twitter';

export interface SmmServiceItem {
  id: string;
  platform: SmmPlatform;
  categoryName: string;
  name: string;
  ratePer1000: number;
  minQuantity: number;
  maxQuantity: number;
  avgSpeed: string;
  description: string;
  refillDays: number;
}

// Payment Methods
export type PaymentMethodType = 'fampay' | 'upi_direct' | 'usdt_bep20';

export interface DepositCheckout {
  id: string;
  method: PaymentMethodType;
  amountInr: number;
  amountUsdt?: number;
  referenceCode: string;
  qrImageUrl?: string;
  payAddressOrUpi: string;
  status: 'pending' | 'verified' | 'credited' | 'failed';
  utrSubmitted?: string;
  createdAt: string;
}

// Order & Transaction History
export type OrderCategory = 'otp_activation' | 'account_purchase' | 'smm_order' | 'deposit' | 'transfer';
export type OrderStatus = 'success' | 'waiting' | 'in_progress' | 'cancelled' | 'refunded';

export interface HistoryItem {
  id: string;
  category: OrderCategory;
  title: string;
  subtitle: string;
  amountInr: number; // Negative for expense, positive for deposit/credit
  date: string;
  status: OrderStatus;
  server?: string;
  phone?: string;
  otpCode?: string;
  twoFa?: string;
  sessionDownloadUrl?: string;
  quantity?: number;
  targetLink?: string;
  utr?: string;
  recipient?: string;
  refunded?: boolean;
}

// Reseller Margin Config
export interface ResellerConfig {
  token: string;
  marginInr: number; // ₹5 - ₹100
  minMargin: number;
  maxMargin: number;
  resellerLink: string;
  customersCount: number;
  ordersCount: number;
  totalProfitInr: number;
}

// Toast
export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastMessage {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  durationMs?: number;
}
