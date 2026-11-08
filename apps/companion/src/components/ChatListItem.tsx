import { Ionicons } from '@expo/vector-icons';
import type { Task } from '@blueberry/protocol';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { Radius, Spacing, useTheme } from '@/constants/theme';
import { chatPreview, relativeTime, statusMeta } from '@/lib/selectors';
import { LiveFrame } from './LiveFrame';

export function ChatListItem({ task }: { task: Task }) {
  const theme = useTheme();
  const meta = statusMeta(task, theme);
  const waiting = task.status === 'waiting';

  return (
    <Animated.View entering={FadeIn} layout={LinearTransition}>
      <Pressable
        onPress={() => router.push(`/chat/${task.id}`)}
        style={({ pressed }) =>
          StyleSheet.flatten([
            styles.row,
            { backgroundColor: pressed ? theme.cardMuted : theme.card },
          ])
        }>
        <LiveFrame taskId={task.id} style={styles.thumbnail} />
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
              {task.prompt}
            </Text>
            <Text style={[styles.time, { color: theme.textSecondary }]}>
              {relativeTime(task.createdAt)}
            </Text>
          </View>
          <Text
            style={[styles.preview, { color: waiting ? theme.text : theme.textSecondary }]}
            numberOfLines={2}>
            {chatPreview(task)}
          </Text>
          <View style={styles.statusRow}>
            {task.status === 'running' ? (
              <ActivityIndicator size="small" color={meta.color} style={styles.spinner} />
            ) : (
              <Ionicons name={statusIcon(task)} size={13} color={meta.color} />
            )}
            <Text style={[styles.status, { color: meta.color }]}>{meta.label}</Text>
          </View>
        </View>
        {waiting ? <View style={[styles.badge, { backgroundColor: theme.warning }]} /> : null}
      </Pressable>
    </Animated.View>
  );
}

function statusIcon(task: Task): keyof typeof Ionicons.glyphMap {
  switch (task.status) {
    case 'waiting':
      return 'hand-right';
    case 'done':
      return 'checkmark-circle';
    case 'failed':
      return 'alert-circle';
    default:
      return 'stop-circle';
  }
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    alignItems: 'center',
  },
  thumbnail: { width: 58, height: 70, borderRadius: Radius.sm },
  body: { flex: 1, gap: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.sm },
  title: { flex: 1, fontSize: 16, fontWeight: '600' },
  time: { fontSize: 13 },
  preview: { fontSize: 14, lineHeight: 19 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  spinner: { transform: [{ scale: 0.6 }], width: 13, height: 13 },
  status: { fontSize: 12, fontWeight: '600' },
  badge: { width: 10, height: 10, borderRadius: 5 },
});
