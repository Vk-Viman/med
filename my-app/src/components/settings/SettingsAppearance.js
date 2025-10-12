import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function SettingsAppearance({
  theme,
  themeMode,
  setThemeMode,
  hapticsEnabled,
  toggleHaptics,
}) {
  const styles = createStyles(theme);

  const themes = [
    { id: "light", label: "Light", icon: "sunny-outline" },
    { id: "dark", label: "Dark", icon: "moon-outline" },
    { id: "auto", label: "Auto", icon: "contrast-outline" },
  ];

  return (
    <View>
      <Text style={styles.sectionTitle}>Appearance</Text>

      {/* Theme Selector */}
      <Text style={styles.label}>Theme</Text>
      <View style={styles.themeContainer}>
        {themes.map((t) => (
          <TouchableOpacity
            key={t.id}
            style={[
              styles.themeOption,
              themeMode === t.id && styles.themeOptionSelected,
            ]}
            onPress={() => setThemeMode(t.id)}
          >
            <Ionicons
              name={t.icon}
              size={24}
              color={themeMode === t.id ? theme.primary : theme.textSecondary}
            />
            <Text
              style={[
                styles.themeLabel,
                themeMode === t.id && styles.themeLabelSelected,
              ]}
            >
              {t.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Haptics */}
      <View style={styles.settingRow}>
        <View style={styles.settingLeft}>
          <Ionicons name="vibrate-outline" size={24} color={theme.primary} />
          <View style={styles.settingText}>
            <Text style={styles.settingTitle}>Haptic Feedback</Text>
            <Text style={styles.settingSubtitle}>
              Vibration for interactions
            </Text>
          </View>
        </View>
        <TouchableOpacity
          onPress={toggleHaptics}
          style={[
            styles.toggle,
            hapticsEnabled && styles.toggleActive,
          ]}
        >
          <View
            style={[
              styles.toggleThumb,
              hapticsEnabled && styles.toggleThumbActive,
            ]}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const createStyles = (theme) => StyleSheet.create({
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: theme.text,
    marginTop: 24,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.text,
    marginBottom: 12,
  },
  themeContainer: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 20,
  },
  themeOption: {
    flex: 1,
    backgroundColor: theme.card,
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 2,
    borderColor: theme.border,
  },
  themeOptionSelected: {
    borderColor: theme.primary,
    backgroundColor: theme.primary + "15",
  },
  themeLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: theme.textSecondary,
    marginTop: 8,
  },
  themeLabelSelected: {
    color: theme.primary,
    fontWeight: "600",
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  settingText: {
    marginLeft: 12,
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.text,
    marginBottom: 4,
  },
  settingSubtitle: {
    fontSize: 13,
    color: theme.textSecondary,
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: theme.border,
    justifyContent: "center",
    padding: 2,
  },
  toggleActive: {
    backgroundColor: theme.primary + "80",
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#fff",
    alignSelf: "flex-start",
  },
  toggleThumbActive: {
    alignSelf: "flex-end",
  },
});
