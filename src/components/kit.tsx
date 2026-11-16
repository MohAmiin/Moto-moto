import { Image } from 'expo-image';
import { router } from 'expo-router';
import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { Icon, Icons } from '@/components/feed';
import { Txt, withFont } from '@/components/ui';
import { MaxContentWidth, Spacing, type Palette } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useI18n } from '@/lib/i18n';

// Building blocks for the admin screens: a compact top bar, bordered panels on a grey canvas, small
// figures, list rows, search and filter chips. Type stays light (regular and medium); colour is kept
// for status and for the things that need the admin's attention (orange).

// ---------------------------------------------------------------------------
// Icons: SF Symbols on iPhone, the app's own icons (or a plain glyph) elsewhere.
// ---------------------------------------------------------------------------

type SFSymbol = Extract<SymbolViewProps['name'], string>;

const ICONS = {
  overview: { ios: 'square.grid.2x2', png: Icons.home },
  riders: { ios: 'scooter', png: Icons.motorbike },
  customers: { ios: 'person.2', png: Icons.user },
  settings: { ios: 'gearshape', glyph: '⚙' },
  search: { ios: 'magnifyingglass', glyph: '⌕' },
  forward: { ios: 'chevron.right', glyph: '›' },
  backward: { ios: 'chevron.left', glyph: '‹' },
  key: { ios: 'key', glyph: '#' },
  attention: { ios: 'exclamationmark.circle', glyph: '!' },
  map: { ios: 'map', png: Icons.map },
  phone: { ios: 'phone', png: Icons.phone },
  person: { ios: 'person.crop.circle', png: Icons.user },
  personAdd: { ios: 'person.badge.plus', png: Icons.user },
  check: { ios: 'checkmark.circle', glyph: '✓' },
  cross: { ios: 'xmark.circle', glyph: '×' },
  clock: { ios: 'clock', png: Icons.clock },
  star: { ios: 'star', png: Icons.star },
  document: { ios: 'doc.text', glyph: '≡' },
  signOut: { ios: 'rectangle.portrait.and.arrow.right', glyph: '⎋' },
  appearance: { ios: 'circle.lefthalf.filled', glyph: '◐' },
  language: { ios: 'globe', glyph: '◎' },
  server: { ios: 'server.rack', glyph: '≡' },
  locate: { ios: 'location', png: Icons.locate },
  locationOff: { ios: 'location.slash', png: Icons.locate },
  pin: { ios: 'mappin.and.ellipse', png: Icons.map },
  offline: { ios: 'wifi.exclamationmark', glyph: '!' },
  info: { ios: 'info.circle', glyph: 'i' },
  camera: { ios: 'camera', glyph: '◉' },
  power: { ios: 'power', glyph: '⏻' },
  delivery: { ios: 'shippingbox', png: Icons.route },
  home: { ios: 'house', png: Icons.home },
  account: { ios: 'person.crop.circle', png: Icons.user },
} satisfies Record<string, { ios: SFSymbol; png?: number; glyph?: string }>;

export type AdminIconName = keyof typeof ICONS;

export function AdminIcon({ name, size = 20, color }: { name: AdminIconName; size?: number; color: string }) {
  const { isRTL } = useI18n();
  // Chevrons point the way the layout reads.
  const resolved = isRTL && name === 'forward' ? 'backward' : isRTL && name === 'backward' ? 'forward' : name;
  const icon: { ios: SFSymbol; png?: number; glyph?: string } = ICONS[resolved];
  const fallback = icon.png ? (
    <Icon source={icon.png} size={size} color={color} />
  ) : (
    <Text style={{ color, fontSize: size * 0.9, lineHeight: size, width: size, textAlign: 'center' }}>{icon.glyph}</Text>
  );
  return <SymbolView name={icon.ios} size={size} tintColor={color} weight="regular" fallback={fallback} />;
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

/** A screen on the grey canvas. Tab screens leave the bottom edge to the tab bar. */
export function AdminScreen({
  header,
  children,
  edges = ['top'],
  scroll = true,
  refreshControl,
}: {
  header?: ReactNode;
  children: ReactNode;
  edges?: Edge[];
  scroll?: boolean;
  refreshControl?: React.ComponentProps<typeof ScrollView>['refreshControl'];
}) {
  const theme = useTheme();
  const body = <View style={styles.content}>{children}</View>;
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: theme.canvas }}>
      {header}
      {scroll ? (
        <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled" refreshControl={refreshControl}>
          {body}
        </ScrollView>
      ) : (
        body
      )}
    </SafeAreaView>
  );
}

