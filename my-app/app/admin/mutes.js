import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, FlatList } from 'react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import PrimaryButton from '../../src/components/PrimaryButton';
import { listAdminMutes, addAdminMuteAnon, removeAdminMuteAnon } from '../../src/services/admin';

export default function AdminMutes(){
  const { theme } = useTheme();
  const [items, setItems] = useState([]);
  const [anonId, setAnonId] = useState('');
  const [reason, setReason] = useState('');
  const load = async()=>{ try { setItems(await listAdminMutes({ limit: 500 })); } catch{} };
  useEffect(()=>{ load(); },[]);
  const add = async()=>{
    const id = anonId.trim(); if(!id) return Alert.alert('Validation','Enter anonId');
    try { await addAdminMuteAnon(id, { reason }); setAnonId(''); setReason(''); await load(); }
    catch(e){ Alert.alert('Failed', e?.message||'Could not add mute'); }
  };
  const remove = async(id)=>{
    try { await removeAdminMuteAnon(id); await load(); }
    catch(e){ Alert.alert('Failed', e?.message||'Could not remove mute'); }
  };
  return (
    <View style={{ flex:1, backgroundColor: theme.bg }}>
      <View style={{ padding:12 }}>
        <Text style={{ color: theme.text, fontWeight:'800', fontSize:16, marginBottom:8 }}>Global Anon Mutes</Text>
        <View style={{ flexDirection:'row', gap:8, marginBottom:8 }}>
          <TextInput placeholder='anon_xxxx' placeholderTextColor={theme.textMuted} value={anonId} onChangeText={setAnonId} style={[styles.inp,{ backgroundColor: theme.card, color: theme.text }]} />
          <TextInput placeholder='Reason (optional)' placeholderTextColor={theme.textMuted} value={reason} onChangeText={setReason} style={[styles.inp,{ backgroundColor: theme.card, color: theme.text }]} />
          <PrimaryButton title='Add' onPress={add} />
        </View>
      </View>
      <FlatList
        data={items}
        keyExtractor={(it)=> it.id}
        contentContainerStyle={{ padding:12, gap:8 }}
        renderItem={({ item }) => (
          <View style={[styles.row,{ backgroundColor: theme.card }]}>
            <View style={{ flex:1 }}>
              <Text style={{ color: theme.text, fontWeight:'700' }}>{item.id}</Text>
              {!!item.reason && <Text style={{ color: theme.textMuted, fontSize:12 }}>{item.reason}</Text>}
            </View>
            <TouchableOpacity onPress={()=> remove(item.id)}><Text style={{ color:'#D32F2F', fontWeight:'700' }}>Remove</Text></TouchableOpacity>
          </View>
        )}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  inp:{ flex:1, height:52, borderRadius:14, paddingHorizontal:16, fontSize:15, borderWidth:2, borderColor:'rgba(0,0,0,0.1)', shadowColor:'#000', shadowOpacity:0.04, shadowRadius:4, elevation:1 },
  row:{ padding:16, borderRadius:14, flexDirection:'row', alignItems:'center', justifyContent:'space-between', shadowColor:'#000', shadowOpacity:0.06, shadowRadius:6, elevation:2, borderWidth:1, borderColor:'rgba(0,0,0,0.05)' }
});
