import * as SecureStore from 'expo-secure-store';
import type { Summary, Task } from '@/types';

const WHISPER_API_URL = 'https://api.openai.com/v1/audio/transcriptions';
const CHAT_API_URL = 'https://api.openai.com/v1/chat/completions';
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

export async function extractTasks(transcriptText: string): Promise<Task[]> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error(
      'No API key configured. Please add your OpenAI API key in Settings.'
    );
  }

  const response = await fetch(CHAT_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You extract action items, tasks, and deliverables from meeting transcripts. ' +
            'Return a JSON object with a "tasks" array. Each task must have: ' +
            '"text" (clear description of what needs to be done) and ' +
            '"assignee" (the person responsible, or null if not mentioned). ' +
            'Only include concrete tasks with a clear action — skip vague statements. ' +
            'Keep task text concise (under 120 characters).',
        },
        {
          role: 'user',
          content: `Extract tasks from this meeting transcript:\n\n${transcriptText}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    if (response.status === 401) {
      throw new Error('Invalid API key. Please check your key in Settings.');
    }
    throw new Error(`Task extraction failed (${response.status}): ${body}`);
  }

  const json = await response.json();
  const content = json.choices?.[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(content) as { tasks?: { text: string; assignee?: string | null }[] };

  return (parsed.tasks ?? []).map((t, i) => ({
    id: `${Date.now()}_${i}`,
    text: t.text,
    assignee: t.assignee ?? undefined,
    done: false,
  }));
}

export async function generateSummary(transcriptText: string): Promise<Summary> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    throw new Error(
      'No API key configured. Please add your OpenAI API key in Settings.'
    );
  }

  const response = await fetch(CHAT_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content:
            'You summarize meeting transcripts. Return a JSON object with exactly these keys: ' +
            '"overview" (2-3 sentence summary of the meeting purpose and outcome), ' +
            '"keyPoints" (array of 3-6 main topics discussed, each under 100 characters), ' +
            '"decisions" (array of concrete decisions or agreements reached — may be empty), ' +
            '"nextSteps" (array of high-level follow-up actions mentioned — may be empty). ' +
            'Be concise and factual. Avoid padding.',
        },
        {
          role: 'user',
          content: `Summarize this meeting transcript:\n\n${transcriptText}`,
        },
      ],
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    if (response.status === 401) {
      throw new Error('Invalid API key. Please check your key in Settings.');
    }
    throw new Error(`Summary generation failed (${response.status}): ${body}`);
  }

  const json = await response.json();
  const content = json.choices?.[0]?.message?.content ?? '{}';
  const parsed = JSON.parse(content) as Partial<Summary>;

  return {
    overview: parsed.overview ?? '',
    keyPoints: parsed.keyPoints ?? [],
    decisions: parsed.decisions ?? [],
    nextSteps: parsed.nextSteps ?? [],
  };
}
