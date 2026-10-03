import { Pressable, StyleSheet, View } from 'react-native';

import { Txt } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/lib/i18n';

/** A calm warning when the latest refresh failed, with a retry. What was loaded before stays on screen. */
export function ConnectionBanner({ message, onRetry, retrying = false }: { message: string; onRetry: () => void; retrying?: boolean }) {
  const theme = useTheme();
  const { t } = useI18n();
  return (
    <View accessibilityRole="alert" style={[styles.banner, { backgroundColor: theme.warningSoft }]}>
      <Txt style={[styles.text, { color: theme.text }]}>{message}</Txt>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ busy: retrying, disabled: retrying }}
        disabled={retrying}
        onPress={onRetry}
        hitSlop={8}
        style={({ pressed }) => [styles.retry, { borderColor: theme.warning, opacity: pressed || retrying ? 0.6 : 1 }]}>
        <Txt style={[styles.retryText, { color: theme.warning }]}>{t('common.retry')}</Txt>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, borderRadius: Radius.medium, padding: Spacing.three },
  text: { flex: 1, fontSize: 14, lineHeight: 20 },
  retry: { minHeight: 40, paddingHorizontal: Spacing.three, borderRadius: Radius.pill, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  retryText: { fontSize: 14, fontWeight: '700' },
});
