import React, { useState } from 'react';
import {
  Menu,
  X,
  ArrowRight,
  ExternalLink,
} from 'lucide-react';

interface LandingHeaderProps {
  onOpenSignIn?: () => void;
  onOpenRegister?: () => void;
  onOpenAuth?: (mode?: 'signin' | 'register') => void;
  onOpenTerms?: () => void;
}

export const LandingHeader: React.FC<LandingHeaderProps> = ({
  onOpenSignIn,
  onOpenRegister,
  onOpenAuth,
  onOpenTerms: _onOpenTerms,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignIn = () => {
    if (onOpenSignIn) onOpenSignIn();
    else if (onOpenAuth) onOpenAuth('signin');
  };

  const handleRegister = () => {
    if (onOpenRegister) onOpenRegister();
    else if (onOpenAuth) onOpenAuth('register');
  };

  const navLinks = [
    { label: 'Live Sandbox', href: '#sandbox' },
    { label: 'How It Works', href: '#how-it-works' },
    { label: 'Live Rates', href: '#rates' },
    { label: 'Servers', href: '#infrastructure' },
    { label: 'FAQ', href: '#faq' },
  ];

  return (
    <header
      className="sticky top-0 z-40 backdrop-blur-md border-b transition-all"
      style={{
        backgroundColor: 'rgba(250, 248, 255, 0.88)',
        borderColor: '#E5DCF4',
      }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand Logo & Title */}
        <a href="#" className="flex items-center gap-2.5 group">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-white text-base shadow-sm group-hover:scale-105 transition-transform"
            style={{
              backgroundColor: '#6D28D9',
              boxShadow: '0 2px 8px rgba(109, 40, 217, 0.3)',
            }}
          >
            D
          </div>
          <div className="flex flex-col">
            <span
              className="text-base font-black tracking-tight leading-none group-hover:text-purple-900 transition-colors"
              style={{ color: '#211536' }}
            >
              Daemon OTP
            </span>
            <span className="text-[10px] font-medium" style={{ color: '#74638B' }}>
              Virtual Numbers &amp; Sessions
            </span>
          </div>
        </a>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex items-center gap-6">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-xs font-semibold hover:text-[#6D28D9] transition-colors"
              style={{ color: '#514364' }}
            >
              {link.label}
            </a>
          ))}
          <a
            href="https://t.me/DeamonOTPbot"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-[#6D28D9] hover:underline flex items-center gap-1"
          >
            <span>@DeamonOTPbot</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </nav>

        {/* Action CTAs */}
        <div className="hidden sm:flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleSignIn}
            className="min-h-[38px] px-4 py-2 rounded-xl text-xs font-semibold border transition-all cursor-pointer hover:bg-violet-50"
            style={{
              backgroundColor: '#FFFFFF',
              borderColor: '#E5DCF4',
              color: '#542C85',
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={handleRegister}
            className="min-h-[38px] px-4 py-2 rounded-xl text-xs font-bold text-white flex items-center gap-1.5 transition-all shadow-sm hover:opacity-95 active:scale-95 cursor-pointer"
            style={{
              backgroundColor: '#6D28D9',
              boxShadow: '0 2px 8px rgba(109, 40, 217, 0.25)',
            }}
          >
            <span>Get Started</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Mobile Hamburger Toggle */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-2 rounded-xl text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 transition-colors"
          aria-label="Toggle menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div
          className="md:hidden border-b px-4 py-4 space-y-3 bg-[#FAF8FF]"
          style={{ borderColor: '#E5DCF4' }}
        >
          <div className="flex flex-col space-y-2">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg text-xs font-semibold hover:bg-violet-50 transition-colors"
                style={{ color: '#211536' }}
              >
                {link.label}
              </a>
            ))}
            <a
              href="https://t.me/DeamonOTPbot"
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-2 rounded-lg text-xs font-semibold text-[#6D28D9] flex items-center gap-1"
            >
              <span>Telegram Bot: @DeamonOTPbot</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="pt-2 border-t flex items-center gap-2" style={{ borderColor: '#E5DCF4' }}>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                handleSignIn();
              }}
              className="flex-1 py-2.5 rounded-xl text-xs font-semibold border text-center"
              style={{
                backgroundColor: '#FFFFFF',
                borderColor: '#E5DCF4',
                color: '#542C85',
              }}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                handleRegister();
              }}
              className="flex-1 py-2.5 rounded-xl text-xs font-bold text-white text-center shadow-sm"
              style={{ backgroundColor: '#6D28D9' }}
            >
              Get Started
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
