import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Radius, Spacing, useTheme } from '@/constants/theme';
import { useStore } from '@/lib/store';

const VISIBLE_MS = 3500;

// Shows errors from the desktop (or failed sends) briefly at the top
export function Toast() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const error = useStore((s) => s.error);
  // Hide by id rather than copying the error into state
  const [hiddenId, setHiddenId] = useState<number | null>(null);

  useEffect(() => {
    if (!error) return;
    const timer = setTimeout(() => setHiddenId(error.id), VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [error]);

  const visible = error && error.id !== hiddenId ? error : null;
  if (!visible) return null;
  return (
    <Animated.View
      key={visible.id}
      entering={FadeInUp}
      exiting={FadeOutUp}
      pointerEvents="none"
      style={[styles.toast, { top: insets.top + Spacing.sm, backgroundColor: theme.danger }]}>
      <Text style={styles.text}>{visible.message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  text: { color: '#fff', fontSize: 14, fontWeight: '600' },
});
