import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import PrimaryButton from '../../src/components/PrimaryButton';
import { listMeditations, createMeditation, updateMeditation, deleteMeditation } from '../../src/services/admin';

export default function AdminMeditations(){
  const { theme } = useTheme();
  const [items, setItems] = useState([]);
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('10');
  const [category, setCategory] = useState('Calm');
  const [bgSound, setBgSound] = useState('Rain');

  const load = async()=>{ try { const rows = await listMeditations(); setItems(rows); } catch{} };
  useEffect(()=>{ load(); },[]);

  const add = async ()=>{
    if(!title) return;
    try { await createMeditation({ title, duration: Number(duration)||10, category, bgSound }); setTitle(''); setDuration('10'); await load(); }
    catch(e){ Alert.alert('Error', e.message); }
  };
  const saveItem = async (it)=>{ try { await updateMeditation(it.id, { title: it.title, duration: it.duration, category: it.category, bgSound: it.bgSound }); await load(); } catch(e){ Alert.alert('Error', e.message); } };
  const remove = async (id)=>{ try { await deleteMeditation(id); await load(); } catch(e){ Alert.alert('Error', e.message); } };

  return (
    <View style={{ flex:1, backgroundColor: theme.bg, padding:12 }}>
      <Text style={{ color: theme.text, fontWeight:'800', fontSize:16, marginBottom:8 }}>Create Meditation</Text>
      <View style={{ flexDirection:'row', gap:8, marginBottom:8 }}>
        <TextInput placeholder='Title' placeholderTextColor={theme.textMuted} value={title} onChangeText={setTitle} style={[styles.inp, { color: theme.text, backgroundColor: theme.card }]} />
        <TextInput placeholder='Min' placeholderTextColor={theme.textMuted} value={duration} onChangeText={setDuration} keyboardType='numeric' style={[styles.inpS, { color: theme.text, backgroundColor: theme.card }]} />
      </View>
      <View style={{ flexDirection:'row', gap:8, marginBottom:8 }}>
        <TextInput placeholder='Category' placeholderTextColor={theme.textMuted} value={category} onChangeText={setCategory} style={[styles.inp, { color: theme.text, backgroundColor: theme.card }]} />
        <TextInput placeholder='Background Sound' placeholderTextColor={theme.textMuted} value={bgSound} onChangeText={setBgSound} style={[styles.inp, { color: theme.text, backgroundColor: theme.card }]} />
      </View>
      <PrimaryButton title='Add' onPress={add} />
      <FlatList data={items} keyExtractor={(it)=> it.id} contentContainerStyle={{ gap:8, marginTop:12 }} renderItem={({ item })=> (
        <View style={[styles.row, { backgroundColor: theme.card }]}>
          <TextInput value={item.title} onChangeText={(t)=> Object.assign(item, { title: t })} style={[styles.inp, { color: theme.text, backgroundColor: theme.card }]} />
          <TextInput value={String(item.duration||10)} onChangeText={(t)=> Object.assign(item, { duration: Number(t)||10 })} keyboardType='numeric' style={[styles.inpS, { color: theme.text, backgroundColor: theme.card }]} />
          <TextInput value={item.category||''} onChangeText={(t)=> Object.assign(item, { category: t })} style={[styles.inp, { color: theme.text, backgroundColor: theme.card }]} />
          <TextInput value={item.bgSound||''} onChangeText={(t)=> Object.assign(item, { bgSound: t })} style={[styles.inp, { color: theme.text, backgroundColor: theme.card }]} />
          <TouchableOpacity onPress={()=> saveItem(item)}><Text style={{ color:'#1976D2', fontWeight:'700' }}>Save</Text></TouchableOpacity>
          <TouchableOpacity onPress={()=> remove(item.id)}><Text style={{ color:'#D32F2F', fontWeight:'700' }}>Delete</Text></TouchableOpacity>
        </View>
      )} />
    </View>
  );
}
const styles = StyleSheet.create({
  inp:{ flex:1, height:44, borderRadius:10, paddingHorizontal:10 },
  inpS:{ width:70, height:44, borderRadius:10, paddingHorizontal:10 },
  row:{ padding:8, borderRadius:12 }
});
