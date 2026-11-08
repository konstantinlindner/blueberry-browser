import { useHeaderHeight } from '@react-navigation/elements';
import { router, Stack } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Composer } from '@/components/Composer';
import { ConnectionPill } from '@/components/ConnectionPill';
import { ActiveTaskCard, TaskRow } from '@/components/TaskCard';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { startTask } from '@/lib/actions';
import { reportError, useStore } from '@/lib/store';

const SUGGESTIONS = [
  'Find a USB-C cable under 100 kr and add it to the cart',
  'What’s the top story on Hacker News right now?',
  'Look up tomorrow’s weather in Stockholm',
];

export default function TasksScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const agent = useStore((s) => s.agent);
  const connected = useStore((s) => s.status === 'open');
  // Bumped to remount the composer with a suggestion prefilled
  const [draft, setDraft] = useState({ key: 0, text: '' });

  const active = agent.activeTaskId ? agent.tasks[agent.activeTaskId] : null;
  const history = useMemo(
    () => agent.order.filter((id) => id !== agent.activeTaskId).map((id) => agent.tasks[id]),
    [agent],
  );

  const start = async (prompt: string) => {
    try {
      const taskId = await startTask(prompt);
      router.push(`/task/${taskId}`);
    } catch (error) {
      reportError((error as Error).message);
      throw error;
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerRight: () => <ConnectionPill /> }} />
      <KeyboardAvoidingView
        style={styles.screen}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={headerHeight}>
        <FlatList
          data={history}
          keyExtractor={(task) => task.id}
          contentInsetAdjustmentBehavior="automatic"
          keyboardDismissMode="interactive"
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            <View style={styles.header}>
              {active ? <ActiveTaskCard task={active} /> : null}
              {history.length > 0 ? (
                <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Earlier</Text>
              ) : null}
            </View>
          }
          ListEmptyComponent={
            active ? undefined : (
              <View style={styles.empty}>
                <Text style={styles.emptyLogo}>🫐</Text>
                <Text style={[styles.emptyTitle, { color: theme.text }]}>
                  What should Blueberry do?
                </Text>
                <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
                  Hand off a task and watch your browser do it. You’ll be asked before anything
                  irreversible.
                </Text>
                <View style={styles.suggestions}>
                  {SUGGESTIONS.map((text) => (
                    <Pressable
                      key={text}
                      onPress={() => setDraft((d) => ({ key: d.key + 1, text }))}
                      style={[styles.suggestion, { backgroundColor: theme.primarySoft }]}>
                      <Text style={[styles.suggestionText, { color: theme.primary }]}>{text}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            )
          }
          renderItem={({ item }) => <TaskRow task={item} />}
          ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
        />
        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
          <Composer
            key={draft.key}
            initialText={draft.text}
            placeholder={connected ? 'Ask Blueberry to do something…' : 'Waiting for your desktop…'}
            disabled={!connected}
            onSend={start}
          />
        </View>
      </KeyboardAvoidingView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg, flexGrow: 1 },
  header: { gap: Spacing.lg, paddingTop: Spacing.sm, paddingBottom: Spacing.sm },
  sectionTitle: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xxl,
  },
  emptyLogo: { fontSize: 48 },
  emptyTitle: { fontSize: 22, fontWeight: '700' },
  emptyText: { fontSize: 15, lineHeight: 21, textAlign: 'center', maxWidth: 300 },
  suggestions: { gap: Spacing.sm, marginTop: Spacing.lg, alignSelf: 'stretch' },
  suggestion: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  suggestionText: { fontSize: 15, fontWeight: '500' },
  composer: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
});
