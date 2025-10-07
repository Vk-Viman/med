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
      const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8, base64: true });
      if(res.canceled) return;
      const asset = res.assets?.[0];
      if(!asset?.base64){ Alert.alert('Error','Could not read image'); return; }
      // Upload to Storage
      const ts = Date.now();
      const ext = (asset.fileName?.split('.').pop() || 'jpg').toLowerCase();
      const path = `badge-icons/${ts}.${ext}`;
      const r = ref(storage, path);
      const mime = ext==='png' ? 'image/png' : (ext==='webp'? 'image/webp' : 'image/jpeg');
      await uploadString(r, asset.base64, 'base64', { contentType: mime });
      const url = await getDownloadURL(r);
      setForm(s=> ({ ...s, iconUrl: url }));
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
  title:{ fontSize:22, fontWeight:'800', marginBottom:12 },
  subtitle:{ fontSize:16, fontWeight:'800', marginVertical:12 },
  card:{ padding:12, borderRadius:12, marginBottom:12 },
  label:{ fontSize:12, fontWeight:'700', marginTop:6 },
  input:{ borderWidth:1, borderColor:'#90CAF9', borderRadius:10, paddingHorizontal:10, height:40, backgroundColor:'#ffffffCC' },
  rowTitle:{ fontSize:14, fontWeight:'800' },
});
