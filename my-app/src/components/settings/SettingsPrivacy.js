import React from "react";
import { View, Text, StyleSheet, Switch, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

export default function SettingsPrivacy({
  theme,
  localOnly,
  toggleLocalOnly,
  autoLock,
  setAutoLock,
  biometricPref,
  toggleBiometric,
  analyticsOptOut,
  toggleAnalytics,
}) {
  const styles = createStyles(theme);

  const INTERVAL_OPTIONS = [
    { label: "Disabled", value: 0 },
    { label: "30 seconds", value: 30 },
    { label: "1 minute", value: 60 },
    { label: "5 minutes", value: 300 },
    { label: "10 minutes", value: 600 },
  ];

  return (
    <View>
      <Text style={styles.sectionTitle}>Privacy & Security</Text>

      {/* Local Only Mode */}
      <View style={styles.settingRow}>
        <View style={styles.settingLeft}>
          <Ionicons name="shield-outline" size={24} color={theme.primary} />
          <View style={styles.settingText}>
            <Text style={styles.settingTitle}>Local Only Mode</Text>
            <Text style={styles.settingSubtitle}>
              Keep all data on device only
            </Text>
          </View>
        </View>
        <Switch
          value={localOnly}
          onValueChange={toggleLocalOnly}
          trackColor={{ false: theme.border, true: theme.primary + "80" }}
          thumbColor={localOnly ? theme.primary : theme.textSecondary}
        />
      </View>

      {/* Auto Lock */}
      <View style={styles.settingRow}>
        <View style={styles.settingLeft}>
          <Ionicons name="lock-closed-outline" size={24} color={theme.primary} />
          <View style={styles.settingText}>
            <Text style={styles.settingTitle}>Auto Lock</Text>
            <Text style={styles.settingSubtitle}>
              Lock app after inactivity
            </Text>
          </View>
        </View>
      </View>
      <View style={styles.pickerContainer}>
        {INTERVAL_OPTIONS.map((option) => (
          <TouchableOpacity
            key={option.value}
            style={[
              styles.pickerOption,
              autoLock === option.value && styles.pickerOptionSelected,
            ]}
            onPress={() => setAutoLock(option.value)}
          >
            <Text
              style={[
                styles.pickerText,
                autoLock === option.value && styles.pickerTextSelected,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Biometric Login */}
      <View style={styles.settingRow}>
        <View style={styles.settingLeft}>
          <Ionicons name="finger-print-outline" size={24} color={theme.primary} />
          <View style={styles.settingText}>
            <Text style={styles.settingTitle}>Biometric Login</Text>
            <Text style={styles.settingSubtitle}>
              Use fingerprint/face to unlock
            </Text>
          </View>
        </View>
        <Switch
          value={biometricPref}
          onValueChange={toggleBiometric}
          trackColor={{ false: theme.border, true: theme.primary + "80" }}
          thumbColor={biometricPref ? theme.primary : theme.textSecondary}
        />
      </View>

      {/* Analytics Opt-Out */}
      <View style={styles.settingRow}>
        <View style={styles.settingLeft}>
          <Ionicons name="analytics-outline" size={24} color={theme.primary} />
          <View style={styles.settingText}>
            <Text style={styles.settingTitle}>Opt Out of Analytics</Text>
            <Text style={styles.settingSubtitle}>
              Disable usage tracking
            </Text>
          </View>
        </View>
        <Switch
          value={analyticsOptOut}
          onValueChange={toggleAnalytics}
          trackColor={{ false: theme.border, true: theme.primary + "80" }}
          thumbColor={analyticsOptOut ? theme.primary : theme.textSecondary}
        />
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
  pickerContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  pickerOption: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
  },
  pickerOptionSelected: {
    backgroundColor: theme.primary + "20",
    borderColor: theme.primary,
  },
  pickerText: {
    fontSize: 14,
    color: theme.textSecondary,
    fontWeight: "500",
  },
  pickerTextSelected: {
    color: theme.primary,
    fontWeight: "600",
  },
});
