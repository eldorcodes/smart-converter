// App.js
import React, { useState } from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  Alert,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Platform,
  Dimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import * as ImageManipulator from 'expo-image-manipulator';
import * as IntentLauncher from 'expo-intent-launcher';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

import SuccessModal from './components/SuccessModal';
import FailModal from './components/FailModal';
// ⛔️ Removed LoadingOverlay to avoid any chance of an invisible full-screen touch blocker

const { height: screenHeight } = Dimensions.get('window');

// Cache-busting helpers for Image preview vs. filesystem
const bust = (p) => `${p}?t=${Date.now()}`; // append timestamp for RN Image cache
const base = (u) => (u ? u.split('?')[0] : u); // strip ?t= for filesystem/sharing

const API_URL = process.env.EXPO_PUBLIC_API_URL || "https://study-smart-api-1076720753233.us-west1.run.app";

export default function App() {
  const [image, setImage] = useState(null);
  const [isConverting, setIsConverting] = useState(false);
  const [convertedUri, setConvertedUri] = useState(null); // may contain ?t=
  const [format, setFormat] = useState('jpg');
  const [showInfo, setShowInfo] = useState(true);
  const [isRotating, setIsRotating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Modals
  const [successVisible, setSuccessVisible] = useState(false);
  const [successTitle, setSuccessTitle] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [failVisible, setFailVisible] = useState(false);
  const [failTitle, setFailTitle] = useState('');
  const [failMessage, setFailMessage] = useState('');

  const blobToBase64 = (blob) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result.split(',')[1]);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const getMimeFromFormat = (f) => {
    if (f === 'jpg' || f === 'jpeg') return 'image/jpeg';
    if (f === 'png') return 'image/png';
    if (f === 'webp') return 'image/webp';
    if (f === 'pdf') return 'application/pdf';
    return `image/${f}`;
  };

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
      });

      if (!result.canceled && result.assets?.length > 0) {
        let selected = result.assets[0];
        let uri = selected.uri;

        // Optional guard for huge files
        const MAX_SIZE = 50 * 1024 * 1024;
        let info = await FileSystem.getInfoAsync(uri);
        if (info.size > MAX_SIZE) {
          const manipulated = await ImageManipulator.manipulateAsync(
            uri,
            [{ resize: { width: 1500 } }],
            { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
          );
          uri = manipulated.uri;

          info = await FileSystem.getInfoAsync(uri);
          if (info.size > MAX_SIZE) {
            setFailTitle('File Too Large');
            setFailMessage('Even after compression, the image is too large. Please select a smaller image.');
            setFailVisible(true);
            return;
          }
        }

        setImage({ ...selected, uri });
        setConvertedUri(null);
        setShowInfo(false);
      }
    } catch (err) {
      setFailTitle('Image Error');
      setFailMessage(err?.message || 'Something went wrong.');
      setFailVisible(true);
    }
  };

  const convertImage = async () => {
    if (!image) return;
    setIsConverting(true);

    try {
      const filename = image.uri.split('/').pop();
      const match = /\.(\w+)$/.exec(filename || '');
      const mimeType = match ? `image/${match[1]}` : 'image';

      const formData = new FormData();
      formData.append('image', {
        uri: image.uri,
        name: filename || 'image',
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

      // Bust cache so preview updates
      setConvertedUri(bust(outputPath));
      setSuccessTitle('Success');
      setSuccessMessage(`Image converted to ${format.toUpperCase()}`);
      setSuccessVisible(true);
    } catch (err) {
      setFailTitle('Conversion failed');
      setFailMessage(err?.message || 'Please try again.');
      setFailVisible(true);
    } finally {
      setIsConverting(false);
    }
  };

  const openPdf = async () => {
    const path = base(convertedUri);
    if (!path) return;

    if (Platform.OS === 'android') {
      try {
        const contentUri = await FileSystem.getContentUriAsync(path);
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: contentUri,
          type: 'application/pdf',
          flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
        });
      } catch (e) {
        setFailTitle('No PDF app found');
        setFailMessage('Please install a PDF viewer to open this file.');
        setFailVisible(true);
      }
    } else {
      try {
        await Sharing.shareAsync(path, { mimeType: 'application/pdf' });
      } catch (e) {
        setFailTitle('Open PDF failed');
        setFailMessage('Could not open the PDF.');
        setFailVisible(true);
      }
    }
  };

  const shareConverted = async () => {
    try {
      const path = base(convertedUri);
      if (!path) return;

      const mimeType = getMimeFromFormat(format);
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        setFailTitle('Sharing unavailable');
        setFailMessage('Sharing is not available on this device.');
        setFailVisible(true);
        return;
      }
      await Sharing.shareAsync(path, {
        mimeType,
        dialogTitle: 'Share converted file',
        UTI: Platform.OS === 'ios' && format !== 'pdf' ? 'public.image' : undefined,
      });

      setSuccessTitle('Shared');
      setSuccessMessage('Share sheet opened.');
      setSuccessVisible(true);
    } catch (e) {
      setFailTitle('Share failed');
      setFailMessage(e?.message || 'Please try again.');
      setFailVisible(true);
    }
  };

  const saveToGallery = async () => {
    try {
      if (isSaving) return;
      const path = base(convertedUri);
      if (!path) return;

      if (format === 'pdf') {
        setFailTitle('PDF not supported in Photos');
        setFailMessage('Use “Share → Save to Files” to store the PDF.');
        setFailVisible(true);
        return;
      }

      setIsSaving(true);

      const info = await FileSystem.getInfoAsync(path);
      if (!info.exists) {
        setFailTitle('File Missing');
        setFailMessage('Please convert again and then save.');
        setFailVisible(true);
        return;
      }

      let perm = await MediaLibrary.getPermissionsAsync();
      if (perm.status !== 'granted') {
        perm = await MediaLibrary.requestPermissionsAsync();
        if (perm.status !== 'granted') {
          setFailTitle('Permission needed');
          setFailMessage('Allow Photos access to save images.');
          setFailVisible(true);
          return;
        }
      }

      let saveUri = path;
      if (Platform.OS === 'ios' && format === 'webp') {
        const jpeg = await ImageManipulator.manipulateAsync(path, [], {
          compress: 1,
          format: ImageManipulator.SaveFormat.JPEG,
        });
        saveUri = jpeg.uri;
      }

      const asset = await MediaLibrary.createAssetAsync(saveUri);
      await MediaLibrary.createAlbumAsync('Converted Images', asset, false).catch(() => {});
      setSuccessTitle('Success');
      setSuccessMessage('Image saved to your Photos');
      setSuccessVisible(true);
    } catch (e) {
      setFailTitle('Save failed');
      setFailMessage(e?.message || 'Please try Share instead.');
      setFailVisible(true);
    } finally {
      setIsSaving(false);
    }
  };

  const rotateConverted = async (angle) => {
    try {
      const current = base(convertedUri);
      if (!current) return;

      if (format === 'pdf') {
        setFailTitle('Rotation not available for PDF');
        setFailMessage('Export as image first or use a PDF tool.');
        setFailVisible(true);
        return;
      }

      setIsRotating(true);

      const toSaveFormat =
        format === 'png'
          ? ImageManipulator.SaveFormat.PNG
          : format === 'webp' && ImageManipulator.SaveFormat.WEBP
          ? ImageManipulator.SaveFormat.WEBP
          : ImageManipulator.SaveFormat.JPEG;

      const rotated = await ImageManipulator.manipulateAsync(
        current,
        [{ rotate: angle }],
        { compress: 1, format: toSaveFormat }
      );

      const destPath = current || `${FileSystem.documentDirectory}converted.${format}`;
      await FileSystem.copyAsync({ from: rotated.uri, to: destPath });

      // Bust cache to refresh UI preview
      setConvertedUri(bust(destPath));
      setSuccessTitle('Success');
      setSuccessMessage('Image rotated.');
      setSuccessVisible(true);
    } catch (e) {
      setFailTitle('Rotate failed');
      setFailMessage(e?.message || 'Could not rotate image.');
      setFailVisible(true);
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
              source={require('./assets/splash.png')}
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

        <TouchableOpacity style={styles.primaryButton} onPress={pickImage} disabled={isConverting || isRotating || isSaving}>
          <Text style={styles.buttonText}>Pick an Image</Text>
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
                    disabled={isConverting || isRotating || isSaving}
                  >
                    <Text
                      style={[
                        styles.formatText,
                        format === f ? styles.formatTextSelected : styles.formatTextDefault,
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

        {convertedUri && (
          <>
            {format === 'pdf' ? (
              <View style={[styles.imagePreview, { justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: '#1F2937', fontWeight: '600', marginBottom: 10 }}>PDF ready</Text>
                <TouchableOpacity style={styles.shareButton} onPress={openPdf} disabled={isConverting || isRotating || isSaving}>
                  <Text style={styles.buttonText}>Open PDF</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <Image source={{ uri: convertedUri }} style={styles.imagePreview} />
            )}

            {format !== 'pdf' && (
              <View style={styles.rotateRow}>
                <TouchableOpacity
                  style={styles.rotateButton}
                  onPress={() => rotateConverted(-90)}
                  disabled={isRotating}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  {isRotating ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>↺ Rotate Left</Text>}
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.rotateButton}
                  onPress={() => rotateConverted(90)}
                  disabled={isRotating}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  {isRotating ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>↻ Rotate Right</Text>}
                </TouchableOpacity>
              </View>
            )}

            {format !== 'pdf' && (
              <TouchableOpacity
                style={styles.shareButton}
                onPress={saveToGallery}
                disabled={isSaving}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                {isSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Save to Gallery</Text>}
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={styles.shareButton}
              onPress={shareConverted}
              disabled={isConverting || isRotating || isSaving}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.buttonText}>
                {format === 'pdf' ? 'Share / Save to Files' : 'Share Image'}
              </Text>
            </TouchableOpacity>
          </>
        )}

        {/* Success / Fail modals (no overlay loader) */}
        <SuccessModal
          visible={successVisible}
          title={successTitle}
          message={successMessage}
          onClose={() => setSuccessVisible(false)}
        />

        <FailModal
          visible={failVisible}
          title={failTitle}
          message={failMessage}
          onClose={() => setFailVisible(false)}
        />
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
    height: screenHeight > 700 ? 240 : 200,
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
  logo: {
    width: 80,
    height: 80,
    marginBottom: 12,
    alignSelf: 'center',
  },
});