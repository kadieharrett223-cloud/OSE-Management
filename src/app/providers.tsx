'use client';

import { SessionProvider } from 'next-auth/react';
import { ReactNode } from 'react';
import { CommandBar } from '@/components/CommandBar';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider refetchInterval={0} refetchOnWindowFocus={false}>
      {children}
      <CommandBar />
    </SessionProvider>
  );
}
