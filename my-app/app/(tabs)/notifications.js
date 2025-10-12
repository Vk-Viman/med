import React, { useEffect, useState, useCallback, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { View, Text, FlatList, RefreshControl, TouchableOpacity, ActivityIndicator, Button } from 'react-native';
import { useTheme } from '../../src/theme/ThemeProvider';
import { inboxList, inboxMarkRead, inboxMarkAllRead } from '../../src/services/inbox';
import { db, auth } from '../../firebase/firebaseConfig';
import { useRouter } from 'expo-router';
import { collection, query, orderBy, limit, startAfter } from 'firebase/firestore';
import { safeSnapshot } from '../../src/utils/safeSnapshot';
import ShimmerCard from '../../src/components/ShimmerCard';
import SkeletonLoader from '../../src/components/SkeletonLoader';
import { Ionicons } from '@expo/vector-icons';

export default function NotificationsScreen(){
  const { theme } = useTheme();
  const router = useRouter();
  const [liveItems, setLiveItems] = useState([]); // newest (realtime)
  const [olderItems, setOlderItems] = useState([]); // paged older
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [cursor, setCursor] = useState(null); // last fetched older doc snapshot
  const [hasMore, setHasMore] = useState(false);
  const pageSize = 20;
  const initialOlderLoaded = useRef(false);

  // Realtime top page listener
  useEffect(()=>{
    const uid = auth.currentUser?.uid; if(!uid) return;
    try {
      const qref = query(collection(db,'users',uid,'inbox'), orderBy('createdAt','desc'), limit(pageSize));
      const unsub = safeSnapshot(qref, snap=>{
        const docs = snap.docs.map(d=> ({ id:d.id, _snap:d, ...d.data() }));
        setLiveItems(docs);
        // If we don't have older loaded yet, set cursor to last doc for pagination start
        if(!initialOlderLoaded.current) {
          setCursor(snap.docs[snap.docs.length-1] || null);
        }
      });
      return ()=> { try { unsub(); } catch {} };
    } catch {}
  }, [auth.currentUser?.uid]);

  const mergeItems = useCallback(()=>{
    const map = new Map();
    [...liveItems, ...olderItems].forEach(it=>{ if(!map.has(it.id)) map.set(it.id, it); });
    const arr = Array.from(map.values());
    arr.sort((a,b)=>{
      const ar = !!a.read; const br = !!b.read;
      if(ar !== br) return ar?1:-1; // unread first
      const at = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
      const bt = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
      return bt - at;
    });
    return arr;
  },[liveItems, olderItems]);

  const loadOlder = useCallback(async ()=>{
    if(loading || !cursor) return;
    setLoading(true);
    try {
      const uid = auth.currentUser?.uid; if(!uid) return;
      const qref = query(collection(db,'users',uid,'inbox'), orderBy('createdAt','desc'), startAfter(cursor), limit(pageSize));
      const snap = await (await import('firebase/firestore')).getDocs(qref);
      const rows = snap.docs.map(d=> ({ id:d.id, _snap:d, ...d.data() }));
      setOlderItems(prev=> [...prev, ...rows]);
      setCursor(snap.docs[snap.docs.length-1] || null);
      setHasMore(rows.length === pageSize);
      initialOlderLoaded.current = true;
    } catch {} finally { setLoading(false); }
  },[cursor, loading]);

  // initial older fetch (after live items arrive)
  useEffect(()=>{
    if(liveItems.length && !initialOlderLoaded.current && !loading){
      // Attempt to fetch one more page beyond live to set hasMore
      loadOlder();
    }
  },[liveItems.length]);

  const onRefresh = useCallback(async ()=>{
    setRefreshing(true);
    // Force reload older from scratch
    setOlderItems([]); setCursor(null); initialOlderLoaded.current = false; setHasMore(false);
    // Triggering live listener will repopulate; after slight delay fetch older
    setTimeout(()=>{ loadOlder(); setRefreshing(false); }, 400);
  },[loadOlder]);

  const markOne = async (id)=>{
    await inboxMarkRead({ id });
    setLiveItems(prev=> prev.map(it=> it.id===id? { ...it, read:true } : it));
    setOlderItems(prev=> prev.map(it=> it.id===id? { ...it, read:true } : it));
  };
  const markAll = async ()=>{
    await inboxMarkAllRead();
    setLiveItems(prev=> prev.map(it=> ({ ...it, read:true })));
    setOlderItems(prev=> prev.map(it=> ({ ...it, read:true })));
  };

  const renderItem = ({ item }) => {
    const ts = item.createdAt?.toDate ? item.createdAt.toDate().toLocaleString() : '';
    const isImportant = item.type === 'badge' || item.type === 'achievement' || item.type === 'milestone';
    const icon = item.type === 'badge' ? 'trophy' : item.type === 'achievement' ? 'star' : item.type === 'milestone' ? 'flame' : 'notifications';
    
    if (isImportant && !item.read) {
      // Premium shimmer for unread important notifications
      return (
        <TouchableOpacity onPress={()=>{
          if(!item.read) markOne(item.id);
          const route = item?.data?.route; if(route){ try { router.push(route); } catch {} }
        }} style={{ marginBottom:12 }}>
          <ShimmerCard 
            colors={['#FFA726', '#FB8C00', '#F57C00']} 
            shimmerSpeed={2500}
            style={{ padding:16 }}
          >
            <View style={{ flexDirection:'row', alignItems:'center', marginBottom:8 }}>
              <Ionicons name={icon} size={24} color="#fff" style={{ marginRight:12 }} />
              <View style={{ flex:1 }}>
                <Text style={{ color: '#fff', fontWeight:'800', fontSize:16 }}>{item.title || item.type || 'Notification'}</Text>
                {!!ts && <Text style={{ color: '#FFE0B2', fontSize:11, marginTop:2 }}>{ts}</Text>}
              </View>
            </View>
            {!!item.body && <Text style={{ color: '#fff', opacity:0.95 }}>{item.body}</Text>}
            <Text style={{ marginTop:8, fontSize:11, color: '#FFE0B2', fontWeight:'600' }}>✨ Tap to view</Text>
          </ShimmerCard>
        </TouchableOpacity>
      );
    }
    
    // Regular notifications
    return (
      <TouchableOpacity onPress={()=>{
        if(!item.read) markOne(item.id);
        const route = item?.data?.route; if(route){ try { router.push(route); } catch {} }
      }} style={{ padding:12, backgroundColor: item.read ? (theme.bg === '#0B1722' ? '#13202c' : '#F5F9FC') : (theme.bg === '#0B1722' ? '#1b2b3b' : '#E3F2FD'), borderRadius:12, marginBottom:8 }}>
        <View style={{ flexDirection:'row', alignItems:'center' }}>
          <Ionicons name={icon} size={20} color={item.read ? theme.textMuted : theme.primary} style={{ marginRight:10 }} />
          <View style={{ flex:1 }}>
            <View style={{ flexDirection:'row', justifyContent:'space-between' }}>
              <Text style={{ color: theme.text, fontWeight:'700' }}>{item.title || item.type || 'Notification'}</Text>
              {!!ts && <Text style={{ color: theme.textMuted, fontSize:11 }}>{ts}</Text>}
            </View>
            {!!item.body && <Text style={{ color: theme.textMuted, marginTop:4 }}>{item.body}</Text>}
            {!item.read && <Text style={{ marginTop:6, fontSize:10, color: theme.primary || '#0288D1' }}>Tap to mark read</Text>}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={{ flex:1, backgroundColor: theme.bg, padding:16 }}>
      {/* Enhanced Header */}
      <View style={{ flexDirection:'row', alignItems:'center', marginBottom:16 }}>
        <View style={{ width:56, height:56, borderRadius:28, backgroundColor:'#E3F2FD', justifyContent:'center', alignItems:'center', marginRight:12 }}>
          <Ionicons name="notifications" size={28} color="#0288D1" />
        </View>
        <View style={{ flex:1 }}>
          <Text style={{ fontSize:24, fontWeight:'800', color: theme.text }}>Notifications</Text>
          <Text style={{ fontSize:13, color: theme.textMuted }}>Stay updated on your journey</Text>
        </View>
        <TouchableOpacity 
          onPress={markAll}
          style={{ paddingHorizontal:12, paddingVertical:6, backgroundColor:'#E3F2FD', borderRadius:16 }}
        >
          <Text style={{ fontSize:12, fontWeight:'700', color:'#0288D1' }}>Mark all</Text>
        </TouchableOpacity>
      </View>
      
      {loading && liveItems.length===0 && olderItems.length===0 ? (
        <View style={{ paddingVertical:16 }}>
          {[...Array(5)].map((_, i) => (
            <SkeletonLoader key={i} height={80} style={{ marginBottom:12 }} />
          ))}
        </View>
      ) : (
        <FlatList
          data={mergeItems()}
            keyExtractor={(item)=> item.id}
            renderItem={renderItem}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            ListEmptyComponent={()=>(
              <View style={{ padding:40, alignItems:'center' }}>
                <Text style={{ color: theme.textMuted }}>No notifications yet.</Text>
              </View>
            )}
            ListFooterComponent={() => (
              hasMore ? (
                <View style={{ paddingVertical:12 }}>
                  <TouchableOpacity onPress={loadOlder} disabled={loading} style={{ alignSelf:'center', paddingHorizontal:18, paddingVertical:8, borderRadius:24, backgroundColor: theme.bg === '#0B1722' ? '#1b2b3b' : '#E3F2FD' }}>
                    <Text style={{ color: theme.text, fontWeight:'600' }}>{loading? 'Loading…' : 'Load more'}</Text>
                  </TouchableOpacity>
                </View>
              ) : null
            )}
        />
      )}
    </SafeAreaView>
  );
}
