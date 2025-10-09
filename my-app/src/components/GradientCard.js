import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';

/**
 * GradientCard - A beautiful card with gradient background
 * @param {Array} colors - Gradient colors ['#color1', '#color2']
 * @param {Object} style - Additional styles
 * @param {Node} children - Card content
 * @param {Object} gradientProps - Additional gradient props (start, end, locations)
 */
export default function GradientCard({ 
  colors = ['#4FC3F7', '#0288D1'], 
  style, 
  children,
  gradientProps = {}
}) {
  return (
    <LinearGradient
      colors={colors}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      {...gradientProps}
      style={[styles.card, style]}
    >
      {children}
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 4,
  },
});
