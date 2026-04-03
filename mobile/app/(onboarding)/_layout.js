// mobile/app/(onboarding)/_layout.js
import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTheme } from '../../theme/ThemeProvider';

export default function OnboardingLayout() {
  const t = useTheme();
  const statusStyle = t?.mode === 'dark' ? 'light' : 'dark';

  return (
    <>
      {/* Onboarding ohne Header, StatusBar folgt dem Theme */}
      <StatusBar style={statusStyle} animated />
      <Stack
        screenOptions={{
          headerShown: false,
          animation: 'fade_from_bottom',
          gestureEnabled: true,
          // Einheitlicher Hintergrund für alle Onboarding-Screens → verhindert Flashes
          contentStyle: { backgroundColor: t.colors.background },
          // Weitergabe an native StatusBar (wo unterstützt)
          statusBarStyle: statusStyle,
          statusBarBackgroundColor: t.colors.background,
        }}
      >
        {/* Expo Router registriert automatisch alle Dateien in diesem Segment.
            Die Einträge helfen nur beim Autocomplete. */}
        <Stack.Screen name="WelcomeScreen" />
        <Stack.Screen name="LocationScreen" />
        <Stack.Screen name="InterestsScreen" />
        <Stack.Screen name="DoneScreen" />
      </Stack>
    </>
  );
}
