import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

/**
 * IconBadge - Icon with optional badge/notification indicator
 * @param {String} name - Ionicons name
 * @param {Number} size - Icon size
 * @param {String} color - Icon color
 * @param {Boolean} showBadge - Show notification badge
 * @param {Number} badgeCount - Badge number (optional)
 * @param {String} badgeColor - Badge background color
 * @param {Array} gradientColors - Gradient for icon background
 * @param {Object} style - Additional styles
 */
export default function IconBadge({
  name,
  size = 24,
  color = '#fff',
  showBadge = false,
  badgeCount,
  badgeColor = '#EF5350',
  gradientColors,
  style,
}) {
  const iconContent = (
    <View style={[styles.iconContainer, style]}>
      <Ionicons name={name} size={size} color={color} />
      {showBadge && (
        <View style={[styles.badge, { backgroundColor: badgeColor }]}>
          {badgeCount !== undefined && badgeCount > 0 && (
            <Text style={styles.badgeText}>
              {badgeCount > 99 ? '99+' : badgeCount}
            </Text>
          )}
        </View>
      )}
    </View>
  );

  if (gradientColors) {
    return (
      <LinearGradient
        colors={gradientColors}
        style={[styles.gradientContainer, style]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {iconContent}
      </LinearGradient>
    );
  }

  return iconContent;
}

const styles = StyleSheet.create({
  iconContainer: {
    position: 'relative',
  },
  gradientContainer: {
    borderRadius: 12,
    padding: 8,
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -6,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#EF5350',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#fff',
  },
  badgeText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
});
