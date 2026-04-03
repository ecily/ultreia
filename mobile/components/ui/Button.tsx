// stepsmatch/mobile/components/ui/Button.tsx
import React from 'react';
import { ActivityIndicator, GestureResponderEvent, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'lg' | 'md' | 'sm';

export interface ButtonProps {
  title: string;
  onPress?: (e: GestureResponderEvent) => void;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  testID?: string;
  accessibilityLabel?: string;
}

export default function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  style,
  leftIcon,
  rightIcon,
  testID,
  accessibilityLabel,
}: ButtonProps) {
  const t = useTheme();

  const { padV, padH, fontSize, lineHeight, radius } = sizeStyles(size, t);
  const { bg, fg, border, spinner } = variantColors(variant, t, disabled);

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      onPress={disabled || loading ? undefined : onPress}
      style={({ pressed }) => [
        {
          backgroundColor: bg,
          borderColor: border,
          borderWidth: variant === 'ghost' ? StyleSheet.hairlineWidth : 0,
          paddingVertical: padV,
          paddingHorizontal: padH,
          borderRadius: radius,
          opacity: disabled ? 0.6 : 1,
          transform: [{ scale: pressed && !disabled && !loading ? 0.98 : 1 }],
        },
        style,
      ]}
    >
      {({ pressed }) => (
        <>
          {loading ? (
            <ActivityIndicator size="small" color={spinner} />
          ) : (
            <Text
              style={{
                color: fg,
                fontSize,
                lineHeight,
                fontWeight: t.text.label.weight as any,
                textAlign: 'center',
              }}
              numberOfLines={1}
            >
              {title}
            </Text>
          )}
          {/* Optional icons (inline) */}
          {/* If you want icons: wrap text & icons in a row container */}
        </>
      )}
    </Pressable>
  );
}

function sizeStyles(size: Size, t: ReturnType<typeof useTheme>) {
  const map = {
    lg: { padV: 14, padH: 20, fontSize: 16, lineHeight: 22, radius: t.radius.lg },
    md: { padV: 12, padH: 16, fontSize: 15, lineHeight: 20, radius: t.radius.md },
    sm: { padV: 8,  padH: 12, fontSize: 13, lineHeight: 18, radius: t.radius.sm },
  } as const;
  return map[size];
}

function variantColors(variant: Variant, t: ReturnType<typeof useTheme>, disabled: boolean) {
  const c = t.colors;
  switch (variant) {
    case 'primary':
      return {
        bg: disabled ? shade(c.primary, -20) : c.primary,
        fg: '#FFFFFF',
        border: 'transparent',
        spinner: '#FFFFFF',
      };
    case 'secondary':
      return {
        bg: t.mode === 'dark' ? c.elevated : c.surface,
        fg: t.mode === 'dark' ? c.inkHigh : c.ink,
        border: t.mode === 'dark' ? c.divider : 'rgba(0,0,0,0.08)',
        spinner: t.mode === 'dark' ? c.inkHigh : c.ink,
      };
    case 'danger':
      return {
        bg: disabled ? shade(c.danger, -20) : c.danger,
        fg: '#FFFFFF',
        border: 'transparent',
        spinner: '#FFFFFF',
      };
    case 'ghost':
    default:
      return {
        bg: 'transparent',
        fg: t.mode === 'dark' ? c.inkHigh : c.ink,
        border: t.mode === 'dark' ? c.divider : 'rgba(0,0,0,0.12)',
        spinner: t.mode === 'dark' ? c.inkHigh : c.ink,
      };
  }
}

function shade(hex: string, percent: number) {
  // Simple shade util: percent -100..100 → darker/lighter
  const clamp = (n: number) => Math.max(0, Math.min(255, n));
  const num = parseInt(hex.replace('#', ''), 16);
  const r = clamp((num >> 16) + Math.round(255 * (percent / 100)));
  const g = clamp(((num >> 8) & 0x00ff) + Math.round(255 * (percent / 100)));
  const b = clamp((num & 0x0000ff) + Math.round(255 * (percent / 100)));
  return `#${(1 << 24 | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}
