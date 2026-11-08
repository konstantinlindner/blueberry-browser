import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router, Stack } from 'expo-router';
import type { ReactNode } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { ConnectionStatus } from '@/components/ConnectionStatus';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { unpair } from '@/lib/actions';
import { useStore } from '@/lib/store';

export default function SettingsScreen() {
  const theme = useTheme();
  const pairing = useStore((s) => s.pairing);
  const chatCount = useStore((s) => s.agent.order.length);

  const accountsComingSoon = () =>
    Alert.alert(
      'Blueberry accounts are coming soon',
      'Accounts will sync your chats across devices. Your phone is linked to your computer for now.',
    );

  const confirmUnlink = () =>
    Alert.alert(
      'Unlink this phone?',
      'You’ll need to scan the code on your computer again to use Blueberry from this phone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Unlink',
          style: 'destructive',
          onPress: () => {
            router.dismissAll();
            unpair();
          },
        },
      ],
    );

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <Text style={[styles.done, { color: theme.primary }]}>Done</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.content}>
        <Section title="Account">
          <Row
            icon="person-circle-outline"
            title="Not signed in"
            subtitle="Sign in to sync chats across devices"
            onPress={accountsComingSoon}
            chevron
          />
        </Section>

        <Section title="Computer">
          <Row icon="laptop-outline" title={pairing?.desktopName ?? 'Your computer'}>
            <ConnectionStatus />
          </Row>
          <Row
            icon="git-network-outline"
            title="Address"
            value={pairing ? `${pairing.host}:${pairing.port}` : '—'}
          />
          <Row icon="chatbubbles-outline" title="Chats" value={String(chatCount)} />
          <Row
            icon="unlink-outline"
            title="Unlink this phone"
            destructive
            onPress={confirmUnlink}
          />
        </Section>

        <Section title="About">
          <Row
            icon="information-circle-outline"
            title="Version"
            value={Constants.expoConfig?.version ?? '1.0.0'}
          />
          <Row icon="shield-outline" title="Privacy" onPress={accountsComingSoon} chevron />
        </Section>

        <Text style={[styles.footer, { color: theme.textSecondary }]}>Blueberry 🫐</Text>
      </ScrollView>
    </>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  const theme = useTheme();
  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>{title}</Text>
      <View style={[styles.card, { backgroundColor: theme.card }]}>{children}</View>
    </View>
  );
}

function Row({
  icon,
  title,
  subtitle,
  value,
  chevron,
  destructive,
  onPress,
  children,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle?: string;
  value?: string;
  chevron?: boolean;
  destructive?: boolean;
  onPress?: () => void;
  children?: ReactNode;
}) {
  const theme = useTheme();
  const color = destructive ? theme.danger : theme.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) =>
        StyleSheet.flatten([styles.row, pressed && { backgroundColor: theme.cardMuted }])
      }>
      <Ionicons name={icon} size={22} color={destructive ? theme.danger : theme.primary} />
      <View style={[styles.rowBody, { borderBottomColor: theme.border }]}>
        <View style={styles.rowText}>
          <Text style={[styles.rowTitle, { color }]} numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[styles.rowSubtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
          ) : null}
          {children}
        </View>
        {value ? (
          <Text style={[styles.rowValue, { color: theme.textSecondary }]}>{value}</Text>
        ) : null}
        {chevron ? <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  done: { fontSize: 17, fontWeight: '600' },
  content: { padding: Spacing.lg, gap: Spacing.xl },
  section: { gap: Spacing.sm },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginLeft: Spacing.lg,
  },
  card: { borderRadius: Radius.md, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingLeft: Spacing.lg },
  rowBody: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingRight: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowText: { flex: 1, gap: 3 },
  rowTitle: { fontSize: 16 },
  rowSubtitle: { fontSize: 13 },
  rowValue: { fontSize: 15 },
  footer: { textAlign: 'center', fontSize: 13 },
});
