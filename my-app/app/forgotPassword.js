import React, { useState } from 'react';
import { View, Text, Alert, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth } from '../firebase/firebaseConfig';
import { sendPasswordResetEmail } from 'firebase/auth';
import PrimaryButton from '../src/components/PrimaryButton';
import { spacing } from '../src/theme';
import { useTheme } from '../src/theme/ThemeProvider';
import { useRouter } from 'expo-router';
import { TextInput } from 'react-native';
import ShimmerCard from '../src/components/ShimmerCard';
import PulseButton from '../src/components/PulseButton';

export default function ForgotPasswordScreen(){
  const { theme } = useTheme();
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
    <SafeAreaView style={{ flex:1, backgroundColor: theme.bg }}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView 
          contentContainerStyle={{ flexGrow: 1, padding: spacing.lg }} 
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <ShimmerCard colors={['#E3F2FD', '#BBDEFB', '#90CAF9']} shimmerSpeed={3000}>
            <Text style={{ fontSize:26, fontWeight:'800', color: theme.text, marginBottom: spacing.md }}>Forgot Password</Text>
            <Text style={{ fontSize:14, color: theme.text, opacity:0.8, marginBottom: spacing.md }}>Enter your account email to receive a password reset link.</Text>
          </ShimmerCard>
          <Text style={{ fontSize:12, fontWeight:'600', color: theme.text, marginBottom:4 }}>Email</Text>
          <TextInput autoCapitalize='none' keyboardType='email-address' value={email} onChangeText={setEmail} placeholder='you@example.com' placeholderTextColor={theme.textMuted} style={{ width:'100%', borderWidth:1, borderColor: theme.bg === '#0B1722' ? '#345' : '#90CAF9', borderRadius:12, paddingHorizontal:12, height:48, backgroundColor: theme.bg === '#0B1722' ? '#0F1E2C' : '#ffffffCC', marginBottom: spacing.lg, color: theme.text }} />
          <PulseButton enabled={!sending && email} pulseColor="rgba(2, 136, 209, 0.3)" haptic>
            <PrimaryButton title={sending? 'Sending...' : 'Send Reset Email'} onPress={submit} disabled={sending} fullWidth />
          </PulseButton>
          <View style={{ height: spacing.lg }} />
          <PrimaryButton title='Back to Login' variant='secondary' onPress={()=> router.replace('/login')} fullWidth />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}