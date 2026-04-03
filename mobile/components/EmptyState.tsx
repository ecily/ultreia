// components/EmptyState.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ViewStyle,
  GestureResponderEvent,
} from 'react-native';

type CTA = {
  label: string;
  onPress: (e: GestureResponderEvent) => void;
  testID?: string;
  accessibilityLabel?: string;
};

type Props = {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode | string; // z. B. "📍" oder eigenes JSX
  primaryCta?: CTA;
  secondaryCta?: CTA;
  style?: ViewStyle;
  testID?: string;
};

const BRAND_BLUE = '#0d4ea6';

const R = {
  s1: 4, s2: 8, s3: 12, s4: 16, s5: 20, s6: 24, s7: 32,
  radiusLg: 20,
};

export const EmptyState: React.FC<Props> = ({
  title,
  subtitle,
  icon,
  primaryCta,
  secondaryCta,
  style,
  testID,
}) => {
  return (
    <View
      style={[styles.wrap, style]}
      testID={testID}
      accessibilityRole="summary"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
    >
      {icon ? (
        typeof icon === 'string' ? (
          <Text style={styles.icon} accessibilityElementsHidden>
            {icon}
          </Text>
        ) : (
          <View style={{ marginBottom: R.s4 }}>{icon}</View>
        )
      ) : null}

      <Text style={styles.title} allowFontScaling numberOfLines={2}>
        {title}
      </Text>

      {subtitle ? (
        <Text style={styles.subtitle} allowFontScaling numberOfLines={3}>
          {subtitle}
        </Text>
      ) : null}

      <View style={styles.ctaRow}>
        {primaryCta ? (
          <Pressable
            onPress={primaryCta.onPress}
            android_ripple={{ color: '#ffffff30' }}
            accessibilityRole="button"
            accessibilityLabel={primaryCta.accessibilityLabel ?? primaryCta.label}
            testID={primaryCta.testID}
            style={({ pressed }) => [
              styles.primaryBtn,
              { opacity: pressed ? 0.92 : 1 },
            ]}
          >
            <Text style={styles.primaryTxt} allowFontScaling>
              {primaryCta.label}
            </Text>
          </Pressable>
        ) : null}

        {secondaryCta ? (
          <Pressable
            onPress={secondaryCta.onPress}
            android_ripple={{ color: '#00000010' }}
            accessibilityRole="button"
            accessibilityLabel={secondaryCta.accessibilityLabel ?? secondaryCta.label}
            testID={secondaryCta.testID}
            style={({ pressed }) => [
              styles.secondaryBtn,
              { opacity: pressed ? 0.92 : 1 },
            ]}
          >
            <Text style={styles.secondaryTxt} allowFontScaling>
              {secondaryCta.label}
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: R.s6,
    paddingVertical: R.s7,
  },
  icon: {
    fontSize: 42,
    marginBottom: R.s4,
  },
  title: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '600',
    color: '#0c1116',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: R.s2,
    fontSize: 14,
    lineHeight: 20,
    color: '#5b6b7a',
    textAlign: 'center',
  },
  ctaRow: {
    flexDirection: 'row',
    gap: R.s3,
    marginTop: R.s5,
  },
  primaryBtn: {
    backgroundColor: BRAND_BLUE,
    paddingHorizontal: R.s5,
    paddingVertical: R.s3,
    borderRadius: R.radiusLg,
  },
  primaryTxt: {
    color: '#fff',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: '#e5e9ef',
    backgroundColor: '#fff',
    paddingHorizontal: R.s5,
    paddingVertical: R.s3,
    borderRadius: R.radiusLg,
  },
  secondaryTxt: {
    color: '#0c1116',
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
  },
});
