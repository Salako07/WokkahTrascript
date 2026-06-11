import * as SecureStore from 'expo-secure-store';
import type { Transcript } from '@/types';

const ACCESS_TOKEN_KEY = 'google_access_token';
const FOLDER_ID_KEY = 'google_drive_folder_id';
const FOLDER_NAME = 'WokkahTranscript';
const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';

// ── Token management ──────────────────────────────────────────

export async function saveGoogleToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, token);
}

export async function getGoogleToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function clearGoogleToken(): Promise<void> {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
  await SecureStore.deleteItemAsync(FOLDER_ID_KEY);
}

export async function isGoogleConnected(): Promise<boolean> {
  return !!(await getGoogleToken());
}

// ── Folder management ─────────────────────────────────────────

async function findFolder(token: string): Promise<string | null> {
  const q = encodeURIComponent(
    `name='${FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`
  );
  const res = await fetch(`${DRIVE_API}/files?q=${q}&fields=files(id)`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 401) throw new Error('TOKEN_EXPIRED');
  if (!res.ok) return null;
  const json = await res.json();
  return json.files?.[0]?.id ?? null;
}

async function createFolder(token: string): Promise<string> {
  const res = await fetch(`${DRIVE_API}/files`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: FOLDER_NAME,
      mimeType: 'application/vnd.google-apps.folder',
    }),
  });
  if (res.status === 401) throw new Error('TOKEN_EXPIRED');
  if (!res.ok) throw new Error('Failed to create Drive folder');
  const json = await res.json();
  return json.id;
}

async function getOrCreateFolder(token: string): Promise<string> {
  const cached = await SecureStore.getItemAsync(FOLDER_ID_KEY);
  if (cached) return cached;
  let id = await findFolder(token);
  if (!id) id = await createFolder(token);
  await SecureStore.setItemAsync(FOLDER_ID_KEY, id);
  return id;
}

// ── Upload helpers ────────────────────────────────────────────

async function uploadText(
  name: string,
  content: string,
  token: string,
  folderId: string
): Promise<void> {
  const boundary = 'WokkahBoundary';
  const metadata = JSON.stringify({ name, parents: [folderId], mimeType: 'text/plain' });
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n` +
    `--${boundary}\r\nContent-Type: text/plain; charset=UTF-8\r\n\r\n${content}\r\n` +
    `--${boundary}--`;

  const res = await fetch(`${UPLOAD_API}/files?uploadType=multipart`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body,
  });
  if (res.status === 401) throw new Error('TOKEN_EXPIRED');
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Drive upload failed: ${err}`);
  }
}

function buildSummaryText(transcript: Transcript): string {
  const s = transcript.summary!;
  let content = `Meeting Summary\n${transcript.title}\n${'─'.repeat(40)}\n\nOVERVIEW\n${s.overview}\n`;
  if (s.keyPoints.length) content += `\nKEY POINTS\n${s.keyPoints.map((p) => `• ${p}`).join('\n')}\n`;
  if (s.decisions.length) content += `\nDECISIONS\n${s.decisions.map((d) => `• ${d}`).join('\n')}\n`;
  if (s.nextSteps.length) content += `\nNEXT STEPS\n${s.nextSteps.map((n) => `• ${n}`).join('\n')}\n`;
  return content;
}

function buildTasksText(transcript: Transcript): string {
  const tasks = transcript.tasks!;
  const pending = tasks.filter((t) => !t.done);
  const done = tasks.filter((t) => t.done);
  let content = `Tasks & Deliverables\n${transcript.title}\n${'─'.repeat(40)}\n\n`;
  if (pending.length) {
    content += 'PENDING\n';
    pending.forEach((t) => { content += `[ ] ${t.text}${t.assignee ? `  →  ${t.assignee}` : ''}\n`; });
  }
  if (done.length) {
    if (pending.length) content += '\n';
    content += 'COMPLETED\n';
    done.forEach((t) => { content += `[x] ${t.text}${t.assignee ? `  →  ${t.assignee}` : ''}\n`; });
  }
  return content;
}

// ── Public API ────────────────────────────────────────────────

export async function uploadTranscriptBundle(transcript: Transcript): Promise<number> {
  const token = await getGoogleToken();
  if (!token) throw new Error('Not connected to Google Drive. Please sign in from Settings.');

  const folderId = await getOrCreateFolder(token);
  const safe = transcript.title.replace(/[^a-z0-9]/gi, '_');
  let count = 0;

  await uploadText(`${safe}_transcript.txt`, transcript.text, token, folderId);
  count++;

  if (transcript.summary) {
    await uploadText(`${safe}_summary.txt`, buildSummaryText(transcript), token, folderId);
    count++;
  }

  if (transcript.tasks?.length) {
    await uploadText(`${safe}_tasks.txt`, buildTasksText(transcript), token, folderId);
    count++;
  }

  return count;
}

export async function uploadAllTranscripts(
  transcripts: Transcript[],
  onProgress?: (done: number, total: number) => void
): Promise<number> {
  let uploaded = 0;
  for (let i = 0; i < transcripts.length; i++) {
    await uploadTranscriptBundle(transcripts[i]);
    uploaded++;
    onProgress?.(uploaded, transcripts.length);
  }
  return uploaded;
}
