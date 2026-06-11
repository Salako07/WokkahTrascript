import React, { useCallback, useState } from 'react';
import {
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
  Alert,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Icon } from '@/components/icon';
import { TranscriptCard } from '@/components/transcript-card';
import { deleteTranscript, getTranscripts } from '@/services/transcript-storage';
import type { Transcript } from '@/types';

export default function HomeScreen() {
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [search, setSearch] = useState('');

  useFocusEffect(
    useCallback(() => {
      getTranscripts().then(setTranscripts);
    }, [])
  );

  const handleDelete = (id: string) => {
    Alert.alert('Delete Transcript', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteTranscript(id);
          const updated = await getTranscripts();
          setTranscripts(updated);
        },
      },
    ]);
  };

  const filtered = search
    ? transcripts.filter(
        (t) =>
          t.title.toLowerCase().includes(search.toLowerCase()) ||
          t.text.toLowerCase().includes(search.toLowerCase())
      )
    : transcripts;

  return (
    <View style={{ flex: 1, backgroundColor: '#111111' }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingTop: 16,
          paddingBottom: 8,
        }}>
        <Text style={{ color: '#ffffff', fontSize: 30, fontWeight: '700' }}>
          Transcripts
        </Text>
        <Pressable
          onPress={() => router.push('/settings')}
          style={{ padding: 4 }}>
          <Icon name="gearshape.fill" size={22} tintColor="#52525b" />
        </Pressable>
      </View>

      <View
        style={{
          marginHorizontal: 20,
          marginBottom: 14,
          backgroundColor: '#1c1c1e',
          borderRadius: 12,
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 12,
        }}>
        <Icon name="magnifyingglass" size={15} tintColor="#52525b" />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search transcripts..."
          placeholderTextColor="#52525b"
          style={{
            flex: 1,
            color: '#ffffff',
            paddingVertical: 11,
            paddingLeft: 8,
            fontSize: 15,
          }}
        />
        {search.length > 0 && (
          <Pressable onPress={() => setSearch('')}>
            <Icon name="xmark.circle.fill" size={16} tintColor="#52525b" />
          </Pressable>
        )}
      </View>

      {filtered.length === 0 ? (
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            gap: 12,
            paddingBottom: 80,
          }}>
          <Icon name="doc.text" size={54} tintColor="#3f3f46" />
          <Text style={{ color: '#71717a', fontSize: 17 }}>
            {search ? 'No results found' : 'No transcripts yet'}
          </Text>
          {!search && (
            <Text
              style={{
                color: '#52525b',
                fontSize: 14,
                textAlign: 'center',
                paddingHorizontal: 48,
                lineHeight: 20,
              }}>
              Record a meeting or upload an audio file to get started
            </Text>
          )}
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={{ padding: 20, paddingTop: 4, gap: 12 }}
          renderItem={({ item }) => (
            <TranscriptCard
              transcript={item}
            />
          )}
        />
      )}
    </View>
  );
}
