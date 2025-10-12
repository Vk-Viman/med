import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/ThemeProvider';
import PrimaryButton from '../../src/components/PrimaryButton';
import GradientCard from '../../src/components/GradientCard';
import { listPlanTemplates, createPlanTemplate, updatePlanTemplate, deletePlanTemplate } from '../../src/services/admin';
import ShimmerCard from '../../src/components/ShimmerCard';

export default function AdminPlans(){
  const { theme } = useTheme();
  const [items, setItems] = useState([]);
  const [name, setName] = useState('Starter Plan');
  const [desc, setDesc] = useState('Good for beginners');

  const load = async()=>{ try { const rows = await listPlanTemplates(); setItems(rows); } catch{} };
  useEffect(()=>{ load(); },[]);

  const add = async ()=>{
    try { await createPlanTemplate({ name, description: desc }); setName(''); setDesc(''); await load(); }
    catch(e){ Alert.alert('Error', e.message); }
  };
  const saveItem = async (it)=>{ try { await updatePlanTemplate(it.id, { name: it.name, description: it.description }); await load(); } catch(e){ Alert.alert('Error', e.message); } };
  const remove = async (id)=>{ try { await deletePlanTemplate(id); await load(); } catch(e){ Alert.alert('Error', e.message); } };

  return (
    <View style={{ flex:1, backgroundColor: theme.bg, padding:12 }}>
      <ShimmerCard colors={['#F3E5F5', '#E1BEE7', '#CE93D8']} shimmerSpeed={3000}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(171, 71, 188, 0.2)' }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#F3E5F5', justifyContent: 'center', alignItems: 'center', shadowColor: '#AB47BC', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 }}>
            <Ionicons name="calendar" size={28} color="#AB47BC" />
          </View>
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Text style={{ fontSize: 24, fontWeight: '800', letterSpacing: 0.3, color: theme.text }}>Plan Templates</Text>
            <Text style={{ fontSize: 14, fontWeight: '500', marginTop: 4, color: theme.textMuted }}>Manage Meditation Plans</Text>
          </View>
        </View>
      </ShimmerCard>
      <Text style={{ color: theme.text, fontWeight:'800', fontSize:16, marginBottom:8 }}>Create Plan Template</Text>
      <TextInput placeholder='Name' placeholderTextColor={theme.textMuted} value={name} onChangeText={setName} style={[styles.inp, { color: theme.text, backgroundColor: theme.card }]} />
      <View style={{ height:6 }} />
      <TextInput placeholder='Description' placeholderTextColor={theme.textMuted} value={desc} onChangeText={setDesc} style={[styles.inp, { color: theme.text, backgroundColor: theme.card }]} />
      <View style={{ height:6 }} />
      <PrimaryButton title='Add' onPress={add} />
      <FlatList data={items} keyExtractor={(it)=> it.id} contentContainerStyle={{ gap:8, marginTop:12 }} renderItem={({ item })=> (
        <View style={[styles.row, { backgroundColor: theme.card }]}>
          <TextInput value={item.name} onChangeText={(t)=> Object.assign(item, { name: t })} style={[styles.inp, { color: theme.text, backgroundColor: theme.card }]} />
          <TextInput value={item.description||''} onChangeText={(t)=> Object.assign(item, { description: t })} style={[styles.inp, { color: theme.text, backgroundColor: theme.card }]} />
          <View style={{ flexDirection:'row', gap:12 }}>
            <TouchableOpacity onPress={()=> saveItem(item)}><Text style={{ color:'#1976D2', fontWeight:'700' }}>Save</Text></TouchableOpacity>
            <TouchableOpacity onPress={()=> remove(item.id)}><Text style={{ color:'#D32F2F', fontWeight:'700' }}>Delete</Text></TouchableOpacity>
          </View>
        </View>
      )} />
    </View>
  );
}
const styles = StyleSheet.create({
  inp:{ height:52, borderRadius:14, paddingHorizontal:16, fontSize:15, borderWidth:2, borderColor:'rgba(0,0,0,0.1)', shadowColor:'#000', shadowOpacity:0.04, shadowRadius:4, elevation:1 },
  row:{ padding:14, borderRadius:14, shadowColor:'#000', shadowOpacity:0.06, shadowRadius:6, elevation:2, borderWidth:1, borderColor:'rgba(0,0,0,0.05)' }
});
