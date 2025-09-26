import React, { useEffect, useState } from 'react';
import { Stack, useRouter, useNavigation, usePathname } from 'expo-router';
import { View, ActivityIndicator, Alert, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { getUserProfile, isAdminType } from '../../src/services/userProfile';
import { useTheme } from '../../src/theme/ThemeProvider';

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
      } catch {}
      setChecking(false);
    })();
  },[]);

  const BackBtn = () => {
    const handleBack = () => {
      try {
        if (nav?.canGoBack && nav.canGoBack()) {
          nav.goBack();
          return;
        }
        // If at admin root (no history), go to user tabs
        router.replace('/(tabs)');
      } catch (e) {
        try { router.replace('/(tabs)'); } catch {}
      }
    };
    return (
      <TouchableOpacity style={styles.backBtn} onPress={handleBack}>
        <Text style={styles.backTxt}>{'<'} Back</Text>
      </TouchableOpacity>
    );
  };

  if(checking){
    return (
      <View style={{ flex:1, alignItems:'center', justifyContent:'center', backgroundColor: theme.bg }}>
        <ActivityIndicator color={theme.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerLeft: () => <BackBtn /> }}>
      <Stack.Screen name="index" options={{ title: 'Admin Dashboard' }} />
      <Stack.Screen name="settings" options={{ title: 'Admin Settings' }} />
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
