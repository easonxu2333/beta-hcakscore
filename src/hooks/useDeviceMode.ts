import { useEffect, useState } from 'react';

function detectMobile() {
  if (typeof window === 'undefined') return false;
  const mobileViewport = window.matchMedia('(max-width: 900px)').matches;
  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  return mobileViewport || coarsePointer;
}

export default function useDeviceMode() {
  const [isMobile, setIsMobile] = useState(detectMobile);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleChange = () => setIsMobile(detectMobile());
    const mediaQueries = [
      window.matchMedia('(max-width: 900px)'),
      window.matchMedia('(pointer: coarse)'),
    ];

    mediaQueries.forEach((query) => query.addEventListener('change', handleChange));
    handleChange();

    return () => {
      mediaQueries.forEach((query) => query.removeEventListener('change', handleChange));
    };
  }, []);

  return {
    isMobile,
    deviceLabel: isMobile ? 'Mobile' : 'Desktop',
  };
}
