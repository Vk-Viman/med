import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView, Platform } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useTheme } from '../../src/theme/ThemeProvider';
import PrimaryButton from '../../src/components/PrimaryButton';
import { listGroups, createGroup, deleteGroup, listFlaggedPosts, clearFlag, listChallenges, createChallenge, updateChallenge, deleteChallenge, postChallengeUpdate, listTeams, upsertTeam, deleteTeam, fulfillChallengeReward, recomputeTeamTotals } from '../../src/services/admin';
import { collection, getDocs, limit, orderBy, query, where, addDoc, setDoc, doc, serverTimestamp } from 'firebase/firestore';
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
        try { await deleteChallenge(d.id); } catch {}
      }
      Alert.alert('Done','Removed seeded challenges.');
      await load();
    } catch (e) { Alert.alert('Error', e.message); }
  };
  return (
    <View style={{ flex:1, backgroundColor: theme.bg }}>
      <ScrollView contentContainerStyle={{ padding:12, paddingBottom: 60 }}>
      <Text style={{ color: theme.text, fontWeight:'800', fontSize:16, marginBottom:8 }}>Groups & Challenges</Text>
      <View style={{ flexDirection:'row', gap:8, marginBottom:8 }}>
        <PrimaryButton title='Seed sample data' onPress={seedSampleData} />
        <PrimaryButton title='Reset seeded' onPress={resetSampleData} />
      </View>
      <View style={{ flexDirection:'row', gap:8 }}>
        <TextInput placeholder='Group name' placeholderTextColor={theme.textMuted} value={name} onChangeText={setName} style={[styles.inp, { color: theme.text, backgroundColor: theme.card }]} />
        <PrimaryButton title='Add' onPress={add} />
      </View>
      <View style={{ gap:8, marginTop:12 }}>
        {groups.map(item => (
          <View key={item.id} style={[styles.row, { backgroundColor: theme.card }]}> 
            <Text style={{ color: theme.text, fontWeight:'700' }}>{item.name}</Text>
            <TouchableOpacity onPress={()=> remove(item.id)}><Text style={{ color:'#D32F2F', fontWeight:'700' }}>Delete</Text></TouchableOpacity>
          </View>
        ))}
      </View>

      <View style={{ height:16 }} />
      <Text style={{ color: theme.text, fontWeight:'800', fontSize:16, marginBottom:8 }}>Challenges Editor</Text>
  <ChallengeEditor theme={theme} items={challenges} onChange={async (patch)=>{ try { await updateChallenge(patch.id, patch.data); await load(); } catch(e){ Alert.alert('Error', e.message); } }} onCreate={async (data)=>{ try { await createChallenge(data); await load(); } catch(e){ Alert.alert('Error', e.message); } }} onDelete={async (id)=>{ try { await deleteChallenge(id); await load(); } catch(e){ Alert.alert('Error', e.message); } }} onPostUpdate={async (id, text)=>{ try { await postChallengeUpdate(id, { text }); Alert.alert('Posted','Update added to feed'); } catch(e){ Alert.alert('Error', e.message); } }} />
      <View style={{ height:16 }} />
      <Text style={{ color: theme.text, fontWeight:'800', fontSize:16, marginBottom:8 }}>Flagged Posts (manual)</Text>
      <View style={{ gap:8 }}>
        {flagged.map(item => (
          <View key={item.id} style={[styles.row, { backgroundColor: theme.card }]}> 
            <Text style={{ color: theme.text }}>{item.preview || item.text || '(no content)'}</Text>
            <TouchableOpacity onPress={()=> clear(item.id)}><Text style={{ color:'#2E7D32', fontWeight:'700' }}>Clear</Text></TouchableOpacity>
          </View>
        ))}
      </View>
      </ScrollView>
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
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const toDate = (iso)=> (iso ? new Date(iso) : null);
  const validIso = (iso)=> !iso || /^\d{4}-\d{2}-\d{2}$/.test(iso);
  const createWithValidation = ()=>{
    if(!title) return Alert.alert('Validation','Title is required');
    const gm = Number(goalMinutes)||0; if (gm<0) return Alert.alert('Validation','Goal must be >= 0');
    if(!validIso(startAt) || !validIso(endAt)) return Alert.alert('Validation','Dates must be yyyy-mm-dd');
    const s = toDate(startAt); const e = toDate(endAt);
    if (s && e && e < s) return Alert.alert('Validation','End date must be after start date');
    onCreate({ title, description, goalMinutes: gm, teamEnabled, rewardPoints: Number(rewardPoints)||0, rewardBadge, startAt: s, endAt: e });
  };

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
        <TouchableOpacity onPress={()=> setShowStartPicker(true)} style={[styles.inp, { justifyContent:'center', backgroundColor: theme.card }]}>
          <Text style={{ color: theme.text }}>{startAt || 'Start (yyyy-mm-dd)'}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={()=> setShowEndPicker(true)} style={[styles.inp, { justifyContent:'center', backgroundColor: theme.card }]}>
          <Text style={{ color: theme.text }}>{endAt || 'End (yyyy-mm-dd)'}</Text>
        </TouchableOpacity>
      </View>
      {showStartPicker && (
        <DateTimePicker
          value={startAt? new Date(startAt) : new Date()}
          mode='date'
          display={Platform.OS==='ios' ? 'spinner' : 'default'}
          onChange={(e, d)=>{ setShowStartPicker(false); if(d){ const iso = d.toISOString().slice(0,10); setStartAt(iso); }} }
        />
      )}
      {showEndPicker && (
        <DateTimePicker
          value={endAt? new Date(endAt) : new Date()}
          mode='date'
          display={Platform.OS==='ios' ? 'spinner' : 'default'}
          onChange={(e, d)=>{ setShowEndPicker(false); if(d){ const iso = d.toISOString().slice(0,10); setEndAt(iso); }} }
        />
      )}
      <View style={{ flexDirection:'row', gap:8, marginBottom:8 }}>
        <TextInput placeholder='Reward points' placeholderTextColor={theme.textMuted} value={rewardPoints} onChangeText={setRewardPoints} keyboardType='numeric' style={[styles.inpS, { color: theme.text, backgroundColor: theme.card }]} />
        <TextInput placeholder='Reward badge' placeholderTextColor={theme.textMuted} value={rewardBadge} onChangeText={setRewardBadge} style={[styles.inp, { color: theme.text, backgroundColor: theme.card }]} />
      </View>
      <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:8 }}>
        <TouchableOpacity onPress={()=> setTeamEnabled(v=>!v)} style={{ paddingHorizontal:12, paddingVertical:8, backgroundColor: theme.card, borderRadius:10 }}>
          <Text style={{ color: theme.text, fontWeight:'700' }}>{teamEnabled ? 'Teams: ON' : 'Teams: OFF'}</Text>
        </TouchableOpacity>
        <PrimaryButton title='Create' onPress={createWithValidation} />
      </View>
      <View style={{ gap:8, marginTop:8 }}>
        {items.map(item => (
          <ChallengeRow key={item.id} theme={theme} item={item} onDelete={onDelete} onPostUpdate={onPostUpdate} />
        ))}
      </View>
    </View>
  );
}

