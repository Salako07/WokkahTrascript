import React, { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SymbolView } from 'expo-symbols';
import { getApiKey, saveApiKey } from '@/services/whisper-service';

export default function SettingsScreen() {
  const [apiKey, setApiKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    getApiKey().then((k) => {
      if (k) {
        setApiKey(k);
        setHasKey(true);
      }
    });
  }, []);

  const handleSave = async () => {
    const trimmed = apiKey.trim();
    if (!trimmed) {
      Alert.alert('Missing Key', 'Please enter your OpenAI API key.');
      return;
    }
    if (!trimmed.startsWith('sk-')) {
      Alert.alert(
        'Invalid Key',
        'OpenAI API keys begin with "sk-". Please double-check your key.'
      );
      return;
    }
    await saveApiKey(trimmed);
    setHasKey(true);
    setDirty(false);
    Alert.alert('Saved', 'Your API key has been stored securely on this device.');
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#111111' }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 20, gap: 24 }}>
      {/* API Key section */}
      <View style={{ gap: 12 }}>
        <View style={{ gap: 4 }}>
          <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>
            OpenAI API Key
          </Text>
          <Text style={{ color: '#71717a', fontSize: 13, lineHeight: 19 }}>
            Required for Whisper transcription. Stored securely on your device
            — never sent anywhere except the OpenAI API.
          </Text>
        </View>

        <View
          style={{
            backgroundColor: '#1c1c1e',
            borderRadius: 14,
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 14,
            borderCurve: 'continuous' as any,
            borderWidth: 1,
            borderColor: hasKey && !dirty ? '#4338ca' : '#2a2a2e',
          }}>
          <SymbolView name="key.fill" size={16} tintColor="#52525b" />
          <TextInput
            value={apiKey}
            onChangeText={(t) => {
              setApiKey(t);
              setDirty(true);
            }}
            placeholder="sk-..."
            placeholderTextColor="#3f3f46"
            secureTextEntry
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              flex: 1,
              color: '#ffffff',
              paddingVertical: 14,
              paddingLeft: 10,
              fontSize: 15,
              fontFamily: 'monospace',
            }}
          />
          {hasKey && !dirty && (
            <SymbolView
              name="checkmark.circle.fill"
              size={18}
              tintColor="#4ade80"
            />
          )}
        </View>

        <Pressable
          onPress={handleSave}
          style={({ pressed }) => ({
            backgroundColor: pressed ? '#4338ca' : '#6366f1',
            borderRadius: 14,
            paddingVertical: 14,
            alignItems: 'center',
            borderCurve: 'continuous' as any,
          })}>
          <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '600' }}>
            Save API Key
          </Text>
        </Pressable>
      </View>

      {/* Whisper info */}
      <View
        style={{
          backgroundColor: '#1c1c1e',
          borderRadius: 14,
          padding: 16,
          gap: 10,
          borderCurve: 'continuous' as any,
        }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <SymbolView name="info.circle" size={16} tintColor="#818cf8" />
          <Text style={{ color: '#a1a1aa', fontSize: 14, fontWeight: '600' }}>
            About Whisper
          </Text>
        </View>
        <Text style={{ color: '#71717a', fontSize: 13, lineHeight: 20 }}>
          This app uses OpenAI's Whisper model (whisper-1) for transcription.
          Supported formats: MP3, MP4, M4A, WAV, WEBM, OGG, FLAC. Maximum
          file size: 25 MB.
        </Text>
        <Text style={{ color: '#52525b', fontSize: 13, lineHeight: 20 }}>
          Get an API key at platform.openai.com → API Keys.
        </Text>
      </View>

      {/* App info */}
      <View
        style={{
          backgroundColor: '#1c1c1e',
          borderRadius: 14,
          padding: 16,
          gap: 4,
          borderCurve: 'continuous' as any,
        }}>
        <Text style={{ color: '#a1a1aa', fontSize: 14, fontWeight: '600' }}>
          WokkahTranscript
        </Text>
        <Text style={{ color: '#52525b', fontSize: 13 }}>Version 1.0.0</Text>
        <Text style={{ color: '#52525b', fontSize: 13, marginTop: 4 }}>
          Meeting transcription powered by OpenAI Whisper
        </Text>
      </View>
    </ScrollView>
  );
}
