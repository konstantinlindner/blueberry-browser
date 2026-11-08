import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/BrandMark';
import { Button } from '@/components/Button';
import { Radius, Spacing, useTheme } from '@/constants/theme';

const FEATURES: { icon: keyof typeof Ionicons.glyphMap; title: string; text: string }[] = [
  {
    icon: 'paper-plane-outline',
    title: 'Hand off tasks',
    text: 'Ask from anywhere. Your browser does the work.',
  },
  { icon: 'eye-outline', title: 'Watch it live', text: 'See every step as it happens.' },
  {
    icon: 'shield-checkmark-outline',
    title: 'Stay in control',
    text: 'Approve purchases and anything you can’t undo.',
  },
];

export default function OnboardingScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  // Accounts aren't built yet; linking with a QR code is the real path
  const accountsComingSoon = () =>
    Alert.alert(
      'Blueberry accounts are coming soon',
      'For now, link your phone to Blueberry on your computer with a QR code.',
      [
        { text: 'Not now', style: 'cancel' },
        { text: 'Link with QR code', onPress: () => router.push('/scan') },
      ],
    );

  return (
    <View style={[styles.screen, { backgroundColor: theme.background }]}>
      <LinearGradient
        colors={[theme.primarySoft, theme.background]}
        style={styles.glow}
        pointerEvents="none"
      />

      <View style={[styles.hero, { paddingTop: insets.top + Spacing.xxl * 2 }]}>
        <Animated.View entering={FadeInDown.duration(500)} style={styles.brand}>
          <BrandMark size={84} />
          <Text style={[styles.wordmark, { color: theme.text }]}>Blueberry</Text>
          <Text style={[styles.tagline, { color: theme.textSecondary }]}>
            Your browser’s agent, in your pocket.
          </Text>
        </Animated.View>

        <View style={styles.features}>
          {FEATURES.map((feature, index) => (
            <Animated.View
              key={feature.title}
              entering={FadeInDown.delay(150 + index * 100).duration(450)}
              style={styles.feature}>
              <View style={[styles.featureIcon, { backgroundColor: theme.primarySoft }]}>
                <Ionicons name={feature.icon} size={20} color={theme.primary} />
              </View>
              <View style={styles.featureText}>
                <Text style={[styles.featureTitle, { color: theme.text }]}>{feature.title}</Text>
                <Text style={[styles.featureBody, { color: theme.textSecondary }]}>
                  {feature.text}
                </Text>
              </View>
            </Animated.View>
          ))}
        </View>
      </View>

      <Animated.View
        entering={FadeInDown.delay(450).duration(450)}
        style={[styles.actions, { paddingBottom: insets.bottom + Spacing.lg }]}>
        <Button title="Sign in to Blueberry" onPress={accountsComingSoon} />
        <Button
          title="Link with QR code"
          icon="qr-code-outline"
          variant="outline"
          onPress={() => router.push('/scan')}
        />
        <Pressable onPress={accountsComingSoon} hitSlop={8} style={styles.createAccount}>
          <Text style={[styles.footnote, { color: theme.textSecondary }]}>
            New to Blueberry?{' '}
            <Text style={{ color: theme.primary, fontWeight: '600' }}>Create an account</Text>
          </Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: '55%' },
  hero: { flex: 1, paddingHorizontal: Spacing.xl, gap: Spacing.xxl + Spacing.sm },
  brand: { alignItems: 'center', gap: Spacing.sm },
  wordmark: { fontSize: 36, fontWeight: '800', letterSpacing: -0.5, marginTop: Spacing.md },
  tagline: { fontSize: 17, textAlign: 'center' },
  features: { gap: Spacing.lg + 2 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  featureIcon: {
    width: 42,
    height: 42,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: { flex: 1, gap: 2 },
  featureTitle: { fontSize: 16, fontWeight: '600' },
  featureBody: { fontSize: 14, lineHeight: 19 },
  actions: { paddingHorizontal: Spacing.xl, gap: Spacing.md },
  createAccount: { alignItems: 'center', paddingVertical: Spacing.sm },
  footnote: { fontSize: 14 },
});
