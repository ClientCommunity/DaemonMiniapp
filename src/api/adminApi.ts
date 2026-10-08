/**
 * Comprehensive Admin REST API Client.
 * Implements typed methods for all 5 administrative dashboard tabs and RBAC routes:
 * 1. Overview & Stats (/api/admin/stats, /api/admin/stats/providers, /api/admin/overview)
 * 2. Server 1-5 Management (/api/admin/server1/*, /api/admin/stock/*, /api/admin/servers/*, /api/admin/server5/*)
 * 3. Payments & Gateways (/api/admin/deposits/*, /api/admin/fampay/*, /api/admin/custom-payments/*, /api/admin/settings/min-deposit)
 * 4. User & Wallet Management (/api/admin/users/search, /api/admin/users/balance, /api/admin/users/ban)
 * 5. Marketing & System Settings (/api/admin/reseller/*, /api/admin/promo-codes/*, /api/admin/system/*, /api/admin/settings)
 */
import { api } from './client';

// ==============================================================================
// TYPE DEFINITIONS
// ==============================================================================

export interface AdminPermissions {
  p_add_stock?: number;
  p_manage_stock?: number;
  p_stats?: number;
  p_bal?: number;
  p_settings?: number;
  [key: string]: number | undefined;
}

export interface AdminLoginResponse {
  success: boolean;
  token?: string;
  expires_in?: number;
  user_id?: number;
  permissions?: AdminPermissions;
  error?: string;
}

export interface AdminMeResponse {
  success: boolean;
  user_id?: number;
  is_admin: boolean;
  permissions?: AdminPermissions;
  error?: string;
}

export interface AdminOverviewStats {
  users_count: number;
  total_balance: number;
  total_promo_balance: number;
  total_sales_balance?: number;
  total_deposited_inr: number;
  successful_deposits_count: number;
  total_orders_count: number;
  total_orders_revenue_inr: number;
  pending_deposits: number;
  stock_good_count: number;
  stock_cheap_count: number;
  stock_total_count: number;
  [key: string]: unknown;
}

export interface ProviderBalances {
  lzt_balance?: number | string;
  dgotp_balance?: number | string;
  temporasms_balance?: number | string;
  smm_balance?: number | string;
  [key: string]: unknown;
}

export interface Server1Settings {
  status: 'on' | 'off';
  has_token: boolean;
  global_markup: number;
  country_markups: Record<string, number>;
  [key: string]: unknown;
}

export interface Server2StockItemAdmin {
  phone: string;
  country_name: string;
  country_icon?: string;
  account_year: number;
  quality_tier: 'good' | 'cheap';
  price: number;
  twofa?: string;
  available?: number;
  created_at?: string;
  seller_id?: number;
}

export interface Server2UploadPayload {
  quality_tier: 'good' | 'cheap';
  country?: string;
  year?: number;
  price?: number;
  country_icon?: string;
  items: Array<{
    phone: string;
    session_data?: string;
    twofa?: string;
    [key: string]: unknown;
  }>;
}

export interface Server2SingleAddPayload {
  phone: string;
  country_name?: string;
  country_icon?: string;
  quality_tier: 'good' | 'cheap';
  account_year?: number;
  price?: number;
  session_file?: string;
  twofa?: string;
}

export interface ManagedServerConfig {
  server_no: number;
  name: string;
  enabled: boolean;
  api_url?: string;
  api_key?: string;
  percent_markup?: number;
  fixed_markup?: number;
  [key: string]: unknown;
}

export interface SmmProvider {
  id: number;
  name: string;
  api_url: string;
  api_key: string;
  percent_markup: number;
  currency: string;
  enabled: number;
}

export interface SmmCategory {
  id: number;
  name: string;
  platform: string;
  icon?: string;
  enabled: number;
  services_count?: number;
}

export interface SmmServiceAdmin {
  id: number;
  category_id: number;
  provider_id: number;
  name: string;
  min_quantity: number;
  max_quantity: number;
  rate_per_1k: number;
  enabled: number;
}

export interface SmmOrder {
  id: number;
  user_id: number;
  service_id: number;
  service_name?: string;
  target_link: string;
  quantity: number;
  charge: number;
  status: string;
  created_at: string;
}

