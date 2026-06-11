import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import { Icon } from '@/components/icon';
import { GOOGLE_OAUTH } from '@/config/google';
import {
  clearGoogleToken,
  isGoogleConnected,
  saveGoogleToken,
  uploadAllTranscripts,
} from '@/services/google-drive-service';
import { getTranscripts } from '@/services/transcript-storage';
import { getApiKey, saveApiKey } from '@/services/whisper-service';

WebBrowser.maybeCompleteAuthSession();

// True only when the current platform has a client ID configured
const PLATFORM_CONFIGURED =
  Platform.OS === 'ios'
    ? !!GOOGLE_OAUTH.iosClientId
    : Platform.OS === 'android'
      ? !!GOOGLE_OAUTH.androidClientId
      : !!GOOGLE_OAUTH.webClientId;

// Isolated component so the auth hook only mounts when IDs are present
function GoogleConnectButton({ onConnected }: { onConnected: () => void }) {
  const [, response, promptAsync] = Google.useAuthRequest({
    iosClientId: GOOGLE_OAUTH.iosClientId || undefined,
    androidClientId: GOOGLE_OAUTH.androidClientId || undefined,
    webClientId: GOOGLE_OAUTH.webClientId || undefined,
    scopes: ['https://www.googleapis.com/auth/drive.file'],
  });

  useEffect(() => {
    if (response?.type === 'success' && response.authentication?.accessToken) {
      saveGoogleToken(response.authentication.accessToken).then(() => {
        onConnected();
        Alert.alert(
          'Connected',
          'Google Drive linked. Files will upload to a "WokkahTranscript" folder.'
        );
      });
    } else if (response?.type === 'error') {
      Alert.alert('Sign-in Failed', response.error?.message ?? 'Could not connect to Google.');
    }
  }, [response]);

  return (
    <Pressable
      onPress={() => promptAsync()}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
        backgroundColor: pressed ? '#252529' : 'transparent',
      })}>
      <Icon name="person.crop.circle" size={16} tintColor="#818cf8" />
      <Text style={{ color: '#818cf8', fontSize: 14, fontWeight: '600' }}>
        Sign in with Google
      </Text>
    </Pressable>
  );
}

