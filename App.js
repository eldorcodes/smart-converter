import React, { useState } from 'react';
import {
  View, Text, Image, StyleSheet, Alert,
  TouchableOpacity, ActivityIndicator, ScrollView, Platform
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { API_URL } from '@env';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import * as ImageManipulator from 'expo-image-manipulator';

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

    if (!result.canceled && result.assets.length > 0) {
      let selected = result.assets[0];
      let uri = selected.uri;
      const MAX_SIZE = 50 * 1024 * 1024;

      let fileInfo = await FileSystem.getInfoAsync(uri);
      console.log('🧾 Original file size (bytes):', fileInfo.size);

      // ✅ Compress & resize if size exceeds limit
      if (fileInfo.size > MAX_SIZE) {
        const manipulated = await ImageManipulator.manipulateAsync(
          uri,
          [{ resize: { width: 1500 } }], // resize for optimization
          { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
        );
        uri = manipulated.uri;

        // Get new size
        fileInfo = await FileSystem.getInfoAsync(uri);
        console.log('✅ Compressed size (bytes):', fileInfo.size);

        // Still too big?
        if (fileInfo.size > MAX_SIZE) {
          Alert.alert(
            'File Too Large',
            'Even after compression, the image is too large. Please select a smaller image.'
          );
          return;
        }
      }

      setImage({ ...selected, uri });
      setConvertedUri(null);
      setShowInfo(false);
    }
  } catch (err) {
    console.error('📸 Image pick error:', err);
    Alert.alert('Image Error', err.message || 'Something went wrong.');
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
        <Text style={styles.title}>HEIC to JPG</Text>

        {showInfo && (
          <>
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>
            📷 Convert HEIC to JPG, PNG, PDF, or WEBP effortlessly.{"\n"}
            ⚡ Fast, simple, and works offline.
          </Text>
            </View>
            <MaterialIcons
              name="arrow-downward"
              size={28}
              color="#2563EB"
              style={{ marginBottom: 12 }}
            />
          </>
        )}

        <TouchableOpacity style={styles.primaryButton} onPress={pickImage}>
          <Text style={styles.buttonText}>Pick an Image</Text>
        </TouchableOpacity>

        {/* ✅ Preview selected image */}
        {image && (
          <>
            <Image source={{ uri: image.uri }} style={styles.imagePreview} />

            <View style={styles.formatBox}>
              <Text style={styles.formatLabel}>Convert to:</Text>
              <View style={styles.formatOptions}>
                {['jpg', 'png', 'pdf', 'webp'].map((f) => (
                  <TouchableOpacity
                    key={f}
                    style={[
                      styles.formatButton,
                      format === f && styles.formatSelected
                    ]}
                    onPress={() => setFormat(f)}
                  >
                    <Text style={[
                      styles.formatText,
                      format === f ? styles.formatTextSelected : styles.formatTextDefault
                    ]}>
                      {f.toUpperCase()}
                    </Text>
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

        {/* ✅ Preview converted image */}
        {convertedUri && (
          <>
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
    backgroundColor: '#FFFFFF',
    paddingVertical: 60,
  },
  container: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
    backgroundColor: '#FFFFFF',
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: '#002855',
    marginBottom: 20,
    textAlign: 'center',
  },
  infoBox: {
    backgroundColor: '#E0F2FE',
    padding: 14,
    borderRadius: 12,
    marginBottom: 20,
    width: '100%',
  },
  infoText: {
    color: '#1E3A8A',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 16,
    width: '90%',
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 6,
  },
  convertButton: {
    backgroundColor: '#10B981',
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 16,
    marginTop: 28,
    width: '90%',
    alignItems: 'center',
    shadowColor: '#10B981',
    shadowOpacity: 0.3,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 6,
  },
  shareButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 16,
    marginTop: 20,
    width: '90%',
    alignItems: 'center',
    shadowColor: '#2563EB',
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
    borderRadius: 16,
    marginTop: 24,
    resizeMode: 'cover',
    backgroundColor: '#F3F4F6',
    borderColor: '#E5E7EB',
    borderWidth: 1,
  },
  formatBox: {
    marginTop: 32,
    width: '100%',
    alignItems: 'center',
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
  },
  formatButton: {
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
    marginHorizontal: 6,
    marginVertical: 6,
  },
  formatSelected: {
    backgroundColor: '#002855',
  },
  formatText: {
    fontSize: 14,
    fontWeight: '600',
  },
  formatTextDefault: {
    color: '#111827',
  },
  formatTextSelected: {
    color: '#FFFFFF',
  },
});