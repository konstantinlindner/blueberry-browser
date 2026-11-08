import { Ionicons } from '@expo/vector-icons';
import { isTerminal } from '@blueberry/protocol';
import { useHeaderHeight } from '@react-navigation/elements';
import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
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
import Animated, { FadeIn, useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Composer } from '@/components/Composer';
import { LiveFrame } from '@/components/LiveFrame';
import { TimelineRow } from '@/components/TimelineRow';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { cancelTask, sendMessage } from '@/lib/actions';
import { chatRows, statusMeta, type ChatRow } from '@/lib/selectors';
import { useStore } from '@/lib/store';

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const { height } = useWindowDimensions();
  const task = useStore((s) => s.agent.tasks[id]);
  const connected = useStore((s) => s.status === 'open');
  const list = useRef<FlatList<ChatRow>>(null);
  const [expanded, setExpanded] = useState(false);

  useFinishedHaptic(task?.status);
  const rows = useMemo(() => (task ? chatRows(task) : []), [task]);

  // Tap the live view to make it bigger
  const frameStyle = useAnimatedStyle(() => ({
    height: withTiming(Math.round(height * (expanded ? 0.55 : 0.26))),
  }));

  if (!task) {
    return (
      <View style={styles.missing}>
        <Text style={{ color: theme.textSecondary }}>
          This chat isn’t on your computer anymore.
        </Text>
      </View>
    );
  }

  const meta = statusMeta(task, theme);
  const working = !isTerminal(task.status);

  const confirmStop = () =>
    Alert.alert('Stop this task?', 'Blueberry will stop where it is.', [
      { text: 'Keep going', style: 'cancel' },
      { text: 'Stop', style: 'destructive', onPress: () => cancelTask(task.id) },
    ]);

  return (
    <>
      <Stack.Screen
        options={{
          headerTitle: () => (
            <View style={styles.headerTitle}>
              <Text style={[styles.headerName, { color: theme.text }]} numberOfLines={1}>
                {task.prompt}
              </Text>
              <Text style={[styles.headerStatus, { color: meta.color }]}>{meta.label}</Text>
            </View>
          ),
          headerRight: working
            ? () => (
                <Pressable onPress={confirmStop} hitSlop={8} accessibilityLabel="Stop task">
                  <Ionicons name="stop-circle-outline" size={26} color={theme.danger} />
                </Pressable>
              )
            : undefined,
        }}
      />
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={headerHeight}>
        <Pressable onPress={() => setExpanded((e) => !e)} style={styles.frameWrap}>
          <Animated.View style={frameStyle}>
            <LiveFrame taskId={task.id} live={working} style={styles.frame} />
          </Animated.View>
          <View style={[styles.expandHint, { backgroundColor: theme.card }]}>
            <Ionicons
              name={expanded ? 'contract' : 'expand'}
              size={13}
              color={theme.textSecondary}
            />
          </View>
        </Pressable>

        <FlatList
          ref={list}
          data={rows}
          keyExtractor={(row) => row.id}
          renderItem={({ item }) => (
            <TimelineRow row={item} pendingApprovalId={task.pendingApproval?.id} />
          )}
          contentContainerStyle={styles.timeline}
          keyboardDismissMode="interactive"
          onContentSizeChange={() => list.current?.scrollToEnd({ animated: true })}
          ListFooterComponent={
            task.summary || task.status === 'failed' || task.status === 'cancelled' ? (
              <Animated.View
                entering={FadeIn}
                style={[
                  styles.result,
                  {
                    backgroundColor: task.status === 'done' ? theme.primarySoft : theme.cardMuted,
                  },
                ]}>
                <Text style={[styles.resultLabel, { color: meta.color }]}>
                  {task.status === 'done' ? 'Result' : meta.label}
                </Text>
                <Text style={[styles.resultText, { color: theme.text }]}>
                  {task.status === 'done'
                    ? task.summary
                    : task.status === 'cancelled'
                      ? 'You stopped this task. Send a message to pick it up again.'
                      : 'Something went wrong. Send a message to try again.'}
                </Text>
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
  headerTitle: { alignItems: 'center', maxWidth: 230 },
  headerName: { fontSize: 16, fontWeight: '600' },
  headerStatus: { fontSize: 12, fontWeight: '600' },
  frameWrap: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },
  frame: { flex: 1 },
  expandHint: {
    position: 'absolute',
    right: Spacing.lg + Spacing.sm,
    bottom: Spacing.sm + Spacing.sm,
    padding: 6,
    borderRadius: Radius.sm,
  },
  timeline: { paddingVertical: Spacing.md, gap: Spacing.md },
  result: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    gap: Spacing.xs,
  },
  resultLabel: { fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  resultText: { fontSize: 15, lineHeight: 21 },
  composer: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
});
