import { Stack } from 'expo-router';
import { AuthProvider } from '../src/auth';
import { LanguageProvider } from '../src/i18n';
import { NotificationsProvider } from '../src/notifications';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <LanguageProvider>
        <AuthProvider>
          <NotificationsProvider>
            <StatusBar style="dark" />
            <Stack screenOptions={{ headerShown: false }}>
              <Stack.Screen name="index" />
              <Stack.Screen name="login" />
              <Stack.Screen name="register" />
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="employee-report/[userId]" />
              <Stack.Screen name="task/[id]" />
              <Stack.Screen name="shift-edit/[id]" />
              <Stack.Screen name="swap/[targetId]" />
              <Stack.Screen name="notifications" />
              <Stack.Screen name="admin-swaps" />
              <Stack.Screen name="admin-approvals" />
              <Stack.Screen name="swap-from/[id]" />
            </Stack>
          </NotificationsProvider>
        </AuthProvider>
      </LanguageProvider>
    </SafeAreaProvider>
  );
}
