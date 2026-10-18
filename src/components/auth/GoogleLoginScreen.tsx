import React, { useEffect, useRef, useState } from 'react';
import { authApi, GoogleAuthResponse } from '../../api/endpoints';
import { setWebUserToken } from '../../api/client';
import { BackendUserPayload } from '../../api/adapters';
import {
  ShieldCheck,
  Zap,
  Globe,
  Lock,
  Sparkles,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';

const GOOGLE_CLIENT_ID =
  (import.meta as unknown as { env?: Record<string, string | undefined> })?.env
    ?.VITE_GOOGLE_CLIENT_ID ||
  '844840577527-7qf3v11h62n199csg65dv9s0umbqethh.apps.googleusercontent.com';

interface GoogleLoginScreenProps {
  onLoginSuccess: (token: string, user: BackendUserPayload) => void;
}

export const GoogleLoginScreen: React.FC<GoogleLoginScreenProps> = ({ onLoginSuccess }) => {
  const googleBtnRef = useRef<HTMLDivElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCredentialResponse = async (response: { credential?: string }) => {
    if (!response.credential) {
      setErrorMessage('Google authentication did not provide a valid credential.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res: GoogleAuthResponse = await authApi.loginWithGoogle(response.credential);
      if (res.success && res.token && res.user) {
        setWebUserToken(res.token);
        onLoginSuccess(res.token, res.user);
      } else {
        setErrorMessage(res.error || 'Failed to authenticate with Google. Please try again.');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Network connection failed';
      setErrorMessage(`Authentication error: ${msg}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let checkInterval: ReturnType<typeof setInterval> | null = null;

    const initGoogleGsi = () => {
      const google = (window as unknown as {
        google?: {
          accounts?: {
            id?: {
              initialize: (config: Record<string, unknown>) => void;
              renderButton: (element: HTMLElement, options: Record<string, unknown>) => void;
              prompt: () => void;
            };
          };
        };
      })?.google;

      if (google?.accounts?.id && googleBtnRef.current) {
        google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: handleCredentialResponse,
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        google.accounts.id.renderButton(googleBtnRef.current, {
          theme: 'filled_black',
          size: 'large',
          text: 'signin_with',
          shape: 'pill',
          width: 280,
          logo_alignment: 'left',
        });

        if (checkInterval) {
          clearInterval(checkInterval);
          checkInterval = null;
        }
      }
    };

    initGoogleGsi();

    // Poll until Google GSI library is loaded asynchronously
    checkInterval = setInterval(() => {
      const google = (window as unknown as { google?: { accounts?: { id?: unknown } } })?.google;
      if (google?.accounts?.id && googleBtnRef.current) {
        initGoogleGsi();
      }
    }, 300);

    return () => {
      if (checkInterval) clearInterval(checkInterval);
    };
  }, []);

  return (
    <div className="relative w-full max-w-[430px] mx-auto min-h-screen bg-[#0b0b0e] text-white flex flex-col justify-between px-6 py-8 border-x border-[#181820]/40 shadow-2xl">
      {/* Background Ambient Glows */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-72 h-72 bg-[#7c3aed]/15 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-0 w-64 h-64 bg-[#3b82f6]/10 rounded-full blur-[90px] pointer-events-none" />

      {/* Top Header & Branding */}
      <div className="relative z-10 flex flex-col items-center text-center mt-6">
        <div className="relative mb-4">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-[#7c3aed] to-[#3b82f6] p-0.5 shadow-xl shadow-[#7c3aed]/25 flex items-center justify-center">
            <div className="w-full h-full bg-[#121217] rounded-[22px] flex items-center justify-center">
              <Zap className="w-10 h-10 text-[#a78bfa] fill-[#7c3aed]/30" />
            </div>
          </div>
          <div className="absolute -bottom-1 -right-1 bg-[#22c55e] text-[9px] font-bold text-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md">
            <Sparkles className="w-2.5 h-2.5" />
            <span>WEB</span>
          </div>
        </div>

        <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
          <span>Krish OTP Store</span>
        </h1>
        <p className="text-xs text-[#a1a1aa] mt-1.5 max-w-[280px]">
          Virtual OTP Numbers, Premium Telegram Sessions &amp; Social Media Services
        </p>
      </div>

      {/* Center Value Features */}
      <div className="relative z-10 my-8 space-y-3">
        <div className="p-3.5 rounded-2xl bg-[#181820]/80 border border-[#262630] flex items-center gap-3 backdrop-blur-md">
          <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-purple-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xs font-bold text-white">Instant OTP Activations</h3>
            <p className="text-[10px] text-[#a1a1aa]">Real-time carrier SMS for 500+ global apps</p>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#181820]/80 border border-[#262630] flex items-center gap-3 backdrop-blur-md">
          <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center shrink-0">
            <ShieldCheck className="w-4 h-4 text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xs font-bold text-white">Aged Telegram Sessions</h3>
            <p className="text-[10px] text-[#a1a1aa]">2FA protected, clean history, instant download</p>
          </div>
        </div>

        <div className="p-3.5 rounded-2xl bg-[#181820]/80 border border-[#262630] flex items-center gap-3 backdrop-blur-md">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center shrink-0">
            <Globe className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-xs font-bold text-white">Flexible Wallet Currencies</h3>
            <p className="text-[10px] text-[#a1a1aa]">Supports INR &amp; USDT with instant UPI &amp; crypto</p>
          </div>
        </div>
      </div>

      {/* Bottom Auth Actions */}
      <div className="relative z-10 flex flex-col items-center">
        {errorMessage && (
          <div className="w-full mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div className="flex-1">
              <span className="font-semibold">Login Failed: </span>
              <span>{errorMessage}</span>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="w-full py-4 flex flex-col items-center justify-center gap-2 rounded-2xl bg-[#181820] border border-[#262630]">
            <div className="w-6 h-6 border-2 border-[#7c3aed] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-[#a1a1aa] font-medium">Verifying Google Account...</span>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center gap-3">
            <div className="text-[11px] text-[#a1a1aa] flex items-center gap-1.5 uppercase font-semibold tracking-wider mb-1">
              <Lock className="w-3 h-3 text-[#22c55e]" />
              <span>Sign In to Continue</span>
            </div>

            {/* Google Identity Services Render Target */}
            <div
              ref={googleBtnRef}
              className="w-full flex justify-center min-h-[44px]"
            />
          </div>
        )}

        {/* Telegram Alternative Link */}
        <div className="mt-6 pt-5 border-t border-[#181820] w-full text-center">
          <p className="text-[11px] text-[#71717a]">
            Prefer using Telegram directly?
          </p>
          <a
            href="https://t.me/DeamonOTPbot"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[#8b5cf6] hover:text-[#a78bfa] transition-colors"
          >
            <span>Launch @DeamonOTPbot</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        <p className="text-[9px] text-[#52525b] mt-4 flex items-center gap-1">
          <ShieldCheck className="w-2.5 h-2.5 text-[#22c55e]" />
          <span>OAuth 2.0 Secure Authentication</span>
        </p>
      </div>
    </div>
  );
};
