import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/ThemeProvider';
import PrimaryButton from '../../src/components/PrimaryButton';
import GradientCard from '../../src/components/GradientCard';
import { listAdminMutes, addAdminMuteAnon, removeAdminMuteAnon } from '../../src/services/admin';
import ShimmerCard from '../../src/components/ShimmerCard';

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
        <ShimmerCard colors={['#FFE0B2', '#FFCC80', '#FFB74D']} shimmerSpeed={3000}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255, 152, 0, 0.2)' }}>
            <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFF3E0', justifyContent: 'center', alignItems: 'center', shadowColor: '#FF9800', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 }}>
              <Ionicons name="volume-mute" size={28} color="#FF9800" />
            </View>
            <View style={{ flex: 1, marginLeft: 16 }}>
              <Text style={{ fontSize: 24, fontWeight: '800', letterSpacing: 0.3, color: theme.text }}>Muted Users</Text>
              <Text style={{ fontSize: 14, fontWeight: '500', marginTop: 4, color: theme.textMuted }}>Manage Anonymous Mutes</Text>
            </View>
          </View>
        </ShimmerCard>
        <Text style={{ color: theme.text, fontWeight:'800', fontSize:16, marginBottom:8 }}>Add New Mute</Text>
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
          <GradientCard colors={['#FF9800', '#F57C00']} style={{ marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex:1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <Ionicons name="person-circle" size={20} color="#fff" />
                  <Text style={{ color: '#fff', fontWeight:'800', fontSize: 16, marginLeft: 8 }}>{item.id}</Text>
                </View>
                {!!item.reason && <Text style={{ color: '#fff', opacity: 0.9, fontSize:12 }}>{item.reason}</Text>}
              </View>
              <TouchableOpacity onPress={()=> remove(item.id)}><Text style={{ color:'#fff', fontWeight:'700', fontSize: 16 }}>✕</Text></TouchableOpacity>
            </View>
          </GradientCard>
        )}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  inp:{ flex:1, height:52, borderRadius:14, paddingHorizontal:16, fontSize:15, borderWidth:2, borderColor:'rgba(0,0,0,0.1)', shadowColor:'#000', shadowOpacity:0.04, shadowRadius:4, elevation:1 },
  row:{ padding:16, borderRadius:14, flexDirection:'row', alignItems:'center', justifyContent:'space-between', shadowColor:'#000', shadowOpacity:0.06, shadowRadius:6, elevation:2, borderWidth:1, borderColor:'rgba(0,0,0,0.05)' }
});
