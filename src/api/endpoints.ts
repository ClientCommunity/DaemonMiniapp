import { api, resolveApiUrl } from './client';
import {
  BackendUserPayload,
  BackendServer1Item,
  BackendServer2Item,
  BackendServer34Item,
  BackendServer5Item,
  BackendHistoryItem,
  BackendResellerPayload,
} from './adapters';

export interface AuthResponse {
  success: boolean;
  user: BackendUserPayload;
  error?: string;
}

export interface ServersOverviewResponse {
  success: boolean;
  servers: Array<{
    id: number;
    name: string;
    subtitle: string;
    icon: string;
    enabled: boolean;
  }>;
}

export interface Server1StockResponse {
  success: boolean;
  items: BackendServer1Item[];
}

export interface Server2StockResponse {
  success: boolean;
  tier: 'good' | 'cheap';
  good_count: number;
  cheap_count: number;
  items: BackendServer2Item[];
}

export interface Server3StockResponse {
  success: boolean;
  items: BackendServer34Item[];
}

export interface Server4StockResponse {
  success: boolean;
  items: BackendServer34Item[];
}

export interface Server5StockResponse {
  success: boolean;
  items: BackendServer5Item[];
}

export interface BuyPayload {
  server: number;
  item: Record<string, unknown>;
  qty?: number;
  tier?: string;
  format?: string;
}

export interface BuyResponse {
  success: boolean;
  order_id?: string | number;
  phone?: string;
  delivery_type?: string;
  download_url?: string;
  count?: number;
  twofa?: string;
  new_balance?: number;
  new_promo_balance?: number;
  price?: number;
  error?: string;
  required?: number;
}

export interface OtpStatusResponse {
  success?: boolean;
  status: 'waiting' | 'completed' | 'delivered' | 'not_found' | string;
  otp: string | null;
  phone?: string;
  server?: string;
  time_left?: number;
  order_id?: string | number;
}

export interface OtpCancelResponse {
  success: boolean;
  order_id?: string | number;
  refunded_amount?: number;
  new_balance?: number;
  error?: string;
}

export interface TransferPayload {
  recipient: string;
  amount: number;
}

export interface TransferResponse {
  success: boolean;
  transfer_id?: number;
  sender_id?: number;
  recipient_id?: number | string;
  amount?: number;
  transferred?: number;
  new_balance?: number;
  error?: string;
}

export interface FamPayDepositResponse {
  success: boolean;
  reference?: string;
  amount?: number;
  upi_id?: string;
  upi_uri?: string;
  qr_url?: string;
  expires_at?: string;
  status?: string;
  error?: string;
}

export interface FamPayCheckResponse {
  reference?: string;
  status?: string;
  amount?: number;
  new_balance?: number;
}

export interface ManualDepositSubmitResponse {
  success: boolean;
  message?: string;
  deposit_id?: number;
  status?: string;
  error?: string;
}

export interface ResellerSetMarginResponse {
  success: boolean;
  margin?: number;
  min_margin?: number;
  max_margin?: number;
  error?: string;
}

export interface HistoryResponse {
  success: boolean;
  items: BackendHistoryItem[];
}

/**
 * Authentication Endpoints
 */
export const authApi = {
  authenticate: () => api.post<AuthResponse>('/api/auth', {}),
  getMe: () => api.get<AuthResponse>('/api/auth/me'),
  updateCurrency: (curr: 'INR' | 'USDT') =>
    api.post<{ success: boolean; curr: string }>('/api/profile/currency', { curr }),
};

/**
 * Store Stock Endpoints (Servers 1 through 5)
 */
export const storeApi = {
  getServers: () => api.get<ServersOverviewResponse>('/api/store/servers'),
  getServer1: () => api.get<Server1StockResponse>('/api/store/server1'),
  getServer2: (tier: 'good' | 'cheap' = 'good') =>
    api.get<Server2StockResponse>('/api/store/server2', { tier }),
  getServer3: () => api.get<Server3StockResponse>('/api/store/server3'),
  getServer4: () => api.get<Server4StockResponse>('/api/store/server4'),
  getServer5: () => api.get<Server5StockResponse>('/api/store/server5'),
};

/**
 * Order Execution & Fulfillment
 */
export const orderApi = {
  buy: (payload: BuyPayload) => api.post<BuyResponse>('/api/buy', payload),
};

/**
 * Active OTP Polling & Cancellation
 */
export const otpApi = {
  getStatus: (phoneOrOrderId: string) =>
    api.get<OtpStatusResponse>('/api/otp/status', {
      phone: phoneOrOrderId,
      order_id: phoneOrOrderId,
    }),
  cancel: (phoneOrOrderId: string) =>
    api.post<OtpCancelResponse>('/api/otp/cancel', { phone: phoneOrOrderId }),
};

/**
 * Downloads & Media Streaming
 */
export const downloadApi = {
  getSessionDownloadUrl: (phone: string): string => {
    const cleanPhone = encodeURIComponent(phone.replace('+', ''));
    return resolveApiUrl(`/api/session/download/${cleanPhone}`);
  },
  getBulkZipDownloadUrl: (orderId: string): string => {
    const cleanOrderId = encodeURIComponent(orderId);
    return resolveApiUrl(`/api/session/download_zip/${cleanOrderId}`);
  },
  triggerDownload: (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  },
};

/**
 * P2P Financial Transfers
 */
export const transferApi = {
  transfer: (payload: TransferPayload) => api.post<TransferResponse>('/api/transfer', payload),
};

/**
 * Deposit Gateways
 */
export const depositApi = {
  createFamPay: (amount: number) =>
    api.post<FamPayDepositResponse>('/api/deposit/fampay', { amount }),
  checkFamPay: (ref: string) =>
    api.get<FamPayCheckResponse>('/api/deposit/fampay/check', { ref }),
  submitManual: (methodId: number, utr: string, amount: number) =>
    api.post<ManualDepositSubmitResponse>('/api/deposit/manual/submit', {
      method_id: methodId,
      utr,
      amount,
    }),
};

/**
 * Reseller Margin Engine
 */
export const resellerApi = {
  getStats: () => api.get<BackendResellerPayload>('/api/reseller'),
  setMargin: (margin: number) =>
    api.post<ResellerSetMarginResponse>('/api/reseller/set_margin', { margin }),
};

/**
 * Activity History
 */
export const historyApi = {
  getHistory: () => api.get<HistoryResponse>('/api/history'),
};
