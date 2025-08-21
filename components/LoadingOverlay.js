// components/LoadingOverlay.js
import React from 'react';
import { Modal, View, Text, StyleSheet } from 'react-native';
import LottieView from 'lottie-react-native';

export default function LoadingOverlay({ visible, message = 'Working…' }) {
  if (!visible) return null;
  return (
    <Modal transparent animationType="fade" visible={visible} statusBarTranslucent presentationStyle="overFullScreen">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <LottieView
            source={require('../assets/loader.json')}
            autoPlay
            loop
            style={{ width: 120, height: 120, alignSelf: 'center' }}
          />
          <Text style={styles.title}>{message}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: { width: '86%', maxWidth: 420, backgroundColor: '#fff', borderRadius: 20, padding: 20, elevation: 8 },
  title: { fontSize: 18, fontWeight: '700', textAlign: 'center', color: '#111827', marginTop: 8 },
});