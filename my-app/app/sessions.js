import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl, TouchableOpacity, Alert, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { auth, db } from '../firebase/firebaseConfig';
import { collection, onSnapshot, orderBy, query } from 'firebase/firestore';
import { colors, spacing } from '../src/theme';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { Ionicons } from '@expo/vector-icons';
import { selection } from '../src/utils/haptics';

function fmtTime(t) {
  if (!t || isNaN(t)) return '0m';
  const m = Math.floor(t / 60);
  const s = t % 60;
  return m > 0 ? `${m}m ${String(s).padStart(2, '0')}s` : `${s}s`;
}

export default function SessionsScreen() {
  const [items, setItems] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [bgFilter, setBgFilter] = useState('all');
  const [range, setRange] = useState({ days: 30 });
  const [initialLoading, setInitialLoading] = useState(true);
  const fade = React.useRef(new Animated.Value(0)).current;
  const router = useRouter();
  const params = useLocalSearchParams();

  // Initialize filters from query params (e.g., /sessions?days=7&bg=rain)
  const { days: qDays, bg: qBg } = params || {};
  useEffect(() => {
    // Parse days and update only if different
    try {
      if (qDays != null) {
        const d = parseInt(String(qDays), 10);
        if (Number.isFinite(d) && d > 0 && range?.days !== d) {
          setRange({ days: d });
        }
      }
    } catch {}
    // Parse bg and update only if different
    try {
      if (qBg != null) {
        const next = String(qBg).toLowerCase();
        if (next && next !== bgFilter) {
          setBgFilter(next);
        }
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qDays, qBg]);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const q = query(
      collection(db, 'users', user.uid, 'sessions'),
      orderBy('endedAt', 'desc')
    );
    const unsub = onSnapshot(q, (snap) => {
      const list = [];
      snap.forEach((d) => list.push({ id: d.id, ...d.data() }));
      setItems(list);
      if (initialLoading) {
        setInitialLoading(false);
        Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }).start();
      }
    });
    return () => unsub();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    setTimeout(() => setRefreshing(false), 400);
  };

  const filtered = useMemo(() => {
    const now = Date.now();
    const minTs = range?.days ? now - range.days * 24 * 60 * 60 * 1000 : 0;
    return items.filter((it) => {
      const endedAt = it.endedAt?.toDate ? it.endedAt.toDate().getTime() : 0;
      const within = endedAt >= minTs;
      const bgOk =
        bgFilter === 'all'
          ? true
          : String(it.backgroundSound || 'none').toLowerCase() === bgFilter;
      return within && bgOk;
    });
  }, [items, range, bgFilter]);

  const summary = useMemo(() => {
    const count = filtered.length;
    const totalSec = filtered.reduce((a, it) => a + (Number(it.durationSec) || 0), 0);
    const totalMin = Math.round((totalSec / 60) * 10) / 10;
    return { count, totalMin };
  }, [filtered]);

  const shareData = async (fmt = 'json') => {
    const user = auth.currentUser;
    const now = new Date();
    const stamp = now.toISOString().replace(/[:.]/g, '-');
    const filename = `sessions_${user?.uid || 'local'}_${stamp}.${fmt}`;
    const uri = `${FileSystem.cacheDirectory}${filename}`;

    const rows = filtered.map((it) => ({
      id: it.id,
      title: it.title || '',
      durationSec: it.durationSec || 0,
      backgroundSound: it.backgroundSound || '',
      meditationId: it.meditationId || '',
      meditationUrl: it.meditationUrl || '',
      endedAt: it.endedAt?.toDate ? it.endedAt.toDate().toISOString() : '',
      deviceOS: it.deviceOS || '',
      deviceOSVersion: it.deviceOSVersion || '',
      appVersion: it.appVersion || '',
    }));

    let content = '';
    let mimeType = 'application/json';
    if (fmt === 'csv') {
      mimeType = 'text/csv';
      const header = Object.keys(
        rows[0] || {
          id: '',
          title: '',
          durationSec: 0,
          backgroundSound: '',
          meditationId: '',
          meditationUrl: '',
          endedAt: '',
          deviceOS: '',
          deviceOSVersion: '',
          appVersion: '',
        }
      ).join(',');
      const body = rows
        .map((r) =>
          Object.values(r)
            .map((v) => (typeof v === 'string' ? '"' + v.replace(/"/g, '""') + '"' : String(v)))
            .join(',')
        )
        .join('\n');
      content = [header, body].join('\n');
    } else {
      content = JSON.stringify(
        { exportedAt: now.toISOString(), count: rows.length, sessions: rows },
        null,
        2
      );
    }

    // Write file with robust encoding fallback
    try {
      await FileSystem.writeAsStringAsync(uri, content);
    } catch (e1) {
      try {
        await FileSystem.writeAsStringAsync(uri, content, { encoding: 'utf8' });
      } catch (e2) {
        Alert.alert('Export failed', String(e2?.message || e2));
        throw e2;
      }
    }

    // Share or notify saved location
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType, dialogTitle: `Share ${filename}` });
      } else {
        Alert.alert('Export saved', `File saved to: ${uri}`);
      }
    } catch (e) {
      Alert.alert('Export failed', String(e?.message || e));
    }

    return uri;
  };

  const renderItem = ({ item }) => {
    const title = item.title || 'Session';
    const dur = fmtTime(item.durationSec || 0);
    const bg = item.backgroundSound ? String(item.backgroundSound).toUpperCase() : 'NONE';
    const when = item.endedAt?.toDate ? item.endedAt.toDate() : null;
    const dateStr = when ? when.toLocaleString() : '';

    return (
      <View style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.meta}>Duration: {dur}</Text>
          <Text style={styles.meta}>Background: {bg}</Text>
          {item.meditationId ? (
            <Text style={styles.meta}>ID: {item.meditationId}</Text>
          ) : null}
        </View>
        <View style={{ marginLeft: spacing.sm, alignItems: 'flex-end' }}>
          <Text style={styles.date}>{dateStr}</Text>
          <View style={{ flexDirection: 'row', marginTop: 6 }}>
            <TouchableOpacity
              style={styles.btn}
              onPress={() => router.push({ pathname: '/session/[id]', params: { id: item.id } })}
            >
              <Text style={styles.btnTxt}>Details</Text>
            </TouchableOpacity>
            {item.meditationUrl || item.meditationId ? (
              <TouchableOpacity
                style={[styles.btn, { marginLeft: 6 }]}
                onPress={() =>
                  router.push({
                    pathname: '/meditation',
                    params: item.meditationId
                      ? { replayId: item.meditationId }
                      : { replayUrl: item.meditationUrl, replayTitle: item.title || 'Session' },
                  })
                }
              >
                <Text style={styles.btnTxt}>Replay</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <Ionicons name="time-outline" size={22} color={colors.text} />
          <Text style={styles.header}>Session History</Text>
        </View>
        <View style={{ flexDirection: 'row' }}>
          <TouchableOpacity
            accessibilityLabel="Export sessions as JSON"
            style={[styles.btn, { marginRight: 6 }]}
            onPress={async () => {
              selection?.();
              await shareData('json');
            }}
          >
            <Text style={styles.btnTxt}>JSON</Text>
          </TouchableOpacity>
          <TouchableOpacity
            accessibilityLabel="Export sessions as CSV"
            style={styles.btn}
            onPress={async () => {
              selection?.();
              await shareData('csv');
            }}
          >
            <Text style={styles.btnTxt}>CSV</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.summaryRow}>
        <View style={styles.pill}>
          <Text style={styles.pillText}>Count: {summary.count}</Text>
        </View>
        <View style={styles.pill}>
          <Text style={styles.pillText}>Minutes: {summary.totalMin}</Text>
        </View>
      </View>

      <View style={styles.filters}>
        <View style={styles.filterChipRow}>
          {['all', 'none', 'rain', 'ocean'].map((v) => (
            <TouchableOpacity
              key={v}
              style={[styles.chip, bgFilter === v && styles.chipActive]}
              onPress={() => setBgFilter(v)}
            >
              <Text style={[styles.chipText, bgFilter === v && styles.chipTextActive]}>
                {v.toUpperCase()}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {initialLoading ? (
        <View>
          {[...Array(5)].map((_, i) => (
            <View key={i} style={styles.skelRow}>
              <View style={styles.skelTitle} />
              <View style={styles.skelMeta} />
            </View>
          ))}
        </View>
      ) : (
        <Animated.View style={{ opacity: fade }}>
          <FlatList
            data={filtered}
            keyExtractor={(it) => it.id}
            renderItem={renderItem}
            ItemSeparatorComponent={() => <View style={styles.sep} />}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListEmptyComponent={<Text style={styles.empty}>No sessions yet</Text>}
          />
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: spacing.lg },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  header: { fontSize: 22, fontWeight: '800', color: colors.text, marginLeft: 8 },
  row: { flexDirection: 'row', paddingVertical: spacing.sm, alignItems: 'center' },
  sep: { height: 1, backgroundColor: '#ECEFF1' },
  title: { fontWeight: '700', color: colors.text },
  meta: { color: colors.mutedText || '#607D8B', fontSize: 12 },
  date: { color: colors.mutedText || '#78909C', fontSize: 12, textAlign: 'right' },
  empty: { color: colors.mutedText || '#90A4AE' },
  skelRow: { paddingVertical: spacing.sm },
  skelTitle: { height: 16, backgroundColor: '#ECEFF1', borderRadius: 6, width: '50%', marginBottom: 6 },
  skelMeta: { height: 12, backgroundColor: '#ECEFF1', borderRadius: 6, width: '35%' },
  summaryRow: { flexDirection: 'row', gap: 8, marginBottom: spacing.md },
  pill: { backgroundColor: '#E0F2F1', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  pillText: { color: '#006064', fontWeight: '700', fontSize: 12 },
  filters: { marginBottom: spacing.md },
  filterChipRow: { flexDirection: 'row', marginBottom: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#E0F2F1',
    borderRadius: 14,
    marginRight: 6,
  },
  chipActive: { backgroundColor: '#80DEEA' },
  chipText: { color: '#006064', fontWeight: '700' },
  chipTextActive: { color: '#004D40' },
  btn: { backgroundColor: '#0288D1', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  btnTxt: { color: '#fff', fontWeight: '700', fontSize: 12 },
});
