import { Stack } from "expo-router";

export default function Layout() {
  return (
    <Stack initialRouteName="splash">
      <Stack.Screen name="splash" options={{ headerShown: false }} />
      <Stack.Screen name="login" options={{ title: "Login" }} />
      <Stack.Screen name="signup" options={{ title: "Sign Up" }} />
      <Stack.Screen name="index" options={{ title: "Home" }} />
      <Stack.Screen name="meditation" options={{ title: "Meditation Player" }} />
  <Stack.Screen name="plan" options={{ title: "Meditation Plan" }} />
  <Stack.Screen name="report" options={{ title: "Weekly Report" }} />
    </Stack>
  );
}
