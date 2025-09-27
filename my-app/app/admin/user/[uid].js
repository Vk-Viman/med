import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Switch, Alert } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../../src/theme/ThemeProvider';
import PrimaryButton from '../../../src/components/PrimaryButton';
import { getUserById, updateUserRole, requestWipeForUser, adminBumpSessionEpoch, listUserMoodDocs } from '../../../src/services/admin';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system/legacy';
import { useRouter } from 'expo-router';

export default function AdminUserDetails(){
  const { uid } = useLocalSearchParams();
  const { theme } = useTheme();
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [admin, setAdmin] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(()=>{ (async()=>{ try { const u = await getUserById(String(uid)); setUser(u); setAdmin(u?.userType === 'admin'); } catch{} })(); }, [uid]);

  const saveRole = async ()=>{
    if(!user) return; if(saving) return; setSaving(true);
    try { await updateUserRole(user.id, admin? 'admin' : 'user'); Alert.alert('Saved','Role updated.'); }
    catch(e){ Alert.alert('Error', e.message); }
    finally{ setSaving(false); }
  };

  const flagWipe = async ()=>{
    if(!user) return;
    try { await requestWipeForUser(user.id); Alert.alert('Wipe Requested','The user device will wipe on next sync.'); }
    catch(e){ Alert.alert('Error', e.message); }
  };
  const forceSignOut = async ()=>{
    if(!user) return;
    try { await adminBumpSessionEpoch(user.id); Alert.alert('Success','User sessions will be signed out shortly.'); }
    catch(e){ Alert.alert('Error', e.message); }
  };
  const exportUserMoods = async (fmt='json')=>{
    if(!user || exporting) return; setExporting(true);
    try {
      const rows = await listUserMoodDocs(user.id, { limit: 1000 });
      if(!rows.length){ Alert.alert('Export','No entries to export.'); return; }
      const ts = new Date(); const pad = (n)=> String(n).padStart(2,'0');
      const stamp = `${ts.getFullYear()}${pad(ts.getMonth()+1)}${pad(ts.getDate())}_${pad(ts.getHours())}${pad(ts.getMinutes())}${pad(ts.getSeconds())}`;
      const filename = `user_${user.id}_moods_${stamp}.${fmt==='csv'?'csv':'json'}`;
      let content = '';
      let mimeType = fmt==='csv'? 'text/csv' : 'application/json';
      if(fmt==='csv'){
        const headers = Object.keys(rows[0]||{});
        const header = headers.join(',');
        const body = rows.map(r => headers.map(h => typeof r[h] === 'string' ? '"'+ String(r[h]).replace(/"/g,'""') +'"' : String(r[h] ?? '')).join(',')).join('\n');
        content = [header, body].join('\n');
      } else {
        content = JSON.stringify({ exportedAt:new Date().toISOString(), uid: user.id, count: rows.length, entries: rows }, null, 2);
      }
      const uri = `${FileSystem.cacheDirectory}${filename}`;
      // Write with fallback encoding for compatibility
      try { await FileSystem.writeAsStringAsync(uri, content); }
      catch(e1){ try { await FileSystem.writeAsStringAsync(uri, content, { encoding: 'utf8' }); } catch(e2){ Alert.alert('Export Failed', String(e2?.message||e2)); throw e2; } }
      try {
        if(await Sharing.isAvailableAsync()){
          await Sharing.shareAsync(uri, { mimeType, dialogTitle: `Share ${filename}` });
        } else {
          Alert.alert('Export', `File saved to cache: ${uri}`);
        }
      } catch(e){ Alert.alert('Export Failed', String(e?.message||e)); }
    } catch(e){ Alert.alert('Export Failed', e.message); }
    finally { setExporting(false); }
  };

  if(!user){
    return <View style={{ flex:1, alignItems:'center', justifyContent:'center', backgroundColor: theme.bg }}><Text style={{ color: theme.text }}>Loading...</Text></View>;
  }
  return (
    <View style={{ flex:1, backgroundColor: theme.bg, padding:16 }}>
      <Text style={[styles.h1, { color: theme.text }]}>{user.displayName || 'Unnamed'}</Text>
      <Text style={{ color: theme.textMuted }}>{user.email}</Text>
      <View style={{ height:12 }} />
      <View style={styles.row}> 
        <Text style={[styles.label, { color: theme.text }]}>Admin</Text>
        <Switch value={admin} onValueChange={setAdmin} />
      </View>
      <PrimaryButton title={saving? 'Saving...' : 'Save'} disabled={saving} onPress={saveRole} fullWidth />
      <View style={{ height:8 }} />
      <PrimaryButton title='Request Remote Wipe' variant='danger' onPress={flagWipe} fullWidth />
  <View style={{ height:8 }} />
  <PrimaryButton title='View Mood Entries (meta)' variant='secondary' onPress={()=> router.push(`/admin/user/${user.id}/moods`)} fullWidth />
  <View style={{ height:8 }} />
  <PrimaryButton title='Force Sign-Out' variant='secondary' onPress={forceSignOut} fullWidth />
  <View style={{ height:8 }} />
  <PrimaryButton title={exporting? 'Exporting...' : 'Export Moods (JSON)'} onPress={()=> exportUserMoods('json')} fullWidth />
  <View style={{ height:8 }} />
  <PrimaryButton title={exporting? 'Exporting...' : 'Export Moods (CSV)'} onPress={()=> exportUserMoods('csv')} fullWidth variant='secondary' />
    </View>
  );
}
const styles = StyleSheet.create({
  h1:{ fontSize:20, fontWeight:'800' },
  row:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', marginVertical:8 },
  label:{ fontSize:14, fontWeight:'700' }
});
