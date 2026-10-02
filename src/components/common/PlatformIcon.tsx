import React from 'react';
import { SmmPlatform } from '../../types';

interface PlatformIconProps {
  platform: SmmPlatform | 'facebook' | 'discord' | 'threads' | string;
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

    case 'instagram':
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

    case 'youtube':
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
