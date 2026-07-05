import React from 'react';
import vietNhatLogoNewUrl from '../../../logo-new.png';

export function VietNhatLogo({ className = '' }: { className?: string }) {
  return (
    <img
      src={vietNhatLogoNewUrl}
      alt="Công ty Việt Nhật - Đà Nẵng"
      className={`brand-logo h-9 md:h-10 w-auto max-h-full object-contain ${className}`}
    />
  );
}
