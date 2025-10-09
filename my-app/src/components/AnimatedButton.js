import React, { useRef } from 'react';
import { TouchableOpacity, Animated, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * AnimatedButton - Button with scale animation and haptic feedback
 * @param {Function} onPress - Press handler
 * @param {Node} children - Button content
 * @param {Object} style - Additional styles
 * @param {Boolean} disabled - Disabled state
 * @param {String} hapticStyle - 'light' | 'medium' | 'heavy'
 */
export default function AnimatedButton({ 
  onPress, 
  children, 
  style, 
  disabled = false,
  hapticStyle = 'light'
}) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (disabled) return;
    
    // Haptic feedback
    const hapticMap = {
      light: Haptics.ImpactFeedbackStyle.Light,
      medium: Haptics.ImpactFeedbackStyle.Medium,
      heavy: Haptics.ImpactFeedbackStyle.Heavy,
    };
    
    try {
      Haptics.impactAsync(hapticMap[hapticStyle] || Haptics.ImpactFeedbackStyle.Light);
    } catch (e) {
      // Haptics not available
    }

    // Scale animation
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
      tension: 300,
      friction: 10,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      tension: 300,
      friction: 10,
    }).start();
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled}
      activeOpacity={0.9}
      style={[styles.container, disabled && styles.disabled]}
    >
      <Animated.View style={[style, { transform: [{ scale: scaleAnim }] }]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {},
  disabled: {
    opacity: 0.5,
  },
});
