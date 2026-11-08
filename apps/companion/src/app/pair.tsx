import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { pair } from '@/lib/actions';
import { parsePairingUrl } from '@/lib/pairing';

export default function PairScreen() {
  const theme = useTheme();
  const [permission, requestPermission] = useCameraPermissions();
  const [manual, setManual] = useState(Platform.OS === 'web');
  const [link, setLink] = useState('');
  const [invalid, setInvalid] = useState(false);
  // The scanner fires many times per second; only act on the first valid code
  const handled = useRef(false);

  const tryPair = (raw: string): boolean => {
    const pairing = parsePairingUrl(raw);
    if (!pairing || handled.current) return false;
    handled.current = true;
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    pair(pairing); // the root layout switches to the tasks screen
    return true;
  };

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.logo}>🫐</Text>
          <Text style={[styles.title, { color: theme.text }]}>Pair with Blueberry</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            Start Blueberry on your computer and scan the code it prints in the terminal. Your phone
            and computer need to be on the same Wi-Fi.
          </Text>
        </View>

        {manual ? (
          <View style={styles.manual}>
            <TextInput
              value={link}
              onChangeText={(text) => {
                setLink(text);
                setInvalid(false);
              }}
              placeholder="blueberry://pair?host=…"
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              style={[
                styles.input,
                { color: theme.text, backgroundColor: theme.card, borderColor: theme.border },
              ]}
            />
            {invalid ? (
              <Text style={[styles.hint, { color: theme.danger }]}>
                That doesn’t look like a pairing link.
              </Text>
            ) : null}
            <Button
              title="Connect"
              onPress={() => setInvalid(!tryPair(link))}
              disabled={!link.trim()}
            />
          </View>
        ) : permission?.granted ? (
          <View style={[styles.cameraFrame, { borderColor: theme.primary }]}>
            <CameraView
              style={StyleSheet.absoluteFill}
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={({ data }) => tryPair(data)}
            />
          </View>
        ) : (
          <View style={styles.manual}>
            <Button
              title={permission?.canAskAgain === false ? 'Camera access denied' : 'Allow camera'}
              onPress={requestPermission}
              disabled={permission?.canAskAgain === false}
            />
          </View>
        )}

        {Platform.OS !== 'web' ? (
          <Button
            title={manual ? 'Scan a code instead' : 'Paste a link instead'}
            variant="secondary"
            onPress={() => setManual((m) => !m)}
          />
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { flex: 1, padding: Spacing.xl, gap: Spacing.xl, justifyContent: 'center' },
  header: { alignItems: 'center', gap: Spacing.sm },
  logo: { fontSize: 56 },
  title: { fontSize: 28, fontWeight: '800' },
  subtitle: { fontSize: 15, lineHeight: 21, textAlign: 'center' },
  cameraFrame: {
    aspectRatio: 1,
    width: '100%',
    maxWidth: 360,
    alignSelf: 'center',
    borderRadius: Radius.lg,
    borderWidth: 3,
    overflow: 'hidden',
  },
  manual: { gap: Spacing.md },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: 15,
  },
  hint: { fontSize: 13 },
});
