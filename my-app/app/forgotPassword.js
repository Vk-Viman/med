import React, { useState } from 'react';
import { View, Text, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../firebase/firebaseConfig';
import { sendPasswordResetEmail } from 'firebase/auth';
import PrimaryButton from '../src/components/PrimaryButton';
import { colors, spacing } from '../src/theme';
import { useRouter } from 'expo-router';
import { TextInput } from 'react-native';

export default function ForgotPasswordScreen(){
  const router = useRouter();
  const [email,setEmail] = useState('');
  const [sending,setSending] = useState(false);

  const submit = async () => {
    if(!email){ Alert.alert('Reset','Enter email.'); return; }
    try { setSending(true); await sendPasswordResetEmail(auth, email.trim()); Alert.alert('Email Sent','Check your inbox for reset instructions.'); }
    catch(e){ Alert.alert('Error', e.message); }
    finally { setSending(false); }
  };

  return (
    <SafeAreaView style={{ flex:1, backgroundColor: colors.bg, padding: spacing.lg }}>
      <Text style={{ fontSize:26, fontWeight:'800', color: colors.text, marginBottom: spacing.md }}>Forgot Password</Text>
      <Text style={{ fontSize:14, color: colors.text, opacity:0.8, marginBottom: spacing.md }}>Enter your account email to receive a password reset link.</Text>
      <Text style={{ fontSize:12, fontWeight:'600', color: colors.text, marginBottom:4 }}>Email</Text>
      <TextInput autoCapitalize='none' keyboardType='email-address' value={email} onChangeText={setEmail} placeholder='you@example.com' style={{ width:'100%', borderWidth:1, borderColor:'#90CAF9', borderRadius:12, paddingHorizontal:12, height:48, backgroundColor:'#ffffffCC', marginBottom: spacing.lg }} />
      <PrimaryButton title={sending? 'Sending...' : 'Send Reset Email'} onPress={submit} disabled={sending} fullWidth />
      <View style={{ height: spacing.lg }} />
      <PrimaryButton title='Back to Login' variant='secondary' onPress={()=> router.replace('/login')} fullWidth />
    </SafeAreaView>
  );
}