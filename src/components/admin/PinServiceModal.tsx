import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { adminApi } from '../../api/adminApi';
import { PinnedServiceItem, storeApi } from '../../api/endpoints';
import { adaptServer1Item, adaptServer2Item } from '../../api/adapters';
import {
  Pin,
  X,
  Search,
  Sparkles,
  Check,
  Flame,
  Zap,
  Trash2,
  Tag,
  Layers,
  Globe,
  Radio,
  Share2,
  Loader2,
  ChevronDown,
  ArrowUpDown,
  RotateCcw,
  RefreshCw,
  Filter,
  AlertCircle,
} from 'lucide-react';

export interface PreselectedServiceInfo {
  server_no: number;
  service_id: string;
  service_name: string;
  category_name?: string;
  country_code?: string;
  country_name?: string;
  price?: number;
  badge?: string;
}

interface PinServiceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPinnedSuccessfully: () => void;
  initialService?: PreselectedServiceInfo | null;
  defaultServer?: number;
  pinnedList?: PinnedServiceItem[];
}

interface UniformCatalogItem {
  server_no: number;
  service_id: string;
  service_name: string;
  app_name?: string;
  service_code?: string;
  category_name?: string;
  country_name?: string;
  country_code?: string;
  price?: number;
  stock?: number;
  quality_tier?: 'good' | 'cheap';
  account_year?: number;
}

type SortOption = 'default' | 'price_asc' | 'price_desc' | 'stock_desc';

