import React, { useState, useRef, useEffect } from "react";
import { View, Text, TextInput, StyleSheet, Animated, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from 'expo-linear-gradient';
import * as LocalAuthentication from "expo-local-authentication";
import GradientBackground from "../src/components/GradientBackground";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useRouter } from "expo-router";
import { auth } from "../firebase/firebaseConfig";
import { signInWithEmailAndPassword } from "firebase/auth";
import { ensureUserProfile, getUserProfile, isAdminType } from "../src/services/userProfile";
import PrimaryButton from "../src/components/PrimaryButton";
import { spacing, radius, shadow } from "../src/theme";
import AppLogo from "../src/components/AppLogo";
import { useTheme } from "../src/theme/ThemeProvider";
import AnimatedButton from "../src/components/AnimatedButton";
import GradientCard from "../src/components/GradientCard";
import ShimmerCard from "../src/components/ShimmerCard";
import PulseButton from "../src/components/PulseButton";

export default function LoginScreen() {
  const { theme } = useTheme();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Please fill in all fields");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return;
    }
    setLoading(true);
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      try { await ensureUserProfile(); } catch {}
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
      setError(e.message || "Login failed");
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricLogin = async () => {
    setError("");
    try {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      if (!hasHardware || !enrolled) {
        setError("Biometric auth not available or not enrolled on this device.");
        return;
      }
      const res = await LocalAuthentication.authenticateAsync({ promptMessage: "Login with biometrics" });
      if (!res.success) {
        setError("Biometric authentication failed.");
        return;
      }
      if (auth.currentUser) {
        try {
          const prof = await getUserProfile();
          const isAdmin = isAdminType(prof?.userType);
          const needsQuestionnaire = !prof?.questionnaireV2;
          if (!isAdmin && needsQuestionnaire) router.replace('/plan-setup');
          else router.replace(isAdmin ? '/admin' : '/(tabs)');
        } catch {
          router.replace('/(tabs)');
        }
      } else {
        setError("No existing session. Please sign in once with email/password to enable biometric quick login.");
      }
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <GradientBackground>
      <SafeAreaView style={styles(theme).container}>
        <Animated.View 
          style={[
            styles(theme).card,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          {/* Logo and Welcome with Shimmer */}
          <ShimmerCard 
            colors={['#E1F5FE', '#B3E5FC', '#81D4FA']} 
            style={{ marginBottom: spacing.lg, borderRadius: 16, padding: spacing.lg }}
            shimmerSpeed={3000}
          >
            <View style={styles(theme).logoSection}>
              <View style={styles(theme).logoCircle}>
                <AppLogo size={56} />
              </View>
              <Text style={styles(theme).title}>Welcome Back</Text>
              <Text style={styles(theme).subtitle}>Sign in to continue your journey</Text>
            </View>
          </ShimmerCard>

          {/* Email Input */}
          <View style={styles(theme).inputWrap}>
            <View style={styles(theme).inputIconBadge}>
              <Ionicons name="mail-outline" size={20} color="#0288D1" />
            </View>
            <TextInput 
              style={styles(theme).input} 
              placeholder="Email" 
              placeholderTextColor={theme.textMuted} 
              value={email} 
              onChangeText={(text) => { setEmail(text); setError(""); }}
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
              placeholder="Password" 
              placeholderTextColor={theme.textMuted} 
              value={password} 
              onChangeText={(text) => { setPassword(text); setError(""); }}
              secureTextEntry
              editable={!loading}
            />
          </View>

          {/* Forgot Password */}
          <TouchableOpacity 
            onPress={()=> router.push('/forgotPassword')} 
            style={styles(theme).forgotButton}
          >
            <Ionicons name="help-circle-outline" size={14} color="#1565C0" />
            <Text style={styles(theme).forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

          {/* Error Message */}
          {error ? (
            <View style={styles(theme).errorContainer}>
              <Ionicons name="alert-circle" size={18} color="#EF5350" />
              <Text style={styles(theme).error}>{error}</Text>
            </View>
          ) : null}

          {/* Login Button with Pulse */}
          <PulseButton 
            enabled={!loading && email && password}
            onPress={handleLogin}
            pulseColor="rgba(2, 136, 209, 0.3)"
            haptic
          >
            <LinearGradient
              colors={!loading ? ['#0288D1', '#01579B'] : ['#B0BEC5', '#90A4AE']}
              style={styles(theme).gradientButton}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Ionicons name={loading ? "hourglass-outline" : "log-in-outline"} size={22} color="#fff" />
              <Text style={styles(theme).buttonText}>
                {loading ? 'Signing in...' : 'Sign In'}
              </Text>
            </LinearGradient>
          </PulseButton>

          {/* Divider */}
          <View style={styles(theme).divider}>
            <View style={styles(theme).dividerLine} />
            <Text style={styles(theme).dividerText}>OR</Text>
            <View style={styles(theme).dividerLine} />
          </View>

          {/* Biometric Login */}
          <AnimatedButton 
            onPress={handleBiometricLogin}
            disabled={loading}
            hapticStyle="light"
          >
            <View style={styles(theme).secondaryButton}>
              <Ionicons name="finger-print" size={22} color="#0288D1" />
              <Text style={styles(theme).secondaryButtonText}>Biometric Login</Text>
            </View>
          </AnimatedButton>

          {/* Sign Up */}
          <View style={styles(theme).signupContainer}>
            <Text style={styles(theme).signupText}>Don't have an account? </Text>
            <TouchableOpacity onPress={() => router.replace("/signup")}>
              <Text style={styles(theme).signupLink}>Sign Up</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </SafeAreaView>
    </GradientBackground>
  );
}
const styles = (colors) => StyleSheet.create({
  container: { 
    flex: 1, 
    justifyContent: "center", 
    alignItems: "center", 
    padding: spacing.lg 
  },
  card: { 
    backgroundColor: colors.card, 
    padding: spacing.xl, 
    borderRadius: 24, 
    width: "90%",
    maxWidth: 420,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E1F5FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.md,
    shadowColor: '#0288D1',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  title: { 
    fontSize: 28, 
    color: colors.text, 
    fontWeight: "800", 
    textAlign: "center",
    letterSpacing: 0.3,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    fontWeight: '500',
  },
  inputWrap: { 
    width: "100%", 
    height: 56, 
    borderColor: colors.bg === '#0B1722' ? '#37474F' : '#E0E0E0', 
    borderWidth: 2, 
    marginBottom: spacing.md, 
    borderRadius: 16, 
    backgroundColor: colors.bg === '#0B1722' ? '#101D2B' : '#FAFAFA', 
    flexDirection: "row", 
    alignItems: "center",
    shadowColor: "#000",
    shadowOpacity: 0.03,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  inputIconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#E1F5FE',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
    marginRight: 12,
  },
  input: { 
    flex: 1, 
    height: "100%", 
    paddingRight: spacing.md, 
    color: colors.text,
    fontSize: 16,
    fontWeight: '500',
  },
  forgotButton: {
    alignSelf: 'flex-end',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: spacing.md,
    paddingVertical: 4,
  },
  forgotText: {
    color: '#1565C0',
    fontSize: 13,
    fontWeight: '600',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFEBEE',
    padding: spacing.sm,
    borderRadius: 12,
    marginBottom: spacing.md,
    gap: 8,
  },
  error: { 
    color: "#C62828", 
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  gradientButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
    shadowColor: '#0288D1',
    shadowOpacity: 0.3,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
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
    backgroundColor: colors.bg === '#0B1722' ? '#37474F' : '#E0E0E0',
  },
  dividerText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    paddingHorizontal: spacing.md,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: colors.bg === '#0B1722' ? '#1b2b3b' : '#E1F5FE',
    borderWidth: 2,
    borderColor: colors.bg === '#0B1722' ? '#37474F' : '#B3E5FC',
  },
  secondaryButtonText: {
    color: '#0288D1',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  signupText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: '500',
  },
  signupLink: {
    color: '#0288D1',
    fontSize: 14,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
