import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView, Linking } from 'react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { listPrivacyRequests, markPrivacyRequestDone, deleteAllUserMoods, adminGenerateExportArtifact, eraseUserContent, adminSetProcessingRestriction, adminSetAnalyticsOptOut, anonymizeUserPosts, adminUpdatePrivacyRequest } from '../../src/services/admin';
import PrimaryButton from '../../src/components/PrimaryButton';

export default function PrivacyCenter(){
  const { theme } = useTheme();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = async()=>{ try { setItems(await listPrivacyRequests({ status:'open', limit:200 })); } catch{} setLoading(false); };
  useEffect(()=>{ load(); },[]);
  const complete = async (id)=>{ try { await markPrivacyRequestDone(id); await load(); } catch(e){ Alert.alert('Error', e.message||String(e)); } };
  const markInProgress = async (id)=>{ try { await adminUpdatePrivacyRequest(id, { status:'in_progress' }); await load(); } catch(e){ Alert.alert('Error', e.message||String(e)); } };
  const runDelete = async (uid, id)=>{
    try { const n = await deleteAllUserMoods(uid); Alert.alert('Delete Complete', `Deleted ${n} mood entries.`); await complete(id); }
    catch(e){ Alert.alert('Delete Failed', e.message); }
  };
  const runEraseAll = async (uid, id)=>{
    try {
      const res = await eraseUserContent(uid);
      Alert.alert('Erase Complete', `Moods ${res.moods}, Sessions ${res.sessions}, Favorites ${res.favorites}, Badges ${res.badges}.`);
      await complete(id);
    } catch(e){ Alert.alert('Erase Failed', e.message||String(e)); }
  };
  const toggleProcessing = async (uid, curr)=>{
    try { await adminSetProcessingRestriction(uid, !curr); await load(); } catch(e){ Alert.alert('Failed', e.message||String(e)); }
  };
  const toggleAnalytics = async (uid, curr)=>{
    try { await adminSetAnalyticsOptOut(uid, !curr); await load(); } catch(e){ Alert.alert('Failed', e.message||String(e)); }
  };
  const runAnonymize = async (uid)=>{
    try { const n = await anonymizeUserPosts(uid); Alert.alert('Anonymized', `Anonymized ${n} posts.`); await load(); } catch(e){ Alert.alert('Failed', e.message||String(e)); }
  };
  const empty = !loading && (!items || items.length===0);
  return (
    <ScrollView style={{ flex:1, backgroundColor: theme.bg }} contentContainerStyle={{ padding:12 }}>
      <Text style={{ color: theme.text, fontWeight:'800', fontSize:28, marginBottom:16, letterSpacing:0.3 }}>Privacy Request Center</Text>
      {loading && <Text style={{ color: theme.text, fontSize:15 }}>Loading...</Text>}
      {empty && <Text style={{ color: theme.textMuted, fontSize:15 }}>No open requests.</Text>}
      {!empty && items.map(item => (
        <View key={item.id} style={{ backgroundColor: theme.card, padding:18, borderRadius:16, marginBottom:14, shadowColor:'#000', shadowOpacity:0.08, shadowRadius:8, elevation:3, borderWidth:1, borderColor:'rgba(0,0,0,0.05)' }}>
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
              <View style={{ height:8 }} />
              <PrimaryButton title='Mark In-Progress' variant='secondary' onPress={()=> markInProgress(item.id)} />
            </View>
          ) : (
            <View>
              <PrimaryButton title='Delete All User Moods' variant='danger' onPress={()=> runDelete(item.uid, item.id)} />
              <View style={{ height:8 }} />
              <PrimaryButton title='Erase All User Content' variant='danger' onPress={()=> runEraseAll(item.uid, item.id)} />
            </View>
          )}
          <View style={{ height:8 }} />
          <View style={{ flexDirection:'row', gap:8, flexWrap:'wrap' }}>
            <PrimaryButton title='Restrict Processing' onPress={()=> adminSetProcessingRestriction(item.uid, true).then(load).catch(e=>Alert.alert('Failed', e.message||String(e)))} />
            <PrimaryButton title='Allow Processing' variant='secondary' onPress={()=> adminSetProcessingRestriction(item.uid, false).then(load).catch(e=>Alert.alert('Failed', e.message||String(e)))} />
            <PrimaryButton title='Opt-out Analytics' onPress={()=> adminSetAnalyticsOptOut(item.uid, true).then(load).catch(e=>Alert.alert('Failed', e.message||String(e)))} />
            <PrimaryButton title='Opt-in Analytics' variant='secondary' onPress={()=> adminSetAnalyticsOptOut(item.uid, false).then(load).catch(e=>Alert.alert('Failed', e.message||String(e)))} />
          </View>
          <View style={{ height:8 }} />
          <PrimaryButton title='Anonymize User Posts' variant='secondary' onPress={()=> runAnonymize(item.uid)} />
        </View>
      ))}
    </ScrollView>
  );
}
