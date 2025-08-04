import React, { useState } from 'react';
import {
  View, Text, Image, StyleSheet, Alert,
  TouchableOpacity, ActivityIndicator, ScrollView
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { API_URL } from '@env';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

export default function App() {
  const [image, setImage] = useState(null);
  const [isConverting, setIsConverting] = useState(false);
  const [convertedUri, setConvertedUri] = useState(null);
  const [format, setFormat] = useState('jpg');
  const [showInfo, setShowInfo] = useState(true);

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });

      if (!result.canceled) {
        setImage(result.assets[0]);
        setConvertedUri(null);
        setShowInfo(false);
      }
    } catch (err) {
      Alert.alert('Error selecting image', err.message);
    }
  };

  const convertImage = async () => {
    if (!image) return;
    setIsConverting(true);

    try {
      const filename = image.uri.split('/').pop();
      const match = /\.(\w+)$/.exec(filename || '');
      const mimeType = match ? `image/${match[1]}` : `image`;

      const formData = new FormData();
      formData.append('image', {
        uri: image.uri,
        name: filename,
        type: mimeType,
      });

      const res = await fetch(`${API_URL}/api/convert?format=${format}`, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      const blob = await res.blob();
      const base64 = await blobToBase64(blob);
      const outputPath = `${FileSystem.documentDirectory}converted.${format}`;

      await FileSystem.writeAsStringAsync(outputPath, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      setConvertedUri(outputPath);
      Alert.alert('Success', `Image converted to ${format.toUpperCase()}`);
    } catch (err) {
      Alert.alert('Conversion failed', err.message);
    } finally {
      setIsConverting(false);
    }
  };

  const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  const shareConverted = async () => {
    if (convertedUri) {
      await Sharing.shareAsync(convertedUri);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        <Text style={styles.title}>Smart Converter</Text>

        {showInfo && (
          <>
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
                 Convert HEIC, JPG, PNG, WebP, or PDF into JPG, PNG, WebP, or PDF. Fast & simple!
              </Text>
            </View>
            <MaterialIcons
              name="arrow-downward"
              size={28}
              color="#2563EB"
              style={{ marginBottom: 8 }}
            />
          </>
        )}

        <TouchableOpacity style={styles.button} onPress={pickImage}>
          <Text style={styles.buttonText}>Pick Image</Text>
        </TouchableOpacity>

        {image && (
          <>
            <Image source={{ uri: image.uri }} style={styles.imagePreview} />

            <View style={styles.formatBox}>
              <Text style={styles.formatLabel}>Convert to:</Text>
              <View style={styles.formatOptions}>
                {['jpg', 'png', 'pdf', 'webp'].map((f) => (
                  <TouchableOpacity
                    key={f}
                    style={[styles.formatButton, format === f && styles.formatSelected]}
                    onPress={() => setFormat(f)}
                  >
                    <Text style={styles.formatText}>{f.toUpperCase()}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <TouchableOpacity
              style={styles.convertButton}
              onPress={convertImage}
              disabled={isConverting}
            >
              {isConverting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Convert</Text>
              )}
            </TouchableOpacity>
          </>
        )}

        {convertedUri && (
          <>
            <Text style={styles.previewLabel}>Converted Image:</Text>
            <Image source={{ uri: convertedUri }} style={styles.imagePreview} />
            <TouchableOpacity style={styles.shareButton} onPress={shareConverted}>
              <Text style={styles.buttonText}>Share Image</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </ScrollView>
  );
}


const styles = StyleSheet.create({
  scrollContainer: {
    flexGrow: 1,
    backgroundColor: '#F9FAFB',
    minHeight: '100%',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 20,
    backgroundColor: '#F9FAFB',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#002855',
    marginBottom: 30,
    textAlign: 'center',
  },
  infoBox: {
    backgroundColor: '#E0F2FE',
    padding: 14,
    marginHorizontal: 12,
    marginBottom: 20,
    borderRadius: 16,
    borderLeftWidth: 5,
    borderLeftColor: '#2563EB',
    shadowColor: '#2563EB',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  infoText: {
    color: '#1E3A8A',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
  button: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 16,
    marginTop: 12,
    width: '80%',
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 6,
  },
  convertButton: {
    backgroundColor: '#10B981',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 16,
    marginTop: 28,
    width: '80%',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOpacity: 0.25,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 6,
  },
  shareButton: {
    backgroundColor: '#1E40AF',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 16,
    marginTop: 20,
    width: '80%',
    alignItems: 'center',
    shadowColor: '#1E40AF',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 5,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  imagePreview: {
    width: '100%',
    height: 240,
    borderRadius: 18,
    marginTop: 24,
    resizeMode: 'cover',
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
    borderWidth: 1,
  },
  formatBox: {
    marginTop: 30,
    alignItems: 'center',
    width: '100%',
  },
  formatLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 14,
    color: '#1F2937',
  },
  formatOptions: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 10,
  },
  formatButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 6,
  },
  formatSelected: {
    backgroundColor: '#2563EB',
  },
  formatText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  previewLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginTop: 34,
    marginBottom: 14,
    color: '#111827',
  },
});