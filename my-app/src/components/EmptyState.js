import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * EmptyState - Beautiful empty state component
 * @param {String} icon - Ionicons name
 * @param {String} emoji - Alternative to icon
 * @param {String} title - Main message
 * @param {String} subtitle - Supporting message
 * @param {Node} action - Optional action button
 * @param {Object} style - Additional styles
 */
export default function EmptyState({ 
  icon, 
  emoji, 
  title, 
  subtitle, 
  action,
  style 
}) {
  return (
    <View style={[styles.container, style]}>
      {emoji ? (
        <Text style={styles.emoji}>{emoji}</Text>
      ) : icon ? (
        <View style={styles.iconContainer}>
          <Ionicons name={icon} size={64} color="#B0BEC5" />
        </View>
      ) : null}
      
      {title && <Text style={styles.title}>{title}</Text>}
      {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      {action && <View style={styles.action}>{action}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emoji: {
    fontSize: 72,
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#263238',
    textAlign: 'center',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  subtitle: {
    fontSize: 15,
    color: '#78909C',
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
  action: {
    marginTop: 24,
  },
});
