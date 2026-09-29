import { useEffect, useRef, useState } from 'react';

import { Radius } from '@/constants/theme';

import { MAP_HTML, type LiveMapData } from './map-html';

export type { LiveMapData, MapPoint } from './map-html';

/** Live map on the web: the same Leaflet page in an iframe, updated with postMessage. */
export function LiveMap({ data, height = 300 }: { data: LiveMapData; height?: number }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.source === ref.current?.contentWindow && e.data === 'sabiq-map-ready') setReady(true);
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  useEffect(() => {
    if (ready) ref.current?.contentWindow?.postMessage(JSON.stringify(data), '*');
  }, [ready, data]);

  return (
    <iframe
      ref={ref}
      title="Map"
      srcDoc={MAP_HTML}
      style={{ border: 0, width: '100%', height, borderRadius: Radius.large, display: 'block' }}
    />
  );
}