export default function SettingsScreen() {
  const [apiKey, setApiKey] = useState('');
  const [hasKey, setHasKey] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [driveConnected, setDriveConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState('');

  useEffect(() => {
    getApiKey().then((k) => {
      if (k) { setApiKey(k); setHasKey(true); }
    });
    isGoogleConnected().then(setDriveConnected);
  }, []);

  const handleSaveApiKey = async () => {
    const trimmed = apiKey.trim();
    if (!trimmed) { Alert.alert('Missing Key', 'Please enter your OpenAI API key.'); return; }
    if (!trimmed.startsWith('sk-')) {
      Alert.alert('Invalid Key', 'OpenAI API keys begin with "sk-". Please double-check your key.');
      return;
    }
    await saveApiKey(trimmed);
    setHasKey(true);
    setDirty(false);
    Alert.alert('Saved', 'Your API key has been stored securely on this device.');
  };

  const handleGoogleSignOut = () => {
    Alert.alert('Disconnect Google Drive', 'You will need to sign in again to upload files.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect',
        style: 'destructive',
        onPress: async () => {
          await clearGoogleToken();
          setDriveConnected(false);
        },
      },
    ]);
  };

  const handleSyncAll = async () => {
    setIsSyncing(true);
    setSyncProgress('Loading transcripts…');
    try {
      const all = await getTranscripts();
      if (all.length === 0) {
        Alert.alert('Nothing to Sync', 'No transcripts saved yet.');
        return;
      }
      setSyncProgress(`Uploading 0 of ${all.length}…`);
      await uploadAllTranscripts(all, (done, total) => {
        setSyncProgress(`Uploading ${done} of ${total}…`);
      });
      Alert.alert(
        'Sync Complete',
        `${all.length} transcript${all.length !== 1 ? 's' : ''} uploaded to Google Drive.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (msg === 'TOKEN_EXPIRED') {
        await clearGoogleToken();
        setDriveConnected(false);
        Alert.alert('Session Expired', 'Please reconnect Google Drive and try again.');
      } else {
        Alert.alert('Sync Failed', msg);
      }
    } finally {
      setIsSyncing(false);
      setSyncProgress('');
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#111111' }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 20, gap: 24 }}>

      {/* ── OpenAI API Key ──────────────────────────────────── */}
      <View style={{ gap: 12 }}>
        <View style={{ gap: 4 }}>
          <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>
            OpenAI API Key
          </Text>
          <Text style={{ color: '#71717a', fontSize: 13, lineHeight: 19 }}>
            Required for Whisper transcription. Stored securely on your device — never sent
            anywhere except the OpenAI API.
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
          <Icon name="key.fill" size={16} tintColor="#52525b" />
          <TextInput
            value={apiKey}
            onChangeText={(t) => { setApiKey(t); setDirty(true); }}
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
            <Icon name="checkmark.circle.fill" size={18} tintColor="#4ade80" />
          )}
        </View>

        <Pressable
          onPress={handleSaveApiKey}
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

      {/* ── Google Drive ─────────────────────────────────────── */}
      <View style={{ gap: 12 }}>
        <View style={{ gap: 4 }}>
          <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>
            Google Drive
          </Text>
          <Text style={{ color: '#71717a', fontSize: 13, lineHeight: 19 }}>
            Back up transcripts, summaries, and task lists to a "WokkahTranscript" folder in your
            Google Drive.
          </Text>
        </View>

        {!PLATFORM_CONFIGURED && (
          <View
            style={{
              backgroundColor: '#1c1005',
              borderRadius: 12,
              padding: 14,
              gap: 6,
              borderWidth: 1,
              borderColor: '#3d2e0a',
              borderCurve: 'continuous' as any,
            }}>
            <Text style={{ color: '#fb923c', fontSize: 13, fontWeight: '600' }}>
              Setup Required
            </Text>
            <Text style={{ color: '#92400e', fontSize: 12, lineHeight: 18 }}>
              1. Go to console.cloud.google.com{'\n'}
              2. Create a project → Enable Google Drive API{'\n'}
              3. Create OAuth 2.0 credentials (iOS, Android, Web){'\n'}
              4. Paste client IDs into src/config/google.ts
            </Text>
          </View>
        )}

        <View
          style={{
            backgroundColor: '#1c1c1e',
            borderRadius: 14,
            overflow: 'hidden',
            borderCurve: 'continuous' as any,
          }}>
          {/* Status row */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              padding: 16,
              borderBottomWidth: driveConnected ? 1 : 0,
              borderBottomColor: '#27272a',
            }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: driveConnected ? '#0f2318' : '#1a1a1e',
                justifyContent: 'center',
                alignItems: 'center',
              }}>
              <Icon
                name={driveConnected ? 'checkmark.circle.fill' : 'cloud'}
                size={22}
                tintColor={driveConnected ? '#4ade80' : '#52525b'}
              />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '600' }}>
                {driveConnected ? 'Connected' : 'Not Connected'}
              </Text>
              <Text style={{ color: '#71717a', fontSize: 12, marginTop: 2 }}>
                {driveConnected
                  ? 'Google Drive is linked to this app'
                  : 'Sign in to enable cloud backups'}
              </Text>
            </View>
          </View>

          {/* Sync All — only when connected */}
          {driveConnected && (
            <Pressable
              onPress={handleSyncAll}
              disabled={isSyncing}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                paddingVertical: 14,
                borderBottomWidth: 1,
                borderBottomColor: '#27272a',
                backgroundColor: pressed ? '#252529' : 'transparent',
              })}>
              {isSyncing ? (
                <>
                  <ActivityIndicator size="small" color="#818cf8" />
                  <Text style={{ color: '#818cf8', fontSize: 14, fontWeight: '600' }}>
                    {syncProgress || 'Syncing…'}
                  </Text>
                </>
              ) : (
                <>
                  <Icon name="square.and.arrow.up" size={16} tintColor="#818cf8" />
                  <Text style={{ color: '#818cf8', fontSize: 14, fontWeight: '600' }}>
                    Sync All Transcripts
                  </Text>
                </>
              )}
            </Pressable>
          )}

          {/* Sign in button (only when IDs configured and not yet connected) */}
          {PLATFORM_CONFIGURED && !driveConnected && (
            <GoogleConnectButton onConnected={() => setDriveConnected(true)} />
          )}

          {/* Sign out button */}
          {driveConnected && (
            <Pressable
              onPress={handleGoogleSignOut}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                paddingVertical: 14,
                backgroundColor: pressed ? '#252529' : 'transparent',
              })}>
              <Icon name="xmark.circle" size={16} tintColor="#ef4444" />
              <Text style={{ color: '#ef4444', fontSize: 14, fontWeight: '600' }}>
                Disconnect Google Drive
              </Text>
            </Pressable>
          )}
        </View>
      </View>

      {/* ── Whisper info ────────────────────────────────────── */}
      <View
        style={{
          backgroundColor: '#1c1c1e',
          borderRadius: 14,
          padding: 16,
          gap: 10,
          borderCurve: 'continuous' as any,
        }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Icon name="info.circle" size={16} tintColor="#818cf8" />
          <Text style={{ color: '#a1a1aa', fontSize: 14, fontWeight: '600' }}>
            About Whisper
          </Text>
        </View>
        <Text style={{ color: '#71717a', fontSize: 13, lineHeight: 20 }}>
          This app uses OpenAI's Whisper model (whisper-1) for transcription. Supported formats:
          MP3, MP4, M4A, WAV, WEBM, OGG, FLAC. Maximum file size: 25 MB.
        </Text>
        <Text style={{ color: '#52525b', fontSize: 13, lineHeight: 20 }}>
          Get an API key at platform.openai.com → API Keys.
        </Text>
      </View>

      {/* ── App info ────────────────────────────────────────── */}
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
