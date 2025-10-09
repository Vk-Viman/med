import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * ConfettiView - Celebration confetti animation
 * @param {Boolean} visible - Show/hide confetti
 * @param {Number} duration - Animation duration in ms
 * @param {Number} count - Number of confetti pieces
 * @param {Array} colors - Array of confetti colors
 * @param {Function} onComplete - Callback when animation completes
 */
export default function ConfettiView({
  visible = false,
  duration = 2500,
  count = 50,
  colors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'],
  onComplete,
}) {
  const confettiPieces = useRef([]);

  // Initialize confetti pieces
  useEffect(() => {
    confettiPieces.current = Array.from({ length: count }, () => ({
      x: new Animated.Value(Math.random() * SCREEN_WIDTH),
      y: new Animated.Value(-50),
      rotation: new Animated.Value(Math.random() * 360),
      scale: new Animated.Value(0.5 + Math.random() * 0.5),
      color: colors[Math.floor(Math.random() * colors.length)],
      delay: Math.random() * 300,
      xOffset: (Math.random() - 0.5) * 100,
    }));
  }, [count]);

  useEffect(() => {
    if (!visible) return;

    const animations = confettiPieces.current.map((piece) => {
      return Animated.parallel([
        // Fall down
        Animated.timing(piece.y, {
          toValue: SCREEN_HEIGHT + 100,
          duration: duration,
          delay: piece.delay,
          useNativeDriver: true,
        }),
        // Drift sideways
        Animated.timing(piece.x, {
          toValue: piece.x._value + piece.xOffset,
          duration: duration,
          delay: piece.delay,
          useNativeDriver: true,
        }),
        // Rotate
        Animated.timing(piece.rotation, {
          toValue: piece.rotation._value + 360 * 3,
          duration: duration,
          delay: piece.delay,
          useNativeDriver: true,
        }),
        // Scale pulse
        Animated.sequence([
          Animated.timing(piece.scale, {
            toValue: 1,
            duration: 200,
            delay: piece.delay,
            useNativeDriver: true,
          }),
          Animated.timing(piece.scale, {
            toValue: 0.3,
            duration: duration - 200,
            useNativeDriver: true,
          }),
        ]),
      ]);
    });

    Animated.parallel(animations).start(() => {
      // Reset all values
      confettiPieces.current.forEach((piece) => {
        piece.y.setValue(-50);
        piece.x.setValue(Math.random() * SCREEN_WIDTH);
        piece.rotation.setValue(Math.random() * 360);
        piece.scale.setValue(0.5 + Math.random() * 0.5);
      });
      onComplete?.();
    });
  }, [visible, duration]);

  if (!visible) return null;

  return (
    <View style={styles.container} pointerEvents="none">
      {confettiPieces.current.map((piece, index) => (
        <Animated.View
          key={index}
          style={[
            styles.confetti,
            {
              backgroundColor: piece.color,
              transform: [
                { translateX: piece.x },
                { translateY: piece.y },
                { rotate: piece.rotation.interpolate({
                    inputRange: [0, 360],
                    outputRange: ['0deg', '360deg'],
                  })
                },
                { scale: piece.scale },
              ],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
  },
  confetti: {
    position: 'absolute',
    width: 10,
    height: 10,
    borderRadius: 2,
  },
});
