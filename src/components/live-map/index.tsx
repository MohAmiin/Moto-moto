import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';

import { Radius } from '@/constants/theme';

import { MAP_HTML, type LiveMapData } from './map-html';

export type { LiveMapData, MapPoint } from './map-html';

/** Live map on phones: Leaflet inside a WebView, updated by injecting the latest data. */
export function LiveMap({ data, height = 300 }: { data: LiveMapData; height?: number }) {
  const ref = useRef<WebView>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!ready) return;
    ref.current?.injectJavaScript(`window.update(${JSON.stringify(data)}); true;`);
  }, [ready, data]);

  return (
    <View style={[styles.box, { height }]}>
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
  box: { borderRadius: Radius.large, overflow: 'hidden' },
  web: { flex: 1, backgroundColor: 'transparent' },
});
