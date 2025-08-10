import React, { useState } from 'react';
import {
  View, Text, Image, StyleSheet, Alert,
  TouchableOpacity, ActivityIndicator, ScrollView, Platform, Dimensions
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import * as ImageManipulator from 'expo-image-manipulator';
import LottieView from 'lottie-react-native';
import { API_URL } from '@env';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const { height: screenHeight } = Dimensions.get('window');

export default function App() {
  const [image, setImage] = useState(null);
  const [isConverting, setIsConverting] = useState(false);
  const [convertedUri, setConvertedUri] = useState(null);
  const [format, setFormat] = useState('jpg');
  const [showInfo, setShowInfo] = useState(true);
  const [isRotating, setIsRotating] = useState(false);



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

        if (fileInfo.size > MAX_SIZE) {
          const manipulated = await ImageManipulator.manipulateAsync(
            uri,
            [{ resize: { width: 1500 } }],
            { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
          );
          uri = manipulated.uri;

          fileInfo = await FileSystem.getInfoAsync(uri);
          console.log('✅ Compressed size (bytes):', fileInfo.size);

          if (fileInfo.size > MAX_SIZE) {
            Alert.alert(
              'File Too Large',
              'Even after compression, the image is too large. Please select a smaller image.'
            );
            return;
          }
        }

        setImage({ ...selected, uri });
        setConvertedUri(null); // reset any previous conversion
        setShowInfo(false);
      }
    } catch (err) {
      console.error('📸 Image pick error:', err);
      Alert.alert('Image Error', err.message || 'Something went wrong.');
    }
  };

  const getMimeFromFormat = (f) => {
    if (f === 'jpg' || f === 'jpeg') return 'image/jpeg';
    if (f === 'png') return 'image/png';
    if (f === 'webp') return 'image/webp';
    if (f === 'pdf') return 'application/pdf';
    return `image/${f}`;
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
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      if (!res.ok) throw new Error(`Server error: ${res.status}`);

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

  const blobToBase64 = (blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const shareConverted = async () => {
    try {
      if (!convertedUri) return;
      const mimeType = getMimeFromFormat(format);

      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert('Sharing not available on this device');
        return;
      }
      await Sharing.shareAsync(convertedUri, {
        mimeType,
        dialogTitle: 'Share converted file',
        UTI: Platform.OS === 'ios' && format !== 'pdf' ? 'public.image' : undefined,
      });
    } catch (e) {
      Alert.alert('Share Error', e.message || 'Could not open share sheet.');
    }
  };

  const saveToGallery = async () => {
    try {
      if (!convertedUri) return;

      if (format === 'pdf') {
        Alert.alert(
          'PDF cannot be saved to Photos',
          'Use “Share” → “Save to Files” to store the PDF.'
        );
        return;
      }

      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Allow access to save images to your Photos.');
        return;
      }

      const asset = await MediaLibrary.createAssetAsync(convertedUri);
      try {
        await MediaLibrary.createAlbumAsync('Converted Images', asset, false);
      } catch (_) {}
      Alert.alert('Saved', 'Image saved to your Photos.');
    } catch (e) {
      Alert.alert('Save Error', e.message || 'Could not save to gallery.');
    }
  };

  // 🔄 Rotate ONLY the converted image (not the original)
  const rotateConverted = async (angle) => {
    try {
      if (!convertedUri) return;

      if (format === 'pdf') {
        Alert.alert(
          'Rotation not available for PDF',
          'Rotate after exporting as JPG/PNG/WEBP, or use a PDF tool to rotate pages.'
        );
        return;
      }

      setIsRotating(true);

      // Map selected format to ImageManipulator save format
      const toSaveFormat =
        format === 'png'
          ? ImageManipulator.SaveFormat.PNG
          : format === 'webp' && ImageManipulator.SaveFormat.WEBP
          ? ImageManipulator.SaveFormat.WEBP
          : ImageManipulator.SaveFormat.JPEG; // default to JPEG for jpg/webp fallback

      const rotated = await ImageManipulator.manipulateAsync(
        convertedUri,
        [{ rotate: angle }],
        { compress: 1, format: toSaveFormat }
      );

      // Overwrite the same file path so subsequent Save/Share use rotated version
      const destPath = `${FileSystem.documentDirectory}converted.${format}`;
      await FileSystem.copyAsync({ from: rotated.uri, to: destPath });
      setConvertedUri(destPath);
    } catch (e) {
      Alert.alert('Rotate Error', e.message || 'Could not rotate image.');
    } finally {
      setIsRotating(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.scrollContainer}>
      <View style={styles.container}>
        <Text style={styles.title}>HEIC to JPG</Text>

      {showInfo && (
  <>
   <Image
        source={require('./assets/splash.png')} // <-- put your logo here
        style={styles.logo}
        resizeMode="contain"
      />

    <View style={styles.infoBox}>
     
      <Text style={styles.infoText}>
        📷 Convert HEIC to JPG, PNG, PDF, or WEBP effortlessly.{'\n'}
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

        {/* Preview original selection (unchanged) */}
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
                    <Text
                      style={[
                        styles.formatText,
                        format === f ? styles.formatTextSelected : styles.formatTextDefault
                      ]}
                    >
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

        {/* Preview & actions for converted result */}
        {convertedUri && (
          <>
            <Image source={{ uri: convertedUri }} style={styles.imagePreview} />

            {/* Rotate buttons only for image formats */}
            {format !== 'pdf' && (
              <View style={styles.rotateRow}>
                <TouchableOpacity
                  style={styles.rotateButton}
                  onPress={() => rotateConverted(-90)}
                  disabled={isRotating}
                >
                  <Text style={styles.buttonText}>↺ Rotate Left</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.rotateButton}
                  onPress={() => rotateConverted(90)}
                  disabled={isRotating}
                >
                  <Text style={styles.buttonText}>↻ Rotate Right</Text>
                </TouchableOpacity>
              </View>
            )}

            {format !== 'pdf' && (
              <TouchableOpacity style={styles.shareButton} onPress={saveToGallery}>
                <Text style={styles.buttonText}>Save to Gallery</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity style={styles.shareButton} onPress={shareConverted}>
              <Text style={styles.buttonText}>
                {format === 'pdf' ? 'Share / Save to Files' : 'Share Image'}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* Lottie overlay while converting or rotating */}
        {(isConverting || isRotating) && (
          <View style={styles.loadingOverlay}>
            <View style={styles.loadingCard}>
              <LottieView
                source={require('./assets/loader.json')}
                autoPlay
                loop
                style={styles.lottie}
              />
              <Text style={styles.loadingText}>
                {isConverting ? 'Converting…' : 'Rotating…'}
              </Text>
            </View>
          </View>
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
  rotateRow: {
    flexDirection: 'row',
    marginTop: 16,
    width: '90%',
    justifyContent: 'space-between',
  },
  rotateButton: {
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
    width: '48%',
    alignItems: 'center',
    shadowColor: '#2563EB',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 4,
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
  height: screenHeight > 700 ? 240 : 200, // adaptive height
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

  /* Lottie overlay styles */
  loadingOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  loadingCard: {
    width: '75%',
    maxWidth: 360,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    paddingVertical: 24,
    paddingHorizontal: 16,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 10,
    elevation: 8,
  },
  lottie: {
    width: 140,
    height: 140,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#002855',
  },
  logo: {
  width: 80,       // adjust size as needed
  height: 80,
  marginBottom: 12,
  alignSelf: 'center',
},
});