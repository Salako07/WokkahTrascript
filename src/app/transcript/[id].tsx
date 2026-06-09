import React, { useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { SymbolView } from 'expo-symbols';
import { deleteTranscript, getTranscripts } from '@/services/transcript-storage';
import type { Transcript } from '@/types';

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function TranscriptDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    getTranscripts().then((all) => {
      setTranscript(all.find((t) => t.id === id) ?? null);
    });
  }, [id]);

  const downloadText = async () => {
    if (!transcript) return;
    try {
      const safeTitle = transcript.title.replace(/[^a-z0-9]/gi, '_');
      const path = `${FileSystem.documentDirectory}${safeTitle}.txt`;
      await FileSystem.writeAsStringAsync(path, transcript.text, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(path, {
          mimeType: 'text/plain',
          dialogTitle: 'Save Transcript',
          UTI: 'public.plain-text',
        });
      }
    } catch {
      Alert.alert('Error', 'Could not download transcript file.');
    }
  };

  const downloadAudio = async () => {
    if (!transcript?.audioUri) return;
    const available = await Sharing.isAvailableAsync();
    if (available) {
      await Sharing.shareAsync(transcript.audioUri, {
        mimeType: 'audio/m4a',
        dialogTitle: 'Save Audio Recording',
      });
    } else {
      Alert.alert('Not Available', 'Sharing is not supported on this device.');
    }
  };

  const copyText = async () => {
    if (!transcript) return;
    await Clipboard.setStringAsync(transcript.text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Transcript',
      'This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!transcript) return;
            await deleteTranscript(transcript.id);
            router.back();
          },
        },
      ]
    );
  };

  if (!transcript) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: '#111111',
          justifyContent: 'center',
          alignItems: 'center',
        }}>
        <Text style={{ color: '#52525b', fontSize: 15 }}>
          Transcript not found
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#111111' }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 20, gap: 16 }}>
      {/* Title + meta */}
      <View style={{ gap: 6 }}>
        <Text
          selectable
          style={{ color: '#ffffff', fontSize: 22, fontWeight: '700', lineHeight: 28 }}>
          {transcript.title}
        </Text>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <Text style={{ color: '#52525b', fontSize: 13 }}>
            {formatDate(transcript.createdAt)}
          </Text>
          {transcript.duration > 0 && (
            <>
              <Text style={{ color: '#3f3f46', fontSize: 13 }}>·</Text>
              <Text style={{ color: '#52525b', fontSize: 13 }}>
                {formatDuration(transcript.duration)}
              </Text>
            </>
          )}
        </View>
      </View>

      {/* Action row */}
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable
          onPress={downloadText}
          style={({ pressed }) => ({
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            backgroundColor: pressed ? '#27272a' : '#1c1c1e',
            borderRadius: 12,
            paddingVertical: 12,
            borderCurve: 'continuous' as any,
          })}>
          <SymbolView name="arrow.down.doc" size={16} tintColor="#818cf8" />
          <Text style={{ color: '#818cf8', fontSize: 14, fontWeight: '600' }}>
            .txt
          </Text>
        </Pressable>

        <Pressable
          onPress={copyText}
          style={({ pressed }) => ({
            flex: 1,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
            backgroundColor: pressed ? '#27272a' : '#1c1c1e',
            borderRadius: 12,
            paddingVertical: 12,
            borderCurve: 'continuous' as any,
          })}>
          <SymbolView
            name={copied ? 'checkmark' : 'doc.on.doc'}
            size={16}
            tintColor={copied ? '#4ade80' : '#a1a1aa'}
          />
          <Text
            style={{
              color: copied ? '#4ade80' : '#a1a1aa',
              fontSize: 14,
              fontWeight: '600',
            }}>
            {copied ? 'Copied!' : 'Copy'}
          </Text>
        </Pressable>
      </View>

      {/* Audio download row (recording only) */}
      {transcript.audioUri && (
        <Pressable
          onPress={downloadAudio}
          style={({ pressed }) => ({
            backgroundColor: pressed ? '#1e1b4b' : '#16163a',
            borderRadius: 14,
            padding: 14,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            borderCurve: 'continuous' as any,
            borderWidth: 1,
            borderColor: '#2e2b5a',
          })}>
          <SymbolView
            name="waveform.circle.fill"
            size={28}
            tintColor="#818cf8"
          />
          <View style={{ flex: 1 }}>
            <Text
              style={{ color: '#ffffff', fontSize: 14, fontWeight: '600' }}>
              Audio Recording
            </Text>
            <Text style={{ color: '#71717a', fontSize: 12, marginTop: 2 }}>
              Tap to download or share
            </Text>
          </View>
          <SymbolView name="arrow.down.circle" size={20} tintColor="#818cf8" />
        </Pressable>
      )}

      {/* Transcript text */}
      <View
        style={{
          backgroundColor: '#1c1c1e',
          borderRadius: 16,
          padding: 18,
          borderCurve: 'continuous' as any,
        }}>
        <Text selectable style={{ color: '#d4d4d8', fontSize: 15, lineHeight: 26 }}>
          {transcript.text}
        </Text>
      </View>

      {/* Delete */}
      <Pressable
        onPress={handleDelete}
        style={({ pressed }) => ({
          backgroundColor: pressed ? '#2d0a0a' : '#1c0a0a',
          borderRadius: 14,
          paddingVertical: 14,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          borderCurve: 'continuous' as any,
          borderWidth: 1,
          borderColor: '#3d1515',
        })}>
        <SymbolView name="trash" size={16} tintColor="#ef4444" />
        <Text style={{ color: '#ef4444', fontSize: 14, fontWeight: '600' }}>
          Delete Transcript
        </Text>
      </Pressable>
    </ScrollView>
  );
}
