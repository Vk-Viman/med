import React, { useEffect, useMemo, useRef, useState } from "react";
import { View, Text, TouchableOpacity, StyleSheet, Animated, TextInput, ScrollView } from "react-native";
import * as FileSystem from 'expo-file-system/legacy';
import { addDownloadListener } from '../utils/downloadEvents';
import AsyncStorage from "@react-native-async-storage/async-storage";
import { auth } from "../../firebase/firebaseConfig";
import { listMeditations as listMedsSvc, subscribeMeditations } from "../services/meditations";

// Dynamic list from Firestore (admin-managed)
// Shape: { id, title, category, url, duration?, bgSound?, createdAt? }

function Item({ med, selected, onPress, onToggleFavorite, isFav, isOffline }) {
  const scale = useRef(new Animated.Value(1)).current;
  const pressIn = () => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true, speed: 30 }).start();
  const pressOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30 }).start();
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[styles.item, selected && styles.selected]}
        onPress={onPress}
        onPressIn={pressIn}
        onPressOut={pressOut}
        accessibilityRole="button"
        accessibilityLabel={`Meditation ${med.title}${selected ? ', selected' : ''}`}
      >
        <View style={styles.itemRow}>
          <View>
            <Text style={styles.text}>{med.title}</Text>
            <Text style={styles.category}>{med.category}</Text>
            {isOffline && (
              <View style={styles.offlineBadge} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
                <Text style={styles.offlineBadgeText}>Offline</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            onPress={onToggleFavorite}
            accessibilityRole="button"
            accessibilityLabel={isFav ? "Remove from favorites" : "Add to favorites"}
          >
            <Text style={[styles.fav, isFav && styles.favActive]}>{isFav ? "★" : "☆"}</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function MeditationList({ onSelect, selected }) {
  const uid = auth.currentUser?.uid || "local";
  const favKey = `@med:favorites:${uid}`;
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const [favorites, setFavorites] = useState([]);
  const [offlineMap, setOfflineMap] = useState({});
  const [medList, setMedList] = useState([]);

  const sanitize = (s)=> String(s||'med').replace(/[^a-zA-Z0-9_-]/g, '_');
  const pathFor = (m)=> `${(FileSystem.documentDirectory||'')}meditations/${sanitize(m.id || m.docId || m.url || 'med')}.mp3`;

  // probe which items are available offline
  const refreshOffline = async ()=>{
    try{
      const dir = `${FileSystem.documentDirectory||''}meditations`;
      try{ const info = await FileSystem.getInfoAsync(dir); if(!info.exists) { setOfflineMap({}); return; } } catch { setOfflineMap({}); return; }
      const entries = await Promise.all(medList.map(async m => {
        const p = pathFor(m);
        try{ const info = await FileSystem.getInfoAsync(p); return [m.id, !!info.exists && (info.size??0)>0]; } catch { return [m.id, false]; }
      }));
      const map = Object.fromEntries(entries);
      setOfflineMap(map);
    }catch{ setOfflineMap({}); }
  };

  useEffect(()=>{ refreshOffline(); const unsub = addDownloadListener(()=> refreshOffline()); return ()=> { try{unsub();}catch{} }; },[medList]);

  // Load and subscribe to admin-managed meditations so user list reflects changes
  useEffect(()=>{
    let unsub = null;
    (async ()=>{
      try { setMedList(await listMedsSvc({ limit: 200 })); } catch {}
      try { unsub = subscribeMeditations(setMedList, { limit: 200 }); } catch {}
    })();
    return ()=> { try { unsub && unsub(); } catch {} };
  },[]);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(favKey);
        if (raw) setFavorites(JSON.parse(raw));
      } catch {}
    })();
  }, [favKey]);

  const toggleFavorite = async (id) => {
    const next = favorites.includes(id)
      ? favorites.filter(x => x !== id)
      : [...favorites, id];
    setFavorites(next);
    try { await AsyncStorage.setItem(favKey, JSON.stringify(next)); } catch {}
  };

  const categories = useMemo(() => [
    "All",
    "Favorites",
    ...Array.from(new Set((medList||[]).map(m => m.category).filter(Boolean)))
  ], [medList]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return medList.filter(m => {
      const matchesCategory =
        category === "All"
          ? true
          : category === "Favorites"
          ? favorites.includes(m.id)
          : m.category === category;
      const matchesQuery = q.length === 0 || m.title.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [query, category, favorites, medList]);

  return (
    <View style={styles.wrapper}>
      <TextInput
        style={styles.search}
        placeholder="Search meditations..."
        value={query}
        onChangeText={setQuery}
        returnKeyType="search"
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categories}>
        {categories.map(cat => (
          <TouchableOpacity
            key={cat}
            style={[styles.chip, category === cat && styles.chipActive]}
            onPress={() => setCategory(cat)}
            accessibilityRole="button"
            accessibilityLabel={`Filter category ${cat}`}
          >
            <Text style={[styles.chipText, category === cat && styles.chipTextActive]}>{cat}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
      <View style={styles.list}>
        {filtered.map(med => (
          <Item
            key={med.id}
            med={med}
            selected={selected?.id === med.id}
            onPress={() => onSelect(med)}
            onToggleFavorite={() => toggleFavorite(med.id)}
            isFav={favorites.includes(med.id)}
            isOffline={!!offlineMap[med.id]}
          />
        ))}
        {filtered.length === 0 && (
          <Text style={styles.empty}>No meditations match your search.</Text>
        )}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  wrapper: { marginBottom: 20 },
  search: { backgroundColor: "#FFF", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 10, borderWidth: 1, borderColor: "#E0F2F1" },
  categories: { marginBottom: 10 },
  chip: { paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#E0F2F1", borderRadius: 16, marginRight: 8 },
  chipActive: { backgroundColor: "#80DEEA" },
  chipText: { color: "#006064", fontWeight: "600" },
  chipTextActive: { color: "#004D40" },
  list: { marginBottom: 8 },
  item: { padding: 12, backgroundColor: "#B3E5FC", marginBottom: 8, borderRadius: 8 },
  selected: { backgroundColor: "#81D4FA" },
  itemRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  text: { fontSize: 16, color: "#01579B", fontWeight: "700" },
  category: { fontSize: 12, color: "#004D40", opacity: 0.8, marginTop: 2 },
  fav: { fontSize: 20, color: "#006064" },
  favActive: { color: "#FFB300" },
  empty: { textAlign: "center", color: "#607D8B", marginTop: 8 }
});
