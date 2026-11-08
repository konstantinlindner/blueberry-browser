import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { Spacing, useTheme } from '@/constants/theme';
import { useStore, type ConnectionStatus as Status } from '@/lib/store';

export function useConnectionLabel(): { status: Status; label: string; color: string } {
  const theme = useTheme();
  const status = useStore((s) => s.status);
  const { label, color } = {
    open: { label: 'Connected', color: theme.success },
    connecting: { label: 'Connecting…', color: theme.warning },
    offline: { label: 'Reconnecting…', color: theme.warning },
    unauthorized: { label: 'Needs to be linked again', color: theme.danger },
    idle: { label: 'Offline', color: theme.textSecondary },
  }[status];
  return { status, label, color };
}

// Status dot that pulses while (re)connecting, with an optional label
export function ConnectionStatus({ showLabel = true }: { showLabel?: boolean }) {
  const theme = useTheme();
  const { status, label, color } = useConnectionLabel();

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

  return (
    <View style={styles.row}>
      <Animated.View style={[styles.dot, { backgroundColor: color }, dotStyle]} />
      {showLabel ? (
        <Text style={[styles.label, { color: theme.textSecondary }]}>{label}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs + 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontSize: 13 },
});
