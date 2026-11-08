import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Radius, Spacing, useTheme } from '@/constants/theme';
import type { ChatRow } from '@/lib/selectors';
import { StepsCard } from './StepsCard';

// One row of a chat: the user's prompt, a run of steps, a message or an approval
export function TimelineRow({
  row,
  pendingApprovalId,
}: {
  row: ChatRow;
  pendingApprovalId?: string;
}) {
  const theme = useTheme();

  if (row.kind === 'steps') return <StepsCard steps={row.steps} />;

  if (row.kind === 'prompt') {
    return (
      <View style={styles.row}>
        <UserBubble text={row.text} />
      </View>
    );
  }

  const { item } = row;
  return (
    <Animated.View entering={FadeInDown.duration(250)} style={styles.row}>
      {item.type === 'user' ? <UserBubble text={item.text} /> : null}

      {item.type === 'agent' ? (
        <View style={styles.agent}>
          <View style={[styles.avatar, { backgroundColor: theme.primarySoft }]}>
            <Text style={styles.avatarText}>🫐</Text>
          </View>
          <Text style={[styles.agentText, { color: theme.text }]}>{item.text}</Text>
        </View>
      ) : null}

      {item.type === 'approval' ? (
        <ApprovalCard
          question={item.question}
          approved={item.approved}
          pending={pendingApprovalId === item.id}
          onReview={() => router.push(`/approval/${item.id}`)}
        />
      ) : null}
    </Animated.View>
  );
}

function UserBubble({ text }: { text: string }) {
  const theme = useTheme();
  return (
    <View style={[styles.bubble, { backgroundColor: theme.primary }]}>
      <Text style={[styles.bubbleText, { color: theme.onPrimary }]}>{text}</Text>
    </View>
  );
}

function ApprovalCard({
  question,
  approved,
  pending,
  onReview,
}: {
  question: string;
  approved: boolean | null;
  pending: boolean;
  onReview: () => void;
}) {
  const theme = useTheme();
  const resolved = approved !== null;
  const tint = !resolved ? theme.warning : approved ? theme.success : theme.danger;

  return (
    <View style={[styles.approval, { backgroundColor: theme.card, borderColor: tint }]}>
      <View style={styles.approvalHeader}>
        <Ionicons
          name={!resolved ? 'hand-right' : approved ? 'checkmark-circle' : 'close-circle'}
          size={16}
          color={tint}
        />
        <Text style={[styles.approvalLabel, { color: tint }]}>
          {!resolved ? 'Needs your approval' : approved ? 'You approved' : 'You declined'}
        </Text>
      </View>
      <Text style={[styles.bubbleText, { color: theme.text }]}>{question}</Text>
      {pending ? (
        <Pressable
          onPress={onReview}
          style={[styles.reviewButton, { backgroundColor: theme.warning }]}>
          <Text style={styles.reviewText}>Review</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: Spacing.lg },
  bubble: {
    alignSelf: 'flex-end',
    maxWidth: '85%',
    borderRadius: Radius.lg,
    borderBottomRightRadius: Radius.sm / 2,
    paddingHorizontal: Spacing.md + 2,
    paddingVertical: Spacing.sm + 2,
  },
  bubbleText: { fontSize: 16, lineHeight: 22 },
  agent: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'flex-start',
    paddingRight: Spacing.xl,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 15 },
  agentText: { flex: 1, fontSize: 16, lineHeight: 23, paddingTop: 2 },
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
