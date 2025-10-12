import React, { useEffect, useState } from 'react';
import { View, Text, Switch, StyleSheet, Alert, TextInput, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../src/theme/ThemeProvider';
import PrimaryButton from '../../src/components/PrimaryButton';
import { getAdminConfig, setAdminConfigPatch, subscribeAdminConfig } from '../../src/services/config';
import ShimmerCard from '../../src/components/ShimmerCard';

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
    <ScrollView style={{ flex:1, backgroundColor: theme.bg }} contentContainerStyle={{ padding:16, paddingBottom:32 }} keyboardShouldPersistTaps='handled'>
      <ShimmerCard colors={['#CFD8DC', '#B0BEC5', '#90A4AE']} shimmerSpeed={3000}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(96, 125, 139, 0.2)' }}>
          <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: '#ECEFF1', justifyContent: 'center', alignItems: 'center', shadowColor: '#607D8B', shadowOpacity: 0.3, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 3 }}>
            <Ionicons name="settings" size={28} color="#607D8B" />
          </View>
          <View style={{ flex: 1, marginLeft: 16 }}>
            <Text style={{ fontSize: 24, fontWeight: '800', letterSpacing: 0.3, color: theme.text }}>App Settings</Text>
            <Text style={{ fontSize: 14, fontWeight: '500', marginTop: 4, color: theme.textMuted }}>Configure Modules & Permissions</Text>
          </View>
        </View>
      </ShimmerCard>
      <Text style={[styles.h1, { color: theme.text }]}>Module Toggles</Text>
      <Text style={{ color: theme.textMuted, marginBottom:12 }}>Enable/disable modules and advanced tools visible to users.</Text>
      <Row label='Allow Exports' value={cfg.allowExports} onValueChange={toggle('allowExports')} />
      <Row label='Allow Retention (Auto-purge)' value={cfg.allowRetention} onValueChange={toggle('allowRetention')} />
      <Row label='Allow Backfill Tools' value={cfg.allowBackfillTools} onValueChange={toggle('allowBackfillTools')} />
      <Row label='Allow Meditations' value={cfg.allowMeditations} onValueChange={toggle('allowMeditations')} />
      <Row label='Allow Plans' value={cfg.allowPlans} onValueChange={toggle('allowPlans')} />
      <Row label='Allow Community' value={cfg.allowCommunity} onValueChange={toggle('allowCommunity')} />
      <View style={{ height:16 }} />
      <Text style={[styles.h1, { color: theme.text }]}>Community Limits & Terms</Text>
      <View style={{ height:8 }} />
      <Text style={[styles.label, { color: theme.text }]}>Max Post/Reply Length</Text>
      <TextInput
        style={[styles.input, { borderColor: theme.card, color: theme.text, backgroundColor: theme.card }]}
        value={String(cfg.communityMaxLength || 300)}
        onChangeText={(v)=> setCfg(c=> ({ ...c, communityMaxLength: parseInt(v||'0',10)||0 }))}
        keyboardType='number-pad'
        placeholder='300'
        placeholderTextColor={theme.textMuted}
      />
      <View style={{ height:8 }} />
      <Row label='Allow Links in Posts' value={!!cfg.communityAllowLinks} onValueChange={toggle('communityAllowLinks')} />
      <View style={{ height:8 }} />
      <Text style={[styles.label, { color: theme.text }]}>Post Cooldown (ms)</Text>
      <TextInput
        style={[styles.input, { borderColor: theme.card, color: theme.text, backgroundColor: theme.card }]}
        value={String(cfg.postCooldownMs || 15000)}
        onChangeText={(v)=> setCfg(c=> ({ ...c, postCooldownMs: parseInt(v||'0',10)||0 }))}
        keyboardType='number-pad'
        placeholder='15000'
        placeholderTextColor={theme.textMuted}
      />
      <View style={{ height:8 }} />
      <Text style={[styles.label, { color: theme.text }]}>Reply Cooldown (ms)</Text>
      <TextInput
        style={[styles.input, { borderColor: theme.card, color: theme.text, backgroundColor: theme.card }]}
        value={String(cfg.replyCooldownMs || 10000)}
        onChangeText={(v)=> setCfg(c=> ({ ...c, replyCooldownMs: parseInt(v||'0',10)||0 }))}
        keyboardType='number-pad'
        placeholder='10000'
        placeholderTextColor={theme.textMuted}
      />
      <View style={{ height:8 }} />
      <Text style={[styles.label, { color: theme.text }]}>Guidelines Summary (shown in app)</Text>
      <TextInput
        style={[styles.textarea, { borderColor: theme.card, color: theme.text, backgroundColor: theme.card }]}
        value={cfg.termsShort || ''}
        onChangeText={(v)=> setCfg(c=> ({ ...c, termsShort: v }))}
        multiline
        numberOfLines={4}
        placeholder='Write a short, friendly summary of the rules users must accept.'
        placeholderTextColor={theme.textMuted}
      />
      <View style={{ height:8 }} />
      <Text style={[styles.label, { color: theme.text }]}>Categories (comma-separated)</Text>
      <TextInput
        style={[styles.input, { borderColor: theme.card, color: theme.text, backgroundColor: theme.card }]}
        value={(Array.isArray(cfg.termsCategories)? cfg.termsCategories.join(', ') : '')}
        onChangeText={(v)=> setCfg(c=> ({ ...c, termsCategories: v.split(',').map(s=> s.trim()).filter(Boolean) }))}
        placeholder='Respect, Safety, No spam, No links'
        placeholderTextColor={theme.textMuted}
      />
      <View style={{ height:8 }} />
      <Text style={[styles.label, { color: theme.text }]}>Full Terms URL</Text>
      <TextInput
        style={[styles.input, { borderColor: theme.card, color: theme.text, backgroundColor: theme.card }]}
        value={cfg.termsFullUrl || ''}
        onChangeText={(v)=> setCfg(c=> ({ ...c, termsFullUrl: v }))}
        placeholder='https://example.com/terms'
        placeholderTextColor={theme.textMuted}
        autoCapitalize='none'
        autoCorrect={false}
      />
      <View style={{ height:16 }} />
      <PrimaryButton
        title={saving? 'Saving...' : 'Save'}
        onPress={async ()=>{
          if(saving) return; setSaving(true);
          try{
            const patch = {
              communityMaxLength: Number(cfg.communityMaxLength)||300,
              communityAllowLinks: !!cfg.communityAllowLinks,
              postCooldownMs: Number(cfg.postCooldownMs)||15000,
              replyCooldownMs: Number(cfg.replyCooldownMs)||10000,
              termsShort: cfg.termsShort || '',
              termsCategories: Array.isArray(cfg.termsCategories)? cfg.termsCategories : [],
              termsFullUrl: cfg.termsFullUrl || '',
            };
            await setAdminConfigPatch(patch);
            Alert.alert('Saved','Community settings updated.');
          }catch(e){ Alert.alert('Save Failed', e.message||'Error'); }
          finally{ setSaving(false); }
        }}
        fullWidth
      />
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  h1:{ fontSize:24, fontWeight:'800', letterSpacing:0.3, marginBottom:6 },
  row:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingVertical:14, borderBottomWidth:1, borderBottomColor:'rgba(0,0,0,0.05)' },
  label:{ fontSize:15, fontWeight:'700', letterSpacing:0.2 },
  input:{ borderWidth:2, borderRadius:12, paddingHorizontal:14, paddingVertical:12, fontSize:15, shadowColor:'#000', shadowOpacity:0.04, shadowRadius:4, elevation:1 },
  textarea:{ borderWidth:2, borderRadius:12, paddingHorizontal:14, paddingVertical:12, minHeight:120, textAlignVertical:'top', fontSize:15, lineHeight:22, shadowColor:'#000', shadowOpacity:0.04, shadowRadius:4, elevation:1 }
});
