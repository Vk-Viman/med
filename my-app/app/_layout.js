import { Stack } from "expo-router";
import { ThemeProvider } from "../src/theme/ThemeProvider";

export default function Layout() {
  return (
    <ThemeProvider>
      <Stack initialRouteName="splash">
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="splash" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ title: "Login" }} />
        <Stack.Screen name="signup" options={{ title: "Sign Up" }} />
  <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
  <Stack.Screen name="index" options={{ title: "Home" }} />
    <Stack.Screen name="meditation" options={{ title: "Meditation" }} />
        <Stack.Screen name="plan" options={{ title: "Meditation Plan" }} />
        <Stack.Screen name="report" options={{ title: "Weekly Report" }} />
        <Stack.Screen name="notifications" options={{ title: "Reminder Settings" }} />
        <Stack.Screen name="settings" options={{ title: "Settings" }} />
    <Stack.Screen name="moodTracker" options={{ title: "Mood & Stress Tracker" }} />
    <Stack.Screen name="wellnessReport" options={{ title: "Wellness Report" }} />
    <Stack.Screen name="biometricLogin" options={{ title: "Biometric Login" }} />
      </Stack>
    </ThemeProvider>
  );
}
