// components/SkeletonCard.tsx
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, ViewStyle, useColorScheme, AccessibilityRole } from 'react-native';

type Props = {
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
  testID?: string;
  accessibilityLabel?: string;
};

/**
 * Einfache Skeleton-Karte mit sanftem Opacity-Puls.
 * - Nutzt System-Dark/Light (kein eigener Theme-Provider nötig).
 * - Standardhöhe passend für Listenzeilen.
 */
export const SkeletonCard: React.FC<Props> = ({
  height = 88,
  borderRadius = 14,
  style,
  testID,
  accessibilityLabel = 'Laden …',
}) => {
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  const opacity = useRef(new Animated.Value(0.6)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.6, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => {
      loop.stop();
      opacity.stopAnimation();
    };
  }, [opacity]);

  return (
    <Animated.View
      testID={testID}
      accessibilityRole={'progressbar' as AccessibilityRole}
      accessibilityLabel={accessibilityLabel}
      style={[
        styles.base,
        {
          height,
          borderRadius,
          backgroundColor: isDark ? '#202a36' : '#e9eef5',
          opacity,
        },
        style,
      ]}
    />
  );
};

const styles = StyleSheet.create({
  base: {
    width: '100%',
  },
});