export interface PendingDeposit {
  deposit_id: number;
  user_id: number;
  username?: string;
  amount: number;
  method: string;
  utr: string;
  status: string;
  created_at: string;
  notes?: string;
}

export interface FampayGateway {
  id: number;
  name: string;
  upi_id: string;
  payment_name: string;
  min_deposit: number;
  max_deposit: number;
  gmail?: string;
  enabled: number;
}

export interface CustomPayment {
  id: number;
  name: string;
  caption: string;
  qr_file_id?: string;
  enabled?: number;
}

export interface AdminUserInfo {
  user_id: number;
  username?: string;
  first_name?: string;
  balance: number;
  promo_balance: number;
  transferable_balance: number;
  sales_balance: number;
  total_deposited: number;
  banned: number;
  joined_date?: string;
  orders?: unknown[];
  deposits?: unknown[];
}

export interface AdjustBalancePayload {
  user_id: number;
  amount: number;
  type: 'credit' | 'debit';
  is_promo?: boolean;
  reason?: string;
}

export interface ResellerSettings {
  min_margin: number;
  max_margin: number;
  status: 'on' | 'off';
}

export interface PromoCodeItem {
  code: string;
  value: number;
  max_uses: number;
  used_count: number;
  created_at?: string;
  active: number;
}

export interface PromoCodeCreatePayload {
  code: string;
  value: number;
  max_uses?: number;
}

// ==============================================================================
// ADMIN API CLIENT IMPLEMENTATION
// ==============================================================================

