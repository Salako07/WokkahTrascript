import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { SymbolView } from 'expo-symbols';
import { WaveformAnimation } from '@/components/waveform-animation';
import { saveTranscript } from '@/services/transcript-storage';
import { transcribeAudio } from '@/services/whisper-service';
import type { Transcript } from '@/types';

function formatTime(secs: number) {
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  const s = secs % 60;
  if (h > 0)
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function RecordScreen() {
  const [isRecording, setIsRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [audioUri, setAudioUri] = useState<string | null>(null);
  const [finalDuration, setFinalDuration] = useState(0);
  const [transcription, setTranscription] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [saved, setSaved] = useState(false);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      recordingRef.current?.stopAndUnloadAsync().catch(() => {});
    };
  }, []);

  const startRecording = async () => {
    try {
      const { granted } = await Audio.requestPermissionsAsync();
      if (!granted) {
        Alert.alert(
          'Microphone Required',
          'Go to Settings → Expo Go → Microphone and enable access, then try again.'
        );
        return;
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: false,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        shouldDuckAndroid: true,
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
        playThroughEarpieceAndroid: false,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );

      recordingRef.current = recording;
      setIsRecording(true);
      setElapsed(0);
      setAudioUri(null);
      setTranscription(null);
      setSaved(false);

      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);

      if (Platform.OS === 'ios') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert('Could not start recording', msg);
    }
  };

  const stopRecording = async () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    try {
      const recording = recordingRef.current;
      if (!recording) return;

      await recording.stopAndUnloadAsync();

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        interruptionModeIOS: InterruptionModeIOS.DoNotMix,
        shouldDuckAndroid: true,
        interruptionModeAndroid: InterruptionModeAndroid.DoNotMix,
        playThroughEarpieceAndroid: false,
      });

      const uri = recording.getURI();
      recordingRef.current = null;
      setAudioUri(uri ?? null);
      setFinalDuration(elapsed);
      setIsRecording(false);

      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err: unknown) {
      setIsRecording(false);
      recordingRef.current = null;
      const msg = err instanceof Error ? err.message : String(err);
      Alert.alert('Could not stop recording', msg);
    }
  };

  const downloadAudio = async () => {
    if (!audioUri) return;
    const available = await Sharing.isAvailableAsync();
    if (available) {
      await Sharing.shareAsync(audioUri, {
        mimeType: 'audio/m4a',
        dialogTitle: 'Save Audio Recording',
      });
    } else {
      Alert.alert('Not Available', 'Sharing is not supported on this device.');
    }
  };

  const handleTranscribe = async () => {
    if (!audioUri) return;
    setIsTranscribing(true);
    try {
      const text = await transcribeAudio(audioUri, 'recording.m4a');
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
    if (!transcription) return;
    const transcript: Transcript = {
      id: `${Date.now()}`,
      title: `Recording — ${new Date().toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })}`,
      text: transcription,
      audioUri: audioUri ?? undefined,
      duration: finalDuration,
      createdAt: new Date().toISOString(),
      source: 'recording',
    };
    await saveTranscript(transcript);
    setSaved(true);
    if (Platform.OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
  };

  const resetSession = () => {
    setAudioUri(null);
    setTranscription(null);
    setSaved(false);
    setElapsed(0);
    setFinalDuration(0);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#111111' }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 20, gap: 16 }}>
      <Text style={{ color: '#ffffff', fontSize: 30, fontWeight: '700' }}>
        Record
      </Text>

      {/* Recorder card */}
      <View
        style={{
          backgroundColor: '#1c1c1e',
          borderRadius: 24,
          padding: 32,
          alignItems: 'center',
          gap: 24,
          borderCurve: 'continuous' as any,
        }}>
        <Text
          style={{
            color: isRecording ? '#ffffff' : '#71717a',
            fontSize: 60,
            fontWeight: '200',
            fontVariant: ['tabular-nums'],
            letterSpacing: -2,
          }}>
          {formatTime(isRecording ? elapsed : finalDuration)}
        </Text>

        <WaveformAnimation isActive={isRecording} />

        <Text style={{ color: '#52525b', fontSize: 13 }}>
          {isRecording
            ? 'Recording in progress…'
            : audioUri
              ? 'Recording complete'
              : 'Tap the button to start'}
        </Text>

        <Pressable
          onPress={isRecording ? stopRecording : startRecording}
          style={({ pressed }) => ({
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: isRecording ? '#ef4444' : '#6366f1',
            justifyContent: 'center',
            alignItems: 'center',
            opacity: pressed ? 0.82 : 1,
          })}>
          <SymbolView
            name={isRecording ? 'stop.fill' : 'mic.fill'}
            size={30}
            tintColor="#ffffff"
          />
        </Pressable>
      </View>

      {/* Audio available for download */}
      {audioUri && !isRecording && (
        <View
          style={{
            backgroundColor: '#1c1c1e',
            borderRadius: 16,
            padding: 16,
            gap: 12,
            borderCurve: 'continuous' as any,
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <View
              style={{
                width: 40,
                height: 40,
                borderRadius: 12,
                backgroundColor: '#1e1b4b',
                justifyContent: 'center',
                alignItems: 'center',
              }}>
              <SymbolView name="waveform" size={18} tintColor="#818cf8" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '600' }}>
                Audio Recording Saved
              </Text>
              <Text style={{ color: '#71717a', fontSize: 13 }}>
                {formatTime(finalDuration)} • M4A
              </Text>
            </View>
          </View>

          <Pressable
            onPress={downloadAudio}
            style={({ pressed }) => ({
              backgroundColor: pressed ? '#27272a' : '#252529',
              borderRadius: 12,
              paddingVertical: 12,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              borderCurve: 'continuous' as any,
            })}>
            <SymbolView name="arrow.down.circle" size={18} tintColor="#818cf8" />
            <Text style={{ color: '#818cf8', fontSize: 15, fontWeight: '600' }}>
              Download Audio
            </Text>
          </Pressable>
        </View>
      )}

      {/* Transcribe button */}
      {audioUri && !isRecording && !transcription && (
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
              <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>
                Transcribing…
              </Text>
            </>
          ) : (
            <>
              <SymbolView name="text.word.spacing" size={20} tintColor="#ffffff" />
              <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>
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
            <Text style={{ color: '#ffffff', fontSize: 16, fontWeight: '600' }}>
              Transcription
            </Text>
            <SymbolView name="checkmark.seal.fill" size={18} tintColor="#4ade80" />
          </View>

          <Text selectable style={{ color: '#d4d4d8', fontSize: 15, lineHeight: 26 }}>
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
              <SymbolView name="square.and.arrow.down" size={17} tintColor="#4ade80" />
              <Text style={{ color: '#4ade80', fontSize: 15, fontWeight: '600' }}>
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
              <SymbolView name="checkmark.circle.fill" size={17} tintColor="#4ade80" />
              <Text style={{ color: '#4ade80', fontSize: 14 }}>
                Saved to Transcripts
              </Text>
            </View>
          )}
        </View>
      )}

      {audioUri && !isRecording && (
        <Pressable
          onPress={resetSession}
          style={({ pressed }) => ({
            borderRadius: 14,
            paddingVertical: 14,
            alignItems: 'center',
            opacity: pressed ? 0.6 : 1,
          })}>
          <Text style={{ color: '#52525b', fontSize: 14 }}>
            Start a new recording
          </Text>
        </Pressable>
      )}
    </ScrollView>
  );
}
