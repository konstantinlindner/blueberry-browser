import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { Radius, Spacing, useTheme } from '@/constants/theme';
import { pair } from '@/lib/actions';
import { probe } from '@/lib/connection';
import { parsePairingUrl, type Pairing } from '@/lib/pairing';

const FRAME_SIZE = 260;
const SUCCESS_PAUSE_MS = 1400;

type Phase =
  | { kind: 'scanning' }
  | { kind: 'connecting' }
  | { kind: 'connected'; desktopName: string };

export default function ScanScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const [phase, setPhase] = useState<Phase>({ kind: 'scanning' });
  const [manual, setManual] = useState(Platform.OS === 'web');
  const [link, setLink] = useState('');
  // The scanner fires many times per second; only act on one code at a time
  const busy = useRef(false);

  const connect = async (raw: string): Promise<boolean> => {
    const pairing = parsePairingUrl(raw);
    if (!pairing || busy.current) return false;
    busy.current = true;
    setPhase({ kind: 'connecting' });
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      // Make sure the code works before saving it
      const desktopName = await probe(pairing);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPhase({ kind: 'connected', desktopName });
      setTimeout(() => finish({ ...pairing, desktopName }), SUCCESS_PAUSE_MS);
    } catch (error) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Couldn’t link your phone', (error as Error).message, [
        {
          text: 'Try again',
          onPress: () => {
            busy.current = false;
            setPhase({ kind: 'scanning' });
          },
        },
      ]);
    }
    return true;
  };

  // Saving the pairing switches the app over to the chats screen
  const finish = (pairing: Pairing) => pair(pairing);

  const cameraReady = permission?.granted && !manual;

  return (
    <View style={[styles.screen, { backgroundColor: '#000' }]}>
      {cameraReady ? (
        <CameraView
          style={StyleSheet.absoluteFill}
          barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
          onBarcodeScanned={
            phase.kind === 'scanning' ? ({ data }) => void connect(data) : undefined
          }
        />
      ) : null}

      {/* Dim everything except the scan window */}
      {cameraReady ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <View style={styles.mask} />
          <View style={styles.maskRow}>
            <View style={styles.mask} />
            <View style={styles.window}>
              <Corner position="topLeft" />
              <Corner position="topRight" />
              <Corner position="bottomLeft" />
              <Corner position="bottomRight" />
            </View>
            <View style={styles.mask} />
          </View>
          <View style={styles.mask} />
        </View>
      ) : null}

      <View style={[styles.topBar, { paddingTop: insets.top + Spacing.sm }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityLabel="Close"
          style={styles.close}>
          <Ionicons name="close" size={26} color="#fff" />
        </Pressable>
      </View>

      {!cameraReady && !manual ? (
        <View style={styles.permission}>
          <Ionicons name="camera-outline" size={44} color="#fff" />
          <Text style={styles.permissionTitle}>Allow camera access</Text>
          <Text style={styles.permissionText}>
            Blueberry uses the camera to scan the code shown on your computer.
          </Text>
          <Button
            title={permission?.canAskAgain === false ? 'Open Settings' : 'Allow camera'}
            onPress={() =>
              permission?.canAskAgain === false ? Linking.openSettings() : requestPermission()
            }
            style={styles.permissionButton}
          />
        </View>
      ) : null}

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.bottomWrap}
        pointerEvents="box-none">
        <View
          style={[
            styles.sheet,
            { backgroundColor: theme.card, paddingBottom: insets.bottom + Spacing.lg },
          ]}>
          <Text style={[styles.sheetTitle, { color: theme.text }]}>
            Scan the code on your computer
          </Text>
          <View style={styles.instruction}>
            <Text style={[styles.instructionText, { color: theme.textSecondary }]}>
              In Blueberry, click the phone icon
            </Text>
            <View style={[styles.inlineIcon, { backgroundColor: theme.cardMuted }]}>
              <Ionicons name="phone-portrait-outline" size={14} color={theme.text} />
            </View>
            <Text style={[styles.instructionText, { color: theme.textSecondary }]}>
              in the toolbar.
            </Text>
          </View>

          {manual ? (
            <View style={styles.manual}>
              <TextInput
                value={link}
                onChangeText={setLink}
                placeholder="blueberry://pair?host=…"
                placeholderTextColor={theme.textSecondary}
                autoCapitalize="none"
                autoCorrect={false}
                style={[
                  styles.input,
                  {
                    color: theme.text,
                    backgroundColor: theme.background,
                    borderColor: theme.border,
                  },
                ]}
              />
              <Button
                title="Connect"
                disabled={!link.trim() || phase.kind !== 'scanning'}
                onPress={async () => {
                  if (!(await connect(link)))
                    Alert.alert('That doesn’t look like a Blueberry pairing link.');
                }}
              />
            </View>
          ) : null}

          {Platform.OS !== 'web' ? (
            <Pressable onPress={() => setManual((m) => !m)} hitSlop={8}>
              <Text style={[styles.link, { color: theme.primary }]}>
                {manual ? 'Scan a code instead' : 'Enter the link manually'}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </KeyboardAvoidingView>

      {phase.kind !== 'scanning' ? (
        <Animated.View entering={FadeIn} style={styles.overlay}>
          {phase.kind === 'connecting' ? (
            <>
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.overlayTitle}>Connecting…</Text>
            </>
          ) : (
            <>
              <Animated.View entering={ZoomIn.springify()}>
                <Ionicons name="checkmark-circle" size={72} color={theme.success} />
              </Animated.View>
              <Text style={styles.overlayTitle}>Linked</Text>
              <Text style={styles.overlayText}>{phase.desktopName}</Text>
            </>
          )}
        </Animated.View>
      ) : null}
    </View>
  );
}

