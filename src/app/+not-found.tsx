import { Link, Stack } from 'expo-router';
import { Text, View } from 'react-native';

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not Found' }} />
      <View
        style={{
          flex: 1,
          backgroundColor: '#111111',
          justifyContent: 'center',
          alignItems: 'center',
          gap: 16,
        }}>
        <Text style={{ color: '#ffffff', fontSize: 20, fontWeight: '700' }}>
          Page Not Found
        </Text>
        <Link href="/" style={{ color: '#818cf8', fontSize: 15 }}>
          Go to Home
        </Link>
      </View>
    </>
  );
}
