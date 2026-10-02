import {
  UserProfile,
  Server1AccountItem,
  Server2StockItem,
  VirtualOtpServiceItem,
  SmmServiceItem,
  HistoryItem,
  ResellerConfig
} from '../types';

export const initialUserProfile: UserProfile = {
  id: 7507183871,
  telegramId: "7507183871",
  username: "krish_dev",
  firstName: "Krish Patel",
  avatarUrl: "",
  joinedDate: "August 2024",
  prefCurrency: "INR",
  exchangeRateUsdt: 94.0,
  balance: 650,         // Total = ₹650 (Transferable = ₹500, Promo = ₹150)
  promoBalance: 150,    // Locked Promo Balance (purchases only)
  salesBalance: 240,    // Reseller profit
  totalDeposited: 1500,
  totalSaved: 210,
};

export const server1Catalog: Server1AccountItem[] = [
  {
    id: "s1_in",
    country: "India",
    countryCode: "IN",
    icon: "🇮🇳",
    priceInr: 85,
    priceUsdt: 0.90,
    stockCount: 42,
    platform: "Telegram",
    format: "Session + 2FA",
    subtitle: "Global Market Stock",
    credentialsSample: {
      phone: "+91 98234 19283",
      twoFa: "krish@2024TG",
      sessionFile: "1BAAABbZ4W...telethon.session",
      loginInstruction: "Import .session into Telethon or Pyrogram, or use 2FA password to complete login."
    }
  },
  {
    id: "s1_ru",
    country: "Russia",
    countryCode: "RU",
    icon: "🇷🇺",
    priceInr: 95,
    priceUsdt: 1.01,
    stockCount: 85,
    platform: "Telegram",
    format: "Session + 2FA",
    subtitle: "Global Market Stock",
    credentialsSample: {
      phone: "+7 912 849 2011",
      twoFa: "tgPass@2024RU",
      sessionFile: "1RUAAAb8K...telethon.session",
      loginInstruction: "Instant login session with established trusted device history."
    }
  },
  {
    id: "s1_us",
    country: "United States",
    countryCode: "US",
    icon: "🇺🇸",
    priceInr: 120,
    priceUsdt: 1.28,
    stockCount: 18,
    platform: "Telegram",
    format: "Session + 2FA",
    subtitle: "Global Market Stock",
    credentialsSample: {
      phone: "+1 415 892 0184",
      twoFa: "usSafe@tg2024",
      sessionFile: "1USAAAbX8...telethon.session",
      loginInstruction: "US clean carrier account with 2FA enabled."
    }
  },
  {
    id: "s1_id",
    country: "Indonesia",
    countryCode: "ID",
    icon: "🇮🇩",
    priceInr: 75,
    priceUsdt: 0.80,
    stockCount: 63,
    platform: "Telegram",
    format: "Session + 2FA",
    subtitle: "Global Market Stock",
    credentialsSample: {
      phone: "+62 812 904 8831",
      twoFa: "indoSecured#24",
      sessionFile: "1IDAAAbM3...telethon.session",
      loginInstruction: "Aged Indonesian session with active peer score."
    }
  },
  {
    id: "s1_vn",
    country: "Vietnam",
    countryCode: "VN",
    icon: "🇻🇳",
    priceInr: 80,
    priceUsdt: 0.85,
    stockCount: 37,
    platform: "Telegram",
    format: "Session + 2FA",
    subtitle: "Global Market Stock",
    credentialsSample: {
      phone: "+84 938 102 944",
      twoFa: "vnPass@2024",
      sessionFile: "1VNAAAbY9...telethon.session",
      loginInstruction: "Vietnam Pyrogram format session file."
    }
  },
  {
    id: "s1_br",
    country: "Brazil",
    countryCode: "BR",
    icon: "🇧🇷",
    priceInr: 90,
    priceUsdt: 0.96,
    stockCount: 29,
    platform: "Telegram",
    format: "Session + 2FA",
    subtitle: "Global Market Stock",
    credentialsSample: {
      phone: "+55 11 98402 1194",
      twoFa: "brasilSafe#24",
      sessionFile: "1BRAAAbR4...telethon.session",
      loginInstruction: "Brazil trusted account with 2FA key."
    }
  },
  {
    id: "s1_ng",
    country: "Nigeria",
    countryCode: "NG",
    icon: "🇳🇬",
    priceInr: 65,
    priceUsdt: 0.69,
    stockCount: 54,
    platform: "Telegram",
    format: "Session + 2FA",
    subtitle: "Global Market Stock",
    credentialsSample: {
      phone: "+234 803 912 8490",
      twoFa: "ngKey#2024",
      sessionFile: "1NGAAAbF1...telethon.session",
      loginInstruction: "Budget tier account for high-volume tasks."
    }
  },
  {
    id: "s1_ph",
    country: "Philippines",
    countryCode: "PH",
    icon: "🇵🇭",
    priceInr: 80,
    priceUsdt: 0.85,
    stockCount: 31,
    platform: "Telegram",
    format: "Session + 2FA",
    subtitle: "Global Market Stock",
    credentialsSample: {
      phone: "+63 917 849 0184",
      twoFa: "phSafe#2024",
      sessionFile: "1PHAAAbL7...telethon.session",
      loginInstruction: "Stable Philippines session with low spam score."
    }
  },
  {
    id: "s1_kz",
    country: "Kazakhstan",
    countryCode: "KZ",
    icon: "🇰🇿",
    priceInr: 90,
    priceUsdt: 0.96,
    stockCount: 22,
    platform: "Telegram",
    format: "Session + 2FA",
    subtitle: "Global Market Stock",
    credentialsSample: {
      phone: "+7 701 984 0192",
      twoFa: "kzKey#2024",
      sessionFile: "1KZAAAbP2...telethon.session",
      loginInstruction: "Kazakhstan carrier verified account."
    }
  }
];

