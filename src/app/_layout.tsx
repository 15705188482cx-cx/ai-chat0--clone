import { ErrorBoundary } from "../components/ErrorBoundary";
import { Stack } from "expo-router";

export default function RootLayout() {
  return (
    <ErrorBoundary><Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
    </Stack></ErrorBoundary>
  );
}
