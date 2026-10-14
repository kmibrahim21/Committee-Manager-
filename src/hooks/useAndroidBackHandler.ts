import { useEffect, useRef } from 'react';

/**
 * Android-like back button handler for SPAs
 * - Navigate to previous page using browser history
 * - Double back to exit on root page
 * - Mobile/WebView only
 * - Desktop behavior remains unchanged
 */
export const useAndroidBackHandler = (currentView: string, setView: (view: any) => void) => {
  const lastBackPress = useRef<number>(0);
  const isRoot = currentView === 'home' || currentView === 'admin-dashboard';
  const isMobile = typeof navigator !== 'undefined' && /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  useEffect(() => {
    // Sync view with URL query parameter ?view=...
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (url.searchParams.get('view') !== currentView) {
        url.searchParams.set('view', currentView);
        window.history.pushState({ view: currentView }, '', url.toString());
      } else if (window.history.state?.view !== currentView) {
        window.history.replaceState({ view: currentView }, '', url.toString());
      }
    }

    const handlePopState = (event: PopStateEvent) => {
      // If we have a state in history, navigate to that view
      if (event.state && event.state.view) {
        setView(event.state.view);
      } else {
        const params = new URLSearchParams(window.location.search);
        const urlView = params.get('view');
        if (urlView) {
          setView(urlView);
        } else if (isRoot && isMobile) {
          const now = Date.now();
          if (now - lastBackPress.current < 2000) {
            window.history.back();
          } else {
            lastBackPress.current = now;
            const toast = document.createElement('div');
            toast.textContent = "Press back again to exit";
            toast.style.cssText = `
              position: fixed;
              bottom: 100px;
              left: 50%;
              transform: translateX(-50%);
              background-color: rgba(0, 0, 0, 0.85);
              color: white;
              padding: 12px 24px;
              border-radius: 999px;
              z-index: 100000;
              font-size: 14px;
              font-weight: 600;
              transition: opacity 0.3s, transform 0.3s;
              pointer-events: none;
              font-family: 'Hind Siliguri', sans-serif;
              box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
              text-align: center;
              min-width: 200px;
            `;
            document.body.appendChild(toast);
            setTimeout(() => {
              if (document.body.contains(toast)) {
                document.body.removeChild(toast);
              }
            }, 2000);

            const rootUrl = new URL(window.location.href);
            rootUrl.searchParams.set('view', currentView);
            window.history.pushState({ view: currentView }, '', rootUrl.toString());
          }
        } else {
          setView(isRoot ? currentView : 'home');
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentView, setView, isRoot, isMobile]);
};