export const server2Catalog: Server2StockItem[] = [
  // Good Quality Accounts (Aged, Higher Stability)
  {
    id: "s2_g_in_2024",
    country: "India",
    countryCode: "IN",
    icon: "🇮🇳",
    qualityTier: "good",
    accountYear: 2024,
    priceInr: 80,
    stockCount: 50,
    deliveryFormat: "account",
    subtitle: "🟢 Good Quality",
    twoFaRequired: true,
    sampleSessionUrl: "https://krishminiapp.mock/download/s2_g_in_2024.session"
  },
  {
    id: "s2_g_us_2023",
    country: "United States",
    countryCode: "US",
    icon: "🇺🇸",
    qualityTier: "good",
    accountYear: 2023,
    priceInr: 95,
    stockCount: 24,
    deliveryFormat: "account",
    subtitle: "🟢 Good Quality",
    twoFaRequired: true,
    sampleSessionUrl: "https://krishminiapp.mock/download/s2_g_us_2023.session"
  },
  {
    id: "s2_g_ru_2022",
    country: "Russia",
    countryCode: "RU",
    icon: "🇷🇺",
    qualityTier: "good",
    accountYear: 2022,
    priceInr: 110,
    stockCount: 16,
    deliveryFormat: "session",
    subtitle: "🟢 Good Quality",
    twoFaRequired: true,
    sampleSessionUrl: "https://krishminiapp.mock/download/s2_g_ru_2022.session"
  },
  {
    id: "s2_g_id_2024",
    country: "Indonesia",
    countryCode: "ID",
    icon: "🇮🇩",
    qualityTier: "good",
    accountYear: 2024,
    priceInr: 70,
    stockCount: 38,
    deliveryFormat: "account",
    subtitle: "🟢 Good Quality",
    twoFaRequired: true,
    sampleSessionUrl: "https://krishminiapp.mock/download/s2_g_id_2024.session"
  },
  {
    id: "s2_g_vn_2021",
    country: "Vietnam",
    countryCode: "VN",
    icon: "🇻🇳",
    qualityTier: "good",
    accountYear: 2021,
    priceInr: 125,
    stockCount: 12,
    deliveryFormat: "session",
    subtitle: "🟢 Good Quality",
    twoFaRequired: true,
    sampleSessionUrl: "https://krishminiapp.mock/download/s2_g_vn_2021.session"
  },

  // Cheap Quality Accounts (Budget / High-Volume)
  {
    id: "s2_c_in_2024",
    country: "India",
    countryCode: "IN",
    icon: "🇮🇳",
    qualityTier: "cheap",
    accountYear: 2024,
    priceInr: 45,
    stockCount: 120,
    deliveryFormat: "account",
    subtitle: "🟡 Cheap Quality",
    twoFaRequired: false,
    sampleSessionUrl: "https://krishminiapp.mock/download/s2_c_in_2024.session"
  },
  {
    id: "s2_c_vn_2024",
    country: "Vietnam",
    countryCode: "VN",
    icon: "🇻🇳",
    qualityTier: "cheap",
    accountYear: 2024,
    priceInr: 40,
    stockCount: 85,
    deliveryFormat: "session",
    subtitle: "🟡 Cheap Quality",
    twoFaRequired: false,
    sampleSessionUrl: "https://krishminiapp.mock/download/s2_c_vn_2024.session"
  },
  {
    id: "s2_c_ng_2024",
    country: "Nigeria",
    countryCode: "NG",
    icon: "🇳🇬",
    qualityTier: "cheap",
    accountYear: 2024,
    priceInr: 35,
    stockCount: 94,
    deliveryFormat: "account",
    subtitle: "🟡 Cheap Quality",
    twoFaRequired: false,
    sampleSessionUrl: "https://krishminiapp.mock/download/s2_c_ng_2024.session"
  },
  {
    id: "s2_c_id_2025",
    country: "Indonesia",
    countryCode: "ID",
    icon: "🇮🇩",
    qualityTier: "cheap",
    accountYear: 2025,
    priceInr: 42,
    stockCount: 65,
    deliveryFormat: "session",
    subtitle: "🟡 Cheap Quality",
    twoFaRequired: false,
    sampleSessionUrl: "https://krishminiapp.mock/download/s2_c_id_2025.session"
  }
];

