import { useEffect } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Radius, Spacing, useTheme } from '@/constants/theme';
import { unpair } from '@/lib/actions';
import { useStore, type ConnectionStatus } from '@/lib/store';

export function ConnectionPill() {
  const theme = useTheme();
  const status = useStore((s) => s.status);
  const host = useStore((s) => s.pairing?.host);
  const { label, color } = describe(status, theme);

  const pulse = useSharedValue(1);
  const busy = status === 'connecting' || status === 'offline';
  useEffect(() => {
    if (busy) pulse.value = withRepeat(withTiming(0.3, { duration: 700 }), -1, true);
    else {
      cancelAnimation(pulse);
      pulse.value = withTiming(1);
    }
  }, [busy, pulse]);
  const dotStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  const confirmUnpair = () =>
    Alert.alert(
      'Unpair this phone?',
      `You’ll need to scan the code on your desktop (${host}) again.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Unpair', style: 'destructive', onPress: unpair },
      ],
    );

  return (
    <Pressable
      onPress={status === 'unauthorized' ? unpair : undefined}
      onLongPress={confirmUnpair}
      accessibilityRole="button"
      accessibilityLabel={`${label}. Long press to unpair.`}
      style={[styles.pill, { backgroundColor: theme.cardMuted }]}>
      <Animated.View style={[styles.dot, { backgroundColor: color }, dotStyle]} />
      <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
    </Pressable>
  );
}

function describe(status: ConnectionStatus, theme: ReturnType<typeof useTheme>) {
  switch (status) {
    case 'open':
      return { label: 'Connected', color: theme.success };
    case 'connecting':
      return { label: 'Connecting', color: theme.warning };
    case 'offline':
      return { label: 'Reconnecting', color: theme.warning };
    case 'unauthorized':
      return { label: 'Tap to re-pair', color: theme.danger };
    case 'idle':
      return { label: 'Offline', color: theme.textSecondary };
  }
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    paddingHorizontal: Spacing.md - 2,
    paddingVertical: Spacing.xs + 1,
    borderRadius: Radius.pill,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontSize: 13, fontWeight: '600' },
});
