import React, { useEffect, useMemo, useRef } from 'react';
import { View, Animated } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

// Tiny, dependency-light sparkline. Expects an array of numbers (0..10). Null/undefined values are skipped.
export default function Sparkline({ data = [], color = '#0277BD', width = '100%', height = 36, strokeWidth = 2, fillOpacity = 0.12, animate = true, duration = 420 }){
  const nums = (data || []).map(v => (typeof v === 'number' ? v : null));
  const valid = nums.filter(v => v != null);
  if (valid.length < 2) return <View style={{ height }} />;

  const w = 120; // internal drawing width; SVG scales to fit wrapper via width="100%"
  const h = height;
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min || 1;

  const points = nums.map((v, i) => {
    if (v == null) return null;
    const x = (i / Math.max(nums.length - 1, 1)) * w;
    const y = h - ((v - min) / range) * (h - strokeWidth) - strokeWidth / 2;
    return { x, y };
  });

  // Build path skipping nulls
  let d = '';
  const seqPoints = [];
  points.forEach((pt) => {
    if (!pt) return;
    seqPoints.push(pt);
    if (!d) d = `M ${pt.x} ${pt.y}`;
    else d += ` L ${pt.x} ${pt.y}`;
  });

  // Build fill path (to bottom)
  let df = '';
  const first = points.find(Boolean);
  const last = [...points].reverse().find(Boolean);
  if (first && last) {
    df = `${d} L ${last.x} ${h} L ${first.x} ${h} Z`;
  }

  const gradientId = 'sparkGrad';

  // Approximate path length for dash animation
  const totalLen = useMemo(() => {
    let len = 0;
    for (let i = 1; i < seqPoints.length; i++) {
      const a = seqPoints[i - 1];
      const b = seqPoints[i];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      len += Math.sqrt(dx * dx + dy * dy);
    }
    // Guard in case of degenerates
    return Math.max(len, 1);
  }, [seqPoints.map(p => p ? `${p.x},${p.y}` : 'x').join('|')]);

  const dash = useRef(new Animated.Value(animate ? totalLen : 0)).current;

  useEffect(() => {
    if (!animate) return;
    dash.setValue(totalLen);
    const anim = Animated.timing(dash, { toValue: 0, duration, useNativeDriver: true });
    anim.start();
    return () => anim.stop();
  }, [totalLen, animate, duration, dash]);

  const AnimatedPath = useMemo(() => Animated.createAnimatedComponent(Path), []);

  return (
    <View style={{ width: '100%', height }}>
      <Svg width={width} height={height} viewBox={`0 0 ${w} ${h}`}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={color} stopOpacity={fillOpacity} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {!!df && (
          <Path d={df} fill={`url(#${gradientId})`} />
        )}
        <AnimatedPath
          d={d}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          // draw-in effect
          strokeDasharray={`${totalLen}, ${totalLen}`}
          strokeDashoffset={dash}
          // Accessibility
          accessibilityLabel={`Sparkline showing ${valid.length} data points`}
          accessibilityRole="image"
          accessible
        />
      </Svg>
    </View>
  );
}
