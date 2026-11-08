import { isTerminal } from '@blueberry/protocol';
import { useHeaderHeight } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Composer } from '@/components/Composer';
import { LiveFrame } from '@/components/LiveFrame';
import { TimelineRow } from '@/components/TimelineRow';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { cancelTask, sendMessage } from '@/lib/actions';
import { statusMeta } from '@/lib/selectors';
import { useStore } from '@/lib/store';

export default function TaskScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { height } = useWindowDimensions();
  const task = useStore((s) => s.agent.tasks[id]);
  const connected = useStore((s) => s.status === 'open');
  const list = useRef<FlatList>(null);

  useFinishedHaptic(task?.status);

  if (!task) {
    return (
      <View style={styles.missing}>
        <Text style={{ color: theme.textSecondary }}>This task isn’t on your desktop anymore.</Text>
      </View>
    );
  }

  const meta = statusMeta(task.status, theme);
  const working = !isTerminal(task.status);

  const confirmCancel = () =>
    Alert.alert('Stop this task?', 'Blueberry will stop where it is.', [
      { text: 'Keep going', style: 'cancel' },
      { text: 'Stop', style: 'destructive', onPress: () => cancelTask(task.id) },
    ]);

  return (
    <>
      <Stack.Screen
        options={{
          title: meta.label,
          headerRight: working
            ? () => (
                <Pressable onPress={confirmCancel} hitSlop={8}>
                  <Text style={[styles.stop, { color: theme.danger }]}>Stop</Text>
                </Pressable>
              )
            : undefined,
        }}
      />
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={headerHeight}>
        <View style={styles.top}>
          <Text style={[styles.prompt, { color: theme.text }]} numberOfLines={3}>
            {task.prompt}
          </Text>
          <LiveFrame
            taskId={task.id}
            live={working}
            style={{ height: Math.round(height * 0.34) }}
          />
        </View>

        <FlatList
          ref={list}
          data={task.timeline}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <TimelineRow item={item} pending={task.pendingApproval?.id === item.id} />
          )}
          contentContainerStyle={styles.timeline}
          keyboardDismissMode="interactive"
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
          ListFooterComponent={
            task.summary ? (
              <Animated.View
                entering={FadeIn}
                style={[styles.summary, { backgroundColor: theme.primarySoft }]}>
                <Text style={[styles.summaryLabel, { color: theme.primary }]}>Result</Text>
                <Text style={[styles.summaryText, { color: theme.text }]}>{task.summary}</Text>
              </Animated.View>
            ) : undefined
          }
        />

        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
          <Composer
            placeholder={working ? 'Tell Blueberry something…' : 'Ask a follow-up…'}
            disabled={!connected}
            onSend={(text) => sendMessage(task.id, text)}
          />
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

function useFinishedHaptic(status: string | undefined) {
  const previous = useRef(status);
  useEffect(() => {
    if (previous.current && previous.current !== status) {
      if (status === 'done')
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (status === 'failed')
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    }
    previous.current = status;
  }, [status]);
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: Spacing.xl },
  top: { paddingHorizontal: Spacing.lg, gap: Spacing.md, paddingBottom: Spacing.sm },
  prompt: { fontSize: 20, fontWeight: '700', lineHeight: 26 },
  stop: { fontSize: 16, fontWeight: '600' },
  timeline: { paddingVertical: Spacing.sm, gap: Spacing.xs },
  summary: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
  summaryLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  summaryText: { fontSize: 15, lineHeight: 21 },
  composer: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
});
