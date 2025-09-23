import { Stack } from "expo-router";

export default function Layout() {
  return (
    <Stack initialRouteName="SplashScreen">
      <Stack.Screen name="SplashScreen" options={{ headerShown: false }} />
      <Stack.Screen name="LoginScreen" options={{ title: "Login" }} />
      <Stack.Screen name="SignupScreen" options={{ title: "Sign Up" }} />
      <Stack.Screen name="HomeScreen" options={{ title: "Home" }} />
      <Stack.Screen name="MeditationPlayerScreen" options={{ title: "Meditation Player" }} />
  <Stack.Screen name="ReminderScreen" options={{ title: "Reminders" }} />
    </Stack>
  );
}
