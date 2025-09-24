import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, FlatList, TextInput, Button, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { db, auth } from "../../firebase/firebaseConfig";
import { collection, doc, addDoc, getDoc, getDocs, setDoc, query, where, orderBy, serverTimestamp, updateDoc, increment } from "firebase/firestore";
import { ensurePostIsSafe } from "../../src/moderation";
import { updateUserStats, evaluateAndAwardBadges, awardFirstPostIfNeeded } from "../../src/badges";

export default function CommunityScreen() {
  const [challenges, setChallenges] = useState([]);
  const [badges, setBadges] = useState([]);
  const [posts, setPosts] = useState([]);
  const [message, setMessage] = useState("");
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    const load = async () => {
      // Load active challenges
      const chSnap = await getDocs(collection(db, "challenges"));
      setChallenges(chSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      // Load user badges
      if (auth.currentUser) {
        const bSnap = await getDocs(collection(db, "users", auth.currentUser.uid, "badges"));
        setBadges(bSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
      // Load recent posts
      const pSnap = await getDocs(query(collection(db, "posts"), orderBy("createdAt", "desc")));
      setPosts(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      // Naive leaderboard: sum minutes across all participants in the first challenge
      if (!chSnap.empty) {
        const first = chSnap.docs[0].id;
        const parSnap = await getDocs(collection(db, "challenges", first, "participants"));
        const rows = parSnap.docs.map(d => ({ uid: d.id, minutes: d.data()?.minutes || 0 }));
        rows.sort((a,b) => b.minutes - a.minutes);
        setLeaderboard(rows.slice(0,5));
      }
    };
    load();
  }, []);

  const seedSampleData = async () => {
    try {
      // Create a couple of challenges if none exist
      const chSnap = await getDocs(collection(db, "challenges"));
      if (chSnap.empty) {
        await addDoc(collection(db, "challenges"), {
          title: "Weekly Calm Challenge",
          description: "Meditate 10 minutes daily for 7 days.",
          period: "weekly",
          createdAt: serverTimestamp(),
        });
        await addDoc(collection(db, "challenges"), {
          title: "Monthly Mindfulness Marathon",
          description: "Accumulate 300 minutes this month.",
          period: "monthly",
          createdAt: serverTimestamp(),
        });
      }
      // Give current user a starter badge
      if (auth.currentUser) {
        await setDoc(doc(db, "users", auth.currentUser.uid, "badges", "starter"), {
          name: "Getting Started",
          awardedAt: serverTimestamp(),
        }, { merge: true });
      }
      Alert.alert("Seeded", "Sample challenges and starter badge are set.");
      // Reload
      const refetchCh = await getDocs(collection(db, "challenges"));
      setChallenges(refetchCh.docs.map(d => ({ id: d.id, ...d.data() })));
      if (auth.currentUser) {
        const bSnap = await getDocs(collection(db, "users", auth.currentUser.uid, "badges"));
        setBadges(bSnap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    } catch (e) {
      Alert.alert("Error", e.message);
    }
  };

  const joinChallenge = async (challengeId) => {
    if (!auth.currentUser) return Alert.alert("Login required", "Please sign in to join challenges.");
    const ref = doc(db, "challenges", challengeId, "participants", auth.currentUser.uid);
    await setDoc(ref, { minutes: 0, joinedAt: serverTimestamp() }, { merge: true });
    Alert.alert("Joined", "You joined the challenge!");
  };

  const addMeditationMinutes = async (challengeId, mins=10) => {
    if (!auth.currentUser) return;
    const ref = doc(db, "challenges", challengeId, "participants", auth.currentUser.uid);
    await setDoc(ref, { minutes: increment(mins) }, { merge: true });
    Alert.alert("Progress", `Added ${mins} minutes.`);

  // Update user aggregate stats and award badges
  await updateUserStats(auth.currentUser.uid, { minutesDelta: mins });
  await evaluateAndAwardBadges(auth.currentUser.uid);
  };

  const submitPost = async () => {
    if (!message.trim()) return;
    const safe = await ensurePostIsSafe(message.trim());
    if (!safe.ok) {
      return Alert.alert("Blocked", safe.reason || "Your post seems inappropriate.");
    }
    await addDoc(collection(db, "posts"), {
      text: message.trim(),
      createdAt: serverTimestamp(),
      anonId: `anon_${Math.random().toString(36).slice(2,8)}`,
      flagged: safe.flagged || false,
    });
    setMessage("");
    if (auth.currentUser) {
      await awardFirstPostIfNeeded(auth.currentUser.uid);
    }
    const pSnap = await getDocs(query(collection(db, "posts"), orderBy("createdAt", "desc")));
    setPosts(pSnap.docs.map(d => ({ id: d.id, ...d.data() })));
  };

  return (
    <SafeAreaView style={styles.container}>
  <Text style={styles.title}>Community</Text>
  <Button title="Create sample data" onPress={seedSampleData} />
  <View style={{ height: 8 }} />

      <Text style={styles.section}>Group Challenges</Text>
      <FlatList
        data={challenges}
        keyExtractor={(item) => item.id}
        horizontal
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <Text style={styles.cardText}>{item.description}</Text>
            <Button title="Join" onPress={() => joinChallenge(item.id)} />
            <View style={{ height: 6 }} />
            <Button title="+10 min" onPress={() => addMeditationMinutes(item.id, 10)} />
          </View>
        )}
      />

      <Text style={styles.section}>Your Badges</Text>
      <FlatList
        data={badges}
        keyExtractor={(item) => item.id}
        horizontal
        renderItem={({ item }) => (
          <View style={styles.badge}><Text>🏅 {item.name}</Text></View>
        )}
      />

      <Text style={styles.section}>Leaderboard</Text>
      <FlatList
        data={leaderboard}
        keyExtractor={(item) => item.uid}
        horizontal
        renderItem={({ item, index }) => (
          <View style={styles.badge}><Text>{index+1}. {item.uid.slice(0,6)} • {item.minutes}m</Text></View>
        )}
      />

      <Text style={styles.section}>Anonymous Board</Text>
      <View style={styles.postRow}>
        <TextInput style={styles.input} value={message} onChangeText={setMessage} placeholder="Share your thoughts anonymously..." />
        <Button title="Post" onPress={submitPost} />
      </View>
      <FlatList
        data={posts}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.post}>
            <Text style={styles.anon}>{item.anonId || "anon"}</Text>
            <Text>{item.text}</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 24, fontWeight: "800", marginBottom: 8 },
  section: { marginTop: 12, fontWeight: "700" },
  card: { padding: 12, backgroundColor: "#fff", borderRadius: 12, marginRight: 10, width: 220 },
  cardTitle: { fontWeight: "700", marginBottom: 4 },
  cardText: { color: "#555", marginBottom: 8 },
  badge: { padding: 10, backgroundColor: "#E3F2FD", borderRadius: 20, marginRight: 8 },
  postRow: { flexDirection: "row", alignItems: "center", marginVertical: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: "#ddd", borderRadius: 8, padding: 8, marginRight: 8 },
  post: { backgroundColor: "#fff", padding: 10, borderRadius: 10, marginVertical: 6 },
  anon: { color: "#888", fontSize: 12, marginBottom: 4 }
});
