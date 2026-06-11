import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Icon } from '@/components/icon';
import type { Transcript } from '@/types';

function formatDuration(seconds: number): string {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function TranscriptCard({
  transcript,
}: {
  transcript: Transcript;
}) {
  const isRecording = transcript.source === 'recording';

  return (
    <Pressable
      onPress={() => router.push(`/transcript/${transcript.id}`)}
      style={({ pressed }) => ({
        backgroundColor: pressed ? '#27272a' : '#1c1c1e',
        borderRadius: 16,
        padding: 16,
        gap: 8,
        borderCurve: 'continuous' as any,
      })}>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 10,
        }}>
        <Text
          style={{
            color: '#ffffff',
            fontSize: 16,
            fontWeight: '600',
            flex: 1,
            lineHeight: 22,
          }}
          numberOfLines={2}>
          {transcript.title}
        </Text>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
            backgroundColor: isRecording ? '#1e1b4b' : '#0f2318',
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 8,
          }}>
          <Icon
            name={isRecording ? 'mic.fill' : 'arrow.up.doc.fill'}
            size={11}
            tintColor={isRecording ? '#818cf8' : '#4ade80'}
          />
          <Text
            style={{
              color: isRecording ? '#818cf8' : '#4ade80',
              fontSize: 11,
              fontWeight: '600',
            }}>
            {isRecording ? 'Recorded' : 'Upload'}
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <Text style={{ color: '#71717a', fontSize: 13 }}>
          {formatDate(transcript.createdAt)}
        </Text>
        {transcript.duration > 0 && (
          <Text style={{ color: '#52525b', fontSize: 13 }}>•</Text>
        )}
        {transcript.duration > 0 && (
          <Text style={{ color: '#71717a', fontSize: 13 }}>
            {formatDuration(transcript.duration)}
          </Text>
        )}
      </View>

      <Text style={{ color: '#a1a1aa', fontSize: 14, lineHeight: 20 }} numberOfLines={2}>
        {transcript.text}
      </Text>
    </Pressable>
  );
}
