import React from 'react';
import { SmmPlatform, OtpAppCode } from '../../types';

interface PlatformIconProps {
  platform: SmmPlatform | OtpAppCode | 'facebook' | 'discord' | 'threads' | 'google' | 'gmail' | 'whatsapp' | 'spamchat' | 'sms' | string;
  className?: string;
  size?: number | string;
  colored?: boolean;
}

export const PlatformIcon: React.FC<PlatformIconProps> = ({
  platform,
  className = 'w-4 h-4',
  colored = true,
}) => {
  const norm = platform.toLowerCase();

  switch (norm) {
    case 'telegram':
    case 'tg':
      return (
        <svg
          viewBox="0 0 24 24"
          className={className}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {colored ? (
            <>
              <defs>
                <linearGradient id="tg-grad" x1="12" y1="0" x2="12" y2="24" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#2AABEE" />
                  <stop offset="1" stopColor="#229ED9" />
                </linearGradient>
              </defs>
              <circle cx="12" cy="12" r="12" fill="url(#tg-grad)" />
              <path
                d="M5.4 11.85c4.18-1.82 6.97-3.02 8.37-3.6 3.99-1.66 4.82-1.95 5.36-1.96.12 0 .39.03.56.17.15.12.19.29.21.41 0 .07.02.26 0 .4-.24 2.53-1.28 8.65-1.81 11.48-.22 1.2-.67 1.6-1.1 1.64-.93.09-1.64-.61-2.54-1.2-1.41-.93-2.21-1.5-3.58-2.4-1.58-1.04-.56-1.62.35-2.56.24-.25 4.37-4.01 4.45-4.35.01-.04.02-.2-.07-.28-.09-.08-.22-.05-.32-.03-.14.03-2.34 1.49-6.61 4.37-.62.43-1.19.64-1.7.63-.56-.01-1.65-.32-2.45-.58-1-.32-1.78-.5-1.71-1.05.04-.29.43-.58 1.18-.89z"
                fill="#FFFFFF"
              />
            </>
          ) : (
            <path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.37.74-.56 2.92-1.27 4.86-2.11 5.83-2.52 2.77-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.23 0 .28z"
              fill="currentColor"
            />
          )}
        </svg>
      );

    case 'whatsapp':
    case 'wa':
      return (
        <svg
          viewBox="0 0 24 24"
          className={className}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {colored ? (
            <>
              <circle cx="12" cy="12" r="12" fill="#25D366" />
              <path
                d="M17.472 14.382c-.301-.15-1.78-.879-2.056-.979-.276-.1-.476-.15-.677.15-.2.301-.777.979-.953 1.18-.175.2-.351.225-.652.075-.301-.15-1.272-.469-2.423-1.496-.896-.799-1.501-1.786-1.677-2.087-.175-.3-.019-.463.132-.612.135-.135.301-.351.451-.527.151-.175.201-.301.301-.502.1-.2.05-.376-.025-.526-.075-.15-.677-1.631-.928-2.233-.244-.586-.492-.506-.677-.515h-.577c-.201 0-.527.075-.802.376-.276.301-1.053 1.029-1.053 2.509s1.079 2.903 1.229 3.104c.151.2 2.123 3.242 5.143 4.545.719.311 1.28.497 1.718.636.722.23 1.379.197 1.9.12.58-.087 1.78-.727 2.031-1.429.251-.702.251-1.304.176-1.429-.076-.126-.276-.201-.577-.351z"
                fill="#FFFFFF"
              />
            </>
          ) : (
            <path
              d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18a8 8 0 0 1-4.2-1.2l-.3-.2-3.1.8.8-3-.2-.3A8 8 0 1 1 12 20z"
              fill="currentColor"
            />
          )}
        </svg>
      );

    case 'instagram':
    case 'ig':
      return (
        <svg
          viewBox="0 0 24 24"
          className={className}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {colored ? (
            <>
              <defs>
                <radialGradient id="ig-rg" cx="30%" cy="105%" r="130%">
                  <stop offset="0%" stopColor="#fdf497" />
                  <stop offset="10%" stopColor="#fdf497" />
                  <stop offset="50%" stopColor="#fd5949" />
                  <stop offset="68%" stopColor="#d6249f" />
                  <stop offset="100%" stopColor="#285AEB" />
                </radialGradient>
              </defs>
              <rect width="24" height="24" rx="6.5" fill="url(#ig-rg)" />
              <rect
                x="4.25"
                y="4.25"
                width="15.5"
                height="15.5"
                rx="4.5"
                stroke="#FFFFFF"
                strokeWidth="1.75"
                fill="none"
              />
              <circle
                cx="12"
                cy="12"
                r="3.8"
                stroke="#FFFFFF"
                strokeWidth="1.75"
                fill="none"
              />
              <circle cx="16.5" cy="7.5" r="1.15" fill="#FFFFFF" />
            </>
          ) : (
            <>
              <rect
                x="2.5"
                y="2.5"
                width="19"
                height="19"
                rx="5.5"
                stroke="currentColor"
                strokeWidth="2"
              />
              <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="2" />
              <circle cx="17.2" cy="6.8" r="1.25" fill="currentColor" />
            </>
          )}
        </svg>
      );

    case 'google':
    case 'gmail':
    case 'go':
      return (
        <svg
          viewBox="0 0 24 24"
          className={className}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {colored ? (
            <>
              <rect width="24" height="24" rx="6" fill="#181820" stroke="#262630" strokeWidth="1" />
              <g transform="translate(3, 3) scale(0.75)">
                <path
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  fill="#4285F4"
                />
                <path
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  fill="#34A853"
                />
                <path
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  fill="#FBBC05"
                />
                <path
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  fill="#EA4335"
                />
              </g>
            </>
          ) : (
            <path
              d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm5 11h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"
              fill="currentColor"
            />
          )}
        </svg>
      );

    case 'spam':
    case 'spamchat':
    case 'sms':
      return (
        <svg
          viewBox="0 0 24 24"
          className={className}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {colored ? (
            <>
              <defs>
                <linearGradient id="spam-grad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#8B5CF6" />
                  <stop offset="1" stopColor="#6366F1" />
                </linearGradient>
              </defs>
              <rect width="24" height="24" rx="6" fill="url(#spam-grad)" />
              <path
                d="M6 8a3 3 0 0 1 3-3h6a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3h-2.5l-3 2.5V16H9a3 3 0 0 1-3-3V8z"
                fill="#FFFFFF"
                fillOpacity="0.25"
              />
              <path
                d="M12.5 7.5L8.5 12.5h3.5l-.5 4 4-5h-3.5l.5-4z"
                fill="#FFFFFF"
              />
            </>
          ) : (
            <path
              d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-7 12l-4-5h3l.5-3 4 5h-3l-.5 3z"
              fill="currentColor"
            />
          )}
        </svg>
      );

    case 'all':
      return (
        <svg
          viewBox="0 0 24 24"
          className={className}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {colored ? (
            <>
              <rect width="24" height="24" rx="6" fill="#181820" stroke="#383848" strokeWidth="1" />
              <circle cx="8" cy="8" r="2.2" fill="#7C3AED" />
              <circle cx="16" cy="8" r="2.2" fill="#25D366" />
              <circle cx="8" cy="16" r="2.2" fill="#2AABEE" />
              <circle cx="16" cy="16" r="2.2" fill="#FE2C55" />
            </>
          ) : (
            <path
              d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z"
              fill="currentColor"
            />
          )}
        </svg>
      );

    case 'youtube':
    case 'yt':
      return (
        <svg
          viewBox="0 0 24 24"
          className={className}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {colored ? (
            <>
              <path
                d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"
                fill="#FF0000"
              />
              <path d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="#FFFFFF" />
            </>
          ) : (
            <>
              <path
                d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814z"
                fill="currentColor"
              />
              <path d="M9.545 15.568V8.432L15.818 12l-6.273 3.568z" fill="#0b0b0e" />
            </>
          )}
        </svg>
      );

    case 'tiktok':
    case 'tk':
      return (
        <svg
          viewBox="0 0 24 24"
          className={className}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {colored ? (
            <>
              <rect width="24" height="24" rx="6" fill="#010101" />
              {/* Cyan shadow */}
              <path
                d="M17.8 7.3a4.2 4.2 0 0 1-3.1-3.5h-2.5v11.3a2.4 2.4 0 1 1-2.4-2.4c.25 0 .5.04.72.12V10a5.1 5.1 0 0 0-.72-.05 5.1 5.1 0 1 0 5.1 5.1V8.9a6.6 6.6 0 0 0 3.8 1.2V7.4c-.3 0-.6-.04-.9-.1z"
                fill="#00F2FE"
                transform="translate(-0.8, -0.6)"
              />
              {/* Magenta shadow */}
              <path
                d="M17.8 7.3a4.2 4.2 0 0 1-3.1-3.5h-2.5v11.3a2.4 2.4 0 1 1-2.4-2.4c.25 0 .5.04.72.12V10a5.1 5.1 0 0 0-.72-.05 5.1 5.1 0 1 0 5.1 5.1V8.9a6.6 6.6 0 0 0 3.8 1.2V7.4c-.3 0-.6-.04-.9-.1z"
                fill="#FE2C55"
                transform="translate(0.8, 0.6)"
              />
              {/* White main glyph */}
              <path
                d="M17.8 7.3a4.2 4.2 0 0 1-3.1-3.5h-2.5v11.3a2.4 2.4 0 1 1-2.4-2.4c.25 0 .5.04.72.12V10a5.1 5.1 0 0 0-.72-.05 5.1 5.1 0 1 0 5.1 5.1V8.9a6.6 6.6 0 0 0 3.8 1.2V7.4c-.3 0-.6-.04-.9-.1z"
                fill="#FFFFFF"
              />
            </>
          ) : (
            <path
              d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64c.3-.002.6.042.88.13V9.4a6.33 6.33 0 0 0-1-.08A6.34 6.34 0 0 0 3 15.66a6.34 6.34 0 0 0 10.82 4.47 6.27 6.27 0 0 0 1.87-4.47V8.78a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-.87-.21z"
              fill="currentColor"
            />
          )}
        </svg>
      );

    case 'twitter':
    case 'x':
    case 'tw':
      return (
        <svg
          viewBox="0 0 24 24"
          className={className}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {colored ? (
            <>
              <rect width="24" height="24" rx="6" fill="#000000" stroke="#262630" strokeWidth="1" />
              <path
                d="M16.99 4.75h2.22l-4.85 5.54 5.71 7.54h-4.47l-3.5-4.57-4.01 4.57H5.87l5.19-5.93L5.6 4.75h4.58l3.16 4.18 3.65-4.18zm-.78 11.75h1.23L8.85 6.01H7.53l8.68 10.49z"
                fill="#FFFFFF"
              />
            </>
          ) : (
            <path
              d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"
              fill="currentColor"
            />
          )}
        </svg>
      );

    case 'facebook':
    case 'fb':
      return (
        <svg
          viewBox="0 0 24 24"
          className={className}
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="12" cy="12" r="12" fill="#1877F2" />
          <path
            d="M14.5 12.3l.4-2.8h-2.7V7.7c0-.7.3-1.4 1.5-1.4h1.2V3.9c-.2 0-1-.1-2-.1-2 0-3.3 1.2-3.3 3.5v2.2H7.2v2.8h2.4V22h3.1v-9.7h1.8z"
            fill="#FFFFFF"
          />
        </svg>
      );

    default:
      return (
        <svg
          viewBox="0 0 24 24"
          className={className}
          fill="currentColor"
          xmlns="http://www.w3.org/2000/svg"
        >
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="2" fill="none" />
          <path d="M12 6v6l4 2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      );
  }
};
