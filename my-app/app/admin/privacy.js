import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { listPrivacyRequests, markPrivacyRequestDone, deleteAllUserMoods, listUserMoodDocs } from '../../src/services/admin';
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
  return (
    <View style={{ flex:1, backgroundColor: theme.bg, padding:12 }}>
      <Text style={{ color: theme.text, fontWeight:'800', fontSize:18, marginBottom:8 }}>Privacy Request Center</Text>
      {loading ? <Text style={{ color: theme.text }}>Loading...</Text> : (
        items.map(item => (
          <View key={item.id} style={{ backgroundColor: theme.card, padding:12, borderRadius:12, marginBottom:8 }}>
            <Text style={{ color: theme.text, fontWeight:'700' }}>{item.type.toUpperCase()} request</Text>
            <Text style={{ color: theme.textMuted, fontSize:12 }}>User: {item.uid}</Text>
            <View style={{ height:8 }} />
            {item.type === 'export' ? (
              <PrimaryButton title='Mark Completed' onPress={()=> complete(item.id)} />
            ) : (
              <PrimaryButton title='Delete All User Moods' variant='danger' onPress={()=> runDelete(item.uid, item.id)} />
            )}
          </View>
        ))
      )}
    </View>
  );
}
