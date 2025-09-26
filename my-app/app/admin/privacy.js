import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView, Linking } from 'react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { listPrivacyRequests, markPrivacyRequestDone, deleteAllUserMoods, adminGenerateExportArtifact } from '../../src/services/admin';
import PrimaryButton from '../../src/components/PrimaryButton';

export default function PrivacyCenter(){
  const { theme } = useTheme();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = async()=>{ try { setItems(await listPrivacyRequests({ status:'open', limit:200 })); } catch{} setLoading(false); };
  useEffect(()=>{ load(); },[]);
  const complete = async (id)=>{ try { await markPrivacyRequestDone(id); await load(); } catch(e){ Alert.alert('Error', e.message); } };
  const runDelete = async (uid, id)=>{
    try { const n = await deleteAllUserMoods(uid); Alert.alert('Delete Complete', `Deleted ${n} mood entries.`); await complete(id); }
    catch(e){ Alert.alert('Delete Failed', e.message); }
  };
  const empty = !loading && (!items || items.length===0);
  return (
    <ScrollView style={{ flex:1, backgroundColor: theme.bg }} contentContainerStyle={{ padding:12 }}>
      <Text style={{ color: theme.text, fontWeight:'800', fontSize:18, marginBottom:8 }}>Privacy Request Center</Text>
      {loading && <Text style={{ color: theme.text }}>Loading...</Text>}
      {empty && <Text style={{ color: theme.textMuted }}>No open requests.</Text>}
      {!empty && items.map(item => (
        <View key={item.id} style={{ backgroundColor: theme.card, padding:12, borderRadius:12, marginBottom:8 }}>
          <Text style={{ color: theme.text, fontWeight:'700' }}>{(item.type||'').toUpperCase()} request</Text>
          <Text style={{ color: theme.textMuted, fontSize:12 }}>User: {item.uid}</Text>
          {!!item.fileUrl && (
            <Text style={{ color: '#0288D1', fontSize:12 }} onPress={()=> Linking.openURL(item.fileUrl)}>
              Open export file
            </Text>
          )}
          <View style={{ height:8 }} />
          {item.type === 'export' ? (
            <View>
              <PrimaryButton title='Generate Export Artifact' onPress={async()=>{ try { const r = await adminGenerateExportArtifact(item.uid, item.id); Alert.alert('Export Ready', 'File uploaded. Link saved in request.'); await load(); } catch(e){ Alert.alert('Export Failed', e.message); } }} />
              <View style={{ height:8 }} />
              <PrimaryButton title='Mark Completed' variant='secondary' onPress={()=> complete(item.id)} />
            </View>
          ) : (
            <PrimaryButton title='Delete All User Moods' variant='danger' onPress={()=> runDelete(item.uid, item.id)} />
          )}
        </View>
      ))}
    </ScrollView>
  );
}
