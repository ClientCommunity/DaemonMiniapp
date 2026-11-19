import React, { useState, useEffect, useCallback } from 'react';
import { LandingPageProps, ServiceItem } from './types';
import { LandingHeader } from './sections/LandingHeader';
import { HeroSection } from './sections/HeroSection';
import { PaymentStrip } from './sections/PaymentStrip';
import { HowItWorksSection } from './sections/HowItWorksSection';
import { RatesTerminalSection } from './sections/RatesTerminalSection';
import { InfrastructureSection } from './sections/InfrastructureSection';
import { FaqSection } from './sections/FaqSection';
import { CallToActionSection } from './sections/CallToActionSection';
import { LandingFooter } from './sections/LandingFooter';

// Modals
import { AuthModal } from './modals/AuthModal';
import { LegalTermsModal } from './modals/LegalTermsModal';
import { OtpVerificationModal } from '../auth/OtpVerificationModal';
import { ForgotPasswordModal } from '../auth/ForgotPasswordModal';
import { ResetPasswordModal } from '../auth/ResetPasswordModal';

import { authApi } from '../../api/endpoints';
import { setWebUserToken } from '../../api/client';

export const LandingPage: React.FC<LandingPageProps> = ({ onLoginSuccess }) => {
  // Modal states
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [authModalMode, setAuthModalMode] = useState<'signin' | 'register'>('signin');
  const [isTermsModalOpen, setIsTermsModalOpen] = useState<boolean>(false);

  // Auth sub-modals (OTP, Forgot Password, Reset Password)
  const [isOtpModalOpen, setIsOtpModalOpen] = useState<boolean>(false);
  const [otpEmail, setOtpEmail] = useState<string>('');
  const [isForgotModalOpen, setIsForgotModalOpen] = useState<boolean>(false);
  const [isResetModalOpen, setIsResetModalOpen] = useState<boolean>(false);
  const [resetToken, setResetToken] = useState<string>('');

  // Pending intent state (Carry-Over Intent Pattern)
  const [pendingBuyItem, setPendingBuyItem] = useState<{
    item: ServiceItem;
    quantity: number;
  } | null>(() => {
    try {
      const saved = sessionStorage.getItem('deamon_pending_buy_intent');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Check URL parameters for password reset links on mount
  useEffect(() => {
    try {
      if (typeof window === 'undefined') return;
      const params = new URLSearchParams(window.location.search);
      const token = params.get('token');
      if (token) {
        setResetToken(token);
        setIsResetModalOpen(true);
      }
    } catch {}
  }, []);

  // Open Auth modal with specific mode
  const handleOpenAuth = useCallback((mode: 'signin' | 'register' = 'signin') => {
    setAuthModalMode(mode);
    setIsAuthModalOpen(true);
  }, []);

  // Handle Intent-Preserving Buy Now
  const handleBuyNow = useCallback((service: ServiceItem, quantity: number) => {
    const intentPayload = { item: service, quantity };
    setPendingBuyItem(intentPayload);

    try {
      // 1. Stage in sessionStorage for App.tsx intent resolution
      sessionStorage.setItem('deamon_pending_buy_intent', JSON.stringify(intentPayload));

      // 2. Stage corresponding store drawer items in localStorage
      if (service.category === 'session') {
        const s2Item = {
          id: service.id,
          name: service.name,
          country: service.country,
          price: service.priceInr,
          flag: service.flag,
          format: service.format,
        };
        localStorage.setItem('krish_s2_modal_item', JSON.stringify(s2Item));
        localStorage.setItem('krish_s2_qty', String(quantity));
      } else {
        const s1Item = {
          id: service.id,
          country: service.country,
          countryCode: 'GL',
          price: service.priceInr,
          stock: 50,
          flag: service.flag,
        };
        localStorage.setItem('krish_s1_modal_item', JSON.stringify(s1Item));
      }
    } catch {}

    // Open Auth modal in register mode
    setAuthModalMode('register');
    setIsAuthModalOpen(true);
  }, []);

  // Complete Authentication & Intent Redirection
  const handleAuthSuccess = useCallback(
    (
      token: string,
      user?: unknown,
      targetTab?: 'home' | 'store' | 'deposit' | 'history' | 'profile'
    ) => {
      setIsAuthModalOpen(false);
      const destination = pendingBuyItem ? 'store' : (targetTab || 'home');
      onLoginSuccess(token, user, destination);
    },
    [onLoginSuccess, pendingBuyItem]
  );

  // Handle Google Sign In from Hero or Modal
  const handleGoogleSuccess = useCallback(
    async (credential: string) => {
      try {
        const res = await authApi.loginWithGoogle(credential);
        if (res.success && res.token && res.user) {
          setWebUserToken(res.token);
          handleAuthSuccess(res.token, { ...res.user, account_merged: (res as any).account_merged });
        }
      } catch (err) {
        console.error('Google login failed:', err);
      }
    },
    [handleAuthSuccess]
  );

  // OTP Verification Success
  const handleOtpSuccess = useCallback(
    (token: string, user: any) => {
      setIsOtpModalOpen(false);
      setWebUserToken(token);
      handleAuthSuccess(token, user);
    },
    [handleAuthSuccess]
  );

  // Smooth scroll helpers
  const handleExploreRates = useCallback(() => {
    const el = document.getElementById('rates');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  const handleExploreServer = useCallback((_serverId: number) => {
    // Scroll to rates terminal or server section
    const el = document.getElementById('rates');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  return (
    <div className="min-h-screen bg-[#FAF8FF] text-[#211536] flex flex-col selection:bg-[#EDE9FE] selection:text-[#6D28D9]">
      {/* 1. STICKY GLASS HEADER */}
      <LandingHeader
        onOpenAuth={handleOpenAuth}
        onOpenTerms={() => setIsTermsModalOpen(true)}
      />

      {/* MAIN CONTENT AREA */}
      <main className="flex-1">
        {/* 2. HERO SECTION & LIVE SANDBOX PREVIEW */}
        <HeroSection
          onOpenAuth={handleOpenAuth}
          onExploreRates={handleExploreRates}
          onGoogleSuccess={handleGoogleSuccess}
        />

        {/* 3. PAYMENT GATEWAYS STRIP (ZERO-FEE GUARANTEE) */}
        <PaymentStrip />

        {/* 4. HOW IT WORKS (THE 4-STEP GUARANTEE NARRATIVE) */}
        <HowItWorksSection onGetStarted={() => handleOpenAuth('register')} />

        {/* 5. LIVE SERVICE & RATE TERMINAL + CALCULATOR */}
        <RatesTerminalSection onBuyNow={handleBuyNow} />

        {/* 6. 4-SERVER ENTERPRISE INFRASTRUCTURE BREAKDOWN */}
        <InfrastructureSection onExploreServer={handleExploreServer} />

        {/* 7. FREQUENTLY ASKED QUESTIONS */}
        <FaqSection />

        {/* 8. CLOSING HIGH-CONVERSION CTA */}
        <CallToActionSection
          onGetStarted={() => handleOpenAuth('register')}
          onExploreRates={handleExploreRates}
        />
      </main>

      {/* 9. 4-COLUMN FOOTER & VERIFIED BRAND INBOXES */}
      <LandingFooter
        onOpenTermsModal={() => setIsTermsModalOpen(true)}
        onExploreRates={handleExploreRates}
        onExploreServer={handleExploreServer}
      />

      {/* MODALS */}
      {/* Primary Auth Modal (Sign In / Register with Google & Email) */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialMode={authModalMode}
        pendingBuyItem={pendingBuyItem}
        onLoginSuccess={handleAuthSuccess}
        onOpenOtpModal={(email) => {
          setOtpEmail(email);
          setIsOtpModalOpen(true);
        }}
        onOpenForgotPassword={() => setIsForgotModalOpen(true)}
        onOpenTermsModal={() => setIsTermsModalOpen(true)}
      />

      {/* In-App Legal & Refund Policies Modal */}
      <LegalTermsModal
        isOpen={isTermsModalOpen}
        onClose={() => setIsTermsModalOpen(false)}
      />

      {/* Email OTP Verification Modal */}
      <OtpVerificationModal
        isOpen={isOtpModalOpen}
        email={otpEmail}
        onClose={() => setIsOtpModalOpen(false)}
        onSuccess={handleOtpSuccess}
      />

      {/* Forgot Password Modal */}
      <ForgotPasswordModal
        isOpen={isForgotModalOpen}
        initialEmail=""
        onClose={() => setIsForgotModalOpen(false)}
      />

      {/* Reset Password Modal (from email reset link) */}
      <ResetPasswordModal
        isOpen={isResetModalOpen}
        token={resetToken}
        onClose={() => {
          setIsResetModalOpen(false);
          if (typeof window !== 'undefined' && window.history?.replaceState) {
            window.history.replaceState({}, document.title, window.location.pathname);
          }
        }}
        onSuccess={() => {
          setIsResetModalOpen(false);
          handleOpenAuth('signin');
        }}
      />
    </div>
  );
};
