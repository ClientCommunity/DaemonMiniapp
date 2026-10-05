import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { downloadApi } from '../../api/endpoints';
import { Modal } from '../common/Modal';
import {
  CheckCircle2,
  Clock,
  XCircle,
  Copy,
  Check,
  Download
} from 'lucide-react';
import { PlatformIcon } from '../common/PlatformIcon';

export const ReceiptDrawer: React.FC = () => {
  const { selectedReceiptItem, closeReceiptDrawer, formatPrice, addToast } = useApp();

  const [copiedPhone, setCopiedPhone] = useState(false);
  const [copiedOtp, setCopiedOtp] = useState(false);
  const [copiedOrderId, setCopiedOrderId] = useState(false);

  if (!selectedReceiptItem) return null;

  const item = selectedReceiptItem;
  const isDeposit = item.amountInr > 0;
  const isSuccess = item.status === 'success';
  const isWaiting = item.status === 'waiting' || item.status === 'in_progress';
  const isRefunded = item.status === 'refunded' || item.status === 'cancelled';

  const handleCopy = (text: string, type: 'phone' | 'otp' | 'orderId') => {
    navigator.clipboard?.writeText(text);
    if (type === 'phone') {
      setCopiedPhone(true);
      setTimeout(() => setCopiedPhone(false), 2000);
    } else if (type === 'otp') {
      setCopiedOtp(true);
      setTimeout(() => setCopiedOtp(false), 2000);
    } else {
      setCopiedOrderId(true);
      setTimeout(() => setCopiedOrderId(false), 2000);
    }
    addToast('Copied to clipboard!', 'info');
  };

  const handleDownloadSession = () => {
    if (!item.sessionDownloadUrl) {
      addToast('No session file attached to this order.', 'warning');
      return;
    }
    const isZip = item.sessionDownloadUrl.includes('_zip') || item.sessionDownloadUrl.endsWith('.zip');
    const filename = isZip ? `bulk_sessions_${item.id}.zip` : `session_${item.id}.session`;
    downloadApi.triggerDownload(item.sessionDownloadUrl, filename);
    addToast('Downloading session file from secure server...', 'success', 'Saved');
  };

  return (
    <Modal
      isOpen={!!selectedReceiptItem}
      onClose={closeReceiptDrawer}
      title="Transaction Receipt"
      subtitle={`Ref: ${item.id}`}
      footer={
        <div className="flex flex-col gap-2">
          {item.sessionDownloadUrl && (
            <button
              onClick={handleDownloadSession}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#22c55e] hover:bg-[#16a34a] text-black font-extrabold text-xs shadow-green-glow transition-all active:scale-95"
            >
              <Download className="w-4 h-4" />
              <span>Download .Session File</span>
            </button>
          )}
          <button
            onClick={closeReceiptDrawer}
            className="w-full py-2.5 rounded-xl bg-[#1f1f2a] border border-[#262630] text-xs font-semibold text-white hover:bg-[#262630]"
          >
            Close Receipt
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-3.5">
        {/* Top Status & Amount Card */}
        <div className="p-4 rounded-2xl bg-[#0b0b0e] border border-[#262630] flex flex-col items-center text-center">
          <div className="w-12 h-12 rounded-full flex items-center justify-center mb-2 bg-[#181820]">
            {isSuccess && <CheckCircle2 className="w-6 h-6 text-[#22c55e]" />}
            {isWaiting && <Clock className="w-6 h-6 text-[#f59e0b] animate-spin" />}
            {isRefunded && <XCircle className="w-6 h-6 text-[#a1a1aa]" />}
          </div>

          <span className="text-2xl font-extrabold font-mono text-white">
            {isDeposit ? `+${formatPrice(item.amountInr)}` : formatPrice(item.amountInr)}
          </span>

          <span
            className={`text-xs px-2.5 py-0.5 rounded-full font-bold mt-2 uppercase border ${
              isSuccess
                ? 'bg-[#22c55e]/15 text-[#22c55e] border-[#22c55e]/30'
                : isWaiting
                ? 'bg-[#f59e0b]/15 text-[#f59e0b] border-[#f59e0b]/30'
                : 'bg-zinc-800 text-[#a1a1aa] border-zinc-700'
            }`}
          >
            {isRefunded ? 'Refunded' : isWaiting ? 'In Progress' : 'Completed'}
          </span>
        </div>

        {/* Detailed Metadata Grid */}
        <div className="p-3.5 bg-[#181820] border border-[#262630] rounded-2xl flex flex-col gap-2.5 text-xs">
          <div className="flex items-center justify-between pb-2 border-b border-[#262630]">
            <span className="text-[#a1a1aa]">Product / Service</span>
            <div className="flex items-center gap-1.5 justify-end">
              {['telegram', 'whatsapp', 'instagram', 'youtube', 'tiktok', 'twitter', 'google'].some(p => item.title.toLowerCase().includes(p)) && (
                <PlatformIcon
                  platform={
                    item.title.toLowerCase().includes('telegram')
                      ? 'tg'
                      : item.title.toLowerCase().includes('whatsapp')
                      ? 'wa'
                      : item.title.toLowerCase().includes('instagram')
                      ? 'ig'
                      : item.title.toLowerCase().includes('youtube')
                      ? 'yt'
                      : item.title.toLowerCase().includes('tiktok')
                      ? 'tk'
                      : item.title.toLowerCase().includes('twitter')
                      ? 'tw'
                      : 'go'
                  }
                  className="w-4 h-4 shrink-0"
                />
              )}
              <span className="font-bold text-white text-right max-w-[180px] truncate">
                {item.title}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between pb-2 border-b border-[#262630]">
            <span className="text-[#a1a1aa]">Order Reference ID</span>
            <div className="flex items-center gap-1.5 font-mono text-white">
              <span>{item.id}</span>
              <button
                onClick={() => handleCopy(item.id, 'orderId')}
                className="text-[#a1a1aa] hover:text-white"
              >
                {copiedOrderId ? <Check className="w-3.5 h-3.5 text-[#22c55e]" /> : <Copy className="w-3.5 h-3.5 text-[#8b5cf6]" />}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-between pb-2 border-b border-[#262630]">
            <span className="text-[#a1a1aa]">Timestamp</span>
            <span className="text-white font-medium">{item.date}</span>
          </div>

          {item.server && (
            <div className="flex items-center justify-between pb-2 border-b border-[#262630]">
              <span className="text-[#a1a1aa]">Server Origin</span>
              <span className="text-[#8b5cf6] font-semibold">{item.server}</span>
            </div>
          )}

          {item.phone && (
            <div className="flex items-center justify-between pb-2 border-b border-[#262630]">
              <span className="text-[#a1a1aa]">Phone Number</span>
              <div className="flex items-center gap-1.5 font-mono font-bold text-white">
                <span>{item.phone}</span>
                <button
                  onClick={() => handleCopy(item.phone!, 'phone')}
                  className="text-[#a1a1aa] hover:text-white"
                >
                  {copiedPhone ? <Check className="w-3.5 h-3.5 text-[#22c55e]" /> : <Copy className="w-3.5 h-3.5 text-[#8b5cf6]" />}
                </button>
              </div>
            </div>
          )}

          {item.otpCode && (
            <div className="flex items-center justify-between pb-2 border-b border-[#262630]">
              <span className="text-[#a1a1aa]">OTP Validation Code</span>
              <div className="flex items-center gap-1.5 font-mono font-extrabold text-[#22c55e]">
                <span>{item.otpCode}</span>
                <button
                  onClick={() => handleCopy(item.otpCode!, 'otp')}
                  className="text-[#a1a1aa] hover:text-white"
                >
                  {copiedOtp ? <Check className="w-3.5 h-3.5 text-[#22c55e]" /> : <Copy className="w-3.5 h-3.5 text-[#8b5cf6]" />}
                </button>
              </div>
            </div>
          )}

          {item.twoFa && (
            <div className="flex items-center justify-between pb-2 border-b border-[#262630]">
              <span className="text-[#a1a1aa]">2FA Password</span>
              <span className="font-mono text-white font-bold">{item.twoFa}</span>
            </div>
          )}

          {item.targetLink && (
            <div className="flex items-center justify-between pb-2 border-b border-[#262630]">
              <span className="text-[#a1a1aa]">Target Link</span>
              <span className="text-white font-mono truncate max-w-[180px]">{item.targetLink}</span>
            </div>
          )}

          {item.quantity && (
            <div className="flex items-center justify-between pb-2 border-b border-[#262630]">
              <span className="text-[#a1a1aa]">Quantity Delivered</span>
              <span className="text-white font-bold font-mono">{item.quantity.toLocaleString()}</span>
            </div>
          )}

          {item.utr && (
            <div className="flex items-center justify-between">
              <span className="text-[#a1a1aa]">Banking UTR Hash</span>
              <span className="text-white font-mono font-bold">{item.utr}</span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};
