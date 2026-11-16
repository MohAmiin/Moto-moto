import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { Radius } from '@/constants/theme';

import { MAP_HTML, type LiveMapData } from './map-html';

export type { LiveMapData, MapPoint } from './map-html';

/** Live map on phones: Leaflet inside a WebView, updated by injecting the latest data. */
/** `rounded={false}` for a map that fills the screen edge to edge. */
export function LiveMap({
  data,
  height = 300,
  rounded = true,
  onSelect,
  onPick,
}: {
  data: LiveMapData;
  height?: number;
  rounded?: boolean;
  /** Called with a rider's id when their pin is tapped. */
  onSelect?: (id: string) => void;
  /** Called with the tapped spot while `data.picking` is set. */
  onPick?: (point: { lat: number; lng: number }) => void;
}) {
  const ref = useRef<WebView>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!ready) return;
    ref.current?.injectJavaScript(`window.update(${JSON.stringify(data)}); true;`);
  }, [ready, data]);

  return (
    <View style={[styles.box, { height, borderRadius: rounded ? Radius.large : 0 }]}>
      <WebView
        ref={ref}
        source={{ html: MAP_HTML }}
        originWhitelist={['*']}
        onMessage={(e) => {
          const msg = e.nativeEvent.data;
          if (msg === 'ready') setReady(true);
          else if (msg.startsWith('select:')) onSelect?.(msg.slice('select:'.length));
          else if (msg.startsWith('pick:')) {
            const [lat, lng] = msg.slice('pick:'.length).split(',').map(Number);
            if (Number.isFinite(lat) && Number.isFinite(lng)) onPick?.({ lat, lng });
          }
        }}
        scrollEnabled={false}
        style={styles.web}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  box: { overflow: 'hidden' },
  web: { flex: 1, backgroundColor: 'transparent' },
});
