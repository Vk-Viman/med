import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import PrimaryButton from "../PrimaryButton";

export default function SettingsAdvanced({
  theme,
  handleChangePassword,
  handleDeleteAccount,
  handleLogout,
}) {
  const styles = createStyles(theme);

  const confirmDelete = () => {
    Alert.alert(
      "Delete Account",
      "Are you absolutely sure? This action cannot be undone. All your data will be permanently deleted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: handleDeleteAccount,
        },
      ]
    );
  };

  return (
    <View>
      <Text style={styles.sectionTitle}>Advanced</Text>

      {/* Change Password */}
      <TouchableOpacity style={styles.actionButton} onPress={handleChangePassword}>
        <View style={styles.actionLeft}>
          <Ionicons name="key-outline" size={24} color={theme.text} />
          <Text style={styles.actionText}>Change Password</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
      </TouchableOpacity>

      {/* Logout */}
      <TouchableOpacity style={styles.actionButton} onPress={handleLogout}>
        <View style={styles.actionLeft}>
          <Ionicons name="log-out-outline" size={24} color={theme.text} />
          <Text style={styles.actionText}>Logout</Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
      </TouchableOpacity>

      {/* Delete Account */}
      <TouchableOpacity
        style={[styles.actionButton, styles.dangerButton]}
        onPress={confirmDelete}
      >
        <View style={styles.actionLeft}>
          <Ionicons name="trash-outline" size={24} color="#D32F2F" />
          <Text style={[styles.actionText, styles.dangerText]}>
            Delete Account
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={20} color="#D32F2F" />
      </TouchableOpacity>

      <View style={styles.warningBox}>
        <Ionicons name="warning-outline" size={20} color="#F57C00" />
        <Text style={styles.warningText}>
          Deleting your account is permanent and cannot be undone. All your data will be lost.
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
    marginBottom: 16,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: theme.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  actionLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  actionText: {
    fontSize: 16,
    fontWeight: "600",
    color: theme.text,
    marginLeft: 12,
  },
  dangerButton: {
    borderWidth: 1,
    borderColor: "#D32F2F20",
  },
  dangerText: {
    color: "#D32F2F",
  },
  warningBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: theme.card,
    padding: 16,
    borderRadius: 12,
    marginTop: 12,
    borderLeftWidth: 4,
    borderLeftColor: "#F57C00",
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: theme.textSecondary,
    marginLeft: 12,
    lineHeight: 18,
  },
});
