// components/offers/OfferListItem.tsx
import React, { useMemo } from 'react';
import {
  Pressable,
  View,
  Text,
  StyleSheet,
  ViewStyle,
  GestureResponderEvent,
} from 'react-native';

type Props = {
  title: string;
  providerName: string;
  distanceM: number;
  isNew?: boolean;
  meta?: string; // z. B. "heute bis 18:00"
  onPress?: (e: GestureResponderEvent) => void;
  style?: ViewStyle;
  testID?: string;
  accessibilityLabel?: string;
  /** Falls du später unseren DistanceBadge als separaten Wrapper nutzen willst */
  rightAccessory?: React.ReactNode;
};

const BRAND_BLUE = '#0d4ea6';

function formatDistance(m: number) {
  if (Number.isNaN(m) || m == null) return '—';
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

export const OfferListItem: React.FC<Props> = ({
  title,
  providerName,
  distanceM,
  isNew,
  meta,
  onPress,
  style,
  testID,
  accessibilityLabel,
  rightAccessory,
}) => {
  const distanceText = useMemo(() => formatDistance(distanceM), [distanceM]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        style,
        { opacity: pressed ? 0.92 : 1 },
      ]}
      android_ripple={{ color: '#00000010' }}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={
        accessibilityLabel ??
        `${title}, ${providerName}, Entfernung ${distanceText}${meta ? `, ${meta}` : ''}`
      }
    >
      <View style={styles.row}>
        {/* LEFT: Text-Bereich */}
        <View style={styles.left}>
          <Text style={styles.title} numberOfLines={1} allowFontScaling>
            {title}
          </Text>

          <Text
            style={styles.subline}
            numberOfLines={1}
            allowFontScaling
            accessibilityLabel={`${providerName}${meta ? ` – ${meta}` : ''}`}
          >
            {providerName}
            {meta ? ` · ${meta}` : ''}
          </Text>

          {isNew && (
            <View style={styles.newBadge} accessibilityLabel="Neu">
              <Text style={styles.newBadgeText} allowFontScaling>
                Neu
              </Text>
            </View>
          )}
        </View>

        {/* RIGHT: Distanz (oder Custom Accessory) */}
        <View style={styles.right}>
          {rightAccessory ? (
            rightAccessory
          ) : (
            <View style={styles.distBadge} accessibilityLabel={`Entfernung ${distanceText}`}>
              <Text style={styles.distText} allowFontScaling>
                {distanceText}
              </Text>
            </View>
          )}
        </View>
      </View>
    </Pressable>
  );
};

const R = {
  s1: 4, s2: 8, s3: 12, s4: 16, s5: 20, s6: 24,
  radiusSm: 10, radiusMd: 14,
};

const styles = StyleSheet.create({
  card: {
    borderRadius: R.radiusMd,
    borderWidth: 1,
    borderColor: '#e5e9ef',
    backgroundColor: '#fff',
    padding: R.s4,
    // großer Tap-Bereich, ohne bis ganz an den Rand zu gehen (Screen kümmert sich zusätzlich via SafeArea)
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: R.s4,
  },
  left: {
    flex: 1,
    minWidth: 0,
  },
  right: {
    marginLeft: R.s4,
    alignItems: 'flex-end',
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
    color: '#0c1116',
  },
  subline: {
    marginTop: 2,
    fontSize: 14,
    lineHeight: 18,
    color: '#5b6b7a',
  },
  newBadge: {
    alignSelf: 'flex-start',
    marginTop: R.s2,
    paddingHorizontal: R.s2,
    paddingVertical: 2,
    borderRadius: R.radiusSm,
    borderWidth: 1,
    borderColor: '#e5e9ef',
    backgroundColor: '#ffffff',
  },
  newBadgeText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
    color: '#5b6b7a',
  },
  distBadge: {
    backgroundColor: `${BRAND_BLUE}1A`, // ~10% Alpha
    paddingHorizontal: R.s2,
    paddingVertical: 2,
    borderRadius: R.radiusSm,
  },
  distText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: BRAND_BLUE,
  },
});