export const server34Catalog: VirtualOtpServiceItem[] = [
  // Server 3: Fast OTP (DGOTP)
  {
    id: "s3_tg_in",
    server: 3,
    serviceCode: "tg",
    serviceName: "Telegram",
    country: "India",
    countryCode: "IN",
    icon: "✈️",
    priceInr: 45,
    availableCount: 999,
    category: "tg",
    speed: "Instant (1-3s)",
    successRate: 99.1
  },
  {
    id: "s3_wa_in",
    server: 3,
    serviceCode: "wa",
    serviceName: "WhatsApp",
    country: "India",
    countryCode: "IN",
    icon: "💬",
    priceInr: 50,
    availableCount: 999,
    category: "wa",
    speed: "Instant (1-3s)",
    successRate: 98.4
  },
  {
    id: "s3_ig_us",
    server: 3,
    serviceCode: "ig",
    serviceName: "Instagram",
    country: "United States",
    countryCode: "US",
    icon: "📸",
    priceInr: 30,
    availableCount: 999,
    category: "ig",
    speed: "Instant (1-3s)",
    successRate: 97.8
  },
  {
    id: "s3_spam_ru",
    server: 3,
    serviceCode: "spam",
    serviceName: "SpamChat",
    country: "Russia",
    countryCode: "RU",
    icon: "💬",
    priceInr: 25,
    availableCount: 999,
    category: "spam",
    speed: "Instant (1-3s)",
    successRate: 96.5
  },
  {
    id: "s3_go_us",
    server: 3,
    serviceCode: "go",
    serviceName: "Google / Gmail",
    country: "United States",
    countryCode: "US",
    icon: "🔍",
    priceInr: 35,
    availableCount: 999,
    category: "go",
    speed: "Instant (1-3s)",
    successRate: 98.9
  },
  {
    id: "s3_wa_br",
    server: 3,
    serviceCode: "wa",
    serviceName: "WhatsApp",
    country: "Brazil",
    countryCode: "BR",
    icon: "💬",
    priceInr: 42,
    availableCount: 840,
    category: "wa",
    speed: "Instant (1-3s)",
    successRate: 98.2
  },

  // Server 4: Fresh Numbers (Tempora)
  {
    id: "s4_tg_us",
    server: 4,
    serviceCode: "tg",
    serviceName: "Telegram (Fresh)",
    country: "United States",
    countryCode: "US",
    icon: "✈️",
    priceInr: 55,
    availableCount: 850,
    category: "tg",
    speed: "High (3-8s)",
    successRate: 99.4
  },
  {
    id: "s4_wa_id",
    server: 4,
    serviceCode: "wa",
    serviceName: "WhatsApp (Fresh)",
    country: "Indonesia",
    countryCode: "ID",
    icon: "💬",
    priceInr: 48,
    availableCount: 720,
    category: "wa",
    speed: "High (3-8s)",
    successRate: 98.1
  },
  {
    id: "s4_ig_in",
    server: 4,
    serviceCode: "ig",
    serviceName: "Instagram (Fresh)",
    country: "India",
    countryCode: "IN",
    icon: "📸",
    priceInr: 32,
    availableCount: 650,
    category: "ig",
    speed: "High (3-8s)",
    successRate: 97.9
  },
  {
    id: "s4_go_uk",
    server: 4,
    serviceCode: "go",
    serviceName: "Google / Gmail (Fresh)",
    country: "United Kingdom",
    countryCode: "GB",
    icon: "🔍",
    priceInr: 40,
    availableCount: 510,
    category: "go",
    speed: "High (3-8s)",
    successRate: 99.0
  }
];

