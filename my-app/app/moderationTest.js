import React, { useMemo, useState } from 'react';
import { Platform, View, Text, TextInput, Pressable, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';

const PROJECT_ID = 'calmspace-4c73f';
const REGION = 'us-central1';

function defaultHostForPlatform() {
  // Choose a sensible default host for the Functions emulator by platform
  if (Platform.OS === 'android') return '10.0.2.2'; // Android Emulator -> host loopback
  // iOS simulator can reach host 127.0.0.1, physical devices need LAN/ngrok
  return '127.0.0.1';
}

export default function ModerationTestScreen() {
  const router = useRouter();
  const [text, setText] = useState('You are awful and I hate you');
  const [host, setHost] = useState(defaultHostForPlatform());
  const [port, setPort] = useState('5001');
  const [projectId, setProjectId] = useState(PROJECT_ID);
  const [region, setRegion] = useState(REGION);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const url = useMemo(() => {
    return `http://${host}:${port}/${projectId}/${region}/moderateText`;
  }, [host, port, projectId, region]);

  const isEmulatorHost = host === '127.0.0.1' || host === '10.0.2.2';

  async function onRun() {
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(isEmulatorHost ? { 'x-emulator-bypass': '1' } : {}),
        },
        body: JSON.stringify({ text }),
      });
      const data = await resp.json().catch(() => null);
      if (!resp.ok) {
        setError({ status: resp.status, data });
      } else {
        setResult(data);
      }
    } catch (e) {
      setError({ message: e?.message || String(e) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Text style={{ fontSize: 22, fontWeight: '600' }}>Moderation Tester</Text>
      <Text style={{ color: '#666' }}>
        This calls your Cloud Function moderation endpoint. For local emulator on Android Emulator use host 10.0.2.2; iOS Simulator use 127.0.0.1. Physical devices need adb reverse (Android USB) or an ngrok URL / deployed function.
      </Text>

      <Text style={{ fontWeight: '500' }}>Text</Text>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Enter text to moderate"
        style={{ borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 }}
        multiline
      />

      <Text style={{ fontWeight: '500' }}>Functions base</Text>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          value={host}
          onChangeText={setHost}
          placeholder="host"
          style={{ flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 }}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          value={port}
          onChangeText={setPort}
          placeholder="port"
          style={{ width: 90, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 }}
          keyboardType="number-pad"
        />
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          value={projectId}
          onChangeText={setProjectId}
          placeholder="project id"
          style={{ flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 }}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <TextInput
          value={region}
          onChangeText={setRegion}
          placeholder="region"
          style={{ width: 140, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 }}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <Pressable onPress={onRun} disabled={loading} style={{ backgroundColor: '#3b82f6', padding: 12, borderRadius: 8, alignItems: 'center' }}>
        <Text style={{ color: 'white', fontWeight: '600' }}>{loading ? 'Running…' : 'Run moderation'}</Text>
      </Pressable>

      <Text style={{ fontWeight: '500' }}>Endpoint</Text>
      <Text style={{ color: '#111' }}>{url}</Text>

      {result && (
        <View style={{ marginTop: 8 }}>
          <Text style={{ fontWeight: '500' }}>Result</Text>
          <Text selectable style={{ fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }), color: '#111' }}>
            {JSON.stringify(result, null, 2)}
          </Text>
        </View>
      )}
      {error && (
        <View style={{ marginTop: 8 }}>
          <Text style={{ fontWeight: '500', color: '#b91c1c' }}>Error</Text>
          <Text selectable style={{ fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }), color: '#b91c1c' }}>
            {JSON.stringify(error, null, 2)}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}
