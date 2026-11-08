import { useHeaderHeight } from '@react-navigation/elements';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BrandMark } from '@/components/BrandMark';
import { Composer } from '@/components/Composer';
import { SUGGESTIONS } from '@/constants/suggestions';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { startTask } from '@/lib/actions';
import { reportError, useStore } from '@/lib/store';

export default function NewChatScreen() {
  const { prompt } = useLocalSearchParams<{ prompt?: string }>();
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const headerHeight = useHeaderHeight();
  const connected = useStore((s) => s.status === 'open');
  // Bumped to remount the composer with a suggestion filled in
  const [draft, setDraft] = useState({ key: 0, text: prompt ?? '' });

  const start = async (text: string) => {
    try {
      const taskId = await startTask(text);
      router.replace(`/chat/${taskId}`);
    } catch (error) {
      reportError((error as Error).message);
      throw error;
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={headerHeight}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <BrandMark size={56} />
        <Text style={[styles.title, { color: theme.text }]}>What should Blueberry do?</Text>
        <Text style={[styles.text, { color: theme.textSecondary }]}>
          It opens a new tab on your computer and works there. You’ll be asked before anything you
          can’t undo.
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
      </ScrollView>
      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, Spacing.md) }]}>
        <Composer
          key={draft.key}
          initialText={draft.text}
          autoFocus
          placeholder={connected ? 'Ask Blueberry to do something…' : 'Waiting for your computer…'}
          disabled={!connected}
          onSend={start}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.xl,
  },
  title: { fontSize: 22, fontWeight: '700', marginTop: Spacing.md },
  text: { fontSize: 15, lineHeight: 21, textAlign: 'center', maxWidth: 320 },
  suggestions: { gap: Spacing.sm, marginTop: Spacing.lg, alignSelf: 'stretch' },
  suggestion: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  suggestionText: { fontSize: 15, fontWeight: '500' },
  composer: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.sm },
});
