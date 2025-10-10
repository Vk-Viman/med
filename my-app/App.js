import { Slot } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { LogBox } from "react-native";
import Constants from "expo-constants";

LogBox.ignoreLogs([
  "expo-notifications: Android Push notifications (remote notifications) functionality provided by expo-notifications was removed from Expo Go",
]);

// Diagnostic: print manifest/runtime info to help debug OTA update issues.
// This is read-only and only logs values at startup.
try {
  const manifest = Constants.manifest || Constants.expoConfig || null;
  console.log("[OTA DIAG] Constants.manifest:", manifest);
  console.log("[OTA DIAG] runtimeVersion:", (manifest && manifest.runtimeVersion) || Constants.runtimeVersion || null);
  console.log("[OTA DIAG] updates.enabled (from manifest):", manifest && manifest.updates && manifest.updates.enabled);
  console.log("[OTA DIAG] appOwnership:", Constants.appOwnership);
  console.log("[OTA DIAG] expo.sdkVersion:", manifest && manifest.sdkVersion);
} catch (e) {
  // keep app from crashing if Constants is unavailable
  console.warn("[OTA DIAG] failed to read Constants for OTA diagnostics", e);
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Slot />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
