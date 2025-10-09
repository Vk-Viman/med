import React, { useEffect, useRef, useState } from 'react';
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
  const [audioUrl, setAudioUrl] = useState('');
  const [testing, setTesting] = useState(false);
  const soundRef = useRef(null);

  const load = async()=>{ try { const rows = await listMeditations(); setItems(rows); } catch{} };
  useEffect(()=>{ load(); },[]);

  useEffect(()=>{
    return () => { (async()=>{ try { if (soundRef.current) { await soundRef.current.unloadAsync(); soundRef.current = null; } } catch {} })(); };
  },[]);

  const testPlay = async ()=>{
    try {
      if (!audioUrl || !/^https?:\/\//.test(audioUrl)) return Alert.alert('Validation','Provide a valid https audio URL');
      setTesting(true);
      let AudioNS = null;
      try { const m = await import('expo-audio'); AudioNS = m?.Audio || m; } catch {}
      if (!AudioNS || !AudioNS.Sound) {
        try { const m2 = await import('expo-av'); AudioNS = m2?.Audio; } catch {}
      }
      if (!AudioNS || !AudioNS.Sound) throw new Error('Audio module not available in this build');
      try { await AudioNS.setAudioModeAsync?.({ playsInSilentModeIOS: true }); } catch {}
      if (soundRef.current) { try { await soundRef.current.unloadAsync(); } catch {} soundRef.current = null; }
      const { sound } = await AudioNS.Sound.createAsync({ uri: audioUrl }, { shouldPlay: true });
      soundRef.current = sound;
      // Auto-stop after 5 seconds
      setTimeout(async()=>{ try { if (soundRef.current === sound) { await sound.unloadAsync(); soundRef.current = null; } } catch {} }, 5000);
    } catch (e) {
      Alert.alert('Test failed', String(e?.message || e));
    } finally { setTesting(false); }
  };

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
      <View style={{ marginBottom:8 }}>
        <TextInput placeholder='Audio URL (https)' placeholderTextColor={theme.textMuted} value={audioUrl} onChangeText={setAudioUrl} style={[styles.inp, { color: theme.text, backgroundColor: theme.card }]} />
        <View style={{ flexDirection:'row', alignItems:'center', marginTop:6, gap:8 }}>
          <PrimaryButton title={testing? 'Playing…' : 'Test Play'} onPress={testPlay} disabled={testing} />
          <Text style={{ color: theme.textMuted, fontSize: 12 }}>Paste a direct https link to an audio file (.mp3 or .m4a). Test plays ~5s.</Text>
        </View>
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
  inp:{ flex:1, height:52, borderRadius:14, paddingHorizontal:16, fontSize:15, borderWidth:2, borderColor:'rgba(0,0,0,0.1)', shadowColor:'#000', shadowOpacity:0.04, shadowRadius:4, elevation:1 },
  inpS:{ width:80, height:52, borderRadius:14, paddingHorizontal:12, fontSize:15, borderWidth:2, borderColor:'rgba(0,0,0,0.1)', shadowColor:'#000', shadowOpacity:0.04, shadowRadius:4, elevation:1 },
  row:{ padding:14, borderRadius:14, shadowColor:'#000', shadowOpacity:0.06, shadowRadius:6, elevation:2, borderWidth:1, borderColor:'rgba(0,0,0,0.05)' }
});
