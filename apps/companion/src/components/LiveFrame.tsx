import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Radius, Spacing, useTheme } from '@/constants/theme';
import { useStore } from '@/lib/store';

interface Props {
  taskId: string;
  style?: StyleProp<ViewStyle>;
  live?: boolean;
}

export function LiveFrame({ taskId, style, live = false }: Props) {
  const theme = useTheme();
  const frame = useStore((s) => s.frames[taskId]);

  return (
    <View style={[styles.container, { backgroundColor: theme.frameBackdrop }, style]}>
      {frame ? (
        <Image
          source={{ uri: frame }}
          style={StyleSheet.absoluteFill}
          contentFit="contain"
          // expo-image cross-fades between sources, so frames blend instead of flashing
          transition={250}
          cachePolicy="none"
          accessibilityLabel="Live view of the agent's browser tab"
        />
      ) : (
        <View style={styles.placeholder}>
          <Ionicons name="globe-outline" size={28} color={theme.textSecondary} />
          <Text style={[styles.placeholderText, { color: theme.textSecondary }]}>
            Waiting for the browser…
          </Text>
        </View>
      )}
      {live && frame ? (
        <View style={[styles.liveBadge, { backgroundColor: theme.danger }]}>
          <Text style={styles.liveText}>LIVE</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: Radius.md,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: { alignItems: 'center', gap: Spacing.sm, padding: Spacing.xl },
  placeholderText: { fontSize: 13 },
  liveBadge: {
    position: 'absolute',
    top: Spacing.sm,
    left: Spacing.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  liveText: { color: '#fff', fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
});
