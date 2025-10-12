import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Alert, ScrollView, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/ThemeProvider';
import GradientCard from '../../src/components/GradientCard';
import { listPrivacyRequests, markPrivacyRequestDone, deleteAllUserMoods, adminGenerateExportArtifact, eraseUserContent, adminSetProcessingRestriction, adminSetAnalyticsOptOut, anonymizeUserPosts, adminUpdatePrivacyRequest } from '../../src/services/admin';
import PrimaryButton from '../../src/components/PrimaryButton';
import ShimmerCard from '../../src/components/ShimmerCard';

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
      <ShimmerCard colors={['#E8EAF6', '#C5CAE9', '#9FA8DA']} shimmerSpeed={3000}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(92, 107, 192, 0.2)' }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#E8EAF6', justifyContent: 'center', alignItems: 'center', shadowColor: '#5C6BC0', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 }}>
            <Ionicons name="lock-closed" size={28} color="#5C6BC0" />
          </View>
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Text style={{ fontSize: 24, fontWeight: '800', letterSpacing: 0.3, color: theme.text }}>Privacy Center</Text>
            <Text style={{ fontSize: 14, fontWeight: '500', marginTop: 4, color: theme.textMuted }}>GDPR & User Data Requests</Text>
          </View>
        </View>
      </ShimmerCard>
      {loading && <Text style={{ color: theme.text, fontSize:15 }}>Loading...</Text>}
      {empty && <Text style={{ color: theme.textMuted, fontSize:15 }}>No open requests.</Text>}
      {!empty && items.map(item => (
        <GradientCard key={item.id} colors={['#5C6BC0', '#3F51B5']} style={{ marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Ionicons name="document-text" size={20} color="#fff" />
            <Text style={{ color: '#fff', fontWeight:'800', fontSize: 16, marginLeft: 8 }}>{(item.type||'').toUpperCase()} Request</Text>
          </View>
          <Text style={{ color: '#fff', opacity: 0.9, fontSize:12 }}>User: {item.uid}</Text>
          {!!item.fileUrl && (
            <Text style={{ color: '#fff', fontSize:12, textDecorationLine: 'underline', marginTop: 4 }} onPress={()=> Linking.openURL(item.fileUrl)}>
              📎 Open export file
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
        </GradientCard>
      ))}
    </ScrollView>
  );
}