const BADGE_PRESETS = [
  { label: 'Hot', icon: Flame, color: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  { label: 'Instant', icon: Zap, color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
  { label: 'Best Seller', icon: Sparkles, color: 'bg-purple-500/15 text-purple-400 border-purple-500/30' },
  { label: 'VIP', icon: Tag, color: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30' },
  { label: 'Sale', icon: Tag, color: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
  { label: 'Popular', icon: Sparkles, color: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
];

const POPULAR_OTP_APPS: Array<{
  code: string;
  label: string;
  match: (serviceCode: string, appNameLower: string) => boolean;
}> = [
  {
    code: 'wa',
    label: 'WhatsApp',
    match: (c, n) => c === 'wa' || n.includes('whatsapp'),
  },
  {
    code: 'tg',
    label: 'Telegram',
    match: (c, n) => c === 'tg' || n.includes('telegram'),
  },
  {
    code: 'ig',
    label: 'Instagram',
    match: (c, n) => c === 'ig' || n.includes('instagram') || /\binsta\b/.test(n),
  },
  {
    code: 'go',
    label: 'Google',
    match: (c, n) => c === 'go' || n.includes('google') || n.includes('gmail'),
  },
  {
    code: 'snap',
    label: 'Snapchat',
    match: (c, n) => c === 'snap' || c === 'fu' || n.includes('snapchat') || /\bsnap\b/.test(n),
  },
  {
    code: 'fb',
    label: 'Facebook',
    match: (c, n) => c === 'fb' || n.includes('facebook'),
  },
  {
    code: 'tk',
    label: 'TikTok',
    match: (c, n) => c === 'tk' || c === 'tiktok' || n.includes('tiktok'),
  },
  {
    code: 'tw',
    label: 'Twitter/X',
    match: (c, n) => c === 'tw' || n.includes('twitter') || n === 'x',
  },
  {
    code: 'ds',
    label: 'Discord',
    match: (c, n) => c === 'ds' || c === 'dc' || n.includes('discord'),
  },
  {
    code: 'openai',
    label: 'OpenAI',
    match: (c, n) => c === 'openai' || c === 'oa' || n.includes('openai') || n.includes('chatgpt'),
  },
  {
    code: 'steam',
    label: 'Steam',
    match: (c, n) => c === 'steam' || n.includes('steam'),
  },
];

const SMM_PLATFORMS = [
  { id: 'all', label: 'All' },
  { id: 'telegram', label: 'Telegram' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'tiktok', label: 'TikTok' },
  { id: 'twitter', label: 'Twitter (X)' },
  { id: 'facebook', label: 'Facebook' },
  { id: 'whatsapp', label: 'WhatsApp' },
  { id: 'snapchat', label: 'Snapchat' },
];

const PAGE_CHUNK_SIZE = 60;
const DARK_SELECT_STYLE: React.CSSProperties = { colorScheme: 'dark' };
const DARK_OPTION_CLASS = 'bg-[#181820] text-white';

function matchesOtpAppFilter(item: UniformCatalogItem, selectedApp: string): boolean {
  if (!selectedApp || selectedApp === 'all') return true;
  const code = (item.service_code || '').toLowerCase().trim();
  const appNameLower = (item.app_name || item.service_name || '').toLowerCase().trim();

  const popular = POPULAR_OTP_APPS.find((p) => p.code === selectedApp);
  if (popular) {
    return popular.match(code, appNameLower);
  }

  // Exact match for custom app picked from All Apps dropdown (format: "app:<lowercase name>")
  if (selectedApp.startsWith('app:')) {
    const targetName = selectedApp.slice(4);
    return appNameLower === targetName;
  }

  return appNameLower.includes(selectedApp.toLowerCase());
}

function matchesMultiWordQuery(
  haystackParts: Array<string | number | undefined>,
  query: string
): boolean {
  const tokens = query
    .trim()
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean);
  if (tokens.length === 0) return true;
  const haystack = haystackParts
    .filter((p) => p !== undefined && p !== null)
    .map((p) => String(p).toLowerCase())
    .join(' ');
  return tokens.every((token) => haystack.includes(token));
}

export const PinServiceModal: React.FC<PinServiceModalProps> = ({
  isOpen,
  onClose,
  onPinnedSuccessfully,
  initialService = null,
  defaultServer = 1,
  pinnedList = [],
}) => {
  const { addToast } = useApp();
  const listScrollRef = useRef<HTMLDivElement | null>(null);
  const allAppsContainerRef = useRef<HTMLDivElement | null>(null);
  const fetchedServersRef = useRef<Record<number, boolean>>({});
  const s5RequestSeqRef = useRef<number>(0);
  const pinnedListRef = useRef<PinnedServiceItem[]>(pinnedList);
  pinnedListRef.current = pinnedList;

  const [activeServer, setActiveServer] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedService, setSelectedService] = useState<PreselectedServiceInfo | null>(null);
  const [badge, setBadge] = useState('Hot');
  const [displayOrder, setDisplayOrder] = useState('0');
  const [isManualMode, setIsManualMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Per-server filter & sort states (mirroring User Storefront)
  const [sortOrder, setSortOrder] = useState<SortOption>('default');
  // Server 1 filters
  const [s1InStockOnly, setS1InStockOnly] = useState(false);
  // Server 2 filters
  const [s2Tier, setS2Tier] = useState<'all' | 'good' | 'cheap'>('all');
  const [s2Year, setS2Year] = useState<string>('all');
  // Server 3 & 4 filters
  const [otpAppFilter, setOtpAppFilter] = useState<string>('all');
  const [otpCountryFilter, setOtpCountryFilter] = useState<string>('all');
  const [isAllAppsOpen, setIsAllAppsOpen] = useState(false);
  const [allAppsSearch, setAllAppsSearch] = useState('');
  // Server 5 filters
  const [s5Platform, setS5Platform] = useState<string>('all');
  const [s5Category, setS5Category] = useState<string>('all');
  const [s5CategoriesList, setS5CategoriesList] = useState<
    Array<{ category: string; platform: string; count: number }>
  >([]);

  // Progressive rendering / infinite scroll count for client-side catalogs (S1–S4)
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_CHUNK_SIZE);

  // Full cached catalogs + load error/refresh state
  const [modalServer1, setModalServer1] = useState<UniformCatalogItem[]>([]);
  const [modalServer2, setModalServer2] = useState<UniformCatalogItem[]>([]);
  const [modalServer3, setModalServer3] = useState<UniformCatalogItem[]>([]);
  const [modalServer4, setModalServer4] = useState<UniformCatalogItem[]>([]);
  const [isLoadingS1, setIsLoadingS1] = useState(false);
  const [isLoadingS2, setIsLoadingS2] = useState(false);
  const [isLoadingS3, setIsLoadingS3] = useState(false);
  const [isLoadingS4, setIsLoadingS4] = useState(false);
  const [loadErrorByServer, setLoadErrorByServer] = useState<Record<number, string | null>>({});
  const [refreshNonce, setRefreshNonce] = useState<number>(0);

  // Server 5 paginated server-side results
  const [s5Results, setS5Results] = useState<UniformCatalogItem[]>([]);
  const [s5Total, setS5Total] = useState<number>(0);
  const [isSearchingS5, setIsSearchingS5] = useState(false);
  const [s5Page, setS5Page] = useState(1);
  const [hasMoreS5, setHasMoreS5] = useState(false);
  const [isLoadingMoreS5, setIsLoadingMoreS5] = useState(false);

  // Debounce search input (150ms) so fast typing on mobile over 8,000+ rows stays smooth
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchQuery);
    }, 150);
    return () => clearTimeout(t);
  }, [searchQuery]);

  // Close All-Apps popover on outside click or Escape key
  useEffect(() => {
    if (!isAllAppsOpen) return;

    const handleOutside = (e: MouseEvent | TouchEvent) => {
      if (
        allAppsContainerRef.current &&
        !allAppsContainerRef.current.contains(e.target as Node)
      ) {
        setIsAllAppsOpen(false);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsAllAppsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      document.removeEventListener('keydown', handleKey);
    };
  }, [isAllAppsOpen]);

  const resetFiltersForServer = useCallback(() => {
    setSearchQuery('');
    setDebouncedSearch('');
    setSortOrder('default');
    setS1InStockOnly(false);
    setS2Tier('all');
    setS2Year('all');
    setOtpAppFilter('all');
    setOtpCountryFilter('all');
    setIsAllAppsOpen(false);
    setAllAppsSearch('');
    setS5Platform('all');
    setS5Category('all');
    setS5Page(1);
    setVisibleCount(PAGE_CHUNK_SIZE);
    if (listScrollRef.current) {
      listScrollRef.current.scrollTop = 0;
    }
  }, []);

  const handleRefreshActiveServer = useCallback(() => {
    delete fetchedServersRef.current[activeServer];
    setLoadErrorByServer((prev) => ({ ...prev, [activeServer]: null }));
    if (activeServer === 1) setModalServer1([]);
    else if (activeServer === 2) setModalServer2([]);
    else if (activeServer === 3) setModalServer3([]);
    else if (activeServer === 4) setModalServer4([]);
    else if (activeServer === 5) {
      setS5CategoriesList([]);
      setS5Results([]);
    }
    setRefreshNonce((n) => n + 1);
  }, [activeServer]);

  // Sync initial service when modal opens (reset stale filters in BOTH create & edit flows)
  useEffect(() => {
    if (!isOpen) return;

    resetFiltersForServer();
    setIsManualMode(false);

    if (initialService) {
      setActiveServer(initialService.server_no);
      setSelectedService(initialService);
      const selId = String(initialService.service_id).trim().toLowerCase();
      const matchedPin = pinnedListRef.current.find(
        (p) =>
          p.server_no === initialService.server_no &&
          String(p.service_id).trim().toLowerCase() === selId
      );
      setBadge(initialService.badge || matchedPin?.badge || 'Hot');
      setDisplayOrder(
        matchedPin?.display_order !== undefined && matchedPin?.display_order !== null
          ? String(matchedPin.display_order)
          : '0'
      );
    } else {
      if (defaultServer && defaultServer >= 1 && defaultServer <= 5) {
        setActiveServer(defaultServer);
      }
      setSelectedService(null);
      setBadge('Hot');
      setDisplayOrder('0');
    }
  }, [isOpen, initialService, defaultServer, resetFiltersForServer]);

  // Reset visible scroll window whenever active filters or debounced search change
  useEffect(() => {
    setVisibleCount(PAGE_CHUNK_SIZE);
    if (listScrollRef.current) {
      listScrollRef.current.scrollTop = 0;
    }
  }, [
    activeServer,
    debouncedSearch,
    sortOrder,
    s1InStockOnly,
    s2Tier,
    s2Year,
    otpAppFilter,
    otpCountryFilter,
  ]);

  // 1. Load Server 1 Full Catalog (all 153 countries) once on-demand
  useEffect(() => {
    if (!isOpen || activeServer !== 1 || fetchedServersRef.current[1]) return;
    let cancelled = false;
    setIsLoadingS1(true);
    setLoadErrorByServer((prev) => ({ ...prev, 1: null }));
    storeApi
      .getServer1()
      .then((res) => {
        if (!cancelled) {
          if (res?.items && Array.isArray(res.items)) {
            const adapted = res.items.map(adaptServer1Item).map((item) => ({
              server_no: 1,
              service_id: item.countryCode || item.country,
              service_name: `${item.country} Account`,
              category_name: 'Telegram Global',
              country_name: item.country,
              country_code: item.countryCode,
              price: item.priceInr,
              stock: item.stockCount,
            }));
            setModalServer1(adapted);
            fetchedServersRef.current[1] = true;
          } else {
            setLoadErrorByServer((prev) => ({
              ...prev,
              1: 'Failed to load Server 1 catalog.',
            }));
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadErrorByServer((prev) => ({
            ...prev,
            1: 'Network error loading Server 1 catalog. Please retry.',
          }));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingS1(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, activeServer, refreshNonce]);

  // 2. Load Server 2 Full Catalog (Good + Cheap) once on-demand
  useEffect(() => {
    if (!isOpen || activeServer !== 2 || fetchedServersRef.current[2]) return;
    let cancelled = false;
    setIsLoadingS2(true);
    setLoadErrorByServer((prev) => ({ ...prev, 2: null }));
    Promise.all([storeApi.getServer2('good'), storeApi.getServer2('cheap')])
      .then(([goodRes, cheapRes]) => {
        if (!cancelled) {
          const combinedRaw = [
            ...(goodRes?.items || []).map((it) => adaptServer2Item(it, 'good')),
            ...(cheapRes?.items || []).map((it) => adaptServer2Item(it, 'cheap')),
          ];
          setModalServer2(
            combinedRaw.map((item) => ({
              server_no: 2,
              service_id: `${item.country}_${item.qualityTier}_${item.accountYear}_${item.priceInr}`,
              service_name: `${item.country} ${item.accountYear} (${
                item.qualityTier === 'good' ? 'Good' : 'Cheap'
              })`,
              category_name: `Telegram ${item.qualityTier.toUpperCase()} Session`,
              country_name: item.country,
              country_code: item.countryCode,
              price: item.priceInr,
              stock: item.stockCount,
              quality_tier: item.qualityTier,
              account_year: item.accountYear,
            }))
          );
          fetchedServersRef.current[2] = true;
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadErrorByServer((prev) => ({
            ...prev,
            2: 'Network error loading Server 2 stock. Please retry.',
          }));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingS2(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, activeServer, refreshNonce]);

  // 3. Load Server 3 FULL Cached Catalog once on-demand (no limit -> uses backend 60s RAM cache)
  useEffect(() => {
    if (!isOpen || activeServer !== 3 || fetchedServersRef.current[3]) return;
    let cancelled = false;
    setIsLoadingS3(true);
    setLoadErrorByServer((prev) => ({ ...prev, 3: null }));
    storeApi
      .getServer3()
      .then((res) => {
        if (!cancelled) {
          if (res?.items && Array.isArray(res.items)) {
            setModalServer3(
              res.items.map((it) => {
                const rawName = (it.name || it.service_code || 'Service').trim();
                const country = (it.country || 'India').trim();
                const sCode = (it.service_code || '').trim();
                const srvCode = (it.server_code || '').trim();
                const serviceId =
                  sCode && srvCode ? `${sCode}_${srvCode}` : it.id || sCode || rawName;
                return {
                  server_no: 3,
                  service_id: serviceId,
                  service_name: `${rawName} (${country})`,
                  app_name: rawName,
                  service_code: sCode,
                  category_name: `${rawName} OTP`,
                  country_name: country,
                  country_code: srvCode,
                  price: it.price,
                  stock: undefined,
                };
              })
            );
            fetchedServersRef.current[3] = true;
          } else {
            setLoadErrorByServer((prev) => ({
              ...prev,
              3: 'Failed to load Server 3 catalog.',
            }));
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadErrorByServer((prev) => ({
            ...prev,
            3: 'Network error loading Server 3 catalog. Please retry.',
          }));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingS3(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, activeServer, refreshNonce]);

  // 4. Load Server 4 FULL Cached Catalog once on-demand (no limit -> uses backend 60s RAM cache)
  useEffect(() => {
    if (!isOpen || activeServer !== 4 || fetchedServersRef.current[4]) return;
    let cancelled = false;
    setIsLoadingS4(true);
    setLoadErrorByServer((prev) => ({ ...prev, 4: null }));
    storeApi
      .getServer4()
      .then((res) => {
        if (!cancelled) {
          if (res?.items && Array.isArray(res.items)) {
            setModalServer4(
              res.items.map((it) => {
                const rawTitle = (it.name || 'Service').trim();
                const country = (it.country || 'Global').trim();
                const countrySuffix = ` (${country})`;
                const cleanApp = rawTitle.endsWith(countrySuffix)
                  ? rawTitle.slice(0, -countrySuffix.length).trim() || rawTitle
                  : rawTitle.replace(/\s*\([^)]*\)\s*$/, '').trim() || rawTitle;
                const sCode = (it.service_code || '').trim();
                const cCode = (it.country_code || '').trim();
                const serviceId =
                  sCode && cCode ? `${sCode}_${cCode}` : it.id || sCode || rawTitle;
                return {
                  server_no: 4,
                  service_id: serviceId,
                  service_name: rawTitle,
                  app_name: cleanApp,
                  service_code: sCode,
                  category_name: 'Carrier OTP',
                  country_name: country,
                  country_code: cCode,
                  price: it.price,
                  stock: it.stock,
                };
              })
            );
            fetchedServersRef.current[4] = true;
          } else {
            setLoadErrorByServer((prev) => ({
              ...prev,
              4: 'Failed to load Server 4 catalog.',
            }));
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadErrorByServer((prev) => ({
            ...prev,
            4: 'Network error loading Server 4 catalog. Please retry.',
          }));
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingS4(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, activeServer, refreshNonce]);

  // 5a. Load Server 5 Categories once on-demand
  useEffect(() => {
    if (!isOpen || activeServer !== 5 || s5CategoriesList.length > 0) return;
    let cancelled = false;
    storeApi
      .getServer5Categories()
      .then((res) => {
        if (!cancelled && res?.success && Array.isArray(res.categories)) {
          setS5CategoriesList(res.categories);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isOpen, activeServer, s5CategoriesList.length, refreshNonce]);

  // 5b. Server 5 Server-Side Filtered & Paginated Search (Race-safe via sequence counter)
  useEffect(() => {
    if (!isOpen || activeServer !== 5) return;
    let cancelled = false;
    const reqSeq = ++s5RequestSeqRef.current;
    setIsSearchingS5(true);
    setIsLoadingMoreS5(false);
    setLoadErrorByServer((prev) => ({ ...prev, 5: null }));
    setS5Page(1);

    const apiSort =
      sortOrder === 'price_asc' || sortOrder === 'price_desc' ? sortOrder : undefined;

    const t = setTimeout(async () => {
      try {
        const res = await storeApi.getServer5({
          page: 1,
          limit: 40,
          platform: s5Platform !== 'all' ? s5Platform : undefined,
          category: s5Category !== 'all' ? s5Category : undefined,
          search: searchQuery.trim() || undefined,
          sort: apiSort,
        });
        if (!cancelled && reqSeq === s5RequestSeqRef.current) {
          if (res?.success && Array.isArray(res.items)) {
            setS5Results(
              res.items.map((item) => ({
                server_no: 5,
                service_id: String(item.id),
                service_name: item.name || 'SMM Service',
                category_name: item.category || 'SMM',
                country_name: '',
                country_code: '',
                price: Number(item.price || 0),
                stock: undefined,
              }))
            );
            setS5Total(Number(res.total ?? res.items.length));
            setHasMoreS5(Boolean(res.has_more));
            if (listScrollRef.current) {
              listScrollRef.current.scrollTop = 0;
            }
          } else {
            setS5Results([]);
            setS5Total(0);
            setHasMoreS5(false);
            setLoadErrorByServer((prev) => ({
              ...prev,
              5: 'Failed to load Server 5 services.',
            }));
          }
        }
      } catch {
        if (!cancelled && reqSeq === s5RequestSeqRef.current) {
          setS5Results([]);
          setS5Total(0);
          setHasMoreS5(false);
          setLoadErrorByServer((prev) => ({
            ...prev,
            5: 'Network error loading Server 5 services. Please retry.',
          }));
        }
      } finally {
        if (!cancelled && reqSeq === s5RequestSeqRef.current) {
          setIsSearchingS5(false);
        }
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [isOpen, activeServer, searchQuery, s5Platform, s5Category, sortOrder, refreshNonce]);

  const handleLoadMoreS5 = useCallback(async () => {
    if (isLoadingMoreS5 || !hasMoreS5) return;
    const reqSeq = s5RequestSeqRef.current;
    setIsLoadingMoreS5(true);
    const nextPage = s5Page + 1;
    const apiSort =
      sortOrder === 'price_asc' || sortOrder === 'price_desc' ? sortOrder : undefined;

    try {
      const res = await storeApi.getServer5({
        page: nextPage,
        limit: 40,
        platform: s5Platform !== 'all' ? s5Platform : undefined,
        category: s5Category !== 'all' ? s5Category : undefined,
        search: searchQuery.trim() || undefined,
        sort: apiSort,
      });
      // Ignore stale pagination responses if user changed filters/search while loading
      if (reqSeq !== s5RequestSeqRef.current) return;
      if (res?.success && Array.isArray(res.items)) {
        const nextItems: UniformCatalogItem[] = res.items.map((item) => ({
          server_no: 5,
          service_id: String(item.id),
          service_name: item.name || 'SMM Service',
          category_name: item.category || 'SMM',
          country_name: '',
          country_code: '',
          price: Number(item.price || 0),
          stock: undefined,
        }));
        setS5Results((prev) => [...prev, ...nextItems]);
        setS5Page(nextPage);
        setS5Total(Number(res.total ?? 0));
        setHasMoreS5(Boolean(res.has_more));
      }
    } catch {
      // keep existing loaded pages intact on transient Load More error
    } finally {
      if (reqSeq === s5RequestSeqRef.current) {
        setIsLoadingMoreS5(false);
      }
    }
  }, [isLoadingMoreS5, hasMoreS5, s5Page, sortOrder, s5Platform, s5Category, searchQuery]);

  // Derived filter options for Server 2 (Available Years + Tier counts)
  const s2FilterMeta = useMemo(() => {
    const yearsSet = new Set<number>();
    let goodCount = 0;
    let cheapCount = 0;
    for (const item of modalServer2) {
      if (item.quality_tier === 'good') goodCount++;
      if (item.quality_tier === 'cheap') cheapCount++;
      if (item.account_year) yearsSet.add(item.account_year);
    }
    const years = Array.from(yearsSet).sort((a, b) => b - a);
    return { years, goodCount, cheapCount, total: modalServer2.length };
  }, [modalServer2]);

  // Derived filter options for Server 3 & 4 (Popular App chips, All Unique Apps, Available Countries)
  const otpFilterMeta = useMemo(() => {
    const source = activeServer === 3 ? modalServer3 : activeServer === 4 ? modalServer4 : [];
    if (source.length === 0) {
      return {
        popularChips: [] as Array<{ code: string; label: string; count: number }>,
        allUniqueApps: [] as Array<{ key: string; label: string; count: number }>,
        countries: [] as Array<{ name: string; count: number }>,
        activeAppLabel: 'All Apps',
      };
    }

    const popularCounts = new Map<string, number>();
    const allAppsMap = new Map<string, { label: string; count: number }>();

    for (const item of source) {
      const code = (item.service_code || '').toLowerCase().trim();
      const appLabel = (item.app_name || item.service_name || 'Service').trim();
      const appLower = appLabel.toLowerCase();

      for (const pop of POPULAR_OTP_APPS) {
        if (pop.match(code, appLower)) {
          popularCounts.set(pop.code, (popularCounts.get(pop.code) || 0) + 1);
          break;
        }
      }

      const existingApp = allAppsMap.get(appLower);
      if (existingApp) {
        existingApp.count += 1;
      } else {
        allAppsMap.set(appLower, { label: appLabel, count: 1 });
      }
    }

    const popularChips = POPULAR_OTP_APPS.map((pop) => ({
      code: pop.code,
      label: pop.label,
      count: popularCounts.get(pop.code) || 0,
    })).filter((p) => p.count > 0);

    const allUniqueApps = Array.from(allAppsMap.entries())
      .map(([lower, meta]) => ({
        key: `app:${lower}`,
        label: meta.label,
        count: meta.count,
      }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));

    // Countries scoped to the selected App
    const countryMap = new Map<string, number>();
    for (const item of source) {
      if (!matchesOtpAppFilter(item, otpAppFilter)) continue;
      const cName = (item.country_name || '').trim();
      if (!cName) continue;
      countryMap.set(cName, (countryMap.get(cName) || 0) + 1);
    }

    const countries = Array.from(countryMap.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));

    let activeAppLabel = 'All Apps';
    if (otpAppFilter !== 'all') {
      const pop = POPULAR_OTP_APPS.find((p) => p.code === otpAppFilter);
      if (pop) {
        activeAppLabel = pop.label;
      } else if (otpAppFilter.startsWith('app:')) {
        const found = allAppsMap.get(otpAppFilter.slice(4));
        activeAppLabel = found?.label || otpAppFilter.slice(4);
      }
    }

    return { popularChips, allUniqueApps, countries, activeAppLabel };
  }, [activeServer, modalServer3, modalServer4, otpAppFilter]);

  // Reset country filter if the selected country is not available for the newly selected app
  useEffect(() => {
    if ((activeServer === 3 || activeServer === 4) && otpCountryFilter !== 'all') {
      const stillAvailable = otpFilterMeta.countries.some((c) => c.name === otpCountryFilter);
      if (!stillAvailable && otpFilterMeta.countries.length > 0) {
        setOtpCountryFilter('all');
      }
    }
  }, [activeServer, otpCountryFilter, otpFilterMeta.countries]);

  // Filtered Server 5 categories scoped to selected platform
  const filteredS5Categories = useMemo(() => {
    if (s5Platform === 'all') return s5CategoriesList;
    const pLow = s5Platform.toLowerCase();
    return s5CategoriesList.filter(
      (c) =>
        (c.platform || '').toLowerCase() === pLow ||
        (c.category || '').toLowerCase().includes(pLow)
    );
  }, [s5CategoriesList, s5Platform]);

  // Filtered All Apps list inside S3/S4 inline picker
  const filteredAllApps = useMemo(() => {
    const q = allAppsSearch.trim().toLowerCase();
    if (!q) return otpFilterMeta.allUniqueApps.slice(0, 80);
    return otpFilterMeta.allUniqueApps
      .filter((a) => a.label.toLowerCase().includes(q))
      .slice(0, 80);
  }, [otpFilterMeta.allUniqueApps, allAppsSearch]);

  // Uniform filtered & sorted catalog for currently active server (uses debouncedSearch for S1–S4)
  const filteredCatalog = useMemo<UniformCatalogItem[]>(() => {
    const applySort = (items: UniformCatalogItem[]) => {
      if (sortOrder === 'default') return items;
      const copy = [...items];
      if (sortOrder === 'price_asc') {
        copy.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
      } else if (sortOrder === 'price_desc') {
        copy.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
      } else if (sortOrder === 'stock_desc') {
        copy.sort((a, b) => (b.stock ?? -1) - (a.stock ?? -1));
      }
      return copy;
    };

    if (activeServer === 1) {
      const list = modalServer1.filter((item) => {
        if (s1InStockOnly && (item.stock ?? 0) <= 0) return false;
        return matchesMultiWordQuery(
          [item.country_name, item.country_code, item.service_name, item.service_id],
          debouncedSearch
        );
      });
      return applySort(list);
    }

    if (activeServer === 2) {
      const list = modalServer2.filter((item) => {
        if (s2Tier !== 'all' && item.quality_tier !== s2Tier) return false;
        if (s2Year !== 'all' && String(item.account_year) !== s2Year) return false;
        return matchesMultiWordQuery(
          [
            item.country_name,
            item.country_code,
            item.quality_tier,
            item.account_year,
            item.service_name,
            item.service_id,
          ],
          debouncedSearch
        );
      });
      return applySort(list);
    }

    if (activeServer === 3 || activeServer === 4) {
      const source = activeServer === 3 ? modalServer3 : modalServer4;
      const list = source.filter((item) => {
        if (!matchesOtpAppFilter(item, otpAppFilter)) return false;
        if (otpCountryFilter !== 'all' && item.country_name !== otpCountryFilter) return false;
        return matchesMultiWordQuery(
          [
            item.service_name,
            item.app_name,
            item.country_name,
            item.country_code,
            item.service_code,
            item.service_id,
          ],
          debouncedSearch
        );
      });
      return applySort(list);
    }

    if (activeServer === 5) {
      return s5Results;
    }

    return [];
  }, [
    activeServer,
    debouncedSearch,
    sortOrder,
    s1InStockOnly,
    s2Tier,
    s2Year,
    otpAppFilter,
    otpCountryFilter,
    modalServer1,
    modalServer2,
    modalServer3,
    modalServer4,
    s5Results,
  ]);

  // Slice rendered items for client-side servers (S1–S4) to keep DOM super light while scrolling
  const displayedCatalog = useMemo(() => {
    if (activeServer === 5) return filteredCatalog;
    return filteredCatalog.slice(0, visibleCount);
  }, [activeServer, filteredCatalog, visibleCount]);

  const hasMoreClientItems = activeServer !== 5 && visibleCount < filteredCatalog.length;

  // Scroll-to-load-more handler for ALL servers (S1–S4 client windowing + S5 server pagination)
  const handleListScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const el = e.currentTarget;
      const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
      if (distanceFromBottom > 120) return;

      if (activeServer === 5) {
        if (hasMoreS5 && !isLoadingMoreS5) {
          handleLoadMoreS5();
        }
      } else if (visibleCount < filteredCatalog.length) {
        setVisibleCount((prev) => Math.min(prev + PAGE_CHUNK_SIZE, filteredCatalog.length));
      }
    },
    [activeServer, hasMoreS5, isLoadingMoreS5, handleLoadMoreS5, visibleCount, filteredCatalog.length]
  );

  const hasActiveFilters =
    Boolean(searchQuery.trim()) ||
    sortOrder !== 'default' ||
    (activeServer === 1 && s1InStockOnly) ||
    (activeServer === 2 && (s2Tier !== 'all' || s2Year !== 'all')) ||
    ((activeServer === 3 || activeServer === 4) &&
      (otpAppFilter !== 'all' || otpCountryFilter !== 'all')) ||
    (activeServer === 5 && (s5Platform !== 'all' || s5Category !== 'all'));

  // Check if currently selected service is already pinned
  const existingPin = useMemo(() => {
    if (!selectedService) return null;
    const selId = String(selectedService.service_id).trim().toLowerCase();
    return (
      pinnedList.find(
        (p) =>
          p.server_no === selectedService.server_no &&
          String(p.service_id).trim().toLowerCase() === selId
      ) || null
    );
  }, [selectedService, pinnedList]);

  const handleSelectFromList = (item: UniformCatalogItem) => {
    setSelectedService({
      server_no: item.server_no,
      service_id: item.service_id,
      service_name: item.service_name,
      category_name: item.category_name,
      country_name: item.country_name,
      country_code: item.country_code,
      price: item.price,
    });
    // If selecting an already-pinned item, prefill its saved badge & display_order
    const selId = String(item.service_id).trim().toLowerCase();
    const matchedPin = pinnedList.find(
      (p) => p.server_no === item.server_no && String(p.service_id).trim().toLowerCase() === selId
    );
    if (matchedPin) {
      if (matchedPin.badge) setBadge(matchedPin.badge);
      setDisplayOrder(
        matchedPin.display_order !== undefined && matchedPin.display_order !== null
          ? String(matchedPin.display_order)
          : '0'
      );
    }
  };

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedService || !selectedService.service_id || !selectedService.service_name) {
      addToast('Please select or specify a valid service', 'error');
      return;
    }

    setSubmitting(true);
    try {
      if (existingPin) {
        await adminApi.updatePinnedService(existingPin.id, {
          badge: badge.trim() || 'Hot',
          display_order: parseInt(displayOrder, 10) || 0,
          is_active: 1,
        });
        addToast(`Updated pin for "${selectedService.service_name}"`, 'success');
      } else {
        await adminApi.addPinnedService({
          server_no: selectedService.server_no,
          service_id: selectedService.service_id,
          service_name: selectedService.service_name,
          category_name: selectedService.category_name || '',
          country_name: selectedService.country_name || '',
          country_code: selectedService.country_code || '',
          badge: badge.trim() || 'Hot',
          display_order: parseInt(displayOrder, 10) || 0,
        });
        addToast(`Successfully pinned "${selectedService.service_name}"!`, 'success');
      }

      onPinnedSuccessfully();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to pin service';
      addToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnpin = async () => {
    if (!existingPin) return;
    if (!window.confirm(`Unpin "${existingPin.service_name}" from the store?`)) return;

    setSubmitting(true);
    try {
      await adminApi.deletePinnedService(existingPin.id);
      addToast(`Unpinned "${existingPin.service_name}"`, 'success');
      onPinnedSuccessfully();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to unpin service';
      addToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const isServerLoading =
    (activeServer === 1 && isLoadingS1) ||
    (activeServer === 2 && isLoadingS2) ||
    (activeServer === 3 && isLoadingS3) ||
    (activeServer === 4 && isLoadingS4) ||
    (activeServer === 5 && isSearchingS5);

  const activeLoadError = loadErrorByServer[activeServer] || null;
  const totalAvailableCount = activeServer === 5 ? s5Total : filteredCatalog.length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#181820] border border-[#262635] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-[#262630] flex items-center justify-between bg-[#14141a]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <Pin className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>{existingPin ? 'Manage Pinned Service' : 'Pin Service to Storefront'}</span>
                {existingPin && (
                  <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-semibold">
                    Currently Pinned
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-[#a1a1aa]">
                Featured at the top of the Home Dashboard &amp; Store tab for all users.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-[#a1a1aa] hover:text-white p-1.5 rounded-lg hover:bg-[#20202a] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto space-y-4 no-scrollbar">
          {/* Server Selector Tabs */}
          <div>
            <label className="text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wider block mb-1.5">
              Select Target Server:
            </label>
            <div className="grid grid-cols-5 gap-1.5 bg-[#121217] p-1 rounded-xl border border-[#262630]">
              {[
                { no: 1, label: 'S1: Global', icon: Globe },
                { no: 2, label: 'S2: Stock', icon: Layers },
                { no: 3, label: 'S3: Virtual', icon: Zap },
                { no: 4, label: 'S4: Carrier', icon: Radio },
                { no: 5, label: 'S5: SMM', icon: Share2 },
              ].map((s) => {
                const Icon = s.icon;
                const isCurrent = activeServer === s.no;
                return (
                  <button
                    key={s.no}
                    type="button"
                    onClick={() => {
                      setActiveServer(s.no);
                      setSelectedService(null);
                      resetFiltersForServer();
                    }}
                    className={`flex flex-col items-center justify-center py-2 px-1 rounded-lg text-[10px] font-bold transition-all ${
                      isCurrent
                        ? 'bg-amber-500 text-black shadow-sm font-extrabold'
                        : 'text-[#a1a1aa] hover:text-white hover:bg-[#1a1a24]'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 mb-1 shrink-0" />
                    <span className="truncate w-full text-center">{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Service Search Bar, Per-Server Filters & Mode Switch */}
          <div>
            <div className="flex items-center justify-between mb-1.5 gap-2">
              <label className="text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wider flex items-center gap-1.5 flex-wrap">
                <span>Select Service from Server {activeServer}:</span>
                {!isServerLoading && !activeLoadError && totalAvailableCount > 0 && (
                  <span className="text-[10px] text-amber-400 font-mono font-bold lowercase">
                    ({totalAvailableCount.toLocaleString()}{' '}
                    {activeServer === 1 ? 'countries' : 'services'})
                  </span>
                )}
              </label>
              <div className="flex items-center gap-2.5 shrink-0">
                {!isManualMode && (
                  <button
                    type="button"
                    onClick={handleRefreshActiveServer}
                    disabled={isServerLoading}
                    title={`Reload live Server ${activeServer} catalog`}
                    className="flex items-center gap-1 text-[10px] text-[#a1a1aa] hover:text-white font-semibold disabled:opacity-40"
                  >
                    <RefreshCw className={`w-3 h-3 ${isServerLoading ? 'animate-spin' : ''}`} />
                    <span className="hidden sm:inline">Refresh</span>
                  </button>
                )}
                {!isManualMode && hasActiveFilters && (
                  <button
                    type="button"
                    onClick={resetFiltersForServer}
                    className="flex items-center gap-1 text-[10px] text-[#a1a1aa] hover:text-white font-semibold"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setIsManualMode(!isManualMode)}
                  className="text-[11px] text-amber-400 hover:text-amber-300 font-medium underline"
                >
                  {isManualMode ? 'Back to Catalog Picker' : 'Enter Manually'}
                </button>
              </div>
            </div>

            {!isManualMode ? (
              <div className="space-y-2.5">
                {/* Search Input + Sort Selector Row */}
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-[#71717a] absolute left-3 top-2.5" />
                    <input
                      type="text"
                      placeholder={`Search Server ${activeServer} (e.g. ${
                        activeServer === 5
                          ? 'Instagram followers, 1024...'
                          : activeServer === 2
                          ? 'Bangladesh 2025 good...'
                          : activeServer === 1
                          ? 'USA, Russia, Algeria, India...'
                          : activeServer === 3
                          ? 'WhatsApp India, Telegram, Discord...'
                          : 'WhatsApp India, Telegram USA...'
                      })`}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full bg-[#121217] border border-[#262630] focus:border-amber-500/60 rounded-xl pl-9 pr-8 py-2 text-xs text-white placeholder-[#71717a] outline-none transition-colors"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => {
                          setSearchQuery('');
                          setDebouncedSearch('');
                        }}
                        className="absolute right-2.5 top-2.5 text-xs text-[#71717a] hover:text-white"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>

                  {/* Universal Sort Control */}
                  <div className="relative shrink-0">
                    <ArrowUpDown className="w-3.5 h-3.5 text-[#a1a1aa] absolute left-2.5 top-2.5 pointer-events-none" />
                    <select
                      value={sortOrder}
                      onChange={(e) => setSortOrder(e.target.value as SortOption)}
                      aria-label="Sort services"
                      style={DARK_SELECT_STYLE}
                      className="bg-[#121217] border border-[#262630] focus:border-amber-500/60 rounded-xl pl-8 pr-6 py-2 text-[11px] font-semibold text-white outline-none appearance-none cursor-pointer"
                    >
                      <option value="default" className={DARK_OPTION_CLASS}>
                        Default
                      </option>
                      <option value="price_asc" className={DARK_OPTION_CLASS}>
                        Price: Low → High
                      </option>
                      <option value="price_desc" className={DARK_OPTION_CLASS}>
                        Price: High → Low
                      </option>
                      {(activeServer === 1 || activeServer === 2 || activeServer === 4) && (
                        <option value="stock_desc" className={DARK_OPTION_CLASS}>
                          Stock: High → Low
                        </option>
                      )}
                    </select>
                    <ChevronDown className="w-3 h-3 text-[#71717a] absolute right-2 top-3 pointer-events-none" />
                  </div>
                </div>

                {/* === SERVER 1 FILTERS === */}
                {activeServer === 1 && (
                  <div className="flex items-center justify-between gap-2 flex-wrap bg-[#121217] px-3 py-2 rounded-xl border border-[#262630]">
                    <span className="text-[10px] text-[#a1a1aa] flex items-center gap-1.5 font-medium">
                      <Filter className="w-3 h-3 text-amber-400" />
                      Server 1 Country Filter:
                    </span>
                    <button
                      type="button"
                      onClick={() => setS1InStockOnly((prev) => !prev)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                        s1InStockOnly
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                          : 'bg-[#181820] text-[#a1a1aa] border-[#262630] hover:text-white'
                      }`}
                    >
                      {s1InStockOnly ? '✓ In-Stock Only' : 'Show In-Stock Only'}
                    </button>
                  </div>
                )}

                {/* === SERVER 2 FILTERS (Quality Tier + Account Year) === */}
                {activeServer === 2 && (
                  <div className="flex items-center justify-between gap-2 flex-wrap bg-[#121217] px-3 py-2 rounded-xl border border-[#262630]">
                    <div className="flex items-center gap-1.5">
                      {(
                        [
                          { id: 'all', label: `All (${s2FilterMeta.total})` },
                          { id: 'good', label: `Good (${s2FilterMeta.goodCount})` },
                          { id: 'cheap', label: `Cheap (${s2FilterMeta.cheapCount})` },
                        ] as const
                      ).map((tier) => (
                        <button
                          key={tier.id}
                          type="button"
                          onClick={() => setS2Tier(tier.id)}
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                            s2Tier === tier.id
                              ? 'bg-amber-500 text-black border-amber-500'
                              : 'bg-[#181820] text-[#a1a1aa] border-[#262630] hover:text-white'
                          }`}
                        >
                          {tier.label}
                        </button>
                      ))}
                    </div>

                    {s2FilterMeta.years.length > 0 && (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-[#71717a] font-semibold">Year:</span>
                        <select
                          value={s2Year}
                          onChange={(e) => setS2Year(e.target.value)}
                          style={DARK_SELECT_STYLE}
                          className="bg-[#181820] border border-[#262630] rounded-lg px-2 py-1 text-[10px] font-bold text-white outline-none cursor-pointer"
                        >
                          <option value="all" className={DARK_OPTION_CLASS}>
                            All Years
                          </option>
                          {s2FilterMeta.years.map((yr) => (
                            <option key={yr} value={String(yr)} className={DARK_OPTION_CLASS}>
                              {yr}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {/* === SERVER 3 & 4 FILTERS (Popular App Chips + Full-Width All Apps Picker + Country Dropdown) === */}
                {(activeServer === 3 || activeServer === 4) && !isServerLoading && !activeLoadError && (
                  <div className="space-y-2 bg-[#121217] p-2.5 rounded-xl border border-[#262630]">
                    {/* Popular App Chips Row */}
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setOtpAppFilter('all');
                          setIsAllAppsOpen(false);
                        }}
                        className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                          otpAppFilter === 'all'
                            ? 'bg-amber-500 text-black border-amber-500'
                            : 'bg-[#181820] text-[#a1a1aa] border-[#262630] hover:text-white'
                        }`}
                      >
                        All Apps
                      </button>

                      {otpFilterMeta.popularChips.map((chip) => {
                        const isActive = otpAppFilter === chip.code;
                        return (
                          <button
                            key={chip.code}
                            type="button"
                            onClick={() => {
                              setOtpAppFilter(chip.code);
                              setIsAllAppsOpen(false);
                            }}
                            className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all flex items-center gap-1 ${
                              isActive
                                ? 'bg-amber-500 text-black border-amber-500'
                                : 'bg-[#181820] text-[#a1a1aa] border-[#262630] hover:text-white'
                            }`}
                          >
                            <span>{chip.label}</span>
                            <span
                              className={`text-[9px] font-mono ${
                                isActive ? 'text-black/70' : 'text-[#71717a]'
                              }`}
                            >
                              {chip.count}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    {/* Second Row: Full-width-popover All Apps Picker + Country Filter Dropdown */}
                    <div ref={allAppsContainerRef} className="relative grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setIsAllAppsOpen((prev) => !prev)}
                        className={`w-full flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-semibold border transition-colors ${
                          otpAppFilter.startsWith('app:')
                            ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                            : 'bg-[#181820] border-[#262630] text-[#d4d4d8] hover:border-[#3a3a4a]'
                        }`}
                      >
                        <span className="truncate">
                          App: {otpFilterMeta.activeAppLabel} ({otpFilterMeta.allUniqueApps.length})
                        </span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 shrink-0 transition-transform ${
                            isAllAppsOpen ? 'rotate-180' : ''
                          }`}
                        />
                      </button>

                      {/* Country Filter Select */}
                      <div className="relative">
                        <Globe className="w-3.5 h-3.5 text-[#71717a] absolute left-2.5 top-2 pointer-events-none" />
                        <select
                          value={otpCountryFilter}
                          onChange={(e) => setOtpCountryFilter(e.target.value)}
                          aria-label="Filter by country"
                          style={DARK_SELECT_STYLE}
                          className="w-full bg-[#181820] border border-[#262630] focus:border-amber-500/60 rounded-lg pl-8 pr-6 py-1.5 text-[11px] font-semibold text-white outline-none appearance-none cursor-pointer truncate"
                        >
                          <option value="all" className={DARK_OPTION_CLASS}>
                            All Countries ({otpFilterMeta.countries.length})
                          </option>
                          {otpFilterMeta.countries.map((c) => (
                            <option key={c.name} value={c.name} className={DARK_OPTION_CLASS}>
                              {c.name} ({c.count})
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 text-[#71717a] absolute right-2 top-2 pointer-events-none" />
                      </div>

                      {/* Full-Width Searchable All-Apps Popover (dismissible via outside click / Escape) */}
                      {isAllAppsOpen && (
                        <div className="absolute left-0 right-0 top-full mt-1.5 z-30 bg-[#181822] border border-[#323244] rounded-xl shadow-2xl p-2.5 space-y-2">
                          <div className="flex items-center gap-1.5">
                            <div className="relative flex-1">
                              <Search className="w-3.5 h-3.5 text-[#71717a] absolute left-2.5 top-2" />
                              <input
                                type="text"
                                value={allAppsSearch}
                                onChange={(e) => setAllAppsSearch(e.target.value)}
                                placeholder="Find any app (Uber, Tinder, PayPal, Amazon...)"
                                className="w-full bg-[#121217] border border-[#262630] focus:border-amber-500/60 rounded-lg pl-8 pr-2.5 py-1.5 text-[11px] text-white placeholder-[#71717a] outline-none"
                                autoFocus
                              />
                            </div>
                            <button
                              type="button"
                              onClick={() => setIsAllAppsOpen(false)}
                              className="p-1.5 rounded-lg text-[#a1a1aa] hover:text-white hover:bg-[#232330]"
                              aria-label="Close app picker"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          <div className="max-h-44 overflow-y-auto divide-y divide-[#232330]">
                            <button
                              type="button"
                              onClick={() => {
                                setOtpAppFilter('all');
                                setIsAllAppsOpen(false);
                                setAllAppsSearch('');
                              }}
                              className="w-full text-left px-2.5 py-1.5 text-[11px] font-bold text-amber-400 hover:bg-[#232330] rounded"
                            >
                              All Apps
                            </button>
                            {filteredAllApps.map((app) => (
                              <button
                                key={app.key}
                                type="button"
                                onClick={() => {
                                  setOtpAppFilter(app.key);
                                  setIsAllAppsOpen(false);
                                  setAllAppsSearch('');
                                }}
                                className={`w-full flex items-center justify-between px-2.5 py-1.5 text-[11px] hover:bg-[#232330] rounded text-left ${
                                  otpAppFilter === app.key
                                    ? 'text-amber-300 font-bold'
                                    : 'text-white'
                                }`}
                              >
                                <span className="truncate pr-2">{app.label}</span>
                                <span className="text-[10px] font-mono text-[#71717a] shrink-0">
                                  {app.count}
                                </span>
                              </button>
                            ))}
                            {filteredAllApps.length === 0 && (
                              <div className="p-2 text-center text-[10px] text-[#71717a]">
                                No matching app
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* === SERVER 5 FILTERS (Platform Chips + Category Selector) === */}
                {activeServer === 5 && (
                  <div className="space-y-2 bg-[#121217] p-2.5 rounded-xl border border-[#262630]">
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                      {SMM_PLATFORMS.map((p) => {
                        const isActive = s5Platform === p.id;
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => {
                              setS5Platform(p.id);
                              setS5Category('all');
                            }}
                            className={`shrink-0 px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                              isActive
                                ? 'bg-amber-500 text-black border-amber-500'
                                : 'bg-[#181820] text-[#a1a1aa] border-[#262630] hover:text-white'
                            }`}
                          >
                            {p.label}
                          </button>
                        );
                      })}
                    </div>

                    {filteredS5Categories.length > 0 && (
                      <div className="relative">
                        <Filter className="w-3.5 h-3.5 text-[#71717a] absolute left-2.5 top-2 pointer-events-none" />
                        <select
                          value={s5Category}
                          onChange={(e) => setS5Category(e.target.value)}
                          aria-label="Filter by SMM category"
                          style={DARK_SELECT_STYLE}
                          className="w-full bg-[#181820] border border-[#262630] focus:border-amber-500/60 rounded-lg pl-8 pr-6 py-1.5 text-[11px] font-semibold text-white outline-none appearance-none cursor-pointer truncate"
                        >
                          <option value="all" className={DARK_OPTION_CLASS}>
                            All Categories ({filteredS5Categories.length})
                          </option>
                          {filteredS5Categories.map((cat) => (
                            <option
                              key={cat.category}
                              value={cat.category}
                              className={DARK_OPTION_CLASS}
                            >
                              {cat.category} ({cat.count})
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 text-[#71717a] absolute right-2 top-2 pointer-events-none" />
                      </div>
                    )}
                  </div>
                )}

                {/* Catalog List (Scrollable with Automatic Infinite Scroll + Load More Fallback) */}
                <div
                  ref={listScrollRef}
                  onScroll={handleListScroll}
                  className="max-h-60 overflow-y-auto rounded-xl border border-[#262630] bg-[#121217] divide-y divide-[#20202a]"
                >
                  {isServerLoading ? (
                    <div className="p-8 text-center text-xs text-[#a1a1aa] flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-5 h-5 text-amber-400 animate-spin" />
                      <span>Loading full Server {activeServer} catalog...</span>
                    </div>
                  ) : activeLoadError ? (
                    <div className="p-6 text-center text-xs text-rose-300 flex flex-col items-center justify-center gap-2">
                      <AlertCircle className="w-5 h-5 text-rose-400" />
                      <p>{activeLoadError}</p>
                      <button
                        type="button"
                        onClick={handleRefreshActiveServer}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 font-bold text-[11px] transition-colors"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Retry
                      </button>
                    </div>
                  ) : displayedCatalog.length === 0 ? (
                    <div className="p-6 text-center text-xs text-[#71717a] space-y-2">
                      <p>
                        No services found
                        {searchQuery ? ` for "${searchQuery}"` : ' matching your active filters'}.
                      </p>
                      {hasActiveFilters && (
                        <button
                          type="button"
                          onClick={resetFiltersForServer}
                          className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold underline"
                        >
                          Reset all filters
                        </button>
                      )}
                    </div>
                  ) : (
                    <>
                      {displayedCatalog.map((item, idx) => {
                        const isSelected =
                          selectedService?.server_no === item.server_no &&
                          String(selectedService?.service_id).trim().toLowerCase() ===
                            String(item.service_id).trim().toLowerCase();

                        const isItemPinned = pinnedList.some(
                          (p) =>
                            p.server_no === item.server_no &&
                            String(p.service_id).trim().toLowerCase() ===
                              String(item.service_id).trim().toLowerCase()
                        );

                        return (
                          <div
                            key={`srv_${item.server_no}_${item.service_id}_${idx}`}
                            onClick={() => handleSelectFromList(item)}
                            className={`p-2.5 flex items-center justify-between gap-2.5 cursor-pointer transition-colors ${
                              isSelected
                                ? 'bg-amber-500/15 border-l-2 border-amber-500'
                                : 'hover:bg-[#1a1a24]'
                            }`}
                          >
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs font-bold text-white truncate max-w-[320px]">
                                  {item.service_name}
                                </span>
                                {isItemPinned && (
                                  <span className="text-[9px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded font-semibold flex items-center gap-0.5">
                                    <Pin className="w-2.5 h-2.5" /> Pinned
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-[10px] text-[#a1a1aa] mt-0.5 flex-wrap">
                                <span className="font-mono text-[#38bdf8]">ID: {item.service_id}</span>
                                {item.category_name && <span>• {item.category_name}</span>}
                                {item.country_name && <span>• {item.country_name}</span>}
                                {item.stock !== undefined && (
                                  <span
                                    className={
                                      item.stock > 0 ? 'text-emerald-400' : 'text-zinc-500'
                                    }
                                  >
                                    • Stock: {item.stock}
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="text-right shrink-0 flex items-center gap-2">
                              {item.price !== undefined && (
                                <span className="text-xs font-extrabold text-[#22c55e] font-mono">
                                  ₹{item.price}
                                </span>
                              )}
                              <div
                                className={`w-5 h-5 rounded-full flex items-center justify-center border transition-all ${
                                  isSelected
                                    ? 'bg-amber-500 border-amber-500 text-black'
                                    : 'border-[#383848] text-transparent'
                                }`}
                              >
                                <Check className="w-3 h-3 stroke-[3]" />
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Progressive Load More Footer for Servers 1–4 */}
                      {hasMoreClientItems && (
                        <div className="p-2.5 text-center bg-[#14141a]">
                          <button
                            type="button"
                            onClick={() =>
                              setVisibleCount((prev) =>
                                Math.min(prev + PAGE_CHUNK_SIZE, filteredCatalog.length)
                              )
                            }
                            className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center justify-center gap-1.5 mx-auto py-1 px-3 rounded-lg hover:bg-amber-500/10 transition-colors"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                            <span>
                              Scroll or Click to Load More (Showing{' '}
                              {displayedCatalog.length.toLocaleString()} of{' '}
                              {filteredCatalog.length.toLocaleString()})
                            </span>
                          </button>
                        </div>
                      )}

                      {/* Server 5 Paginated Load More Footer */}
                      {activeServer === 5 && hasMoreS5 && (
                        <div className="p-2.5 text-center bg-[#14141a]">
                          <button
                            type="button"
                            onClick={handleLoadMoreS5}
                            disabled={isLoadingMoreS5}
                            className="text-xs font-bold text-amber-400 hover:text-amber-300 flex items-center justify-center gap-1.5 mx-auto py-1 px-3 rounded-lg hover:bg-amber-500/10 transition-colors"
                          >
                            {isLoadingMoreS5 ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Loading more...</span>
                              </>
                            ) : (
                              <>
                                <ChevronDown className="w-3.5 h-3.5" />
                                <span>
                                  Load More (Showing {s5Results.length.toLocaleString()} of{' '}
                                  {s5Total.toLocaleString()})
                                </span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            ) : (
              /* Manual Input Mode */
              <div className="space-y-3 bg-[#121217] p-3.5 rounded-xl border border-[#262630]">
                <div>
                  <label className="text-[10px] text-[#a1a1aa] block mb-1">Service ID / Code</label>
                  <input
                    type="text"
                    value={selectedService?.service_id || ''}
                    onChange={(e) =>
                      setSelectedService((prev) => ({
                        server_no: activeServer,
                        service_id: e.target.value,
                        service_name: prev?.service_name || '',
                        category_name: prev?.category_name,
                        country_name: prev?.country_name,
                      }))
                    }
                    placeholder="e.g. 101, tg, wa, US"
                    className="w-full bg-[#181820] border border-[#262630] rounded-lg px-3 py-1.5 text-xs text-white font-mono outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-[#a1a1aa] block mb-1">Display Title</label>
                  <input
                    type="text"
                    value={selectedService?.service_name || ''}
                    onChange={(e) =>
                      setSelectedService((prev) => ({
                        server_no: activeServer,
                        service_id: prev?.service_id || '',
                        service_name: e.target.value,
                        category_name: prev?.category_name,
                        country_name: prev?.country_name,
                      }))
                    }
                    placeholder="e.g. Instagram Followers Instant"
                    className="w-full bg-[#181820] border border-[#262630] rounded-lg px-3 py-1.5 text-xs text-white outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-[#a1a1aa] block mb-1">
                      Category (optional)
                    </label>
                    <input
                      type="text"
                      value={selectedService?.category_name || ''}
                      onChange={(e) =>
                        setSelectedService((prev) => ({
                          ...(prev || { server_no: activeServer, service_id: '', service_name: '' }),
                          category_name: e.target.value,
                        }))
                      }
                      placeholder="e.g. Instagram"
                      className="w-full bg-[#181820] border border-[#262630] rounded-lg px-3 py-1.5 text-xs text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#a1a1aa] block mb-1">
                      Country (optional)
                    </label>
                    <input
                      type="text"
                      value={selectedService?.country_name || ''}
                      onChange={(e) =>
                        setSelectedService((prev) => ({
                          ...(prev || { server_no: activeServer, service_id: '', service_name: '' }),
                          country_name: e.target.value,
                        }))
                      }
                      placeholder="e.g. India"
                      className="w-full bg-[#181820] border border-[#262630] rounded-lg px-3 py-1.5 text-xs text-white outline-none"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Selected Service Card Preview */}
          {selectedService && (
            <div className="bg-[#121217] border border-amber-500/30 rounded-xl p-3.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">
                  Selected Target Service
                </span>
                <span className="text-xs font-mono font-bold text-[#22c55e]">
                  {selectedService.price !== undefined ? `₹${selectedService.price}` : ''}
                </span>
              </div>
              <h4 className="text-xs font-bold text-white">{selectedService.service_name}</h4>
              <p className="text-[10px] text-[#a1a1aa] flex items-center gap-2 flex-wrap">
                <span>Server {selectedService.server_no}</span>
                <span>
                  • ID: <code className="text-[#38bdf8]">{selectedService.service_id}</code>
                </span>
                {selectedService.category_name && <span>• {selectedService.category_name}</span>}
                {selectedService.country_name && <span>• {selectedService.country_name}</span>}
              </p>
            </div>
          )}

          {/* Badge & Order Customization */}
          <div className="space-y-3 pt-2 border-t border-[#262630]">
            <div>
              <label className="text-[11px] font-semibold text-[#a1a1aa] uppercase tracking-wider block mb-1.5">
                Feature Badge Tag:
              </label>
              <div className="flex items-center gap-1.5 flex-wrap">
                {BADGE_PRESETS.map((p) => {
                  const Icon = p.icon;
                  const isSelected = badge.toLowerCase() === p.label.toLowerCase();
                  return (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setBadge(p.label)}
                      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                        isSelected
                          ? `${p.color} ring-1 ring-amber-400 shadow-sm`
                          : 'bg-[#121217] text-[#a1a1aa] border-[#262630] hover:text-white'
                      }`}
                    >
                      <Icon className="w-3 h-3" />
                      <span>{p.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-semibold text-[#a1a1aa] block mb-1">
                  Custom Badge Text:
                </label>
                <input
                  type="text"
                  value={badge}
                  onChange={(e) => setBadge(e.target.value)}
                  placeholder="e.g. 50% Off, Fast, VIP"
                  className="w-full bg-[#121217] border border-[#262630] rounded-xl px-3 py-2 text-xs text-white outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-[#a1a1aa] block mb-1">
                  Priority Sort Order #:
                </label>
                <input
                  type="number"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(e.target.value)}
                  placeholder="0"
                  className="w-full bg-[#121217] border border-[#262630] rounded-xl px-3 py-2 text-xs text-white outline-none"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3.5 border-t border-[#262630] flex items-center justify-between bg-[#14141a]">
          <div>
            {existingPin ? (
              <button
                type="button"
                onClick={handleUnpin}
                disabled={submitting}
                className="flex items-center gap-1.5 text-xs font-bold text-red-400 hover:text-red-300 px-3 py-2 rounded-xl hover:bg-red-500/10 transition-colors disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Unpin from Store</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onClose}
                className="text-xs font-semibold text-[#a1a1aa] hover:text-white px-3 py-2"
              >
                Cancel
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSavePin}
              disabled={submitting || !selectedService}
              className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-extrabold px-5 py-2.5 rounded-xl text-xs transition-all shadow-md active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Pin className="w-4 h-4" />
              <span>
                {submitting
                  ? 'Saving...'
                  : existingPin
                  ? 'Update Pinned Service'
                  : 'Pin to Storefront'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
