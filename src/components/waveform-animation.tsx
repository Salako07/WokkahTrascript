import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';

const BAR_COUNT = 28;
const BAR_WIDTH = 3;
const MAX_HEIGHT = 44;
const MIN_HEIGHT = 3;

function WaveBar({ index, isActive }: { index: number; isActive: boolean }) {
  const heightAnim = useRef(new Animated.Value(MIN_HEIGHT)).current;
  const loopRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (isActive) {
      const runCycle = () => {
        const peak = MIN_HEIGHT + Math.random() * (MAX_HEIGHT - MIN_HEIGHT);
        const mid = MIN_HEIGHT + Math.random() * peak * 0.5;
        animRef.current = Animated.sequence([
          Animated.timing(heightAnim, {
            toValue: peak,
            duration: 250 + Math.random() * 200,
            useNativeDriver: false,
          }),
          Animated.timing(heightAnim, {
            toValue: mid,
            duration: 200 + Math.random() * 150,
            useNativeDriver: false,
          }),
          Animated.timing(heightAnim, {
            toValue: MIN_HEIGHT + Math.random() * 8,
            duration: 180,
            useNativeDriver: false,
          }),
        ]);
        animRef.current.start(({ finished }) => {
          if (finished) runCycle();
        });
      };

      loopRef.current = setTimeout(runCycle, index * 40);

      return () => {
        if (loopRef.current) clearTimeout(loopRef.current);
        if (animRef.current) animRef.current.stop();
      };
    } else {
      if (loopRef.current) clearTimeout(loopRef.current);
      if (animRef.current) animRef.current.stop();
      Animated.timing(heightAnim, {
        toValue: MIN_HEIGHT,
        duration: 400,
        useNativeDriver: false,
      }).start();
    }
  }, [isActive]);

  return (
    <Animated.View
      style={{
        height: heightAnim,
        width: BAR_WIDTH,
        backgroundColor: isActive ? '#818cf8' : '#3f3f46',
        borderRadius: 2,
      }}
    />
  );
}

export function WaveformAnimation({ isActive }: { isActive: boolean }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        height: MAX_HEIGHT + 4,
        width: '100%',
      }}>
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <WaveBar key={i} index={i} isActive={isActive} />
      ))}
    </View>
  );
}
