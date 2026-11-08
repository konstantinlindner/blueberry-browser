import * as Haptics from 'expo-haptics';
import { DarkTheme, DefaultTheme, router, Stack, ThemeProvider } from 'expo-router';
import { useEffect, useRef } from 'react';
import { AppState, useColorScheme } from 'react-native';

import { Toast } from '@/components/Toast';
import { useTheme } from '@/constants/theme';
import { connection } from '@/lib/connection';
import { firstPendingApprovalId } from '@/lib/selectors';
import { useStore } from '@/lib/store';

export default function RootLayout() {
  const scheme = useColorScheme();
  const theme = useTheme();
  const paired = useStore((s) => s.pairing !== null);

  useConnectionLifecycle(paired);
  useApprovalWatcher();

  const navigationTheme = scheme === 'dark' ? DarkTheme : DefaultTheme;
  return (
    <ThemeProvider
      value={{
        ...navigationTheme,
        colors: { ...navigationTheme.colors, background: theme.background, primary: theme.primary },
      }}>
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerStyle: { backgroundColor: theme.background },
          headerTintColor: theme.primary,
          headerTitleStyle: { color: theme.text },
          contentStyle: { backgroundColor: theme.background },
        }}>
        <Stack.Protected guard={paired}>
          <Stack.Screen name="index" options={{ title: 'Blueberry', headerLargeTitle: true }} />
          <Stack.Screen name="task/[id]" options={{ title: '', headerBackTitle: 'Tasks' }} />
          <Stack.Screen
            name="approval/[id]"
            options={{
              presentation: 'formSheet',
              sheetAllowedDetents: [0.8, 1],
              sheetGrabberVisible: true,
              headerShown: false,
            }}
          />
        </Stack.Protected>
        <Stack.Protected guard={!paired}>
          <Stack.Screen name="pair" options={{ headerShown: false }} />
        </Stack.Protected>
      </Stack>
      <Toast />
    </ThemeProvider>
  );
}

// Connected while the app is in the foreground. iOS kills sockets in the
// background anyway; coming back reconnects and the snapshot catches us up.
function useConnectionLifecycle(paired: boolean) {
  useEffect(() => {
    if (!paired) return;
    if (AppState.currentState !== 'background') connection.connect();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') connection.connect();
      else if (state === 'background') connection.disconnect();
    });
    return () => {
      subscription.remove();
      connection.disconnect();
    };
  }, [paired]);
}

// Opens the approval sheet as soon as the agent asks, whether that arrives as
// a live event or in the snapshot after reopening the app. Each approval pops
// up once; if dismissed it stays reachable from the task screen.
function useApprovalWatcher() {
  const pendingId = useStore((s) => firstPendingApprovalId(s.agent));
  const shown = useRef(new Set<string>());

  useEffect(() => {
    if (!pendingId || shown.current.has(pendingId)) return;
    shown.current.add(pendingId);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    router.push(`/approval/${pendingId}`);
  }, [pendingId]);
}
