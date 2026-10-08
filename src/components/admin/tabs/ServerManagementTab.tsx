import React, { useEffect, useState, useCallback } from 'react';
import {
  adminApi,
  Server1Settings,
  Server2StockItemAdmin,
  ManagedServerConfig,
  SmmProvider,
  SmmCategory,
  SmmOrder,
} from '../../../api/adminApi';
import { useApp } from '../../../context/AppContext';
import {
  Server,
  Key,
  Globe,
  Upload,
  Plus,
  Trash2,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Percent,
  Database,
  Search,
  Radio,
  TrendingUp,
} from 'lucide-react';

type ServerSubTab = 'server1' | 'server2' | 'server3_4' | 'server5';

export const ServerManagementTab: React.FC = () => {
  const { addToast } = useApp();
  const [subTab, setSubTab] = useState<ServerSubTab>('server1');

  // ============================================================================
  // SERVER 1 STATE
  // ============================================================================
  const [s1Settings, setS1Settings] = useState<Server1Settings | null>(null);
  const [s1Loading, setS1Loading] = useState(false);
  const [s1NewToken, setS1NewToken] = useState('');
  const [s1GlobalMarkupInput, setS1GlobalMarkupInput] = useState('');
  const [s1CountryCode, setS1CountryCode] = useState('');
  const [s1CountryMarkup, setS1CountryMarkup] = useState('');

  const loadServer1 = useCallback(async () => {
    setS1Loading(true);
    try {
      const res = await adminApi.getServer1Settings();
      if (res?.success && res.settings) {
        setS1Settings(res.settings);
        setS1GlobalMarkupInput(String(res.settings.global_markup || 20));
      }
    } catch {
      addToast('Failed to load Server 1 settings', 'error');
    } finally {
      setS1Loading(false);
    }
  }, [addToast]);

  const handleToggleServer1 = async () => {
    if (!s1Settings) return;
    const newStatus = s1Settings.status === 'on' ? 'off' : 'on';
    try {
      const res = await adminApi.toggleServer1(newStatus);
      if (res?.success) {
        setS1Settings((prev) => (prev ? { ...prev, status: newStatus } : null));
        addToast(`Server 1 switched ${newStatus.toUpperCase()}`, 'success');
      }
    } catch {
      addToast('Failed to toggle Server 1 status', 'error');
    }
  };

  const handleUpdateS1Token = async () => {
    if (!s1NewToken.trim()) return;
    try {
      const res = await adminApi.setServer1Token(s1NewToken.trim());
      if (res?.success) {
        setS1Settings((prev) => (prev ? { ...prev, has_token: true } : null));
        setS1NewToken('');
        addToast('Server 1 LZT Token updated successfully', 'success');
      }
    } catch {
      addToast('Failed to update LZT token', 'error');
    }
  };

  const handleUpdateS1GlobalMarkup = async () => {
    const num = parseFloat(s1GlobalMarkupInput);
    if (isNaN(num) || num < 0) {
      addToast('Please enter a valid markup percentage', 'error');
      return;
    }
    try {
      const res = await adminApi.updateServer1GlobalMarkup(num);
      if (res?.success) {
        setS1Settings((prev) => (prev ? { ...prev, global_markup: num } : null));
        addToast(`Global markup updated to ${num}%`, 'success');
      }
    } catch {
      addToast('Failed to update global markup', 'error');
    }
  };

  const handleSetCountryMarkup = async () => {
    if (!s1CountryCode.trim()) return;
    const num = parseFloat(s1CountryMarkup);
    if (isNaN(num) || num < 0) {
      addToast('Please enter a valid country markup', 'error');
      return;
    }
    try {
      const country = s1CountryCode.trim().toUpperCase();
      const res = await adminApi.updateServer1Markup(country, num);
      if (res?.success) {
        setS1Settings((prev) => {
          if (!prev) return null;
          const updated = { ...prev.country_markups };
          if (num === 0) {
            delete updated[country];
          } else {
            updated[country] = num;
          }
          return { ...prev, country_markups: updated };
        });
        setS1CountryCode('');
        setS1CountryMarkup('');
        addToast(`Country ${country} markup updated to ${num}%`, 'success');
      }
    } catch {
      addToast('Failed to set country markup', 'error');
    }
  };

  // ============================================================================
  // SERVER 2 STATE (STOCK MANAGEMENT)
  // ============================================================================
  const [s2Stock, setS2Stock] = useState<Server2StockItemAdmin[]>([]);
  const [s2Loading, setS2Loading] = useState(false);
  const [s2TierFilter, setS2TierFilter] = useState<'all' | 'good' | 'cheap'>('all');
  const [s2Search, setS2Search] = useState('');
  const [s2UploadMode, setS2UploadMode] = useState<'single' | 'bulk'>('single');

  // Single upload form
  const [s2SingleTier, setS2SingleTier] = useState<'good' | 'cheap'>('good');
  const [s2SinglePhone, setS2SinglePhone] = useState('');
  const [s2SingleCountry, setS2SingleCountry] = useState('India');
  const [s2SingleYear, setS2SingleYear] = useState('2023');
  const [s2SinglePrice, setS2SinglePrice] = useState('120');
  const [s2Single2fa, setS2Single2fa] = useState('');

  // Bulk upload form
  const [s2BulkTier, setS2BulkTier] = useState<'good' | 'cheap'>('good');
  const [s2BulkCountry, setS2BulkCountry] = useState('India');
  const [s2BulkYear, setS2BulkYear] = useState('2023');
  const [s2BulkPrice, setS2BulkPrice] = useState('120');
  const [s2BulkText, setS2BulkText] = useState('');
  const [s2IsSubmitting, setS2IsSubmitting] = useState(false);

  const loadServer2Stock = useCallback(async () => {
    setS2Loading(true);
    try {
      const res = await adminApi.getServer2Stock({
        tier: s2TierFilter === 'all' ? undefined : s2TierFilter,
        limit: 150,
      });
      if (res?.success && res.items) {
        setS2Stock(res.items);
      }
    } catch {
      addToast('Failed to load Server 2 stock inventory', 'error');
    } finally {
      setS2Loading(false);
    }
  }, [s2TierFilter, addToast]);

  const handleAddSingleStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!s2SinglePhone.trim()) {
      addToast('Phone number is required', 'error');
      return;
    }
    setS2IsSubmitting(true);
    try {
      const res = await adminApi.addServer2StockSingle({
        phone: s2SinglePhone.trim(),
        country_name: s2SingleCountry.trim(),
        quality_tier: s2SingleTier,
        account_year: parseInt(s2SingleYear) || 2023,
        price: parseFloat(s2SinglePrice) || 100,
        twofa: s2Single2fa.trim() || undefined,
      });
      if (res?.success) {
        addToast(`Account ${s2SinglePhone} added to ${s2SingleTier} tier`, 'success');
        setS2SinglePhone('');
        setS2Single2fa('');
        loadServer2Stock();
      } else {
        addToast(res?.error || 'Failed to add account', 'error');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed';
      addToast(msg, 'error');
    } finally {
      setS2IsSubmitting(false);
    }
  };

  const handleBulkUploadStock = async (e: React.FormEvent) => {
    e.preventDefault();
    const lines = s2BulkText
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    if (lines.length === 0) {
      addToast('Please enter at least one phone number / account item', 'error');
      return;
    }

    setS2IsSubmitting(true);
    try {
      const items = lines.map((line) => {
        const parts = line.split(':');
        const phone = parts[0]?.trim();
        const twofa = parts[1]?.trim() || undefined;
        return { phone, twofa };
      });

      const res = await adminApi.uploadServer2Stock({
        quality_tier: s2BulkTier,
        country: s2BulkCountry.trim(),
        year: parseInt(s2BulkYear) || 2023,
        price: parseFloat(s2BulkPrice) || 100,
        items,
      });

      if (res?.success) {
        addToast(`Successfully added ${res.added || items.length} accounts to ${s2BulkTier} tier`, 'success');
        setS2BulkText('');
        loadServer2Stock();
      } else {
        addToast(res?.error || 'Bulk upload failed', 'error');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Bulk upload failed';
      addToast(msg, 'error');
    } finally {
      setS2IsSubmitting(false);
    }
  };

  const handleDeleteStockItem = async (phone: string) => {
    if (!window.confirm(`Are you sure you want to delete session account ${phone}?`)) return;
    try {
      const res = await adminApi.deleteServer2Stock(phone);
      if (res?.success) {
        setS2Stock((prev) => prev.filter((item) => item.phone !== phone));
        addToast(`Deleted session ${phone}`, 'success');
      } else {
        addToast(res?.error || 'Failed to delete account', 'error');
      }
    } catch {
      addToast('Failed to delete account', 'error');
    }
  };

  // ============================================================================
  // SERVERS 3 & 4 STATE (VIRTUAL OTP)
  // ============================================================================
  const [srvConfigs, setSrvConfigs] = useState<ManagedServerConfig[]>([]);
  const [syncingSrv, setSyncingSrv] = useState<number | null>(null);

  const loadServersConfig = useCallback(async () => {
    try {
      const res = await adminApi.getServersConfig();
      if (res?.success && res.servers) {
        setSrvConfigs(res.servers);
      }
    } catch {
      addToast('Failed to load Servers 3 & 4 configuration', 'error');
    }
  }, [addToast]);

  const handleToggleManagedServer = async (serverNo: number, currentEnabled: boolean) => {
    try {
      const res = await adminApi.toggleServer(serverNo, !currentEnabled);
      if (res?.success) {
        setSrvConfigs((prev) =>
          prev.map((c) => (c.server_no === serverNo ? { ...c, enabled: !currentEnabled } : c))
        );
        addToast(`Server ${serverNo} ${!currentEnabled ? 'Enabled' : 'Disabled'}`, 'success');
      }
    } catch {
      addToast(`Failed to toggle Server ${serverNo}`, 'error');
    }
  };

  const handleSyncServerCatalogue = async (serverNo: number) => {
    setSyncingSrv(serverNo);
    try {
      const res = await adminApi.syncServer(serverNo);
      if (res?.success) {
        addToast(`Server ${serverNo} catalogue synced: ${res.message || 'Complete'}`, 'success');
      }
    } catch {
      addToast(`Failed to sync Server ${serverNo} catalogue`, 'error');
    } finally {
      setSyncingSrv(null);
    }
  };

  const handleUpdateManagedServerConfig = async (
    serverNo: number,
    percentMarkup: number,
    fixedMarkup: number,
    apiUrl?: string,
    apiKey?: string
  ) => {
    try {
      const res = await adminApi.updateServerConfig(serverNo, {
        percent_markup: percentMarkup,
        fixed_markup: fixedMarkup,
        api_url: apiUrl,
        api_key: apiKey,
      });
      if (res?.success) {
        addToast(`Server ${serverNo} configuration saved`, 'success');
        loadServersConfig();
      }
    } catch {
      addToast(`Failed to update Server ${serverNo} config`, 'error');
    }
  };

  // ============================================================================
  // SERVER 5 STATE (SMM BOOST)
  // ============================================================================
  const [smmMasterEnabled, setSmmMasterEnabled] = useState(true);
  const [smmProviders, setSmmProviders] = useState<SmmProvider[]>([]);
  const [smmCategories, setSmmCategories] = useState<SmmCategory[]>([]);
  const [smmOrders, setSmmOrders] = useState<SmmOrder[]>([]);
  const [smmSubSection, setSmmSubSection] = useState<'providers' | 'categories' | 'orders'>('providers');

  // Add provider form
  const [newProvName, setNewProvName] = useState('');
  const [newProvUrl, setNewProvUrl] = useState('');
  const [newProvKey, setNewProvKey] = useState('');
  const [newProvMarkup, setNewProvMarkup] = useState('20');

  const loadServer5 = useCallback(async () => {
    try {
      const [provRes, catRes, ordersRes] = await Promise.allSettled([
        adminApi.getSmmProviders(),
        adminApi.getSmmCategories(),
        adminApi.getSmmOrders(25),
      ]);

      if (provRes.status === 'fulfilled' && provRes.value?.providers) {
        setSmmProviders(provRes.value.providers);
      }
      if (catRes.status === 'fulfilled' && catRes.value?.categories) {
        setSmmCategories(catRes.value.categories);
      }
      if (ordersRes.status === 'fulfilled' && ordersRes.value?.orders) {
        setSmmOrders(ordersRes.value.orders);
      }
    } catch {
      addToast('Failed to load SMM hub data', 'error');
    }
  }, [addToast]);

  const handleToggleSmmMaster = async () => {
    try {
      const res = await adminApi.toggleSmmMaster(!smmMasterEnabled);
      if (res?.success) {
        setSmmMasterEnabled(res.enabled);
        addToast(`SMM Master ${res.enabled ? 'Enabled' : 'Disabled'}`, 'success');
      }
    } catch {
      addToast('Failed to toggle SMM master switch', 'error');
    }
  };

  const handleToggleSmmProvider = async (id: number) => {
    try {
      const res = await adminApi.toggleSmmProvider(id);
      if (res?.success) {
        setSmmProviders((prev) =>
          prev.map((p) => (p.id === id ? { ...p, enabled: res.enabled ? 1 : 0 } : p))
        );
        addToast(`Provider ${res.enabled ? 'Enabled' : 'Disabled'}`, 'success');
      }
    } catch {
      addToast('Failed to toggle SMM provider', 'error');
    }
  };

  const handleToggleSmmCategory = async (id: number) => {
    try {
      const res = await adminApi.toggleSmmCategory(id);
      if (res?.success) {
        setSmmCategories((prev) =>
          prev.map((c) => (c.id === id ? { ...c, enabled: res.enabled ? 1 : 0 } : c))
        );
        addToast(`Category visibility toggled`, 'success');
      }
    } catch {
      addToast('Failed to toggle category', 'error');
    }
  };

  const handleAddSmmProvider = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProvName || !newProvUrl || !newProvKey) {
      addToast('All provider fields are required', 'error');
      return;
    }
    try {
      const res = await adminApi.addSmmProvider({
        name: newProvName.trim(),
        api_url: newProvUrl.trim(),
        api_key: newProvKey.trim(),
        percent_markup: parseFloat(newProvMarkup) || 20,
      });
      if (res?.success) {
        addToast(`SMM Provider "${newProvName}" added`, 'success');
        setNewProvName('');
        setNewProvUrl('');
        setNewProvKey('');
        loadServer5();
      }
    } catch {
      addToast('Failed to add SMM provider', 'error');
    }
  };

  // Initial load on subtab change
  useEffect(() => {
    if (subTab === 'server1') loadServer1();
    if (subTab === 'server2') loadServer2Stock();
    if (subTab === 'server3_4') loadServersConfig();
    if (subTab === 'server5') loadServer5();
  }, [subTab, loadServer1, loadServer2Stock, loadServersConfig, loadServer5]);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Sub-navigation Pills for Servers 1-5 */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar p-1.5 bg-[#181820] border border-[#262630] rounded-2xl">
        <button
          onClick={() => setSubTab('server1')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            subTab === 'server1'
              ? 'bg-[#7c3aed] text-white shadow-md'
              : 'text-[#a1a1aa] hover:text-white hover:bg-[#20202a]'
          }`}
        >
          <Server className="w-3.5 h-3.5" />
          <span>Server 1 (LZT Market)</span>
        </button>

        <button
          onClick={() => setSubTab('server2')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            subTab === 'server2'
              ? 'bg-[#7c3aed] text-white shadow-md'
              : 'text-[#a1a1aa] hover:text-white hover:bg-[#20202a]'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Server 2 (Sessions Stock)</span>
        </button>

        <button
          onClick={() => setSubTab('server3_4')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            subTab === 'server3_4'
              ? 'bg-[#7c3aed] text-white shadow-md'
              : 'text-[#a1a1aa] hover:text-white hover:bg-[#20202a]'
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          <span>Server 3 & 4 (Virtual OTP)</span>
        </button>

        <button
          onClick={() => setSubTab('server5')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            subTab === 'server5'
              ? 'bg-[#7c3aed] text-white shadow-md'
              : 'text-[#a1a1aa] hover:text-white hover:bg-[#20202a]'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Server 5 (SMM Boost)</span>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* SUBTAB 1: SERVER 1 (LZT MARKET 2FA ACCOUNTS) */}
      {/* ===================================================================== */}
      {subTab === 'server1' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          {/* Master Toggle & Token Status Card */}
          <div className="bg-[#181820] border border-[#262630] rounded-2xl p-5 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-tight">
                  Server 1: LZT Market Master Control
                </h3>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                    s1Settings?.status === 'on'
                      ? 'bg-[#22c55e]/15 text-[#22c55e] border-[#22c55e]/30'
                      : 'bg-[#ef4444]/15 text-[#ef4444] border-[#ef4444]/30'
                  }`}
                >
                  {s1Settings?.status === 'on' ? 'ONLINE (ACTIVE)' : 'OFFLINE (DISABLED)'}
                </span>
              </div>
              <p className="text-xs text-[#a1a1aa]">
                Enables global Telegram 2FA account sourcing directly from LZT Market API.
              </p>
            </div>

            <button
              onClick={handleToggleServer1}
              disabled={s1Loading}
              className={`flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 shadow-md cursor-pointer ${
                s1Settings?.status === 'on'
                  ? 'bg-[#ef4444]/20 hover:bg-[#ef4444]/30 text-[#ef4444] border border-[#ef4444]/40'
                  : 'bg-[#22c55e]/20 hover:bg-[#22c55e]/30 text-[#22c55e] border border-[#22c55e]/40'
              }`}
            >
              {s1Settings?.status === 'on' ? (
                <>
                  <XCircle className="w-4 h-4" /> <span>Disable Server 1</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" /> <span>Enable Server 1</span>
                </>
              )}
            </button>
          </div>

          {/* Token & Markup Settings Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* LZT Token Configuration */}
            <div className="bg-[#181820] border border-[#262630] rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Key className="w-4 h-4 text-[#8b5cf6]" />
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    LZT Market API Token
                  </h4>
                </div>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                    s1Settings?.has_token
                      ? 'bg-[#22c55e]/15 text-[#22c55e] border-[#22c55e]/30'
                      : 'bg-[#ef4444]/15 text-[#ef4444] border-[#ef4444]/30'
                  }`}
                >
                  {s1Settings?.has_token ? 'Configured & Encrypted' : 'Missing Token'}
                </span>
              </div>

              <div className="space-y-2">
                <input
                  type="password"
                  placeholder="Paste new LZT Bearer token..."
                  value={s1NewToken}
                  onChange={(e) => setS1NewToken(e.target.value)}
                  className="w-full bg-[#121217] border border-[#262630] focus:border-[#7c3aed] rounded-xl px-3.5 py-2 text-xs text-white placeholder-[#71717a] outline-none"
                />
                <button
                  onClick={handleUpdateS1Token}
                  disabled={!s1NewToken.trim()}
                  className="w-full bg-[#7c3aed] hover:bg-[#6d28d9] disabled:opacity-50 text-white font-semibold py-2 rounded-xl text-xs transition-all shadow-sm"
                >
                  Update API Token
                </button>
              </div>
            </div>

            {/* Global Pricing Markup */}
            <div className="bg-[#181820] border border-[#262630] rounded-2xl p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Percent className="w-4 h-4 text-[#22c55e]" />
                  <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                    Default Global Markup
                  </h4>
                </div>
                <span className="text-xs font-bold text-[#22c55e]">
                  {s1Settings?.global_markup ?? 20}%
                </span>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="20"
                  value={s1GlobalMarkupInput}
                  onChange={(e) => setS1GlobalMarkupInput(e.target.value)}
                  className="flex-1 bg-[#121217] border border-[#262630] focus:border-[#7c3aed] rounded-xl px-3.5 py-2 text-xs text-white outline-none"
                />
                <button
                  onClick={handleUpdateS1GlobalMarkup}
                  className="bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-sm"
                >
                  Save %
                </button>
              </div>
              <p className="text-[11px] text-[#71717a]">
                Applied automatically to any country without a custom rate.
              </p>
            </div>
          </div>

          {/* Country-Specific Markups Table */}
          <div className="bg-[#181820] border border-[#262630] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-[#8b5cf6]" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Country-Specific Markup Rules
                </h4>
              </div>
              <span className="text-[11px] text-[#71717a]">
                {Object.keys(s1Settings?.country_markups || {}).length} Custom Countries Configured
              </span>
            </div>

            {/* Add / Edit Country Markup */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap bg-[#121217] p-3 rounded-xl border border-[#262630]">
              <input
                type="text"
                placeholder="ISO (e.g. US, RU, IN)"
                value={s1CountryCode}
                onChange={(e) => setS1CountryCode(e.target.value.toUpperCase())}
                maxLength={4}
                className="w-24 bg-[#181820] border border-[#262630] rounded-lg px-2.5 py-1.5 text-xs text-white uppercase outline-none"
              />
              <input
                type="number"
                placeholder="Markup % (0 to delete)"
                value={s1CountryMarkup}
                onChange={(e) => setS1CountryMarkup(e.target.value)}
                className="w-40 bg-[#181820] border border-[#262630] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
              />
              <button
                onClick={handleSetCountryMarkup}
                className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-semibold px-4 py-1.5 rounded-lg text-xs transition-all ml-auto"
              >
                Set Rule
              </button>
            </div>

            {/* Rules List */}
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
              {Object.entries(s1Settings?.country_markups || {}).map(([country, markup]) => (
                <div
                  key={country}
                  className="flex items-center justify-between bg-[#121217] border border-[#262630] rounded-xl px-3 py-2"
                >
                  <span className="font-bold text-xs text-white">{country}</span>
                  <span className="text-xs text-[#22c55e] font-semibold">{markup}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUBTAB 2: SERVER 2 (FRESH SESSIONS STOCK MANAGEMENT) */}
      {/* ===================================================================== */}
      {subTab === 'server2' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          {/* Top Switcher: Single vs Bulk Upload */}
          <div className="bg-[#181820] border border-[#262630] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Upload className="w-4 h-4 text-[#8b5cf6]" />
                <h3 className="text-sm font-bold text-white tracking-tight">
                  Stock Upload & Strict Quality Tier Segregation
                </h3>
              </div>

              <div className="flex items-center gap-1 bg-[#121217] p-1 rounded-xl border border-[#262630]">
                <button
                  onClick={() => setS2UploadMode('single')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    s2UploadMode === 'single'
                      ? 'bg-[#7c3aed] text-white shadow'
                      : 'text-[#a1a1aa] hover:text-white'
                  }`}
                >
                  Single Account
                </button>
                <button
                  onClick={() => setS2UploadMode('bulk')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                    s2UploadMode === 'bulk'
                      ? 'bg-[#7c3aed] text-white shadow'
                      : 'text-[#a1a1aa] hover:text-white'
                  }`}
                >
                  Bulk Upload
                </button>
              </div>
            </div>

            {/* Form: Single Upload */}
            {s2UploadMode === 'single' && (
              <form onSubmit={handleAddSingleStock} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-[#a1a1aa] block mb-1">
                      Quality Tier Segregation
                    </label>
                    <select
                      value={s2SingleTier}
                      onChange={(e) => setS2SingleTier(e.target.value as 'good' | 'cheap')}
                      className="w-full bg-[#121217] border border-[#262630] rounded-xl px-3 py-2 text-xs text-white outline-none"
                    >
                      <option value="good">🟢 Good Quality Tier</option>
                      <option value="cheap">🟡 Cheap Quality Tier</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-[#a1a1aa] block mb-1">
                      Phone Number
                    </label>
                    <input
                      type="text"
                      placeholder="+919876543210"
                      value={s2SinglePhone}
                      onChange={(e) => setS2SinglePhone(e.target.value)}
                      required
                      className="w-full bg-[#121217] border border-[#262630] rounded-xl px-3 py-2 text-xs text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-[#a1a1aa] block mb-1">
                      Country Name
                    </label>
                    <input
                      type="text"
                      placeholder="India / USA"
                      value={s2SingleCountry}
                      onChange={(e) => setS2SingleCountry(e.target.value)}
                      className="w-full bg-[#121217] border border-[#262630] rounded-xl px-3 py-2 text-xs text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-[#a1a1aa] block mb-1">
                      Registration Year
                    </label>
                    <input
                      type="number"
                      placeholder="2023"
                      value={s2SingleYear}
                      onChange={(e) => setS2SingleYear(e.target.value)}
                      className="w-full bg-[#121217] border border-[#262630] rounded-xl px-3 py-2 text-xs text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-[#a1a1aa] block mb-1">
                      Price (INR ₹)
                    </label>
                    <input
                      type="number"
                      placeholder="120"
                      value={s2SinglePrice}
                      onChange={(e) => setS2SinglePrice(e.target.value)}
                      className="w-full bg-[#121217] border border-[#262630] rounded-xl px-3 py-2 text-xs text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-[#a1a1aa] block mb-1">
                      2FA Password (Optional)
                    </label>
                    <input
                      type="text"
                      placeholder="Secret2FA"
                      value={s2Single2fa}
                      onChange={(e) => setS2Single2fa(e.target.value)}
                      className="w-full bg-[#121217] border border-[#262630] rounded-xl px-3 py-2 text-xs text-white outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={s2IsSubmitting}
                  className="bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold px-5 py-2.5 rounded-xl text-xs transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  <span>{s2IsSubmitting ? 'Uploading Account...' : 'Save Stock Account'}</span>
                </button>
              </form>
            )}

            {/* Form: Bulk Upload */}
            {s2UploadMode === 'bulk' && (
              <form onSubmit={handleBulkUploadStock} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-[#a1a1aa] block mb-1">
                      Tier Assignment
                    </label>
                    <select
                      value={s2BulkTier}
                      onChange={(e) => setS2BulkTier(e.target.value as 'good' | 'cheap')}
                      className="w-full bg-[#121217] border border-[#262630] rounded-xl px-3 py-2 text-xs text-white outline-none"
                    >
                      <option value="good">🟢 Good Quality Tier</option>
                      <option value="cheap">🟡 Cheap Quality Tier</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-[#a1a1aa] block mb-1">
                      Batch Country
                    </label>
                    <input
                      type="text"
                      value={s2BulkCountry}
                      onChange={(e) => setS2BulkCountry(e.target.value)}
                      className="w-full bg-[#121217] border border-[#262630] rounded-xl px-3 py-2 text-xs text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-[#a1a1aa] block mb-1">
                      Batch Year
                    </label>
                    <input
                      type="number"
                      value={s2BulkYear}
                      onChange={(e) => setS2BulkYear(e.target.value)}
                      className="w-full bg-[#121217] border border-[#262630] rounded-xl px-3 py-2 text-xs text-white outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-[#a1a1aa] block mb-1">
                      Batch Price (₹)
                    </label>
                    <input
                      type="number"
                      value={s2BulkPrice}
                      onChange={(e) => setS2BulkPrice(e.target.value)}
                      className="w-full bg-[#121217] border border-[#262630] rounded-xl px-3 py-2 text-xs text-white outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[#a1a1aa] block mb-1">
                    Phone Numbers (One per line or format <code className="text-[#8b5cf6]">phone:2fa</code>)
                  </label>
                  <textarea
                    rows={4}
                    placeholder={`+919876543210:Password123\n+919876543211\n+919876543212:Pass456`}
                    value={s2BulkText}
                    onChange={(e) => setS2BulkText(e.target.value)}
                    className="w-full bg-[#121217] border border-[#262630] rounded-xl p-3 text-xs font-mono text-white outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={s2IsSubmitting}
                  className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-bold px-5 py-2.5 rounded-xl text-xs transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Upload className="w-4 h-4" />
                  <span>{s2IsSubmitting ? 'Uploading Batch...' : 'Submit Bulk Accounts'}</span>
                </button>
              </form>
            )}
          </div>

          {/* Active Stock Inventory Table */}
          <div className="bg-[#181820] border border-[#262630] rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-[#22c55e]" />
                <h3 className="text-sm font-bold text-white tracking-tight">
                  Active Stock Inventory Table
                </h3>
                <span className="text-xs text-[#71717a]">({s2Stock.length} items)</span>
              </div>

              {/* Tier Filters & Search */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 bg-[#121217] p-1 rounded-xl border border-[#262630]">
                  <button
                    onClick={() => setS2TierFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                      s2TierFilter === 'all' ? 'bg-[#7c3aed] text-white' : 'text-[#a1a1aa]'
                    }`}
                  >
                    All
                  </button>
                  <button
                    onClick={() => setS2TierFilter('good')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                      s2TierFilter === 'good' ? 'bg-[#22c55e] text-black font-bold' : 'text-[#22c55e]'
                    }`}
                  >
                    🟢 Good
                  </button>
                  <button
                    onClick={() => setS2TierFilter('cheap')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${
                      s2TierFilter === 'cheap' ? 'bg-[#eab308] text-black font-bold' : 'text-[#eab308]'
                    }`}
                  >
                    🟡 Cheap
                  </button>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#71717a]" />
                  <input
                    type="text"
                    placeholder="Search phone..."
                    value={s2Search}
                    onChange={(e) => setS2Search(e.target.value)}
                    className="bg-[#121217] border border-[#262630] rounded-xl pl-8 pr-3 py-1.5 text-xs text-white outline-none w-36 sm:w-48"
                  />
                </div>

                <button
                  onClick={loadServer2Stock}
                  className="p-1.5 rounded-xl bg-[#121217] border border-[#262630] text-[#a1a1aa] hover:text-white"
                >
                  <RefreshCw className={`w-4 h-4 ${s2Loading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto no-scrollbar border border-[#262630] rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#121217] text-[#a1a1aa] border-b border-[#262630]">
                  <tr>
                    <th className="py-2.5 px-3 font-semibold">Phone Number</th>
                    <th className="py-2.5 px-3 font-semibold">Tier</th>
                    <th className="py-2.5 px-3 font-semibold">Country</th>
                    <th className="py-2.5 px-3 font-semibold">Year</th>
                    <th className="py-2.5 px-3 font-semibold">Price</th>
                    <th className="py-2.5 px-3 font-semibold">2FA</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#262630]">
                  {s2Stock
                    .filter((item) =>
                      s2Search ? item.phone.toLowerCase().includes(s2Search.toLowerCase()) : true
                    )
                    .map((item) => (
                      <tr key={item.phone} className="hover:bg-[#121217]/50 transition-colors">
                        <td className="py-2 px-3 font-mono text-white font-medium">{item.phone}</td>
                        <td className="py-2 px-3">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                              item.quality_tier === 'good'
                                ? 'bg-[#22c55e]/15 text-[#22c55e] border-[#22c55e]/30'
                                : 'bg-[#eab308]/15 text-[#eab308] border-[#eab308]/30'
                            }`}
                          >
                            {item.quality_tier === 'good' ? '🟢 Good' : '🟡 Cheap'}
                          </span>
                        </td>
                        <td className="py-2 px-3 text-[#a1a1aa]">{item.country_name || 'Global'}</td>
                        <td className="py-2 px-3 text-[#a1a1aa]">{item.account_year || '2023'}</td>
                        <td className="py-2 px-3 font-bold text-[#22c55e]">₹{item.price}</td>
                        <td className="py-2 px-3 text-[#71717a]">
                          {item.twofa ? <span className="text-[#a78bfa]">Yes</span> : 'None'}
                        </td>
                        <td className="py-2 px-3 text-right">
                          <button
                            onClick={() => handleDeleteStockItem(item.phone)}
                            className="text-[#ef4444] hover:text-[#dc2626] p-1 rounded-lg hover:bg-[#ef4444]/10 transition-colors"
                            title="Delete Account"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  {s2Stock.length === 0 && (
                    <tr>
                      <td colSpan={7} className="text-center py-8 text-[#71717a]">
                        No active session accounts found in stock.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUBTAB 3: SERVERS 3 & 4 (DGOTP & TEMPORASMS) */}
      {/* ===================================================================== */}
      {subTab === 'server3_4' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {[3, 4].map((serverNo) => {
              const config = srvConfigs.find((c) => c.server_no === serverNo) || {
                server_no: serverNo,
                name: serverNo === 3 ? 'Server 3 (DGOTP)' : 'Server 4 (TemporaSMS)',
                enabled: true,
                percent_markup: 20,
                fixed_markup: 5,
              };

              return (
                <div
                  key={serverNo}
                  className="bg-[#181820] border border-[#262630] rounded-2xl p-5 shadow-sm space-y-4"
                >
                  {/* Server Header */}
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        {serverNo === 3 ? 'Server 3: DGOTP' : 'Server 4: TemporaSMS'}
                      </h3>
                      <p className="text-[11px] text-[#a1a1aa]">Virtual OTP activation gateway</p>
                    </div>

                    <button
                      onClick={() => handleToggleManagedServer(serverNo, !!config.enabled)}
                      className={`text-[10px] font-bold px-3 py-1 rounded-full border transition-all ${
                        config.enabled
                          ? 'bg-[#22c55e]/15 text-[#22c55e] border-[#22c55e]/30'
                          : 'bg-[#ef4444]/15 text-[#ef4444] border-[#ef4444]/30'
                      }`}
                    >
                      {config.enabled ? 'Enabled' : 'Disabled'}
                    </button>
                  </div>

                  {/* Pricing Markups */}
                  <div className="grid grid-cols-2 gap-2 bg-[#121217] p-3 rounded-xl border border-[#262630]">
                    <div>
                      <label className="text-[10px] text-[#a1a1aa] block mb-1 font-semibold">
                        Percent Markup (%)
                      </label>
                      <input
                        type="number"
                        defaultValue={config.percent_markup || 20}
                        id={`s${serverNo}_percent`}
                        className="w-full bg-[#181820] border border-[#262630] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-[#a1a1aa] block mb-1 font-semibold">
                        Fixed Markup (₹)
                      </label>
                      <input
                        type="number"
                        defaultValue={config.fixed_markup || 5}
                        id={`s${serverNo}_fixed`}
                        className="w-full bg-[#181820] border border-[#262630] rounded-lg px-2.5 py-1.5 text-xs text-white outline-none"
                      />
                    </div>
                  </div>

                  {/* Actions: Save Markups & Sync Catalogue */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        const pEl = document.getElementById(`s${serverNo}_percent`) as HTMLInputElement;
                        const fEl = document.getElementById(`s${serverNo}_fixed`) as HTMLInputElement;
                        handleUpdateManagedServerConfig(
                          serverNo,
                          parseFloat(pEl?.value || '20'),
                          parseFloat(fEl?.value || '5')
                        );
                      }}
                      className="flex-1 bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-semibold py-2 rounded-xl text-xs transition-all shadow-sm"
                    >
                      Save Markups
                    </button>

                    <button
                      onClick={() => handleSyncServerCatalogue(serverNo)}
                      disabled={syncingSrv === serverNo}
                      className="flex items-center justify-center gap-1.5 bg-[#121217] hover:bg-[#1f1f28] border border-[#262630] text-white font-semibold px-4 py-2 rounded-xl text-xs transition-all shadow-sm disabled:opacity-50"
                    >
                      <RefreshCw
                        className={`w-3.5 h-3.5 ${syncingSrv === serverNo ? 'animate-spin' : ''}`}
                      />
                      <span>Sync Catalogue</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SUBTAB 4: SERVER 5 (SMM BOOST PANELS & ORDERS) */}
      {/* ===================================================================== */}
      {subTab === 'server5' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          {/* SMM Master Switch */}
          <div className="bg-[#181820] border border-[#262630] rounded-2xl p-5 shadow-sm flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white tracking-tight">
                Server 5: Social Media Marketing (SMM) Hub
              </h3>
              <p className="text-xs text-[#a1a1aa]">
                Automated order dispatch to multi-provider external SMM panels.
              </p>
            </div>

            <button
              onClick={handleToggleSmmMaster}
              className={`text-xs font-bold px-4 py-2 rounded-xl border transition-all ${
                smmMasterEnabled
                  ? 'bg-[#22c55e]/15 text-[#22c55e] border-[#22c55e]/30'
                  : 'bg-[#ef4444]/15 text-[#ef4444] border-[#ef4444]/30'
              }`}
            >
              {smmMasterEnabled ? 'SMM Online' : 'SMM Disabled'}
            </button>
          </div>

          {/* SMM Sub-sections (Providers / Categories / Orders) */}
          <div className="flex items-center gap-2 border-b border-[#262630] pb-2">
            <button
              onClick={() => setSmmSubSection('providers')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                smmSubSection === 'providers' ? 'bg-[#7c3aed] text-white' : 'text-[#a1a1aa]'
              }`}
            >
              Providers ({smmProviders.length})
            </button>
            <button
              onClick={() => setSmmSubSection('categories')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                smmSubSection === 'categories' ? 'bg-[#7c3aed] text-white' : 'text-[#a1a1aa]'
              }`}
            >
              Categories ({smmCategories.length})
            </button>
            <button
              onClick={() => setSmmSubSection('orders')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                smmSubSection === 'orders' ? 'bg-[#7c3aed] text-white' : 'text-[#a1a1aa]'
              }`}
            >
              Live Orders Log ({smmOrders.length})
            </button>
          </div>

          {/* SMM Providers Section */}
          {smmSubSection === 'providers' && (
            <div className="space-y-4">
              {/* Add SMM Provider */}
              <form
                onSubmit={handleAddSmmProvider}
                className="bg-[#181820] border border-[#262630] rounded-2xl p-5 shadow-sm space-y-3"
              >
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">
                  Connect New SMM Provider API
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                  <input
                    type="text"
                    placeholder="Provider Name (e.g. SMM Raja)"
                    value={newProvName}
                    onChange={(e) => setNewProvName(e.target.value)}
                    required
                    className="bg-[#121217] border border-[#262630] rounded-xl px-3 py-2 text-xs text-white outline-none"
                  />
                  <input
                    type="url"
                    placeholder="API URL (https://.../api/v2)"
                    value={newProvUrl}
                    onChange={(e) => setNewProvUrl(e.target.value)}
                    required
                    className="bg-[#121217] border border-[#262630] rounded-xl px-3 py-2 text-xs text-white outline-none"
                  />
                  <input
                    type="password"
                    placeholder="API Key"
                    value={newProvKey}
                    onChange={(e) => setNewProvKey(e.target.value)}
                    required
                    className="bg-[#121217] border border-[#262630] rounded-xl px-3 py-2 text-xs text-white outline-none"
                  />
                  <input
                    type="number"
                    placeholder="Markup % (default 20)"
                    value={newProvMarkup}
                    onChange={(e) => setNewProvMarkup(e.target.value)}
                    className="bg-[#121217] border border-[#262630] rounded-xl px-3 py-2 text-xs text-white outline-none"
                  />
                </div>
                <button
                  type="submit"
                  className="bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-sm"
                >
                  Add Provider
                </button>
              </form>

              {/* Providers List */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {smmProviders.map((p) => (
                  <div
                    key={p.id}
                    className="bg-[#181820] border border-[#262630] rounded-xl p-4 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-xs text-white">{p.name}</span>
                        <span className="text-[10px] text-[#22c55e] font-semibold">
                          +{p.percent_markup}%
                        </span>
                      </div>
                      <span className="text-[11px] text-[#71717a] font-mono truncate max-w-[200px] block">
                        {p.api_url}
                      </span>
                    </div>

                    <button
                      onClick={() => handleToggleSmmProvider(p.id)}
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                        p.enabled
                          ? 'bg-[#22c55e]/15 text-[#22c55e] border-[#22c55e]/30'
                          : 'bg-[#ef4444]/15 text-[#ef4444] border-[#ef4444]/30'
                      }`}
                    >
                      {p.enabled ? 'Active' : 'Disabled'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* SMM Categories Section */}
          {smmSubSection === 'categories' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              {smmCategories.map((c) => (
                <div
                  key={c.id}
                  className="bg-[#181820] border border-[#262630] rounded-xl p-3 flex items-center justify-between"
                >
                  <div>
                    <span className="font-bold text-xs text-white block">{c.name}</span>
                    <span className="text-[10px] text-[#71717a]">{c.platform || 'General'}</span>
                  </div>
                  <button
                    onClick={() => handleToggleSmmCategory(c.id)}
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                      c.enabled
                        ? 'bg-[#22c55e]/15 text-[#22c55e] border-[#22c55e]/30'
                        : 'bg-[#ef4444]/15 text-[#ef4444] border-[#ef4444]/30'
                    }`}
                  >
                    {c.enabled ? 'Visible' : 'Hidden'}
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* SMM Orders Section */}
          {smmSubSection === 'orders' && (
            <div className="bg-[#181820] border border-[#262630] rounded-2xl p-5 shadow-sm">
              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#121217] text-[#a1a1aa] border-b border-[#262630]">
                    <tr>
                      <th className="py-2.5 px-3">Order ID</th>
                      <th className="py-2.5 px-3">User ID</th>
                      <th className="py-2.5 px-3">Service</th>
                      <th className="py-2.5 px-3">Quantity</th>
                      <th className="py-2.5 px-3">Charge</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#262630]">
                    {smmOrders.map((o) => (
                      <tr key={o.id} className="hover:bg-[#121217]/50">
                        <td className="py-2 px-3 font-mono text-white">#{o.id}</td>
                        <td className="py-2 px-3 font-mono text-[#a1a1aa]">{o.user_id}</td>
                        <td className="py-2 px-3 text-white truncate max-w-[150px]">
                          {o.service_name || `Service #${o.service_id}`}
                        </td>
                        <td className="py-2 px-3">{o.quantity}</td>
                        <td className="py-2 px-3 font-bold text-[#22c55e]">₹{o.charge}</td>
                        <td className="py-2 px-3">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              o.status === 'completed'
                                ? 'bg-[#22c55e]/15 text-[#22c55e]'
                                : 'bg-[#f59e0b]/15 text-[#f59e0b]'
                            }`}
                          >
                            {o.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {smmOrders.length === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center py-6 text-[#71717a]">
                          No SMM orders recorded yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
