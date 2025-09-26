import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, Alert, Switch, Image, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../src/theme/ThemeProvider';
import PrimaryButton from '../../src/components/PrimaryButton';
import { auth } from '../../firebase/firebaseConfig';
import { signOut, sendEmailVerification } from 'firebase/auth';
import { getUserProfile, updateUserProfile, bumpSessionEpoch } from '../../src/services/userProfile';
import * as ImagePicker from 'expo-image-picker';

const BIOMETRIC_PREF_KEY = 'pref_biometric_enabled_v1';

export default function AdminProfile(){
  const { theme, mode, setThemeMode } = useTheme();
  const styles = useMemo(()=>createStyles(theme), [theme]);
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatarB64, setAvatarB64] = useState(null);
  const [biometricEnabled, setBiometricEnabled] = useState(true);
  const [emailVerified, setEmailVerified] = useState(true);
  const [analyticsOptOut, setAnalyticsOptOut] = useState(false);

  const [saving, setSaving] = useState(false);

  useEffect(()=>{ (async()=>{
    try {
      const prof = await getUserProfile();
      if(prof){
        setEmail(prof.email || auth.currentUser?.email || '');
        setDisplayName(prof.displayName || '');
        if(typeof prof.biometricEnabled === 'boolean') setBiometricEnabled(prof.biometricEnabled);
        if(prof.avatarB64) setAvatarB64(prof.avatarB64);
        if(typeof prof.analyticsOptOut === 'boolean') setAnalyticsOptOut(prof.analyticsOptOut);
        if(prof.themeMode==='dark'||prof.themeMode==='light'){ try{ setThemeMode(prof.themeMode); }catch{} }
      }
      setEmailVerified(!!auth.currentUser?.emailVerified);
      // Fallback to persisted flag if profile missing key
      if(typeof biometricEnabled !== 'boolean'){
        try{ const b = await AsyncStorage.getItem(BIOMETRIC_PREF_KEY); if(b!==null) setBiometricEnabled(b==='1'); }catch{}
      }
    } catch {}
  })(); },[]);

  const logout = async () => {
    try { await signOut(auth); router.replace('/login'); } catch(e){ Alert.alert('Error', e.message); }
  };

  const signOutAllDevices = async () => {
    try { await bumpSessionEpoch(); Alert.alert('Sessions','All devices will be signed out shortly.'); } catch(e){ Alert.alert('Error', e.message); }
  };

  const sendVerifyEmail = async () => {
    try {
      if(!auth.currentUser){ throw new Error('No authenticated user.'); }
      await sendEmailVerification(auth.currentUser);
      Alert.alert('Verification','Verification email sent.');
    } catch(e){ Alert.alert('Error', e.message); }
  };

  const toggleBiometric = async (val) => {
    setBiometricEnabled(val);
    try { await AsyncStorage.setItem(BIOMETRIC_PREF_KEY, val? '1':'0'); } catch {}
    try { await updateUserProfile({ biometricEnabled: val }); } catch {}
    Alert.alert('Biometrics', val? 'Biometric quick unlock enabled.' : 'Biometric quick unlock disabled.');
  };

  const saveProfile = async () => {
    if(saving) return;
    try {
      setSaving(true);
      await updateUserProfile({ displayName, analyticsOptOut });
      Alert.alert('Saved','Profile updated.');
    } catch(e){ Alert.alert('Error', e.message); }
    finally { setSaving(false); }
  };

  const pickAvatar = async () => {
    try {
      const res = await ImagePicker.launchImageLibraryAsync({ allowsEditing:true, aspect:[1,1], base64:true, quality:0.7 });
      if(res.canceled) return;
      const asset = res.assets?.[0];
      if(asset?.base64){
        setAvatarB64(asset.base64);
        await updateUserProfile({ avatarB64: asset.base64 });
      }
    } catch(e){ Alert.alert('Error', e.message); }
  };

  const toggleTheme = async () => {
    const next = mode === 'dark' ? 'light' : 'dark';
    try { setThemeMode(next); await updateUserProfile({ themeMode: next }); } catch {}
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        {avatarB64 ? (
          <Image source={{ uri: `data:image/png;base64,${avatarB64}` }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, { backgroundColor: theme.card }]} />
        )}
        <View style={{ flex:1 }}>
          <TextInput value={displayName} onChangeText={setDisplayName} placeholder='Display name' placeholderTextColor={theme.textMuted} style={[styles.nameInput, { color: theme.text, borderColor: theme.border }]} />
          <Text style={{ color: theme.textMuted, fontSize:12 }}>{email}</Text>
        </View>
      </View>

      <View style={{ flexDirection:'row', gap:8, marginBottom:12 }}>
        <PrimaryButton title="Change Avatar" onPress={pickAvatar} variant='secondary' />
        <PrimaryButton title={saving? 'Saving...' : 'Save'} onPress={saveProfile} disabled={saving} />
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: theme.text }]}>Biometric quick login</Text>
          <Switch value={!!biometricEnabled} onValueChange={toggleBiometric} />
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: theme.text }]}>Theme</Text>
          <PrimaryButton title={mode==='dark'? 'Dark' : 'Light'} onPress={toggleTheme} variant='secondary' />
        </View>
        <View style={styles.row}>
          <Text style={[styles.rowLabel, { color: theme.text }]}>Analytics Opt-out</Text>
          <Switch value={!!analyticsOptOut} onValueChange={(v)=> setAnalyticsOptOut(v)} />
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.row}> 
          <Text style={[styles.rowLabel, { color: theme.text }]}>Email</Text>
          <Text style={{ color: theme.textMuted }}>{emailVerified? 'Verified' : 'Not verified'}</Text>
        </View>
        {!emailVerified && <PrimaryButton title="Send verification email" onPress={sendVerifyEmail} variant='secondary' />}
      </View>

      <PrimaryButton title="Sign Out" onPress={logout} variant='secondary' fullWidth />
      <View style={{ height:8 }} />
      <PrimaryButton title="Sign Out All Devices" onPress={signOutAllDevices} variant='secondary' fullWidth />
      <View style={{ height:8 }} />
      <PrimaryButton title="Open Full Settings" onPress={()=> router.push('/settings')} fullWidth />
    </View>
  );
}

const createStyles = (theme) => StyleSheet.create({
  container:{ flex:1, backgroundColor: theme.bg, padding:16 },
  headerRow:{ flexDirection:'row', alignItems:'center', marginBottom:16, gap:12 },
  avatar:{ width:56, height:56, borderRadius:28 },
  name:{ fontSize:18, fontWeight:'800' },
  card:{ backgroundColor: theme.card, padding:12, borderRadius:12, marginBottom:12 },
  row:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingVertical:8 },
  rowLabel:{ fontSize:14, fontWeight:'700' },
});
