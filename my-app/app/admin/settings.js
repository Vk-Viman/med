import React, { useEffect, useState } from 'react';
import { View, Text, Switch, StyleSheet, Alert } from 'react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import PrimaryButton from '../../src/components/PrimaryButton';
import { getAdminConfig, setAdminConfigPatch, subscribeAdminConfig } from '../../src/services/config';

export default function AdminSettings(){
  const { theme } = useTheme();
  const [cfg, setCfg] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(()=>{
    let unsub;
    (async()=>{
      const c = await getAdminConfig(); setCfg(c);
      unsub = subscribeAdminConfig(setCfg);
    })();
    return ()=>{ try{ unsub && unsub(); }catch{} };
  },[]);
  if(!cfg){
    return <View style={{ flex:1, alignItems:'center', justifyContent:'center', backgroundColor: theme.bg }}><Text style={{ color: theme.text }}>Loading...</Text></View>;
  }
  const toggle = (key) => async (val) => {
    if(saving) return; setSaving(true);
    try { await setAdminConfigPatch({ [key]: val }); }
    catch(e){ Alert.alert('Save Failed', e.message); }
    finally{ setSaving(false); }
  };
  const Row = ({ label, value, onValueChange }) => (
    <View style={styles.row}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      <Switch value={value} onValueChange={onValueChange} />
    </View>
  );
  return (
    <View style={{ flex:1, backgroundColor: theme.bg, padding:16 }}>
      <Text style={[styles.h1, { color: theme.text }]}>Admin Settings</Text>
      <Text style={{ color: theme.textMuted, marginBottom:12 }}>Enable/disable modules and advanced tools visible to users.</Text>
      <Row label='Allow Exports' value={cfg.allowExports} onValueChange={toggle('allowExports')} />
      <Row label='Allow Retention (Auto-purge)' value={cfg.allowRetention} onValueChange={toggle('allowRetention')} />
      <Row label='Allow Backfill Tools' value={cfg.allowBackfillTools} onValueChange={toggle('allowBackfillTools')} />
      <Row label='Allow Meditations' value={cfg.allowMeditations} onValueChange={toggle('allowMeditations')} />
      <Row label='Allow Plans' value={cfg.allowPlans} onValueChange={toggle('allowPlans')} />
      <Row label='Allow Community' value={cfg.allowCommunity} onValueChange={toggle('allowCommunity')} />
      <View style={{ height:16 }} />
      <PrimaryButton title={saving? 'Saving...' : 'Save'} disabled fullWidth />
    </View>
  );
}
const styles = StyleSheet.create({
  h1:{ fontSize:20, fontWeight:'800' },
  row:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingVertical:10 },
  label:{ fontSize:14, fontWeight:'700' }
});