export const server5Catalog: SmmServiceItem[] = [
  {
    id: "smm_tg_hq_members",
    platform: "telegram",
    categoryName: "Telegram Channel Members",
    name: "Telegram HQ Real Channel Members (Non-Drop)",
    ratePer1000: 95,
    minQuantity: 100,
    maxQuantity: 50000,
    avgSpeed: "10,000 / hr",
    description: "High quality organic Telegram channel members with 30-day auto-refill.",
    refillDays: 30
  },
  {
    id: "smm_tg_views",
    platform: "telegram",
    categoryName: "Telegram Post Views",
    name: "Telegram Instant Post Views (Last 5 Posts)",
    ratePer1000: 15,
    minQuantity: 500,
    maxQuantity: 100000,
    avgSpeed: "Instant",
    description: "Instant delivery post views with high impression rate.",
    refillDays: 0
  },
  {
    id: "smm_ig_followers",
    platform: "instagram",
    categoryName: "Instagram Real Followers",
    name: "Instagram Guaranteed Real Followers (No Drop)",
    ratePer1000: 120,
    minQuantity: 100,
    maxQuantity: 25000,
    avgSpeed: "5,000 / hr",
    description: "Worldwide genuine Instagram followers with 60-day warranty.",
    refillDays: 60
  },
  {
    id: "smm_ig_likes",
    platform: "instagram",
    categoryName: "Instagram Likes",
    name: "Instagram High Quality Instant Likes",
    ratePer1000: 35,
    minQuantity: 100,
    maxQuantity: 50000,
    avgSpeed: "Instant",
    description: "Instant starting likes with real profile visits.",
    refillDays: 30
  },
  {
    id: "smm_yt_views",
    platform: "youtube",
    categoryName: "YouTube Views",
    name: "YouTube Monetizable Video Views (High Retention)",
    ratePer1000: 140,
    minQuantity: 500,
    maxQuantity: 50000,
    avgSpeed: "2,000 / day",
    description: "High retention organic views safe for AdSense monetization.",
    refillDays: 30
  },
  {
    id: "smm_yt_subs",
    platform: "youtube",
    categoryName: "YouTube Subscribers",
    name: "YouTube Real Channel Subscribers (Non-Drop)",
    ratePer1000: 450,
    minQuantity: 50,
    maxQuantity: 10000,
    avgSpeed: "500 / day",
    description: "High-quality real YouTube channel subscribers with 30-day refill warranty.",
    refillDays: 30
  },
  {
    id: "smm_tk_followers",
    platform: "tiktok",
    categoryName: "TikTok Followers",
    name: "TikTok Real Profile Followers",
    ratePer1000: 110,
    minQuantity: 100,
    maxQuantity: 20000,
    avgSpeed: "3,000 / hr",
    description: "Real active TikTok followers to boost algorithm exposure.",
    refillDays: 30
  },
  {
    id: "smm_tk_likes",
    platform: "tiktok",
    categoryName: "TikTok Likes & Views",
    name: "TikTok High Retention Likes & Views Combo",
    ratePer1000: 45,
    minQuantity: 100,
    maxQuantity: 50000,
    avgSpeed: "Instant",
    description: "Boost your TikTok FYP presence with algorithmic high-quality likes.",
    refillDays: 30
  },
  {
    id: "smm_tw_followers",
    platform: "twitter",
    categoryName: "Twitter (X) Followers",
    name: "Twitter / X Verified NFT & Crypto Followers",
    ratePer1000: 160,
    minQuantity: 100,
    maxQuantity: 10000,
    avgSpeed: "1,000 / day",
    description: "High quality followers with active tweet history.",
    refillDays: 30
  },
  {
    id: "smm_tw_retweets",
    platform: "twitter",
    categoryName: "Twitter (X) Retweets & Likes",
    name: "Twitter / X Viral Organic Retweets + Likes",
    ratePer1000: 90,
    minQuantity: 100,
    maxQuantity: 20000,
    avgSpeed: "Instant",
    description: "Instant retweets from organic profiles for social proof.",
    refillDays: 30
  }
];

