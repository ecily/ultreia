import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Appearance, ColorSchemeName, Platform } from 'react-native';
import * as SystemUI from 'expo-system-ui';
import { tokens, Tokens, ColorPalette } from './tokens';

type Theme = {
  mode: NonNullable<ColorSchemeName>;
  colors: ColorPalette;
  spacing: Tokens['spacing'];
  radius: Tokens['radius'];
  shadow: Tokens['shadow'];
  text: Tokens['text'];
  motion: Tokens['motion'];
  zIndex: Tokens['zIndex'];
};

const ThemeContext = createContext<Theme | null>(null);

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<NonNullable<ColorSchemeName>>(
    (Appearance.getColorScheme() as NonNullable<ColorSchemeName>) || 'light'
  );

  useEffect(() => {
    const sub = Appearance.addChangeListener(({ colorScheme }) => {
      setMode((colorScheme as NonNullable<ColorSchemeName>) || 'light');
    });
    return () => sub.remove();
  }, []);

  const value: Theme = useMemo(() => {
    const colors = (tokens.colors as any)[mode] as ColorPalette;
    return {
      mode,
      colors,
      spacing: tokens.spacing,
      radius: tokens.radius,
      shadow: tokens.shadow,
      text: tokens.text,
      motion: tokens.motion,
      zIndex: tokens.zIndex,
    };
  }, [mode]);

  useEffect(() => {
    const c = value.colors.background;
    SystemUI.setBackgroundColorAsync(c).catch(() => {});
    if (Platform.OS === 'android') {
      // status bar is controlled by screen headers
    }
  }, [value]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}