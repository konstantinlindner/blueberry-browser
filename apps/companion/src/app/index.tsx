import { Ionicons } from '@expo/vector-icons';
import type { Task } from '@blueberry/protocol';
import { router, Stack } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, SectionList, StyleSheet, Text, View } from 'react-native';

import { BrandMark } from '@/components/BrandMark';
import { Button } from '@/components/Button';
import { ChatListItem } from '@/components/ChatListItem';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { HeaderButton } from '@/components/HeaderButton';
import { SUGGESTIONS } from '@/constants/suggestions';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { isActive } from '@/lib/selectors';
import { useStore } from '@/lib/store';

export default function ChatsScreen() {
  const theme = useTheme();
  const agent = useStore((s) => s.agent);

  const sections = useMemo(() => {
    const tasks = agent.order.map((id) => agent.tasks[id]);
    return [
      { title: 'Active', data: tasks.filter(isActive) },
      { title: 'Earlier', data: tasks.filter((task) => !isActive(task)) },
    ].filter((section) => section.data.length > 0);
  }, [agent]);

  return (
    <>
      <Stack.Screen
        options={{
          headerLeft: () => (
            <HeaderButton
              icon="person-circle-outline"
              label="Settings"
              onPress={() => router.push('/settings')}
            />
          ),
          headerRight: () => (
            <HeaderButton
              icon="create-outline"
              label="New chat"
              onPress={() => router.push('/chat/new')}
            />
          ),
        }}
      />
      <SectionList<Task>
        sections={sections}
        keyExtractor={(task) => task.id}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={<ComputerCard />}
        renderSectionHeader={({ section }) => (
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{section.title}</Text>
        )}
        renderItem={({ item }) => <ChatListItem task={item} />}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
        ListEmptyComponent={<EmptyChats />}
      />
    </>
  );
}

// Which computer this phone drives, and whether it's reachable
function ComputerCard() {
  const theme = useTheme();
  const desktopName = useStore((s) => s.pairing?.desktopName ?? 'Your computer');

  return (
    <Pressable
      onPress={() => router.push('/settings')}
      style={[styles.computer, { backgroundColor: theme.card }]}>
      <View style={[styles.computerIcon, { backgroundColor: theme.primarySoft }]}>
        <Ionicons name="laptop-outline" size={20} color={theme.primary} />
      </View>
      <View style={styles.computerText}>
        <Text style={[styles.computerName, { color: theme.text }]} numberOfLines={1}>
          {desktopName}
        </Text>
        <ConnectionStatus />
      </View>
      <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
    </Pressable>
  );
}

function EmptyChats() {
  const theme = useTheme();
  return (
    <View style={styles.empty}>
      <BrandMark size={64} />
      <Text style={[styles.emptyTitle, { color: theme.text }]}>No chats yet</Text>
      <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
        Start a chat and Blueberry gets to work in your browser. You can run several at once.
      </Text>
      <Button
        title="Start a chat"
        icon="create-outline"
        onPress={() => router.push('/chat/new')}
        style={styles.emptyButton}
      />
      <View style={styles.suggestions}>
        {SUGGESTIONS.map((prompt) => (
          <Pressable
            key={prompt}
            onPress={() => router.push({ pathname: '/chat/new', params: { prompt } })}
            style={[styles.suggestion, { backgroundColor: theme.primarySoft }]}>
            <Text style={[styles.suggestionText, { color: theme.primary }]}>{prompt}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xxl, flexGrow: 1 },
  computer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.md,
    borderRadius: Radius.lg,
    marginTop: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  computerIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  computerText: { flex: 1, gap: 2 },
  computerName: { fontSize: 16, fontWeight: '600' },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  empty: { alignItems: 'center', gap: Spacing.sm, paddingTop: Spacing.xxl },
  emptyTitle: { fontSize: 22, fontWeight: '700', marginTop: Spacing.md },
  emptyText: { fontSize: 15, lineHeight: 21, textAlign: 'center', maxWidth: 300 },
  emptyButton: { marginTop: Spacing.md, alignSelf: 'stretch' },
  suggestions: { gap: Spacing.sm, marginTop: Spacing.lg, alignSelf: 'stretch' },
  suggestion: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  suggestionText: { fontSize: 15, fontWeight: '500' },
});
