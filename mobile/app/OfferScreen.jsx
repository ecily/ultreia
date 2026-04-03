import React from 'react';
import { Redirect, useLocalSearchParams } from 'expo-router';

/** Fängt falsche Deep Links wie "/OfferScreen?id=..." ab. */
export default function LegacyOfferScreenRoute() {
  const params = useLocalSearchParams();
  const id = (params?.id ?? params?.offerId ?? '').toString().trim();
  return id ? <Redirect href={`/offers/${id}`} /> : <Redirect href='/(tabs)/OffersScreen' />;
}
