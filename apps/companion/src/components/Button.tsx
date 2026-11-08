import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, type StyleProp, type ViewStyle } from 'react-native';

import { Radius, Spacing, useTheme } from '@/constants/theme';

interface Props {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'dark' | 'danger';
  icon?: keyof typeof Ionicons.glyphMap;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  icon,
  disabled = false,
  style,
}: Props) {
  const theme = useTheme();
  const colors = {
    primary: { background: theme.primary, text: theme.onPrimary, border: 'transparent' },
    secondary: { background: theme.cardMuted, text: theme.text, border: 'transparent' },
    outline: { background: theme.card, text: theme.text, border: theme.border },
    dark: { background: theme.text, text: theme.background, border: 'transparent' },
    danger: { background: theme.danger, text: theme.onPrimary, border: 'transparent' },
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) =>
        StyleSheet.flatten([
          styles.button,
          {
            backgroundColor: colors.background,
            borderColor: colors.border,
            opacity: disabled ? 0.4 : pressed ? 0.8 : 1,
          },
          style,
        ])
      }>
      {icon ? <Ionicons name={icon} size={19} color={colors.text} /> : null}
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    gap: Spacing.sm,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingVertical: Spacing.md + 2,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 16, fontWeight: '700' },
});
