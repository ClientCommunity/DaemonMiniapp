export type ServiceCategory = 'all' | 'otp' | 'session' | 'smm';

export interface ServiceItem {
  id: string;
  name: string;
  category: 'otp' | 'session' | 'smm';
  server: string;
  country: string;
  flag: string;
  priceInr: number;
  priceUsdt: number;
  format: string;
  speed: string;
  stockText: string;
  successRate: string;
  description: string;
  isLive?: boolean;
  badge?: string;
  deliverySpeed?: string;
  stock?: string;
}

export interface BuyIntent {
  server: number;
  serviceId: string;
  name: string;
  country: string;
  quantity: number;
  priceInr: number;
  format?: string;
}

export interface FaqItem {
  q: string;
  a: string;
  category: string;
}

export interface ServerInfrastructureCard {
  id: number;
  title: string;
  badge: string;
  badgeColor: string;
  tagline: string;
  description: string;
  features: string[];
  specs: { label: string; val: string }[];
}

export interface LandingPageProps {
  onLoginSuccess: (
    token: string,
    user?: unknown,
    targetTab?: 'home' | 'store' | 'deposit' | 'history' | 'profile'
  ) => void;
}
