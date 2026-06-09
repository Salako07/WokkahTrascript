import * as SecureStore from 'expo-secure-store';

const WHISPER_API_URL = 'https://api.openai.com/v1/audio/transcriptions';
const API_KEY_KEY = 'openai_api_key';

export async function getApiKey(): Promise<string | null> {
  return SecureStore.getItemAsync(API_KEY_KEY);
}

export async function saveApiKey(key: string): Promise<void> {
  await SecureStore.setItemAsync(API_KEY_KEY, key);
}

function getMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    mp3: 'audio/mpeg',
    mp4: 'video/mp4',
    m4a: 'audio/m4a',
    wav: 'audio/wav',
    webm: 'audio/webm',
    mpeg: 'audio/mpeg',
    mpga: 'audio/mpeg',
    ogg: 'audio/ogg',
    flac: 'audio/flac',
  };
  return map[ext ?? ''] ?? 'audio/m4a';
}

export async function transcribeAudio(
  audioUri: string,
  fileName: string = 'recording.m4a'
): Promise<string> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error(
      'No API key configured. Please add your OpenAI API key in Settings.'
    );
  }

  const formData = new FormData();
  formData.append('file', {
    uri: audioUri,
    type: getMimeType(fileName),
    name: fileName,
  } as unknown as Blob);
  formData.append('model', 'whisper-1');
  formData.append('response_format', 'text');

  const response = await fetch(WHISPER_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const body = await response.text();
    if (response.status === 401) {
      throw new Error('Invalid API key. Please check your key in Settings.');
    }
    if (response.status === 413) {
      throw new Error(
        'File too large. Whisper API supports files up to 25 MB.'
      );
    }
    throw new Error(`Transcription failed (${response.status}): ${body}`);
  }

  const text = await response.text();
  return text.trim();
}
