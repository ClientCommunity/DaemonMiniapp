import React, { useEffect, useState, useCallback } from 'react';
import {
  adminApi,
  PendingDeposit,
  FampayGateway,
  CustomPayment,
} from '../../../api/adminApi';
import { useApp } from '../../../context/AppContext';
import {
  CreditCard,
  CheckCircle2,
  XCircle,
  Copy,
  Clock,
  Trash2,
  RefreshCw,
  QrCode,
  Sliders,
} from 'lucide-react';

export const PaymentsHubTab: React.FC = () => {
  const { addToast } = useApp();
  const [activeSection, setActiveSection] = useState<'pending' | 'fampay' | 'custom' | 'limits'>('pending');

  // ============================================================================
  // 1. PENDING DEPOSIT REVIEW QUEUE STATE
  // ============================================================================
  const [pendingDeposits, setPendingDeposits] = useState<PendingDeposit[]>([]);
  const [pendingLoading, setPendingLoading] = useState<boolean>(false);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [rejectModalOpen, setRejectModalOpen] = useState<boolean>(false);
  const [rejectingDeposit, setRejectingDeposit] = useState<PendingDeposit | null>(null);
  const [rejectReason, setRejectReason] = useState<string>('UTR verification failed / not credited');

  const loadPendingDeposits = useCallback(async () => {
    setPendingLoading(true);
    try {
      const res = await adminApi.getPendingDeposits();
      if (res?.success && res.deposits) {
        setPendingDeposits(res.deposits);
      }
    } catch {
      addToast('Failed to load pending deposit review queue', 'error');
    } finally {
      setPendingLoading(false);
    }
  }, [addToast]);

  const handleApproveDeposit = async (dep: PendingDeposit) => {
    if (!window.confirm(`Approve deposit of ₹${dep.amount} for User #${dep.user_id}? This will atomically credit their wallet.`)) return;
    setProcessingId(dep.deposit_id);
    try {
      const res = await adminApi.approveDeposit(dep.deposit_id, dep.amount);
      if (res?.success) {
        addToast(`✅ Deposit #${dep.deposit_id} approved and credited ₹${dep.amount}!`, 'success');
        setPendingDeposits((prev) => prev.filter((d) => d.deposit_id !== dep.deposit_id));
      } else {
        addToast(res?.message || 'Failed to approve deposit', 'error');
      }
    } catch {
      addToast('Error executing deposit approval', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  const handleOpenRejectModal = (dep: PendingDeposit) => {
    setRejectingDeposit(dep);
    setRejectReason('UTR verification failed / amount mismatch');
    setRejectModalOpen(true);
  };

  const handleConfirmReject = async () => {
    if (!rejectingDeposit) return;
    setProcessingId(rejectingDeposit.deposit_id);
    try {
      const res = await adminApi.rejectDeposit(rejectingDeposit.deposit_id, rejectReason.trim());
      if (res?.success) {
        addToast(`❌ Deposit #${rejectingDeposit.deposit_id} rejected.`, 'info');
        setPendingDeposits((prev) => prev.filter((d) => d.deposit_id !== rejectingDeposit.deposit_id));
        setRejectModalOpen(false);
        setRejectingDeposit(null);
      } else {
        addToast(res?.message || 'Failed to reject deposit', 'error');
      }
    } catch {
      addToast('Error rejecting deposit', 'error');
    } finally {
      setProcessingId(null);
    }
  };

  // ============================================================================
  // 2. FAMPAY GATEWAYS STATE
  // ============================================================================
  const [fampayGateways, setFampayGateways] = useState<FampayGateway[]>([]);
  const [newFpName, setNewFpName] = useState('');
  const [newFpUpi, setNewFpUpi] = useState('');
  const [newFpPayName, setNewFpPayName] = useState('');
  const [newFpMin, setNewFpMin] = useState('10');
  const [newFpMax, setNewFpMax] = useState('10000');
  const [newFpGmail, setNewFpGmail] = useState('');
  const [newFpAppPass, setNewFpAppPass] = useState('');

  const loadFampayGateways = useCallback(async () => {
    try {
      const res = await adminApi.getFampayGateways();
      if (res?.success && res.gateways) {
        setFampayGateways(res.gateways);
      }
    } catch {
      addToast('Failed to load FamPay gateways', 'error');
    }
  }, [addToast]);

  const handleToggleFampay = async (id: number) => {
    try {
      const res = await adminApi.toggleFampayGateway(id);
      if (res?.success) {
        setFampayGateways((prev) =>
          prev.map((g) => (g.id === id ? { ...g, enabled: res.enabled ? 1 : 0 } : g))
        );
        addToast(`Gateway ${res.enabled ? 'Enabled' : 'Disabled'}`, 'success');
      }
    } catch {
      addToast('Failed to toggle FamPay gateway', 'error');
    }
  };

  const handleDeleteFampay = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this FamPay gateway?')) return;
    try {
      const res = await adminApi.deleteFampayGateway(id);
      if (res?.success) {
        setFampayGateways((prev) => prev.filter((g) => g.id !== id));
        addToast('FamPay gateway deleted', 'success');
      }
    } catch {
      addToast('Failed to delete FamPay gateway', 'error');
    }
  };

  const handleCreateFampay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFpName || !newFpUpi) {
      addToast('Gateway Name and UPI ID are required', 'error');
      return;
    }
    try {
      const res = await adminApi.createFampayGateway({
        name: newFpName.trim(),
        upi_id: newFpUpi.trim(),
        payment_name: newFpPayName.trim() || newFpName.trim(),
        min_deposit: parseFloat(newFpMin) || 10,
        max_deposit: parseFloat(newFpMax) || 10000,
        gmail: newFpGmail.trim() || undefined,
        app_password: newFpAppPass.trim() || undefined,
      });
      if (res?.success) {
        addToast(`FamPay Gateway "${newFpName}" created`, 'success');
        setNewFpName('');
        setNewFpUpi('');
        setNewFpPayName('');
        setNewFpGmail('');
        setNewFpAppPass('');
        loadFampayGateways();
      }
    } catch {
      addToast('Failed to create FamPay gateway', 'error');
    }
  };

  // ============================================================================
  // 3. CUSTOM PAYMENTS STATE
  // ============================================================================
  const [customPayments, setCustomPayments] = useState<CustomPayment[]>([]);
  const [newCpName, setNewCpName] = useState('');
  const [newCpCaption, setNewCpCaption] = useState('');
  const [newCpQr, setNewCpQr] = useState('');

  const loadCustomPayments = useCallback(async () => {
    try {
      const res = await adminApi.getCustomPayments();
      if (res?.success && res.payments) {
        setCustomPayments(res.payments);
      }
    } catch {
      addToast('Failed to load custom payment gateways', 'error');
    }
  }, [addToast]);

  const handleToggleCustomPayment = async (id: number) => {
    try {
      const res = await adminApi.toggleCustomPayment(id);
      if (res?.success) {
        setCustomPayments((prev) =>
          prev.map((p) => (p.id === id ? { ...p, enabled: p.enabled ? 0 : 1 } : p))
        );
        addToast('Custom payment status updated', 'success');
      }
    } catch {
      addToast('Failed to toggle custom payment', 'error');
    }
  };

  const handleDeleteCustomPayment = async (id: number) => {
    if (!window.confirm('Are you sure you want to delete this custom payment method?')) return;
    try {
      const res = await adminApi.deleteCustomPayment(id);
      if (res?.success) {
        setCustomPayments((prev) => prev.filter((p) => p.id !== id));
        addToast('Custom payment removed', 'success');
      }
    } catch {
      addToast('Failed to delete custom payment', 'error');
    }
  };

  const handleCreateCustomPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCpName.trim()) {
      addToast('Payment name is required', 'error');
      return;
    }
    try {
      const res = await adminApi.createCustomPayment({
        name: newCpName.trim(),
        caption: newCpCaption.trim(),
        qr_file_id: newCpQr.trim() || undefined,
      });
      if (res?.success) {
        addToast(`Custom payment "${newCpName}" created`, 'success');
        setNewCpName('');
        setNewCpCaption('');
        setNewCpQr('');
        loadCustomPayments();
      }
    } catch {
      addToast('Failed to create custom payment', 'error');
    }
  };

  // ============================================================================
  // 4. MINIMUM DEPOSIT THRESHOLDS STATE
  // ============================================================================
  const [minDeposit, setMinDeposit] = useState('50');
  const [minUpiDep, setMinUpiDep] = useState('50');
  const [minCwDep, setMinCwDep] = useState('50');
  const [fampayMinDep, setFampayMinDep] = useState('10');

  const loadMinDepositSettings = useCallback(async () => {
    try {
      const res = await adminApi.getMinDepositSettings();
      if (res?.success) {
        if (res.min_deposit !== undefined) setMinDeposit(String(res.min_deposit));
        if (res.min_upi_dep !== undefined) setMinUpiDep(String(res.min_upi_dep));
        if (res.min_cw_dep !== undefined) setMinCwDep(String(res.min_cw_dep));
        if (res.fampay_min_dep !== undefined) setFampayMinDep(String(res.fampay_min_dep));
      }
    } catch {
      addToast('Failed to load minimum deposit settings', 'error');
    }
  }, [addToast]);

  const handleSaveMinDepositSettings = async () => {
    try {
      const res = await adminApi.updateMinDepositSettings({
        min_deposit: parseFloat(minDeposit) || 50,
        min_upi_dep: parseFloat(minUpiDep) || 50,
        min_cw_dep: parseFloat(minCwDep) || 50,
        fampay_min_dep: parseFloat(fampayMinDep) || 10,
      });
      if (res?.success) {
        addToast('Deposit thresholds saved successfully', 'success');
      }
    } catch {
      addToast('Failed to update minimum deposit settings', 'error');
    }
  };

  // Load section data
  useEffect(() => {
    if (activeSection === 'pending') loadPendingDeposits();
    if (activeSection === 'fampay') loadFampayGateways();
    if (activeSection === 'custom') loadCustomPayments();
    if (activeSection === 'limits') loadMinDepositSettings();
  }, [activeSection, loadPendingDeposits, loadFampayGateways, loadCustomPayments, loadMinDepositSettings]);

  const handleCopy = (text: string, label: string) => {
    navigator.clipboard?.writeText(text);
    addToast(`${label} copied to clipboard!`, 'info', 'Copied');
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Sub-navigation Pills */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar p-1.5 bg-[#181820] border border-[#262630] rounded-2xl">
        <button
          onClick={() => setActiveSection('pending')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            activeSection === 'pending'
              ? 'bg-[#7c3aed] text-white shadow-md'
              : 'text-[#a1a1aa] hover:text-white hover:bg-[#20202a]'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Manual UTR Review</span>
          {pendingDeposits.length > 0 && (
            <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-[#f59e0b] text-black font-bold">
              {pendingDeposits.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveSection('fampay')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            activeSection === 'fampay'
              ? 'bg-[#7c3aed] text-white shadow-md'
              : 'text-[#a1a1aa] hover:text-white hover:bg-[#20202a]'
          }`}
        >
          <CreditCard className="w-3.5 h-3.5" />
          <span>FamPay Gateways</span>
        </button>

        <button
          onClick={() => setActiveSection('custom')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            activeSection === 'custom'
              ? 'bg-[#7c3aed] text-white shadow-md'
              : 'text-[#a1a1aa] hover:text-white hover:bg-[#20202a]'
          }`}
        >
          <QrCode className="w-3.5 h-3.5" />
          <span>Custom Payments (Cwallet)</span>
        </button>

        <button
          onClick={() => setActiveSection('limits')}
          className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            activeSection === 'limits'
              ? 'bg-[#7c3aed] text-white shadow-md'
              : 'text-[#a1a1aa] hover:text-white hover:bg-[#20202a]'
          }`}
        >
          <Sliders className="w-3.5 h-3.5" />
          <span>Deposit Limits</span>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* SECTION 1: MANUAL DEPOSIT REVIEW QUEUE */}
      {/* ===================================================================== */}
      {activeSection === 'pending' && (
        <div className="space-y-4 animate-in fade-in duration-150">
          <div className="flex items-center justify-between bg-[#181820] border border-[#262630] rounded-2xl p-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white tracking-tight">
                  Pending Manual Deposits Review Queue
                </h3>
                <span className="text-xs px-2 py-0.5 rounded-full bg-[#f59e0b]/20 text-[#f59e0b] font-bold">
                  {pendingDeposits.length} Pending
                </span>
              </div>
              <p className="text-xs text-[#a1a1aa]">
                Review 12-digit UPI UTR references. 1-click approval atomically credits user wallet balance.
              </p>
            </div>

            <button
              onClick={loadPendingDeposits}
              className="p-2 rounded-xl bg-[#121217] border border-[#262630] text-[#a1a1aa] hover:text-white"
            >
              <RefreshCw className={`w-4 h-4 ${pendingLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* Pending Queue List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingDeposits.map((dep) => (
              <div
                key={dep.deposit_id}
                className="bg-[#181820] border border-[#262630] rounded-2xl p-4 shadow-sm space-y-3 hover:border-[#3b3b4a] transition-all"
              >
                {/* Header: User & Amount */}
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[11px] font-mono text-[#8b5cf6] block">
                      Order #{dep.deposit_id} • User #{dep.user_id}
                    </span>
                    <h4 className="text-sm font-bold text-white">
                      @{dep.username || `user_${dep.user_id}`}
                    </h4>
                    <span className="text-[10px] text-[#71717a]">
                      Submitted: {dep.created_at || 'Just now'}
                    </span>
                  </div>

                  <div className="text-right">
                    <span className="text-xl font-bold text-[#22c55e] block">
                      ₹{dep.amount}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-[#f59e0b]/15 text-[#f59e0b] border border-[#f59e0b]/30 font-semibold">
                      Pending UTR
                    </span>
                  </div>
                </div>

                {/* UTR Box with 1-Click Copy */}
                <div className="bg-[#121217] border border-[#262630] rounded-xl p-3 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] text-[#71717a] block font-semibold uppercase">
                      12-Digit Reference / UTR
                    </span>
                    <span className="font-mono text-sm font-bold text-[#f59e0b] tracking-wider">
                      {dep.utr || 'N/A'}
                    </span>
                  </div>

                  {dep.utr && (
                    <button
                      onClick={() => handleCopy(dep.utr, 'UTR')}
                      className="p-1.5 rounded-lg bg-[#181820] hover:bg-[#22222d] text-[#a1a1aa] hover:text-white transition-colors"
                      title="Copy UTR"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  )}
                </div>

                {/* Notes if available */}
                {dep.notes && (
                  <p className="text-[11px] text-[#a1a1aa] bg-[#121217] px-3 py-1.5 rounded-lg">
                    {dep.notes}
                  </p>
                )}

                {/* Action Buttons: 1-Click Approve vs Reject */}
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    onClick={() => handleApproveDeposit(dep)}
                    disabled={processingId === dep.deposit_id}
                    className="flex items-center justify-center gap-1.5 bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold py-2 rounded-xl text-xs transition-all shadow-md active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Approve (Credit ₹{dep.amount})</span>
                  </button>

                  <button
                    onClick={() => handleOpenRejectModal(dep)}
                    disabled={processingId === dep.deposit_id}
                    className="flex items-center justify-center gap-1.5 bg-[#ef4444]/15 hover:bg-[#ef4444]/25 text-[#ef4444] font-semibold py-2 rounded-xl text-xs transition-all border border-[#ef4444]/30 active:scale-95 cursor-pointer disabled:opacity-50"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Reject</span>
                  </button>
                </div>
              </div>
            ))}

            {pendingDeposits.length === 0 && (
              <div className="col-span-full bg-[#181820] border border-[#262630] rounded-2xl p-10 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-[#22c55e] mx-auto opacity-75" />
                <h4 className="text-sm font-bold text-white">Review Queue is Clear!</h4>
                <p className="text-xs text-[#71717a]">
                  There are no pending manual deposit requests awaiting administrator review.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SECTION 2: FAMPAY GATEWAYS */}
      {/* ===================================================================== */}
      {activeSection === 'fampay' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          {/* Create FamPay Gateway */}
          <form
            onSubmit={handleCreateFampay}
            className="bg-[#181820] border border-[#262630] rounded-2xl p-5 shadow-sm space-y-3"
          >
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Add FamPay Instant QR Gateway
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="Gateway Name (e.g. FamPay Primary)"
                value={newFpName}
                onChange={(e) => setNewFpName(e.target.value)}
                required
                className="bg-[#121217] border border-[#262630] rounded-xl px-3 py-2 text-xs text-white outline-none"
              />
              <input
                type="text"
                placeholder="UPI ID (e.g. user@fam)"
                value={newFpUpi}
                onChange={(e) => setNewFpUpi(e.target.value)}
                required
                className="bg-[#121217] border border-[#262630] rounded-xl px-3 py-2 text-xs text-white outline-none"
              />
              <input
                type="text"
                placeholder="Display Name (e.g. Krish Store)"
                value={newFpPayName}
                onChange={(e) => setNewFpPayName(e.target.value)}
                className="bg-[#121217] border border-[#262630] rounded-xl px-3 py-2 text-xs text-white outline-none"
              />
              <input
                type="number"
                placeholder="Min Deposit (₹)"
                value={newFpMin}
                onChange={(e) => setNewFpMin(e.target.value)}
                className="bg-[#121217] border border-[#262630] rounded-xl px-3 py-2 text-xs text-white outline-none"
              />
              <input
                type="number"
                placeholder="Max Deposit (₹)"
                value={newFpMax}
                onChange={(e) => setNewFpMax(e.target.value)}
                className="bg-[#121217] border border-[#262630] rounded-xl px-3 py-2 text-xs text-white outline-none"
              />
              <input
                type="email"
                placeholder="IMAP Gmail (Optional for Auto-verify)"
                value={newFpGmail}
                onChange={(e) => setNewFpGmail(e.target.value)}
                className="bg-[#121217] border border-[#262630] rounded-xl px-3 py-2 text-xs text-white outline-none"
              />
              <input
                type="password"
                placeholder="Gmail 16-char App Password (Optional)"
                value={newFpAppPass}
                onChange={(e) => setNewFpAppPass(e.target.value)}
                className="bg-[#121217] border border-[#262630] rounded-xl px-3 py-2 text-xs text-white outline-none font-mono"
              />
            </div>
            <button
              type="submit"
              className="bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-sm"
            >
              Save Gateway
            </button>
          </form>

          {/* Gateways List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {fampayGateways.map((g) => (
              <div
                key={g.id}
                className="bg-[#181820] border border-[#262630] rounded-2xl p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-white">{g.name}</h4>
                    <span className="font-mono text-xs text-[#8b5cf6]">{g.upi_id}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleFampay(g.id)}
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                        g.enabled
                          ? 'bg-[#22c55e]/15 text-[#22c55e] border-[#22c55e]/30'
                          : 'bg-[#ef4444]/15 text-[#ef4444] border-[#ef4444]/30'
                      }`}
                    >
                      {g.enabled ? 'Active' : 'Disabled'}
                    </button>
                    <button
                      onClick={() => handleDeleteFampay(g.id)}
                      className="text-[#ef4444] p-1 hover:bg-[#ef4444]/10 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-[11px] bg-[#121217] p-2.5 rounded-xl border border-[#262630]">
                  <div>
                    <span className="text-[#71717a] block">Min Deposit</span>
                    <span className="font-bold text-white">₹{g.min_deposit}</span>
                  </div>
                  <div>
                    <span className="text-[#71717a] block">Max Deposit</span>
                    <span className="font-bold text-white">₹{g.max_deposit}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SECTION 3: CUSTOM PAYMENTS (CWALLET / DIRECT QR) */}
      {/* ===================================================================== */}
      {activeSection === 'custom' && (
        <div className="space-y-5 animate-in fade-in duration-150">
          <form
            onSubmit={handleCreateCustomPayment}
            className="bg-[#181820] border border-[#262630] rounded-2xl p-5 shadow-sm space-y-3"
          >
            <h4 className="text-xs font-bold text-white uppercase tracking-wider">
              Add Custom Payment Method
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="Payment Name (e.g. Cwallet ID / Binance Pay)"
                value={newCpName}
                onChange={(e) => setNewCpName(e.target.value)}
                required
                className="bg-[#121217] border border-[#262630] rounded-xl px-3 py-2 text-xs text-white outline-none"
              />
              <input
                type="text"
                placeholder="Custom Instructions / Caption"
                value={newCpCaption}
                onChange={(e) => setNewCpCaption(e.target.value)}
                className="bg-[#121217] border border-[#262630] rounded-xl px-3 py-2 text-xs text-white outline-none"
              />
              <input
                type="text"
                placeholder="QR Image File ID or URL"
                value={newCpQr}
                onChange={(e) => setNewCpQr(e.target.value)}
                className="bg-[#121217] border border-[#262630] rounded-xl px-3 py-2 text-xs text-white outline-none"
              />
            </div>
            <button
              type="submit"
              className="bg-[#22c55e] hover:bg-[#16a34a] text-black font-bold px-4 py-2 rounded-xl text-xs transition-all shadow-sm"
            >
              Create Payment Gateway
            </button>
          </form>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {customPayments.map((p) => (
              <div
                key={p.id}
                className="bg-[#181820] border border-[#262630] rounded-2xl p-4 flex items-center justify-between"
              >
                <div>
                  <h4 className="text-sm font-bold text-white">{p.name}</h4>
                  <p className="text-xs text-[#a1a1aa] mt-0.5">{p.caption || 'No caption set'}</p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleCustomPayment(p.id)}
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                      p.enabled
                        ? 'bg-[#22c55e]/15 text-[#22c55e] border-[#22c55e]/30'
                        : 'bg-[#ef4444]/15 text-[#ef4444] border-[#ef4444]/30'
                    }`}
                  >
                    {p.enabled ? 'Active' : 'Disabled'}
                  </button>
                  <button
                    onClick={() => handleDeleteCustomPayment(p.id)}
                    className="text-[#ef4444] p-1 hover:bg-[#ef4444]/10 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SECTION 4: DEPOSIT LIMITS & THRESHOLDS */}
      {/* ===================================================================== */}
      {activeSection === 'limits' && (
        <div className="bg-[#181820] border border-[#262630] rounded-2xl p-5 shadow-sm space-y-5 animate-in fade-in duration-150">
          <div>
            <h3 className="text-sm font-bold text-white tracking-tight">
              Minimum Deposit Threshold Settings
            </h3>
            <p className="text-xs text-[#a1a1aa]">
              Configure minimum invoice requirements enforced during checkout across all deposit methods.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-[#121217] border border-[#262630] rounded-xl p-4">
              <label className="text-xs font-semibold text-[#a1a1aa] block mb-1.5">
                Global Minimum Deposit (min_deposit)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[#22c55e]">₹</span>
                <input
                  type="number"
                  value={minDeposit}
                  onChange={(e) => setMinDeposit(e.target.value)}
                  className="flex-1 bg-[#181820] border border-[#262630] rounded-lg px-3 py-1.5 text-sm font-bold text-white outline-none"
                />
              </div>
            </div>

            <div className="bg-[#121217] border border-[#262630] rounded-xl p-4">
              <label className="text-xs font-semibold text-[#a1a1aa] block mb-1.5">
                UPI Direct Minimum (min_upi_dep)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[#22c55e]">₹</span>
                <input
                  type="number"
                  value={minUpiDep}
                  onChange={(e) => setMinUpiDep(e.target.value)}
                  className="flex-1 bg-[#181820] border border-[#262630] rounded-lg px-3 py-1.5 text-sm font-bold text-white outline-none"
                />
              </div>
            </div>

            <div className="bg-[#121217] border border-[#262630] rounded-xl p-4">
              <label className="text-xs font-semibold text-[#a1a1aa] block mb-1.5">
                Cwallet Minimum (min_cw_dep)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[#22c55e]">₹</span>
                <input
                  type="number"
                  value={minCwDep}
                  onChange={(e) => setMinCwDep(e.target.value)}
                  className="flex-1 bg-[#181820] border border-[#262630] rounded-lg px-3 py-1.5 text-sm font-bold text-white outline-none"
                />
              </div>
            </div>

            <div className="bg-[#121217] border border-[#262630] rounded-xl p-4">
              <label className="text-xs font-semibold text-[#a1a1aa] block mb-1.5">
                FamPay Minimum (fampay_min_dep)
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[#22c55e]">₹</span>
                <input
                  type="number"
                  value={fampayMinDep}
                  onChange={(e) => setFampayMinDep(e.target.value)}
                  className="flex-1 bg-[#181820] border border-[#262630] rounded-lg px-3 py-1.5 text-sm font-bold text-white outline-none"
                />
              </div>
            </div>
          </div>

          <button
            onClick={handleSaveMinDepositSettings}
            className="bg-[#7c3aed] hover:bg-[#6d28d9] text-white font-bold px-6 py-2.5 rounded-xl text-xs transition-all shadow-md cursor-pointer"
          >
            Save Minimum Deposit Limits
          </button>
        </div>
      )}

      {/* Reject Modal */}
      {rejectModalOpen && rejectingDeposit && (
        <div className="fixed inset-0 z-50 bg-[#0b0b0e]/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#181820] border border-[#262630] rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#ef4444]/15 border border-[#ef4444]/30 flex items-center justify-center text-[#ef4444]">
                <XCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Reject Deposit #{rejectingDeposit.deposit_id}</h3>
                <span className="text-xs text-[#a1a1aa]">₹{rejectingDeposit.amount} from User #{rejectingDeposit.user_id}</span>
              </div>
            </div>

            <div>
              <label className="text-[11px] font-semibold text-[#a1a1aa] block mb-1">
                Rejection Reason (will be logged in database):
              </label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                className="w-full bg-[#121217] border border-[#262630] rounded-xl p-2.5 text-xs text-white outline-none"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setRejectModalOpen(false)}
                className="flex-1 bg-[#121217] hover:bg-[#20202a] text-[#a1a1aa] font-semibold py-2 rounded-xl text-xs"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmReject}
                className="flex-1 bg-[#ef4444] hover:bg-[#dc2626] text-white font-bold py-2 rounded-xl text-xs shadow-md"
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
