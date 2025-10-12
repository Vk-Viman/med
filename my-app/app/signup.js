import React, { useState, useEffect } from "react";
import { View, Text, TextInput, StyleSheet, Animated, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import GradientBackground from "../src/components/GradientBackground";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { auth } from "../firebase/firebaseConfig";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { ensureUserProfile, getUserProfile, isAdminType } from "../src/services/userProfile";
import { LinearGradient } from 'expo-linear-gradient';
import AnimatedButton from "../src/components/AnimatedButton";
import GradientCard from "../src/components/GradientCard";
import { spacing, radius, shadow } from "../src/theme";
import AppLogo from "../src/components/AppLogo";
import { useTheme } from "../src/theme/ThemeProvider";
import ShimmerCard from "../src/components/ShimmerCard";
import PulseButton from "../src/components/PulseButton";

export default function SignupScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  
  // Entrance animations
  const fadeAnim = useState(new Animated.Value(0))[0];
  const slideAnim = useState(new Animated.Value(30))[0];

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 20,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleSignup = async () => {
    // Validation
    if (!email || !password || !confirmPassword) {
      setError("Please fill in all fields");
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords don't match");
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}
      return;
    }

    setLoading(true);
    setError("");

    try {
      await createUserWithEmailAndPassword(auth, email, password);
      try { await ensureUserProfile(); } catch {}
      
      // Success haptic
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } catch {}

      try {
        const prof = await getUserProfile();
        const isAdmin = isAdminType(prof?.userType);
        const needsQuestionnaire = !prof?.questionnaireV2;
        if (!isAdmin && needsQuestionnaire) {
          router.replace('/plan-setup');
        } else {
          router.replace(isAdmin ? '/admin' : '/(tabs)');
        }
      } catch {
        router.replace('/(tabs)');
      }
    } catch (e) {
      setError(e.message);
      setLoading(false);
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {}
    }
  };

  return (
    <GradientBackground>
      <SafeAreaView style={styles(theme).container}>
        <ScrollView
          contentContainerStyle={styles(theme).scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <Animated.View
            style={[
              styles(theme).card,
              {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }],
              },
            ]}
          >
            {/* Logo Section with Shimmer */}
            <ShimmerCard 
              colors={['#E1F5FE', '#F3E5F5', '#E8EAF6']} 
              style={{ marginBottom: spacing.lg, borderRadius: 16, padding: spacing.md }}
              shimmerSpeed={3000}
            >
              <View style={styles(theme).logoSection}>
                <View style={styles(theme).logoCircle}>
                  <AppLogo size={48} />
                </View>
              </View>

              {/* Welcome Text */}
              <View style={{ marginBottom: 0 }}>
                <Text style={styles(theme).title}>Create Account</Text>
                <Text style={styles(theme).subtitle}>
                  Start your mindfulness journey today
                </Text>
              </View>
            </ShimmerCard>

            {/* Email Input */}
            <View style={styles(theme).inputWrap}>
              <View style={styles(theme).inputIconBadge}>
                <Ionicons name="mail-outline" size={20} color="#0288D1" />
              </View>
              <TextInput
                style={styles(theme).input}
                placeholder="Email address"
                placeholderTextColor={theme.textMuted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!loading}
              />
            </View>

            {/* Password Input */}
            <View style={styles(theme).inputWrap}>
              <View style={styles(theme).inputIconBadge}>
                <Ionicons name="lock-closed-outline" size={20} color="#0288D1" />
              </View>
              <TextInput
                style={styles(theme).input}
                placeholder="Password (min. 6 characters)"
                placeholderTextColor={theme.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                editable={!loading}
              />
            </View>

            {/* Confirm Password Input */}
            <View style={styles(theme).inputWrap}>
              <View style={styles(theme).inputIconBadge}>
                <Ionicons name="checkmark-circle-outline" size={20} color="#66BB6A" />
              </View>
              <TextInput
                style={styles(theme).input}
                placeholder="Confirm password"
                placeholderTextColor={theme.textMuted}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                editable={!loading}
              />
            </View>

            {/* Error Message */}
            {error ? (
              <View style={styles(theme).errorContainer}>
                <Ionicons name="alert-circle" size={16} color="#EF5350" />
                <Text style={styles(theme).error}>{error}</Text>
              </View>
            ) : null}

            {/* Info Tip */}
            <GradientCard
              colors={['#E1F5FE', '#F3E5F5']}
              style={{ marginBottom: spacing.md }}
            >
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="information-circle" size={20} color="#0288D1" style={{ marginRight: 8 }} />
                <Text style={styles(theme).tipText}>
                  You'll be able to use biometric login after your first sign-in
                </Text>
              </View>
            </GradientCard>

            {/* Sign Up Button with Pulse */}
            <PulseButton 
              enabled={!loading && email && password && confirmPassword}
              onPress={handleSignup}
              pulseColor="rgba(102, 187, 106, 0.3)"
              haptic
            >
              <LinearGradient
                colors={loading ? ['#B0BEC5', '#90A4AE'] : ['#66BB6A', '#43A047', '#2E7D32']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles(theme).gradientButton}
              >
                {loading ? (
                  <Ionicons name="hourglass-outline" size={20} color="#fff" />
                ) : (
                  <Ionicons name="person-add" size={20} color="#fff" />
                )}
                <Text style={styles(theme).buttonText}>
                  {loading ? "Creating account..." : "Create Account"}
                </Text>
              </LinearGradient>
            </PulseButton>

            {/* Divider */}
            <View style={styles(theme).divider}>
              <View style={styles(theme).dividerLine} />
              <Text style={styles(theme).dividerText}>OR</Text>
              <View style={styles(theme).dividerLine} />
            </View>

            {/* Back to Login */}
            <AnimatedButton onPress={() => router.replace("/login")} hapticStyle="light" disabled={loading}>
              <View style={styles(theme).secondaryButton}>
                <Ionicons name="arrow-back-circle-outline" size={20} color="#0288D1" />
                <Text style={styles(theme).secondaryButtonText}>Back to Login</Text>
              </View>
            </AnimatedButton>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </GradientBackground>
  );
}
const styles = (colors) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
    paddingVertical: spacing.xl * 2,
  },
  card: {
    backgroundColor: colors.card,
    padding: spacing.xl,
    borderRadius: radius.xl,
    width: "100%",
    maxWidth: 440,
    ...shadow.lg,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E1F5FE',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0288D1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  title: {
    fontSize: 32,
    color: colors.text,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: spacing.xs,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textMuted,
    textAlign: "center",
    fontWeight: "500",
  },
  inputWrap: {
    width: "100%",
    height: 56,
    borderColor: colors.bg === '#0B1722' ? '#37474F' : '#B3E5FC',
    borderWidth: 2,
    marginBottom: spacing.md,
    borderRadius: 16,
    backgroundColor: colors.bg === '#0B1722' ? '#101D2B' : '#FFFFFF',
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.sm,
    shadowColor: "#0288D1",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  inputIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#E1F5FE',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  input: {
    flex: 1,
    height: "100%",
    color: colors.text,
    fontSize: 16,
    fontWeight: "500",
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bg === '#0B1722' ? '#1A1A1A' : '#FFEBEE',
    padding: spacing.md,
    borderRadius: radius.md,
    marginBottom: spacing.md,
  },
  error: {
    color: "#EF5350",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: spacing.xs,
    flex: 1,
  },
  tipText: {
    fontSize: 13,
    color: '#37474F',
    fontWeight: "500",
    flex: 1,
  },
  gradientButton: {
    height: 56,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#66BB6A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    marginLeft: spacing.xs,
    letterSpacing: 0.5,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.bg === '#0B1722' ? '#37474F' : '#B3E5FC',
  },
  dividerText: {
    color: colors.textMuted,
    paddingHorizontal: spacing.md,
    fontSize: 13,
    fontWeight: '600',
  },
  secondaryButton: {
    height: 56,
    borderRadius: 16,
    backgroundColor: '#E1F5FE',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#0288D1',
    fontSize: 17,
    fontWeight: '700',
    marginLeft: spacing.xs,
  },
});
