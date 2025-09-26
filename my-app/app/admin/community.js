import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import PrimaryButton from '../../src/components/PrimaryButton';
import { listGroups, createGroup, deleteGroup, listFlaggedPosts, clearFlag } from '../../src/services/admin';

export default function AdminCommunity(){
  const { theme } = useTheme();
  const [groups, setGroups] = useState([]);
  const [name, setName] = useState('7‑Day Calm');
  const [flagged, setFlagged] = useState([]);
  const load = async()=>{ try { setGroups(await listGroups()); setFlagged(await listFlaggedPosts()); } catch{} };
  useEffect(()=>{ load(); },[]);
  const add = async()=>{ try { await createGroup({ name }); setName(''); await load(); } catch(e){ Alert.alert('Error', e.message); } };
  const remove = async(id)=>{ try { await deleteGroup(id); await load(); } catch(e){ Alert.alert('Error', e.message); } };
  const clear = async(id)=>{ try { await clearFlag(id); await load(); } catch(e){ Alert.alert('Error', e.message); } };
  return (
    <View style={{ flex:1, backgroundColor: theme.bg, padding:12 }}>
      <Text style={{ color: theme.text, fontWeight:'800', fontSize:16, marginBottom:8 }}>Groups & Challenges</Text>
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
const styles = StyleSheet.create({
  inp:{ flex:1, height:44, borderRadius:10, paddingHorizontal:10 },
  row:{ padding:8, borderRadius:12, flexDirection:'row', alignItems:'center', justifyContent:'space-between' }
});
