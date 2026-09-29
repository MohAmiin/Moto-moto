import { router } from 'expo-router';
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
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { MaxContentWidth, Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { LANGUAGES, useI18n } from '@/lib/i18n';

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export function Screen({
  children,
  scroll = true,
  edges = ['top', 'bottom'],
  footer,
}: {
  children: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  /** Pinned below the scrolling content, e.g. a cart button. */
  footer?: ReactNode;
}) {
  const theme = useTheme();
  const body = <View style={styles.content}>{children}</View>;
  return (
    <SafeAreaView edges={edges} style={[styles.screen, { backgroundColor: theme.background }]}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {body}
        </ScrollView>
      ) : (
        body
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

export function Header({ title, subtitle, back = true }: { title: string; subtitle?: string; back?: boolean }) {
  const theme = useTheme();
  const { t, isRTL } = useI18n();
  return (
    <View style={[styles.header, { borderColor: theme.border }]}>
      {back && router.canGoBack() ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          onPress={() => router.back()}
          style={[styles.back, { backgroundColor: theme.backgroundElement }]}>
          <Txt style={styles.backIcon}>{isRTL ? '›' : '‹'}</Txt>
        </Pressable>
      ) : null}
      <View style={{ flex: 1 }}>
        <Txt variant="heading">{title}</Txt>
        {subtitle ? <Txt variant="muted">{subtitle}</Txt> : null}
      </View>
    </View>
  );
}

export function Row({ children, style, gap = Spacing.two }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Stack({ children, style, gap = Spacing.three }: { children: ReactNode; style?: StyleProp<ViewStyle>; gap?: number }) {
  return <View style={[{ gap }, style]}>{children}</View>;
}

export function Card({ children, style, tone = 'plain' }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: 'plain' | 'soft' | 'gold' }) {
  const theme = useTheme();
  const toneStyle =
    tone === 'soft'
      ? { backgroundColor: theme.backgroundSelected, borderColor: 'transparent' }
      : tone === 'gold'
        ? { backgroundColor: theme.gold, borderColor: 'transparent' }
        : { backgroundColor: theme.background, borderColor: theme.border };
  return <View style={[styles.card, toneStyle, style]}>{children}</View>;
}

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------

type Variant = 'body' | 'title' | 'heading' | 'label' | 'muted' | 'price' | 'big';

export function Txt({ variant = 'body', color, style, ...rest }: TextProps & { variant?: Variant; color?: ThemeColor }) {
  const theme = useTheme();
  const defaultColor: ThemeColor = variant === 'muted' || variant === 'label' ? 'textSecondary' : 'text';
  return <Text style={[{ color: theme[color ?? defaultColor] }, text[variant], style]} {...rest} />;
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

type ButtonKind = 'primary' | 'gold' | 'ghost' | 'danger';

export function Button({
  title,
  onPress,
  kind = 'primary',
  loading = false,
  disabled = false,
  style,
}: {
  title: string;
  onPress: () => void;
  kind?: ButtonKind;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const theme = useTheme();
  const palette = {
    primary: { bg: theme.brand, fg: theme.onBrand, border: theme.brand },
    gold: { bg: theme.gold, fg: theme.onGold, border: theme.gold },
    ghost: { bg: 'transparent', fg: theme.text, border: theme.border },
    danger: { bg: 'transparent', fg: theme.danger, border: theme.danger },
  }[kind];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: inactive ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <Text style={[styles.buttonText, { color: palette.fg }, kind === 'gold' && styles.buttonTextBig]}>{title}</Text>
      )}
    </Pressable>
  );
}

export function LinkButton({ title, onPress }: { title: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8} style={{ alignSelf: 'flex-start' }}>
      <Text style={[styles.link, { color: theme.brand }]}>{title}</Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Inputs
// ---------------------------------------------------------------------------

export function Field({ label, error, help, ...input }: TextInputProps & { label: string; error?: string; help?: string }) {
  const theme = useTheme();
  return (
    <View style={{ gap: Spacing.one + 2 }}>
      <Txt variant="label">{label}</Txt>
      <TextInput
        placeholderTextColor={theme.textSecondary}
        {...input}
        style={[
          styles.input,
          { backgroundColor: theme.backgroundElement, borderColor: error ? theme.danger : theme.border, color: theme.text },
          input.multiline && { minHeight: 72, textAlignVertical: 'top' },
          input.style,
        ]}
      />
      {error ? <Txt color="danger" style={styles.small}>{error}</Txt> : help ? <Txt variant="muted" style={styles.small}>{help}</Txt> : null}
    </View>
  );
}

export function PhoneField({ value, onChangeText, error }: { value: string; onChangeText: (v: string) => void; error?: string }) {
  const theme = useTheme();
  const { t } = useI18n();
  return (
    <View style={{ gap: Spacing.one + 2 }}>
      <Txt variant="label">{t('common.phone')}</Txt>
      <View style={[styles.phone, styles.ltr, { backgroundColor: theme.backgroundElement, borderColor: error ? theme.danger : theme.border }]}>
        <Txt style={[styles.prefix, { borderColor: theme.border }]}>+252</Txt>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType="phone-pad"
          autoComplete="tel"
          textContentType="telephoneNumber"
          placeholder="63 123 4567"
          placeholderTextColor={theme.textSecondary}
          maxLength={13}
          style={[styles.phoneInput, { color: theme.text }]}
          accessibilityLabel={t('common.phone')}
        />
      </View>
      {error ? <Txt color="danger" style={styles.small}>{error}</Txt> : null}
    </View>
  );
}

/** A grid of mutually exclusive choices, e.g. payment method or district. */
export function Choices<T extends string>({
  label,
  options,
  value,
  onChange,
  columns = 2,
}: {
  label?: string;
  options: readonly { id: T; label: string; hint?: string }[];
  value: T;
  onChange: (id: T) => void;
  columns?: number;
}) {
  const theme = useTheme();
  return (
    <View style={{ gap: Spacing.two }}>
      {label ? <Txt variant="label">{label}</Txt> : null}
      <View style={styles.choices} accessibilityRole="radiogroup">
        {options.map((o) => {
          const selected = o.id === value;
          return (
            <Pressable
              key={o.id}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => onChange(o.id)}
              style={[
                styles.choice,
                { flexBasis: `${100 / columns - 3}%`, borderColor: selected ? theme.brand : theme.border },
                { backgroundColor: selected ? theme.backgroundSelected : theme.background },
              ]}>
              <Txt style={styles.choiceText}>{o.label}</Txt>
              {o.hint ? <Txt variant="muted" style={styles.small}>{o.hint}</Txt> : null}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function Pill({ label, tone = 'neutral' }: { label: string; tone?: 'neutral' | 'brand' | 'gold' | 'success' | 'warning' | 'danger' }) {
  const theme = useTheme();
  const map = {
    neutral: [theme.backgroundElement, theme.textSecondary],
    brand: [theme.backgroundSelected, theme.brand],
    gold: [theme.gold, theme.onGold],
    success: [theme.successSoft, theme.success],
    warning: [theme.warningSoft, theme.warning],
    danger: [theme.dangerSoft, theme.danger],
  } as const;
  const [bg, fg] = map[tone];
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.pillText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function Stepper({ quantity, onAdd, onRemove }: { quantity: number; onAdd: () => void; onRemove: () => void }) {
  const theme = useTheme();
  const { t } = useI18n();
  if (quantity === 0) {
    return (
      <Pressable accessibilityRole="button" onPress={onAdd} style={[styles.add, { borderColor: theme.brand }]}>
        <Text style={[styles.addText, { color: theme.brand }]}>{t('common.add')}</Text>
      </Pressable>
    );
  }
  return (
    <View style={[styles.stepper, { backgroundColor: theme.brand }]}>
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.removeOne')} onPress={onRemove} style={styles.stepBtn}>
        <Text style={[styles.stepText, { color: theme.onBrand }]}>−</Text>
      </Pressable>
      <Text style={[styles.stepText, { color: theme.onBrand, minWidth: 18, textAlign: 'center' }]}>{quantity}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={t('common.addOne')} onPress={onAdd} style={styles.stepBtn}>
        <Text style={[styles.stepText, { color: theme.onBrand }]}>+</Text>
      </Pressable>
    </View>
  );
}

/** Coloured square with initials, used until stores upload real photos. */
export function Monogram({ name, size = 56 }: { name: string; size?: number }) {
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) % 360;
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.28, backgroundColor: `hsl(${hash}, 55%, 42%)`, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: size * 0.34 }}>{initials}</Text>
    </View>
  );
}

/** Segmented control for Somali, English and Arabic. The choice is saved on the device. */
export function LanguageSwitcher({ onDark = false }: { onDark?: boolean }) {
  const theme = useTheme();
  const { language, setLanguage, t } = useI18n();
  return (
    <View style={[styles.langs, { backgroundColor: onDark ? 'rgba(0,0,0,0.2)' : theme.backgroundElement }]} accessibilityRole="radiogroup" accessibilityLabel={t('common.language')}>
      {LANGUAGES.map((l) => {
        const selected = l.id === language;
        return (
          <Pressable
            key={l.id}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => setLanguage(l.id)}
            style={[styles.lang, selected && { backgroundColor: theme.background }]}>
            <Text style={[styles.langText, { color: selected ? theme.text : onDark ? theme.onBrand : theme.textSecondary }]}>{l.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Empty({ title, body }: { title: string; body?: string }) {
  return (
    <View style={{ alignItems: 'center', gap: Spacing.one, paddingVertical: Spacing.five }}>
      <Txt variant="heading" style={{ textAlign: 'center' }}>{title}</Txt>
      {body ? <Txt variant="muted" style={{ textAlign: 'center' }}>{body}</Txt> : null}
    </View>
  );
}

export function Loading() {
  const theme = useTheme();
  return (
    <View style={[styles.center, { backgroundColor: theme.background }]}>
      <ActivityIndicator color={theme.brand} size="large" />
    </View>
  );
}

// ---------------------------------------------------------------------------

const text = StyleSheet.create({
  body: { fontSize: 15, lineHeight: 22 },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '800' },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '800' },
  label: { fontSize: 13, fontWeight: '700' },
  muted: { fontSize: 14, lineHeight: 20 },
  price: { fontSize: 15, fontWeight: '700', fontVariant: ['tabular-nums'] },
  big: { fontSize: 32, lineHeight: 36, fontWeight: '900', fontVariant: ['tabular-nums'] },
});

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flexGrow: 1 },
  content: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', padding: Spacing.three, gap: Spacing.three, flexGrow: 1 },
  footer: { width: '100%', maxWidth: MaxContentWidth, alignSelf: 'center', paddingHorizontal: Spacing.three, paddingBottom: Spacing.two },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, paddingBottom: Spacing.three, borderBottomWidth: StyleSheet.hairlineWidth },
  back: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  backIcon: { fontSize: 26, lineHeight: 28, fontWeight: '600' },
  card: { borderWidth: 1, borderRadius: Radius.large, padding: Spacing.three, gap: Spacing.two },
  button: { minHeight: 50, borderRadius: Radius.medium, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.three },
  buttonText: { fontSize: 16, fontWeight: '700' },
  buttonTextBig: { fontSize: 17, fontWeight: '900' },
  link: { fontSize: 14, fontWeight: '700', paddingVertical: Spacing.one },
  input: { borderWidth: 1.5, borderRadius: Radius.small + 2, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  phone: { flexDirection: 'row', borderWidth: 1.5, borderRadius: Radius.small + 2, overflow: 'hidden' },
  prefix: { paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, fontWeight: '700', borderRightWidth: 1, writingDirection: 'ltr' },
  // Phone numbers read left to right in every language (native only; web ignores `direction`).
  ltr: Platform.OS === 'web' ? {} : { direction: 'ltr' },
  phoneInput: { flex: 1, paddingHorizontal: 12, fontSize: 16, fontVariant: ['tabular-nums'], textAlign: 'left', writingDirection: 'ltr' },
  small: { fontSize: 13 },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  choice: { flexGrow: 1, borderWidth: 1.5, borderRadius: Radius.small + 2, paddingVertical: 10, paddingHorizontal: 8, alignItems: 'center' },
  choiceText: { fontWeight: '700', fontSize: 14, textAlign: 'center' },
  pill: { borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  pillText: { fontSize: 12, fontWeight: '700' },
  add: { borderWidth: 1.5, borderRadius: Radius.pill, paddingHorizontal: 16, paddingVertical: 6 },
  addText: { fontWeight: '700', fontSize: 14 },
  stepper: { flexDirection: 'row', alignItems: 'center', borderRadius: Radius.pill },
  stepBtn: { width: 36, height: 34, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontSize: 17, fontWeight: '800' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  langs: { flexDirection: 'row', alignSelf: 'flex-start', borderRadius: Radius.pill, padding: 3, gap: 2 },
  lang: { borderRadius: Radius.pill, paddingHorizontal: 12, paddingVertical: 6 },
  langText: { fontSize: 13, fontWeight: '700' },
});