/** The logo, a title (with an optional line below), and something on the other side. */
export function TopBar({
  title,
  subtitle,
  leading,
  trailing,
  showProfile = true,
}: {
  title: string;
  subtitle?: string | null;
  /** Replaces the logo, e.g. with the rider's photo. */
  leading?: ReactNode;
  /** Replaces the admin's Settings button. */
  trailing?: ReactNode;
  showProfile?: boolean;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  return (
    <View style={[styles.bar, { borderBottomColor: theme.hairline, backgroundColor: theme.canvas }]}>
      <View style={styles.barInner}>
        {leading ?? (
          <Image source={require('@/assets/images/logo-mark.png')} style={styles.logo} contentFit="contain" accessibilityIgnoresInvertColors accessible={false} />
        )}
        <View style={{ flex: 1 }}>
          <Txt style={styles.barTitle} accessibilityRole="header" numberOfLines={1}>
            {title}
          </Txt>
          {subtitle ? (
            <Txt variant="muted" style={styles.barSub} numberOfLines={1}>
              {subtitle}
            </Txt>
          ) : null}
        </View>
        {trailing ??
          (showProfile ? (
            <IconButton icon="person" label={t('adm.settings')} onPress={() => router.navigate('/admin/settings')} />
          ) : null)}
      </View>
    </View>
  );
}

/** A round 38-point button with an icon, e.g. account or recenter. */
export function IconButton({
  icon,
  label,
  onPress,
  color,
  style,
}: {
  icon: AdminIconName;
  label: string;
  onPress: () => void;
  color?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [styles.round, { backgroundColor: theme.surface, borderColor: theme.hairline, opacity: pressed ? 0.7 : 1 }, style]}>
      <AdminIcon name={icon} size={19} color={color ?? theme.textSecondary} />
    </Pressable>
  );
}

/** A tinted strip for a problem or a hint, with an optional action. */
export function Notice({
  icon,
  title,
  body,
  tone = 'warning',
  action,
}: {
  icon: AdminIconName;
  title: string;
  body?: string;
  tone?: 'warning' | 'info' | 'danger';
  action?: { label: string; onPress: () => void; busy?: boolean };
}) {
  const theme = useTheme();
  const [bg, fg] = {
    warning: [theme.warningSoft, theme.warning],
    info: [theme.primarySoft, theme.primaryText],
    danger: [theme.dangerSoft, theme.danger],
  }[tone];
  return (
    <View accessibilityRole={tone === 'info' ? undefined : 'alert'} style={[styles.notice, { backgroundColor: bg }]}>
      <AdminIcon name={icon} size={18} color={fg} />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt style={[styles.noticeTitle, { color: theme.text }]}>{title}</Txt>
        {body ? (
          <Txt variant="muted" style={styles.noticeBody}>
            {body}
          </Txt>
        ) : null}
      </View>
      {action ? (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ busy: action.busy, disabled: action.busy }}
          disabled={action.busy}
          onPress={action.onPress}
          hitSlop={8}
          style={({ pressed }) => [styles.noticeAction, { borderColor: fg, opacity: pressed || action.busy ? 0.6 : 1 }]}>
          {action.busy ? <ActivityIndicator size="small" color={fg} /> : <Txt style={[styles.noticeActionText, { color: fg }]}>{action.label}</Txt>}
        </Pressable>
      ) : null}
    </View>
  );
}

