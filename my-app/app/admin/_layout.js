import React, { useEffect, useState } from 'react';
import { Stack, useRouter, useNavigation, usePathname } from 'expo-router';
import { View, ActivityIndicator, Alert, TouchableOpacity, Text, StyleSheet, Platform, BackHandler } from 'react-native';
import { getUserProfile, isAdminType } from '../../src/services/userProfile';
import { useTheme } from '../../src/theme/ThemeProvider';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as LocalAuthentication from 'expo-local-authentication';

export default function AdminLayout(){
  const router = useRouter();
  const { theme } = useTheme();
  const [checking, setChecking] = useState(true);
  const nav = useNavigation();
  const pathname = usePathname();
  

  useEffect(()=>{
    (async()=>{
      try {
        const prof = await getUserProfile();
        if(!isAdminType(prof?.userType)){
          Alert.alert('Access Denied','Admin access required.');
          router.replace('/(tabs)');
          return;
        }
        // Optional biometric gate for admin area if user enabled it
        try {
          const pref = await AsyncStorage.getItem('pref_biometric_enabled_v1');
          const enabled = pref === '1';
          if(enabled && Platform.OS !== 'web'){
            const hasHardware = await LocalAuthentication.hasHardwareAsync();
            const enrolled = await LocalAuthentication.isEnrolledAsync();
            if(hasHardware && enrolled){
              const res = await LocalAuthentication.authenticateAsync({ promptMessage: 'Unlock admin' });
              if(!res.success){
                Alert.alert('Locked','Biometric authentication canceled.');
                router.replace('/(tabs)');
                return;
              }
            }
          }
        } catch {}
      } catch {}
      setChecking(false);
    })();
  },[]);

  const BackBtn = () => {
    const handleBack = () => {
      try {
        // Always stay inside admin area; navigate to admin dashboard
        router.replace('/admin');
      } catch (e) {
        try { router.replace('/admin'); } catch {}
      }
    };
    return (
      <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
        <Text style={styles.backTxt}>{'<'} Back</Text>
      </TouchableOpacity>
    );
  };

  // On Android hardware back, keep admin users inside admin area
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      const p = pathname || '';
      if (p.startsWith('/admin') && p !== '/admin') {
        try { router.replace('/admin'); } catch {}
        return true; // handled
      }
      return false; // default behavior
    });
    return () => sub.remove();
  }, [pathname]);

  if(checking){
    return (
      <View style={{ flex:1, alignItems:'center', justifyContent:'center', backgroundColor: theme.bg }}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  const HeaderProfileBtn = () => (
    <TouchableOpacity style={{ paddingHorizontal:12, paddingVertical:6 }} onPress={()=> router.push('/admin/profile')}>
      <Text style={{ color:'#0288D1', fontWeight:'700' }}>Profile</Text>
    </TouchableOpacity>
  );

  return (
    <Stack screenOptions={{ headerLeft: () => <BackBtn />, headerRight: () => <HeaderProfileBtn /> }}>
      <Stack.Screen name="index" options={{ title: 'Admin Dashboard', headerLeft: () => null }} />
      <Stack.Screen name="settings" options={{ title: 'Admin Settings' }} />
      <Stack.Screen name="profile" options={{ title: 'Admin Profile' }} />
      <Stack.Screen name="users" options={{ title: 'Users' }} />
      <Stack.Screen name="user/[uid]" options={{ title: 'User Details' }} />
      <Stack.Screen name="meditations" options={{ title: 'Meditations' }} />
      <Stack.Screen name="plans" options={{ title: 'Plans' }} />
      <Stack.Screen name="community" options={{ title: 'Community' }} />
      <Stack.Screen name="privacy" options={{ title: 'Privacy Center' }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  backBtn:{ paddingHorizontal:12, paddingVertical:6 },
  backTxt:{ color:'#0288D1', fontSize:14, fontWeight:'700' }
});
