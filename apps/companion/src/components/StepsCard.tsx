import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, LinearTransition } from 'react-native-reanimated';

import { Radius, Spacing, useTheme } from '@/constants/theme';
import type { StepItem } from '@/lib/selectors';

type IconName = keyof typeof Ionicons.glyphMap;

const TOOL_ICONS: Record<string, IconName> = {
  navigate: 'globe-outline',
  read_page: 'reader-outline',
  click: 'hand-left-outline',
  type: 'create-outline',
  scroll: 'swap-vertical-outline',
  ask_user: 'help-circle-outline',
};

const COLLAPSED_COUNT = 3;

// A run of browser actions between messages, shown as one activity card.
// Long runs collapse to the latest few steps.
export function StepsCard({ steps }: { steps: StepItem[] }) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const hidden = expanded ? 0 : Math.max(0, steps.length - COLLAPSED_COUNT);
  const visible = steps.slice(hidden);

  return (
    <Animated.View
      entering={FadeInDown.duration(250)}
      layout={LinearTransition}
      style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
      {hidden > 0 ? (
        <Pressable onPress={() => setExpanded(true)} style={styles.more} hitSlop={6}>
          <Ionicons name="chevron-down" size={14} color={theme.primary} />
          <Text style={[styles.moreText, { color: theme.primary }]}>
            {hidden} earlier {hidden === 1 ? 'step' : 'steps'}
          </Text>
        </Pressable>
      ) : null}
      {visible.map((step) => (
        <Animated.View key={step.id} entering={FadeInDown.duration(200)} style={styles.step}>
          <View style={[styles.icon, { backgroundColor: theme.cardMuted }]}>
            {step.status === 'running' ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <Ionicons
                name={TOOL_ICONS[step.tool] ?? 'ellipse-outline'}
                size={14}
                color={step.status === 'error' ? theme.danger : theme.textSecondary}
              />
            )}
          </View>
          <Text
            style={[
              styles.text,
              {
                color:
                  step.status === 'running'
                    ? theme.text
                    : step.status === 'error'
                      ? theme.danger
                      : theme.textSecondary,
              },
            ]}
            numberOfLines={2}>
            {step.summary}
          </Text>
        </Animated.View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    gap: Spacing.xs,
  },
  more: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  moreText: { fontSize: 13, fontWeight: '600' },
  step: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: 3 },
  icon: { width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, fontSize: 14 },
});