function Corner({ position }: { position: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight' }) {
  const top = position.startsWith('top');
  const left = position.endsWith('Left');
  return (
    <View
      style={[
        styles.corner,
        top ? { top: 0, borderTopWidth: 4 } : { bottom: 0, borderBottomWidth: 4 },
        left ? { left: 0, borderLeftWidth: 4 } : { right: 0, borderRightWidth: 4 },
        {
          borderTopLeftRadius: top && left ? Radius.md : 0,
          borderTopRightRadius: top && !left ? Radius.md : 0,
          borderBottomLeftRadius: !top && left ? Radius.md : 0,
          borderBottomRightRadius: !top && !left ? Radius.md : 0,
        },
      ]}
    />
  );
}

const MASK = 'rgba(0,0,0,0.55)';

const styles = StyleSheet.create({
  screen: { flex: 1 },
  mask: { flex: 1, backgroundColor: MASK },
  maskRow: { flexDirection: 'row', height: FRAME_SIZE },
  window: { width: FRAME_SIZE, height: FRAME_SIZE },
  corner: { position: 'absolute', width: 36, height: 36, borderColor: '#fff' },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: Spacing.lg },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  permission: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.xxl,
    paddingBottom: 160,
  },
  permissionTitle: { color: '#fff', fontSize: 22, fontWeight: '700' },
  permissionText: { color: 'rgba(255,255,255,0.75)', fontSize: 15, textAlign: 'center' },
  permissionButton: { alignSelf: 'stretch', marginTop: Spacing.md },
  bottomWrap: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  sheet: {
    borderTopLeftRadius: Radius.lg + 4,
    borderTopRightRadius: Radius.lg + 4,
    paddingHorizontal: Spacing.xl,
    paddingTop: Spacing.xl,
    gap: Spacing.md,
  },
  sheetTitle: { fontSize: 20, fontWeight: '700' },
  instruction: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5 },
  instructionText: { fontSize: 15 },
  inlineIcon: { borderRadius: 6, paddingHorizontal: 5, paddingVertical: 3 },
  manual: { gap: Spacing.md },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    fontSize: 15,
  },
  link: { fontSize: 15, fontWeight: '600', paddingVertical: Spacing.xs },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  overlayTitle: { color: '#fff', fontSize: 22, fontWeight: '700' },
  overlayText: { color: 'rgba(255,255,255,0.75)', fontSize: 16 },
});
