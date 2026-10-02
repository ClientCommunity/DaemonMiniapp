import React from 'react';
import { useApp } from '../../context/AppContext';
import { ServerSelector } from './ServerSelector';
import { Server1Lzt } from './Server1Lzt';
import { Server2Sessions } from './Server2Sessions';
import { Server34Otp } from './Server34Otp';
import { Server5Smm } from './Server5Smm';

export const StorefrontView: React.FC = () => {
  const { selectedServer } = useApp();

  return (
    <div className="w-full flex flex-col pb-8">
      {/* 5 Server Navigation Header */}
      <ServerSelector />

      {/* Render Active Server Component */}
      {selectedServer === 1 && <Server1Lzt />}
      {selectedServer === 2 && <Server2Sessions />}
      {selectedServer === 3 && <Server34Otp serverId={3} />}
      {selectedServer === 4 && <Server34Otp serverId={4} />}
      {selectedServer === 5 && <Server5Smm />}
    </div>
  );
};
