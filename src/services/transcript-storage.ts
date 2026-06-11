import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Transcript } from '@/types';

const STORAGE_KEY = '@wokkah_transcripts';

export async function getTranscripts(): Promise<Transcript[]> {
  try {
    const json = await AsyncStorage.getItem(STORAGE_KEY);
    return json ? (JSON.parse(json) as Transcript[]) : [];
  } catch {
    return [];
  }
}

export async function saveTranscript(transcript: Transcript): Promise<void> {
  const existing = await getTranscripts();
  await AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([transcript, ...existing])
  );
}

export async function updateTranscript(transcript: Transcript): Promise<void> {
  const existing = await getTranscripts();
  await AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(existing.map((t) => (t.id === transcript.id ? transcript : t)))
  );
}

export async function deleteTranscript(id: string): Promise<void> {
  const existing = await getTranscripts();
  await AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(existing.filter((t) => t.id !== id))
  );
}
