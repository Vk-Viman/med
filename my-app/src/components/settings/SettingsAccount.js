import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, TextInput, Image } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from 'expo-linear-gradient';
import PrimaryButton from "../PrimaryButton";

export default function SettingsAccount({
  theme,
  displayName,
  setDisplayName,
  avatarB64,
  pickAvatar,
  saveProfile,
  savingProfile,
  emailVerified,
  sendVerificationEmail,
  sendingVerify,
  refreshVerificationStatus,
  refreshingVerify
}) {
  const styles = createStyles(theme);

  return (
    <View>
      <Text style={styles.sectionTitle}>Account</Text>
      
      {/* Avatar */}
      <TouchableOpacity onPress={pickAvatar} style={styles.avatarContainer}>
        {avatarB64 ? (
          <Image source={{ uri: avatarB64 }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person-outline" size={40} color={theme.textSecondary} />
          </View>
        )}
        <View style={styles.avatarEdit}>
          <Ionicons name="camera" size={16} color="#fff" />
        </View>
      </TouchableOpacity>

      {/* Display Name */}
      <Text style={styles.label}>Display Name</Text>
      <TextInput
        style={styles.input}
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="Enter your display name"
        placeholderTextColor={theme.textSecondary}
      />

      <PrimaryButton 
        title={savingProfile ? "Saving..." : "Save Profile"} 
        onPress={saveProfile}
        disabled={savingProfile}
      />

      {/* Email Verification */}
      {!emailVerified && (
        <View style={styles.verificationBanner}>
          <Ionicons name="warning-outline" size={20} color="#F57C00" />
          <Text style={styles.verificationText}>Email not verified</Text>
          <TouchableOpacity onPress={sendVerificationEmail} disabled={sendingVerify}>
            <Text style={styles.verificationLink}>
              {sendingVerify ? "Sending..." : "Send verification email"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={refreshVerificationStatus} disabled={refreshingVerify}>
            <Text style={styles.verificationLink}>
              {refreshingVerify ? "Checking..." : "I verified my email"}
            </Text>
          </TouchableOpacity>
        </View>
      )}
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
  avatarContainer: {
    alignSelf: "center",
    marginBottom: 20,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarPlaceholder: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: theme.card,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: theme.border,
  },
  avatarEdit: {
    position: "absolute",
    right: 0,
    bottom: 0,
    backgroundColor: theme.primary,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: theme.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: theme.card,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    padding: 14,
    fontSize: 16,
    color: theme.text,
    marginBottom: 16,
  },
  verificationBanner: {
    backgroundColor: theme.card,
    borderLeftWidth: 4,
    borderLeftColor: "#F57C00",
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  verificationText: {
    color: theme.text,
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
  verificationLink: {
    color: theme.primary,
    fontSize: 14,
    fontWeight: "600",
    textDecorationLine: "underline",
  },
});
