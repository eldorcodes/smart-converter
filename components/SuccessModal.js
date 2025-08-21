// components/SuccessModal.js
import React from 'react';
import { Modal, View, Text, Pressable, StyleSheet, Platform } from 'react-native';
import LottieView from 'lottie-react-native';

export default function SuccessModal({
  visible,
  title = 'Success',
  message = '',
  buttonLabel = 'OK',
  onClose,
}) {
  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
      statusBarTranslucent
      presentationStyle="overFullScreen"
    >
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <LottieView
            source={require('../assets/success.json')}
            autoPlay
            loop={false}
            style={{ width: 140, height: 140, alignSelf: 'center' }}
          />
          <Text style={styles.title}>{title}</Text>
          {!!message && <Text style={styles.msg}>{message}</Text>}
          <Pressable onPress={onClose} style={({ pressed }) => [styles.btn, pressed && { opacity: 0.9 }]}>
            <Text style={styles.btnText}>{buttonLabel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 20,
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 8 },
    }),
  },
  title: { fontSize: 20, fontWeight: '800', textAlign: 'center', color: '#111827', marginTop: 4 },
  msg: { fontSize: 15, textAlign: 'center', color: '#4b5563', marginTop: 6, marginBottom: 14 },
  btn: { backgroundColor: '#10B981', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 18, alignSelf: 'center', minWidth: 120 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16, textAlign: 'center' },
});