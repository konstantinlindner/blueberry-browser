import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Radius, Spacing, useTheme } from '@/constants/theme';

interface Props {
  placeholder: string;
  // Return false (or reject) to keep the text, e.g. when sending failed
  onSend: (text: string) => boolean | void | Promise<unknown>;
  disabled?: boolean;
  initialText?: string;
  autoFocus?: boolean;
}

export function Composer({
  placeholder,
  onSend,
  disabled = false,
  initialText = '',
  autoFocus = false,
}: Props) {
  const theme = useTheme();
  const [text, setText] = useState(initialText);
  const [sending, setSending] = useState(false);
  const canSend = text.trim().length > 0 && !disabled && !sending;

  const submit = async () => {
    if (!canSend) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSending(true);
    try {
      const result = await onSend(text.trim());
      if (result !== false) setText('');
    } catch {
      // the caller reports the error; keep the text so it can be retried
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.card, borderColor: theme.border }]}>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={placeholder}
        placeholderTextColor={theme.textSecondary}
        style={[styles.input, { color: theme.text }]}
        multiline
        autoFocus={autoFocus}
        editable={!sending}
        submitBehavior="submit"
        onSubmitEditing={submit}
        returnKeyType="send"
      />
      <Pressable
        onPress={submit}
        disabled={!canSend}
        accessibilityRole="button"
        accessibilityLabel="Send"
        style={[styles.send, { backgroundColor: canSend ? theme.primary : theme.cardMuted }]}>
        {sending ? (
          <ActivityIndicator size="small" color={theme.onPrimary} />
        ) : (
          <Ionicons
            name="arrow-up"
            size={20}
            color={canSend ? theme.onPrimary : theme.textSecondary}
          />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.lg,
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.xs + 2,
    paddingVertical: Spacing.xs + 2,
    gap: Spacing.sm,
  },
  input: { flex: 1, fontSize: 16, maxHeight: 120, paddingVertical: Spacing.sm },
  send: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
