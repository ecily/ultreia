// stepsmatch/mobile/components/ui/Badge.tsx
import React from 'react';
import { Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeProvider';

type Tone = 'neutral' | 'accent' | 'warning' | 'danger' | 'success' | 'info';

export interface BadgeProps {
  label: string;
  tone?: Tone;
  style?: ViewStyle;
}

export default function Badge({ label, tone = 'neutral', style }: BadgeProps) {
  const t = useTheme();
  const { bg, fg, border } = toneColors(tone, t);

  return (
    <View
      style={[
        {
          alignSelf: 'flex-start',
          paddingHorizontal: 10,
          paddingVertical: 6,
          borderRadius: t.radius.pill,
          backgroundColor: bg,
          borderWidth: 0.5,
          borderColor: border,
        },
        style,
      ]}
    >
      <Text
        style={{
          color: fg,
          fontSize: t.text.label.size,
          lineHeight: t.text.label.lineHeight,
          fontWeight: t.text.label.weight as any,
        }}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

function toneColors(tone: Tone, t: ReturnType<typeof useTheme>) {
  const c = t.colors;
  switch (tone) {
    case 'accent':
      return { bg: withAlpha(c.accent, 0.15), fg: c.accent, border: withAlpha(c.accent, 0.35) };
    case 'warning':
      return { bg: withAlpha(c.warning, 0.15), fg: c.warning, border: withAlpha(c.warning, 0.35) };
    case 'danger':
      return { bg: withAlpha(c.danger, 0.15), fg: c.danger, border: withAlpha(c.danger, 0.35) };
    case 'success':
      return { bg: withAlpha(c.success, 0.15), fg: c.success, border: withAlpha(c.success, 0.35) };
    case 'info':
      return { bg: withAlpha(c.primary, 0.15), fg: c.primary, border: withAlpha(c.primary, 0.35) };
    case 'neutral':
    default:
      return {
        bg: t.mode === 'dark' ? withAlpha('#FFFFFF', 0.06) : c.muted,
        fg: t.mode === 'dark' ? c.ink : c.ink,
        border: t.mode === 'dark' ? c.divider : 'rgba(0,0,0,0.08)',
      };
  }
}

function withAlpha(hex: string, alpha: number) {
  // hex "#RRGGBB" → rgba
  const parsed = parseInt(hex.slice(1), 16);
  const r = (parsed >> 16) & 255;
  const g = (parsed >> 8) & 255;
  const b = parsed & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}
