import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { Icon } from '@/components/icon';
import { saveTranscript } from '@/services/transcript-storage';
import { transcribeAudio } from '@/services/whisper-service';
import type { Transcript } from '@/types';

function formatSize(bytes?: number): string {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type PickedFile = { uri: string; name: string; size?: number };

export default function UploadScreen() {
  const [file, setFile] = useState<PickedFile | null>(null);
  const [transcription, setTranscription] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [saved, setSaved] = useState(false);

  const pickFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['audio/*', 'video/*'],
        copyToCacheDirectory: true,
      });
      if (!result.canceled && result.assets[0]) {
        const { uri, name, size } = result.assets[0];
        setFile({ uri, name, size });
        setTranscription(null);
        setSaved(false);
      }
    } catch {
      Alert.alert('Error', 'Could not open the file picker.');
    }
  };

  const handleTranscribe = async () => {
    if (!file) return;
    setIsTranscribing(true);
    try {
      const text = await transcribeAudio(file.uri, file.name);
      setTranscription(text);
    } catch (err: unknown) {
      Alert.alert(
        'Transcription Failed',
        err instanceof Error ? err.message : 'An unexpected error occurred.'
      );
    } finally {
      setIsTranscribing(false);
    }
  };

  const handleSave = async () => {
    if (!transcription || !file) return;
    const baseName = file.name.replace(/\.[^.]+$/, '') || 'Uploaded File';
    const transcript: Transcript = {
      id: `${Date.now()}`,
      title: baseName,
      text: transcription,
      duration: 0,
      createdAt: new Date().toISOString(),
      source: 'upload',
      fileName: file.name,
      fileSize: file.size,
    };
    await saveTranscript(transcript);
    setSaved(true);
    if (Platform.OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#111111' }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 20, gap: 16 }}>
      <Text style={{ color: '#ffffff', fontSize: 30, fontWeight: '700' }}>
        Upload
      </Text>

      {/* Drop zone / File picker */}
      <Pressable
        onPress={pickFile}
        style={({ pressed }) => ({
          backgroundColor: pressed ? '#1a1a1e' : '#1c1c1e',
          borderRadius: 24,
          padding: 36,
          alignItems: 'center',
          gap: 14,
          borderCurve: 'continuous' as any,
          borderWidth: 1.5,
          borderStyle: 'dashed',
          borderColor: file ? '#6366f1' : '#3f3f46',
        })}>
        <Icon
          name={file ? 'checkmark.circle.fill' : 'arrow.up.doc.fill'}
          size={44}
          tintColor={file ? '#6366f1' : '#52525b'}
        />
        <View style={{ alignItems: 'center', gap: 6 }}>
          <Text
            style={{
              color: '#ffffff',
              fontSize: 16,
              fontWeight: '600',
              textAlign: 'center',
            }}>
            {file ? file.name : 'Choose an Audio or Video File'}
          </Text>
          <Text
            style={{
              color: '#52525b',
              fontSize: 13,
              textAlign: 'center',
              lineHeight: 18,
            }}>
            {file
              ? `${formatSize(file.size)} · Tap to change`
              : 'MP3, M4A, WAV, MP4, and more\nUp to 25 MB for Whisper API'}
          </Text>
        </View>
      </Pressable>

      {/* Transcribe button */}
      {file && !transcription && (
        <Pressable
          onPress={handleTranscribe}
          disabled={isTranscribing}
          style={({ pressed }) => ({
            backgroundColor: isTranscribing || pressed ? '#4338ca' : '#6366f1',
            borderRadius: 16,
            paddingVertical: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            borderCurve: 'continuous' as any,
          })}>
          {isTranscribing ? (
            <>
              <ActivityIndicator color="#ffffff" />
              <Text
                style={{
                  color: '#ffffff',
                  fontSize: 16,
                  fontWeight: '600',
                }}>
                Transcribing…
              </Text>
            </>
          ) : (
            <>
              <Icon
                name="text.word.spacing"
                size={20}
                tintColor="#ffffff"
              />
              <Text
                style={{
                  color: '#ffffff',
                  fontSize: 16,
                  fontWeight: '600',
                }}>
                Transcribe with Whisper
              </Text>
            </>
          )}
        </Pressable>
      )}

      {/* Transcription result */}
      {transcription && (
        <View
          style={{
            backgroundColor: '#1c1c1e',
            borderRadius: 16,
            padding: 16,
            gap: 14,
            borderCurve: 'continuous' as any,
          }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
            <Text
              style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>
              Transcription
            </Text>
            <Icon name="checkmark.seal.fill" size={18} tintColor="#4ade80" />
          </View>

          <Text
            selectable
            style={{ color: '#d4d4d8', fontSize: 15, lineHeight: 26 }}>
            {transcription}
          </Text>

          {!saved ? (
            <Pressable
              onPress={handleSave}
              style={({ pressed }) => ({
                backgroundColor: pressed ? '#14532d' : '#0f2318',
                borderRadius: 12,
                paddingVertical: 12,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                borderCurve: 'continuous' as any,
                borderWidth: 1,
                borderColor: '#166534',
              })}>
              <Icon
                name="square.and.arrow.down"
                size={17}
                tintColor="#4ade80"
              />
              <Text
                style={{
                  color: '#4ade80',
                  fontSize: 15,
                  fontWeight: '600',
                }}>
                Save Transcript
              </Text>
            </Pressable>
          ) : (
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                paddingVertical: 4,
              }}>
              <Icon name="checkmark.circle.fill" size={17} tintColor="#4ade80" />
              <Text style={{ color: '#4ade80', fontSize: 14 }}>
                Saved to Transcripts
              </Text>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}
