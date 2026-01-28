'use client';

import { SessionProvider } from 'next-auth/react';
import { ReactNode } from 'react';

export function Providers({ children }: { children: ReactNode }) {
  // Skip SessionProvider entirely if auth is disabled
  const authDisabled = typeof window === 'undefined' 
    ? process.env.NEXT_PUBLIC_AUTH_DISABLED 
    : (window as any).__AUTH_DISABLED__;
  
  if (authDisabled === 'true' || authDisabled === '1') {
    return <>{children}</>;
  }
  
  return (
    <SessionProvider refetchInterval={0} refetchOnWindowFocus={false}>
      {children}
    </SessionProvider>
  );
}
