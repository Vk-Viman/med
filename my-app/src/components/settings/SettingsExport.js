import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from 'expo-linear-gradient';

export default function SettingsExport({
  theme,
  exporting,
  handleExport,
  handleExportMarkdown,
  handleExportRange,
  rangeExporting,
}) {
  const styles = createStyles(theme);

  return (
    <View>
      <Text style={styles.sectionTitle}>Export Data</Text>
      <Text style={styles.sectionSubtitle}>
        Download your data for backup or transfer
      </Text>

      {/* Export All (CSV) */}
      <TouchableOpacity
        style={styles.exportButton}
        onPress={handleExport}
        disabled={exporting}
      >
        <LinearGradient
          colors={['#0288D1', '#01579B']}
          style={styles.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.buttonContent}>
            <Ionicons name="download-outline" size={20} color="#fff" />
            <Text style={styles.exportButtonText}>
              {exporting ? "Exporting..." : "Export All Data (CSV)"}
            </Text>
            {exporting && <ActivityIndicator size="small" color="#fff" />}
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {/* Export Markdown */}
      <TouchableOpacity
        style={styles.exportButton}
        onPress={handleExportMarkdown}
        disabled={exporting}
      >
        <LinearGradient
          colors={['#7B1FA2', '#4A148C']}
          style={styles.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.buttonContent}>
            <Ionicons name="document-text-outline" size={20} color="#fff" />
            <Text style={styles.exportButtonText}>
              {exporting ? "Exporting..." : "Export as Markdown"}
            </Text>
            {exporting && <ActivityIndicator size="small" color="#fff" />}
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {/* Export Date Range */}
      <TouchableOpacity
        style={styles.exportButton}
        onPress={handleExportRange}
        disabled={rangeExporting}
      >
        <LinearGradient
          colors={['#00897B', '#004D40']}
          style={styles.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.buttonContent}>
            <Ionicons name="calendar-outline" size={20} color="#fff" />
            <Text style={styles.exportButtonText}>
              {rangeExporting ? "Exporting..." : "Export Date Range"}
            </Text>
            {rangeExporting && <ActivityIndicator size="small" color="#fff" />}
          </View>
        </LinearGradient>
      </TouchableOpacity>

      <View style={styles.infoBox}>
        <Ionicons name="information-circle-outline" size={20} color={theme.primary} />
        <Text style={styles.infoText}>
          Exports include mood entries, sessions, and meditation history
        </Text>
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
    marginBottom: 8,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: theme.textSecondary,
    marginBottom: 16,
  },
  exportButton: {
    borderRadius: 12,
    overflow: "hidden",
    marginBottom: 12,
  },
  gradient: {
    padding: 16,
  },
  buttonContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  exportButtonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: theme.card,
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    borderLeftWidth: 4,
    borderLeftColor: theme.primary,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: theme.textSecondary,
    marginLeft: 12,
    lineHeight: 18,
  },
});