function ChallengeRow({ theme, item, onDelete, onPostUpdate }){
  const [teams, setTeams] = useState([]);
  const [teamName, setTeamName] = useState('Team A');
  const [rewardUid, setRewardUid] = useState('');
  const [rewardBadge, setRewardBadge] = useState(item.rewardBadge || '');
  const [rewardPoints, setRewardPoints] = useState(String(item.rewardPoints||0));
  const [userQuery, setUserQuery] = useState('');
  const [userResults, setUserResults] = useState([]);

  useEffect(()=>{ (async()=>{ try { setTeams(await listTeams(item.id)); } catch {} })(); }, [item.id]);

  const addTeam = async()=>{
    if(!teamName) return;
    try { await upsertTeam(item.id, null, { name: teamName, totalMinutes: 0 }); setTeamName(''); setTeams(await listTeams(item.id)); } catch(e){ Alert.alert('Error', e.message); }
  };
  const removeTeam = async(id)=>{ try { await deleteTeam(item.id, id); setTeams(await listTeams(item.id)); } catch(e){ Alert.alert('Error', e.message); } };
  const award = async()=>{
    if (!rewardUid) return Alert.alert('Validation','Enter user UID');
    try { await fulfillChallengeReward({ challengeId: item.id, uid: rewardUid, badgeId: rewardBadge||null, badgeName: rewardBadge||null, points: Number(rewardPoints)||0 }); Alert.alert('Done','Reward fulfilled'); setRewardUid(''); } catch(e){ Alert.alert('Error', e.message); }
  };
  const recompute = async()=>{
    try { await recomputeTeamTotals(item.id); Alert.alert('Recomputed','Team totals updated from participants.'); setTeams(await listTeams(item.id)); } catch(e){ Alert.alert('Error', e.message); }
  };

  const searchUsers = async()=>{
    try {
      const qStr = userQuery.trim().toLowerCase(); if (!qStr) { setUserResults([]); return; }
      // Best effort: search by displayName or email prefix (requires indexes to be truly efficient)
      const ref = collection(db, 'users');
      // Try displayName
      let rows = [];
      try {
        const snap = await getDocs(query(ref, where('displayNameLower','>=', qStr), where('displayNameLower','<=', qStr + '\uf8ff'), limit(10)));
        snap.forEach(d=> rows.push({ id:d.id, ...d.data() }));
      } catch {}
      if (rows.length < 5) {
        try {
          const snap2 = await getDocs(query(ref, where('emailLower','>=', qStr), where('emailLower','<=', qStr + '\uf8ff'), limit(10)));
          snap2.forEach(d=> rows.push({ id:d.id, ...d.data() }));
        } catch {}
      }
      setUserResults(rows.slice(0,10));
    } catch { setUserResults([]); }
  };

  return (
    <View style={[styles.row, { backgroundColor: theme.card }]}> 
      <View style={{ flex:1 }}>
        <Text style={{ color: theme.text, fontWeight:'700' }}>{item.title}</Text>
        <Text style={{ color: theme.textMuted, fontSize:12 }}>{item.description}</Text>
        <Text style={{ color: theme.textMuted, fontSize:12 }}>Goal: {item.goalMinutes||item.targetMinutes||0}m • Teams: {item.teamEnabled? 'Yes':'No'}</Text>
        {item.teamEnabled && (
          <View style={{ marginTop:6 }}>
            <Text style={{ color: theme.textMuted, fontWeight:'700' }}>Teams</Text>
            <View style={{ flexDirection:'row', gap:8, marginVertical:6 }}>
              <TextInput placeholder='New team name' placeholderTextColor={theme.textMuted} value={teamName} onChangeText={setTeamName} style={[styles.inp, { color: theme.text, backgroundColor: theme.card }]} />
              <PrimaryButton title='Add team' onPress={addTeam} />
              <PrimaryButton title='Recompute totals' onPress={recompute} />
            </View>
            {teams.map(t => (
              <View key={t.id} style={[styles.row, { backgroundColor: theme.card, marginTop:6 }]}>
                <Text style={{ color: theme.text }}>{t.name} • {t.totalMinutes||0}m</Text>
                <TouchableOpacity onPress={()=> removeTeam(t.id)}><Text style={{ color:'#D32F2F', fontWeight:'700' }}>Remove</Text></TouchableOpacity>
              </View>
            ))}
          </View>
        )}
        <View style={{ height:8 }} />
        <Text style={{ color: theme.textMuted, fontWeight:'700' }}>Post update</Text>
        <View style={{ flexDirection:'row', gap:8, marginTop:6, alignItems:'center' }}>
          <PrimaryButton title='Cheer' onPress={()=> onPostUpdate(item.id, 'Keep it up!')} />
          <PrimaryButton title='Halfway!' onPress={()=> onPostUpdate(item.id, 'Halfway there!')} />
        </View>
        <View style={{ height:8 }} />
        <Text style={{ color: theme.textMuted, fontWeight:'700' }}>Fulfill reward</Text>
        <View style={{ flexDirection:'row', gap:8, marginTop:6 }}>
          <TextInput placeholder='User search (name/email)' placeholderTextColor={theme.textMuted} value={userQuery} onChangeText={setUserQuery} style={[styles.inp, { color: theme.text, backgroundColor: theme.card }]} />
          <PrimaryButton title='Search' onPress={searchUsers} />
          <TextInput placeholder='Badge name' placeholderTextColor={theme.textMuted} value={rewardBadge} onChangeText={setRewardBadge} style={[styles.inp, { color: theme.text, backgroundColor: theme.card }]} />
          <TextInput placeholder='Points' placeholderTextColor={theme.textMuted} value={rewardPoints} onChangeText={setRewardPoints} keyboardType='numeric' style={[styles.inpS, { color: theme.text, backgroundColor: theme.card }]} />
          <PrimaryButton title='Award' onPress={award} />
        </View>
        {userResults.length>0 && (
          <View style={{ marginTop:6 }}>
            {userResults.map(u=> (
              <TouchableOpacity key={u.id} onPress={()=> { setRewardUid(u.id); setUserQuery(u.displayName || u.email || u.id); }} style={{ flexDirection:'row', alignItems:'center', paddingVertical:6 }}>
                <View style={{ width:28, height:28, borderRadius:14, backgroundColor: theme.bg === '#0B1722' ? '#10202f' : '#E3F2FD', alignItems:'center', justifyContent:'center', marginRight:8 }}>
                  <Text style={{ color: theme.text, fontWeight:'700' }}>{(u.displayName||u.email||'U').slice(0,1).toUpperCase()}</Text>
                </View>
                <View style={{ flex:1 }}>
                  <Text style={{ color: theme.text, fontWeight:'700' }}>{u.displayName || '(no name)'}</Text>
                  <Text style={{ color: theme.textMuted, fontSize:12 }}>{u.email || u.id}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
      <TouchableOpacity onPress={()=> onDelete(item.id)}><Text style={{ color:'#D32F2F', fontWeight:'700', marginLeft:8 }}>Delete</Text></TouchableOpacity>
    </View>
  );
}
const styles = StyleSheet.create({
  inp:{ flex:1, height:44, borderRadius:10, paddingHorizontal:10 },
  row:{ padding:8, borderRadius:12, flexDirection:'row', alignItems:'center', justifyContent:'space-between' }
});
