import { useColorScheme } from 'react-native';

export const Colors = {
  light: {
    background: '#F6F6FA',
    card: '#FFFFFF',
    cardMuted: '#EFEFF5',
    border: '#E4E4EE',
    text: '#14142B',
    textSecondary: '#6B6B85',
    primary: '#4C3FE0',
    primarySoft: '#ECEAFE',
    onPrimary: '#FFFFFF',
    success: '#169C55',
    warning: '#E08A00',
    danger: '#E5484D',
    frameBackdrop: '#E9E9F1',
  },
  dark: {
    background: '#0B0B13',
    card: '#17171F',
    cardMuted: '#1F1F2A',
    border: '#272734',
    text: '#F4F4FA',
    textSecondary: '#9A9AB2',
    primary: '#7D72FF',
    primarySoft: '#25214A',
    onPrimary: '#FFFFFF',
    success: '#3CCB7F',
    warning: '#FFB224',
    danger: '#FF6369',
    frameBackdrop: '#111119',
  },
} as const;

export type Theme = { [K in keyof typeof Colors.light]: string };

export function useTheme(): Theme {
  return Colors[useColorScheme() === 'dark' ? 'dark' : 'light'];
}

export const Spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const Radius = {
  sm: 8,
  md: 14,
  lg: 20,
  pill: 999,
} as const;
