import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import PrimaryButton from '../../src/components/PrimaryButton';
import { listGroups, createGroup, deleteGroup, listFlaggedPosts, clearFlag, listChallenges, createChallenge, updateChallenge, deleteChallenge, postChallengeUpdate } from '../../src/services/admin';
import { collection, addDoc, setDoc, doc, serverTimestamp, getDocs } from 'firebase/firestore';
import { db, auth } from '../../firebase/firebaseConfig';

export default function AdminCommunity(){
  const { theme } = useTheme();
  const [groups, setGroups] = useState([]);
  const [challenges, setChallenges] = useState([]);
  const [name, setName] = useState('7‑Day Calm');
  const [flagged, setFlagged] = useState([]);
  const load = async()=>{ try { setGroups(await listGroups()); setFlagged(await listFlaggedPosts()); setChallenges(await listChallenges()); } catch{} };
  useEffect(()=>{ load(); },[]);
  const add = async()=>{ try { await createGroup({ name }); setName(''); await load(); } catch(e){ Alert.alert('Error', e.message); } };
  const remove = async(id)=>{ try { await deleteGroup(id); await load(); } catch(e){ Alert.alert('Error', e.message); } };
  const clear = async(id)=>{ try { await clearFlag(id); await load(); } catch(e){ Alert.alert('Error', e.message); } };

  const seedSampleData = async () => {
    try {
      const chSnap = await getDocs(collection(db, 'challenges'));
      if (chSnap.empty) {
        const weeklyRef = await addDoc(collection(db, 'challenges'), {
          title: 'Weekly Calm Challenge', description: 'Meditate 10 minutes daily for 7 days.', period: 'weekly', targetMinutes: 70, createdAt: serverTimestamp(), seeded: true,
        });
        const monthlyRef = await addDoc(collection(db, 'challenges'), {
          title: 'Monthly Mindfulness Marathon', description: 'Accumulate 300 minutes this month.', period: 'monthly', targetMinutes: 300, createdAt: serverTimestamp(), seeded: true,
        });
        // Starter badge for current admin (optional)
        if (auth.currentUser) {
          await setDoc(doc(db, 'users', auth.currentUser.uid, 'badges', 'starter'), { name: 'Getting Started', awardedAt: serverTimestamp() }, { merge: true });
        }
        Alert.alert('Seeded','Created sample weekly and monthly challenges.');
        await load();
      } else {
        Alert.alert('Info','Challenges already exist. Use Reset to remove seeded items.');
      }
    } catch (e) { Alert.alert('Error', e.message); }
  };

  const resetSampleData = async () => {
    try {
      const snap = await getDocs(collection(db, 'challenges'));
      const seeded = snap.docs.filter(d=> d.data()?.seeded);
      for (const d of seeded) {
        try { await deleteGroup(d.id); } catch {}
      }
      Alert.alert('Done','Removed seeded challenges.');
      await load();
    } catch (e) { Alert.alert('Error', e.message); }
  };
  return (
    <View style={{ flex:1, backgroundColor: theme.bg, padding:12 }}>
      <Text style={{ color: theme.text, fontWeight:'800', fontSize:16, marginBottom:8 }}>Groups & Challenges</Text>
      <View style={{ flexDirection:'row', gap:8, marginBottom:8 }}>
        <PrimaryButton title='Seed sample data' onPress={seedSampleData} />
        <PrimaryButton title='Reset seeded' onPress={resetSampleData} />
      </View>
      <View style={{ flexDirection:'row', gap:8 }}>
        <TextInput placeholder='Group name' placeholderTextColor={theme.textMuted} value={name} onChangeText={setName} style={[styles.inp, { color: theme.text, backgroundColor: theme.card }]} />
        <PrimaryButton title='Add' onPress={add} />
      </View>
      <FlatList data={groups} keyExtractor={(g)=> g.id} contentContainerStyle={{ gap:8, marginTop:12 }} renderItem={({ item })=> (
        <View style={[styles.row, { backgroundColor: theme.card }]}>
          <Text style={{ color: theme.text, fontWeight:'700' }}>{item.name}</Text>
          <TouchableOpacity onPress={()=> remove(item.id)}><Text style={{ color:'#D32F2F', fontWeight:'700' }}>Delete</Text></TouchableOpacity>
        </View>
      )} />

      <View style={{ height:16 }} />
      <Text style={{ color: theme.text, fontWeight:'800', fontSize:16, marginBottom:8 }}>Challenges Editor</Text>
      <ChallengeEditor theme={theme} items={challenges} onChange={async (patch)=>{ try { await updateChallenge(patch.id, patch.data); await load(); } catch(e){ Alert.alert('Error', e.message); } }} onCreate={async (data)=>{ try { await createChallenge(data); await load(); } catch(e){ Alert.alert('Error', e.message); } }} onDelete={async (id)=>{ try { await deleteChallenge(id); await load(); } catch(e){ Alert.alert('Error', e.message); } }} onPostUpdate={async (id, text)=>{ try { await postChallengeUpdate(id, { text }); Alert.alert('Posted','Update added to feed'); } catch(e){ Alert.alert('Error', e.message); } }} />
      <View style={{ height:16 }} />
      <Text style={{ color: theme.text, fontWeight:'800', fontSize:16, marginBottom:8 }}>Flagged Posts (manual)</Text>
      <FlatList data={flagged} keyExtractor={(p)=> p.id} contentContainerStyle={{ gap:8 }} renderItem={({ item })=> (
        <View style={[styles.row, { backgroundColor: theme.card }]}>
          <Text style={{ color: theme.text }}>{item.preview || item.text || '(no content)'}</Text>
          <TouchableOpacity onPress={()=> clear(item.id)}><Text style={{ color:'#2E7D32', fontWeight:'700' }}>Clear</Text></TouchableOpacity>
        </View>
      )} />
    </View>
  );
}
function ChallengeEditor({ theme, items, onChange, onCreate, onDelete, onPostUpdate }){
  const [title, setTitle] = useState('Weekly Calm');
  const [description, setDescription] = useState('Meditate daily for a week.');
  const [goalMinutes, setGoalMinutes] = useState('70');
  const [teamEnabled, setTeamEnabled] = useState(false);
  const [rewardPoints, setRewardPoints] = useState('50');
  const [rewardBadge, setRewardBadge] = useState('Calm Starter');
  const [startAt, setStartAt] = useState(''); // ISO yyyy-mm-dd
  const [endAt, setEndAt] = useState('');

  const toDate = (iso)=> (iso ? new Date(iso) : null);

  return (
    <View>
      <View style={{ flexDirection:'row', gap:8, marginBottom:8 }}>
        <TextInput placeholder='Title' placeholderTextColor={theme.textMuted} value={title} onChangeText={setTitle} style={[styles.inp, { color: theme.text, backgroundColor: theme.card }]} />
        <TextInput placeholder='Goal (m)' placeholderTextColor={theme.textMuted} value={goalMinutes} onChangeText={setGoalMinutes} keyboardType='numeric' style={[styles.inpS, { color: theme.text, backgroundColor: theme.card }]} />
      </View>
      <View style={{ flexDirection:'row', gap:8, marginBottom:8 }}>
        <TextInput placeholder='Description' placeholderTextColor={theme.textMuted} value={description} onChangeText={setDescription} style={[styles.inp, { color: theme.text, backgroundColor: theme.card }]} />
      </View>
      <View style={{ flexDirection:'row', gap:8, marginBottom:8 }}>
        <TextInput placeholder='Start (yyyy-mm-dd)' placeholderTextColor={theme.textMuted} value={startAt} onChangeText={setStartAt} style={[styles.inp, { color: theme.text, backgroundColor: theme.card }]} />
        <TextInput placeholder='End (yyyy-mm-dd)' placeholderTextColor={theme.textMuted} value={endAt} onChangeText={setEndAt} style={[styles.inp, { color: theme.text, backgroundColor: theme.card }]} />
      </View>
      <View style={{ flexDirection:'row', gap:8, marginBottom:8 }}>
        <TextInput placeholder='Reward points' placeholderTextColor={theme.textMuted} value={rewardPoints} onChangeText={setRewardPoints} keyboardType='numeric' style={[styles.inpS, { color: theme.text, backgroundColor: theme.card }]} />
        <TextInput placeholder='Reward badge' placeholderTextColor={theme.textMuted} value={rewardBadge} onChangeText={setRewardBadge} style={[styles.inp, { color: theme.text, backgroundColor: theme.card }]} />
      </View>
      <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:8 }}>
        <TouchableOpacity onPress={()=> setTeamEnabled(v=>!v)} style={{ paddingHorizontal:12, paddingVertical:8, backgroundColor: theme.card, borderRadius:10 }}>
          <Text style={{ color: theme.text, fontWeight:'700' }}>{teamEnabled ? 'Teams: ON' : 'Teams: OFF'}</Text>
        </TouchableOpacity>
        <PrimaryButton title='Create' onPress={()=> onCreate({ title, description, goalMinutes: Number(goalMinutes)||0, teamEnabled, rewardPoints: Number(rewardPoints)||0, rewardBadge, startAt: toDate(startAt), endAt: toDate(endAt) })} />
      </View>
      <FlatList data={items} keyExtractor={(c)=> c.id} contentContainerStyle={{ gap:8, marginTop:8 }} renderItem={({ item })=> (
        <View style={[styles.row, { backgroundColor: theme.card }]}>
          <View style={{ flex:1 }}>
            <Text style={{ color: theme.text, fontWeight:'700' }}>{item.title}</Text>
            <Text style={{ color: theme.textMuted, fontSize:12 }}>{item.description}</Text>
            <Text style={{ color: theme.textMuted, fontSize:12 }}>Goal: {item.goalMinutes||item.targetMinutes||0}m • Teams: {item.teamEnabled? 'Yes':'No'}</Text>
          </View>
          <TouchableOpacity onPress={()=> onDelete(item.id)}><Text style={{ color:'#D32F2F', fontWeight:'700', marginRight:8 }}>Delete</Text></TouchableOpacity>
          <TouchableOpacity onPress={()=> onPostUpdate(item.id, 'Keep it up!') }><Text style={{ color:'#1976D2', fontWeight:'700' }}>Post update</Text></TouchableOpacity>
        </View>
      )} />
    </View>
  );
}
const styles = StyleSheet.create({
  inp:{ flex:1, height:44, borderRadius:10, paddingHorizontal:10 },
  row:{ padding:8, borderRadius:12, flexDirection:'row', alignItems:'center', justifyContent:'space-between' }
});
