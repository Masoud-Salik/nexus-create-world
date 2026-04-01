import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '../src/components/ThemeProvider';
import { AuthProvider } from '../src/providers/AuthProvider';
import { StudyProvider } from '../src/providers/StudyProvider';
import { NotificationProvider } from '../src/providers/NotificationProvider';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <StudyProvider>
              <NotificationProvider>
                <Stack>
                  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                  <Stack.Screen name="auth" options={{ headerShown: false }} />
                  <Stack.Screen name="study/[id]" options={{ title: 'Study Session' }} />
                  <Stack.Screen name="chat/[id]" options={{ title: 'Chat' }} />
                  <Stack.Screen name="settings" options={{ title: 'Settings' }} />
                </Stack>
                <StatusBar style="auto" />
              </NotificationProvider>
            </StudyProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
