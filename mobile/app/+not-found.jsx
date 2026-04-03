import React from 'react';
import { View, Text } from 'react-native';
import { useLocalSearchParams, usePathname } from 'expo-router';

export default function NotFound() {
  const params = useLocalSearchParams();
  const pathname = usePathname();
  return (
    <View style={{ flex: 1, padding: 20, gap: 12, justifyContent: 'center' }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold' }}>Route nicht gefunden</Text>
      <Text>Pfad: {pathname}</Text>
      <Text>Params: {JSON.stringify(params)}</Text>
      <Text style={{ opacity: 0.6 }}>
        Tipp: Prüfe, ob dein Notification-Payload eine gültige <Text style={{ fontWeight: 'bold' }}>data.url</Text> (z. B. „/offers/123“) oder <Text style={{ fontWeight: 'bold' }}>offerId</Text> enthält.
      </Text>
    </View>
  );
}
