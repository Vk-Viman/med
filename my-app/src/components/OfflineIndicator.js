/**
 * OfflineIndicator Component
 * Shows a banner when the device is offline and displays mood queue status
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../utils/constants';

let NetInfo = null;

// Try to import NetInfo (optional dependency)
try {
  NetInfo = require('@react-native-community/netinfo').default;
} catch {
  // NetInfo not available
}

const OfflineIndicator = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [queueCount, setQueueCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0 });
  const slideAnim = useState(new Animated.Value(-60))[0];

  useEffect(() => {
    let unsubscribe = null;

    if (NetInfo) {
      // Subscribe to network state changes
      unsubscribe = NetInfo.addEventListener(state => {
        const online = state.isConnected && state.isInternetReachable !== false;
        setIsOnline(online);
      });

      // Check initial state
      NetInfo.fetch().then(state => {
        const online = state.isConnected && state.isInternetReachable !== false;
        setIsOnline(online);
      });
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, []);

  // Check offline queue count and sync status
  useEffect(() => {
    const checkQueue = async () => {
      try {
        const queueStr = await AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_MOOD_QUEUE);
        if (queueStr) {
          const queue = JSON.parse(queueStr);
          setQueueCount(Array.isArray(queue) ? queue.length : 0);
        } else {
          setQueueCount(0);
        }

        // Check sync status
        const syncStatus = await AsyncStorage.getItem('sync_status');
        if (syncStatus) {
          const status = JSON.parse(syncStatus);
          setIsSyncing(status.syncing || false);
          setSyncProgress({
            current: status.current || 0,
            total: status.total || 0
          });
        } else {
          setIsSyncing(false);
          setSyncProgress({ current: 0, total: 0 });
        }
      } catch {
        setQueueCount(0);
        setIsSyncing(false);
      }
    };

    if (!isOnline) {
      checkQueue();
      // Poll queue every 5 seconds when offline
      const interval = setInterval(checkQueue, 5000);
      return () => clearInterval(interval);
    } else {
      // When coming back online, check for pending sync
      checkQueue();
      const syncCheckInterval = setInterval(checkQueue, 2000);
      
      // Stop checking after 30 seconds
      setTimeout(() => {
        clearInterval(syncCheckInterval);
        setQueueCount(0);
        setIsSyncing(false);
      }, 30000);
      
      return () => clearInterval(syncCheckInterval);
    }
  }, [isOnline]);

  // Animate banner in/out
  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: !isOnline ? 0 : -60,
      useNativeDriver: true,
      tension: 50,
      friction: 8,
    }).start();
  }, [isOnline, slideAnim]);

  // Don't render on web (network detection less reliable)
  if (Platform.OS === 'web') {
    return null;
  }

  return (
    <Animated.View
      style={[
        styles.container,
        {
          transform: [{ translateY: slideAnim }],
        },
      ]}
      accessibilityLiveRegion="polite"
      accessibilityLabel={`You are offline${queueCount > 0 ? `. ${queueCount} mood entries queued` : ''}`}
    >
      <View style={styles.content}>
        <Ionicons 
          name={isSyncing ? "sync-outline" : "cloud-offline-outline"} 
          size={20} 
          color="#FFFFFF" 
        />
        <View style={styles.textContainer}>
          {isSyncing ? (
            <>
              <Text style={styles.title}>Syncing...</Text>
              {syncProgress.total > 0 && (
                <Text style={styles.subtitle}>
                  {syncProgress.current} of {syncProgress.total} {syncProgress.total === 1 ? 'entry' : 'entries'}
                </Text>
              )}
            </>
          ) : (
            <>
              <Text style={styles.title}>{isOnline ? 'Sync Complete' : "You're Offline"}</Text>
              {queueCount > 0 && (
                <Text style={styles.subtitle}>
                  {queueCount} {queueCount === 1 ? 'entry' : 'entries'} queued
                </Text>
              )}
            </>
          )}
        </View>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
    backgroundColor: '#F59E0B',
    paddingTop: Platform.OS === 'ios' ? 50 : 10,
    paddingBottom: 10,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 8,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textContainer: {
    marginLeft: 12,
    flex: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  subtitle: {
    color: '#FFFFFF',
    fontSize: 12,
    opacity: 0.9,
    marginTop: 2,
  },
});

export default OfflineIndicator;
