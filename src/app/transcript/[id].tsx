import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import * as FileSystem from 'expo-file-system/legacy';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { Icon } from '@/components/icon';
import { deleteTranscript, getTranscripts, updateTranscript } from '@/services/transcript-storage';
import {
  clearGoogleToken,
  isGoogleConnected,
  uploadTranscriptBundle,
} from '@/services/google-drive-service';
import { extractTasks, generateSummary } from '@/services/whisper-service';
import type { Summary, Task, Transcript } from '@/types';

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

function SummarySection({
  title,
  items,
  color,
}: {
  title: string;
  items: string[];
  color: string;
}) {
  return (
    <View
      style={{
        paddingHorizontal: 16,
        paddingBottom: 12,
        borderTopWidth: 1,
        borderTopColor: '#27272a',
        paddingTop: 10,
        gap: 6,
      }}>
      <Text style={{ color: '#52525b', fontSize: 11, fontWeight: '600', letterSpacing: 0.5 }}>
        {title}
      </Text>
      {items.map((item, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-start' }}>
          <Text style={{ color, fontSize: 13, lineHeight: 20, marginTop: 1 }}>•</Text>
          <Text style={{ color: '#d4d4d8', fontSize: 13, lineHeight: 20, flex: 1 }}>
            {item}
          </Text>
        </View>
      ))}
    </View>
  );
}

