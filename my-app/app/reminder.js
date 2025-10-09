import React, { useEffect, useState } from "react";
import { SafeAreaView } from "react-native-safe-area-context";
import { View, Text, Button, StyleSheet, TouchableOpacity, Animated } from "react-native";
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from "expo-haptics";
import { scheduleLocalNotification, cancelAllLocalNotifications } from "../src/notifications";
import { getAdaptiveSettings, setAdaptiveSettings, runAdaptiveScheduler, registerNotificationActions } from "../src/services/adaptiveNotifications";
import { auth, db } from "../firebase/firebaseConfig";
import { doc, getDoc } from "firebase/firestore";
import GradientCard from "../src/components/GradientCard";
import AnimatedButton from "../src/components/AnimatedButton";
import IconBadge from "../src/components/IconBadge";

export default function ReminderScreen() {
  const [suggestedTimes, setSuggestedTimes] = useState([]);
  const [adaptive, setAdaptive] = useState({ enabled: true, baseHour: 8, baseMinute: 0, quietStart: '22:00', quietEnd: '07:00', cooldownMin: 120, backupEnabled: true, backupHour: 15, backupMinute: 0 });
  const [fadeAnim] = useState(new Animated.Value(0));
  
  const TIMES = [
    { key: 'Morning', hour: 8, minute: 0, icon: 'sunny-outline', color: '#FFA726' },
    { key: 'Afternoon', hour: 13, minute: 0, icon: 'partly-sunny-outline', color: '#42A5F5' },
    { key: 'Evening', hour: 18, minute: 0, icon: 'moon-outline', color: '#AB47BC' },
    { key: 'Before bed', hour: 22, minute: 0, icon: 'bed-outline', color: '#5C6BC0' },
  ];

  useEffect(() => {
    const load = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;
        const snap = await getDoc(doc(db, 'users', user.uid));
        const data = snap.exists() ? snap.data() : null;
        const qv2 = data?.questionnaireV2;
        if (Array.isArray(qv2?.times)) setSuggestedTimes(qv2.times);
        const s = await getAdaptiveSettings();
        setAdaptive(s);
        await registerNotificationActions();
      } catch (e) {
        // noop
      }
    };
    load();
    
    // Fade in animation
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  const schedule = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await scheduleLocalNotification({ hour: 8, minute: 0 });
  };

  const cancelAll = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await cancelAllLocalNotifications();
  };

  const saveAdaptive = async (patch) => {
    const next = { ...adaptive, ...patch };
    setAdaptive(next);
    await setAdaptiveSettings(patch);
  };

  const runAdaptive = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const r = await runAdaptiveScheduler();
    if(__DEV__) console.log('[adaptive]', r);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={{ opacity: fadeAnim }}>
        {/* Header with icon */}
        <View style={styles.header}>
          <IconBadge 
            name="notifications" 
            size={32} 
            color="#0288D1"
            gradientColors={['#E1F5FE', '#B3E5FC']}
          />
          <View style={{ marginLeft: 16, flex: 1 }}>
            <Text style={styles.title}>Reminder Settings</Text>
            <Text style={styles.subtitle}>Schedule mindful moments throughout your day</Text>
          </View>
        </View>

        {suggestedTimes.length > 0 && (
          <GradientCard colors={['#E1F5FE', '#F3E5F5']} style={styles.card}>
            <View style={styles.cardHeader}>
              <Ionicons name="star" size={20} color="#FF6F00" />
              <Text style={styles.cardTitle}>Your Preferred Times</Text>
            </View>
            <View style={styles.row}>
              {TIMES.filter(t => suggestedTimes.includes(t.key)).map(t => (
                <AnimatedButton 
                  key={t.key} 
                  onPress={async () => { 
                    await scheduleLocalNotification({ hour: t.hour, minute: t.minute }); 
                  }}
                  hapticStyle="medium"
                  style={[styles.timeChip, { backgroundColor: t.color + '20', borderColor: t.color }]}
                >
                  <View style={styles.timeChipContent}>
                    <Ionicons name={t.icon} size={20} color={t.color} />
                    <Text style={[styles.timeChipText, { color: t.color }]}>{t.key}</Text>
                    <Text style={[styles.timeChipTime, { color: t.color }]}>
                      {String(t.hour).padStart(2,'0')}:{String(t.minute).padStart(2,'0')}
                    </Text>
                  </View>
                </AnimatedButton>
              ))}
            </View>
            <Text style={styles.cardNote}>
              <Ionicons name="information-circle" size={14} color="#0277BD" /> Tap to schedule a daily reminder
            </Text>
          </GradientCard>
        )}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Ionicons name="bulb" size={20} color="#FF6F00" />
            <Text style={styles.cardTitle}>Smart Adaptive System</Text>
          </View>
          <View style={styles.row}>
            <AnimatedButton 
              style={[styles.chip, adaptive.enabled && styles.chipActive]} 
              onPress={() => saveAdaptive({ enabled: !adaptive.enabled })}
              hapticStyle="medium"
            >
              <View style={styles.chipContent}>
                <Ionicons name={adaptive.enabled ? 'checkmark-circle' : 'close-circle'} size={18} color={adaptive.enabled ? '#fff' : '#01579B'} />
                <Text style={[styles.chipText, adaptive.enabled && styles.chipTextActive]}>
                  {adaptive.enabled ? 'Enabled' : 'Disabled'}
                </Text>
              </View>
            </AnimatedButton>
            <AnimatedButton style={styles.chip} onPress={() => saveAdaptive({ baseHour: (adaptive.baseHour+1)%24 })}>
              <View style={styles.chipContent}>
                <Ionicons name="time-outline" size={18} color="#01579B" />
                <Text style={styles.chipText}>Base {String(adaptive.baseHour).padStart(2,'0')}:{String(adaptive.baseMinute).padStart(2,'0')}</Text>
              </View>
            </AnimatedButton>
            <AnimatedButton style={styles.chip} onPress={() => saveAdaptive({ quietStart: adaptive.quietStart==='22:00'?'21:00':'22:00' })}>
              <View style={styles.chipContent}>
                <Ionicons name="moon-outline" size={18} color="#01579B" />
                <Text style={styles.chipText}>Quiet {adaptive.quietStart}-{adaptive.quietEnd}</Text>
              </View>
            </AnimatedButton>
            <AnimatedButton style={styles.chip} onPress={() => saveAdaptive({ quietEnd: adaptive.quietEnd==='07:00'?'06:30':'07:00' })}>
              <View style={styles.chipContent}>
                <Ionicons name="sunny-outline" size={18} color="#01579B" />
                <Text style={styles.chipText}>Wake {adaptive.quietEnd}</Text>
              </View>
            </AnimatedButton>
            <AnimatedButton style={styles.chip} onPress={() => saveAdaptive({ cooldownMin: Math.max(30, (adaptive.cooldownMin+30)%300) })}>
              <View style={styles.chipContent}>
                <Ionicons name="hourglass-outline" size={18} color="#01579B" />
                <Text style={styles.chipText}>Cooldown {adaptive.cooldownMin}m</Text>
              </View>
            </AnimatedButton>
            <AnimatedButton 
              style={[styles.chip, adaptive.backupEnabled && styles.chipActive]} 
              onPress={() => saveAdaptive({ backupEnabled: !adaptive.backupEnabled })}
            >
              <View style={styles.chipContent}>
                <Ionicons name="shield-checkmark-outline" size={18} color={adaptive.backupEnabled ? '#fff' : '#01579B'} />
                <Text style={[styles.chipText, adaptive.backupEnabled && styles.chipTextActive]}>
                  Backup {adaptive.backupEnabled ? 'ON' : 'OFF'}
                </Text>
              </View>
            </AnimatedButton>
            <AnimatedButton style={styles.chip} onPress={() => saveAdaptive({ backupHour: (adaptive.backupHour + 1) % 24 })}>
              <View style={styles.chipContent}>
                <Ionicons name="alarm-outline" size={18} color="#01579B" />
                <Text style={styles.chipText}>Backup {String(adaptive.backupHour).padStart(2,'0')}:{String(adaptive.backupMinute).padStart(2,'0')}</Text>
              </View>
            </AnimatedButton>
          </View>
          <AnimatedButton 
            onPress={runAdaptive}
            hapticStyle="medium"
            style={styles.adaptiveButton}
          >
            <View style={styles.adaptiveButtonContent}>
              <Ionicons name="play-circle" size={24} color="#fff" />
              <Text style={styles.adaptiveButtonText}>Run Adaptive Now</Text>
            </View>
          </AnimatedButton>
          <Text style={styles.cardNote}>
            <Ionicons name="sparkles" size={14} color="#0277BD" /> Learns from your patterns and adjusts timing intelligently
          </Text>
        </View>
        {/* Quick Actions */}
        <View style={styles.actionRow}>
          <AnimatedButton 
            onPress={schedule}
            hapticStyle="medium"
            style={styles.primaryButton}
          >
            <View style={styles.buttonContent}>
              <Ionicons name="add-circle" size={22} color="#fff" />
              <Text style={styles.buttonText}>Schedule 8:00 AM</Text>
            </View>
          </AnimatedButton>
          
          <AnimatedButton 
            onPress={cancelAll}
            hapticStyle="heavy"
            style={styles.dangerButton}
          >
            <View style={styles.buttonContent}>
              <Ionicons name="close-circle" size={22} color="#fff" />
              <Text style={styles.buttonText}>Cancel All</Text>
            </View>
          </AnimatedButton>
        </View>
        
        <View style={styles.infoCard}>
          <Ionicons name="information-circle-outline" size={20} color="#0277BD" />
          <Text style={styles.infoText}>Notifications adapt to your usage patterns for optimal engagement</Text>
        </View>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, backgroundColor: '#F5F5F5' },
  header: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    marginBottom: 24,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: { fontSize: 24, fontWeight: "800", color: '#01579B', letterSpacing: 0.3 },
  subtitle: { color: "#607D8B", fontSize: 14, lineHeight: 20, marginTop: 4 },
  row: { marginVertical: 8, flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { 
    marginTop: 16, 
    padding: 20, 
    backgroundColor: '#fff', 
    borderRadius: 16, 
    shadowColor: '#000', 
    shadowOpacity: 0.08, 
    shadowRadius: 12, 
    shadowOffset: { width: 0, height: 4 },
    elevation: 3, 
    borderWidth: 1, 
    borderColor: '#E3F2FD' 
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  cardTitle: { fontWeight: '800', color: '#01579B', fontSize: 18, letterSpacing: 0.2 },
  cardNote: { 
    color: '#0277BD', 
    marginTop: 12, 
    fontSize: 13, 
    lineHeight: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  
  // Time chips with icons
  timeChip: {
    padding: 16,
    borderRadius: 16,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
    minWidth: 120,
  },
  timeChipContent: {
    alignItems: 'center',
    gap: 6,
  },
  timeChipText: {
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.2,
  },
  timeChipTime: {
    fontWeight: '600',
    fontSize: 12,
    opacity: 0.8,
  },
  
  // Adaptive chips
  chip: { 
    backgroundColor: '#B3E5FC', 
    paddingVertical: 12, 
    paddingHorizontal: 16, 
    borderRadius: 14, 
    borderWidth: 2, 
    borderColor: 'transparent', 
    shadowColor: '#000', 
    shadowOpacity: 0.05, 
    shadowRadius: 4, 
    elevation: 1 
  },
  chipActive: { 
    backgroundColor: '#0288D1', 
    borderColor: '#01579B', 
    shadowOpacity: 0.12, 
    shadowRadius: 6, 
    elevation: 3 
  },
  chipContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipText: { color: '#01579B', fontWeight: '700', fontSize: 14, letterSpacing: 0.2 },
  chipTextActive: { color: 'white' },
  
  // Adaptive button
  adaptiveButton: {
    backgroundColor: '#0288D1',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 14,
    marginTop: 16,
    shadowColor: '#0288D1',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  adaptiveButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  adaptiveButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
    letterSpacing: 0.3,
  },
  
  // Action buttons
  actionRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#0288D1',
    paddingVertical: 16,
    borderRadius: 14,
    shadowColor: '#0288D1',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  dangerButton: {
    flex: 1,
    backgroundColor: '#EF5350',
    paddingVertical: 16,
    borderRadius: 14,
    shadowColor: '#EF5350',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.3,
  },
  
  // Info card
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E1F5FE',
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
    gap: 12,
    borderWidth: 1,
    borderColor: '#B3E5FC',
  },
  infoText: {
    flex: 1,
    color: '#0277BD',
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500',
  },
});
