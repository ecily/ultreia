import React from 'react';
import { View, Image, StyleSheet } from 'react-native';

export default function BootSplash() {
  return (
    <View style={styles.container}>
      <View style={styles.bg} />
      <Image
        source={require('../assets/splash.png')}
        resizeMode="cover"
        style={styles.image}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0d4ea6' },
  bg: { ...StyleSheet.absoluteFillObject, backgroundColor: '#0d4ea6' },
  image: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' }
});
