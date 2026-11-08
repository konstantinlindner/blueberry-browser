import { Ionicons } from '@expo/vector-icons';
import type { TimelineItem } from '@blueberry/protocol';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Radius, Spacing, useTheme, type Theme } from '@/constants/theme';

type IconName = keyof typeof Ionicons.glyphMap;

const TOOL_ICONS: Record<string, IconName> = {
  navigate: 'globe-outline',
  read_page: 'reader-outline',
  click: 'hand-left-outline',
  type: 'create-outline',
  scroll: 'swap-vertical-outline',
  ask_user: 'help-circle-outline',
};

export function TimelineRow({ item, pending }: { item: TimelineItem; pending: boolean }) {
  const theme = useTheme();
  return (
    <Animated.View entering={FadeInDown.duration(250)} style={styles.row}>
      {render(item, pending, theme)}
    </Animated.View>
  );
}

function render(item: TimelineItem, pending: boolean, theme: Theme) {
  switch (item.type) {
    case 'step': {
      const color = item.status === 'error' ? theme.danger : theme.textSecondary;
      return (
        <View style={styles.step}>
          <View style={[styles.stepIcon, { backgroundColor: theme.cardMuted }]}>
            {item.status === 'running' ? (
              <ActivityIndicator size="small" color={theme.primary} />
            ) : (
              <Ionicons name={TOOL_ICONS[item.tool] ?? 'ellipse-outline'} size={15} color={color} />
            )}
          </View>
          <Text
            style={[styles.stepText, { color: item.status === 'running' ? theme.text : color }]}
            numberOfLines={2}>
            {item.summary}
          </Text>
        </View>
      );
    }

    case 'agent':
      return (
        <View style={[styles.bubble, styles.agentBubble, { backgroundColor: theme.card }]}>
          <Text style={[styles.bubbleText, { color: theme.text }]}>{item.text}</Text>
        </View>
      );

    case 'user':
      return (
        <View style={[styles.bubble, styles.userBubble, { backgroundColor: theme.primary }]}>
          <Text style={[styles.bubbleText, { color: theme.onPrimary }]}>{item.text}</Text>
        </View>
      );

    case 'approval': {
      const resolved = item.approved !== null;
      const tint = !resolved ? theme.warning : item.approved ? theme.success : theme.danger;
      return (
        <View style={[styles.approval, { backgroundColor: theme.card, borderColor: tint }]}>
          <View style={styles.approvalHeader}>
            <Ionicons
              name={!resolved ? 'hand-right' : item.approved ? 'checkmark-circle' : 'close-circle'}
              size={16}
              color={tint}
            />
            <Text style={[styles.approvalLabel, { color: tint }]}>
              {!resolved ? 'Needs your approval' : item.approved ? 'Approved' : 'Declined'}
            </Text>
          </View>
          <Text style={[styles.bubbleText, { color: theme.text }]}>{item.question}</Text>
          {pending ? (
            <Pressable
              onPress={() => router.push(`/approval/${item.id}`)}
              style={[styles.reviewButton, { backgroundColor: theme.warning }]}>
              <Text style={styles.reviewText}>Review</Text>
            </Pressable>
          ) : null}
        </View>
      );
    }
  }
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.xs },
  step: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  stepIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: { flex: 1, fontSize: 14 },
  bubble: {
    maxWidth: '85%',
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm + 2,
  },
  agentBubble: { alignSelf: 'flex-start', borderTopLeftRadius: Radius.sm / 2 },
  userBubble: { alignSelf: 'flex-end', borderTopRightRadius: Radius.sm / 2 },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  approval: { borderWidth: 1.5, borderRadius: Radius.md, padding: Spacing.md, gap: Spacing.sm },
  approvalHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs + 2 },
  approvalLabel: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  reviewButton: {
    alignSelf: 'flex-start',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  reviewText: { color: '#1A1300', fontWeight: '700' },
});
