/**
 * AI Work Tracker - App Entry
 */

import { SSRProvider, OverlayProvider } from 'react-aria';
import { SpeedInsights } from '@vercel/speed-insights/next';
import '@styles/global.css';
import '@styles/nprogress.css';
import '@styles/chrome-bug.css';
import type { AppProps } from 'next/app';
import NProgress from '@components/nprogress';
import ResizeHandler from '@components/resize-handler';
import { AuthProvider } from '@lib/hooks/use-auth';
import { useEffect } from 'react';

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    document.body.classList?.remove('loading');
  }, []);
  
  return (
    <SSRProvider>
      <OverlayProvider>
        <AuthProvider>
          <Component {...pageProps} />
          <ResizeHandler />
          <NProgress />
          <SpeedInsights />
        </AuthProvider>
      </OverlayProvider>
    </SSRProvider>
  );
}
