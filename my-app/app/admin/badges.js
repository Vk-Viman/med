import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, Button, Alert, Image, Platform } from 'react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import PrimaryButton from '../../src/components/PrimaryButton';
import { listAdminBadges, createAdminBadge, updateAdminBadge, deleteAdminBadge } from '../../src/services/admin';
import * as ImagePicker from 'expo-image-picker';
import { storage } from '../../firebase/firebaseConfig';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';

export default function AdminBadges(){
  const { theme } = useTheme();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([]);
  const [form, setForm] = useState({ id:'', name:'', description:'', type:'minute', threshold:'' , emoji:'', iconUrl:''});

  const load = async()=>{
    setLoading(true);
    try{ const list = await listAdminBadges(); setRows(list); }catch{ Alert.alert('Error','Failed to load badges'); }
    setLoading(false);
  };
  useEffect(()=>{ load(); },[]);

  const pickIcon = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if(perm.status !== 'granted') { Alert.alert('Permission','Media library permission required.'); return; }
      const pickerOpts = { quality: 0.8, base64: true };
      try {
        const mt = (ImagePicker && ImagePicker.MediaType && ImagePicker.MediaType.Images) || (ImagePicker && ImagePicker.MediaTypeOptions && ImagePicker.MediaTypeOptions.Images);
        if (mt) pickerOpts.mediaTypes = mt;
      } catch {}
      const res = await ImagePicker.launchImageLibraryAsync(pickerOpts);
      if(res.canceled) return;
      const asset = res.assets?.[0];
      if(!asset?.base64){ Alert.alert('Error','Could not read image'); return; }
      // Preferred: upload to Storage; Fallback: use data URL directly in iconUrl (works like avatar in settings)
      const ts = Date.now();
      const ext = (asset.fileName?.split('.').pop() || 'jpg').toLowerCase();
      const path = `badge-icons/${ts}.${ext}`;
      const r = ref(storage, path);
      const mime = ext==='png' ? 'image/png' : (ext==='webp'? 'image/webp' : 'image/jpeg');
      try {
        // RN-friendly path: use uploadString with base64 to avoid Blob/ArrayBuffer requirements
        await uploadString(r, asset.base64, 'base64', { contentType: mime });
        const url = await getDownloadURL(r);
        setForm(s=> ({ ...s, iconUrl: url }));
      } catch (e) {
        // Fallback to data URL (consistent with avatar picker usage)
        const dataUrl = `data:${mime};base64,${asset.base64}`;
        setForm(s=> ({ ...s, iconUrl: dataUrl }));
      }
    } catch(e){ Alert.alert('Upload Failed', e?.message || String(e)); }
  };

  const save = async()=>{
    try{
      const payload = { name: form.name, description: form.description, type: form.type, threshold: form.threshold? Number(form.threshold): undefined, emoji: form.emoji, iconUrl: form.iconUrl };
      if(form.id){ await updateAdminBadge(form.id, payload); } else { await createAdminBadge(payload); }
      setForm({ id:'', name:'', description:'', type:'minute', threshold:'', emoji:'', iconUrl:'' });
      await load();
    }catch(e){ Alert.alert('Save Failed', e?.message || String(e)); }
  };

  const edit = (b)=> setForm({ id:b.id, name:b.name||'', description:b.description||'', type:b.type||'minute', threshold:String(b.threshold||''), emoji:b.emoji||'' });
  const del = async (id)=>{ try{ await deleteAdminBadge(id); await load(); }catch(e){ Alert.alert('Delete Failed', e?.message || String(e)); } };

  return (
    <ScrollView style={{ flex:1, backgroundColor: theme.bg }} contentContainerStyle={{ padding:16 }}>
      <Text style={[styles.title,{ color: theme.text }]}>Badges</Text>
      <View style={[styles.card,{ backgroundColor: theme.card }]}> 
        <Text style={[styles.label,{ color: theme.text }]}>Name</Text>
        <TextInput value={form.name} onChangeText={(v)=> setForm(s=>({ ...s, name:v }))} placeholder='Name' style={styles.input} />
        <Text style={[styles.label,{ color: theme.text }]}>Description</Text>
        <TextInput value={form.description} onChangeText={(v)=> setForm(s=>({ ...s, description:v }))} placeholder='Description' style={[styles.input,{ height:70 }]} multiline />
        <Text style={[styles.label,{ color: theme.text }]}>Type (minute/streak/event/challenge)</Text>
        <TextInput value={form.type} onChangeText={(v)=> setForm(s=>({ ...s, type:v }))} placeholder='minute' style={styles.input} />
        <Text style={[styles.label,{ color: theme.text }]}>Threshold (for minute/streak)</Text>
        <TextInput value={form.threshold} onChangeText={(v)=> setForm(s=>({ ...s, threshold:v }))} placeholder='e.g., 50' keyboardType='numeric' style={styles.input} />
        <Text style={[styles.label,{ color: theme.text }]}>Emoji (optional)</Text>
        <TextInput value={form.emoji} onChangeText={(v)=> setForm(s=>({ ...s, emoji:v }))} placeholder='e.g., 🏅' style={styles.input} />
        <Text style={[styles.label,{ color: theme.text }]}>Icon Image (optional)</Text>
        {!!form.iconUrl && (
          <Image source={{ uri: form.iconUrl }} style={{ width:64, height:64, borderRadius:12, alignSelf:'flex-start', marginBottom:6 }} />
        )}
        <View style={{ flexDirection:'row', gap:8, marginBottom:8 }}>
          <Button title={form.iconUrl? 'Replace Icon' : 'Upload Icon'} onPress={pickIcon} />
          {!!form.iconUrl && <Button title='Remove' color={'#D32F2F'} onPress={()=> setForm(s=>({ ...s, iconUrl:'' }))} />}
        </View>
        <PrimaryButton title={form.id? 'Update' : 'Create'} onPress={save} fullWidth />
      </View>

      <Text style={[styles.subtitle,{ color: theme.text }]}>Existing</Text>
      {loading ? (
        <Text style={{ color: theme.textMuted }}>Loading…</Text>
      ) : rows.length === 0 ? (
        <Text style={{ color: theme.textMuted }}>No badges</Text>
      ) : (
        rows.map(b => (
          <View key={b.id} style={[styles.card,{ backgroundColor: theme.card }]}> 
            <Text style={[styles.rowTitle,{ color: theme.text }]}>{b.emoji || '🏅'} {b.name || b.id}</Text>
            {!!b.description && <Text style={{ color: theme.textMuted }}>{b.description}</Text>}
            <View style={{ flexDirection:'row', gap:8, marginTop:8 }}>
              <Button title='Edit' onPress={()=> edit(b)} />
              <Button title='Delete' color={'#D32F2F'} onPress={()=> del(b.id)} />
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  title:{ fontSize:28, fontWeight:'800', marginBottom:18, letterSpacing:0.3 },
  subtitle:{ fontSize:20, fontWeight:'800', marginVertical:16, letterSpacing:0.2 },
  card:{ padding:18, borderRadius:16, marginBottom:16, shadowColor:'#000', shadowOpacity:0.08, shadowRadius:8, elevation:3, borderWidth:1, borderColor:'rgba(0,0,0,0.05)' },
  label:{ fontSize:14, fontWeight:'700', marginTop:10, marginBottom:6, letterSpacing:0.2 },
  input:{ borderWidth:2, borderColor:'#90CAF9', borderRadius:12, paddingHorizontal:14, height:48, backgroundColor:'#ffffffCC', fontSize:15, shadowColor:'#000', shadowOpacity:0.04, shadowRadius:4, elevation:1 },
  rowTitle:{ fontSize:16, fontWeight:'800', letterSpacing:0.2 },
});
