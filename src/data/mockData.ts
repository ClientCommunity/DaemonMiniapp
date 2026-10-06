import {
  UserProfile,
  Server1AccountItem,
  Server2StockItem,
  VirtualOtpServiceItem,
  SmmServiceItem,
  HistoryItem,
  ResellerConfig
} from '../types';

/**
 * Clean initial user profile without synthetic data.
 * Real data is populated exclusively via backend /api/auth.
 */
export const initialUserProfile: UserProfile = {
  id: 0,
  telegramId: "",
  username: "",
  firstName: "User",
  avatarUrl: "",
  joinedDate: "Recently",
  prefCurrency: "INR",
  exchangeRateUsdt: 94.0,
  balance: 0,
  promoBalance: 0,
  salesBalance: 0,
  totalDeposited: 0,
  totalSaved: 0,
};

/**
 * Real inventory catalogues: Start empty and populate strictly from live backend endpoints.
 */
export const server1Catalog: Server1AccountItem[] = [];
export const server2Catalog: Server2StockItem[] = [];
export const server34Catalog: VirtualOtpServiceItem[] = [];
export const server5Catalog: SmmServiceItem[] = [];

/**
 * Real order history: Starts empty and loads from /api/history.
 */
export const initialHistoryItems: HistoryItem[] = [];

/**
 * Real reseller configuration: Starts empty and syncs with /api/reseller.
 */
export const initialResellerConfig: ResellerConfig = {
  token: "",
  marginInr: 15,
  minMargin: 5,
  maxMargin: 100,
  resellerLink: "",
  customersCount: 0,
  ordersCount: 0,
  totalProfitInr: 0
};
