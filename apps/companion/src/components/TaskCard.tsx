import { Ionicons } from '@expo/vector-icons';
import type { Task } from '@blueberry/protocol';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';

import { Radius, Spacing, useTheme } from '@/constants/theme';
import { latestStep, statusMeta } from '@/lib/selectors';
import { LiveFrame } from './LiveFrame';

// Big card for the task that's running right now, with a live thumbnail
export function ActiveTaskCard({ task }: { task: Task }) {
  const theme = useTheme();
  const meta = statusMeta(task.status, theme);
  const step = latestStep(task);

  return (
    <Animated.View entering={FadeIn} layout={LinearTransition}>
      <Pressable
        onPress={() => router.push(`/task/${task.id}`)}
        style={[styles.activeCard, { backgroundColor: theme.card }]}>
        <LiveFrame taskId={task.id} style={styles.thumbnail} live />
        <View style={styles.activeBody}>
          <StatusLabel label={meta.label} color={meta.color} />
          <Text style={[styles.prompt, { color: theme.text }]} numberOfLines={2}>
            {task.prompt}
          </Text>
          {step ? (
            <Text style={[styles.secondary, { color: theme.textSecondary }]} numberOfLines={1}>
              {step.summary}
            </Text>
          ) : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

export function TaskRow({ task }: { task: Task }) {
  const theme = useTheme();
  const meta = statusMeta(task.status, theme);

  return (
    <Animated.View entering={FadeIn} layout={LinearTransition}>
      <Pressable
        onPress={() => router.push(`/task/${task.id}`)}
        style={[styles.row, { backgroundColor: theme.card }]}>
        <View style={styles.rowBody}>
          <Text style={[styles.rowPrompt, { color: theme.text }]} numberOfLines={1}>
            {task.prompt}
          </Text>
          <Text style={[styles.secondary, { color: theme.textSecondary }]} numberOfLines={1}>
            <Text style={{ color: meta.color }}>{meta.label}</Text>
            {task.summary ? ` · ${task.summary}` : ''}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
      </Pressable>
    </Animated.View>
  );
}

function StatusLabel({ label, color }: { label: string; color: string }) {
  return (
    <View style={styles.status}>
      <View style={[styles.statusDot, { backgroundColor: color }]} />
      <Text style={[styles.statusText, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  activeCard: {
    borderRadius: Radius.lg,
    padding: Spacing.md,
    flexDirection: 'row',
    gap: Spacing.md,
  },
  thumbnail: { width: 96, height: 114, borderRadius: Radius.sm },
  activeBody: { flex: 1, gap: Spacing.xs + 2, justifyContent: 'center' },
  prompt: { fontSize: 17, fontWeight: '600', lineHeight: 22 },
  secondary: { fontSize: 13 },
  status: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs + 2 },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  row: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  rowBody: { flex: 1, gap: 2 },
  rowPrompt: { fontSize: 15, fontWeight: '600' },
});
