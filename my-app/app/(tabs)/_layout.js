import React, { useEffect, useState } from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { collection, query, where, limit } from 'firebase/firestore';
import { safeSnapshot } from '../../src/utils/safeSnapshot';
import { db, auth } from "../../firebase/firebaseConfig";

export default function TabsLayout() {
  const [unread, setUnread] = useState(0);
  useEffect(()=>{
    const uid = auth.currentUser?.uid;
    if(!uid) return; // we could also listen for auth changes; simplified for now
    try {
      const qref = query(collection(db,'users',uid,'inbox'), where('read','==', false), limit(25));
      const unsub = safeSnapshot(qref, async snap=>{ 
        const count = snap.docs.length; 
        setUnread(count); 
        // Attempt to set native app badge count (supported platforms only)
        try { const Notifications = await import('expo-notifications'); await Notifications.setBadgeCountAsync(count); } catch {}
      });
      return ()=> { try { unsub(); } catch {} };
    } catch {}
  }, [auth.currentUser?.uid]);
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="community"
        options={{
          title: "Community",
          tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: "Notifications",
          tabBarBadge: unread>0 ? (unread>9? '9+': String(unread)) : undefined,
          tabBarIcon: ({ color, size }) => <Ionicons name={unread>0? "notifications" : "notifications-outline"} color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
