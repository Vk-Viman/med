import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { auth, db } from '../../firebase/firebaseConfig';
import { doc, getDoc } from 'firebase/firestore';
import { colors, spacing } from '../../src/theme';

export default function SessionDetail(){
  const { id } = useLocalSearchParams();
  const [data, setData] = useState(null);

  useEffect(() => {
    const load = async () => {
      const user = auth.currentUser;
      if (!user || !id) return;
      try {
        const ref = doc(db, 'users', user.uid, 'sessions', id);
        const snap = await getDoc(ref);
        if (snap.exists()) setData({ id, ...snap.data() });
      } catch {}
    };
    load();
  }, [id]);

  if (!data) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.header}>Session Details</Text>
        <Text style={styles.meta}>Loading…</Text>
      </SafeAreaView>
    );
  }

  const rows = [
    ['Title', data.title || 'Session'],
    ['Duration', `${data.durationSec||0}s`],
    ['Background Sound', data.backgroundSound || 'none'],
    ['Meditation ID', data.meditationId || '-'],
    ['Meditation URL', data.meditationUrl || '-'],
    ['Loop at Start', String(!!data.loopAtStart)],
    ['Ambient Vol at Start', data.bgVolumeAtStart!=null ? String(data.bgVolumeAtStart) : '-'],
    ['Device OS', data.deviceOS || '-'],
    ['OS Version', data.deviceOSVersion || '-'],
    ['App Version', data.appVersion || '-'],
    ['Ended At', data.endedAt?.toDate ? data.endedAt.toDate().toLocaleString() : '-'],
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <Text style={styles.header}>Session Details</Text>
        {rows.map(([k,v]) => (
          <View key={k} style={styles.row}>
            <Text style={styles.key}>{k}</Text>
            <Text style={styles.val}>{String(v)}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex:1, padding: spacing.lg },
  header: { fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: spacing.md },
  row: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#ECEFF1' },
  key: { fontWeight: '700', color: colors.text },
  val: { color: colors.mutedText || '#607D8B' },
});
