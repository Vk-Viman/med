import React, { useEffect, useState, useRef } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Pressable, ScrollView, RefreshControl, Animated } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import PrimaryButton from "../src/components/PrimaryButton";
import { colors, spacing, radius, shadow } from "../src/theme";
import { useTheme } from "../src/theme/ThemeProvider";
import GradientBackground from "../src/components/GradientBackground";
import { Ionicons } from "@expo/vector-icons";
import Card from "../src/components/Card";
import { getUserProfile } from "../src/services/userProfile";
import { getMoodSummary } from "../src/services/moodEntries";
import * as Haptics from 'expo-haptics';
import LottieView from 'lottie-react-native';
import { useFocusEffect } from 'expo-router';

export default function HomeScreen() {
  const router = useRouter();
  const { theme, toggle, mode } = useTheme();
  const [loading, setLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [avatarB64, setAvatarB64] = useState(null);
  const [summary, setSummary] = useState({ latest:null, streak:0 });
  const [refreshing, setRefreshing] = useState(false);
  const pullY = useRef(new Animated.Value(0)).current; // still track if needed later
  const [pullProgress, setPullProgress] = useState(0); // 0..1
  const [showToast, setShowToast] = useState(false);

  const greeting = () => {
    const h = new Date().getHours();
    if(h < 5) return 'Good night';
    if(h < 12) return 'Good morning';
    if(h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const loadData = async (opts={ showSpinner:true }) => {
    let mounted = true; // local flag for safety inside nested awaits
    if(opts.showSpinner) setLoading(true);
    try {
      const prof = await getUserProfile();
      if(prof){ setDisplayName(prof.displayName || ''); if(prof.avatarB64) setAvatarB64(prof.avatarB64); }
    } catch {}
    try {
      const s = await getMoodSummary({ streakLookbackDays:14 });
      setSummary(s);
    } catch {}
    if(opts.showSpinner) setLoading(false);
    return () => { mounted = false; };
  };

  useEffect(()=>{ loadData(); },[]);

  const triggerToast = () => {
    setShowToast(true);
    setTimeout(()=> setShowToast(false), 1800);
  };

  const onRefresh = async () => {
    if(refreshing) return;
    setRefreshing(true);
    impact('medium');
    await loadData({ showSpinner:false });
    setRefreshing(false);
    triggerToast();
  };

  useFocusEffect(React.useCallback(()=>{
    // silent refresh when returning to screen
    loadData({ showSpinner:false });
  },[]));

  const moodEmoji = (m) => {
    if(m == null) return '🌀';
    if(m <= 2) return '😢';
    if(m <= 4) return '🙁';
    if(m <= 6) return '😐';
    if(m <= 8) return '🙂';
    return '😄';
  };
  const moodTint = (m) => {
    // Light mode soft pastels
    if(m == null) return '#E3F2FD';
    if(m <= 2) return '#FFEBEE';
    if(m <= 4) return '#FFF3E0';
    if(m <= 6) return '#EDEFF1';
    if(m <= 8) return '#E8F5E9';
    return '#E3F2FD';
  };
  const moodTintDark = (m) => {
    // Dark mode, deeper tints for contrast
    if(m == null) return '#0F2132';       // blue-ish
    if(m <= 2) return '#2A1A1A';          // red-ish
    if(m <= 4) return '#2A2316';          // orange-ish
    if(m <= 6) return '#1E2328';          // neutral
    if(m <= 8) return '#18271C';          // green-ish
    return '#0F2132';
  };
  const latestMoodLabel = () => {
    if(!summary.latest) return 'Log your first mood to start tracking';
    const dt = summary.latest.createdAt ? summary.latest.createdAt.toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' }) : '';
    return `${summary.latest.mood}/10 mood • ${summary.latest.stress}/10 stress${dt? ' · '+dt:''}`;
  };

  const impact = async (style = 'light') => {
    try {
      const map = { light: Haptics.ImpactFeedbackStyle.Light, medium: Haptics.ImpactFeedbackStyle.Medium, heavy: Haptics.ImpactFeedbackStyle.Heavy };
      await Haptics.impactAsync(map[style] || Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  };
  const navigate = async (path, h='light') => { await impact(h); router.push(path); };

  return (
    <GradientBackground>
      <SafeAreaView style={[styles.container, { backgroundColor:'transparent' }]}> 
        <ScrollView
          style={{ flex:1 }}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} colors={[theme.primary]} progressViewOffset={10} />}
          onScroll={(e)=>{
            const y = e.nativeEvent.contentOffset.y;
            if(y < 0){
              // convert negative drag (e.g., -120..0) -> progress 1..0
              const prog = Math.min(1, Math.max(0, (-y)/120));
              setPullProgress(prog);
            } else if(pullProgress !== 0){
              setPullProgress(0);
            }
          }}
          scrollEventThrottle={16}
        >
        <View style={styles.pullAnimWrap} pointerEvents='none'>
          {(!refreshing) && (
            <LottieView
              source={require('../assets/animations/pullRefresh.json')}
              style={styles.pullAnim}
              progress={pullProgress}
            />
          )}
          {refreshing && (
            <LottieView
              source={require('../assets/animations/pullRefresh.json')}
              style={styles.pullAnim}
              autoPlay
              loop
            />
          )}
        </View>
        <View style={styles.header}>
          <TouchableOpacity accessibilityLabel="Toggle theme" onPress={toggle}>
            <Ionicons name={mode === 'light' ? 'sunny-outline' : 'moon-outline'} size={22} color={theme.textMuted} />
          </TouchableOpacity>
          <TouchableOpacity accessibilityLabel="Open settings" onPress={()=> router.push('/settings')}>
            {avatarB64 ? (
              <Image source={{ uri: avatarB64 }} style={styles.avatarSmall} />
            ) : (
              <Image source={require('../assets/icon.png')} style={styles.avatarSmall} />
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.greetWrap}>
          <Text style={[styles.greetText, { color: theme.text }]}>{greeting()}{displayName? `, ${displayName.split(' ')[0]}`:''}</Text>
          <Text style={[styles.tagline, { color: theme.textMuted }]}>Guided Meditation & Stress Relief</Text>
        </View>

        <Text style={[styles.sectionLabel,{ color: theme.textMuted }]}>TODAY</Text>
  <Card style={[styles.snapshotCard, { backgroundColor: (mode === 'dark' ? moodTintDark(summary.latest?.mood) : moodTint(summary.latest?.mood)) }]}> 
          {loading ? (
            <View style={styles.loadingRow}><ActivityIndicator color={theme.primary} size="small" /><Text style={[styles.loadingTxt,{ color: theme.textMuted }]}> Loading summary...</Text></View>
          ) : (
            <>
              {!summary.latest ? (
                <View style={styles.emptyWrap}>
                  <Text style={styles.emptyEmoji}>📝</Text>
                  <Text style={[styles.emptyTitle,{ color: theme.text }]}>No moods yet</Text>
                  <Text style={[styles.emptyDesc,{ color: theme.textMuted }]}>Track how you feel to see patterns and build a streak.</Text>
                  <TouchableOpacity style={[styles.linkBtnLarge, { backgroundColor: theme.bg === '#0B1722' ? '#1b2b3b' : '#E3F2FD' }]} onPress={()=> navigate('/moodTracker','medium')} accessibilityRole='button' accessibilityLabel='Log first mood'>
                    <Ionicons name='add-circle-outline' size={18} color={mode==='dark' ? '#8EC7FF' : theme.primary} />
                    <Text style={[styles.linkBtnLargeTxt,{ color: mode==='dark' ? '#E3F2FD' : '#0277BD' }]}>Log Mood</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <View style={[styles.snapshotRow, { marginBottom:10 }]}> 
                    <Text style={styles.moodEmoji}>{moodEmoji(summary.latest.mood)}</Text>
                    <View style={{ flex:1 }}>
                      <Text style={[styles.snapshotTextMain,{ color: theme.text }]}>{latestMoodLabel()}</Text>
                      <Text style={[styles.snapshotSub,{ color: theme.textMuted }]}>Keep consistent logging for better insights</Text>
                    </View>
                    <TouchableOpacity style={[styles.linkBtn,{ backgroundColor: theme.bg === '#0B1722' ? '#1b2b3b' : '#E3F2FD' }]} onPress={()=> navigate('/moodTracker','medium')} accessibilityLabel="Log another mood entry">
                      <Text style={[styles.linkBtnTxt,{ color: mode==='dark' ? '#E3F2FD' : '#0277BD' }]} >Log</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.snapshotRow}>
                    <Ionicons name="flame-outline" size={20} color={summary.streak>0? '#FF7043': theme.textMuted} />
                    <Text style={[styles.snapshotText, { color: theme.text }]}>{summary.streak>0? `${summary.streak}-day streak` : 'No streak yet'}</Text>
                  </View>
                </>
              )}
            </>
          )}
        </Card>

        <View style={styles.primaryCtaWrap}>
          <Text style={[styles.sectionLabel,{ color: theme.textMuted }]}>FOCUS</Text>
          <PrimaryButton title="Start Meditation" onPress={()=> navigate('/meditation','medium')} fullWidth left={<Ionicons name='play-circle' size={18} color='#fff' />} />
        </View>

        <Text style={[styles.sectionLabel,{ color: theme.textMuted }]}>INSIGHTS</Text>
        <View style={styles.quickGrid}>
          <Pressable style={({ pressed })=> [styles.gridCard, pressed && styles.gridPressed]} onPress={()=> navigate('/plan')} accessibilityLabel="Open personalized plan" accessibilityRole='button'>
            <Ionicons name='sparkles-outline' size={26} color={theme.primary} />
            <Text style={[styles.gridLabel,{ color: theme.text }]}>Plan</Text>
          </Pressable>
          <Pressable style={({ pressed })=> [styles.gridCard, pressed && styles.gridPressed]} onPress={()=> navigate('/report')} accessibilityLabel="Open weekly report" accessibilityRole='button'>
            <Ionicons name='stats-chart-outline' size={26} color={theme.primary} />
            <Text style={[styles.gridLabel,{ color: theme.text }]}>Weekly</Text>
          </Pressable>
          <Pressable style={({ pressed })=> [styles.gridCard, pressed && styles.gridPressed]} onPress={()=> navigate('/moodTracker')} accessibilityLabel="Open mood & stress tracker" accessibilityRole='button'>
            <Ionicons name='happy-outline' size={26} color={theme.primary} />
            <Text style={[styles.gridLabel,{ color: theme.text }]}>Mood</Text>
          </Pressable>
          <Pressable style={({ pressed })=> [styles.gridCard, pressed && styles.gridPressed]} onPress={()=> navigate('/wellnessReport')} accessibilityLabel="Open wellness report" accessibilityRole='button'>
            <Ionicons name='pulse-outline' size={26} color={theme.primary} />
            <Text style={[styles.gridLabel,{ color: theme.text }]}>Wellness</Text>
          </Pressable>
        </View>

        <Text style={[styles.sectionLabel,{ color: theme.textMuted }]}>TOOLS</Text>
        <View style={styles.secondaryList}>
          <PrimaryButton title="Reminders" onPress={()=> navigate('/notifications')} variant='secondary' fullWidth left={<Ionicons name='notifications-outline' size={18} color='#01579B' />} />
          <View style={{ height: spacing.sm }} />
          <PrimaryButton title="Biometric Login" onPress={()=> navigate('/biometricLogin')} variant='secondary' fullWidth left={<Ionicons name='finger-print-outline' size={18} color='#01579B' />} />
          <View style={{ height: spacing.sm }} />
          <PrimaryButton title="Settings" onPress={()=> navigate('/settings')} variant='secondary' fullWidth left={<Ionicons name='settings-outline' size={18} color='#01579B' />} />
        </View>
        <View style={{ height: spacing.xl * 2 }} />
        </ScrollView>
        {showToast && (
          <View style={[styles.toast,{ backgroundColor: theme.card }]}> 
            <Ionicons name='checkmark-circle-outline' size={18} color={theme.primary} />
            <Text style={[styles.toastText,{ color: theme.text }]}>Updated</Text>
          </View>
        )}
      </SafeAreaView>
    </GradientBackground>
  );
}
const styles = StyleSheet.create({
  container:{ flex:1, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  scrollContent:{ paddingBottom: spacing.xxl ?? 96 },
  pullAnimWrap:{ position:'absolute', top:-10, left:0, right:0, alignItems:'center', height:80 },
  pullAnim:{ width:80, height:80, opacity:0.9 },
  toast:{ position:'absolute', bottom:28, alignSelf:'center', flexDirection:'row', alignItems:'center', paddingHorizontal:14, paddingVertical:10, borderRadius:20, gap:8, shadowColor:'#000', shadowOpacity:0.15, shadowRadius:8, shadowOffset:{ width:0, height:3 }, elevation:4 },
  toastText:{ fontSize:13, fontWeight:'700' },
  header:{ flexDirection:'row', justifyContent:'space-between', alignItems:'center', marginBottom: spacing.lg },
  avatarSmall:{ width:34, height:34, borderRadius:17, backgroundColor:'#BBDEFB' },
  greetWrap:{ marginBottom: spacing.md },
  greetText:{ fontSize:24, fontWeight:'800' },
  tagline:{ fontSize:14, fontWeight:'600', opacity:0.85 },
  snapshotCard:{ padding: spacing.md, borderRadius:18, marginBottom: spacing.lg, position:'relative' },
  sectionLabel:{ fontSize:11, fontWeight:'700', letterSpacing:1, marginBottom:6, opacity:0.8 },
  loadingRow:{ flexDirection:'row', alignItems:'center' },
  loadingTxt:{ marginLeft:8, fontSize:12, fontWeight:'600' },
  snapshotRow:{ flexDirection:'row', alignItems:'center', marginBottom:6 },
  snapshotText:{ marginLeft:8, fontSize:13, fontWeight:'600', flex:1 },
  snapshotTextMain:{ fontSize:14, fontWeight:'700' },
  snapshotSub:{ fontSize:11, fontWeight:'600', marginTop:2 },
  linkBtn:{ marginLeft:8, paddingHorizontal:10, paddingVertical:4, backgroundColor:'#E3F2FD', borderRadius:14 },
  linkBtnTxt:{ fontSize:11, fontWeight:'700', color:'#0277BD', letterSpacing:0.5 },
  moodEmoji:{ fontSize:30, marginRight:12 },
  emptyWrap:{ alignItems:'center', paddingVertical:6 },
  emptyEmoji:{ fontSize:40, marginBottom:4 },
  emptyTitle:{ fontSize:16, fontWeight:'800', marginBottom:2 },
  emptyDesc:{ fontSize:12, fontWeight:'600', textAlign:'center', marginBottom:10, paddingHorizontal:12 },
  linkBtnLarge:{ flexDirection:'row', alignItems:'center', backgroundColor:'#E3F2FD', paddingHorizontal:14, paddingVertical:8, borderRadius:18, gap:6 },
  linkBtnLargeTxt:{ fontSize:13, fontWeight:'700', color:'#0277BD' },
  primaryCtaWrap:{ marginBottom: spacing.lg },
  quickGrid:{ flexDirection:'row', flexWrap:'wrap', justifyContent:'space-between', marginBottom: spacing.lg },
  gridCard:{ width:'48%', backgroundColor:'#ffffffCC', borderRadius:16, paddingVertical:18, alignItems:'center', marginBottom: spacing.md, ...shadow.card },
  gridPressed:{ opacity:0.6, transform:[{ scale:0.98 }] },
  gridLabel:{ marginTop:8, fontSize:13, fontWeight:'700' },
  secondaryList:{ marginBottom: spacing.lg },
  waveAccent:{},
  title:{},
  subtitle:{}
});
