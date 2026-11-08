import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text } from 'react-native';

// The app icon, drawn in code since Expo Go shows its own icon
export function BrandMark({ size = 72 }: { size?: number }) {
  return (
    <LinearGradient
      colors={['#7D72FF', '#4C3FE0', '#2E24A8']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.mark, { width: size, height: size, borderRadius: size * 0.28 }]}>
      <Text style={{ fontSize: size * 0.5 }}>🫐</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  mark: {
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#4C3FE0',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
});