export const adminApi = {
  // --- Authentication & Gatekeeping ---

  /**
   * Challenge the admin secret passphrase and acquire a signed session JWT.
   */
  login: async (secret: string): Promise<AdminLoginResponse> => {
    return api.post<AdminLoginResponse>('/api/admin/login', {
      secret,
      passphrase: secret,
    });
  },

  /**
   * Verify session token and retrieve current admin profile and permissions.
   */
  getAdminMe: async (): Promise<AdminMeResponse> => {
    return api.get<AdminMeResponse>('/api/admin/me');
  },

  // --- Tab 1: Overview & Analytics ---

  /**
   * Retrieve high-level system analytics, revenue, and inventory stats.
   */
  getOverview: async (): Promise<{ success: boolean; stats: AdminOverviewStats }> => {
    return api.get<{ success: boolean; stats: AdminOverviewStats }>('/api/admin/overview');
  },

  /**
   * Alias for getOverview.
   */
  getStats: async (): Promise<{ success: boolean; stats: AdminOverviewStats }> => {
    return api.get<{ success: boolean; stats: AdminOverviewStats }>('/api/admin/stats');
  },

  /**
   * Retrieve upstream provider API balances (LZT, DGOTP, TemporaSMS, SMM).
   */
  getProviderBalances: async (): Promise<{ success: boolean; provider_balances: ProviderBalances }> => {
    return api.get<{ success: boolean; provider_balances: ProviderBalances }>('/api/admin/stats/providers');
  },

  // --- Tab 2: Server 1 Management (LZT Accounts) ---

  getServer1Settings: async (): Promise<{ success: boolean; settings: Server1Settings }> => {
    return api.get<{ success: boolean; settings: Server1Settings }>('/api/admin/server1/config');
  },

  updateServer1Markup: async (
    country: string,
    markup: number
  ): Promise<{ success: boolean; country?: string; markup?: number }> => {
    return api.post('/api/admin/server1/markup', {
      country,
      markup_percent: markup,
    });
  },

  updateServer1GlobalMarkup: async (
    globalMarkup: number
  ): Promise<{ success: boolean; global_markup: number }> => {
    return api.post('/api/admin/server1/markup', {
      global_markup: globalMarkup,
    });
  },

  toggleServer1: async (
    status?: 'on' | 'off'
  ): Promise<{ success: boolean; status: string }> => {
    return api.post('/api/admin/server1/toggle', { status });
  },

  setServer1Token: async (
    token: string
  ): Promise<{ success: boolean; has_token: boolean }> => {
    return api.post('/api/admin/server1/token', { token });
  },

  // --- Tab 2: Server 2 Management (Fresh Sessions) ---

  getServer2Stock: async (params?: {
    tier?: 'good' | 'cheap';
    limit?: number;
  }): Promise<{ success: boolean; items: Server2StockItemAdmin[] }> => {
    return api.get<{ success: boolean; items: Server2StockItemAdmin[] }>(
      '/api/admin/stock/manage',
      params
    );
  },

  uploadServer2Stock: async (
    payload: Server2UploadPayload
  ): Promise<{ success: boolean; added?: number; total?: number; error?: string }> => {
    return api.post('/api/admin/stock/bulk-upload', payload);
  },

  addServer2StockSingle: async (
    payload: Server2SingleAddPayload
  ): Promise<{ success: boolean; phone?: string; error?: string }> => {
    return api.post('/api/admin/stock/add', payload);
  },

  deleteServer2Stock: async (
    phone: string
  ): Promise<{ success: boolean; message?: string; error?: string }> => {
    return api.delete('/api/admin/stock/manage', { phone }, { phone });
  },

  // --- Tab 2: Servers 3 & 4 Management (Virtual OTP Numbers) ---

  getServersConfig: async (): Promise<{ success: boolean; servers: ManagedServerConfig[] }> => {
    return api.get<{ success: boolean; servers: ManagedServerConfig[] }>('/api/admin/servers/managed');
  },

  getServerConfig: async (
    serverNo: number
  ): Promise<{ success: boolean; config: ManagedServerConfig }> => {
    return api.get<{ success: boolean; config: ManagedServerConfig }>(`/api/admin/servers/${serverNo}/config`);
  },

  updateServerConfig: async (
    serverNo: number,
    config: Record<string, unknown>
  ): Promise<{ success: boolean; message?: string }> => {
    return api.post(`/api/admin/servers/${serverNo}/config`, config);
  },

  toggleServer: async (
    serverNo: number,
    enabled: boolean
  ): Promise<{ success: boolean; server_no: number; enabled: boolean }> => {
    return api.post(`/api/admin/servers/${serverNo}/toggle`, { enabled });
  },

  syncServer: async (
    serverNo: number
  ): Promise<{ success: boolean; server_no: number; message: string }> => {
    return api.post(`/api/admin/servers/${serverNo}/sync`);
  },

  getServer3Services: async (
    limit: number = 100
  ): Promise<{ success: boolean; services: unknown[] }> => {
    return api.get('/api/admin/server3/services', { limit });
  },

  toggleServer3Service: async (
    serviceCode: string,
    serverCode?: string
  ): Promise<{ success: boolean; service_code: string; enabled: boolean }> => {
    return api.post('/api/admin/server3/services/toggle', {
      service_code: serviceCode,
      server_code: serverCode,
    });
  },

  getServer4Services: async (
    limit: number = 100
  ): Promise<{ success: boolean; services: unknown[] }> => {
    return api.get('/api/admin/server4/services', { limit });
  },

  toggleServer4Service: async (
    operatorCode: string,
    serviceCode: string
  ): Promise<{ success: boolean; operator_code: string; service_code: string; enabled: boolean }> => {
    return api.post('/api/admin/server4/services/toggle', {
      operator_code: operatorCode,
      service_code: serviceCode,
    });
  },

  // --- Tab 2: Server 5 Management (SMM Services) ---

  getSmmOverview: async (): Promise<{ success: boolean; overview: unknown }> => {
    return api.get('/api/admin/server5/overview');
  },

  toggleSmmMaster: async (
    enabled: boolean
  ): Promise<{ success: boolean; enabled: boolean }> => {
    return api.post('/api/admin/server5/toggle', { enabled });
  },

  getSmmProviders: async (): Promise<{ success: boolean; providers: SmmProvider[] }> => {
    return api.get<{ success: boolean; providers: SmmProvider[] }>('/api/admin/server5/providers');
  },

  addSmmProvider: async (provider: {
    name: string;
    api_url: string;
    api_key: string;
    percent_markup?: number;
    currency?: string;
  }): Promise<{ success: boolean; provider_id?: number }> => {
    return api.post('/api/admin/server5/providers', provider);
  },

  toggleSmmProvider: async (
    providerId: number
  ): Promise<{ success: boolean; provider_id: number; enabled: boolean }> => {
    return api.post(`/api/admin/server5/providers/${providerId}/toggle`);
  },

  deleteSmmProvider: async (
    providerId: number
  ): Promise<{ success: boolean; message?: string }> => {
    return api.delete(`/api/admin/server5/providers/${providerId}`);
  },

  getSmmCategories: async (): Promise<{ success: boolean; categories: SmmCategory[] }> => {
    return api.get<{ success: boolean; categories: SmmCategory[] }>('/api/admin/server5/categories');
  },

  toggleSmmCategory: async (
    categoryId: number
  ): Promise<{ success: boolean; category_id: number; enabled: boolean }> => {
    return api.post(`/api/admin/server5/categories/${categoryId}/toggle`);
  },

  getSmmServices: async (params?: {
    category_id?: number;
    limit?: number;
  }): Promise<{ success: boolean; services: SmmServiceAdmin[] }> => {
    return api.get<{ success: boolean; services: SmmServiceAdmin[] }>('/api/admin/server5/services', params);
  },

  toggleSmmService: async (
    serviceId: number
  ): Promise<{ success: boolean; service_id: number; enabled: boolean }> => {
    return api.post(`/api/admin/server5/services/${serviceId}/toggle`);
  },

  getSmmOrders: async (
    limit: number = 50
  ): Promise<{ success: boolean; orders: SmmOrder[] }> => {
    return api.get<{ success: boolean; orders: SmmOrder[] }>('/api/admin/server5/orders', { limit });
  },

  // --- Tab 3: Payments & Deposit Hub ---

  getPendingDeposits: async (): Promise<{ success: boolean; deposits: PendingDeposit[] }> => {
    return api.get<{ success: boolean; deposits: PendingDeposit[] }>('/api/admin/deposits/pending');
  },

  depositAction: async (
    depositId: number,
    action: 'approve' | 'reject',
    rejectionReason?: string
  ): Promise<{ success: boolean; message?: string; deposit_id?: number }> => {
    if (action === 'approve') {
      return api.post('/api/admin/deposits/approve', { deposit_id: depositId });
    }
    return api.post('/api/admin/deposits/reject', {
      deposit_id: depositId,
      rejection_reason: rejectionReason,
    });
  },

  approveDeposit: async (
    depositId: number,
    amount?: number
  ): Promise<{ success: boolean; message?: string; deposit_id?: number }> => {
    return api.post('/api/admin/deposits/approve', { deposit_id: depositId, amount });
  },

  rejectDeposit: async (
    depositId: number,
    rejectionReason?: string
  ): Promise<{ success: boolean; message?: string; deposit_id?: number }> => {
    return api.post('/api/admin/deposits/reject', {
      deposit_id: depositId,
      rejection_reason: rejectionReason,
    });
  },

  getFampayGateways: async (): Promise<{ success: boolean; gateways: FampayGateway[] }> => {
    return api.get<{ success: boolean; gateways: FampayGateway[] }>('/api/admin/fampay/gateways');
  },

  createFampayGateway: async (
    data: Partial<FampayGateway>
  ): Promise<{ success: boolean; gateway?: FampayGateway }> => {
    return api.post('/api/admin/fampay/gateways', data);
  },

  updateFampayGateway: async (
    id: number,
    data: Partial<FampayGateway>
  ): Promise<{ success: boolean; gateway?: FampayGateway }> => {
    return api.put(`/api/admin/fampay/gateways/${id}`, data);
  },

  toggleFampayGateway: async (
    id: number
  ): Promise<{ success: boolean; gateway_id: number; enabled: boolean }> => {
    return api.post(`/api/admin/fampay/gateways/${id}/toggle`);
  },

  deleteFampayGateway: async (
    id: number
  ): Promise<{ success: boolean; message?: string }> => {
    return api.delete(`/api/admin/fampay/gateways/${id}`);
  },

  getCustomPayments: async (): Promise<{ success: boolean; payments: CustomPayment[] }> => {
    return api.get<{ success: boolean; payments: CustomPayment[] }>('/api/admin/custom-payments');
  },

  createCustomPayment: async (data: {
    name: string;
    caption?: string;
    qr_file_id?: string;
  }): Promise<{ success: boolean; payment?: CustomPayment }> => {
    return api.post('/api/admin/custom-payments', data);
  },

  updateCustomPayment: async (
    id: number,
    data: Partial<CustomPayment>
  ): Promise<{ success: boolean; payment?: CustomPayment }> => {
    return api.put(`/api/admin/custom-payments/${id}`, data);
  },

  toggleCustomPayment: async (
    id: number
  ): Promise<{ success: boolean; message?: string }> => {
    return api.put(`/api/admin/custom-payments/${id}`, { toggle: true });
  },

  deleteCustomPayment: async (
    id: number
  ): Promise<{ success: boolean; message?: string }> => {
    return api.delete(`/api/admin/custom-payments/${id}`);
  },

  getMinDepositSettings: async (): Promise<{
    success: boolean;
    min_deposit: number;
    min_upi_dep: number;
    min_cw_dep: number;
    fampay_min_dep: number;
  }> => {
    return api.get('/api/admin/settings/min-deposit');
  },

  updateMinDepositSettings: async (
    data: Record<string, number>
  ): Promise<{ success: boolean; min_deposit?: number }> => {
    return api.post('/api/admin/settings/min-deposit', data);
  },

  // --- Tab 4: User & Wallet Management ---

  searchUser: async (
    query: string
  ): Promise<{ success: boolean; user?: AdminUserInfo; error?: string }> => {
    return api.get<{ success: boolean; user?: AdminUserInfo; error?: string }>(
      '/api/admin/users/search',
      { query }
    );
  },

  adjustUserBalance: async (
    payload: AdjustBalancePayload
  ): Promise<{
    success: boolean;
    user_id?: number;
    new_balance?: number;
    new_promo_balance?: number;
    error?: string;
  }> => {
    return api.post('/api/admin/users/balance', payload);
  },

  banUser: async (
    userId: number,
    banned: boolean
  ): Promise<{ success: boolean; user_id: number; banned: boolean }> => {
    return api.post('/api/admin/users/ban', {
      user_id: userId,
      banned,
    });
  },

  // --- Tab 5: Marketing & Reseller Settings ---

  getResellerSettings: async (): Promise<{ success: boolean; settings: ResellerSettings }> => {
    return api.get<{ success: boolean; settings: ResellerSettings }>('/api/admin/reseller/settings');
  },

  updateResellerSettings: async (
    payload: Partial<ResellerSettings>
  ): Promise<{ success: boolean; settings?: ResellerSettings }> => {
    return api.post('/api/admin/reseller/settings', payload);
  },

  getPromoCodes: async (): Promise<{ success: boolean; promo_codes: PromoCodeItem[] }> => {
    return api.get<{ success: boolean; promo_codes: PromoCodeItem[] }>('/api/admin/promo-codes');
  },

  createPromoCode: async (
    payload: PromoCodeCreatePayload
  ): Promise<{ success: boolean; promo_code?: PromoCodeItem; error?: string }> => {
    return api.post('/api/admin/promo-codes', payload);
  },

  deactivatePromoCode: async (
    code: string
  ): Promise<{ success: boolean; message?: string }> => {
    return api.delete(`/api/admin/promo-codes/${encodeURIComponent(code)}`);
  },

  getForceJoinSettings: async (): Promise<{
    success: boolean;
    status: string;
    channels: string;
  }> => {
    return api.get('/api/admin/system/force-join');
  },

  updateForceJoinSettings: async (data: {
    status?: 'on' | 'off';
    channels?: string[];
  }): Promise<{ success: boolean; force_join_status: string }> => {
    return api.post('/api/admin/system/force-join', data);
  },

  getBotStatus: async (): Promise<{ success: boolean; bot_status: string }> => {
    return api.get<{ success: boolean; bot_status: string }>('/api/admin/system/bot-status');
  },

  toggleBotStatus: async (
    status?: string
  ): Promise<{ success: boolean; bot_status: string }> => {
    return api.post('/api/admin/system/bot-status', { status });
  },

  getSettings: async (): Promise<{ success: boolean; settings: Record<string, string | null> }> => {
    return api.get('/api/admin/settings');
  },

  updateSetting: async (
    key: string,
    value: string
  ): Promise<{ success: boolean; key: string; value: string }> => {
    return api.post('/api/admin/settings', { key, value });
  },
};