export default function TranscriptDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [transcript, setTranscript] = useState<Transcript | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [copied, setCopied] = useState(false);
  const [isExtracting, setIsExtracting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [driveConnected, setDriveConnected] = useState(false);
  const [isSavingToDrive, setIsSavingToDrive] = useState(false);
  const [driveSaved, setDriveSaved] = useState(false);

  useEffect(() => {
    getTranscripts().then((all) => {
      const found = all.find((t) => t.id === id) ?? null;
      setTranscript(found);
      if (found?.tasks) setTasks(found.tasks);
      if (found?.summary) setSummary(found.summary);
    });
    isGoogleConnected().then(setDriveConnected);
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

  const handleGenerateSummary = async () => {
    if (!transcript) return;
    setIsGenerating(true);
    try {
      const result = await generateSummary(transcript.text);
      setSummary(result);
      const updated = { ...transcript, summary: result };
      setTranscript(updated);
      await updateTranscript(updated);
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err: unknown) {
      Alert.alert(
        'Summary Failed',
        err instanceof Error ? err.message : 'An unexpected error occurred.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const downloadSummary = async () => {
    if (!transcript || !summary) return;
    try {
      const date = new Date().toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      });
      const hr = '─'.repeat(40);
      let content = `Meeting Summary\n${transcript.title}\nGenerated: ${date}\n${hr}\n\n`;

      content += `OVERVIEW\n${summary.overview}\n`;

      if (summary.keyPoints.length > 0) {
        content += `\nKEY POINTS\n`;
        summary.keyPoints.forEach((p) => { content += `• ${p}\n`; });
      }
      if (summary.decisions.length > 0) {
        content += `\nDECISIONS\n`;
        summary.decisions.forEach((d) => { content += `• ${d}\n`; });
      }
      if (summary.nextSteps.length > 0) {
        content += `\nNEXT STEPS\n`;
        summary.nextSteps.forEach((s) => { content += `• ${s}\n`; });
      }

      const safeTitle = transcript.title.replace(/[^a-z0-9]/gi, '_');
      const path = `${FileSystem.documentDirectory}${safeTitle}_summary.txt`;
      await FileSystem.writeAsStringAsync(path, content, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(path, {
          mimeType: 'text/plain',
          dialogTitle: 'Save Summary',
          UTI: 'public.plain-text',
        });
      }
    } catch {
      Alert.alert('Error', 'Could not download summary file.');
    }
  };

  const handleExtractTasks = async () => {
    if (!transcript) return;
    setIsExtracting(true);
    try {
      const extracted = await extractTasks(transcript.text);
      if (extracted.length === 0) {
        Alert.alert('No Tasks Found', 'No clear action items were identified in this transcript.');
        return;
      }
      setTasks(extracted);
      const updated = { ...transcript, tasks: extracted };
      setTranscript(updated);
      await updateTranscript(updated);
      if (Platform.OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err: unknown) {
      Alert.alert(
        'Extraction Failed',
        err instanceof Error ? err.message : 'An unexpected error occurred.'
      );
    } finally {
      setIsExtracting(false);
    }
  };

  const toggleTask = async (taskId: string) => {
    if (!transcript) return;
    const updated = tasks.map((t) => (t.id === taskId ? { ...t, done: !t.done } : t));
    setTasks(updated);
    const updatedTranscript = { ...transcript, tasks: updated };
    setTranscript(updatedTranscript);
    await updateTranscript(updatedTranscript);
    if (Platform.OS === 'ios') {
      Haptics.selectionAsync();
    }
  };

  const downloadTasks = async () => {
    if (!transcript || tasks.length === 0) return;
    try {
      const pending = tasks.filter((t) => !t.done);
      const done = tasks.filter((t) => t.done);
      const date = new Date().toLocaleDateString('en-US', {
        month: 'short', day: 'numeric', year: 'numeric',
      });

      let content = `Tasks & Deliverables\n${transcript.title}\nExtracted: ${date}\n`;
      content += '─'.repeat(40) + '\n\n';

      if (pending.length > 0) {
        content += 'PENDING\n';
        pending.forEach((t) => {
          content += `[ ] ${t.text}`;
          if (t.assignee) content += `  →  ${t.assignee}`;
          content += '\n';
        });
      }

      if (done.length > 0) {
        if (pending.length > 0) content += '\n';
        content += 'COMPLETED\n';
        done.forEach((t) => {
          content += `[x] ${t.text}`;
          if (t.assignee) content += `  →  ${t.assignee}`;
          content += '\n';
        });
      }

      content += `\n─${'─'.repeat(39)}\n`;
      content += `${tasks.length} task${tasks.length !== 1 ? 's' : ''} total`;
      if (done.length > 0) content += ` · ${done.length} completed`;

      const safeTitle = transcript.title.replace(/[^a-z0-9]/gi, '_');
      const path = `${FileSystem.documentDirectory}${safeTitle}_tasks.txt`;
      await FileSystem.writeAsStringAsync(path, content, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const available = await Sharing.isAvailableAsync();
      if (available) {
        await Sharing.shareAsync(path, {
          mimeType: 'text/plain',
          dialogTitle: 'Save Tasks',
          UTI: 'public.plain-text',
        });
      }
    } catch {
      Alert.alert('Error', 'Could not download tasks file.');
    }
  };

  const handleSaveToDrive = async () => {
    if (!transcript) return;
    if (!driveConnected) {
      Alert.alert('Not Connected', 'Sign in to Google Drive from the Settings screen first.');
      return;
    }
    setIsSavingToDrive(true);
    try {
      const count = await uploadTranscriptBundle(transcript);
      setDriveSaved(true);
      Alert.alert(
        'Saved to Drive',
        `${count} file${count !== 1 ? 's' : ''} uploaded to your WokkahTranscript folder.`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      if (msg === 'TOKEN_EXPIRED') {
        await clearGoogleToken();
        setDriveConnected(false);
        Alert.alert('Session Expired', 'Your Google session has expired. Please reconnect in Settings.');
      } else {
        Alert.alert('Upload Failed', msg);
      }
    } finally {
      setIsSavingToDrive(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Transcript', 'This action cannot be undone.', [
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
    ]);
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
        <Text style={{ color: '#52525b', fontSize: 15 }}>Transcript not found</Text>
      </View>
    );
  }

  const pendingTasks = tasks.filter((t) => !t.done);
  const doneTasks = tasks.filter((t) => t.done);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: '#111111' }}
      contentInsetAdjustmentBehavior="automatic"
      contentContainerStyle={{ padding: 20, gap: 16 }}>

      {/* Title + meta */}
      <View style={{ gap: 6 }}>
        <Text selectable style={{ color: '#ffffff', fontSize: 22, fontWeight: '700', lineHeight: 28 }}>
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
          <Icon name="arrow.down.doc" size={16} tintColor="#818cf8" />
          <Text style={{ color: '#818cf8', fontSize: 14, fontWeight: '600' }}>.txt</Text>
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
          <Icon name={copied ? 'checkmark' : 'doc.on.doc'} size={16} tintColor={copied ? '#4ade80' : '#a1a1aa'} />
          <Text style={{ color: copied ? '#4ade80' : '#a1a1aa', fontSize: 14, fontWeight: '600' }}>
            {copied ? 'Copied!' : 'Copy'}
          </Text>
        </Pressable>
      </View>

      {/* Audio download row */}
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
          <Icon name="waveform.circle.fill" size={28} tintColor="#818cf8" />
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '600' }}>
              Audio Recording
            </Text>
            <Text style={{ color: '#71717a', fontSize: 12, marginTop: 2 }}>
              Tap to download or share
            </Text>
          </View>
          <Icon name="arrow.down.circle" size={20} tintColor="#818cf8" />
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

      {/* ── Summary section ───────────────────────────────── */}
      {!summary ? (
        <Pressable
          onPress={handleGenerateSummary}
          disabled={isGenerating}
          style={({ pressed }) => ({
            backgroundColor: isGenerating || pressed ? '#1a1a2e' : '#12122a',
            borderRadius: 16,
            paddingVertical: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            borderCurve: 'continuous' as any,
            borderWidth: 1,
            borderColor: '#2e2b5a',
          })}>
          {isGenerating ? (
            <>
              <ActivityIndicator color="#a78bfa" />
              <Text style={{ color: '#a78bfa', fontSize: 15, fontWeight: '600' }}>
                Generating summary…
              </Text>
            </>
          ) : (
            <>
              <Icon name="text.word.spacing" size={18} tintColor="#a78bfa" />
              <Text style={{ color: '#a78bfa', fontSize: 15, fontWeight: '600' }}>
                Generate Meeting Summary
              </Text>
            </>
          )}
        </Pressable>
      ) : (
        <View
          style={{
            backgroundColor: '#1c1c1e',
            borderRadius: 16,
            overflow: 'hidden',
            borderCurve: 'continuous' as any,
          }}>
          {/* Summary header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 16,
              paddingTop: 14,
              paddingBottom: 10,
              borderBottomWidth: 1,
              borderBottomColor: '#27272a',
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="text.word.spacing" size={16} tintColor="#a78bfa" />
              <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '600' }}>
                Summary
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable onPress={handleGenerateSummary} disabled={isGenerating} hitSlop={8}>
                {isGenerating ? (
                  <ActivityIndicator size="small" color="#52525b" />
                ) : (
                  <Icon name="arrow.clockwise" size={16} tintColor="#52525b" />
                )}
              </Pressable>
              <Pressable onPress={downloadSummary} hitSlop={8}>
                <Icon name="arrow.down.circle" size={16} tintColor="#a78bfa" />
              </Pressable>
            </View>
          </View>

          {/* Overview */}
          <View style={{ paddingHorizontal: 16, paddingTop: 14, paddingBottom: 10 }}>
            <Text style={{ color: '#d4d4d8', fontSize: 14, lineHeight: 22 }}>
              {summary.overview}
            </Text>
          </View>

          {/* Key Points */}
          {summary.keyPoints.length > 0 && (
            <SummarySection title="KEY POINTS" items={summary.keyPoints} color="#a78bfa" />
          )}

          {/* Decisions */}
          {summary.decisions.length > 0 && (
            <SummarySection title="DECISIONS" items={summary.decisions} color="#4ade80" />
          )}

          {/* Next Steps */}
          {summary.nextSteps.length > 0 && (
            <SummarySection title="NEXT STEPS" items={summary.nextSteps} color="#fb923c" />
          )}

          {/* Download row */}
          <Pressable
            onPress={downloadSummary}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingVertical: 13,
              borderTopWidth: 1,
              borderTopColor: '#27272a',
              backgroundColor: pressed ? '#252529' : 'transparent',
            })}>
            <Icon name="arrow.down.doc" size={15} tintColor="#a78bfa" />
            <Text style={{ color: '#a78bfa', fontSize: 14, fontWeight: '600' }}>
              Download Summary
            </Text>
          </Pressable>
        </View>
      )}

      {/* ── Tasks section ─────────────────────────────────── */}
      {tasks.length === 0 ? (
        <Pressable
          onPress={handleExtractTasks}
          disabled={isExtracting}
          style={({ pressed }) => ({
            backgroundColor: isExtracting || pressed ? '#1e1b4b' : '#16163a',
            borderRadius: 16,
            paddingVertical: 16,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 10,
            borderCurve: 'continuous' as any,
            borderWidth: 1,
            borderColor: '#2e2b5a',
          })}>
          {isExtracting ? (
            <>
              <ActivityIndicator color="#818cf8" />
              <Text style={{ color: '#818cf8', fontSize: 15, fontWeight: '600' }}>
                Extracting tasks…
              </Text>
            </>
          ) : (
            <>
              <Icon name="list.bullet" size={18} tintColor="#818cf8" />
              <Text style={{ color: '#818cf8', fontSize: 15, fontWeight: '600' }}>
                Extract Tasks & Deliverables
              </Text>
            </>
          )}
        </Pressable>
      ) : (
        <View
          style={{
            backgroundColor: '#1c1c1e',
            borderRadius: 16,
            overflow: 'hidden',
            borderCurve: 'continuous' as any,
          }}>
          {/* Tasks header */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 16,
              paddingTop: 14,
              paddingBottom: 10,
              borderBottomWidth: 1,
              borderBottomColor: '#27272a',
            }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Icon name="list.bullet" size={16} tintColor="#818cf8" />
              <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '600' }}>
                Tasks
              </Text>
              <View
                style={{
                  backgroundColor: '#27272a',
                  borderRadius: 10,
                  paddingHorizontal: 7,
                  paddingVertical: 2,
                }}>
                <Text style={{ color: '#a1a1aa', fontSize: 12, fontWeight: '600' }}>
                  {doneTasks.length}/{tasks.length}
                </Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Pressable
                onPress={handleExtractTasks}
                disabled={isExtracting}
                hitSlop={8}>
                {isExtracting ? (
                  <ActivityIndicator size="small" color="#52525b" />
                ) : (
                  <Icon name="arrow.clockwise" size={16} tintColor="#52525b" />
                )}
              </Pressable>
              <Pressable onPress={downloadTasks} hitSlop={8}>
                <Icon name="arrow.down.circle" size={16} tintColor="#818cf8" />
              </Pressable>
            </View>
          </View>

          {/* Pending tasks */}
          {pendingTasks.map((task, i) => (
            <Pressable
              key={task.id}
              onPress={() => toggleTask(task.id)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                alignItems: 'flex-start',
                gap: 12,
                paddingHorizontal: 16,
                paddingVertical: 12,
                backgroundColor: pressed ? '#252529' : 'transparent',
                borderTopWidth: i === 0 ? 0 : 1,
                borderTopColor: '#27272a',
              })}>
              <View style={{ paddingTop: 1 }}>
                <Icon name="circle" size={20} tintColor="#52525b" />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: '#d4d4d8', fontSize: 14, lineHeight: 20 }}>
                  {task.text}
                </Text>
                {task.assignee && (
                  <Text style={{ color: '#818cf8', fontSize: 12, fontWeight: '500' }}>
                    @{task.assignee}
                  </Text>
                )}
              </View>
            </Pressable>
          ))}

          {/* Completed tasks */}
          {doneTasks.length > 0 && (
            <>
              <View
                style={{
                  paddingHorizontal: 16,
                  paddingTop: 10,
                  paddingBottom: 6,
                  borderTopWidth: pendingTasks.length > 0 ? 1 : 0,
                  borderTopColor: '#27272a',
                }}>
                <Text style={{ color: '#52525b', fontSize: 11, fontWeight: '600', letterSpacing: 0.5 }}>
                  COMPLETED
                </Text>
              </View>
              {doneTasks.map((task, i) => (
                <Pressable
                  key={task.id}
                  onPress={() => toggleTask(task.id)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: 12,
                    paddingHorizontal: 16,
                    paddingVertical: 12,
                    backgroundColor: pressed ? '#252529' : 'transparent',
                    borderTopWidth: i === 0 ? 0 : 1,
                    borderTopColor: '#27272a',
                  })}>
                  <View style={{ paddingTop: 1 }}>
                    <Icon name="checkmark.circle.fill" size={20} tintColor="#4ade80" />
                  </View>
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text
                      style={{
                        color: '#52525b',
                        fontSize: 14,
                        lineHeight: 20,
                        textDecorationLine: 'line-through',
                      }}>
                      {task.text}
                    </Text>
                    {task.assignee && (
                      <Text style={{ color: '#3f3f46', fontSize: 12, fontWeight: '500' }}>
                        @{task.assignee}
                      </Text>
                    )}
                  </View>
                </Pressable>
              ))}
            </>
          )}

          {/* Download row */}
          <Pressable
            onPress={downloadTasks}
            style={({ pressed }) => ({
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              paddingVertical: 13,
              borderTopWidth: 1,
              borderTopColor: '#27272a',
              backgroundColor: pressed ? '#252529' : 'transparent',
            })}>
            <Icon name="arrow.down.doc" size={15} tintColor="#818cf8" />
            <Text style={{ color: '#818cf8', fontSize: 14, fontWeight: '600' }}>
              Download Task List
            </Text>
          </Pressable>
        </View>
      )}

      {/* ── Google Drive ───────────────────────────────────── */}
      <Pressable
        onPress={driveConnected ? handleSaveToDrive : undefined}
        disabled={isSavingToDrive}
        style={({ pressed }) => ({
          backgroundColor: driveSaved
            ? '#0f2318'
            : driveConnected
              ? pressed ? '#1e1b4b' : '#16163a'
              : '#18181b',
          borderRadius: 14,
          padding: 16,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          borderCurve: 'continuous' as any,
          borderWidth: 1,
          borderColor: driveSaved ? '#166534' : driveConnected ? '#2e2b5a' : '#27272a',
          opacity: !driveConnected ? 0.6 : 1,
        })}>
        <View
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: driveSaved ? '#14532d' : driveConnected ? '#1e1b4b' : '#27272a',
            justifyContent: 'center',
            alignItems: 'center',
          }}>
          {isSavingToDrive ? (
            <ActivityIndicator size="small" color="#818cf8" />
          ) : (
            <Icon
              name={driveSaved ? 'checkmark.circle.fill' : 'square.and.arrow.up'}
              size={20}
              tintColor={driveSaved ? '#4ade80' : driveConnected ? '#818cf8' : '#52525b'}
            />
          )}
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: '#ffffff', fontSize: 15, fontWeight: '600' }}>
            {isSavingToDrive
              ? 'Uploading…'
              : driveSaved
                ? 'Saved to Google Drive'
                : driveConnected
                  ? 'Save to Google Drive'
                  : 'Google Drive'}
          </Text>
          <Text style={{ color: '#71717a', fontSize: 12, marginTop: 2 }}>
            {isSavingToDrive
              ? 'Uploading transcript, summary & tasks…'
              : driveSaved
                ? 'Files uploaded to WokkahTranscript folder'
                : driveConnected
                  ? 'Upload transcript, summary & tasks'
                  : 'Connect Google Drive in Settings'}
          </Text>
        </View>
        {!isSavingToDrive && driveConnected && !driveSaved && (
          <Icon name="arrow.up.circle" size={22} tintColor="#818cf8" />
        )}
      </Pressable>

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
        <Icon name="trash" size={16} tintColor="#ef4444" />
        <Text style={{ color: '#ef4444', fontSize: 14, fontWeight: '600' }}>
          Delete Transcript
        </Text>
      </Pressable>
    </ScrollView>
  );
}
