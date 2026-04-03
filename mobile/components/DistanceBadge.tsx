import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

function formatDistance(m) {
  if (m == null || Number.isNaN(m)) return '-';
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

export function DistanceBadge({ meters, distanceM, style, testID, accessibilityLabel, size = 'sm' }) {
  const t = useTheme();
  const value = typeof meters === 'number' ? meters : distanceM;
  const label = useMemo(() => formatDistance(value), [value]);

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: t.mode === 'dark' ? 'rgba(31,111,235,0.24)' : 'rgba(31,111,235,0.12)',
          borderColor: t.mode === 'dark' ? 'rgba(31,111,235,0.4)' : 'rgba(31,111,235,0.24)',
          paddingHorizontal: size === 'md' ? 10 : 8,
          paddingVertical: size === 'md' ? 5 : 3,
        },
        style,
      ]}
      testID={testID}
      accessibilityRole="text"
      accessibilityLabel={accessibilityLabel ?? `Entfernung ${label}`}
    >
      <Text style={[styles.text, { color: t.colors.primary, fontSize: size === 'md' ? 13 : 12 }]} allowFontScaling>
        {label}
      </Text>
    </View>
  );
}

export default DistanceBadge;

const styles = StyleSheet.create({
  base: {
    borderRadius: 999,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: {
    fontWeight: '700',
  },
});