/** Title with a back button, for screens opened from a tab. */
export function DetailBar({ title }: { title: string }) {
  const theme = useTheme();
  const { t } = useI18n();
  return (
    <View style={[styles.bar, { borderBottomColor: theme.hairline, backgroundColor: theme.canvas }]}>
      <View style={styles.barInner}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          onPress={() => (router.canGoBack() ? router.back() : router.navigate('/admin'))}
          hitSlop={6}
          style={({ pressed }) => [styles.round, { backgroundColor: theme.surface, borderColor: theme.hairline, opacity: pressed ? 0.7 : 1 }]}>
          <AdminIcon name="backward" size={18} color={theme.text} />
        </Pressable>
        <Txt style={[styles.barTitle, { flex: 1 }]} accessibilityRole="header" numberOfLines={1}>
          {title}
        </Txt>
      </View>
    </View>
  );
}

/** A white (or raised dark) surface with a hairline border. */
export function Panel({ children, style, padded = true }: { children: ReactNode; style?: StyleProp<ViewStyle>; padded?: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.panel, padded && styles.panelPadded, { backgroundColor: theme.surface, borderColor: theme.hairline }, style]}>{children}</View>
  );
}

/** Small section heading with an optional action on the other side. */
export function SectionTitle({ title, action }: { title: string; action?: { label: string; onPress: () => void } }) {
  const theme = useTheme();
  return (
    <View style={styles.sectionTitle}>
      <Txt style={styles.sectionText} accessibilityRole="header">
        {title}
      </Txt>
      {action ? (
        <Pressable accessibilityRole="button" onPress={action.onPress} hitSlop={10} style={styles.sectionAction}>
          <Txt style={[styles.actionText, { color: theme.primaryText }]}>{action.label}</Txt>
        </Pressable>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Figures
// ---------------------------------------------------------------------------

/** A figure that may still be loading (undefined) or have failed to load (null). Never shown as 0 then. */
export type Metric = number | string | null | undefined;

type Tone = 'primary' | 'accent' | 'success' | 'neutral';

function toneColors(theme: Palette, tone: Tone) {
  return {
    primary: { fg: theme.primaryText, bg: theme.primarySoft },
    accent: { fg: theme.accentText, bg: theme.accentSoft },
    success: { fg: theme.success, bg: theme.successSoft },
    neutral: { fg: theme.textSecondary, bg: theme.surfaceMuted },
  }[tone];
}

export function StatCard({
  icon,
  label,
  value,
  tone = 'neutral',
  onPress,
}: {
  icon: AdminIconName;
  label: string;
  value: Metric;
  tone?: Tone;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const { t } = useI18n();
  const c = toneColors(theme, tone);
  const a11yValue = value === undefined ? t('common.loading') : value === null ? t('adm.failedShort') : String(value);
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={`${label}: ${a11yValue}`}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [styles.stat, { backgroundColor: theme.surface, borderColor: theme.hairline, opacity: pressed ? 0.8 : 1 }]}>
      <View style={[styles.statIcon, { backgroundColor: c.bg }]}>
        <AdminIcon name={icon} size={16} color={c.fg} />
      </View>
      {value === undefined ? (
        <ActivityIndicator style={styles.statSpinner} color={theme.textSecondary} />
      ) : value === null ? (
        <Txt style={[styles.statFailed, { color: theme.danger }]}>{t('adm.failedShort')}</Txt>
      ) : (
        <Txt style={styles.statValue}>{value}</Txt>
      )}
      <Txt variant="muted" style={styles.statLabel} numberOfLines={2}>
        {label}
      </Txt>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------------

export function ListRow({
  leading,
  title,
  subtitle,
  trailing,
  onPress,
  last = false,
  accessibilityLabel,
}: {
  leading?: ReactNode;
  title: string;
  subtitle?: string | null;
  trailing?: ReactNode;
  onPress?: () => void;
  last?: boolean;
  accessibilityLabel?: string;
}) {
  const theme = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.hairline },
        pressed && { backgroundColor: theme.surfaceMuted },
      ]}>
      {leading}
      <View style={styles.rowText}>
        <Txt style={styles.rowTitle} numberOfLines={1}>
          {title}
        </Txt>
        {subtitle ? (
          <Txt variant="muted" style={styles.rowSub} numberOfLines={2}>
            {subtitle}
          </Txt>
        ) : null}
      </View>
      {trailing ? <View>{trailing}</View> : null}
      {onPress ? <AdminIcon name="forward" size={14} color={theme.textSecondary} /> : null}
    </Pressable>
  );
}

export function SearchField({ value, onChangeText, placeholder }: { value: string; onChangeText: (v: string) => void; placeholder: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.search, { backgroundColor: theme.surface, borderColor: theme.hairline }]}>
      <AdminIcon name="search" size={16} color={theme.textSecondary} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="while-editing"
        returnKeyType="search"
        accessibilityLabel={placeholder}
        style={[withFont({ fontWeight: '400' }), styles.searchInput, { color: theme.text }]}
      />
    </View>
  );
}