export const initialHistoryItems: HistoryItem[] = [
  {
    id: "DEP_9841A2",
    category: "deposit",
    title: "FamPay Instant UPI Deposit",
    subtitle: "Ref: FAM_9B2F10 · Completed",
    amountInr: 500,
    date: "Today, 10:15 AM",
    status: "success",
    utr: "328198746192",
    refunded: false
  },
  {
    id: "ORD_782910",
    category: "otp_activation",
    title: "WhatsApp India Virtual OTP",
    subtitle: "Server 3 (Fast OTP) · Completed",
    amountInr: -50,
    date: "Today, 09:30 AM",
    status: "success",
    server: "Server 3",
    phone: "+91 98765 43210",
    otpCode: "582-901",
    refunded: false
  },
  {
    id: "ORD_649102",
    category: "account_purchase",
    title: "India Telegram Account 2024",
    subtitle: "Server 2 (Good Quality) · Delivered",
    amountInr: -80,
    date: "Yesterday, 04:20 PM",
    status: "success",
    server: "Server 2",
    phone: "+91 98234 19283",
    twoFa: "krish@2024TG",
    sessionDownloadUrl: "https://krishminiapp.mock/download/s2_g_in_2024.session",
    refunded: false
  },
  {
    id: "ORD_519283",
    category: "smm_order",
    title: "Telegram Channel Members (1,000)",
    subtitle: "Target: t.me/cryptoleaks · In Progress",
    amountInr: -95,
    date: "Oct 01, 2026",
    status: "in_progress",
    server: "Server 5",
    quantity: 1000,
    targetLink: "https://t.me/cryptoleaks",
    refunded: false
  }
];

export const initialResellerConfig: ResellerConfig = {
  token: "resell_8f1a20",
  marginInr: 15,
  minMargin: 5,
  maxMargin: 100,
  resellerLink: "https://t.me/DeamonOTPbot?start=resell_8f1a20",
  customersCount: 14,
  ordersCount: 38,
  totalProfitInr: 570
};
