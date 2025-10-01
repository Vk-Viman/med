import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import PrimaryButton from '../../src/components/PrimaryButton';
import { listMeditations, createMeditation, updateMeditation, deleteMeditation, uploadMeditationAudio } from '../../src/services/admin';
import * as DocumentPicker from 'expo-document-picker';

export default function AdminMeditations(){
  const { theme } = useTheme();
  const [items, setItems] = useState([]);
  const [title, setTitle] = useState('');
  const [duration, setDuration] = useState('10');
  const [category, setCategory] = useState('Calm');
  const [bgSound, setBgSound] = useState('Rain');
  const [audioUrl, setAudioUrl] = useState('');
  const pickAndUpload = async ()=>{
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ['audio/*'], multiple: false, copyToCacheDirectory: true });
      if (res.canceled) return;
      const file = res.assets?.[0] || res;
      const uri = file.uri || file?.asset?.uri;
      const name = file.name || `med_${Date.now()}.mp3`;
      if (!uri) return Alert.alert('Pick failed','No file URI available.');
      const url = await uploadMeditationAudio({ uri, filename: name });
      setAudioUrl(url);
      Alert.alert('Uploaded','Audio uploaded and URL filled.');
    } catch (e) {
      let msg = String(e?.message || e);
      if (/Cannot find module|Unable to resolve module/i.test(msg)) {
        msg = 'Document Picker is not installed in this app build. On Expo Go, ensure the expo-document-picker version matches SDK 54. For a Production/Dev Build, add expo-document-picker and rebuild.';
      }
      Alert.alert('Upload failed', msg);
    }
  };

  const load = async()=>{ try { const rows = await listMeditations(); setItems(rows); } catch{} };
  useEffect(()=>{ load(); },[]);

  const add = async ()=>{
    if(!title) return Alert.alert('Validation','Title is required');
    const dur = Number(duration)||0; if (dur<=0) return Alert.alert('Validation','Duration must be greater than 0');
    if(!audioUrl || !/^https?:\/\//.test(audioUrl)) return Alert.alert('Validation','Provide a valid audio URL (https)');
    try { await createMeditation({ title, duration: dur, category, bgSound, url: audioUrl }); setTitle(''); setDuration('10'); setAudioUrl(''); await load(); }
    catch(e){ Alert.alert('Error', e.message); }
  };
  const saveItem = async (it)=>{
    if(!it.title) return Alert.alert('Validation','Title required');
    if(!(Number(it.duration)>0)) return Alert.alert('Validation','Duration must be > 0');
    if(it.url && !/^https?:\/\//.test(it.url)) return Alert.alert('Validation','Audio URL must be http(s)');
    try { await updateMeditation(it.id, { title: it.title, duration: it.duration, category: it.category, bgSound: it.bgSound, url: it.url }); await load(); } catch(e){ Alert.alert('Error', e.message); }
  };
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
      <View style={{ flexDirection:'row', gap:8, marginBottom:8 }}>
        <TextInput placeholder='Audio URL (https)' placeholderTextColor={theme.textMuted} value={audioUrl} onChangeText={setAudioUrl} style={[styles.inp, { color: theme.text, backgroundColor: theme.card }]} />
        <PrimaryButton title='Pick file' onPress={pickAndUpload} />
      </View>
      <PrimaryButton title='Add' onPress={add} />
      <FlatList data={items} keyExtractor={(it)=> it.id} contentContainerStyle={{ gap:8, marginTop:12 }} renderItem={({ item })=> (
        <View style={[styles.row, { backgroundColor: theme.card }]}>
          <TextInput value={item.title} onChangeText={(t)=> Object.assign(item, { title: t })} style={[styles.inp, { color: theme.text, backgroundColor: theme.card }]} />
          <TextInput value={String(item.duration||10)} onChangeText={(t)=> Object.assign(item, { duration: Number(t)||10 })} keyboardType='numeric' style={[styles.inpS, { color: theme.text, backgroundColor: theme.card }]} />
          <TextInput value={item.category||''} onChangeText={(t)=> Object.assign(item, { category: t })} style={[styles.inp, { color: theme.text, backgroundColor: theme.card }]} />
          <TextInput value={item.bgSound||''} onChangeText={(t)=> Object.assign(item, { bgSound: t })} style={[styles.inp, { color: theme.text, backgroundColor: theme.card }]} />
          <TextInput value={item.url||''} onChangeText={(t)=> Object.assign(item, { url: t })} placeholder='Audio URL' placeholderTextColor={theme.textMuted} style={[styles.inp, { color: theme.text, backgroundColor: theme.card }]} />
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