/** Compact, scrollable filter chips with optional counts. */
export function FilterChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly { id: T; label: string; count?: number }[];
  value: T;
  onChange: (id: T) => void;
}) {
  const theme = useTheme();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} accessibilityRole="tablist">
      {options.map((o) => {
        const selected = o.id === value;
        return (
          <Pressable
            key={o.id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(o.id)}
            style={[
              styles.chip,
              selected
                ? { backgroundColor: theme.primary, borderColor: theme.primary }
                : { backgroundColor: theme.surface, borderColor: theme.hairline },
            ]}>
            <Txt style={[styles.chipText, { color: selected ? '#FFFFFF' : theme.text }]}>
              {o.label}
              {o.count != null ? <Txt style={[styles.chipText, { color: selected ? 'rgba(255,255,255,0.8)' : theme.textSecondary }]}>{`  ${o.count}`}</Txt> : null}
            </Txt>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export type BadgeTone = 'neutral' | 'primary' | 'accent' | 'success' | 'warning' | 'danger';

export function Badge({ label, tone = 'neutral' }: { label: string; tone?: BadgeTone }) {
  const theme = useTheme();
  const [bg, fg] = {
    neutral: [theme.surfaceMuted, theme.textSecondary],
    primary: [theme.primarySoft, theme.primaryText],
    accent: [theme.accentSoft, theme.accentText],
    success: [theme.successSoft, theme.success],
    warning: [theme.warningSoft, theme.warning],
    danger: [theme.dangerSoft, theme.danger],
  }[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={withFont([styles.badgeText, { color: fg }])} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

/** A short, calm empty state inside a panel. */
export function EmptyNote({ icon, title, body }: { icon: AdminIconName; title: string; body?: string }) {
  const theme = useTheme();
  return (
    <View style={styles.empty}>
      <AdminIcon name={icon} size={22} color={theme.textSecondary} />
      <View style={{ flex: 1, gap: 2 }}>
        <Txt style={styles.emptyTitle}>{title}</Txt>
        {body ? (
          <Txt variant="muted" style={styles.emptyBody}>
            {body}
          </Txt>
        ) : null}
      </View>
    </View>
  );
}

/** A labelled text input in the kit's style. */
export function TextField({
  label,
  help,
  error,
  style,
  ...input
}: React.ComponentProps<typeof TextInput> & { label: string; help?: string; error?: string }) {
  const theme = useTheme();
  return (
    <View style={{ gap: 4 }}>
      <Txt variant="muted" style={styles.fieldLabel}>
        {label}
      </Txt>
      <TextInput
        placeholderTextColor={theme.textSecondary}
        accessibilityLabel={label}
        {...input}
        style={[
          withFont({ fontWeight: '400' }),
          styles.field,
          { color: theme.text, backgroundColor: theme.surfaceMuted, borderColor: error ? theme.danger : theme.hairline },
          input.multiline && { minHeight: 84, textAlignVertical: 'top' },
          style,
        ]}
      />
      {error ? (
        <Txt color="danger" style={styles.fieldHelp}>
          {error}
        </Txt>
      ) : help ? (
        <Txt variant="muted" style={styles.fieldHelp}>
          {help}
        </Txt>
      ) : null}
    </View>
  );
}

/** A +252 phone number field in the kit's style. Numbers always read left to right. */
export function PhoneTextField({
  label,
  value,
  onChangeText,
  help,
  error,
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  help?: string;
  error?: string;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: 4 }}>
      <Txt variant="muted" style={styles.fieldLabel}>
        {label}
      </Txt>
      <View style={[styles.phoneRow, ltr, { backgroundColor: theme.surfaceMuted, borderColor: error ? theme.danger : theme.hairline }]}>
        <Txt style={[styles.phonePrefix, { borderColor: theme.hairline }]}>+252</Txt>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          placeholder="63 123 4567"
          placeholderTextColor={theme.textSecondary}
          maxLength={16}
          accessibilityLabel={label}
          style={[withFont({ fontWeight: '400' }), styles.phoneInput, { color: theme.text }]}
        />
      </View>
      {error ? (
        <Txt color="danger" style={styles.fieldHelp} accessibilityRole="alert">
          {error}
        </Txt>
      ) : help ? (
        <Txt variant="muted" style={styles.fieldHelp} accessibilityLiveRegion="polite">
          {help}
        </Txt>
      ) : null}
    </View>
  );
}

/** A masked PIN field: digits only, spaced out, left to right in every language. */
export function PinField({ label, value, onChangeText }: { label: string; value: string; onChangeText: (v: string) => void }) {
  return (
    <TextField
      label={label}
      value={value}
      onChangeText={(v) => onChangeText(v.replace(/\D/g, ''))}
      keyboardType="number-pad"
      secureTextEntry
      maxLength={6}
      placeholder="••••••"
      style={styles.pin}
    />
  );
}

/** A labelled value on a detail screen. */
export function InfoLine({ label, value, last = false }: { label: string; value: string | null | undefined; last?: boolean }) {
  const theme = useTheme();
  return (
    <View style={[styles.info, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.hairline }]}>
      <Txt variant="muted" style={styles.infoLabel}>
        {label}
      </Txt>
      <Txt style={styles.infoValue}>{value || '—'}</Txt>
    </View>
  );
}

/** A full-width button in admin style: filled blue, orange for attention, outlined, or quiet red. */
export function AdminButton({
  title,
  onPress,
  kind = 'primary',
  icon,
  loading = false,
  disabled = false,
  style,
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'accent' | 'outline' | 'danger';
  icon?: AdminIconName;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const p = {
    primary: { bg: theme.primary, fg: '#FFFFFF', border: theme.primary },
    accent: { bg: theme.accent, fg: '#1A1206', border: theme.accent },
    outline: { bg: theme.surface, fg: theme.text, border: theme.hairline },
    danger: { bg: theme.surface, fg: theme.danger, border: theme.hairline },
  }[kind];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [styles.button, { backgroundColor: p.bg, borderColor: p.border, opacity: inactive ? 0.5 : pressed ? 0.85 : 1 }, style]}>
      {loading ? (
        <ActivityIndicator color={p.fg} />
      ) : (
        <>
          {icon ? <AdminIcon name={icon} size={17} color={p.fg} /> : null}
          <Text style={withFont([styles.buttonText, { color: p.fg }])}>{title}</Text>
        </>
      )}
    </Pressable>
  );
}

// Phone numbers read left to right in every language (native only; web ignores `direction`).
const ltr = Platform.OS === 'web' ? {} : ({ direction: 'ltr' } as const);

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', padding: Spacing.three, gap: Spacing.three, flexGrow: 1 },
  bar: { borderBottomWidth: StyleSheet.hairlineWidth },
  barInner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    minHeight: 52,
  },
  logo: { width: 34, height: 34 },
  barTitle: { fontSize: 18, lineHeight: 24, fontWeight: '500' },
  barSub: { fontSize: 13, lineHeight: 17 },
  notice: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three - 4, borderRadius: 12, paddingHorizontal: Spacing.three - 2, paddingVertical: Spacing.two + 2 },
  noticeTitle: { fontSize: 14, lineHeight: 19, fontWeight: '500' },
  noticeBody: { fontSize: 13, lineHeight: 18 },
  noticeAction: { minHeight: 36, minWidth: 44, paddingHorizontal: Spacing.three - 2, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  noticeActionText: { fontSize: 13, fontWeight: '500' },
  round: { width: 38, height: 38, borderRadius: 19, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  panel: { borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  panelPadded: { padding: Spacing.three, gap: Spacing.two },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two, marginBottom: -Spacing.one },
  sectionText: { fontSize: 15, lineHeight: 20, fontWeight: '500' },
  sectionAction: { minHeight: 32, justifyContent: 'center' },
  actionText: { fontSize: 14, fontWeight: '500' },
  stat: {
    flexGrow: 1,
    flexBasis: '46%',
    minHeight: 104,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three - 2,
    gap: Spacing.one + 2,
  },
  statIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  statValue: { fontSize: 26, lineHeight: 32, fontWeight: '500', fontVariant: ['tabular-nums'] },
  statFailed: { fontSize: 14, lineHeight: 32, fontWeight: '500' },
  statSpinner: { alignSelf: 'flex-start', height: 32 },
  statLabel: { fontSize: 13, lineHeight: 17 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three - 4, minHeight: 60, paddingVertical: Spacing.two + 2, paddingHorizontal: Spacing.three },
  rowText: { flex: 1, gap: 1 },
  rowTitle: { fontSize: 15, lineHeight: 20, fontWeight: '500' },
  rowSub: { fontSize: 13, lineHeight: 18 },
  search: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, paddingHorizontal: Spacing.three - 4, minHeight: 44 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: Spacing.two },
  chips: { gap: Spacing.two, paddingVertical: 2 },
  chip: { minHeight: 34, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, justifyContent: 'center' },
  chipText: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start', maxWidth: 160 },
  badgeText: { fontSize: 12, lineHeight: 16, fontWeight: '500' },
  empty: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three - 4, paddingVertical: Spacing.two },
  emptyTitle: { fontSize: 14, lineHeight: 19, fontWeight: '500' },
  emptyBody: { fontSize: 13, lineHeight: 18 },
  info: { paddingVertical: Spacing.two + 2, gap: 2 },
  fieldLabel: { fontSize: 12, lineHeight: 16 },
  field: { borderWidth: 1, borderRadius: 12, minHeight: 46, paddingHorizontal: Spacing.three - 4, paddingVertical: Spacing.two + 2, fontSize: 15 },
  fieldHelp: { fontSize: 12, lineHeight: 16 },
  phoneRow: { flexDirection: 'row', borderWidth: 1, borderRadius: 12, overflow: 'hidden', minHeight: 46 },
  phonePrefix: { paddingHorizontal: Spacing.three - 4, alignSelf: 'center', fontSize: 15, borderRightWidth: StyleSheet.hairlineWidth, writingDirection: 'ltr' },
  phoneInput: { flex: 1, paddingHorizontal: Spacing.three - 4, fontSize: 15, fontVariant: ['tabular-nums'], textAlign: 'left', writingDirection: 'ltr' },
  pin: { fontSize: 22, letterSpacing: 8, textAlign: 'center', writingDirection: 'ltr' },
  infoLabel: { fontSize: 12, lineHeight: 16 },
  infoValue: { fontSize: 15, lineHeight: 21 },
  button: { minHeight: 48, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.two, paddingHorizontal: Spacing.three },
  buttonText: { fontSize: 15, fontWeight: '500' },
});
