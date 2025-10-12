import React from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { useTheme } from '../src/theme/ThemeProvider';
import PrimaryButton from '../src/components/PrimaryButton';
import Card from '../src/components/Card';
import { recommendWeeklyPlan, mergeCompletionIntoPlan, getCompletedMinutesToday, savePlanToUserDoc } from '../src/services/planService';
import GradientBackground from '../src/components/GradientBackground';
import { Ionicons } from '@expo/vector-icons';
import ShimmerCard from '../src/components/ShimmerCard';
import SkeletonLoader from '../src/components/SkeletonLoader';

export default function YourPlanScreen(){
  const router = useRouter();
  const { theme, mode } = useTheme();
  const [plan, setPlan] = React.useState(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [regenerating, setRegenerating] = React.useState(false);

  const load = async ({ showSpinner=true, forceRefresh=false }={}) => {
    try {
      if(showSpinner) setLoading(true);
      const [p, doneMins] = await Promise.all([
        recommendWeeklyPlan({ forceRefresh }),
        getCompletedMinutesToday(),
      ]);
      setPlan(mergeCompletionIntoPlan(p, doneMins));
    } catch (e) {
      console.warn('Plan error', e);
    } finally { setLoading(false); setRefreshing(false); }
  };

  React.useEffect(()=>{ load(); },[]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load({ showSpinner:false });
  };

  const onRegenerate = async () => {
    try {
      setRegenerating(true);
      await load({ showSpinner:true, forceRefresh:true });
      // Persist latest generated plan if available
      if (plan) await savePlanToUserDoc(plan);
    } finally {
      setRegenerating(false);
    }
  };

  const days = plan?.week || [];
  const title = 'Your Plan';

  return (
    <GradientBackground>
      <Stack.Screen options={{ title: 'Your Plan', headerShown: true }} />
      <SafeAreaView style={[styles.container,{ backgroundColor:'transparent' }]}> 
        <ShimmerCard colors={['#F3E5F5', '#E1BEE7', '#CE93D8']} shimmerSpeed={3000}>
          <View style={styles.header}> 
            <View style={{ flexDirection:'row', alignItems:'center' }}>
              <Ionicons name="sparkles-outline" size={22} color={theme.primary} style={{ marginRight:8 }} />
              <Text style={[styles.title,{ color: theme.text }]}>{title}</Text>
            </View>
            <View style={{ flexDirection:'row', alignItems:'center' }}>
              <PrimaryButton title={regenerating ? 'Regenerating…' : 'Regenerate'} onPress={onRegenerate} disabled={regenerating} style={{ marginRight:8 }} />
              <PrimaryButton title="Settings" onPress={()=> router.push('/plan')} variant="secondary" />
            </View>
          </View>
        </ShimmerCard>

        <FlatList
        data={days}
        keyExtractor={(item)=> item.day}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} colors={[theme.primary]} />}
        contentContainerStyle={{ padding:16, paddingBottom:32 }}
          ListHeaderComponent={plan ? (
            <Card style={{ padding:12, marginBottom:12 }}>
              <Text style={[styles.rationale,{ color: theme.text }]}>{plan.rationale || 'Personalized weekly schedule'}</Text>
              {!!plan._source && (
                <Text style={{ color: theme.textMuted, marginTop:4 }}>source: {String(plan._source)}</Text>
              )}
              {!!plan._error && (
                <Text style={{ color: theme.textMuted, marginTop:2 }}>error: {String(plan._error)}</Text>
              )}
              <Text style={{ color: theme.textMuted, marginTop:6 }}>
                Tap a day to view its blocks.
              </Text>
            </Card>
          ) : (
            <View style={{ paddingTop:32 }}>
              <Text style={{ textAlign:'center', color: theme.textMuted }}>Generating your plan…</Text>
            </View>
          )}
          renderItem={({ item })=> (
            <TouchableOpacity activeOpacity={0.8} onPress={()=>{}}>
              <ShimmerCard colors={['#E1F5FE', '#B3E5FC', '#81D4FA']} shimmerSpeed={3200}>
                <Card style={{ padding:12, marginBottom:12 }}>
                  <View style={{ flexDirection:'row', justifyContent:'space-between', alignItems:'center' }}>
                    <Text style={[styles.day,{ color: theme.text }]}>{item.day}</Text>
                  <View style={{ flexDirection:'row', alignItems:'center' }}>
                    <Ionicons name="time-outline" size={16} color={theme.textMuted} />
                    <Text style={[styles.total,{ color: theme.textMuted }]}>{item.totalMinutes}m</Text>
                  </View>
                </View>
                {!!item.remainingMinutes && (
                  <Text style={[styles.remaining,{ color: theme.textMuted }]}>{item.remainingMinutes}m remaining today</Text>
                )}
                {item.blocks?.map((b, idx)=> (
                  <View key={idx} style={styles.blockRow}>
                    <Text style={[styles.blockTitle,{ color: theme.text }]}>{b.title}</Text>
                    <Text style={[styles.blockMeta,{ color: theme.textMuted }]}>{b.theme} • {b.minutes}m • {b.type}</Text>
                  </View>
                ))}
                </Card>
              </ShimmerCard>
            </TouchableOpacity>
          )}
          ListEmptyComponent={null}
        />
      </SafeAreaView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex:1 },
  header: { paddingHorizontal:16, paddingTop:12, paddingBottom:8, flexDirection:'row', alignItems:'center', justifyContent:'space-between' },
  title: { fontSize:22, fontWeight:'800' },
  day: { fontSize:18, fontWeight:'800', marginBottom:4 },
  total: { marginLeft:6, fontSize:13 },
  remaining: { fontSize:13, marginBottom:8 },
  blockRow: { marginVertical:6 },
  blockTitle: { fontSize:16, fontWeight:'600' },
  blockMeta: { fontSize:13 },
  rationale: { fontSize:14 },
});
