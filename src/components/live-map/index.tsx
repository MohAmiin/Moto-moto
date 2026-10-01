import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { Radius } from '@/constants/theme';

import { MAP_HTML, type LiveMapData } from './map-html';

export type { LiveMapData, MapPoint } from './map-html';

/** Live map on phones: Leaflet inside a WebView, updated by injecting the latest data. */
/** `rounded={false}` for a map that fills the screen edge to edge. */
export function LiveMap({ data, height = 300, rounded = true }: { data: LiveMapData; height?: number; rounded?: boolean }) {
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
          if (e.nativeEvent.data === 'ready') setReady(true);
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
