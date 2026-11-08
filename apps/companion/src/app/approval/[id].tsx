import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { LiveFrame } from '@/components/LiveFrame';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { respondToApproval } from '@/lib/actions';
import { findApproval } from '@/lib/selectors';
import { useStore } from '@/lib/store';

export default function ApprovalSheet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  // Select the stable agent state; findApproval builds a new object each call
  const agent = useStore((s) => s.agent);
  const found = findApproval(agent, id);
  const connected = useStore((s) => s.status === 'open');
  const [note, setNote] = useState('');

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  if (!found) {
    return (
      <View style={[styles.sheet, styles.handled, { backgroundColor: theme.background }]}>
        <Ionicons name="checkmark-circle" size={40} color={theme.success} />
        <Text style={[styles.handledText, { color: theme.textSecondary }]}>
          This was already handled.
        </Text>
        <Button title="Close" variant="secondary" onPress={close} />
      </View>
    );
  }

  const respond = (approved: boolean) => {
    if (!respondToApproval(found.approval.id, approved, note.trim())) return;
    void Haptics.notificationAsync(
      approved
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning,
    );
    close();
  };

  return (
    <View
      style={[
        styles.sheet,
        { backgroundColor: theme.background, paddingBottom: insets.bottom + Spacing.lg },
      ]}>
      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: theme.warning }]}>
          <Ionicons name="hand-right" size={14} color="#1A1300" />
          <Text style={styles.badgeText}>Needs your approval</Text>
        </View>
        <Text style={[styles.question, { color: theme.text }]}>{found.approval.question}</Text>
        <Text style={[styles.task, { color: theme.textSecondary }]} numberOfLines={1}>
          {found.task.prompt}
        </Text>
      </View>

      <LiveFrame taskId={found.task.id} style={styles.frame} />

      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Add a note (optional)"
        placeholderTextColor={theme.textSecondary}
        style={[
          styles.note,
          { color: theme.text, backgroundColor: theme.card, borderColor: theme.border },
        ]}
      />

      <View style={styles.actions}>
        <Button
          title="Deny"
          variant="secondary"
          onPress={() => respond(false)}
          disabled={!connected}
          style={styles.action}
        />
        <Button
          title="Approve"
          onPress={() => respond(true)}
          disabled={!connected}
          style={styles.action}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, padding: Spacing.xl, gap: Spacing.lg },
  handled: { alignItems: 'center', justifyContent: 'center' },
  handledText: { fontSize: 15 },
  header: { gap: Spacing.sm },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    alignSelf: 'flex-start',
    borderRadius: Radius.pill,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
  },
  badgeText: { color: '#1A1300', fontSize: 12, fontWeight: '700' },
  question: { fontSize: 22, fontWeight: '700', lineHeight: 28 },
  task: { fontSize: 14 },
  frame: { flex: 1, minHeight: 160 },
  note: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: 15,
  },
  actions: { flexDirection: 'row', gap: Spacing.md },
  action: { flex: 1 },
});
